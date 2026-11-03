import db from '../../../database/connection.js';

function validarQuantidadePositiva(valor, campo = 'Quantidade') {
  const quantidade = Number(valor);
  if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
    throw new Error(`${campo} deve ser um inteiro positivo.`);
  }
  return quantidade;
}

function validarIdPositivo(valor, campo = 'Identificador') {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${campo} inválido.`);
  }
  return id;
}

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

export function controlaEstoque(produto) {
  return produto?.controla_estoque !== false
    && produto?.controla_estoque !== 0
    && produto?.controla_estoque !== '0';
}

export function calcularDisponibilidade(produto) {
  if (!controlaEstoque(produto)) return null;
  const estoque = Number(produto?.estoque ?? 0);
  const reservado = Number(produto?.estoque_reservado ?? 0);
  const emUso = Number(produto?.estoque_em_uso ?? 0);
  const manutencao = Number(produto?.estoque_manutencao ?? 0);
  const danificado = Number(produto?.estoque_danificado ?? 0);

  return estoque - reservado - emUso - manutencao - danificado;
}

export function validarEstoque(produto) {
  if (!controlaEstoque(produto)) return true;
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
  if (!controlaEstoque(produto)) return true;
  return validarEstoque(produto) && calcularDisponibilidade(produto) >= 0;
}

export function statusEstoque(produto) {
  if (!controlaEstoque(produto)) return 'NAO_CONTROLADO';
  const disponivel = calcularDisponibilidade(produto);
  const minimo = Number(produto?.estoque_minimo ?? 0);

  if (disponivel <= 0) return 'INDISPONIVEL';
  if (disponivel <= minimo) return 'BAIXO_ESTOQUE';
  if (Number(produto?.estoque_manutencao ?? 0) > 0) return 'MANUTENCAO';
  if (Number(produto?.estoque_danificado ?? 0) > 0) return 'DANIFICADO';
  if (Number(produto?.estoque_em_uso ?? 0) > 0) return 'EM_USO';
  if (Number(produto?.estoque_reservado ?? 0) > 0) return 'RESERVADO';
  return 'DISPONIVEL';
}

async function buscarProduto(conn, produtoId, bloquear = false) {
  const { rows: rows } = await conn.query(
    `SELECT * FROM produtos WHERE id = $1${bloquear ? ' FOR UPDATE' : ''}`,
    [produtoId]
  );
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

  const { rows: produtos } = await conn.query(
    'SELECT controla_estoque FROM produtos WHERE id = $1',
    [produto_id]
  );
  if (!produtos.length || !controlaEstoque(produtos[0])) return;

  await conn.query(
    `INSERT INTO movimentacao_estoque
      (produto_id, pedido_id, usuario_id, tipo, quantidade, observacao, data_movimentacao)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [produto_id, pedido_id, usuario_id, tipo, quantidade, observacao]
  );

  await conn.query(
    `INSERT INTO estoque_historico
      (produto_id, pedido_id, usuario_id, tipo, quantidade, observacao, data_movimentacao)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [produto_id, pedido_id, usuario_id, tipo, quantidade, observacao]
  );
}

export async function registrarEntrada({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade de entrada');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');

    await conn.query(
      `UPDATE produtos SET estoque = estoque + $1, "updatedAt" = NOW() WHERE id = $2`,
      [qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.ENTRADA,
      quantidade: qtd,
      observacao: observacao || 'Entrada de estoque'
    });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarSaida({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade de saída');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');

    if (produtosDisponiveis(produto) < qtd) {
      throw new Error('Estoque insuficiente para a saída.');
    }

    await conn.query(
      `UPDATE produtos SET estoque = GREATEST(estoque - $1, 0), "updatedAt" = NOW() WHERE id = $2`,
      [qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.SAIDA,
      quantidade: -qtd,
      observacao: observacao || 'Saída de estoque'
    });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export function produtosDisponiveis(produto) {
  return calcularDisponibilidade(produto);
}

export async function calcularDisponibilidadeCombo(comboId) {
  const { rows: itens } = await db.query(
    `SELECT ci.*, p.nome AS produto_nome, p.estoque, p.controla_estoque,
            p.estoque_reservado, p.estoque_em_uso, p.estoque_manutencao, p.estoque_danificado
     FROM combo_itens ci
     LEFT JOIN produtos p ON p.id = ci.produto_id
     WHERE ci.combo_id = $1`,
    [comboId]
  );

  if (!itens.length) {
    return { disponivel: 0, limitante: null };
  }

  const opcoes = itens
    .filter((item) => item && item.produto_id && controlaEstoque(item))
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
    disponivel: limitante ? limitante.disponivel_em_combos : null,
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
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade para reserva');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');
    if (!validarEstoque(produto)) throw new Error('Produto com dados de estoque inválidos.');

    const disponivel = produtosDisponiveis(produto);
    if (disponivel < qtd) {
      throw new Error(`Não foi possível reservar o produto.\nNecessário: ${qtd}\nDisponível: ${disponivel}\nFaltam: ${qtd - disponivel}`);
    }

    await conn.query(
      `UPDATE produtos SET estoque_reservado = estoque_reservado + $1, "updatedAt" = NOW() WHERE id = $2`,
      [qtd, produtoId]
    );

    await conn.query(
      `INSERT INTO reservas_estoque (pedido_id, produto_id, quantidade, status, data_reserva, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ATIVA', NOW(), NOW(), NOW())`,
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

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
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

    const { rows: rows } = await conn.query('SELECT * FROM produtos WHERE id = $1 FOR UPDATE', [produtoId]);
    const produto = rows[0];

    if (!produto) {
      throw new Error(`Produto ${produtoId} não encontrado.`);
    }
    if (!controlaEstoque(produto)) continue;

    if (!validarEstoque(produto)) {
      throw new Error(`Produto ${produto.nome || produtoId} possui estoque inválido.`);
    }

    const { rows: reservasAtivas } = await conn.query(
      `SELECT id, quantidade
       FROM reservas_estoque
       WHERE pedido_id = $1 AND produto_id = $2 AND status = 'ATIVA'
       ORDER BY id ASC
       FOR UPDATE`,
      [pedidoId, produtoId]
    );
    const quantidadeReservada = reservasAtivas.reduce(
      (total, reserva) => total + Number(reserva.quantidade || 0),
      0
    );
    const quantidadeNecessaria = Math.max(0, quantidade - quantidadeReservada);

    if (quantidadeNecessaria === 0) {
      reservas.push({
        id: reservasAtivas[0]?.id,
        produto_id: produtoId,
        quantidade: quantidadeReservada,
        pedido_id: pedidoId
      });
      continue;
    }

    const disponivel = produtosDisponiveis(produto);
    if (disponivel < quantidadeNecessaria) {
      throw new Error(`Não foi possível reservar o pedido.\nProduto: ${produto.nome}\nNecessário: ${quantidadeNecessaria}\nDisponível: ${disponivel}\nFaltam: ${quantidadeNecessaria - disponivel}`);
    }

    await conn.query(
      `UPDATE produtos SET estoque_reservado = estoque_reservado + $1 WHERE id = $2`,
      [quantidadeNecessaria, produtoId]
    );

    let reservaId = reservasAtivas[0]?.id;
    if (reservaId) {
      await conn.query(
        `UPDATE reservas_estoque
         SET quantidade = quantidade + $1, "updatedAt" = NOW()
         WHERE id = $2`,
        [quantidadeNecessaria, reservaId]
      );
    } else {
      const reservaResult = await conn.query(
        `INSERT INTO reservas_estoque (pedido_id, produto_id, quantidade, status, data_reserva, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ATIVA', NOW(), NOW(), NOW())
         RETURNING id`,
        [pedidoId, produtoId, quantidadeNecessaria]
      );
      reservaId = reservaResult.rows[0].id;
    }

    reservas.push({
      id: reservaId,
      produto_id: produtoId,
      quantidade: quantidadeReservada + quantidadeNecessaria,
      pedido_id: pedidoId
    });

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      pedido_id: pedidoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.RESERVA,
      quantidade: quantidadeNecessaria,
      observacao: 'Reserva automática do pedido'
    });
  }

  return reservas;
}

export async function reservarComponentesCombos({ conn, itens = [], pedidoId = null, usuarioId = null }) {
  const itensCombo = itens.filter((item) => item.combo_id);
  if (!itensCombo.length) return [];

  const componentes = [];
  for (const item of itensCombo) {
    const { rows: rows } = await conn.query(
      `SELECT ci.produto_id, ci.quantidade, p.nome
       FROM combo_itens ci
       INNER JOIN produtos p ON p.id = ci.produto_id
       WHERE ci.combo_id = $1
       FOR UPDATE`,
      [item.combo_id]
    );
    if (!rows.length) throw new Error(`Combo ${item.combo_id} não possui componentes.`);
    for (const componente of rows) {
      componentes.push({
        produto_id: componente.produto_id,
        quantidade: Number(componente.quantidade) * Number(item.quantidade || 0),
        nome: componente.nome
      });
    }
  }

  const agregados = [...componentes.reduce((mapa, item) => {
    const atual = mapa.get(item.produto_id) || { produto_id: item.produto_id, quantidade: 0 };
    atual.quantidade += item.quantidade;
    mapa.set(item.produto_id, atual);
    return mapa;
  }, new Map()).values()];

  const reservas = await reservarItensPedido({ conn, itens: agregados, pedidoId, usuarioId });
  for (const item of itensCombo) {
    const { rows: rows } = await conn.query(
      `SELECT id, produto_id, quantidade FROM combo_itens WHERE combo_id = $1`,
      [item.combo_id]
    );
    for (const componente of rows) {
      await conn.query(
        `INSERT INTO pedido_item_componentes
          (pedido_item_id, produto_id, quantidade_por_unidade, quantidade_total)
         VALUES ($1, $2, $3, $4)`,
        [item.pedido_item_id || item.id, componente.produto_id, componente.quantidade, Number(componente.quantidade) * Number(item.quantidade || 0)]
      );
    }
  }
  return reservas;
}

export async function reservarItensPedidoComCombos({ conn, itens = [], pedidoId = null, usuarioId = null }) {
  const desejadas = await necessidadesDeReserva(conn, itens);
  const reservas = await reservarItensPedido({ conn, itens: desejadas, pedidoId, usuarioId });

  for (const item of itens.filter((pedidoItem) => pedidoItem.combo_id)) {
    const { rows: componentes } = await conn.query(
      `SELECT produto_id, quantidade
       FROM combo_itens
       WHERE combo_id = $1`,
      [item.combo_id]
    );
    for (const componente of componentes) {
      const pedidoItemId = item.pedido_item_id || item.id;
      const quantidadeTotal = Number(componente.quantidade) * Number(item.quantidade || 0);
      const { rows: existentes } = await conn.query(
        `SELECT id
         FROM pedido_item_componentes
         WHERE pedido_item_id = $1 AND produto_id = $2
         LIMIT 1
         FOR UPDATE`,
        [pedidoItemId, componente.produto_id]
      );

      if (existentes.length) {
        await conn.query(
          `UPDATE pedido_item_componentes
           SET pedido_id = $1, quantidade_por_unidade = $2, quantidade_total = $3
           WHERE id = $4`,
          [pedidoId, componente.quantidade, quantidadeTotal, existentes[0].id]
        );
      } else {
        await conn.query(
          `INSERT INTO pedido_item_componentes
            (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
           VALUES ($1, $2, $3, $4, $5)`,
          [pedidoItemId, pedidoId, componente.produto_id, componente.quantidade, quantidadeTotal]
        );
      }
    }
  }

  return reservas;
}

async function necessidadesDeReserva(conn, itens = []) {
  const agregados = new Map();

  for (const item of itens) {
    const quantidade = Number(item.quantidade || 0);
    if (quantidade <= 0 || (item.tipo_item || '').toUpperCase() === 'VENDA') continue;

    if (item.combo_id) {
      const { rows: componentes } = await conn.query(
        `SELECT ci.produto_id, ci.quantidade, p.nome
         FROM combo_itens ci
         INNER JOIN produtos p ON p.id = ci.produto_id
         WHERE ci.combo_id = $1 AND p.ativo = 1
         FOR UPDATE`,
        [item.combo_id]
      );
      if (!componentes.length) throw new Error(`Combo ${item.combo_id} não possui componentes ativos.`);
      for (const componente of componentes) {
        const atual = agregados.get(componente.produto_id) || { produto_id: componente.produto_id, quantidade: 0 };
        atual.quantidade += Number(componente.quantidade) * quantidade;
        agregados.set(componente.produto_id, atual);
      }
    } else if (item.produto_id) {
      const produtoId = Number(item.produto_id);
      const atual = agregados.get(produtoId) || { produto_id: produtoId, quantidade: 0 };
      atual.quantidade += quantidade;
      agregados.set(produtoId, atual);
    }
  }

  return [...agregados.values()];
}

async function liberarReservaNaTransacao(conn, {
  produtoId,
  quantidade,
  pedidoId = null,
  usuarioId = null,
  observacao = ''
}) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade para liberação');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');

  const produto = await buscarProduto(conn, produtoId, true);
  if (!produto) throw new Error('Produto não encontrado.');
  if (!controlaEstoque(produto)) return;
  if (Number(produto.estoque_reservado || 0) < qtd) {
    throw new Error(`Reserva insuficiente para liberar o produto ${produto.nome || produtoId}.`);
  }

  const { rows: reservas } = await conn.query(
    `SELECT id, quantidade FROM reservas_estoque
     WHERE produto_id = $1 AND pedido_id = $2 AND status = 'ATIVA'
     ORDER BY id ASC FOR UPDATE`,
    [produtoId, pedidoId]
  );
  const totalReservado = reservas.reduce((total, reserva) => total + Number(reserva.quantidade || 0), 0);
  if (totalReservado < qtd) {
    throw new Error(`Reserva do produto ${produto.nome || produtoId} não cobre a quantidade solicitada.`);
  }

  let restante = qtd;
  for (const reserva of reservas) {
    if (restante <= 0) break;
    const consumida = Math.min(restante, Number(reserva.quantidade || 0));
    const novaQuantidade = Number(reserva.quantidade) - consumida;
    await conn.query(
      `UPDATE reservas_estoque
       SET quantidade = $1, status = $2,
           data_liberacao = CASE WHEN $2 = 'LIBERADA' THEN NOW() ELSE data_liberacao END,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [novaQuantidade, novaQuantidade === 0 ? 'LIBERADA' : 'ATIVA', reserva.id]
    );
    restante -= consumida;
  }

  await conn.query(
    `UPDATE produtos
     SET estoque_reservado = estoque_reservado - $1, "updatedAt" = NOW()
     WHERE id = $2 AND estoque_reservado >= $3`,
    [qtd, produtoId, qtd]
  );
  await registrarMovimentacao(conn, {
    produto_id: produtoId,
    pedido_id: pedidoId,
    usuario_id: usuarioId,
    tipo: TIPOS_MOVIMENTACAO.LIBERACAO_RESERVA,
    quantidade: -qtd,
    observacao: observacao || 'Liberação de reserva'
  });
}

export async function ajustarReservasPedidoNaTransacao(conn, {
  pedidoId,
  itens = [],
  usuarioId = null,
  observacao = 'Ajuste de reservas do pedido'
}) {
  if (!pedidoId) throw new Error('Pedido inválido para ajuste de reservas.');

  const desejadas = await necessidadesDeReserva(conn, itens);
  const { rows: reservasAtuais } = await conn.query(
    `SELECT produto_id, quantidade
     FROM reservas_estoque
     WHERE pedido_id = $1 AND status = 'ATIVA'
     FOR UPDATE`,
    [pedidoId]
  );
  const atuais = [...reservasAtuais.reduce((mapa, reserva) => {
    const produtoId = Number(reserva.produto_id);
    mapa.set(produtoId, (mapa.get(produtoId) || 0) + Number(reserva.quantidade || 0));
    return mapa;
  }, new Map()).entries()].map(([produto_id, quantidade]) => ({ produto_id, quantidade }));
  const mapaAtuais = new Map(atuais.map((item) => [Number(item.produto_id), Number(item.quantidade || 0)]));
  const mapaDesejadas = new Map(desejadas.map((item) => [Number(item.produto_id), Number(item.quantidade || 0)]));
  const produtos = new Set([...mapaAtuais.keys(), ...mapaDesejadas.keys()]);

  for (const produtoId of produtos) {
    const atual = mapaAtuais.get(produtoId) || 0;
    const desejada = mapaDesejadas.get(produtoId) || 0;
    const diferenca = desejada - atual;
    if (diferenca > 0) {
      await reservarItensPedido({
        conn,
        itens: [{ produto_id: produtoId, quantidade: desejada }],
        pedidoId,
        usuarioId
      });
    } else if (diferenca < 0) {
      await liberarReservaNaTransacao(conn, {
        produtoId,
        quantidade: Math.abs(diferenca),
        pedidoId,
        usuarioId,
        observacao
      });
    }
  }

  return desejadas;
}

export async function liberarReservasPedidoNaTransacao(conn, {
  pedidoId,
  usuarioId = null,
  observacao = ''
}) {
  const { rows: reservasAtivas } = await conn.query(
    `SELECT produto_id, quantidade
     FROM reservas_estoque
     WHERE pedido_id = $1 AND status = 'ATIVA'
     FOR UPDATE`,
    [pedidoId]
  );
  const reservas = [...reservasAtivas.reduce((mapa, reserva) => {
    const produtoId = Number(reserva.produto_id);
    mapa.set(produtoId, (mapa.get(produtoId) || 0) + Number(reserva.quantidade || 0));
    return mapa;
  }, new Map()).entries()].map(([produto_id, quantidade]) => ({ produto_id, quantidade }));

  for (const reserva of reservas) {
    await liberarReservaNaTransacao(conn, {
      produtoId: reserva.produto_id,
      quantidade: reserva.quantidade,
      pedidoId,
      usuarioId,
      observacao: observacao || `Cancelamento do pedido ${pedidoId}`
    });
  }

  return reservas;
}

export async function liberarReserva({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade para liberação');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');

    await liberarReservaNaTransacao(conn, { produtoId, quantidade: qtd, pedidoId, usuarioId, observacao });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function cancelarPedido({ pedidoId, usuarioId = null, observacao = '' }) {
  if (!pedidoId) {
    throw new Error('Pedido inválido para cancelamento.');
  }

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: itens } = await conn.query(
      `SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = $1 FOR UPDATE`,
      [pedidoId]
    );

    for (const item of itens) {
      const produtoId = Number(item.produto_id || 0);
      const quantidade = Number(item.quantidade || 0);
      if (!produtoId || quantidade <= 0) continue;

      const { rows: produtos } = await conn.query(
        'SELECT controla_estoque FROM produtos WHERE id = $1 FOR UPDATE',
        [produtoId]
      );
      if (!produtos.length || !controlaEstoque(produtos[0])) continue;

      await conn.query(
        `UPDATE produtos SET estoque_reservado = GREATEST(estoque_reservado - $1, 0), "updatedAt" = NOW() WHERE id = $2`,
        [quantidade, produtoId]
      );

      await conn.query(
        `UPDATE reservas_estoque
         SET status = 'CANCELADA', data_liberacao = NOW(), "updatedAt" = NOW()
         WHERE produto_id = $1 AND pedido_id = $2 AND status = 'ATIVA'`,
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
      `UPDATE pedidos SET status = 'CANCELADO', status_documento = 'PEDIDO' WHERE id = $1`,
      [pedidoId]
    );

    await client.query('COMMIT');
    return { sucesso: true, pedidoId, itens: itens.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function alterarQuantidadeItemPedido({ pedidoId, produtoId, novaQuantidade, usuarioId = null, observacao = '' }) {
  pedidoId = validarIdPositivo(pedidoId, 'Pedido');
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtdNova = validarQuantidadePositiva(novaQuantidade, 'Quantidade do item');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: rows } = await conn.query(
      `SELECT quantidade FROM pedido_itens WHERE pedido_id = $1 AND produto_id = $2 FOR UPDATE`,
      [pedidoId, produtoId]
    );

    if (!rows.length) {
      throw new Error('Item do pedido não encontrado.');
    }

    const quantidadeAtual = Number(rows[0].quantidade || 0);
    const diferenca = qtdNova - quantidadeAtual;

    if (diferenca > 0) {
      const { rows: produtoRows } = await conn.query('SELECT * FROM produtos WHERE id = $1 FOR UPDATE', [produtoId]);
      const produto = produtoRows[0];
      if (!produto) throw new Error('Produto não encontrado.');

      if (controlaEstoque(produto)) {
      const disponivel = Number(produto.estoque || 0)
        - Number(produto.estoque_reservado || 0)
        - Number(produto.estoque_em_uso || 0)
        - Number(produto.estoque_manutencao || 0)
        - Number(produto.estoque_danificado || 0);

      if (disponivel < diferenca) {
        throw new Error(`Estoque insuficiente para aumentar a quantidade em ${diferenca}. Disponível: ${disponivel}.`);
      }

      await conn.query(
        `UPDATE produtos SET estoque_reservado = estoque_reservado + $1 WHERE id = $2`,
        [diferenca, produtoId]
      );

      await conn.query(
        `INSERT INTO reservas_estoque (pedido_id, produto_id, quantidade, status, data_reserva, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ATIVA', NOW(), NOW(), NOW())`,
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
    }

    if (diferenca < 0) {
      const { rows: produtoRows } = await conn.query(
        'SELECT controla_estoque FROM produtos WHERE id = $1 FOR UPDATE',
        [produtoId]
      );
      if (produtoRows.length && controlaEstoque(produtoRows[0])) {
      const quantidadeLiberada = Math.abs(diferenca);
      await conn.query(
        `UPDATE produtos SET estoque_reservado = GREATEST(estoque_reservado - $1, 0) WHERE id = $2`,
        [quantidadeLiberada, produtoId]
      );

      await conn.query(
        `WITH reserva_selecionada AS (
           SELECT id
           FROM reservas_estoque
           WHERE produto_id = $1 AND pedido_id = $2 AND status = 'ATIVA'
           ORDER BY id DESC
           LIMIT 1
           FOR UPDATE
         )
         UPDATE reservas_estoque AS reserva
         SET status = 'LIBERADA', data_liberacao = NOW(), "updatedAt" = NOW()
         FROM reserva_selecionada
         WHERE reserva.id = reserva_selecionada.id`,
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
    }

    await conn.query(
      `UPDATE pedido_itens SET quantidade = $1 WHERE pedido_id = $2 AND produto_id = $3`,
      [qtdNova, pedidoId, produtoId]
    );

    await client.query('COMMIT');
    return { sucesso: true, produtoId, quantidade: qtdNova };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function confirmarEntrega({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade para entrega');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    await confirmarEntregaNaTransacao(conn, { produtoId, quantidade: qtd, pedidoId, usuarioId, observacao });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function confirmarEntregaNaTransacao(conn, {
  produtoId,
  quantidade,
  pedidoId = null,
  usuarioId = null,
  observacao = ''
}) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  quantidade = validarQuantidadePositiva(quantidade, 'Quantidade para entrega');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');
  const produto = await buscarProduto(conn, produtoId, true);
  if (!produto) throw new Error('Produto não encontrado.');
  if (!controlaEstoque(produto)) return;
  if (Number(produto.estoque_reservado || 0) < quantidade) {
    throw new Error('Quantidade reservada insuficiente para confirmar entrega.');
  }

  await conn.query(
    `UPDATE produtos
     SET estoque_reservado = estoque_reservado - $1,
         estoque_em_uso = estoque_em_uso + $2,
         "updatedAt" = NOW()
     WHERE id = $3`,
    [quantidade, quantidade, produtoId]
  );
  const { rows: reservas } = await conn.query(
    `SELECT id, quantidade FROM reservas_estoque
     WHERE produto_id = $1 AND pedido_id = $2 AND status = 'ATIVA'
     ORDER BY id ASC FOR UPDATE`,
    [produtoId, pedidoId]
  );
  let restanteReserva = quantidade;
  for (const reserva of reservas) {
    if (restanteReserva <= 0) break;
    const consumida = Math.min(restanteReserva, Number(reserva.quantidade || 0));
    const saldo = Number(reserva.quantidade) - consumida;
    await conn.query(
      `UPDATE reservas_estoque
       SET quantidade = $1, status = $2, "updatedAt" = NOW()
       WHERE id = $3`,
      [saldo, saldo === 0 ? 'CONVERTIDA_USO' : 'ATIVA', reserva.id]
    );
    restanteReserva -= consumida;
  }
  if (restanteReserva > 0) {
    throw new Error('Reserva ativa insuficiente para confirmar entrega.');
  }
  await registrarMovimentacao(conn, {
    produto_id: produtoId,
    pedido_id: pedidoId,
    usuario_id: usuarioId,
    tipo: TIPOS_MOVIMENTACAO.ENTREGA,
    quantidade,
    observacao: observacao || 'Entrega confirmada'
  });
}

export async function confirmarComponentesPedido({ pedidoItemId, pedidoId, usuarioId = null }) {
  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const { rows: componentes } = await conn.query(
      `SELECT produto_id, quantidade_total
       FROM pedido_item_componentes
       WHERE pedido_item_id = $1 FOR UPDATE`,
      [pedidoItemId]
    );
    for (const componente of componentes) {
      await confirmarEntregaNaTransacao(conn, {
        produtoId: componente.produto_id,
        quantidade: componente.quantidade_total,
        pedidoId,
        usuarioId,
        observacao: 'Entrega de componente de combo'
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarDevolucaoComponentesNaTransacao(conn, {
  pedidoItemId,
  pedidoId,
  quantidadeBoa,
  quantidadeDanificada,
  usuarioId = null,
  observacao = ''
}) {
  const { rows: componentes } = await conn.query(
    `SELECT produto_id, quantidade_por_unidade, quantidade_total
     FROM pedido_item_componentes WHERE pedido_item_id = $1 FOR UPDATE`,
    [pedidoItemId]
  );
  for (const componente of componentes) {
    const fator = Number(componente.quantidade_por_unidade || 1);
    const devolucoes = [
      [quantidadeBoa * fator, 'BOA'],
      [quantidadeDanificada * fator, 'DANIFICADA']
    ];
    for (const [quantidade, tipo] of devolucoes) {
      if (quantidade <= 0) continue;
      await registrarDevolucaoNaTransacao(conn, {
        produtoId: componente.produto_id,
        quantidade,
        tipo, pedidoId, usuarioId, observacao
      });
    }
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
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade de devolução');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    await registrarDevolucaoNaTransacao(conn, {
      produtoId,
      quantidade: qtd,
      tipo,
      pedidoId,
      usuarioId,
      observacao
    });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd, tipo };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarDevolucaoNaTransacao(conn, {
  produtoId,
  quantidade,
  tipo,
  pedidoId,
  usuarioId,
  observacao
}) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  quantidade = validarQuantidadePositiva(quantidade, 'Quantidade de devolução');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');
  if (!['BOA', 'DANIFICADA'].includes(tipo)) {
    throw new Error('Tipo de devolução inválido.');
  }
  const produto = await buscarProduto(conn, produtoId, true);
  if (!produto) throw new Error('Produto não encontrado.');
  if (!controlaEstoque(produto)) return;
  if (Number(produto.estoque_em_uso || 0) < quantidade) {
    throw new Error('Quantidade em uso insuficiente para devolução.');
  }

  let movimento;
  let observacaoPadrao;
  if (tipo === 'DANIFICADA') {
    await conn.query(
      `UPDATE produtos
       SET estoque_em_uso = estoque_em_uso - $1,
           estoque_danificado = estoque_danificado + $2,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [quantidade, quantidade, produtoId]
    );
    movimento = TIPOS_MOVIMENTACAO.DANIFICADO;
    observacaoPadrao = 'Produto devolvido danificado';
  } else {
    await conn.query(
      `UPDATE produtos SET estoque_em_uso = estoque_em_uso - $1, "updatedAt" = NOW() WHERE id = $2`,
      [quantidade, produtoId]
    );
    movimento = TIPOS_MOVIMENTACAO.RETORNO;
    observacaoPadrao = 'Produto devolvido em boas condições';
  }

  await registrarMovimentacao(conn, {
    produto_id: produtoId,
    pedido_id: pedidoId,
    usuario_id: usuarioId,
    tipo: movimento,
    quantidade,
    observacao: observacao || observacaoPadrao
  });
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
  pedidoId = validarIdPositivo(pedidoId, 'Pedido');
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const entregue = validarQuantidadePositiva(quantidadeEntregue, 'Quantidade entregue');
  const quantidadesDevolvidas = [quantidadeBoa, quantidadeDanificada, quantidadePendente].map((valor) => {
    const quantidade = Number(valor ?? 0);
    if (!Number.isSafeInteger(quantidade) || quantidade < 0) {
      throw new Error('As quantidades devolvidas devem ser inteiros não negativos.');
    }
    return quantidade;
  });
  const [boas, danificadas, pendentes] = quantidadesDevolvidas;

  const total = boas + danificadas + pendentes;
  if (total <= 0 || total > entregue) {
    throw new Error('A devolução não pode exceder a quantidade entregue.');
  }

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: pedidoItemRows } = await conn.query(
      `SELECT id, tipo_item, quantidade, quantidade_devolvida, quantidade_entregue
       FROM pedido_itens
       WHERE pedido_id = $1 AND produto_id = $2
       ORDER BY id ASC LIMIT 1 FOR UPDATE`,
      [pedidoId, produtoId]
    );

    if (!pedidoItemRows.length) {
      throw new Error('Item do pedido não encontrado para devolução.');
    }

    const pedidoItem = pedidoItemRows[0];
    if (String(pedidoItem.tipo_item || '').toUpperCase() !== 'ALUGUEL') {
      throw new Error('Itens de venda não podem ser registrados como devolução de estoque alugado.');
    }
    const entregueReal = Number(pedidoItem.quantidade_entregue || pedidoItem.quantidade || 0);
    const devolvidoAtual = Number(pedidoItem.quantidade_devolvida || 0);
    const restante = Math.max(0, entregueReal - devolvidoAtual);

    if (total > restante) {
      throw new Error(`Quantidade devolvida excede o restante do item. Restante: ${restante}.`);
    }

    if (boas > 0) {
      await registrarDevolucaoNaTransacao(conn, {
        produtoId,
        quantidade: boas,
        tipo: 'BOA',
        pedidoId,
        usuarioId,
        observacao: observacao || 'Devolução em boas condições'
      });
    }

    if (danificadas > 0) {
      await registrarDevolucaoNaTransacao(conn, {
        produtoId,
        quantidade: danificadas,
        tipo: 'DANIFICADA',
        pedidoId,
        usuarioId,
        observacao: observacao || 'Devolução com dano'
      });
    }

    const quantidadeRecebida = boas + danificadas;
    await conn.query(
      `UPDATE pedido_itens SET quantidade_devolvida = quantidade_devolvida + $1 WHERE id = $2`,
      [quantidadeRecebida, pedidoItem.id]
    );

    const devolucao = await conn.query(
      `INSERT INTO devolucoes (pedido_id, usuario_id, data_devolucao, observacao, created_at)
       VALUES ($1, $2, NOW(), $3, NOW())
       RETURNING id`,
      [pedidoId, usuarioId, observacao || null]
    );
    await conn.query(
      `INSERT INTO devolucao_itens
        (devolucao_id, produto_id, quantidade_recebida, quantidade_faltando, quantidade_danificada, observacao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [devolucao.rows[0].id, produtoId, quantidadeRecebida, pendentes, danificadas, observacao || null]
    );

    await client.query('COMMIT');
    return { sucesso: true, quantidade: total, boas, danificadas, pendentes };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function enviarParaManutencao({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade);

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');
    const disponivel = produtosDisponiveis(produto);
    const danificado = Number(produto.estoque_danificado || 0);
    if (disponivel + danificado < qtd) {
      throw new Error('Quantidade disponível ou danificada insuficiente.');
    }

    const quantidadeDanificada = Math.min(danificado, qtd);

    await conn.query(
      `UPDATE produtos
       SET estoque_danificado = estoque_danificado - $1,
           estoque_manutencao = estoque_manutencao + $2,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [quantidadeDanificada, qtd, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.MANUTENCAO,
      quantidade: qtd,
      observacao: observacao || 'Produto enviado para manutenção'
    });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function finalizarManutencao({ produtoId, quantidade, status = 'REPARADO', usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade);
  if (status !== 'REPARADO') throw new Error('Estado de finalização da manutenção inválido.');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');
    if (!validarEstoque(produto)) throw new Error('Produto com dados de estoque inválidos.');
    if (Number(produto.estoque_manutencao || 0) < qtd) throw new Error('Quantidade em manutenção insuficiente.');

    if (status === 'REPARADO') {
      await conn.query(
        `UPDATE produtos
         SET estoque_manutencao = estoque_manutencao - $1,
             "updatedAt" = NOW()
         WHERE id = $2`,
        [qtd, produtoId]
      );

      await registrarMovimentacao(conn, {
        produto_id: produtoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.FINALIZACAO_MANUTENCAO,
        quantidade: qtd,
        observacao: observacao || 'Manutenção concluída com sucesso'
      });
    }

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd, status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarAjuste({ produtoId, quantidade, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = Number(quantidade);
  if (!Number.isSafeInteger(qtd) || qtd === 0) throw new Error('Ajuste deve ser um inteiro não nulo.');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');
    if (!validarEstoque(produto)) throw new Error('Produto com dados de estoque inválidos.');

    const novoEstoque = Number(produto.estoque || 0) + qtd;
    if (!validarDisponibilidade({ ...produto, estoque: novoEstoque })) {
      throw new Error('Ajuste não pode deixar o estoque ou a disponibilidade negativos.');
    }

    await conn.query(
      `UPDATE produtos SET estoque = $1, "updatedAt" = NOW() WHERE id = $2`,
      [novoEstoque, produtoId]
    );

    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.AJUSTE,
      quantidade: qtd,
      observacao: observacao || 'Ajuste manual de estoque'
    });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function atualizarQuantidadesProduto({
  produtoId,
  estoque,
  estoque_reservado,
  estoque_danificado,
  estoque_minimo,
  usuarioId = null
}) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const quantidades = { estoque, estoque_reservado, estoque_danificado, estoque_minimo };
  for (const [campo, valor] of Object.entries(quantidades)) {
    if (!Number.isSafeInteger(Number(valor)) || Number(valor) < 0) {
      throw new Error(`${campo} deve ser um inteiro não negativo.`);
    }
    quantidades[campo] = Number(valor);
  }

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(conn, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');
    if (!controlaEstoque(produto)) throw new Error('O controle de estoque está desativado para este produto.');
    if (!validarEstoque(produto)) throw new Error('Produto com dados de estoque inválidos.');

    const { rows: [reservasAtivas] } = await conn.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS quantidade
       FROM reservas_estoque
       WHERE produto_id = $1 AND UPPER(status) IN ('ATIVA', 'ATIVO', 'RESERVADA')`,
      [produtoId]
    );
    if (quantidades.estoque_reservado !== Number(produto.estoque_reservado || 0)
        && Number(reservasAtivas.quantidade || 0) > 0) {
      throw new Error('A quantidade reservada possui reservas de pedidos ativas e só pode ser alterada pelos fluxos de reserva.');
    }

    const atualizado = {
      ...produto,
      estoque: quantidades.estoque,
      estoque_reservado: quantidades.estoque_reservado,
      estoque_danificado: quantidades.estoque_danificado,
      estoque_minimo: quantidades.estoque_minimo
    };
    if (!validarDisponibilidade(atualizado)) {
      throw new Error('O estoque físico não pode ser menor que as quantidades reservadas, em uso, em manutenção e danificadas.');
    }

    const alterado = ['estoque', 'estoque_reservado', 'estoque_danificado', 'estoque_minimo']
      .some((campo) => Number(produto[campo] || 0) !== quantidades[campo]);
    if (!alterado) {
      await client.query('COMMIT');
      return {
        sucesso: true,
        disponivel: calcularDisponibilidade(atualizado),
        produto: atualizado
      };
    }

    await conn.query(
      `UPDATE produtos
       SET estoque = $1, estoque_reservado = $2, estoque_danificado = $3,
           estoque_minimo = $4, "updatedAt" = NOW()
       WHERE id = $5`,
      [
        quantidades.estoque,
        quantidades.estoque_reservado,
        quantidades.estoque_danificado,
        quantidades.estoque_minimo,
        produtoId
      ]
    );
    const deltaEstoque = quantidades.estoque - Number(produto.estoque || 0);
    const deltaReservado = quantidades.estoque_reservado - Number(produto.estoque_reservado || 0);
    const deltaDanificado = quantidades.estoque_danificado - Number(produto.estoque_danificado || 0);
    await registrarMovimentacao(conn, {
      produto_id: produtoId,
      usuario_id: usuarioId,
      tipo: TIPOS_MOVIMENTACAO.AJUSTE,
      quantidade: deltaEstoque || deltaReservado || deltaDanificado
        || quantidades.estoque_minimo - Number(produto.estoque_minimo || 0),
      observacao: `Edição de estoque: físico ${produto.estoque}→${quantidades.estoque}, reservado ${produto.estoque_reservado}→${quantidades.estoque_reservado}, danificado ${produto.estoque_danificado}→${quantidades.estoque_danificado}, mínimo ${produto.estoque_minimo}→${quantidades.estoque_minimo}`
    });
    await client.query('COMMIT');
    return {
      sucesso: true,
      disponivel: calcularDisponibilidade(atualizado),
      produto: atualizado
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function alterarControleEstoqueProduto({
  produtoId,
  controlaEstoque,
  estoqueInicial,
  usuarioId = null,
  atualizarCadastro = null
}) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  if (typeof controlaEstoque !== 'boolean') throw new Error('Estado do controle de estoque inválido.');
  if (controlaEstoque && (!Number.isSafeInteger(Number(estoqueInicial)) || Number(estoqueInicial) <= 0)) {
    throw new Error('Informe uma quantidade inicial inteira maior que zero para ativar o controle de estoque.');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const produto = await buscarProduto(client, produtoId, true);
    if (!produto) throw new Error('Produto não encontrado.');

    const estavaControlado = produto.controla_estoque !== false
      && produto.controla_estoque !== 0
      && produto.controla_estoque !== '0';
    if (estavaControlado === controlaEstoque) {
      if (atualizarCadastro) await atualizarCadastro(client);
      await client.query('COMMIT');
      return { sucesso: true, produto };
    }

    if (!controlaEstoque) {
      const { rows: [reservas] } = await client.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS quantidade
         FROM reservas_estoque
         WHERE produto_id = $1 AND UPPER(status) IN ('ATIVA', 'ATIVO', 'RESERVADA')`,
        [produtoId]
      );
      const { rows: [pedidosPendentes] } = await client.query(
        `SELECT COUNT(*) AS quantidade
         FROM pedido_itens i
         INNER JOIN pedidos p ON p.id = i.pedido_id
         WHERE i.produto_id = $1
           AND UPPER(p.status) NOT IN ('CANCELADO', 'FINALIZADO', 'ENTREGUE', 'RETIRADO')`,
        [produtoId]
      );
      if (Number(reservas.quantidade || 0) > 0
          || Number(pedidosPendentes.quantidade || 0) > 0
          || Number(produto.estoque_reservado || 0) > 0
          || Number(produto.estoque_em_uso || 0) > 0
          || Number(produto.estoque_manutencao || 0) > 0) {
        throw new Error('Não é possível desativar o controle de estoque enquanto houver reservas ou operações pendentes.');
      }

      await client.query(
        'UPDATE produtos SET controla_estoque = FALSE, "updatedAt" = NOW() WHERE id = $1',
        [produtoId]
      );
    } else {
      const inicial = Number(estoqueInicial);
      const atualizado = { ...produto, controla_estoque: true, estoque: inicial };
      if (!validarDisponibilidade(atualizado)) {
        throw new Error('A quantidade inicial não pode ser inferior às quantidades já comprometidas.');
      }
      await client.query(
        'UPDATE produtos SET controla_estoque = TRUE, estoque = $1, "updatedAt" = NOW() WHERE id = $2',
        [inicial, produtoId]
      );
      await registrarMovimentacao(client, {
        produto_id: produtoId,
        usuario_id: usuarioId,
        tipo: TIPOS_MOVIMENTACAO.ENTRADA,
        quantidade: inicial,
        observacao: 'Estoque inicial ao ativar o controle de estoque'
      });
    }

    if (atualizarCadastro) await atualizarCadastro(client);
    await client.query('COMMIT');
    return { sucesso: true, controla_estoque: controlaEstoque };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function registrarVenda({ produtoId, quantidade, pedidoId = null, usuarioId = null, observacao = '' }) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  const qtd = validarQuantidadePositiva(quantidade, 'Quantidade da venda');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    await registrarVendaNaTransacao(conn, { produtoId, quantidade: qtd, pedidoId, usuarioId, observacao });

    await client.query('COMMIT');
    return { sucesso: true, quantidade: qtd };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarVendaNaTransacao(conn, {
  produtoId,
  quantidade,
  pedidoId = null,
  usuarioId = null,
  observacao = ''
}) {
  produtoId = validarIdPositivo(produtoId, 'Produto');
  quantidade = validarQuantidadePositiva(quantidade, 'Quantidade da venda');
  if (pedidoId !== null) validarIdPositivo(pedidoId, 'Pedido');
  const produto = await buscarProduto(conn, produtoId, true);
  if (!produto) throw new Error('Produto não encontrado.');
  if (!controlaEstoque(produto)) return;

  if (produtosDisponiveis(produto) < quantidade) {
    throw new Error('Estoque disponível insuficiente para venda.');
  }

  await conn.query(
    `UPDATE produtos SET estoque = estoque - $1, "updatedAt" = NOW() WHERE id = $2`,
    [quantidade, produtoId]
  );

  await registrarMovimentacao(conn, {
    produto_id: produtoId,
    pedido_id: pedidoId,
    usuario_id: usuarioId,
    tipo: TIPOS_MOVIMENTACAO.VENDA,
    quantidade: -quantidade,
    observacao: observacao || 'Venda registrada'
  });
}

export async function registrarVendaItensPedidoNaTransacao(conn, {
  itens = [],
  pedidoId = null,
  usuarioId = null,
  observacao = 'Venda confirmada no pedido'
}) {
  const agregados = new Map();

  for (const item of itens) {
    const quantidade = Number(item.quantidade || 0);
    if (quantidade <= 0 || (item.tipo_item || '').toUpperCase() !== 'VENDA') continue;

    if (item.combo_id) {
      const { rows: componentes } = await conn.query(
        `SELECT produto_id, quantidade
         FROM combo_itens
         WHERE combo_id = $1
         FOR UPDATE`,
        [item.combo_id]
      );
      if (!componentes.length) throw new Error(`Combo ${item.combo_id} não possui componentes.`);
      for (const componente of componentes) {
        const atual = agregados.get(Number(componente.produto_id)) || 0;
        agregados.set(Number(componente.produto_id), atual + Number(componente.quantidade) * quantidade);
      }
    } else if (item.produto_id) {
      const produtoId = Number(item.produto_id);
      agregados.set(produtoId, (agregados.get(produtoId) || 0) + quantidade);
    }
  }

  for (const [produtoId, quantidade] of agregados) {
    await registrarVendaNaTransacao(conn, {
      produtoId,
      quantidade,
      pedidoId,
      usuarioId,
      observacao
    });
  }
}

export async function resumoEstoque() {
  const { rows: rows } = await db.query(`
    SELECT
      COUNT(*) AS total_produtos,
      COUNT(*) FILTER (WHERE ativo = 1) AS produtos_ativos,
      COUNT(*) FILTER (WHERE ativo = 0) AS produtos_inativos,
      COALESCE(SUM(COALESCE(estoque, 0)) FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS estoque_fisico,
      COALESCE(SUM(COALESCE(estoque_reservado, 0)) FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS estoque_reservado,
      COALESCE(SUM(COALESCE(estoque_em_uso, 0)) FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS estoque_em_uso,
      COALESCE(SUM(COALESCE(estoque_manutencao, 0)) FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS estoque_manutencao,
      COALESCE(SUM(COALESCE(estoque_danificado, 0)) FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS estoque_danificado,
      COALESCE(SUM(
        COALESCE(estoque, 0) - COALESCE(estoque_reservado, 0)
        - COALESCE(estoque_em_uso, 0) - COALESCE(estoque_manutencao, 0)
        - COALESCE(estoque_danificado, 0)
      ) FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS disponivel,
      COALESCE(SUM(CASE WHEN (
        COALESCE(estoque, 0) - COALESCE(estoque_reservado, 0)
        - COALESCE(estoque_em_uso, 0) - COALESCE(estoque_manutencao, 0)
        - COALESCE(estoque_danificado, 0)
      ) > 0 AND (
        COALESCE(estoque, 0) - COALESCE(estoque_reservado, 0)
        - COALESCE(estoque_em_uso, 0) - COALESCE(estoque_manutencao, 0)
        - COALESCE(estoque_danificado, 0)
      ) <= COALESCE(estoque_minimo, 0) AND ativo = 1 AND controla_estoque THEN 1 ELSE 0 END), 0) AS baixo_estoque,
      COALESCE(SUM(COALESCE(estoque, 0) * COALESCE(preco_venda, 0))
        FILTER (WHERE ativo = 1 AND controla_estoque), 0) AS valor_estoque
    FROM produtos
  `);

  return rows[0] || {
    total_produtos: 0,
    produtos_ativos: 0,
    produtos_inativos: 0,
    estoque_fisico: 0,
    estoque_reservado: 0,
    estoque_em_uso: 0,
    estoque_manutencao: 0,
    estoque_danificado: 0,
    disponivel: 0,
    baixo_estoque: 0,
    valor_estoque: 0
  };
}

export async function historicoMovimentacoes(filtros = {}) {
  const { tipo = '', produto = '', usuario = '', de = '', ate = '' } = filtros;
  const paginaValor = Number(filtros.pagina || 1);
  const limiteValor = Number(filtros.limite || 25);
  const pagina = Number.isSafeInteger(paginaValor) && paginaValor > 0 ? paginaValor : 1;
  const limite = [10, 25, 50, 100].includes(limiteValor) ? limiteValor : 25;
  const condicoes = [];
  const parametros = [];
  // Both tables receive current writes; retain history-only rows without showing their copies twice.
  const registrosSql = `(
    SELECT m.id, m.data_movimentacao, m.produto_id, m.pedido_id,
           m.usuario_id, m.tipo, m.quantidade, m.observacao
    FROM movimentacao_estoque m
    UNION ALL
    SELECT h.id, h.data_movimentacao, h.produto_id, h.pedido_id,
           h.usuario_id, h.tipo, h.quantidade, h.observacao
    FROM estoque_historico h
    WHERE NOT EXISTS (
      SELECT 1
      FROM movimentacao_estoque atual
      WHERE atual.produto_id = h.produto_id
        AND atual.pedido_id IS NOT DISTINCT FROM h.pedido_id
        AND atual.usuario_id IS NOT DISTINCT FROM h.usuario_id
        AND atual.tipo = h.tipo
        AND atual.quantidade = h.quantidade
        AND atual.observacao IS NOT DISTINCT FROM h.observacao
        AND DATE(atual.data_movimentacao) = DATE(h.data_movimentacao)
    )
  )`;

  if (tipo) {
    if (typeof tipo !== 'string' || tipo.length > 40) {
      throw new Error('Tipo de movimentação inválido.');
    }
    condicoes.push(`m.tipo = $${parametros.length + 1}`);
    parametros.push(tipo);
  }
  if (produto) {
    condicoes.push(`(p.nome ILIKE $${parametros.length + 1} OR p.codigo ILIKE $${parametros.length + 2})`);
    parametros.push(`%${produto}%`, `%${produto}%`);
  }
  if (usuario) {
    const idUsuario = Number(usuario);
    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) throw new Error('Responsável inválido.');
    condicoes.push(`m.usuario_id = $${parametros.length + 1}`);
    parametros.push(idUsuario);
  }
  const validarData = (valor) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (!partes) return false;
    const data = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
    return data.getUTCFullYear() === Number(partes[1])
      && data.getUTCMonth() === Number(partes[2]) - 1
      && data.getUTCDate() === Number(partes[3]);
  };
  if (de && !validarData(de)) throw new Error('Data inicial inválida.');
  if (ate && !validarData(ate)) throw new Error('Data final inválida.');
  if (de && ate && de > ate) throw new Error('A data inicial não pode ser posterior à data final.');
  if (de) {
    condicoes.push(`m.data_movimentacao >= $${parametros.length + 1}`);
    parametros.push(`${de} 00:00:00`);
  }
  if (ate) {
    condicoes.push(`m.data_movimentacao < $${parametros.length + 1}::date + INTERVAL '1 day'`);
    parametros.push(ate);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows: [contagem] } = await db.query(`
    SELECT COUNT(*) AS total
    FROM ${registrosSql} m
    INNER JOIN produtos p ON p.id = m.produto_id
    ${where}
  `, parametros);
  const total = Number(contagem.total || 0);
  const totalPaginas = Math.ceil(total / limite);
  const paginaAtual = totalPaginas ? Math.min(pagina, totalPaginas) : 1;
  const offset = (paginaAtual - 1) * limite;
  const { rows: rows } = await db.query(`
    SELECT m.id, m.data_movimentacao, m.produto_id, p.nome AS produto_nome,
           m.tipo, m.quantidade, m.observacao, u.nome AS usuario_nome,
           CASE WHEN m.pedido_id IS NULL THEN NULL
                ELSE CONCAT('Pedido #', m.pedido_id) END AS origem_destino
    FROM ${registrosSql} m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuario u ON u.id = m.usuario_id
    ${where}
    ORDER BY m.data_movimentacao DESC, m.id DESC
    LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}
  `, [...parametros, limite, offset]);
  const { rows: tipos } = await db.query(
    `SELECT DISTINCT registros.tipo
     FROM ${registrosSql} registros
     ORDER BY registros.tipo`
  );
  const { rows: usuarios } = await db.query(
    `SELECT DISTINCT u.id, u.nome
     FROM ${registrosSql} registros
     INNER JOIN usuario u ON u.id = registros.usuario_id
     ORDER BY u.nome`
  );
  return {
    items: rows,
    tipos: tipos.map((row) => row.tipo),
    usuarios,
    pagination: {
      pagina: paginaAtual,
      limite,
      total,
      totalPaginas
    }
  };
}
