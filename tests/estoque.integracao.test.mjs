import assert from 'node:assert/strict';
import db from '../database/connection.js';
import {
  calcularDisponibilidade,
  reservarEstoque,
  reservarItensPedido,
  liberarReserva,
  registrarSaida,
  registrarEntrada,
  registrarVenda,
  confirmarEntrega,
  registrarDevolucao,
  enviarParaManutencao,
  finalizarManutencao
} from '../src/modules/estoque/estoque.service.js';
import { inserirPagamentoPedido } from '../src/modules/pedidos/pedidos.model.js';
import {
  marcarEntregue,
  registrarDevolucao as registrarDevolucaoPedido,
  inserirReembolso
} from '../src/modules/entregas/entregas.model.js';

const tag = Date.now();
let produtoId;
let clienteId;
let pedidoId;

async function estadoProduto() {
  const [rows] = await db.query(
    `SELECT estoque, estoque_reservado, estoque_em_uso, estoque_manutencao,
            estoque_danificado
     FROM produtos WHERE id = ?`,
    [produtoId]
  );
  return rows[0];
}

try {
  const [produto] = await db.query(
    `INSERT INTO produtos
      (nome, estoque, estoque_reservado, estoque_em_uso, estoque_manutencao,
       estoque_danificado, estoque_minimo, ativo, tipo_produto)
     VALUES (?, 10, 0, 0, 0, 0, 0, 1, 'PRODUTO')`,
    [`__TESTE_ESTOQUE_${tag}`]
  );
  produtoId = produto.insertId;

  const [cliente] = await db.query(
    'INSERT INTO cliente (nome, email) VALUES (?, ?)',
    [`__TESTE_ESTOQUE_${tag}`, `__teste_${tag}@example.test`]
  );
  clienteId = cliente.insertId;

  const [pedido] = await db.query(
    `INSERT INTO pedidos (cliente_id, status, status_documento, tipo_pedido)
     VALUES (?, 'CONFIRMADO', 'PEDIDO', 'ALUGUEL')`,
    [clienteId]
  );
  pedidoId = pedido.insertId;

  const [pedidoItem] = await db.query(
    `INSERT INTO pedido_itens
      (pedido_id, produto_id, quantidade, valor_unitario, subtotal)
     VALUES (?, ?, 3, 0, 0)`,
    [pedidoId, produtoId]
  );
  const pedidoItemId = pedidoItem.insertId;

  const concorrencia = await Promise.allSettled([
    reservarEstoque({ produtoId, quantidade: 6, pedidoId }),
    reservarEstoque({ produtoId, quantidade: 6, pedidoId })
  ]);
  assert.equal(concorrencia.filter((resultado) => resultado.status === 'fulfilled').length, 1);
  assert.equal(concorrencia.filter((resultado) => resultado.status === 'rejected').length, 1);
  let estado = await estadoProduto();
  assert.equal(estado.estoque_reservado, 6, 'Requisições concorrentes não podem reservar acima do disponível');
  await liberarReserva({ produtoId, quantidade: 6, pedidoId });

  await reservarEstoque({ produtoId, quantidade: 3, pedidoId });
  estado = await estadoProduto();
  assert.equal(estado.estoque, 10);
  assert.equal(estado.estoque_reservado, 3);
  assert.equal(calcularDisponibilidade(estado), 7);

  await liberarReserva({ produtoId, quantidade: 3, pedidoId });
  estado = await estadoProduto();
  assert.equal(estado.estoque_reservado, 0);
  assert.equal(calcularDisponibilidade(estado), 10);

  const connDuplicataInicial = await db.getConnection();
  try {
    await reservarItensPedido({ conn: connDuplicataInicial, itens: [{ produto_id: produtoId, quantidade: 3 }], pedidoId });
  } finally {
    connDuplicataInicial.release();
  }
  const connDuplicata = await db.getConnection();
  try {
    await reservarItensPedido({ conn: connDuplicata, itens: [{ produto_id: produtoId, quantidade: 3 }], pedidoId });
  } finally {
    connDuplicata.release();
  }
  const [reservasUnicas] = await db.query(
    `SELECT COUNT(*) AS total FROM reservas_estoque
     WHERE pedido_id = ? AND produto_id = ? AND status = 'ATIVA'`,
    [pedidoId, produtoId]
  );
  assert.equal(reservasUnicas[0].total, 1);
  await liberarReserva({ produtoId, quantidade: 3, pedidoId });

  await registrarVenda({ produtoId, quantidade: 2, pedidoId });
  estado = await estadoProduto();
  assert.equal(estado.estoque, 8);

  await registrarSaida({ produtoId, quantidade: 3 });
  await registrarEntrada({ produtoId, quantidade: 5 });
  estado = await estadoProduto();
  assert.equal(estado.estoque, 10);

  await enviarParaManutencao({ produtoId, quantidade: 2 });
  estado = await estadoProduto();
  assert.equal(estado.estoque_manutencao, 2);
  assert.equal(calcularDisponibilidade(estado), 8);

  await finalizarManutencao({ produtoId, quantidade: 2 });
  estado = await estadoProduto();
  assert.equal(estado.estoque, 10);
  assert.equal(estado.estoque_manutencao, 0);
  assert.equal(calcularDisponibilidade(estado), 10);

  await reservarEstoque({ produtoId, quantidade: 8, pedidoId });
  estado = await estadoProduto();
  assert.equal(calcularDisponibilidade(estado), 2);

  await confirmarEntrega({ produtoId, quantidade: 3, pedidoId });
  estado = await estadoProduto();
  assert.equal(estado.estoque_reservado, 5);
  assert.equal(estado.estoque_em_uso, 3);
  assert.equal(calcularDisponibilidade(estado), 2);

  await registrarDevolucao({ produtoId, quantidade: 3, pedidoId, tipo: 'BOA' });
  estado = await estadoProduto();
  assert.equal(estado.estoque_em_uso, 0);
  assert.equal(calcularDisponibilidade(estado), 5);

  await liberarReserva({ produtoId, quantidade: 5, pedidoId });
  await reservarEstoque({ produtoId, quantidade: 2, pedidoId });
  await confirmarEntrega({ produtoId, quantidade: 2, pedidoId });
  await registrarDevolucao({ produtoId, quantidade: 2, pedidoId, tipo: 'DANIFICADA' });
  estado = await estadoProduto();
  assert.equal(estado.estoque_em_uso, 0);
  assert.equal(estado.estoque_danificado, 2);
  assert.equal(calcularDisponibilidade(estado), 8);
  await enviarParaManutencao({ produtoId, quantidade: 2 });
  await finalizarManutencao({ produtoId, quantidade: 2 });
  estado = await estadoProduto();
  assert.equal(estado.estoque_danificado, 0);
  assert.equal(estado.estoque_manutencao, 0);
  assert.equal(estado.estoque, 10);
  assert.equal(calcularDisponibilidade(estado), 10);

  await assert.rejects(
    reservarEstoque({ produtoId, quantidade: 11, pedidoId }),
    /Não foi possível reservar/
  );
  estado = await estadoProduto();
  assert.equal(estado.estoque_reservado, 0);
  assert.equal(calcularDisponibilidade(estado), 10);

  const [movimentacoes] = await db.query(
    'SELECT COUNT(*) AS total FROM movimentacao_estoque WHERE produto_id = ?',
    [produtoId]
  );
  const [historico] = await db.query(
    'SELECT COUNT(*) AS total FROM estoque_historico WHERE produto_id = ?',
    [produtoId]
  );
  assert.ok(Number(movimentacoes[0].total) >= 7);
  assert.equal(movimentacoes[0].total, historico[0].total);

  await reservarEstoque({ produtoId, quantidade: 3, pedidoId });
  await marcarEntregue(pedidoId, {
    data_entrega: new Date().toISOString(),
    responsavel_entrega: 'Teste de integração'
  });
  await assert.rejects(
    () => registrarDevolucaoPedido(pedidoId, {
      itens: [{ id: pedidoItemId, produto_id: produtoId, quantidade_devolvida: 4 }],
      idempotency_key: `return-over-${tag}`
    }),
    /excede a quantidade/i
  );
  await registrarDevolucaoPedido(pedidoId, {
    itens: [{ id: pedidoItemId, produto_id: produtoId, quantidade_devolvida: 3 }],
    idempotency_key: `return-full-${tag}`,
    responsavel: 'Teste de integração'
  });
  estado = await estadoProduto();
  assert.equal(estado.estoque_em_uso, 0);
  await assert.rejects(
    () => registrarDevolucaoPedido(pedidoId, {
      itens: [{ id: pedidoItemId, produto_id: produtoId, quantidade_devolvida: 1 }],
      idempotency_key: `return-after-full-${tag}`
    }),
    /situação que permita devolução/i
  );

  await db.query('UPDATE pedidos SET valor_total = 10 WHERE id = ?', [pedidoId]);
  await inserirPagamentoPedido(pedidoId, { valor: 10, forma_pagamento: 'PIX' });
  await assert.rejects(
    () => inserirPagamentoPedido(pedidoId, { valor: 0.01, forma_pagamento: 'PIX' }),
    /exceder o saldo pendente/i
  );
  await assert.rejects(
    () => inserirReembolso(pedidoId, { valor: 10.01, forma_pagamento: 'PIX' }),
    /exceder o valor efetivamente pago/i
  );
  console.log('Teste de integração MySQL do estoque ok');
} finally {
  if (produtoId) {
    await db.query('DELETE FROM ocorrencias WHERE pedido_id = ?', [pedidoId]);
    await db.query('DELETE FROM pagamentos WHERE pedido_id = ?', [pedidoId]);
    await db.query('DELETE FROM devolucao_itens WHERE devolucao_id IN (SELECT id FROM devolucoes WHERE pedido_id = ?)', [pedidoId]);
    await db.query('DELETE FROM devolucoes WHERE pedido_id = ?', [pedidoId]);
    await db.query('DELETE FROM estoque_historico WHERE produto_id = ?', [produtoId]);
    await db.query('DELETE FROM movimentacao_estoque WHERE produto_id = ?', [produtoId]);
    await db.query('DELETE FROM reservas_estoque WHERE produto_id = ?', [produtoId]);
    await db.query('DELETE FROM pedido_itens WHERE pedido_id = ?', [pedidoId]);
    await db.query('DELETE FROM pedidos WHERE id = ?', [pedidoId]);
    await db.query('DELETE FROM produtos WHERE id = ?', [produtoId]);
    await db.query('DELETE FROM cliente WHERE id = ?', [clienteId]);
  }
  await db.end();
}