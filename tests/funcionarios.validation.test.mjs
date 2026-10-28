import assert from "node:assert/strict";
import {
  ACTION_KEYS,
  PERMISSION_KEYS,
  ApiError,
  normalizeFuncionarioInput
} from "../src/modules/usuarios/funcionarios.validation.js";

const employee = normalizeFuncionarioInput({
  name: "  Ana Silva ",
  email: "ANA@example.com",
  phone: "(11) 99999-0000",
  cpf: "123.456.789-09",
  birth: "1990-02-28",
  role: "Personalizado",
  customRole: "  Atendimento ",
  active: "true",
  canLogin: "false",
  perms: JSON.stringify({
    dashboard: { view: true, create: false, edit: 0, remove: 0 },
    estoque: { view: "1", edit: "true" },
    cadastro_admin: { view: 0, create: 0, edit: 0, remove: 0 }
  })
}, { creating: true });

assert.equal(employee.nome, "Ana Silva");
assert.equal(employee.email, "ana@example.com");
assert.equal(employee.telefone, "(11) 99999-0000");
assert.equal(employee.cpf, "12345678909");
assert.equal(employee.nascimento, "1990-02-28");
assert.equal(employee.cargo, "Atendimento");
assert.equal(employee.ativo, 1);
assert.equal(employee.login_habilitado, 0);
assert.equal(employee.permissoes.dashboard, 1);
assert.equal(employee.permissoes.estoque, 1);
assert.equal(employee.permissoes.cadastro_admin, 0);
assert.deepEqual(employee.acoes.dashboard, { view: 1, create: 0, edit: 0, remove: 0 });
assert.deepEqual(employee.acoes.estoque, { view: 1, create: 0, edit: 1, remove: 0 });
assert.deepEqual(PERMISSION_KEYS, [
  "dashboard", "clientes", "produtos", "pedidos", "relatorios", "funcionarios",
  "entregas", "retiradas", "pagamentos", "estoque", "fornecedor", "cadastro_admin"
]);
assert.deepEqual(ACTION_KEYS, ["view", "create", "edit", "remove"]);
assert.equal(Object.hasOwn(employee, "senha"), false);

const legacyModulePermission = normalizeFuncionarioInput({
  perms: { produtos: true }
});
assert.equal(legacyModulePermission.permissoes.produtos, 1);
assert.deepEqual(legacyModulePermission.acoes.produtos, {
  view: 1, create: 1, edit: 1, remove: 1
});

assert.throws(
  () => normalizeFuncionarioInput({ name: "Ana", email: "invalid" }, { creating: true }),
  (error) => error instanceof ApiError && error.code === "INVALID_EMAIL"
);
assert.throws(
  () => normalizeFuncionarioInput({ perms: '{"dashboard": {"execute": true}}' }),
  (error) => error instanceof ApiError && error.code === "INVALID_PERMISSIONS"
);
assert.throws(
  () => normalizeFuncionarioInput({ cpf: "123" }),
  (error) => error instanceof ApiError && error.code === "INVALID_CPF"
);

console.log("Funcionario validation tests passed");
