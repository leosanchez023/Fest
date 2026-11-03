import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import { atualizar } from "../src/modules/produtos/produtos.service.js";

const originalQuery = db.query;
const updates = [];
db.query = async (sql, params = []) => {
  if (sql.includes("SELECT p.id")) {
    return {
      rows: [{
        id: 8,
        nome: "Produto de teste",
        codigo: "T-8",
        categoria: "Teste",
        fornecedor_id: null,
        estoque: 4,
        controla_estoque: true,
        estoque_minimo: 0,
        preco_venda: 10,
        preco_aluguel: 5,
        ativo: 1
      }],
      rowCount: 1
    };
  }
  if (sql.includes("UPDATE produtos SET")) {
    updates.push({ sql, params });
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`Consulta inesperada no teste: ${sql}`);
};

const dados = {
  nome: "Produto de teste",
  controla_estoque: "1",
  estoque: "4",
  estoque_minimo: "0",
  precoVenda: "10",
  precoAluguel: "5"
};

try {
  await atualizar(8, { ...dados, ativo: "0" });
  await atualizar(8, { ...dados, ativo: "1" });

  assert.deepEqual(updates.map(({ params }) => params[8]), [0, 1]);
  assert.ok(updates.every(({ sql }) => /ativo = \$9/.test(sql)));
  assert.ok(updates.every(({ sql }) => !/SET[^]*estoque\s*=/.test(sql)));

  const page = await readFile(new URL("../views/pages/produtos/index.handlebars", import.meta.url), "utf8");
  const controlScript = await readFile(new URL("../public/js/produtos-controle.js", import.meta.url), "utf8");
  const productsScript = await readFile(new URL("../public/js/produtos.js", import.meta.url), "utf8");
  assert.match(page, /{{#if produto}}[\s\S]*name="ativo" id="produto-ativo"/);
  assert.match(controlScript, /produto-ativo/);
  assert.match(controlScript, /Reativar.*Inativar/);
  assert.doesNotMatch(controlScript, /data-product-status/);
  assert.match(productsScript, /data-product-list-menu/);
  assert.match(productsScript, /data-product-list-delete/);
  assert.match(productsScript, /document\.addEventListener\("keydown"/);
  console.log("Persistência de situação cadastral e ações da listagem de produtos ok");
} finally {
  db.query = originalQuery;
}
