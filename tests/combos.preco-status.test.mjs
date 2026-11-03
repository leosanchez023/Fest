import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import * as model from "../src/modules/combos/combos.model.js";

const originalQuery = db.query;
const originalConnect = db.connect;
const statements = [];
let persistedActive = 1;

function fakeConnection({ active = persistedActive, exists = true } = {}) {
  return {
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: null };
      if (sql.includes("UPDATE combos SET ativo")) {
        persistedActive = Number(params[0]);
        return { rows: [{ id: params[1], ativo: persistedActive }], rowCount: 1 };
      }
      if (sql.includes("SELECT id, ativo FROM combos")) {
        const rows = exists ? [{ id: 7, ativo: active }] : [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("SELECT id FROM combos WHERE id = $1")) {
        const rows = exists ? [{ id: 7 }] : [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("SELECT id, ativo FROM produtos")) {
        return { rows: [{ id: 12, ativo: 1 }], rowCount: 1 };
      }
      if (sql.includes("SELECT id FROM combo_itens")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO combos")) return { rows: [{ id: 7 }], rowCount: 1 };
      if (sql.includes("INSERT INTO combo_itens")) return { rows: [{ id: 15 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }
  };
}

try {
  let current = fakeConnection();
  db.connect = async () => current;
  db.query = async (sql, params = []) => {
    statements.push({ sql, params });
    return {
      rows: [{ id: 7, nome: "Teste", preco: 125, ativo: persistedActive, total_itens: 1 }],
      rowCount: 1
    };
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
  assert.equal((await model.listarCombos())[0].ativo, 0, "A listagem deve refletir o status persistido");

  current = fakeConnection({ exists: false });
  await assert.rejects(model.atualizarStatusCombo(404, true), { statusCode: 404 });

  statements.length = 0;
  current = fakeConnection({ active: 0 });
  const reativado = await model.atualizarStatusCombo(7, true);
  assert.equal(reativado.ativo, true);
  assert.deepEqual(
    statements.find(({ sql }) => sql.includes("UPDATE combos SET ativo")).params,
    [1, 7]
  );
  assert.equal(statements.some(({ sql }) => sql.includes("DELETE FROM combo_itens")), false);
  assert.equal((await model.listarCombos())[0].ativo, 1, "A reativação deve permanecer na listagem");

  const template = await readFile(new URL("../views/pages/combos.handlebars", import.meta.url), "utf8");
  const pedidosModel = await readFile(new URL("../src/modules/pedidos/pedidos.model.js", import.meta.url), "utf8");
  assert.match(template, /fetch\(`\/combos\/\$\{id\}\/status`/);
  assert.match(template, /method:\s*'PATCH'/);
  assert.match(template, /FestAlert\?\.confirm/);
  assert.match(template, /FestAlert\?\.success/);
  assert.doesNotMatch(template, /fetch\(`\/combos\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'/);
  assert.match(pedidosModel, /FROM combos\s+WHERE ativo = 1/);
  assert.match(pedidosModel, /Number\(combos\[0\]\.ativo\) !== 1/);

  console.log("Testes simulados de preço único e atualização de status de combos ok");
} finally {
  db.query = originalQuery;
  db.connect = originalConnect;
  await db.end();
}
