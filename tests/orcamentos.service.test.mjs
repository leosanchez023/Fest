import assert from "node:assert/strict";
import db from "../database/connection.js";
import * as service from "../src/modules/orcamentos/orcamentos.service.js";

const originalGetConnection = db.getConnection;
const originalQuery = db.query;
const statements = [];
let nextItemId = 83;
let nextPedidoId = 72;

function fakeConnection({ pedido, itens = [], componentes = [] }) {
  return {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (sql.includes("SELECT * FROM pedidos")) return [[pedido]];
      if (sql.includes("SELECT * FROM pedido_itens")) return [itens];
      if (sql.includes("SELECT id, produto_id, combo_id, tipo_item")) return [itens];
      if (sql.includes("SELECT produto_id, quantidade_por_unidade")) return [componentes];
      if (sql.includes("SELECT * FROM produtos")) {
        const produtoId = Number(params[0]);
        return [[{
          id: produtoId,
          estoque: 20,
          estoque_reservado: 0,
          estoque_em_uso: 0,
          estoque_manutencao: 0,
          estoque_danificado: 0,
          estoque_minimo: 0
        }]];
      }
      if (sql.includes("FROM reservas_estoque")) return [[]];
      if (sql.includes("INSERT INTO pedidos")) return [{ insertId: nextPedidoId }];
      if (sql.includes("INSERT INTO pedido_itens")) return [{ insertId: nextItemId }];
      if (sql.includes("SELECT produto_id, quantidade")) return [[]];
      return [{ affectedRows: 1, insertId: 91 }];
    }
  };
}

try {
  const pedido = {
    id: 44,
    usuario_id: 9,
    status_documento: "ORCAMENTO",
    status: "ORCAMENTO",
    tipo_pedido: "MISTO"
  };
  const itens = [
    { id: 1, pedido_id: 44, produto_id: 10, tipo_item: "ALUGUEL", quantidade: 3, combo_id: null },
    { id: 2, pedido_id: 44, produto_id: 20, tipo_item: "VENDA", quantidade: 2, combo_id: null }
  ];
  const connection = fakeConnection({ pedido, itens });
  db.getConnection = async () => connection;

  assert.equal(await service.converterParaPedido(44), true);
  const saleUpdate = statements.find(({ sql }) => sql.includes("UPDATE produtos SET estoque = estoque -"));
  const reserveUpdate = statements.find(({ sql }) => sql.includes("UPDATE produtos SET estoque_reservado ="));
  assert.deepEqual(saleUpdate.params, [2, 20], "Sold quantities must reduce physical stock");
  assert.deepEqual(reserveUpdate.params, [3, 10], "Rental quantities must be reserved, not sold");
  assert.equal(
    statements.filter(({ sql }) => sql.includes("INSERT INTO movimentacao_estoque"))
      .some(({ params }) => params[3] === "VENDA"),
    true,
    "Sale conversion must register its stock movement"
  );
  assert.equal(
    statements.filter(({ sql }) => sql.includes("INSERT INTO movimentacao_estoque"))
      .some(({ params }) => params[3] === "RESERVA"),
    true,
    "Rental conversion must register its reservation movement"
  );

  statements.length = 0;
  pedido.status_documento = "PEDIDO";
  pedido.status = "CONFIRMADO";
  assert.equal(await service.converterParaPedido(44), true);
  assert.equal(
    statements.some(({ sql }) => /^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql)),
    false,
    "Retrying conversion must not repeat stock changes"
  );

  statements.length = 0;
  const duplicateConnection = fakeConnection({
    pedido: { ...pedido, status_documento: "ORCAMENTO", status: "ORCAMENTO" },
    itens: [{
      id: 2,
      produto_id: null,
      combo_id: 6,
      tipo_item: "ALUGUEL",
      quantidade: 2,
      valor_unitario: 80,
      subtotal: 160
    }],
    componentes: [{
      produto_id: 10,
      quantidade_por_unidade: 3,
      quantidade_total: 6
    }]
  });
  db.getConnection = async () => duplicateConnection;
  assert.equal(await service.duplicarOrcamento(44), 72);
  const copiedComponent = statements.find(({ sql }) => sql.includes("INSERT INTO pedido_item_componentes"));
  assert.deepEqual(copiedComponent.params, [83, 72, 10, 3, 6]);
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO pagamentos")), false);

  statements.length = 0;
  db.query = async (sql, params) => {
    statements.push({ sql, params });
    return [{ affectedRows: 1 }];
  };
  assert.equal(await service.excluirOrcamento(44), true);
  assert.match(statements[0].sql, /UPDATE pedidos\s+SET status = 'CANCELADO'/);
  assert.match(statements[0].sql, /status_documento = 'ORCAMENTO'/);
  assert.equal(statements.some(({ sql }) => sql.includes("DELETE FROM")), false);

  console.log("Testes simulados de conversão mista/idempotente, cópia de combos e cancelamento seguro ok");
} finally {
  db.getConnection = originalGetConnection;
  db.query = originalQuery;
  await db.end();
}
