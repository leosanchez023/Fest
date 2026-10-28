import * as service from "./usuarios.service.js";
import { PASSWORD_MIN_LENGTH } from "../../config/security.js";
import { ApiError, normalizeFuncionarioInput, parseBoolean } from "./funcionarios.validation.js";
import {
  parseFuncionarioRequest,
  persistFuncionarioPhoto,
  removeFuncionarioPhoto,
  removeStagedPhoto
} from "./funcionarios.photo.js";

function sendApiError(res, error) {
  const duplicate = error?.code === "ER_DUP_ENTRY";
  const status = error instanceof ApiError ? error.status : duplicate ? 409 : 500;
  const code = error instanceof ApiError ? error.code : duplicate ? "DUPLICATE_USER" : "INTERNAL_ERROR";
  const message = error instanceof ApiError
    ? error.message
    : duplicate
      ? "E-mail ou CPF já cadastrado."
      : "Não foi possível concluir a operação.";
  if (status >= 500) console.error(error);
  return res.status(status).json({ data: null, error: { code, message }, message });
}

function parsePage(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 100));
  return { page, limit, offset: (page - 1) * limit };
}

function parseOptionalId(value, name) {
  if (value === undefined || value === "") return undefined;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, "INVALID_FILTER", `Filtro ${name} deve ser um identificador válido.`);
  }
  return id;
}

async function readRequest(req, creating = false) {
  const parsed = await parseFuncionarioRequest(req);
  try {
    const data = normalizeFuncionarioInput(parsed.fields, { creating });
    return { data, file: parsed.file };
  } catch (error) {
    await removeStagedPhoto(parsed.file);
    throw error;
  }
}

export async function listarUsuarios(req, res) {
  try {
    const usuarios = await service.getUsuarios();
    res.render("pages/funcionarios", { usuarios, erros: [] });
  } catch (err) {
    console.error(err);
    res.render("pages/funcionarios", {
      usuarios: [],
      erros: [{ texto: "Erro ao carregar usuários" }]
    });
  }
}

export async function criarUsuario(req, res) {
  const { nome, email, senha, senha2 } = req.body;
  const erros = [];
  if (!nome) erros.push({ texto: "Nome inválido" });
  if (!email) erros.push({ texto: "E-mail inválido" });
  if (!senha) erros.push({ texto: "Senha inválida" });
  if (senha && senha.length < PASSWORD_MIN_LENGTH) {
    erros.push({ texto: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres` });
  }
  if (senha !== senha2) erros.push({ texto: "As senhas não coincidem" });
  if (erros.length) {
    const usuarios = await service.getUsuarios();
    return res.status(400).render("pages/funcionarios", { erros, usuarios });
  }
  try {
    await service.criarUsuario(req.body, req.user?.id);
    return res.redirect("/usuarios");
  } catch (err) {
    console.error(err);
    const usuarios = await service.getUsuarios();
    return res.status(err instanceof ApiError ? err.status : 400).render("pages/funcionarios", {
      erros: [{ texto: err.message }],
      usuarios
    });
  }
}

export async function listarFuncionarios(req, res) {
  try {
    const { page, limit, offset } = parsePage(req.query);
    const search = String(req.query.search ?? req.query.q ?? "").trim();
    if (search.length > 100) throw new ApiError(400, "INVALID_FILTER", "Busca deve ter até 100 caracteres.");
    let active;
    if (req.query.active !== undefined) active = parseBoolean(req.query.active, "active");
    const result = await service.listarFuncionarios({
      search,
      active,
      role: String(req.query.role ?? "").trim() || undefined,
      sort: String(req.query.sort ?? "name"),
      order: String(req.query.order ?? "asc").toLowerCase(),
      limit,
      offset
    });
    return res.json({ data: result.items, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function obterFuncionario(req, res) {
  try {
    return res.json({ data: await service.obterFuncionario(req.params.id) });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function criarFuncionario(req, res) {
  let stagedFile;
  let photoPath;
  try {
    const { data, file } = await readRequest(req, true);
    stagedFile = file;
    if (!data.senha || data.senha.length < PASSWORD_MIN_LENGTH) {
      throw new ApiError(400, "INVALID_PASSWORD", `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    }
    photoPath = await persistFuncionarioPhoto(file);
    const profile = await service.criarFuncionario(data, req.user?.id, photoPath);
    return res.status(201).json({ data: profile });
  } catch (error) {
    if (photoPath) await removeFuncionarioPhoto(photoPath);
    return sendApiError(res, error);
  } finally {
    await removeStagedPhoto(stagedFile);
  }
}

export async function atualizarFuncionario(req, res) {
  let stagedFile;
  let photoPath;
  try {
    const { data, file } = await readRequest(req);
    stagedFile = file;
    photoPath = await persistFuncionarioPhoto(file);
    const result = await service.atualizarFuncionario(req.params.id, data, req.user?.id, photoPath);
    if (photoPath) await removeFuncionarioPhoto(result.previousPhoto);
    return res.json({ data: result.profile });
  } catch (error) {
    if (photoPath) await removeFuncionarioPhoto(photoPath);
    return sendApiError(res, error);
  } finally {
    await removeStagedPhoto(stagedFile);
  }
}

export async function atualizarStatusFuncionario(req, res) {
  try {
    const { data } = await readRequest(req);
    const changes = {};
    if (data.ativo !== undefined) changes.ativo = data.ativo;
    if (data.login_habilitado !== undefined) changes.login_habilitado = data.login_habilitado;
    return res.json({
      data: await service.atualizarStatusFuncionario(req.params.id, changes, req.user?.id)
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function inativarFuncionario(req, res) {
  try {
    return res.json({
      data: await service.inativarFuncionario(req.params.id, req.user?.id)
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function listarAuditoria(req, res) {
  try {
    const { limit, offset, page } = parsePage(req.query);
    const result = await service.listarAuditoria({
      targetId: parseOptionalId(req.query.targetId, "targetId"),
      actorId: parseOptionalId(req.query.actorId, "actorId"),
      action: String(req.query.action ?? "").trim() || undefined,
      limit,
      offset
    });
    return res.json({ data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function listarSeguranca(req, res) {
  try {
    const { limit, offset, page } = parsePage(req.query);
    const result = String(req.query.result ?? "").trim();
    if (result && !["success", "failure"].includes(result)) {
      throw new ApiError(400, "INVALID_FILTER", "Filtro result deve ser success ou failure.");
    }
    const email = String(req.query.email ?? "").trim();
    if (email.length > 100) throw new ApiError(400, "INVALID_FILTER", "Filtro email deve ter até 100 caracteres.");
    const events = await service.listarSeguranca({
      result: result || undefined,
      email: email || undefined,
      limit,
      offset
    });
    return res.json({
      data: events.rows,
      counts: events.counts,
      pagination: { page, limit, total: events.total }
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function listarModelosPermissoes(req, res) {
  try {
    return res.json({ data: await service.listarPerfis() });
  } catch (error) {
    return sendApiError(res, error);
  }
}

export async function salvarModeloPermissoes(req, res) {
  try {
    const rawPermissions = req.body?.perms;
    const role = String(req.body?.role ?? "").trim();
    const normalized = normalizeFuncionarioInput({ perms: rawPermissions });
    return res.json({
      data: await service.salvarPerfil(role, normalized, req.user?.id)
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
