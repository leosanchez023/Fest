import bcrypt from "bcrypt";
import db from "../../../database/connection.js";
import * as model from "./usuarios.model.js";
import { ApiError, PERMISSION_KEYS } from "./funcionarios.validation.js";
import { isValidPassword } from "../../config/security.js";

function assertId(id) {
  const parsed = Number(id);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(400, "INVALID_ID", "Identificador de funcionário inválido.");
  }
  return parsed;
}

function normalizePermissions(permissions = {}) {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Number(permissions[key] || 0)]));
}

function hasAdminManagementGrants(actionGrants = {}) {
  return ["view", "create", "edit", "remove"].every((action) =>
    Number(actionGrants.cadastro_admin?.[action]) === 1
  );
}

async function transaction(callback) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ensureNotLastAdmin(connection, targetId, willRemainAdmin) {
  if (willRemainAdmin) return;
  const admins = await model.listarAdministradoresAtivos(connection);
  if (admins.includes(Number(targetId)) && admins.length <= 1) {
    throw new ApiError(409, "LAST_ADMIN", "Não é possível remover o último administrador ativo.");
  }
}

export async function listarFuncionarios(filters) {
  const result = await model.buscarUsuariosComPermissoes(filters);
  return {
    items: result.rows.map((row) => ({
      ...row,
      active: Number(row.active) === 1,
      canLogin: Number(row.canLogin) === 1,
      permissions: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Number(row[key] || 0)]))
    })),
    total: result.total
  };
}

export async function obterFuncionario(id) {
  const parsedId = assertId(id);
  const profile = await model.buscarPerfilFuncionario(parsedId);
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Funcionário não encontrado.");
  const events = await model.buscarEventosFuncionario(parsedId);
  const activities = await model.buscarAtividadeFuncionario(parsedId);
  const security = await model.resumirSegurancaFuncionario(parsedId);
  profile.active = Number(profile.active) === 1;
  profile.canLogin = Number(profile.canLogin) === 1;
  profile.permissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Number(profile.permissions[key] || 0)]));
  return { ...profile, events, activities, audit: activities, security };
}

export async function criarFuncionario(data, actorId, photoPath = null) {
  if (!isValidPassword(data.senha)) {
    throw new ApiError(400, "INVALID_PASSWORD", "A senha deve ter pelo menos 8 caracteres.");
  }
  if (Buffer.byteLength(data.senha, "utf8") > 72) {
    throw new ApiError(400, "INVALID_PASSWORD", "A senha deve ter no máximo 72 caracteres.");
  }
  const passwordHash = await bcrypt.hash(data.senha, 10);
  const permissionsProvided = data.permissoes !== undefined;

  return transaction(async (connection) => {
    if (await model.emailOuCpfEmUso(data.email, data.cpf ?? null, 0, connection)) {
      throw new ApiError(409, "DUPLICATE_USER", "E-mail ou CPF já cadastrado.");
    }

    let permissions = data.permissoes;
    let actionGrants = data.acoes;
    if (!permissionsProvided) {
      const template = await model.buscarPermissoesPerfil(data.cargo, connection);
      permissions = template?.permissions;
      actionGrants = template?.actions;
    }
    permissions = normalizePermissions(permissions || {});

    const userId = await model.inserirUsuario({
      ...data,
      senha: passwordHash,
      foto_path: photoPath
    }, connection);
    await model.substituirPermissoes(userId, permissions, actionGrants, connection);
    await model.registrarAuditoria(connection, actorId, userId, "funcionario_criado", {
      name: data.nome,
      email: data.email,
      role: data.cargo || null,
      permissions: permissionsProvided ? "explicit" : (data.cargo ? "role_template_or_empty" : "empty"),
      perms: actionGrants || {}
    });
    return model.buscarPerfilFuncionario(userId, connection);
  });
}

export async function atualizarFuncionario(id, data, actorId, photoPath) {
  const userId = assertId(id);
  if (data.senha && (!isValidPassword(data.senha) || Buffer.byteLength(data.senha, "utf8") > 72)) {
    throw new ApiError(400, "INVALID_PASSWORD", "A senha deve ter de 8 a 72 caracteres.");
  }
  const passwordHash = data.senha ? await bcrypt.hash(data.senha, 10) : undefined;

  return transaction(async (connection) => {
    const current = await model.buscarUsuarioParaEdicao(userId, connection, true);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Funcionário não encontrado.");

    const updates = { ...data };
    delete updates.senha;
    delete updates.acoes;
    if (passwordHash) updates.senha = passwordHash;
    if (photoPath) updates.foto_path = photoPath;
    const effectiveEmail = Object.hasOwn(updates, "email") ? updates.email : current.email;
    const effectiveCpf = Object.hasOwn(updates, "cpf") ? updates.cpf : current.cpf;
    if (await model.emailOuCpfEmUso(effectiveEmail, effectiveCpf, userId, connection)) {
      throw new ApiError(409, "DUPLICATE_USER", "E-mail ou CPF já cadastrado.");
    }

    const existingProfile = await model.buscarPerfilFuncionario(userId, connection);
    const currentPermissions = existingProfile.permissions;
    const nextPermissions = data.permissoes ? normalizePermissions(data.permissoes) : currentPermissions;
    const nextActionGrants = data.acoes || existingProfile.perms;
    const currentAdmin = Number(current.ativo) === 1 &&
      Number(current.login_habilitado) === 1 &&
      Number(currentPermissions.cadastro_admin) === 1 &&
      hasAdminManagementGrants(existingProfile.perms);
    const nextActive = updates.ativo === undefined ? Number(current.ativo) : Number(updates.ativo);
    const nextCanLogin = updates.login_habilitado === undefined
      ? Number(current.login_habilitado)
      : Number(updates.login_habilitado);
    const nextAdmin = nextActive === 1 &&
      nextCanLogin === 1 &&
      Number(nextPermissions.cadastro_admin) === 1 &&
      hasAdminManagementGrants(nextActionGrants);
    const isSelf = Number(actorId) === userId;
    const selfPermissionsChanged = Boolean(data.permissoes || data.acoes) &&
      PERMISSION_KEYS.some((key) =>
        Number(nextPermissions[key]) !== Number(currentPermissions[key]) ||
        JSON.stringify(nextActionGrants[key]) !== JSON.stringify(existingProfile.perms[key])
      );

    if (isSelf && (
      (updates.ativo !== undefined && nextActive !== Number(current.ativo)) ||
      (updates.login_habilitado !== undefined && nextCanLogin !== Number(current.login_habilitado))
    )) {
      throw new ApiError(403, "SELF_SECURITY_CHANGE", "Não é permitido alterar seu próprio status de acesso.");
    }
    if (isSelf && selfPermissionsChanged && !currentAdmin) {
      throw new ApiError(403, "SELF_SECURITY_CHANGE", "Não é permitido alterar suas próprias permissões.");
    }
    if (currentAdmin && !nextAdmin) await ensureNotLastAdmin(connection, userId, false);

    delete updates.permissoes;
    await model.atualizarUsuario(userId, updates, connection);
    if (data.permissoes || data.acoes) {
      await model.substituirPermissoes(userId, nextPermissions, nextActionGrants, connection);
    }
    const changedFields = Object.keys(updates).filter((key) => key !== "senha");
    await model.registrarAuditoria(connection, actorId, userId, "funcionario_atualizado", {
      changedFields,
      passwordChanged: Boolean(passwordHash),
      permissionsChanged: Boolean(data.permissoes || data.acoes)
    });
    return {
      profile: await model.buscarPerfilFuncionario(userId, connection),
      previousPhoto: current.foto_path || null
    };
  });
}

export async function atualizarStatusFuncionario(id, changes, actorId) {
  const userId = assertId(id);
  if (Number(actorId) === userId) {
    throw new ApiError(403, "SELF_STATUS_CHANGE", "Não é permitido alterar seu próprio status de acesso.");
  }
  return transaction(async (connection) => {
    const current = await model.buscarUsuarioParaEdicao(userId, connection, true);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Funcionário não encontrado.");
    const updates = {};
    if (changes.ativo !== undefined) updates.ativo = changes.ativo;
    if (changes.login_habilitado !== undefined) updates.login_habilitado = changes.login_habilitado;
    if (!Object.keys(updates).length) {
      throw new ApiError(400, "EMPTY_STATUS", "Informe active e/ou canLogin para atualizar o status.");
    }

    const profile = await model.buscarPerfilFuncionario(userId, connection);
    const nextActive = updates.ativo === undefined ? Number(current.ativo) : Number(updates.ativo);
    const nextCanLogin = updates.login_habilitado === undefined
      ? Number(current.login_habilitado)
      : Number(updates.login_habilitado);
    const remainsAdmin = nextActive === 1 &&
      nextCanLogin === 1 &&
      Number(profile.permissions.cadastro_admin) === 1 &&
      hasAdminManagementGrants(profile.perms);
    await ensureNotLastAdmin(
      connection,
      userId,
      Number(current.ativo) === 1 && Number(current.login_habilitado) === 1 &&
        Number(profile.permissions.cadastro_admin) === 1 &&
        hasAdminManagementGrants(profile.perms) &&
        remainsAdmin
    );
    await model.atualizarUsuario(userId, updates, connection);
    await model.registrarAuditoria(connection, actorId, userId, "funcionario_status_alterado", updates);
    return model.buscarPerfilFuncionario(userId, connection);
  });
}

export async function inativarFuncionario(id, actorId) {
  const userId = assertId(id);
  if (Number(actorId) === userId) {
    throw new ApiError(403, "SELF_DELETE", "Não é permitido inativar seu próprio usuário.");
  }
  return transaction(async (connection) => {
    const current = await model.buscarUsuarioParaEdicao(userId, connection, true);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Funcionário não encontrado.");
    const profile = await model.buscarPerfilFuncionario(userId, connection);
    const isActiveAdmin = Number(current.ativo) === 1 &&
      Number(current.login_habilitado) === 1 &&
      Number(profile.permissions.cadastro_admin) === 1 &&
      hasAdminManagementGrants(profile.perms);
    await ensureNotLastAdmin(connection, userId, !isActiveAdmin);
    await model.atualizarUsuario(userId, { ativo: 0, login_habilitado: 0 }, connection);
    await model.registrarAuditoria(connection, actorId, userId, "funcionario_inativado", {
      active: false,
      canLogin: false
    });
    return { id: userId, active: false, canLogin: false };
  });
}

export async function listarPerfis() {
  return model.listarPerfisPermissoes();
}

export async function salvarPerfil(cargo, permissionData, actorId) {
  const role = String(cargo ?? "").trim();
  if (!role || role.length > 100) {
    throw new ApiError(400, "INVALID_ROLE", "Cargo é obrigatório e deve ter até 100 caracteres.");
  }
  const normalizedPermissions = normalizePermissions(permissionData.permissoes);
  const actionGrants = permissionData.acoes;
  await transaction(async (connection) => {
    await model.salvarPerfilPermissoes(role, normalizedPermissions, actionGrants, actorId, connection);
    await model.registrarAuditoria(connection, actorId, null, "modelo_permissoes_atualizado", {
      role,
      permissions: normalizedPermissions,
      perms: actionGrants
    });
  });
  return { role, permissions: normalizedPermissions, perms: actionGrants };
}

export async function listarAuditoria(filters) {
  return model.listarAuditoria(filters);
}

export async function listarSeguranca(filters) {
  return model.listarEventosSeguranca(filters);
}

export async function getUsuarios() {
  return model.getUsuarios();
}

export async function criarUsuario(data, actorId) {
  const name = String(data.nome ?? "").trim();
  const email = String(data.email ?? "").trim().toLowerCase();
  if (!name || name.length > 100) throw new ApiError(400, "INVALID_NAME", "Nome é obrigatório e deve ter até 100 caracteres.");
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "INVALID_EMAIL", "Informe um e-mail válido com até 100 caracteres.");
  }
  const normalized = {
    ...data,
    nome: name,
    email,
    senha: data.senha,
    ativo: 1,
    login_habilitado: 1
  };
  const permissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [
    key,
    data[key] === true || data[key] === "on" || data[key] === "1" ? 1 : 0
  ]));
  normalized.permissoes = permissions;
  await criarFuncionario(normalized, actorId);
}
