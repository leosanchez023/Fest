import assert from "node:assert/strict";
import db from "../database/connection.js";
import { construirFiltros } from "../src/modules/relatorios/relatorios.routes.js";

const pedidos = construirFiltros({
  tab: "pedidos",
  from: "2026-01-01",
  to: "2026-01-31",
  status: "Em andamento",
  extraKey: "tipo",
  extra: "Venda",
  q: "Maria"
});
assert.match(pedidos.pedidosSql, /p\.data_pedido >= \?/);
assert.match(pedidos.pedidosSql, /DATE_ADD\(\?, INTERVAL 1 DAY\)/);
assert.match(pedidos.pedidosSql, /p\.status IN \(\?,\?,\?,\?\)/);
assert.match(pedidos.pedidosSql, /p\.tipo_pedido = \?/);
assert.deepEqual(pedidos.pedidosParams, [
  "2026-01-01", "2026-01-31", "%Maria%", "%Maria%", "%Maria%",
  "CONFIRMADO", "EM_PREPARO", "CONFERENCIA", "PENDENTE", "VENDA"
]);

const financeiro = construirFiltros({
  tab: "financeiro",
  status: "Parcial",
  extraKey: "forma",
  extra: "Pix"
});
assert.match(financeiro.pedidosSql, /COALESCE\(pg\.total_pago, 0\) - COALESCE\(pg\.reembolsos, 0\)/);
assert.match(financeiro.pedidosSql, /pf\.forma_pagamento = \?/);
assert.deepEqual(financeiro.pedidosParams, ["PIX"]);

const estoque = construirFiltros({
  tab: "estoque",
  status: "Estoque baixo",
  extraKey: "categoria",
  extra: "Mesas",
  q: "mesa"
});
assert.match(estoque.produtosSql, /estoque_minimo/);
assert.match(estoque.produtosSql, /categoria = \?/);
assert.deepEqual(estoque.produtosParams, ["%mesa%", "%mesa%", "%mesa%", "Mesas"]);

assert.throws(
  () => construirFiltros({ tab: "pedidos", from: "2026-02-30", to: "2026-03-01" }),
  /Período inválido/
);
assert.throws(
  () => construirFiltros({ tab: "pedidos", from: "2026-03-02", to: "2026-03-01" }),
  /início do período/
);

console.log("Testes de filtros de relatórios ok");
await db.end();
