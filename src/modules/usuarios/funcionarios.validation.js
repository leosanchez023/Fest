export const PERMISSION_KEYS = Object.freeze([
  "dashboard",
  "clientes",
  "produtos",
  "pedidos",
  "relatorios",
  "funcionarios",
  "entregas",
  "retiradas",
  "pagamentos",
  "estoque",
  "fornecedor",
  "cadastro_admin"
]);

export const ACTION_KEYS = Object.freeze(["view", "create", "edit", "remove"]);

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function parseBoolean(value, field) {
  if (value === true || value === 1 || value === "1" || value === "true") return 1;
  if (value === "on" || value === "yes") return 1;
  if (value === false || value === 0 || value === "0" || value === "false" || value === "off" || value === "no") return 0;
  throw new ApiError(400, "INVALID_FIELD", `Campo ${field} deve ser booleano.`);
}

function parsePermissions(raw, directFields = false) {
  let source = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      throw new ApiError(400, "INVALID_PERMISSIONS", "O campo perms deve conter um objeto JSON válido.");
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new ApiError(400, "INVALID_PERMISSIONS", "O campo perms deve ser um objeto.");
  }

  const allowed = new Set(PERMISSION_KEYS);
  if (Object.keys(source).some((key) => !allowed.has(key))) {
    throw new ApiError(400, "INVALID_PERMISSIONS", "O campo perms contém uma permissão não suportada.");
  }

  const permissions = {};
  const actions = {};
  for (const key of PERMISSION_KEYS) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Object.keys(value).some((action) => !ACTION_KEYS.includes(action))) {
        throw new ApiError(400, "INVALID_PERMISSIONS", `perms.${key} contém uma ação não suportada.`);
      }
      actions[key] = Object.fromEntries(ACTION_KEYS.map((action) => [
        action,
        Object.hasOwn(value, action) ? parseBoolean(value[action], `perms.${key}.${action}`) : 0
      ]));
      permissions[key] = ACTION_KEYS.some((action) => actions[key][action] === 1) ? 1 : 0;
    } else if (Object.hasOwn(source, key)) {
      permissions[key] = parseBoolean(value, `perms.${key}`);
      actions[key] = Object.fromEntries(ACTION_KEYS.map((action) => [action, permissions[key]]));
    } else if (!directFields) {
      permissions[key] = 0;
      actions[key] = Object.fromEntries(ACTION_KEYS.map((action) => [action, 0]));
    }
  }
  return { permissions, actions };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeFuncionarioInput(input, { creating = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "INVALID_BODY", "Envie um objeto JSON ou um formulário válido.");
  }

  const result = {};
  const read = (key, alias = key) => {
    if (Object.hasOwn(input, key)) return input[key];
    if (Object.hasOwn(input, alias)) return input[alias];
    return undefined;
  };
  const has = (key, alias = key) => Object.hasOwn(input, key) || Object.hasOwn(input, alias);

  if (has("name", "nome")) {
    const nome = String(read("name", "nome") ?? "").trim();
    if (!nome || nome.length > 100) throw new ApiError(400, "INVALID_NAME", "Nome é obrigatório e deve ter até 100 caracteres.");
    result.nome = nome;
  } else if (creating) {
    throw new ApiError(400, "INVALID_NAME", "Nome é obrigatório.");
  }

  if (has("email")) {
    const email = String(read("email") ?? "").trim().toLowerCase();
    if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, "INVALID_EMAIL", "Informe um e-mail válido com até 100 caracteres.");
    }
    result.email = email;
  } else if (creating) {
    throw new ApiError(400, "INVALID_EMAIL", "E-mail é obrigatório.");
  }

  for (const [field, alias, maxLength] of [
    ["telefone", "phone", 30],
    ["cpf", "cpf", 11],
    ["nascimento", "birth", 10],
    ["cargo", "role", 100]
  ]) {
    const customRole = field === "cargo" && has("customRole") && String(input.customRole ?? "").trim();
    if (!has(alias) && !(field === "cargo" && customRole)) continue;
    let value = field === "cargo" && customRole ? input.customRole : read(alias, field);
    value = String(value ?? "").trim();
    if (field === "cpf") {
      value = value.replace(/\D/g, "");
      if (value && value.length !== 11) throw new ApiError(400, "INVALID_CPF", "CPF deve conter 11 dígitos.");
      result[field] = value || null;
      continue;
    }
    if (field === "nascimento") {
      if (value && !isValidDate(value)) throw new ApiError(400, "INVALID_BIRTH", "Data de nascimento deve usar o formato AAAA-MM-DD.");
      result[field] = value || null;
      continue;
    }
    if (value.length > maxLength) throw new ApiError(400, "INVALID_FIELD", `Campo ${field} deve ter até ${maxLength} caracteres.`);
    result[field] = value || null;
  }

  if (has("active")) result.ativo = parseBoolean(input.active, "active");
  else if (creating) result.ativo = 1;
  if (has("canLogin")) result.login_habilitado = parseBoolean(input.canLogin, "canLogin");
  else if (creating) result.login_habilitado = 1;

  const directPermissions = PERMISSION_KEYS.some((key) => Object.hasOwn(input, key));
  if (has("perms") || directPermissions) {
    const parsedPermissions = parsePermissions(has("perms") ? input.perms : input, directPermissions);
    result.permissoes = parsedPermissions.permissions;
    result.acoes = parsedPermissions.actions;
  }

  if (has("password", "senha")) {
    result.senha = String(read("password", "senha") ?? "");
  }

  return result;
}
