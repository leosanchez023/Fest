import db from "../../../database/connection.js";
import { ACTION_KEYS, PERMISSION_KEYS } from "./funcionarios.validation.js";

const userColumns = `
  u.id,
  u.nome AS name,
  u.email,
  u.telefone AS phone,
  u.cpf,
  DATE_FORMAT(u.nascimento, '%Y-%m-%d') AS birth,
  u.cargo AS role,
  u.ativo AS active,
  u.login_habilitado AS canLogin,
  u.foto_path AS photo,
  u.created_at AS createdAt,
  u.updated_at AS updatedAt,
  u.ultimo_acesso_em AS lastAccessAt
`;

const permissionColumns = PERMISSION_KEYS.map((key) => `COALESCE(p.${key}, 0) AS ${key}`).join(", ");

function getConnection(connection) {
  return connection || db;
}

function emptyActionMap() {
  return Object.fromEntries(PERMISSION_KEYS.map((module) => [
    module,
    Object.fromEntries(ACTION_KEYS.map((action) => [action, 0]))
  ]));
}

function actionRowsToMap(rows) {
  const permissions = emptyActionMap();
  for (const row of rows) {
    if (Object.hasOwn(permissions, row.module) && ACTION_KEYS.includes(row.action)) {
      permissions[row.module][row.action] = 1;
    }
  }
  return permissions;
}

export async function buscarAcoesUsuarios(ids, connection) {
  if (!ids.length) return {};
  const executor = getConnection(connection);
  const [rows] = await executor.query(
    `SELECT usuario_id, module_key AS module, action_key AS action
     FROM user_permission_actions
     WHERE usuario_id IN (${ids.map(() => "?").join(", ")})`,
    ids
  );
  const grants = Object.create(null);
  for (const row of rows) {
    if (!grants[row.usuario_id]) grants[row.usuario_id] = emptyActionMap();
    if (grants[row.usuario_id][row.module] && ACTION_KEYS.includes(row.action)) {
      grants[row.usuario_id][row.module][row.action] = 1;
    }
  }
  return grants;
}

export async function buscarUsuariosComPermissoes(filters = {}) {
  const clauses = ["1 = 1"];
  const params = [];
  if (filters.search) {
    const search = `%${filters.search}%`;
    clauses.push("(u.nome LIKE ? OR u.email LIKE ? OR u.telefone LIKE ? OR u.cpf LIKE ? OR u.cargo LIKE ?)");
    params.push(search, search, search, search, search);
  }
  if (filters.active !== undefined) {
    clauses.push("u.ativo = ?");
    params.push(filters.active);
  }
  if (filters.role) {
    clauses.push("u.cargo = ?");
    params.push(filters.role);
  }

  const sortColumns = {
    name: "u.nome",
    email: "u.email",
    role: "u.cargo",
    createdAt: "u.created_at",
    lastAccessAt: "u.ultimo_acesso_em"
  };
  const sort = sortColumns[filters.sort] || "u.nome";
  const direction = filters.order === "desc" ? "DESC" : "ASC";
  const where = clauses.join(" AND ");
  const limit = filters.limit;
  const offset = filters.offset;
  const [rows] = await db.query(
    `SELECT ${userColumns}, ${permissionColumns}
     FROM usuario u
     LEFT JOIN user_permissions p
       ON p.usuario_id = u.id
      AND p.id = (SELECT MIN(p2.id) FROM user_permissions p2 WHERE p2.usuario_id = u.id)
     WHERE ${where}
     ORDER BY ${sort} ${direction}, u.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM usuario u WHERE ${where}`, params);
  const ids = rows.map((row) => row.id);
  const actionsByUser = await buscarAcoesUsuarios(ids);
  return {
    rows: rows.map((row) => ({
      ...row,
      perms: actionsByUser[row.id] || emptyActionMap(),
      isAdmin: Number(row.cadastro_admin) === 1,
      lastAccess: row.lastAccessAt
    })),
    total: Number(total)
  };
}

export async function buscarPerfilFuncionario(id, connection) {
  const executor = getConnection(connection);
  const [rows] = await executor.query(
    `SELECT ${userColumns}
     FROM usuario u
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;

  const [permissions] = await executor.query(
    `SELECT ${PERMISSION_KEYS.join(", ")}
     FROM user_permissions
     WHERE usuario_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [id]
  );
  const [actionRows] = await executor.query(
    `SELECT module_key AS module, action_key AS action
     FROM user_permission_actions
     WHERE usuario_id = ?`,
    [id]
  );
  const profile = rows[0];
  profile.permissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Number(permissions[0]?.[key] || 0)]));
  profile.perms = actionRowsToMap(actionRows);
  profile.isAdmin = profile.permissions.cadastro_admin === 1;
  profile.lastAccess = profile.lastAccessAt;
  return profile;
}

export async function buscarUsuarioParaEdicao(id, connection, lock = false) {
  const executor = getConnection(connection);
  const [rows] = await executor.query(
    `SELECT id, nome, email, telefone, cpf, nascimento, cargo, ativo, login_habilitado, foto_path, senha
     FROM usuario
     WHERE id = ?
     LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [id]
  );
  return rows[0] || null;
}

export async function buscarPorEmail(email) {
  const [rows] = await db.query(
    "SELECT id, email FROM usuario WHERE email = ? LIMIT 1",
    [email]
  );
  return rows;
}

export async function emailOuCpfEmUso(email, cpf, ignoredId, connection) {
  const executor = getConnection(connection);
  const [rows] = await executor.query(
    `SELECT id
     FROM usuario
     WHERE (email = ? OR (? IS NOT NULL AND cpf = ?))
       AND id <> ?
     LIMIT 1`,
    [email, cpf, cpf, ignoredId]
  );
  return rows.length > 0;
}

export async function inserirUsuario(data, connection) {
  const executor = getConnection(connection);
  const [result] = await executor.query(
    `INSERT INTO usuario
      (nome, email, senha, telefone, cpf, nascimento, cargo, ativo, login_habilitado, foto_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nome,
      data.email,
      data.senha,
      data.telefone ?? null,
      data.cpf ?? null,
      data.nascimento ?? null,
      data.cargo ?? null,
      data.ativo,
      data.login_habilitado,
      data.foto_path ?? null
    ]
  );
  return result.insertId;
}

export async function atualizarUsuario(id, data, connection) {
  const columns = {
    nome: "nome",
    email: "email",
    telefone: "telefone",
    cpf: "cpf",
    nascimento: "nascimento",
    cargo: "cargo",
    ativo: "ativo",
    login_habilitado: "login_habilitado",
    foto_path: "foto_path",
    senha: "senha"
  };
  const updates = Object.entries(data).filter(([key, value]) => columns[key] && value !== undefined);
  if (!updates.length) return;
  const assignments = updates.map(([key]) => `${columns[key]} = ?`).join(", ");
  await getConnection(connection).query(
    `UPDATE usuario SET ${assignments} WHERE id = ?`,
    [...updates.map(([, value]) => value), id]
  );
}

async function replaceActionGrants(table, keyColumn, keyValue, grants, connection) {
  const executor = getConnection(connection);
  await executor.query(`DELETE FROM ${table} WHERE ${keyColumn} = ?`, [keyValue]);
  const rows = [];
  for (const module of PERMISSION_KEYS) {
    for (const action of ACTION_KEYS) {
      if (Number(grants?.[module]?.[action]) === 1) rows.push([keyValue, module, action]);
    }
  }
  if (!rows.length) return;
  const placeholders = rows.map(() => "(?, ?, ?)").join(", ");
  await executor.query(
    `INSERT INTO ${table} (${keyColumn}, module_key, action_key) VALUES ${placeholders}`,
    rows.flat()
  );
}

export async function substituirPermissoes(id, permissions, actionGrants, connection) {
  const executor = getConnection(connection);
  const [existing] = await executor.query(
    "SELECT id FROM user_permissions WHERE usuario_id = ? ORDER BY id FOR UPDATE",
    [id]
  );
  const values = PERMISSION_KEYS.map((key) => Number(permissions[key] || 0));
  if (existing.length) {
    await executor.query(
      `UPDATE user_permissions SET ${PERMISSION_KEYS.map((key) => `${key} = ?`).join(", ")} WHERE usuario_id = ?`,
      [...values, id]
    );
  } else {
    await executor.query(
      `INSERT INTO user_permissions (usuario_id, ${PERMISSION_KEYS.join(", ")})
       VALUES (?, ${PERMISSION_KEYS.map(() => "?").join(", ")})`,
      [id, ...values]
    );
  }
  const grants = actionGrants || Object.fromEntries(PERMISSION_KEYS.map((module) => [
    module,
    Object.fromEntries(ACTION_KEYS.map((action) => [action, Number(permissions[module] || 0)]))
  ]));
  await replaceActionGrants("user_permission_actions", "usuario_id", id, grants, connection);
}

export async function buscarPermissoesPerfil(cargo, connection) {
  if (!cargo) return null;
  const executor = getConnection(connection);
  const [rows] = await executor.query(
    `SELECT ${PERMISSION_KEYS.join(", ")}
     FROM funcionario_perfis_permissoes
     WHERE cargo = ?
     LIMIT 1`,
    [cargo]
  );
  if (!rows.length) return null;
  const [actionRows] = await executor.query(
    `SELECT module_key AS module, action_key AS action
     FROM funcionario_perfil_acoes
     WHERE cargo = ?`,
    [cargo]
  );
  return {
    permissions: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Number(rows[0][key])])),
    actions: actionRowsToMap(actionRows)
  };
}

export async function listarPerfisPermissoes() {
  const [rows] = await db.query(
    `SELECT cargo AS role, ${PERMISSION_KEYS.join(", ")}, updated_at AS updatedAt
     FROM funcionario_perfis_permissoes
     ORDER BY cargo ASC`
  );
  const [actionRows] = await db.query(
    "SELECT cargo AS role, module_key AS module, action_key AS action FROM funcionario_perfil_acoes"
  );
  const grantsByRole = new Map();
  for (const actionRow of actionRows) {
    if (!grantsByRole.has(actionRow.role)) grantsByRole.set(actionRow.role, emptyActionMap());
    const grants = grantsByRole.get(actionRow.role);
    if (grants[actionRow.module] && ACTION_KEYS.includes(actionRow.action)) {
      grants[actionRow.module][actionRow.action] = 1;
    }
  }
  return rows.map((row) => ({
    role: row.role,
    permissions: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Number(row[key])])),
    perms: grantsByRole.get(row.role) || emptyActionMap(),
    updatedAt: row.updatedAt
  }));
}

export async function salvarPerfilPermissoes(cargo, permissions, actionGrants, actorId, connection) {
  const executor = getConnection(connection);
  const [existing] = await executor.query(
    "SELECT cargo FROM funcionario_perfis_permissoes WHERE cargo = ? FOR UPDATE",
    [cargo]
  );
  const values = PERMISSION_KEYS.map((key) => Number(permissions[key] || 0));
  if (existing.length) {
    await executor.query(
      `UPDATE funcionario_perfis_permissoes
       SET ${PERMISSION_KEYS.map((key) => `${key} = ?`).join(", ")}, updated_by = ?
       WHERE cargo = ?`,
      [...values, actorId, cargo]
    );
  } else {
    await executor.query(
      `INSERT INTO funcionario_perfis_permissoes (cargo, ${PERMISSION_KEYS.join(", ")}, updated_by)
       VALUES (?, ${PERMISSION_KEYS.map(() => "?").join(", ")}, ?)`,
      [cargo, ...values, actorId]
    );
  }
  await replaceActionGrants("funcionario_perfil_acoes", "cargo", cargo, actionGrants, connection);
}

export async function listarAdministradoresAtivos(connection) {
  const [rows] = await getConnection(connection).query(
    `SELECT u.id
     FROM usuario u
     INNER JOIN user_permissions p ON p.usuario_id = u.id
     INNER JOIN user_permission_actions action_view
       ON action_view.usuario_id = u.id
      AND action_view.module_key = 'cadastro_admin'
      AND action_view.action_key = 'view'
     INNER JOIN user_permission_actions action_create
       ON action_create.usuario_id = u.id
      AND action_create.module_key = 'cadastro_admin'
      AND action_create.action_key = 'create'
     INNER JOIN user_permission_actions action_edit
       ON action_edit.usuario_id = u.id
      AND action_edit.module_key = 'cadastro_admin'
      AND action_edit.action_key = 'edit'
     INNER JOIN user_permission_actions action_remove
       ON action_remove.usuario_id = u.id
      AND action_remove.module_key = 'cadastro_admin'
      AND action_remove.action_key = 'remove'
     WHERE u.ativo = 1 AND u.login_habilitado = 1 AND p.cadastro_admin = 1
     FOR UPDATE`
  );
  return [...new Set(rows.map((row) => Number(row.id)))];
}

export async function registrarAuditoria(connection, actorId, targetId, action, details) {
  await getConnection(connection).query(
    `INSERT INTO funcionario_auditoria (actor_id, target_user_id, action, details)
     VALUES (?, ?, ?, ?)`,
    [actorId ?? null, targetId ?? null, action, JSON.stringify(details ?? {})]
  );
}

export async function registrarEventoLogin(req, userId, email, result, reason) {
  const emailAttempted = String(email ?? "").trim().toLowerCase().slice(0, 100) || "-";
  const ip = req.socket?.remoteAddress || req.connection?.remoteAddress || null;
  const userAgent = String(req.get?.("user-agent") || "").slice(0, 255) || null;
  await db.query(
    `INSERT INTO funcionario_login_eventos (usuario_id, email_tentado, resultado, motivo, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId ?? null, emailAttempted, result, reason, ip, userAgent]
  );
}

export async function atualizarUltimoAcesso(userId) {
  await db.query("UPDATE usuario SET ultimo_acesso_em = CURRENT_TIMESTAMP WHERE id = ?", [userId]);
}

export async function buscarEventosFuncionario(id, limit = 50) {
  const [rows] = await db.query(
    `SELECT id, resultado AS result, motivo AS reason, ip, user_agent AS userAgent, created_at AS createdAt
     FROM funcionario_login_eventos
     WHERE usuario_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [id, limit]
  );
  return rows;
}

export async function buscarAtividadeFuncionario(id, limit = 50) {
  const [rows] = await db.query(
    `SELECT a.id, a.action, a.action AS description, 'Funcionários' AS module,
            a.created_at AS createdAt, a.created_at AS at,
            actor.nome AS who, actor.nome AS actorName
     FROM funcionario_auditoria a
     LEFT JOIN usuario actor ON actor.id = a.actor_id
     WHERE a.target_user_id = ?
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ?`,
    [id, limit]
  );
  return rows;
}

export async function resumirSegurancaFuncionario(id) {
  const [[summary]] = await db.query(
    `SELECT
       SUM(resultado = 'success') AS accessCount,
       SUM(resultado = 'failure') AS failedAttempts,
       MAX(CASE WHEN resultado = 'success' THEN created_at END) AS lastLogin
     FROM funcionario_login_eventos
     WHERE usuario_id = ?`,
    [id]
  );
  const [lastEvent] = await db.query(
    `SELECT ip AS lastIp
     FROM funcionario_login_eventos
     WHERE usuario_id = ? AND resultado = 'success'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [id]
  );
  return {
    accessCount: Number(summary.accessCount || 0),
    failedAttempts: Number(summary.failedAttempts || 0),
    lastLogin: summary.lastLogin,
    lastIp: lastEvent[0]?.lastIp || null
  };
}

export async function listarAuditoria({ targetId, actorId, action, limit, offset }) {
  const clauses = ["1 = 1"];
  const params = [];
  if (targetId !== undefined) {
    clauses.push("target_user_id = ?");
    params.push(targetId);
  }
  if (actorId !== undefined) {
    clauses.push("actor_id = ?");
    params.push(actorId);
  }
  if (action) {
    clauses.push("action = ?");
    params.push(action);
  }
  const where = clauses.join(" AND ");
  const [rows] = await db.query(
    `SELECT a.id, a.actor_id AS actorId, a.target_user_id AS targetUserId,
            a.action, a.details, a.created_at AS createdAt, a.created_at AS at,
            actor.nome AS who, actor.nome AS actorName, 'Funcionários' AS module
     FROM funcionario_auditoria a
     LEFT JOIN usuario actor ON actor.id = a.actor_id
     WHERE ${where}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM funcionario_auditoria WHERE ${where}`,
    params
  );
  return { rows, total: Number(total) };
}

export async function listarEventosSeguranca({ result, email, limit, offset }) {
  const clauses = ["1 = 1"];
  const params = [];
  if (result) {
    clauses.push(`EXISTS (
      SELECT 1 FROM funcionario_login_eventos filter_event
      WHERE filter_event.usuario_id = u.id AND filter_event.resultado = ?
    )`);
    params.push(result);
  }
  if (email) {
    clauses.push(`EXISTS (
      SELECT 1 FROM funcionario_login_eventos filter_event
      WHERE filter_event.usuario_id = u.id AND filter_event.email_tentado LIKE ?
    )`);
    params.push(`%${email}%`);
  }
  const where = clauses.join(" AND ");
  const [rows] = await db.query(
    `SELECT u.id AS userId, u.nome AS name, u.cargo AS role,
            u.ativo AS active, u.login_habilitado AS canLogin,
            u.created_at AS createdAt, u.ultimo_acesso_em AS lastAccess,
            COALESCE(stats.accessCount, 0) AS accessCount,
            COALESCE(stats.failedAttempts, 0) AS failedAttempts,
            stats.lastLogin,
            (SELECT login.ip
             FROM funcionario_login_eventos login
             WHERE login.usuario_id = u.id AND login.resultado = 'success'
             ORDER BY login.created_at DESC, login.id DESC
             LIMIT 1) AS lastIp
     FROM usuario u
     LEFT JOIN (
       SELECT usuario_id,
              SUM(resultado = 'success') AS accessCount,
              SUM(resultado = 'failure') AS failedAttempts,
              MAX(CASE WHEN resultado = 'success' THEN created_at END) AS lastLogin
       FROM funcionario_login_eventos
       GROUP BY usuario_id
     ) stats ON stats.usuario_id = u.id
     WHERE ${where}
     ORDER BY u.nome ASC, u.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM usuario u WHERE ${where}`,
    params
  );
  const [[counts]] = await db.query(
    `SELECT
       SUM(resultado = 'success') AS successes,
       SUM(resultado = 'failure') AS failures
     FROM funcionario_login_eventos`
  );
  return {
    rows,
    total: Number(total),
    counts: { successes: Number(counts.successes || 0), failures: Number(counts.failures || 0) }
  };
}

export async function getUsuarios() {
  const [rows] = await db.query(
    `SELECT u.id, u.nome, u.email, u.telefone, u.cpf, u.nascimento, u.cargo,
            u.ativo, u.login_habilitado, u.foto_path, u.created_at, u.updated_at,
            u.ultimo_acesso_em, ${PERMISSION_KEYS.join(", ")}
     FROM usuario u
     LEFT JOIN user_permissions p
       ON p.usuario_id = u.id
      AND p.id = (SELECT MIN(p2.id) FROM user_permissions p2 WHERE p2.usuario_id = u.id)
     ORDER BY u.nome`
  );
  return rows;
}

export async function inserirPermissoes(userId, permissions) {
  return substituirPermissoes(userId, permissions);
}
