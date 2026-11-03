import assert from "node:assert/strict";
import db from "../database/connection.js";
import * as model from "../src/modules/pedidos/pedidos.model.js";

const originalConnect = db.connect;
const statements = [];

db.connect = async () => ({
  release() {},
  async query(sql, params = []) {
    statements.push({ sql, params });
    if (sql.includes("INSERT INTO pedidos")) return { rows: [{ id: 501 }], rowCount: 1 };
    if (sql.includes("INSERT INTO pedido_itens")) return { rows: [{ id: 601 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  }
});

try {
  const result = await model.criarPedido({
    usuario_id: 17,
    cliente_id: 29,
    endereco: {},
    data_evento: "2030-07-14",
    data_entrega: "2030-07-13",
    data_retirada: "2030-07-15",
    tipo_pedido: "VENDA",
    status: "ORCAMENTO",
    status_documento: "ORCAMENTO",
    valor_produtos: 120,
    valor_frete: 0,
    valor_desconto: 0,
    valor_total: 120,
    valor_pago: 25,
    forma_pagamento: "PIX",
    itens: [{
      produto_id: 31,
      tipo_item: "VENDA",
      quantidade: 1,
      preco_unitario: 120,
      subtotal: 120
    }]
  });

  assert.equal(result.pedidoId, 501);

  const pedidoInsert = statements.find(({ sql }) => sql.includes("INSERT INTO pedidos"));
  const paymentInsert = statements.find(({ sql }) => sql.includes("INSERT INTO pagamentos"));
  assert.match(pedidoInsert.sql, /cliente_id,\s*usuario_id,/);
  assert.equal(pedidoInsert.params[1], 17, "The authenticated user must be saved on the order");
  assert.match(paymentInsert.sql, /pedido_id,\s*usuario_id,\s*valor,/);
  assert.equal(paymentInsert.params[1], 17, "The authenticated user must be saved on the initial payment");
} finally {
  db.connect = originalConnect;
}

console.log("Testes de persistência do usuário responsável pelo pedido e pagamento ok");
