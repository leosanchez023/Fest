import assert from "node:assert/strict";
import { permissionActionForRequest } from "../src/config/permission-actions.js";

assert.equal(permissionActionForRequest({ method: "GET", path: "/usuarios/api/funcionarios" }), "view");
assert.equal(permissionActionForRequest({ method: "HEAD", path: "/dashboard" }), "view");
assert.equal(permissionActionForRequest({ method: "POST", path: "/pedidos/calcular-rota" }), "view");
assert.equal(permissionActionForRequest({ method: "POST", path: "/pedidos/calcular-rota/" }), "view");
assert.equal(permissionActionForRequest({ method: "POST", path: "/pedidos/criar" }), "create");
assert.equal(permissionActionForRequest({ method: "PUT", path: "/usuarios/api/funcionarios/3" }), "edit");
assert.equal(permissionActionForRequest({ method: "PATCH", path: "/usuarios/api/funcionarios/3/status" }), "edit");
assert.equal(permissionActionForRequest({ method: "DELETE", path: "/usuarios/api/funcionarios/3" }), "remove");
assert.equal(permissionActionForRequest({ method: "TRACE", path: "/dashboard" }), null);

console.log("Permission action mapping tests passed");
