export const PASSWORD_MIN_LENGTH = 8;
export const GENERIC_AUTH_ERROR = "E-mail ou senha inválidos.";

export function isValidPassword(senha) {
  return typeof senha === "string" && senha.trim().length >= PASSWORD_MIN_LENGTH;
}

export function normalizarEmail(valor) {
  return String(valor ?? "").trim().toLowerCase();
}
