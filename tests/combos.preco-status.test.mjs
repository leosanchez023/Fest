import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import * as model from "../src/modules/combos/combos.model.js";

const originalQuery = db.query;
const originalGetConnection = db.getConnection;
const statements = [];

function fakeConnection({ active = 1, exists = true } = {}) {
  return {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (sql.includes("SELECT id, ativo FROM combos")) {
        return [exists ? [{ id: 7, ativo: active }] : []];
      }
      if (sql.includes("SELECT id FROM combos WHERE id = ?")) return [exists ? [{ id: 7 }] : []];
      if (sql.includes("SELECT id, ativo FROM produtos")) return [[{ id: 12, ativo: 1 }]];
      if (sql.includes("SELECT id FROM combo_itens")) return [[]];
      if (sql.includes("INSERT INTO combos")) return [{ insertId: 7 }];
      return [{ affectedRows: 1, insertId: 15 }];
    }
  };
}

try {
  let current = fakeConnection();
  db.getConnection = async () => current;
  db.query = async (sql, params = []) => {
    statements.push({ sql, params });
    return [[{ id: 7, nome: "Teste", preco: 125, ativo: 1, total_itens: 1 }]];
  };

  const combos = await model.listarCombos();
  assert.equal(combos[0].preco, 125);
  assert.match(statements[0].sql, /AS preco/);
  assert.doesNotMatch(statements[0].sql, /SELECT c\.\*/);

  await model.criarCombo({
    nome: "Combo de teste",
    preco: 125,
    itens: [{ produto_id: 12, quantidade: 2 }]
  });
  const insert = statements.find(({ sql }) => sql.includes("INSERT INTO combos"));
  assert.equal(insert.params[3], 125);
  assert.equal(insert.params[4], 125, "O preço único deve permanecer compatível com ambas as colunas históricas");

  statements.length = 0;
  await model.atualizarCombo(7, {
    nome: "Combo atualizado",
    preco: 139,
    itens: [{ produto_id: 12, quantidade: 2 }]
  });
  const update = statements.find(({ sql }) => sql.includes("UPDATE combos"));
  assert.equal(update.params[3], 139);
  assert.equal(update.params[4], 139);

  statements.length = 0;
  current = fakeConnection({ active: 1 });
  await model.atualizarStatusCombo(7, false);
  assert.equal(statements.filter(({ sql }) => sql.includes("UPDATE combos SET ativo")).length, 1);
  assert.deepEqual(
    statements.find(({ sql }) => sql.includes("UPDATE combos SET ativo")).params,
    [0, 7]
  );
  assert.equal(statements.some(({ sql }) => sql.includes("DELETE FROM combo_itens")), false);

  current = fakeConnection({ exists: false });
  await assert.rejects(model.atualizarStatusCombo(404, true), { statusCode: 404 });

  const template = await readFile(new URL("../views/pages/combos.handlebars", import.meta.url), "utf8");
  assert.match(template, /fetch\(`\/combos\/\$\{id\}\/status`/);
  assert.match(template, /method:\s*'PATCH'/);
  assert.doesNotMatch(template, /fetch\(`\/combos\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'/);

  console.log("Testes simulados de preço único e atualização de status de combos ok");
} finally {
  db.query = originalQuery;
  db.getConnection = originalGetConnection;
  await db.end();
}
