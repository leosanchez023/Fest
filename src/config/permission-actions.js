const readOnlyPostPaths = new Set(["/pedidos/calcular-rota"]);

export function permissionActionForRequest({ method, path }) {
  const verb = String(method || "").toUpperCase();
  const normalizedPath = String(path || "").replace(/\/+$/, "") || "/";
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return "view";
  if (verb === "POST" && readOnlyPostPaths.has(normalizedPath)) return "view";
  if (verb === "POST") return "create";
  if (verb === "PUT" || verb === "PATCH") return "edit";
  if (verb === "DELETE") return "remove";
  return null;
}
