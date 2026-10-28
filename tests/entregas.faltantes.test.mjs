import assert from 'node:assert/strict';
import db from '../database/connection.js';
import {
  calcularDisponibilidade,
  reservarEstoque
} from '../src/modules/estoque/estoque.service.js';
import {
  finalizarConferencia,
  inserirPagamento,
  marcarConferencia,
  registrarDevolucao as registrarDevolucaoModel
} from '../src/modules/entregas/entregas.model.js';

const tag = Date.now();
const fixtures = [];
let requestSequence = 0;
const registrarDevolucao = (pedidoId, dados, chave = `stk001-${tag}-${++requestSequence}`) =>
  registrarDevolucaoModel(pedidoId, { ...dados, idempotency_key: chave });

async function criarPedido({
  quantidade = 1,
  estoque = quantidade,
  emUso = quantidade,
  combo = false,
  misto = false,
  valorTotal = 10
} = {}) {
  const [produtoResult] = await db.query(
    `INSERT INTO produtos
      (nome, estoque, estoque_reservado, estoque_em_uso, estoque_manutencao,
       estoque_danificado, estoque_minimo, ativo, tipo_produto)
     VALUES (?, ?, 0, ?, 0, 0, 0, 1, 'PRODUTO')`,
    [`__TESTE_DEVOLUCAO_${tag}_${fixtures.length}`, estoque, emUso]
  );
  const produtoId = produtoResult.insertId;
  const [clienteResult] = await db.query(
    'INSERT INTO cliente (nome, email) VALUES (?, ?)',
    [`__TESTE_DEVOLUCAO_${tag}_${fixtures.length}`, `__devolucao_${tag}_${fixtures.length}@example.test`]
  );
  const [pedidoResult] = await db.query(
    `INSERT INTO pedidos (cliente_id, status, status_documento, tipo_pedido, valor_total)
     VALUES (?, 'ENTREGUE', 'PEDIDO', 'ALUGUEL', ?)`,
    [clienteResult.insertId, valorTotal]
  );
  const pedidoId = pedidoResult.insertId;
  let comboId = null;
  let itemId;

  if (combo) {
    const [comboResult] = await db.query('INSERT INTO combos (nome) VALUES (?)', [`__TESTE_COMBO_${tag}_${fixtures.length}`]);
    comboId = comboResult.insertId;
    await db.query(
      'INSERT INTO combo_itens (combo_id, produto_id, quantidade) VALUES (?, ?, 2)',
      [comboId, produtoId]
    );
    const [itemResult] = await db.query(
      `INSERT INTO pedido_itens
        (pedido_id, produto_id, combo_id, tipo_item, quantidade, quantidade_entregue, valor_unitario, subtotal)
       VALUES (?, NULL, ?, 'ALUGUEL', ?, ?, 0, 0)`,
      [pedidoId, comboId, quantidade, quantidade]
    );
    itemId = itemResult.insertId;
    await db.query(
      `INSERT INTO pedido_item_componentes
        (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
       VALUES (?, ?, ?, 2, ?)`,
      [itemId, pedidoId, produtoId, quantidade * 2]
    );
  } else {
    const [itemResult] = await db.query(
      `INSERT INTO pedido_itens
        (pedido_id, produto_id, tipo_item, quantidade, quantidade_entregue, valor_unitario, subtotal)
       VALUES (?, ?, 'ALUGUEL', ?, ?, 0, 0)`,
      [pedidoId, produtoId, quantidade, quantidade]
    );
    itemId = itemResult.insertId;
  }

  let saleItemId = null;
  if (misto) {
    const [saleResult] = await db.query(
      `INSERT INTO pedido_itens
        (pedido_id, produto_id, tipo_item, quantidade, quantidade_entregue, valor_unitario, subtotal)
       VALUES (?, ?, 'VENDA', 1, 1, 0, 0)`,
      [pedidoId, produtoId]
    );
    saleItemId = saleResult.insertId;
  }

  const fixture = { pedidoId, itemId, produtoId, clienteId: clienteResult.insertId, comboId, saleItemId };
  fixtures.push(fixture);
  return fixture;
}

async function estadoProduto(produtoId) {
  const [[produto]] = await db.query(
    `SELECT estoque, estoque_reservado, estoque_em_uso, estoque_manutencao, estoque_danificado
     FROM produtos WHERE id = ?`,
    [produtoId]
  );
  return { ...produto, disponivel: calcularDisponibilidade(produto) };
}

async function quantidadeDevolvida(itemId) {
  const [[item]] = await db.query(
    'SELECT quantidade_devolvida FROM pedido_itens WHERE id = ?',
    [itemId]
  );
  return Number(item.quantidade_devolvida);
}

async function statusPedido(pedidoId) {
  const [[pedido]] = await db.query(
    'SELECT status, conferencia_finalizada FROM pedidos WHERE id = ?',
    [pedidoId]
  );
  return pedido;
}

async function contarMovimentos(produtoId, tipo) {
  const [[rows]] = await db.query(
    'SELECT COUNT(*) AS total FROM movimentacao_estoque WHERE produto_id = ? AND tipo = ?',
    [produtoId, tipo]
  );
  return Number(rows.total);
}

try {
  const retornoCompleto = await criarPedido({ quantidade: 2, estoque: 2, emUso: 2 });
  await registrarDevolucao(retornoCompleto.pedidoId, {
    itens: [{ id: retornoCompleto.itemId, quantidade_boa: 2 }]
  });
  assert.equal((await estadoProduto(retornoCompleto.produtoId)).estoque_em_uso, 0);
  assert.equal(await quantidadeDevolvida(retornoCompleto.itemId), 2);

  const pendencia = await criarPedido({ quantidade: 2, estoque: 2, emUso: 2, valorTotal: 20 });
  await registrarDevolucao(pendencia.pedidoId, {
    itens: [{ id: pendencia.itemId, quantidade_boa: 1, quantidade_faltando: 1 }]
  });
  let estado = await estadoProduto(pendencia.produtoId);
  assert.equal(estado.estoque, 2);
  assert.equal(estado.estoque_em_uso, 1);
  assert.equal(estado.disponivel, 1, 'O item faltante deve continuar em uso e indisponível');
  assert.equal(await quantidadeDevolvida(pendencia.itemId), 1, 'Somente o item fisicamente recebido conta como devolvido');
  assert.equal((await statusPedido(pendencia.pedidoId)).status, 'PENDENTE');
  const [[registroFaltante]] = await db.query(
    `SELECT quantidade_recebida, quantidade_faltando, quantidade_danificada
     FROM devolucao_itens WHERE devolucao_id = (
       SELECT MAX(id) FROM devolucoes WHERE pedido_id = ?
     )`,
    [pendencia.pedidoId]
  );
  assert.deepEqual(
    [Number(registroFaltante.quantidade_recebida), Number(registroFaltante.quantidade_faltando)],
    [1, 1]
  );
  await assert.rejects(
    reservarEstoque({ produtoId: pendencia.produtoId, quantidade: 2 }),
    /Não foi possível reservar/
  );

  await marcarConferencia(pendencia.pedidoId);
  await finalizarConferencia(pendencia.pedidoId);
  assert.equal((await statusPedido(pendencia.pedidoId)).status, 'PENDENTE', 'Conferência não pode finalizar com itens faltantes');
  await inserirPagamento(pendencia.pedidoId, { valor: 20, forma_pagamento: 'PIX' });
  assert.equal((await statusPedido(pendencia.pedidoId)).status, 'PENDENTE', 'Pagamento não pode limpar pendência operacional');

  await registrarDevolucao(pendencia.pedidoId, {
    itens: [{ id: pendencia.itemId, quantidade_boa: 1 }]
  });
  estado = await estadoProduto(pendencia.produtoId);
  assert.equal(estado.estoque_em_uso, 0);
  assert.equal(estado.disponivel, 2);
  assert.equal(await quantidadeDevolvida(pendencia.itemId), 2);
  assert.equal(await contarMovimentos(pendencia.produtoId, 'RETORNO'), 2);
  const [[registrosDevolucao]] = await db.query(
    `SELECT SUM(quantidade_recebida) AS recebida, SUM(quantidade_faltando) AS faltando
     FROM devolucao_itens WHERE devolucao_id IN
       (SELECT id FROM devolucoes WHERE pedido_id = ?)`,
    [pendencia.pedidoId]
  );
  assert.equal(Number(registrosDevolucao.recebida), 2);
  assert.equal(Number(registrosDevolucao.faltando), 1, 'O histórico da falta deve ser preservado após a regularização');
  await marcarConferencia(pendencia.pedidoId);
  await finalizarConferencia(pendencia.pedidoId);
  assert.equal((await statusPedido(pendencia.pedidoId)).status, 'FINALIZADO');

  const apenasFaltante = await criarPedido({ quantidade: 1, estoque: 1, emUso: 1 });
  await registrarDevolucao(apenasFaltante.pedidoId, {
    itens: [{ id: apenasFaltante.itemId, quantidade_faltando: 1 }]
  });
  estado = await estadoProduto(apenasFaltante.produtoId);
  assert.equal(estado.estoque_em_uso, 1);
  assert.equal(estado.disponivel, 0);
  assert.equal(await quantidadeDevolvida(apenasFaltante.itemId), 0);
  assert.equal(await contarMovimentos(apenasFaltante.produtoId, 'PERDA'), 0);
  assert.equal(await contarMovimentos(apenasFaltante.produtoId, 'RETORNO'), 0);

  const danificado = await criarPedido({ quantidade: 1, estoque: 1, emUso: 1 });
  await registrarDevolucao(danificado.pedidoId, {
    itens: [{ id: danificado.itemId, quantidade_danificada: 1 }]
  });
  estado = await estadoProduto(danificado.produtoId);
  assert.equal(estado.estoque_em_uso, 0);
  assert.equal(estado.estoque_danificado, 1);
  assert.equal(estado.disponivel, 0);
  assert.equal(await contarMovimentos(danificado.produtoId, 'DANIFICADO'), 1);
  await assert.rejects(
    reservarEstoque({ produtoId: danificado.produtoId, quantidade: 1 }),
    /Não foi possível reservar/
  );

  const duplicado = await criarPedido({ quantidade: 1, estoque: 1, emUso: 1 });
  await registrarDevolucao(duplicado.pedidoId, {
    itens: [{ id: duplicado.itemId, quantidade_boa: 1 }]
  }, 'same-full-return');
  const repeticao = await registrarDevolucao(duplicado.pedidoId, {
    itens: [{ id: duplicado.itemId, quantidade_boa: 1 }]
  }, 'same-full-return');
  assert.equal(repeticao.duplicate, true);
  await assert.rejects(
    registrarDevolucao(duplicado.pedidoId, {
      itens: [{ id: duplicado.itemId, quantidade_boa: 1 }]
    }),
    /situação que permita devolução/
  );
  assert.equal(await contarMovimentos(duplicado.produtoId, 'RETORNO'), 1);

  const rollback = await criarPedido({ quantidade: 1, estoque: 1, emUso: 1, misto: true });
  await assert.rejects(
    registrarDevolucao(rollback.pedidoId, {
      itens: [
        { id: rollback.itemId, quantidade_boa: 1 },
        { id: rollback.saleItemId, quantidade_boa: 1 }
      ]
    }),
    /Itens de venda/
  );
  assert.equal((await estadoProduto(rollback.produtoId)).estoque_em_uso, 1);
  assert.equal(await quantidadeDevolvida(rollback.itemId), 0);
  assert.equal(await contarMovimentos(rollback.produtoId, 'RETORNO'), 0);
  const [[devolucoesRollback]] = await db.query(
    'SELECT COUNT(*) AS total FROM devolucoes WHERE pedido_id = ?',
    [rollback.pedidoId]
  );
  assert.equal(Number(devolucoesRollback.total), 0);

  const somenteVenda = await criarPedido({ quantidade: 1, estoque: 1, emUso: 0, misto: true });
  await assert.rejects(
    registrarDevolucao(somenteVenda.pedidoId, {
      itens: [{ id: somenteVenda.saleItemId, quantidade_boa: 1 }]
    }),
    /Itens de venda/
  );
  assert.equal((await estadoProduto(somenteVenda.produtoId)).estoque_em_uso, 0);

  const concorrente = await criarPedido({ quantidade: 3, estoque: 3, emUso: 3 });
  const resultadosConcorrentes = await Promise.allSettled([
    registrarDevolucao(concorrente.pedidoId, {
      itens: [{ id: concorrente.itemId, quantidade_boa: 2 }]
    }),
    registrarDevolucao(concorrente.pedidoId, {
      itens: [{ id: concorrente.itemId, quantidade_boa: 2 }]
    })
  ]);
  assert.equal(resultadosConcorrentes.filter((resultado) => resultado.status === 'fulfilled').length, 1);
  assert.equal(resultadosConcorrentes.filter((resultado) => resultado.status === 'rejected').length, 1);
  assert.equal((await estadoProduto(concorrente.produtoId)).estoque_em_uso, 1);
  assert.equal(await quantidadeDevolvida(concorrente.itemId), 2);
  assert.equal(await contarMovimentos(concorrente.produtoId, 'RETORNO'), 1);

  const combo = await criarPedido({ quantidade: 2, estoque: 4, emUso: 4, combo: true });
  await registrarDevolucao(combo.pedidoId, {
    itens: [{ id: combo.itemId, quantidade_boa: 1, quantidade_faltando: 1 }]
  });
  assert.equal((await estadoProduto(combo.produtoId)).estoque_em_uso, 2, 'O retorno de um combo deve aplicar o fator do componente');
  assert.equal(await quantidadeDevolvida(combo.itemId), 1);
  await registrarDevolucao(combo.pedidoId, {
    itens: [{ id: combo.itemId, quantidade_boa: 1 }]
  });
  assert.equal((await estadoProduto(combo.produtoId)).estoque_em_uso, 0);
  assert.equal(await quantidadeDevolvida(combo.itemId), 2);
  const [[historicoCombo]] = await db.query(
    `SELECT SUM(quantidade_recebida) AS recebida, SUM(quantidade_faltando) AS faltando
     FROM devolucao_itens WHERE devolucao_id IN
       (SELECT id FROM devolucoes WHERE pedido_id = ?)`,
    [combo.pedidoId]
  );
  assert.equal(Number(historicoCombo.recebida), 4);
  assert.equal(Number(historicoCombo.faltando), 2);

  const ocorrenciaAberta = await criarPedido({ quantidade: 1, estoque: 1, emUso: 1 });
  await registrarDevolucao(ocorrenciaAberta.pedidoId, {
    itens: [{ id: ocorrenciaAberta.itemId, quantidade_boa: 1 }]
  });
  await inserirPagamento(ocorrenciaAberta.pedidoId, { valor: 10, forma_pagamento: 'PIX' });
  await db.query(
    `INSERT INTO ocorrencias (pedido_id, tipo, descricao, valor, status)
     VALUES (?, 'Operacional', 'Pendência de teste', 0, 'ABERTO')`,
    [ocorrenciaAberta.pedidoId]
  );
  await marcarConferencia(ocorrenciaAberta.pedidoId);
  await finalizarConferencia(ocorrenciaAberta.pedidoId);
  assert.equal((await statusPedido(ocorrenciaAberta.pedidoId)).status, 'PENDENTE');
  await db.query(
    `UPDATE ocorrencias SET status = 'RESOLVIDO'
     WHERE pedido_id = ? AND tipo = 'Operacional'`,
    [ocorrenciaAberta.pedidoId]
  );
  await marcarConferencia(ocorrenciaAberta.pedidoId);
  await finalizarConferencia(ocorrenciaAberta.pedidoId);
  assert.equal((await statusPedido(ocorrenciaAberta.pedidoId)).status, 'FINALIZADO');

  console.log('Testes de devolução pendente, regularização, danos, combos, rollback e concorrência ok');
} finally {
  for (const fixture of fixtures.reverse()) {
    await db.query('DELETE FROM ocorrencias WHERE pedido_id = ?', [fixture.pedidoId]);
    await db.query('DELETE FROM pagamentos WHERE pedido_id = ?', [fixture.pedidoId]);
    await db.query(
      `DELETE FROM devolucao_itens WHERE devolucao_id IN
        (SELECT id FROM devolucoes WHERE pedido_id = ?)`,
      [fixture.pedidoId]
    );
    await db.query('DELETE FROM devolucoes WHERE pedido_id = ?', [fixture.pedidoId]);
    await db.query('DELETE FROM pedido_item_componentes WHERE pedido_id = ?', [fixture.pedidoId]);
    await db.query('DELETE FROM pedido_itens WHERE pedido_id = ?', [fixture.pedidoId]);
    await db.query('DELETE FROM pedidos WHERE id = ?', [fixture.pedidoId]);
    if (fixture.comboId) await db.query('DELETE FROM combo_itens WHERE combo_id = ?', [fixture.comboId]);
    if (fixture.comboId) await db.query('DELETE FROM combos WHERE id = ?', [fixture.comboId]);
    await db.query('DELETE FROM estoque_historico WHERE produto_id = ?', [fixture.produtoId]);
    await db.query('DELETE FROM movimentacao_estoque WHERE produto_id = ?', [fixture.produtoId]);
    await db.query('DELETE FROM reservas_estoque WHERE produto_id = ?', [fixture.produtoId]);
    await db.query('DELETE FROM produtos WHERE id = ?', [fixture.produtoId]);
    await db.query('DELETE FROM cliente WHERE id = ?', [fixture.clienteId]);
  }
  await db.end();
}
