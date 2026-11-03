import assert from "node:assert/strict";
import db from "../database/connection.js";
import { atualizarClienteComEndereco } from "../src/modules/clientes/clientes.model.js";

const originalConnect = db.connect;
const statements = [];
let existingAddress;

function fakeConnection() {
  return {
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: null };
      if (sql.includes("SELECT id, rua, numero, bairro")) return { rows: [existingAddress], rowCount: 1 };
      if (sql.includes("INSERT INTO endereco")) return { rows: [{ id: 22 }], rowCount: 1 };
      if (sql.includes("SELECT") && sql.includes("FROM cliente c")) {
        const rows = [{
          cliente_id: 4,
          id_endereco: statements.some(({ sql: query }) => query.includes("INSERT INTO endereco")) ? 22 : 17
        }];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 1 };
    }
  };
}

const originalData = {
  rua: "Rua Antiga",
  numero: "10",
  bairro: "Centro",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01000-000",
  referencia: null
};
const clientData = {
  nome: "Cliente",
  email: "cliente@example.com",
  telefone: "11999999999",
  cpf: "12345678901",
  nascimento: null,
  ...originalData
};

try {
  existingAddress = { id: 17, ...originalData };
  db.connect = async () => fakeConnection();
  const updated = await atualizarClienteComEndereco(4, {
    ...clientData,
    rua: "Rua Nova"
  }, 17);
  assert.equal(updated.id_endereco, 22);
  assert.equal(statements.some(({ sql }) => sql.includes("UPDATE endereco")), false);
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO endereco")), true);
  assert.equal(
    statements.find(({ sql }) => sql.includes("UPDATE cliente") && sql.includes("id_endereco")).params[5],
    22
  );

  statements.length = 0;
  db.connect = async () => fakeConnection();
  const unchanged = await atualizarClienteComEndereco(4, clientData, 17);
  assert.equal(unchanged.id_endereco, 17);
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO endereco")), false);

  console.log("Testes simulados de edição de endereço sem alterar destinos históricos de pedidos ok");
} finally {
  db.connect = originalConnect;
  await db.end();
}
