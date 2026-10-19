import db from "../../../database/connection.js";
import {
  registrarDevolucaoNaTransacao,
  confirmarEntregaNaTransacao
} from "../estoque/estoque.service.js";

const valorRecebidoSql = `COALESCE((
  SELECT SUM(CASE WHEN pg.valor > 0 THEN pg.valor ELSE 0 END)
  FROM pagamentos pg
  WHERE pg.pedido_id = p.id
), 0)`;
const valorReembolsadoSql = `COALESCE((
  SELECT SUM(CASE WHEN pg.valor < 0 THEN ABS(pg.valor) ELSE 0 END)
  FROM pagamentos pg
  WHERE pg.pedido_id = p.id
), 0)`;
const valorCreditadoSql = `(${valorRecebidoSql} + ${valorReembolsadoSql})`;

const buildPedidosWhere = ({ search, from, to, status, pay, delivery, kpi }) => {
  const clauses = ["p.status_documento = 'PEDIDO'"];
  const params = [];

  if (search) {
    clauses.push("(c.nome LIKE ? OR c.telefone LIKE ? OR p.telefone_contato LIKE ? OR CAST(p.id AS CHAR) LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (from) {
    clauses.push("p.data_evento >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("p.data_evento <= ?");
    params.push(to);
  }
  if (status) {
    clauses.push("p.status = ?");
    params.push(status);
  }

  if (delivery === "Aguardando Entrega") {
    clauses.push("p.status IN ('ORCAMENTO','CONFIRMADO') AND (p.data_entrega IS NULL OR p.data_entrega >= CURDATE())");
  } else if (delivery === "Em Rota") {
    clauses.push("p.status = 'EM_PREPARO'");
  } else if (delivery === "Entregue") {
    clauses.push("p.status = 'ENTREGUE'");
  } else if (delivery === "Entrega Atrasada") {
    clauses.push(`p.data_entrega < CURDATE()
      AND p.status NOT IN ('ENTREGUE','RETIRADO','CONFERENCIA','PENDENTE','FINALIZADO','CANCELADO')`);
  }

  if (pay === "Não Pago") {
    clauses.push(`${valorCreditadoSql} <= 0`);
  } else if (pay === "Parcialmente Pago") {
    clauses.push(`${valorCreditadoSql} > 0 AND ${valorCreditadoSql} < p.valor_total`);
  } else if (pay === "Pago Integralmente") {
    clauses.push(`${valorCreditadoSql} >= p.valor_total AND p.valor_total > 0`);
  }

  if (kpi === "active") {
    clauses.push("p.status NOT IN ('FINALIZADO','CANCELADO')");
  } else if (kpi === "delivery") {
    clauses.push("DATE(p.data_entrega) = CURDATE()");
  } else if (kpi === "pickup") {
    clauses.push("DATE(p.data_retirada) = CURDATE()");
  } else if (kpi === "late") {
    clauses.push(`${valorCreditadoSql} < p.valor_total AND p.status NOT IN ('FINALIZADO','CANCELADO')`);
  }

  return { sql: clauses.join(" AND "), params };
};

export async function buscarPedidos({ search, from, to, status, pay, delivery, sort, kpi, page = 1, limit = 25 }) {
  const where = buildPedidosWhere({ search, from, to, status, pay, delivery, kpi });
  const joins = `
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    LEFT JOIN endereco e ON e.id = p.endereco_id
    WHERE ${where.sql}
  `;
  const [[count]] = await db.query(`SELECT COUNT(*) AS total ${joins}`, where.params);
  const offset = (page - 1) * limit;
  const orderClause = sort === "event_asc"
    ? "ORDER BY p.data_evento ASC, p.id ASC"
    : "ORDER BY p.data_evento DESC, p.id DESC";
  const [rows] = await db.query(`
    SELECT
      p.id,
      p.status,
      p.data_evento,
      p.data_entrega,
      p.data_retirada,
      p.telefone_contato,
      p.valor_total,
      c.nome AS cliente,
      c.telefone AS telefone,
      e.rua AS endereco_rua,
      e.numero AS endereco_numero,
      e.bairro AS endereco_bairro,
      e.cidade AS endereco_cidade,
      e.estado AS endereco_estado,
      ${valorRecebidoSql} AS valor_pago,
      ${valorCreditadoSql} AS valor_creditado
    ${joins}
    ${orderClause}
    LIMIT ? OFFSET ?
  `, [...where.params, limit, offset]);
  return { rows, total: Number(count.total), page, limit };
}

export async function buscarPedidoPorId(id) {
  const [rows] = await db.query(`
    SELECT
      p.*,
      c.nome AS cliente,
      c.telefone,
      c.email,
      c.cpf,
      e.rua AS endereco_rua,
      e.numero AS endereco_numero,
      e.bairro AS endereco_bairro,
      e.cidade AS endereco_cidade,
      e.estado AS endereco_estado,
      e.cep AS endereco_cep,
      e.referencia AS endereco_referencia,
      ${valorRecebidoSql} AS valor_pago,
      ${valorReembolsadoSql} AS valor_reembolsado,
      ${valorCreditadoSql} AS valor_creditado
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    LEFT JOIN endereco e ON e.id = p.endereco_id
    WHERE p.id = ?
  `, [id]);
  return rows[0] || null;
}

export async function itensDoPedido(pedidoId) {
  const [rows] = await db.query(`
    SELECT pi.*, pr.nome AS produto_nome, cb.nome AS combo_nome
    FROM pedido_itens pi
    LEFT JOIN produtos pr ON pr.id = pi.produto_id
    LEFT JOIN combos cb ON cb.id = pi.combo_id
    WHERE pi.pedido_id = ?
  `, [pedidoId]);
  return rows;
}

export async function pagamentosDoPedido(pedidoId) {
  const [rows] = await db.query(
    `SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY data_pagamento DESC`,
    [pedidoId]
  );
  return rows;
}

export async function ocorrenciasDoPedido(pedidoId) {
  const [rows] = await db.query(
    `SELECT * FROM ocorrencias WHERE pedido_id = ? ORDER BY data_ocorrencia DESC`,
    [pedidoId]
  );
  return rows;
}

export async function devolucoesDoPedido(pedidoId) {
  const [rows] = await db.query(
    `SELECT * FROM devolucoes WHERE pedido_id = ? ORDER BY created_at DESC`,
    [pedidoId]
  );
  return rows;
}

const calcularStatusFinal = (pedido) => {
  const valorTotal = Number(pedido.valor_total || 0);
  const valorPago = Number(pedido.valor_pago || 0);
  const qtdTotal = Number(pedido.qtd_total || 0);
  const qtdDevolvida = Number(pedido.qtd_devolvida || 0);
  const conferenciaFinalizada = Number(pedido.conferencia_finalizada || 0) === 1;

  const pagamentoOK = valorPago >= valorTotal;
  const devolucaoOK = qtdTotal === 0 || qtdDevolvida >= qtdTotal;

  return conferenciaFinalizada && devolucaoOK && pagamentoOK ? "FINALIZADO" : "PENDENTE";
};

export async function atualizarStatusAposPagamento(pedidoId) {
  const [rows] = await db.query(
    `SELECT
        p.status,
        p.status_documento,
        p.valor_total,
        p.conferencia_finalizada,
        ${valorCreditadoSql} AS valor_pago,
        COALESCE(
          (SELECT SUM(CASE WHEN tipo_item <> 'VENDA' THEN quantidade ELSE 0 END)
             FROM pedido_itens
             WHERE pedido_id = p.id),
            0
        ) AS qtd_total,
        COALESCE(
          (SELECT SUM(CASE WHEN tipo_item <> 'VENDA' THEN quantidade_devolvida ELSE 0 END)
             FROM pedido_itens
             WHERE pedido_id = p.id),
            0
        ) AS qtd_devolvida
     FROM pedidos p
     WHERE p.id = ?`,
    [pedidoId]
  );

  const pedido = rows[0];
  if (!pedido) return null;

  if (Number(pedido.conferencia_finalizada || 0) !== 1) {
    return pedido.status;
  }

  const novoStatus = calcularStatusFinal(pedido);

  if (novoStatus && novoStatus !== pedido.status) {
    await db.query(
      `UPDATE pedidos SET status=? WHERE id=?`,
      [novoStatus, pedidoId]
    );
  }

  return novoStatus;
}

export async function inserirPagamento(pedidoId, dados) {
  const { valor, forma_pagamento, observacao, usuario_id } = dados;
  const pagamento = Number(valor);
  if (!Number.isSafeInteger(Math.round(pagamento * 100)) || !Number.isFinite(pagamento) || pagamento <= 0) {
    throw new Error('Valor de pagamento inválido.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query(
      'SELECT id, status, valor_total FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );
    const pedido = pedidos[0];
    if (!pedido) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedido.status)) {
      throw new Error('Não é possível registrar pagamento para este pedido.');
    }

    const [[totais]] = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS pagos,
              COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END), 0) AS reembolsado
       FROM pagamentos WHERE pedido_id = ?`,
      [pedidoId]
    );
    const saldo = Number(pedido.valor_total) - Number(totais.pagos) - Number(totais.reembolsado);
    if (!Number.isFinite(saldo) || pagamento > saldo + 0.001) {
      throw new Error('O pagamento não pode exceder o saldo pendente.');
    }

    const [result] = await conn.query(
      `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao) VALUES (?, ?, ?, ?, ?)`,
      [pedidoId, usuario_id || null, pagamento, forma_pagamento || null, observacao || null]
    );
    await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status, data_ocorrencia)
       VALUES (?, ?, 'Pagamento', ?, ?, 'RESOLVIDO', NOW())`,
      [pedidoId, usuario_id || null, `Pagamento registrado no valor de ${pagamento.toFixed(2)}${forma_pagamento ? ` via ${forma_pagamento}` : ''}`, pagamento]
    );
    await conn.commit();
    try {
      await atualizarStatusAposPagamento(pedidoId);
    } catch (error) {
      console.error('Pagamento registrado, mas falhou a atualização de status:', error);
    }
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function marcarEntregue(pedidoId, dados) {

  const {
    data_entrega,
    responsavel_entrega,
    observacao_entrega,
    usuario_id
  } = dados;

  if (!String(responsavel_entrega || "").trim()) {
    throw new Error("Informe o responsável pela entrega.");
  }
  if (!data_entrega || Number.isNaN(new Date(data_entrega).getTime())) {
    throw new Error("Informe uma data e hora válidas para a entrega.");
  }

  const data = data_entrega
    ? data_entrega.split("T")[0]
    : null;
  const dataHora = data_entrega
    ? data_entrega.replace("T", " ").slice(0, 19)
    : null;


  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query(
      `SELECT id, status, status_documento FROM pedidos WHERE id = ? FOR UPDATE`,
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (pedidos[0].status === 'ENTREGUE') {
      await conn.rollback();
      return pedidos[0];
    }
    if (pedidos[0].status_documento !== 'PEDIDO' ||
        !['CONFIRMADO', 'EM_PREPARO'].includes(pedidos[0].status)) {
      throw new Error('O pedido não pode ser entregue no estado atual.');
    }

    const [itensPedido] = await conn.query(
      `SELECT * FROM pedido_itens WHERE pedido_id = ? FOR UPDATE`,
      [pedidoId]
    );

    for (const item of itensPedido) {
      const produtoId = Number(item.produto_id || 0);
      const quantidade = Number(item.quantidade || 0);
      if ((item.tipo_item || '').toUpperCase() === 'VENDA') continue;
      if (item.combo_id) {
        const [componentes] = await conn.query(
          `SELECT produto_id, quantidade_total
           FROM pedido_item_componentes WHERE pedido_item_id = ? FOR UPDATE`,
          [item.id]
        );
        if (!componentes.length) throw new Error(`Combo do item ${item.id} não possui componentes registrados.`);
        for (const componente of componentes) {
          await confirmarEntregaNaTransacao(conn, {
            produtoId: componente.produto_id,
            quantidade: Number(componente.quantidade_total || 0),
            pedidoId,
            usuarioId: usuario_id || null,
            observacao: `Entrega de componente do combo no pedido ${pedidoId}`
          });
        }
        continue;
      }
      if (!produtoId || quantidade <= 0) continue;
      await confirmarEntregaNaTransacao(conn, {
        produtoId,
        quantidade,
        pedidoId,
        usuarioId: usuario_id || null,
        observacao: `Entrega do pedido ${pedidoId}`
      });
    }

    await conn.query(
      `
      UPDATE pedido_itens
      SET quantidade_entregue = quantidade
      WHERE pedido_id = ?
      `,
      [
        pedidoId
      ]
    );

    const [result] = await conn.query(
      `
      UPDATE pedidos
      SET status='ENTREGUE', data_entrega=?, data_entrega_hora=?, responsavel_entrega=?, observacao_entrega=?
      WHERE id=?
      `,
      [data, dataHora, responsavel_entrega || null, observacao_entrega || null, pedidoId]
    );

    await conn.query(
      `
      INSERT INTO ocorrencias
      (
        pedido_id,
        usuario_id,
        tipo,
        descricao,
        valor,
        status,
        data_ocorrencia
      )
      VALUES (?, ?, 'Entrega', ?, 0, 'RESOLVIDO', NOW())
      `,
      [
        pedidoId,
        usuario_id || null,
        `Pedido entregue por ${responsavel_entrega || "Não informado"}`
      ]
    );

    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registrarDevolucao(pedidoId, dados) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      itens,
      observacao,
      responsavel,
      usuario_id
    } = dados;

    const [pedidos] = await conn.query(
      'SELECT id, status, status_documento FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (pedidos[0].status_documento !== 'PEDIDO' ||
        !['ENTREGUE', 'CONFERENCIA', 'PENDENTE'].includes(pedidos[0].status)) {
      throw new Error('O pedido não está em uma situação que permita devolução.');
    }
    if (!Array.isArray(itens) || !itens.length) throw new Error('Informe itens válidos para devolução.');

    const [devolucaoResult] = await conn.query(
      `INSERT INTO devolucoes (
          pedido_id,
          usuario_id,
          data_devolucao,
          observacao,
          created_at
       )
       VALUES (?, ?, NOW(), ?, NOW())`,
      [
        pedidoId,
        usuario_id || null,
        observacao || null
      ]
    );

    const devolucaoId = devolucaoResult.insertId;

    const itensProcessados = new Set();
    for (const item of itens) {
      const itemId = Number(item.id);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || itensProcessados.has(itemId)) {
        throw new Error('Item inválido ou duplicado na devolução.');
      }
      itensProcessados.add(itemId);

      const [pedidoItemRows] = await conn.query(
        `SELECT id, pedido_id, produto_id, combo_id, tipo_item, quantidade, quantidade_entregue, quantidade_devolvida
         FROM pedido_itens WHERE id = ? AND pedido_id = ? FOR UPDATE`,
        [itemId, pedidoId]
      );
      const pedidoItem = pedidoItemRows[0];
      if (!pedidoItem) throw new Error('O item não pertence a este pedido.');
      if ((pedidoItem.tipo_item || '').toUpperCase() === 'VENDA') {
        throw new Error('Itens de venda não podem ser registrados como devolução de estoque alugado.');
      }

      const produtoId = Number(pedidoItem.produto_id || 0);
      const quantidadeBoa = Number(item.quantidade_boa ?? item.quantidade_devolvida ?? 0);
      const quantidadeDanificada = Number(item.quantidade_danificada ?? 0);
      const quantidadePendente = Number(item.quantidade_faltando ?? item.quantidade_pendente ?? 0);
      const quantidades = [quantidadeBoa, quantidadeDanificada, quantidadePendente];
      if (quantidades.some((quantidade) => !Number.isSafeInteger(quantidade) || quantidade < 0)) {
        throw new Error('As quantidades devolvidas devem ser inteiros não negativos.');
      }
      const quantidadeEntregue = Number(pedidoItem.quantidade_entregue || 0);
      const totalDevolvido = quantidadeBoa + quantidadeDanificada + quantidadePendente;
      const restanteDevolucao = quantidadeEntregue - Number(pedidoItem.quantidade_devolvida || 0);
      if (quantidadeEntregue <= 0 || totalDevolvido <= 0 || totalDevolvido > restanteDevolucao) {
        throw new Error('A devolução excede a quantidade ainda não devolvida.');
      }

      if (pedidoItem.combo_id) {
        await import("../estoque/estoque.service.js").then(({ registrarDevolucaoComponentesNaTransacao }) => registrarDevolucaoComponentesNaTransacao(conn, {
          pedidoItemId: itemId,
          pedidoId,
          quantidadeBoa,
          quantidadeDanificada,
          quantidadePendente,
          usuarioId: usuario_id || null,
          observacao: item.observacao || 'Devolução de componentes de combo'
        }));
        await conn.query(
          `UPDATE pedido_itens SET quantidade_devolvida = quantidade_devolvida + ? WHERE id = ? AND pedido_id = ?`,
          [totalDevolvido, itemId, pedidoId]
        );

        const [componentes] = await conn.query(
          `SELECT produto_id, quantidade_por_unidade
           FROM pedido_item_componentes
           WHERE pedido_item_id = ? FOR UPDATE`,
          [itemId]
        );
        for (const componente of componentes) {
          const fator = Number(componente.quantidade_por_unidade || 1);
          await conn.query(
            `INSERT INTO devolucao_itens
              (devolucao_id, produto_id, quantidade_recebida, quantidade_faltando, quantidade_danificada, observacao)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              devolucaoId,
              componente.produto_id,
              quantidadeBoa * fator,
              quantidadePendente * fator,
              quantidadeDanificada * fator,
              item.observacao || null
            ]
          );
        }
        continue;
      }

      if (!produtoId) throw new Error('Produto inválido no item devolvido.');
      await conn.query(
        `UPDATE pedido_itens SET quantidade_devolvida = quantidade_devolvida + ? WHERE id = ? AND pedido_id = ?`,
        [totalDevolvido, itemId, pedidoId]
      );

      if (quantidadeDanificada > 0) {
        await registrarDevolucaoNaTransacao(conn, {
          produtoId,
          quantidade: quantidadeDanificada,
          tipo: 'DANIFICADA',
          pedidoId,
          usuarioId: usuario_id || null,
          observacao: item.observacao || 'Devolução com dano'
        });
      }

      if (quantidadePendente > 0) {
        await registrarDevolucaoNaTransacao(conn, {
          produtoId,
          quantidade: quantidadePendente,
          tipo: 'PENDENTE',
          pedidoId,
          usuarioId: usuario_id || null,
          observacao: item.observacao || 'Item pendente de devolução'
        });
      }

      if (quantidadeBoa > 0) {
        await registrarDevolucaoNaTransacao(conn, {
          produtoId,
          quantidade: quantidadeBoa,
          tipo: 'BOA',
          pedidoId,
          usuarioId: usuario_id || null,
          observacao: item.observacao || 'Devolução em boas condições'
        });
      }

      await conn.query(
        `INSERT INTO devolucao_itens
          (devolucao_id, produto_id, quantidade_recebida, quantidade_faltando, quantidade_danificada, observacao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          devolucaoId,
          produtoId,
          totalDevolvido,
          quantidadePendente,
          quantidadeDanificada,
          item.observacao || null
        ]
      );
    }

    const [[pedido]] = await conn.query(
      `SELECT
          COALESCE(SUM(CASE WHEN tipo_item <> 'VENDA' THEN quantidade ELSE 0 END),0) AS qtd_total,
          COALESCE(SUM(CASE WHEN tipo_item <> 'VENDA' THEN quantidade_devolvida ELSE 0 END),0) AS qtd_devolvida
       FROM pedido_itens
       WHERE pedido_id = ?`,
      [pedidoId]
    );

    const todosDevolvidos =
      pedido.qtd_total > 0 &&
      pedido.qtd_devolvida >= pedido.qtd_total;

    if (todosDevolvidos) {

      await conn.query(
        `UPDATE pedidos
         SET status='RETIRADO',
             data_retirada=CURDATE(),
             responsavel_retirada=?
         WHERE id=?`,
        [responsavel || null, pedidoId]
      );

      await conn.query(
        `INSERT INTO ocorrencias
          (pedido_id, usuario_id, tipo, descricao, valor, status, data_ocorrencia)
         VALUES (?, ?, 'Devolução', 'Devolução concluída', 0, 'RESOLVIDO', NOW())`,
        [pedidoId, usuario_id || null]
      );

    } else {

      await conn.query(
        `INSERT INTO ocorrencias
          (pedido_id, usuario_id, tipo, descricao, valor, status, data_ocorrencia)
         VALUES (?, ?, 'Devolução', 'Devolução parcial registrada', 0, 'RESOLVIDO', NOW())`,
        [pedidoId, usuario_id || null]
      );
    }

    await conn.commit();
    return devolucaoResult;

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function marcarRetirado(pedidoId, dados) {
  const { responsavel_retirada } = dados;
  const [result] = await db.query(
    `UPDATE pedidos
     SET status = 'RETIRADO', data_retirada = CURDATE(), responsavel_retirada = ?
     WHERE id = ? AND status_documento = 'PEDIDO'
       AND status NOT IN ('CANCELADO', 'FINALIZADO', 'RETIRADO')`,
    [responsavel_retirada || null, pedidoId]
  );
  if (!result.affectedRows) {
    const [rows] = await db.query('SELECT status FROM pedidos WHERE id = ?', [pedidoId]);
    if (!rows.length) throw new Error('Pedido não encontrado.');
    if (rows[0].status === 'RETIRADO') return result;
    throw new Error('O pedido não pode ser marcado como retirado no estado atual.');
  }
  return result;
}

export async function marcarConferencia(id) {
  const [result] = await db.query(
    `UPDATE pedidos SET status = 'CONFERENCIA'
     WHERE id = ? AND status_documento = 'PEDIDO'
       AND status IN ('ENTREGUE', 'RETIRADO', 'PENDENTE')`,
    [id]
  );
  if (result.affectedRows) return result;
  const [rows] = await db.query('SELECT status FROM pedidos WHERE id = ?', [id]);
  if (!rows.length) throw new Error('Pedido não encontrado.');
  if (rows[0].status === 'CONFERENCIA') return result;
  throw new Error('O pedido não pode entrar em conferência no estado atual.');
}

export async function finalizarConferencia(pedidoId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query(
      `SELECT p.id, p.status, p.status_documento, p.valor_total,
         ${valorCreditadoSql} AS valor_pago,
         (SELECT COALESCE(SUM(CASE WHEN tipo_item <> 'VENDA' THEN quantidade ELSE 0 END), 0)
          FROM pedido_itens WHERE pedido_id = p.id) AS qtd_total,
         (SELECT COALESCE(SUM(CASE WHEN tipo_item <> 'VENDA' THEN quantidade_devolvida ELSE 0 END), 0)
          FROM pedido_itens WHERE pedido_id = p.id) AS qtd_devolvida
       FROM pedidos p WHERE p.id = ? FOR UPDATE`,
      [pedidoId]
    );
    const pedido = pedidos[0];
    if (!pedido) throw new Error('Pedido não encontrado.');
    if (pedido.status_documento !== 'PEDIDO' || pedido.status !== 'CONFERENCIA') {
      throw new Error('O pedido não pode finalizar a conferência no estado atual.');
    }

    const pagamentoOK = Number(pedido.valor_pago) >= Number(pedido.valor_total);
    const devolucaoOK = Number(pedido.qtd_total) === Number(pedido.qtd_devolvida);
    const novoStatus = pagamentoOK && devolucaoOK ? 'FINALIZADO' : 'PENDENTE';
    const [result] = await conn.query(
      `UPDATE pedidos SET conferencia_finalizada = 1, status = ? WHERE id = ?`,
      [novoStatus, pedidoId]
    );
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function inserirOcorrencia(pedidoId, dados) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { tipo, descricao, valor, usuario_id } = dados;
    const valorCobrança = Number(valor || 0);
    if (!Number.isFinite(valorCobrança) || valorCobrança < 0 ||
        Math.abs(valorCobrança * 100 - Math.round(valorCobrança * 100)) > 1e-7) {
      throw new Error('Valor da ocorrência inválido.');
    }
    const descricaoFinal = descricao || null;

    const [pedidos] = await conn.query(
      'SELECT id, status FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedidos[0].status)) {
      throw new Error('Não é possível alterar ocorrências deste pedido.');
    }

    const [result] = await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status)
       VALUES (?, ?, ?, ?, ?, 'ABERTO')`,
      [pedidoId, usuario_id || null, tipo || 'Geral', descricaoFinal, valorCobrança]
    );

    if ((tipo || '').toString().toUpperCase() === 'COBRANCA' && valorCobrança > 0) {
      await conn.query(
        `UPDATE pedidos SET valor_total = valor_total + ? WHERE id = ?`,
        [valorCobrança, pedidoId]
      );
    }

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function kpis() {

  const [[ativos]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE status_documento = 'PEDIDO'
      AND status NOT IN ('FINALIZADO','CANCELADO')
  `);

  const [[entregasHoje]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE status_documento = 'PEDIDO'
      AND DATE(data_entrega) = CURDATE()
  `);

  const [[retiradasHoje]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE status_documento = 'PEDIDO'
      AND DATE(data_retirada) = CURDATE()
  `);

  const [[recebido]] = await db.query(`
    SELECT COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END),0) AS total
    FROM pagamentos
  `);

  const [[saldo]] = await db.query(`
    SELECT COALESCE(SUM(GREATEST(
      p.valor_total - ${valorCreditadoSql},
      0
    )), 0) AS total
    FROM pedidos p
    WHERE p.status_documento = 'PEDIDO'
      AND p.status NOT IN ('FINALIZADO','CANCELADO')
  `);

  const [[atrasados]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos p
    WHERE p.status_documento = 'PEDIDO'
    AND p.status NOT IN ('FINALIZADO','CANCELADO')
    AND ${valorCreditadoSql} < p.valor_total
  `);

  return {
    ativos: ativos.total,
    entregasHoje: entregasHoje.total,
    retiradasHoje: retiradasHoje.total,
    recebido: recebido.total,
    saldoDevedor: saldo.total,
    atrasados: atrasados.total
  };
}

export async function inserirReembolso(pedidoId, dados) {
  const { valor, forma_pagamento, observacao, usuario_id } = dados;
  const valorNum = Number(valor || 0);
  if (!Number.isFinite(valorNum) || valorNum <= 0 || !Number.isSafeInteger(Math.round(valorNum * 100))) {
    throw new Error('Valor de reembolso inválido.');
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query(
      'SELECT id, status FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedidos[0].status)) {
      throw new Error('Não é possível reembolsar este pedido no estado atual.');
    }
    const [pagos] = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS pagos,
              COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END), 0) AS reembolsado
       FROM pagamentos WHERE pedido_id = ?`,
      [pedidoId]
    );
    const saldoPago = Number(pagos[0].pagos) - Number(pagos[0].reembolsado);
    if (valorNum > saldoPago) throw new Error('Reembolso não pode exceder o valor efetivamente pago.');

    const [result] = await conn.query(
      `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [pedidoId, usuario_id || null, -valorNum, forma_pagamento || 'TRANSFERENCIA', observacao || null]
    );

    if (result.affectedRows) {
      await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status, data_ocorrencia)
       VALUES (?, ?, 'Reembolso', ?, ?, 'RESOLVIDO', NOW())`,
      [pedidoId, usuario_id || null, `Reembolso de ${Number(valorNum).toFixed(2)}`, valorNum || 0]
      );
    }

    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}