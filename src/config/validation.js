export function sanitizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function sanitizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function assertPositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} deve ser um número inteiro positivo.`);
  }
}

export function assertNonNegativeNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} deve ser um número válido e não negativo.`);
  }
}

export function normalizeBody(body = {}) {
  const result = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (typeof value === "string") {
      result[key] = value.trim();
    } else {
      result[key] = value;
    }
  }
  return result;
}
