import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import { findAll, create, atualizar } from "../src/modules/produtos/produtos.model.js";
import { statusEstoque } from "../src/modules/estoque/estoque.service.js";

const originalQuery = db.query;
const queries = [];

try {
  db.query = async (sql, params = []) => {
    queries.push({ sql, params });
    return sql.includes("INSERT INTO produtos") ? [{ insertId: 99 }] : [[]];
  };

  await findAll({
    busca: "mesa",
    categoria: "festa",
    fornecedor: "3",
    disponivelMinimo: "2",
    status: "BAIXO_ESTOQUE",
    ordenacao: "disponivel"
  });
  const listQuery = queries[queries.length - 1];
  assert.deepEqual(listQuery.params, ["%mesa%", "%mesa%", "%mesa%", "%mesa%", "festa", "3", 2, "BAIXO_ESTOQUE"]);
  assert.match(listQuery.sql, /AS disponivel/);
  assert.match(listQuery.sql, /AS status_estoque/);
  assert.match(listQuery.sql, /ORDER BY disponivel DESC, p\.nome ASC/);
  assert.ok(
    listQuery.sql.indexOf("THEN 'INDISPONIVEL'") < listQuery.sql.indexOf("THEN 'BAIXO_ESTOQUE'"),
    "Indisponibilidade deve preceder estoque baixo"
  );

  await findAll({ ordenacao: "nome; DROP TABLE produtos" });
  assert.match(queries[queries.length - 1].sql, /ORDER BY p\.nome ASC$/);

  await create({
    nome: "Mesa",
    estoque: 3,
    precoVenda: 5,
    precoAluguel: 10,
    estoque_minimo: 1
  });
  const insertQuery = queries[queries.length - 1];
  assert.doesNotMatch(insertQuery.sql, /\btipo_produto\b|\btipo\b/);
  assert.equal((insertQuery.sql.match(/\?/g) || []).length, insertQuery.params.length);

  await atualizar(99, {
    nome: "Mesa atualizada",
    estoque: 3,
    precoVenda: 5,
    precoAluguel: 10,
    estoque_minimo: 1
  });
  assert.doesNotMatch(queries[queries.length - 1].sql, /\btipo_produto\b|\btipo\s*=/);

  assert.equal(statusEstoque({ estoque: 5, estoque_reservado: 5, estoque_minimo: 1 }), "INDISPONIVEL");
  assert.equal(statusEstoque({ estoque: 5, estoque_reservado: 3, estoque_minimo: 2 }), "BAIXO_ESTOQUE");
  assert.equal(statusEstoque({ estoque: 10, estoque_em_uso: 2, estoque_minimo: 1 }), "EM_USO");
  assert.equal(statusEstoque({ estoque: 10, estoque_minimo: 1 }), "DISPONIVEL");

  const template = await readFile(new URL("../views/pages/produtos/index.handlebars", import.meta.url), "utf8");
  assert.doesNotMatch(template, /name="tipo"|name="tipo_produto"|<label>Tipo<\/label>/);

  console.log("Testes de disponibilidade, filtros, ordenação e preservação da classificação histórica ok");
} finally {
  db.query = originalQuery;
  await db.end();
}
