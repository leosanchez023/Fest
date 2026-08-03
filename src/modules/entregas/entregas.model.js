import db from "../../../database/connection.js";

export async function buscarPedidos({ search, from, to, status, pay, delivery }) {
  const hoje = new Date().toISOString().split("T")[0];

  let sql = `
    SELECT
      p.id,
      p.status,
      p.data_evento,
      p.data_entrega,
      p.data_retirada,
      p.valor_total,
      c.nome AS cliente,
      c.telefone AS telefone,
      COALESCE((
        SELECT SUM(pg.valor)
        FROM pagamentos pg
        WHERE pg.pedido_id = p.id
      ), 0) AS valor_pago
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    WHERE p.status_documento = 'PEDIDO'
  `;

  const params = [];

  // 🔎 Busca por cliente ou número do pedido
  if (search) {
    sql += ` AND (c.nome LIKE ? OR CAST(p.id AS CHAR) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  // 📅 Intervalo de datas
  if (from) {
    sql += ` AND p.data_evento >= ?`;
    params.push(from);
  }

  if (to) {
    sql += ` AND p.data_evento <= ?`;
    params.push(to);
  }

  // 📌 Status
  if (status) {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  // 🚚 Filtro de entrega
  if (delivery === "Aguardando Entrega") {

    sql += `
      AND p.status IN ('ORCAMENTO','CONFIRMADO')
      AND (p.data_entrega IS NULL OR p.data_entrega >= ?)
    `;
    params.push(hoje);

  } else if (delivery === "Entregue") {

    sql += `
      AND p.status IN ('ENTREGUE','RETIRADO','CONFERENCIA','PENDENTE','FINALIZADO')
    `;

  } else if (delivery === "Entrega Atrasada") {

    sql += `
      AND p.data_entrega < ?
      AND p.status NOT IN (
        'ENTREGUE',
        'RETIRADO',
        'CONFERENCIA',
        'PENDENTE',
        'FINALIZADO',
        'CANCELADO'
      )
    `;
    params.push(hoje);

  }

  // 💰 Pagamento
  let having = "";

  if (pay === "Não Pago") {
    having = `HAVING valor_pago = 0`;

  } else if (pay === "Parcialmente Pago") {
    having = `HAVING valor_pago > 0 AND valor_pago < p.valor_total`;

  } else if (pay === "Pago Integralmente") {
    having = `HAVING valor_pago >= p.valor_total AND p.valor_total > 0`;
  }

  sql += `
    GROUP BY p.id
    ${having}
    ORDER BY p.data_evento DESC, p.id DESC
  `;

  const [rows] = await db.query(sql, params);
  return rows;
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
      COALESCE((SELECT SUM(valor) FROM pagamentos WHERE pedido_id = p.id), 0) AS valor_pago
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    LEFT JOIN endereco e ON e.id = p.endereco_id
    WHERE p.id = ?
  `, [id]);
  return rows[0] || null;
}

export async function itensDoPedido(pedidoId) {
  const [rows] = await db.query(`
    SELECT pi.*, pr.nome AS produto_nome
    FROM pedido_itens pi
    LEFT JOIN produtos pr ON pr.id = pi.produto_id
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
        COALESCE(
            (SELECT SUM(valor)
             FROM pagamentos
             WHERE pedido_id = p.id),
            0
        ) AS valor_pago,
        COALESCE(
            (SELECT SUM(quantidade)
             FROM pedido_itens
             WHERE pedido_id = p.id),
            0
        ) AS qtd_total,
        COALESCE(
            (SELECT SUM(quantidade_devolvida)
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
  const [result] = await db.query(
    `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao) VALUES (?, ?, ?, ?, ?)`,
    [pedidoId, usuario_id || null, valor, forma_pagamento || null, observacao || null]
  );
  await atualizarStatusAposPagamento(pedidoId);

  if (result.affectedRows) {
    await db.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status, data_ocorrencia)
       VALUES (?, ?, 'Pagamento', ?, ?, 'RESOLVIDO', NOW())`,
      [pedidoId, usuario_id || null, `Pagamento registrado no valor de ${Number(valor || 0).toFixed(2)}${forma_pagamento ? ` via ${forma_pagamento}` : ''}`, valor || 0]
    );
  }

  return result;
}

export async function marcarEntregue(pedidoId, dados) {

  const {
    data_entrega,
    responsavel_entrega,
    observacao_entrega,
    usuario_id
  } = dados;


  const data = data_entrega
    ? data_entrega.split("T")[0]
    : null;


  const [result] = await db.query(
    `
    UPDATE pedidos
    SET
        status='ENTREGUE',
        data_entrega=?,
        data_entrega_hora=?,
        responsavel_entrega=?,
        observacao_entrega=?
    WHERE id=?
    `,
    [
      data,
      data_entrega || null,
      responsavel_entrega || null,
      observacao_entrega || null,
      pedidoId
    ]
  );


  if (result.affectedRows) {

    await db.query(
      `
      UPDATE pedido_itens
      SET quantidade_entregue = quantidade
      WHERE pedido_id = ?
      `,
      [
        pedidoId
      ]
    );


    await db.query(
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

  }


  return result;
}

export async function registrarDevolucao(pedidoId, dados) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {

    const {
      itens,
      observacao,
      responsavel,
      usuario_id
    } = dados;

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

    for (const item of itens) {
      const produtoId = Number(item.produto_id || item.id || 0);
      const quantidade = Number(item.quantidade_devolvida || 0);

      if (!produtoId || quantidade <= 0) continue;

      const [pedidoItemRows] = await conn.query(
        `SELECT quantidade, quantidade_devolvida
         FROM pedido_itens
         WHERE pedido_id = ? AND produto_id = ?
         LIMIT 1`,
        [pedidoId, produtoId]
      );

      const pedidoItem = pedidoItemRows[0];
      if (!pedidoItem) continue;

      const novaDevolvida =
        Number(pedidoItem.quantidade_devolvida || 0) + quantidade;

      const pendente = Math.max(
        0,
        Number(pedidoItem.quantidade || 0) - novaDevolvida
      );

      await conn.query(
        `UPDATE pedido_itens
         SET quantidade_devolvida = ?
         WHERE pedido_id = ? AND produto_id = ?`,
        [novaDevolvida, pedidoId, produtoId]
      );

      await conn.query(
        `INSERT INTO devolucao_itens
          (devolucao_id, produto_id, quantidade_recebida, quantidade_faltando, observacao)
         VALUES (?, ?, ?, ?, ?)`,
        [
          devolucaoId,
          produtoId,
          quantidade,
          pendente,
          item.observacao || null
        ]
      );
    }

    const [[pedido]] = await conn.query(
      `SELECT
          COALESCE(SUM(quantidade),0) AS qtd_total,
          COALESCE(SUM(quantidade_devolvida),0) AS qtd_devolvida
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
    `UPDATE pedidos SET status = 'RETIRADO', data_retirada = CURDATE(), responsavel_retirada = ? WHERE id = ?`,
    [responsavel_retirada || null, pedidoId]
  );
  return result;
}

export async function marcarConferencia(id) {
  await db.query(
    `
    UPDATE pedidos
    SET status = 'CONFERENCIA'
    WHERE id = ?
    `,
    [id]
  );
}

export async function finalizarConferencia(pedidoId) {

  const [[pedido]] = await db.query(`
    SELECT
      p.valor_total,
      COALESCE((SELECT SUM(valor)
                FROM pagamentos
                WHERE pedido_id = p.id),0) AS valor_pago,

      COALESCE((SELECT SUM(quantidade)
                FROM pedido_itens
                WHERE pedido_id = p.id),0) AS qtd_total,

      COALESCE((SELECT SUM(quantidade_devolvida)
                FROM pedido_itens
                WHERE pedido_id = p.id),0) AS qtd_devolvida

    FROM pedidos p
    WHERE p.id = ?
  `,[pedidoId]);

  if (!pedido) return null;

  const pagamentoOK =
    Number(pedido.valor_pago) >= Number(pedido.valor_total);

  const devolucaoOK =
    Number(pedido.qtd_total) === Number(pedido.qtd_devolvida);

  const novoStatus =
    pagamentoOK && devolucaoOK
      ? "FINALIZADO"
      : "PENDENTE";

  return await db.query(
    `UPDATE pedidos
     SET conferencia_finalizada = 1,
         status = ?
     WHERE id = ?`,
    [novoStatus, pedidoId]
  );
}

export async function inserirOcorrencia(pedidoId, dados) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const { tipo, descricao, valor, usuario_id } = dados;
    const valorCobrança = Number(valor || 0);
    const descricaoFinal = descricao || null;

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
    SELECT COALESCE(SUM(valor),0) AS total
    FROM pagamentos
  `);

  const [[saldo]] = await db.query(`
    SELECT COALESCE(SUM(
      p.valor_total - COALESCE((SELECT SUM(valor) FROM pagamentos pg WHERE pg.pedido_id = p.id), 0)
    ), 0) AS total
    FROM pedidos p
    WHERE p.status_documento = 'PEDIDO'
      AND p.status NOT IN ('CANCELADO')
  `);

  const [[atrasados]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos p
    WHERE p.status_documento = 'PEDIDO'
      AND (
        SELECT COALESCE(SUM(pg.valor),0)
        FROM pagamentos pg
        WHERE pg.pedido_id = p.id
      ) < p.valor_total
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