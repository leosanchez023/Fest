import assert from "node:assert/strict";
import db from "../database/connection.js";
import * as service from "../src/modules/orcamentos/orcamentos.service.js";

const originalConnect = db.connect;
const originalQuery = db.query;
const statements = [];
let nextItemId = 83;
let nextPedidoId = 72;

function fakeConnection({ pedido, itens = [], componentes = [] }) {
  return {
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: null };
      if (sql.includes("SELECT * FROM pedidos")) return { rows: [pedido], rowCount: 1 };
      if (sql.includes("SELECT * FROM pedido_itens")) return { rows: itens, rowCount: itens.length };
      if (sql.includes("SELECT id, produto_id, combo_id, tipo_item")) return { rows: itens, rowCount: itens.length };
      if (sql.includes("SELECT controla_estoque FROM produtos")) {
        return { rows: [{ controla_estoque: true }], rowCount: 1 };
      }
      if (sql.includes("SELECT produto_id, quantidade_por_unidade")) {
        return { rows: componentes, rowCount: componentes.length };
      }
      if (sql.includes("SELECT * FROM produtos")) {
        const produtoId = Number(params[0]);
        const rows = [{
          id: produtoId,
          estoque: 20,
          estoque_reservado: 0,
          estoque_em_uso: 0,
          estoque_manutencao: 0,
          estoque_danificado: 0,
          estoque_minimo: 0,
          controla_estoque: true
        }];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM reservas_estoque")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO reservas_estoque")) return { rows: [{ id: 91 }], rowCount: 1 };
      if (sql.includes("INSERT INTO pedidos")) return { rows: [{ id: nextPedidoId }], rowCount: 1 };
      if (sql.includes("INSERT INTO pedido_itens")) return { rows: [{ id: nextItemId }], rowCount: 1 };
      if (sql.includes("SELECT produto_id, quantidade")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
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
  db.connect = async () => connection;

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
  db.connect = async () => duplicateConnection;
  assert.equal(await service.duplicarOrcamento(44), 72);
  const copiedComponent = statements.find(({ sql }) => sql.includes("INSERT INTO pedido_item_componentes"));
  assert.deepEqual(copiedComponent.params, [83, 72, 10, 3, 6]);
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO pagamentos")), false);

  statements.length = 0;
  db.query = async (sql, params) => {
    statements.push({ sql, params });
    return { rows: [], rowCount: 1 };
  };
  assert.equal(await service.excluirOrcamento(44), true);
  assert.match(statements[0].sql, /UPDATE pedidos\s+SET status = 'CANCELADO'/);
  assert.match(statements[0].sql, /status_documento = 'ORCAMENTO'/);
  assert.equal(statements.some(({ sql }) => sql.includes("DELETE FROM")), false);

  console.log("Testes simulados de conversão mista/idempotente, cópia de combos e cancelamento seguro ok");
} finally {
  db.connect = originalConnect;
  db.query = originalQuery;
  await db.end();
}
