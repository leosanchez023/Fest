import db from '../../../database/connection.js';

export const TIPOS_MOVIMENTACAO = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  RESERVA: 'RESERVA',
  LIBERACAO_RESERVA: 'LIBERACAO_RESERVA',
  ENTREGA: 'ENTREGA',
  RETORNO: 'RETORNO',
  DANIFICADO: 'DANIFICADO',
  MANUTENCAO: 'MANUTENCAO',
  FINALIZACAO_MANUTENCAO: 'FINALIZACAO_MANUTENCAO',
  DESCARTE: 'DESCARTE',
  PERDA: 'PERDA',
  AJUSTE: 'AJUSTE',
  VENDA: 'VENDA'
};

export function calcularDisponibilidade(produto) {
  const estoque = Number(produto?.estoque ?? 0);
  const reservado = Number(produto?.estoque_reservado ?? 0);
  const emUso = Number(produto?.estoque_em_uso ?? 0);
  const manutencao = Number(produto?.estoque_manutencao ?? 0);
  const danificado = Number(produto?.estoque_danificado ?? 0);

  return estoque - reservado - emUso - manutencao - danificado;
}

export function validarEstoque(produto) {
  const campos = [
    Number(produto?.estoque ?? 0),
    Number(produto?.estoque_reservado ?? 0),
    Number(produto?.estoque_em_uso ?? 0),
    Number(produto?.estoque_manutencao ?? 0),
    Number(produto?.estoque_danificado ?? 0)
  ];

  return campos.every((valor) => Number.isFinite(valor) && valor >= 0);
}

export function validarDisponibilidade(produto) {
  return validarEstoque(produto) && calcularDisponibilidade(produto) >= 0;
}

export function statusEstoque(produto) {
  const disponivel = calcularDisponibilidade(produto);
  const minimo = Number(produto?.estoque_minimo ?? 0);

  if (Number(produto?.ativo ?? 1) === 0) return 'INATIVO';
  if (disponivel <= 0) return 'CRITICO';
  if (minimo > 0 && disponivel <= minimo) return 'BAIXO';
  return 'NORMAL';
}

async function buscarProduto(conn, produtoId) {
  const [rows] = await conn.query('SELECT * FROM produtos WHERE id = ?', [produtoId]);
  return rows[0] || null;
}

async function registrarMovimentacao(conn, dados) {
  const {
    produto_id,
    pedido_id = null,
    usuario_id = null,
    tipo,
    quantidade,
    observacao = null
  } = dados;

  await conn.query(
    `INSERT INTO movimentacao_estoque
      (produto_id, pedido_id, usuario_id, tipo, quantidade, observacao, data_movimentacao)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [produto_id, pedido_id, usuario_id, tipo, quantidade, observacao]
  );

  await conn.query(
    `INSERT INTO estoque_historico
      (produto_id, pedido_id, usuario_id, tipo, quantidade, observacao, data_movimentacao)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [produto_id, pedido_id, usuario_id, tipo, quantidade, observacao]
  );
}

export async function registrarEntrada({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) {
    throw new Error('Quantidade de entrada inválida.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    await conn.query(
      `UPDATE produtos SET estoque = estoque + ?, updatedAt = NOW() WHERE id = ?`,
      [qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.ENTRADA,
      quantidade: qtd,
      observacao: observacao || 'Entrada de estoque'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarSaida({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) {
    throw new Error('Quantidade de saída inválida.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    if (produtosDisponiveis(produto) < qtd) {
      throw new Error('Estoque insuficiente para a saída.');
    }

    await conn.query(
      `UPDATE produtos SET estoque = GREATEST(estoque - ?, 0), updatedAt = NOW() WHERE id = ?`,
      [qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.SAIDA,
      quantidade: -qtd,
      observacao: observacao || 'Saída de estoque'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export function produtosDisponiveis(produto) {
  return calcularDisponibilidade(produto);
}

export async function calcularDisponibilidadeCombo(comboId) {
  const [itens] = await db.query(
    `SELECT ci.*, p.nome AS produto_nome, p.estoque, p.estoque_reservado, p.estoque_em_uso, p.estoque_manutencao, p.estoque_danificado
     FROM combo_itens ci
     LEFT JOIN produtos p ON p.id = ci.produto_id
     WHERE ci.combo_id = ?`,
    [comboId]
  );

  if (!itens.length) {
    return { disponivel: 0, limitante: null };
  }

  const opcoes = itens
    .filter((item) => item && item.produto_id)
    .map((item) => {
      const product = {
        estoque: Number(item.estoque || 0),
        estoque_reservado: Number(item.estoque_reservado || 0),
        estoque_em_uso: Number(item.estoque_em_uso || 0),
        estoque_manutencao: Number(item.estoque_manutencao || 0),
        estoque_danificado: Number(item.estoque_danificado || 0)
      };

      const disponivel = calcularDisponibilidade(product);
      const qtdPorCombo = Number(item.quantidade || 1);

      return {
        produto_id: item.produto_id,
        nome: item.produto_nome,
        quantidade_por_combo: qtdPorCombo,
        disponivel_no_produto: disponivel,
        disponivel_em_combos: qtdPorCombo > 0 ? Math.floor(disponivel / qtdPorCombo) : 0
      };
    });

  const limitante = opcoes.reduce((menor, atual) => {
    if (!menor || atual.disponivel_em_combos < menor.disponivel_em_combos) return atual;
    return menor;
  }, null);

  return {
    disponivel: limitante ? limitante.disponivel_em_combos : 0,
    limitante: limitante ? {
      produto_id: limitante.produto_id,
      nome: limitante.nome,
      quantidade_por_combo: limitante.quantidade_por_combo,
      disponivel_no_produto: limitante.disponivel_no_produto,
      disponivel_em_combos: limitante.disponivel_em_combos
    } : null
  };
}

export async function reservarEstoque({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) {
    throw new Error('Quantidade para reserva inválida.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!validarEstoque(produto)) throw new Error('Produto com dados de estoque inválidos.');

    const disponivel = produtosDisponiveis(produto);
    if (disponivel < qtd) {
      throw new Error(`Não foi possível reservar o produto.\nNecessário: ${qtd}\nDisponível: ${disponivel}\nFaltam: ${qtd - disponivel}`);
    }

    await conn.query(
      `UPDATE produtos SET estoque_reservado = estoque_reservado + ?, updatedAt = NOW() WHERE id = ?`,
      [qtd, produtoId]
    );

    await conn.query(
      `INSERT INTO reservas_estoque (pedido_id, produto_id, quantidade, status, data_reserva, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ATIVA', NOW(), NOW(), NOW())`,
      [pedidoId, produtoId, qtd]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      pedido_id: pedidoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.RESERVA,
      quantidade: qtd,
      observacao: observacao || 'Reserva de estoque'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function reservarItensPedido({ conn, itens = [], pedidoId = null, usuarioId = null }) {
  if (!Array.isArray(itens) || !itens.length) {
    return [];
  }

  const reservas = [];

  for (const item of itens) {
    const produtoId = Number(item.produto_id || item.id || 0);
    const quantidade = Number(item.quantidade || 0);

    if (!produtoId || quantidade <= 0) {
      continue;
    }

    const [rows] = await conn.query('SELECT * FROM produtos WHERE id = ? FOR UPDATE', [produtoId]);
    const produto = rows[0];

    if (!produto) {
      throw new Error(`Produto ${produtoId} não encontrado.`);
    }

    if (!validarEstoque(produto)) {
      throw new Error(`Produto ${produto.nome || produtoId} possui estoque inválido.`);
    }

    const disponivel = produtosDisponiveis(produto);
    if (disponivel < quantidade) {
      throw new Error(`Não foi possível reservar o pedido.\nProduto: ${produto.nome}\nNecessário: ${quantidade}\nDisponível: ${disponivel}\nFaltam: ${quantidade - disponivel}`);
    }

    await conn.query(
      `UPDATE produtos SET estoque_reservado = estoque_reservado + ? WHERE id = ?`,
      [quantidade, produtoId]
    );

    const [reservaResult] = await conn.query(
      `INSERT INTO reservas_estoque (pedido_id, produto_id, quantidade, status, data_reserva, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ATIVA', NOW(), NOW(), NOW())`,
      [pedidoId, produtoId, quantidade]
    );

    reservas.push({
      id: reservaResult.insertId,
      produto_id: produtoId,
      quantidade,
      pedido_id: pedidoId
    });

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      pedido_id: pedidoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.RESERVA,
      quantidade,
      observacao: 'Reserva automática do pedido'
    });
  }

  return reservas;
}

export async function liberarReserva({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) throw new Error('Quantidade para liberação inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    await conn.query(
      `UPDATE produtos SET estoque_reservado = GREATEST(estoque_reservado - ?, 0), updatedAt = NOW() WHERE id = ?`,
      [qtd, produtoId]
    );

    await conn.query(
      `UPDATE reservas_estoque
       SET status = 'LIBERADA', data_liberacao = NOW(), updatedAt = NOW()
       WHERE produto_id = ? AND pedido_id = ? AND status = 'ATIVA' ORDER BY id DESC LIMIT 1`,
      [produtoId, pedidoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      pedido_id: pedidoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.LIBERACAO_RESERVA,
      quantidade: -qtd,
      observacao: observacao || 'Liberação de reserva'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function cancelarPedido({ pedidoId, usuarioId = null, observacao = '' }) {
  if (!pedidoId) {
    throw new Error('Pedido inválido para cancelamento.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [itens] = await conn.query(
      `SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ? FOR UPDATE`,
      [pedidoId]
    );

    for (const item of itens) {
      const produtoId = Number(item.produto_id || 0);
      const quantidade = Number(item.quantidade || 0);
      if (!produtoId || quantidade <= 0) continue;

      await conn.query(
        `UPDATE produtos SET estoque_reservado = GREATEST(estoque_reservado - ?, 0), updatedAt = NOW() WHERE id = ?`,
        [quantidade, produtoId]
      );

      await conn.query(
        `UPDATE reservas_estoque
         SET status = 'CANCELADA', data_liberacao = NOW(), updatedAt = NOW()
         WHERE produto_id = ? AND pedido_id = ? AND status = 'ATIVA'`,
        [produtoId, pedidoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        pedido_id: pedidoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.LIBERACAO_RESERVA,
        quantidade: -quantidade,
        observacao: observacao || `Cancelamento do pedido ${pedidoId}`
      });
    }

    await conn.query(
      `UPDATE pedidos SET status = 'CANCELADO', status_documento = 'PEDIDO' WHERE id = ?`,
      [pedidoId]
    );

    await conn.commit();
    return { sucesso: true, pedidoId, itens: itens.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function alterarQuantidadeItemPedido({ pedidoId, produtoId, novaQuantidade, usuarioId = null, observacao = '' }) {
  const qtdNova = Number(novaQuantidade || 0);
  if (!pedidoId || !produtoId || qtdNova <= 0) {
    throw new Error('Quantidade inválida para alteração do item do pedido.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT quantidade FROM pedido_itens WHERE pedido_id = ? AND produto_id = ? FOR UPDATE`,
      [pedidoId, produtoId]
    );

    if (!rows.length) {
      throw new Error('Item do pedido não encontrado.');
    }

    const quantidadeAtual = Number(rows[0].quantidade || 0);
    const diferenca = qtdNova - quantidadeAtual;

    if (diferenca > 0) {
      const [produtoRows] = await conn.query('SELECT * FROM produtos WHERE id = ? FOR UPDATE', [produtoId]);
      const produto = produtoRows[0];
      if (!produto) throw new Error('Produto não encontrado.');

      const disponivel = Number(produto.estoque || 0)
        - Number(produto.estoque_reservado || 0)
        - Number(produto.estoque_em_uso || 0)
        - Number(produto.estoque_manutencao || 0)
        - Number(produto.estoque_danificado || 0);

      if (disponivel < diferenca) {
        throw new Error(`Estoque insuficiente para aumentar a quantidade em ${diferenca}. Disponível: ${disponivel}.`);
      }

      await conn.query(
        `UPDATE produtos SET estoque_reservado = estoque_reservado + ? WHERE id = ?`,
        [diferenca, produtoId]
      );

      await conn.query(
        `INSERT INTO reservas_estoque (pedido_id, produto_id, quantidade, status, data_reserva, createdAt, updatedAt)
         VALUES (?, ?, ?, 'ATIVA', NOW(), NOW(), NOW())`,
        [pedidoId, produtoId, diferenca]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        pedido_id: pedidoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.RESERVA,
        quantidade: diferenca,
        observacao: observacao || 'Ajuste de quantidade do pedido'
      });
    }

    if (diferenca < 0) {
      const quantidadeLiberada = Math.abs(diferenca);
      await conn.query(
        `UPDATE produtos SET estoque_reservado = GREATEST(estoque_reservado - ?, 0) WHERE id = ?`,
        [quantidadeLiberada, produtoId]
      );

      await conn.query(
        `UPDATE reservas_estoque
         SET status = 'LIBERADA', data_liberacao = NOW(), updatedAt = NOW()
         WHERE produto_id = ? AND pedido_id = ? AND status = 'ATIVA' ORDER BY id DESC LIMIT 1`,
        [produtoId, pedidoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        pedido_id: pedidoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.LIBERACAO_RESERVA,
        quantidade: -quantidadeLiberada,
        observacao: observacao || 'Ajuste de quantidade do pedido'
      });
    }

    await conn.query(
      `UPDATE pedido_itens SET quantidade = ? WHERE pedido_id = ? AND produto_id = ?`,
      [qtdNova, pedidoId, produtoId]
    );

    await conn.commit();
    return { sucesso: true, produtoId, quantidade: qtdNova };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function confirmarEntrega({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) throw new Error('Quantidade para entrega inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    if (Number(produto.estoque_reservado || 0) < qtd) {
      throw new Error('Quantidade reservada insuficiente para confirmar entrega.');
    }

    await conn.query(
      `UPDATE produtos
       SET estoque_reservado = GREATEST(estoque_reservado - ?, 0),
           estoque_em_uso = estoque_em_uso + ?,
           updatedAt = NOW()
       WHERE id = ?`,
      [qtd, qtd, produtoId]
    );

    await conn.query(
      `UPDATE reservas_estoque
       SET status = 'CONVERTIDA_USO', updatedAt = NOW()
       WHERE produto_id = ? AND pedido_id = ? AND status = 'ATIVA' ORDER BY id DESC LIMIT 1`,
      [produtoId, pedidoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      pedido_id: pedidoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.ENTREGA,
      quantidade: qtd,
      observacao: observacao || 'Entrega confirmada'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function confirmarEntregasPedido({ pedidoId, itens = [], usuarioId = null }) {
  if (!pedidoId || !Array.isArray(itens) || !itens.length) return [];

  const resultados = [];
  for (const item of itens) {
    const produtoId = Number(item.produto_id || item.id || 0);
    const quantidade = Number(item.quantidade || item.quantidade_entregue || 0);
    if (!produtoId || quantidade <= 0) continue;

    const res = await confirmarEntrega({
      produtoId,
      quantidade,
      pedidoId,
      usuarioId,
      observacao: 'Entrega de pedido confirmada'
    });

    resultados.push({ produto_id: produtoId, ...res });
  }

  return resultados;
}

export async function registrarDevolucao({ produtoId, quantidade, tipo = 'BOA', pedidoId = null, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) throw new Error('Quantidade de devolução inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    if (Number(produto.estoque_em_uso || 0) < qtd) {
      throw new Error('Quantidade em uso insuficiente para devolução.');
    }

    if (tipo === 'DANIFICADA') {
      await conn.query(
        `UPDATE produtos
         SET estoque_em_uso = GREATEST(estoque_em_uso - ?, 0),
             estoque_danificado = estoque_danificado + ?,
             updatedAt = NOW()
         WHERE id = ?`,
        [qtd, qtd, produtoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        pedido_id: pedidoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.DANIFICADO,
        quantidade: qtd,
        observacao: observacao || 'Produto devolvido danificado'
      });
    } else if (tipo === 'PENDENTE') {
      await conn.query(
        `UPDATE produtos SET estoque_em_uso = GREATEST(estoque_em_uso - ?, 0), updatedAt = NOW() WHERE id = ?`,
        [qtd, produtoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        pedido_id: pedidoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.PERDA,
        quantidade: qtd,
        observacao: observacao || 'Item pendente de devolução'
      });
    } else {
      await conn.query(
        `UPDATE produtos SET estoque_em_uso = GREATEST(estoque_em_uso - ?, 0), updatedAt = NOW() WHERE id = ?`,
        [qtd, produtoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        pedido_id: pedidoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.RETORNO,
        quantidade: qtd,
        observacao: observacao || 'Produto devolvido em boas condições'
      });
    }

    await conn.commit();
    return { sucesso: true, quantidade: qtd, tipo };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarDevolucaoDetalhada({
  pedidoId,
  produtoId,
  quantidadeEntregue = 0,
  quantidadeBoa = 0,
  quantidadeDanificada = 0,
  quantidadePendente = 0,
  usuarioId = null,
  observacao = ''
}) {
  const entregue = Number(quantidadeEntregue || 0);
  const boas = Number(quantidadeBoa || 0);
  const danificadas = Number(quantidadeDanificada || 0);
  const pendentes = Number(quantidadePendente || 0);

  if (!pedidoId || !produtoId) {
    throw new Error('Pedido e produto são obrigatórios para a devolução.');
  }

  const total = boas + danificadas + pendentes;
  if (total <= 0 || total > entregue) {
    throw new Error('A devolução não pode exceder a quantidade entregue.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [pedidoItemRows] = await conn.query(
      `SELECT quantidade, quantidade_devolvida, quantidade_entregue FROM pedido_itens WHERE pedido_id = ? AND produto_id = ? FOR UPDATE LIMIT 1`,
      [pedidoId, produtoId]
    );

    if (!pedidoItemRows.length) {
      throw new Error('Item do pedido não encontrado para devolução.');
    }

    const pedidoItem = pedidoItemRows[0];
    const entregueReal = Number(pedidoItem.quantidade_entregue || pedidoItem.quantidade || 0);
    const devolvidoAtual = Number(pedidoItem.quantidade_devolvida || 0);
    const restante = Math.max(0, entregueReal - devolvidoAtual);

    if (total > restante) {
      throw new Error(`Quantidade devolvida excede o restante do item. Restante: ${restante}.`);
    }

    if (boas > 0) {
      await registrarDevolucao({
        produtoId,
        quantidade: boas,
        tipo: 'BOA',
        pedidoId,
        usuarioId,
        observacao: observacao || 'Devolução em boas condições'
      });
    }

    if (danificadas > 0) {
      await registrarDevolucao({
        produtoId,
        quantidade: danificadas,
        tipo: 'DANIFICADA',
        pedidoId,
        usuarioId,
        observacao: observacao || 'Devolução com dano'
      });
    }

    if (pendentes > 0) {
      await registrarDevolucao({
        produtoId,
        quantidade: pendentes,
        tipo: 'PENDENTE',
        pedidoId,
        usuarioId,
        observacao: observacao || 'Item pendente de devolução'
      });
    }

    await conn.query(
      `UPDATE pedido_itens SET quantidade_devolvida = quantidade_devolvida + ? WHERE pedido_id = ? AND produto_id = ?`,
      [total, pedidoId, produtoId]
    );

    await conn.commit();
    return { sucesso: true, quantidade: total, boas, danificadas, pendentes };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function enviarParaManutencao({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) throw new Error('Quantidade inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');
    if (Number(produto.estoque_danificado || 0) < qtd) throw new Error('Quantidade danificada insuficiente.');

    await conn.query(
      `UPDATE produtos
       SET estoque_danificado = GREATEST(estoque_danificado - ?, 0),
           estoque_manutencao = estoque_manutencao + ?,
           updatedAt = NOW()
       WHERE id = ?`,
      [qtd, qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.MANUTENCAO,
      quantidade: qtd,
      observacao: observacao || 'Produto enviado para manutenção'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function finalizarManutencao({ produtoId, quantidade, status = 'REPARADO', usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) throw new Error('Quantidade inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');
    if (Number(produto.estoque_manutencao || 0) < qtd) throw new Error('Quantidade em manutenção insuficiente.');

    if (status === 'REPARADO') {
      await conn.query(
        `UPDATE produtos
         SET estoque_manutencao = GREATEST(estoque_manutencao - ?, 0),
             estoque = estoque + ?,
             updatedAt = NOW()
         WHERE id = ?`,
        [qtd, qtd, produtoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.FINALIZACAO_MANUTENCAO,
        quantidade: qtd,
        observacao: observacao || 'Manutenção concluída com sucesso'
      });
    } else {
      await conn.query(
        `UPDATE produtos SET estoque_manutencao = GREATEST(estoque_manutencao - ?, 0), updatedAt = NOW() WHERE id = ?`,
        [qtd, produtoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.DESCARTE,
        quantidade: qtd,
        observacao: observacao || 'Produto descartado após manutenção'
      });
    }

    await conn.commit();
    return { sucesso: true, quantidade: qtd, status };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarAjuste({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId) throw new Error('Produto inválido.');
  if (!Number.isFinite(qtd)) throw new Error('Quantidade inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    const novoEstoque = Number(produto.estoque || 0) + qtd;
    if (novoEstoque < 0) throw new Error('Ajuste não pode deixar o estoque negativo.');

    await conn.query(
      `UPDATE produtos SET estoque = ?, updatedAt = NOW() WHERE id = ?`,
      [novoEstoque, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.AJUSTE,
      quantidade: qtd,
      observacao: observacao || 'Ajuste manual de estoque'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarVenda({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  const qtd = Number(quantidade || 0);
  if (!produtoId || qtd <= 0) throw new Error('Quantidade da venda inválida.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const produto = await buscarProduto(conn, produtoId);
    if (!produto) throw new Error('Produto não encontrado.');

    if (Number(produto.estoque || 0) < qtd) {
      throw new Error('Estoque insuficiente para venda.');
    }

    await conn.query(
      `UPDATE produtos SET estoque = estoque - ?, updatedAt = NOW() WHERE id = ?`,
      [qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      pedido_id: pedidoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.VENDA,
      quantidade: -qtd,
      observacao: observacao || 'Venda registrada'
    });

    await conn.commit();
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function resumoEstoque() {
  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS total_produtos,
      COALESCE(SUM(estoque), 0) AS estoque_fisico,
      COALESCE(SUM(estoque_reservado), 0) AS estoque_reservado,
      COALESCE(SUM(estoque_em_uso), 0) AS estoque_em_uso,
      COALESCE(SUM(estoque_manutencao), 0) AS estoque_manutencao,
      COALESCE(SUM(estoque_danificado), 0) AS estoque_danificado,
      COALESCE(SUM(estoque - estoque_reservado - estoque_em_uso - estoque_manutencao - estoque_danificado), 0) AS disponivel
    FROM produtos
    WHERE ativo = 1
  `);

  return rows[0] || {
    total_produtos: 0,
    estoque_fisico: 0,
    estoque_reservado: 0,
    estoque_em_uso: 0,
    estoque_manutencao: 0,
    estoque_danificado: 0,
    disponivel: 0
  };
}
