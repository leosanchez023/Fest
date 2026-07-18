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
      c.nome     AS cliente,
      c.telefone AS telefone,
      COALESCE((
        SELECT SUM(pg.valor)
        FROM pagamentos pg
        WHERE pg.pedido_id = p.id
      ), 0) AS valor_pago
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    WHERE 1=1
  `;
  const params = [];

  // 🔎 Busca por cliente OU número do pedido
  if (search) {
    sql += ` AND (c.nome LIKE ? OR CAST(p.id AS CHAR) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  // 📅 Intervalo (data do evento)
  if (from) { sql += ` AND p.data_evento >= ?`; params.push(from); }
  if (to)   { sql += ` AND p.data_evento <= ?`; params.push(to); }

  // 📌 Status (enum do banco)
  if (status) {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  // 🚚 Entrega
  if (delivery === "Entregue") {
    sql += ` AND p.status IN ('ENTREGUE','RETIRADO','FINALIZADO')`;
  } else if (delivery === "Aguardando Entrega") {
    sql += ` AND p.status IN ('ORCAMENTO','CONFIRMADO','EM_PREPARO')
             AND (p.data_entrega IS NULL OR p.data_entrega >= ?)`;
    params.push(hoje);
  } else if (delivery === "Em Rota") {
    sql += ` AND p.status = 'EM_PREPARO' AND p.data_entrega = ?`;
    params.push(hoje);
  } else if (delivery === "Entrega Atrasada") {
    sql += ` AND p.data_entrega < ?
             AND p.status NOT IN ('ENTREGUE','RETIRADO','FINALIZADO','CANCELADO')`;
    params.push(hoje);
  }

  // 💰 Pagamento (usando HAVING porque depende do SUM)
  // Aplicamos como filtro pós-agregação:
  let having = "";
  if (pay === "Não Pago") {
    having = ` HAVING valor_pago = 0 `;
  } else if (pay === "Parcialmente Pago") {
    having = ` HAVING valor_pago > 0 AND valor_pago < p.valor_total `;
  } else if (pay === "Pago Integralmente") {
    having = ` HAVING valor_pago >= p.valor_total AND p.valor_total > 0 `;
  }

  sql += ` GROUP BY p.id ${having} ORDER BY p.data_evento DESC, p.id DESC`;

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

export async function inserirPagamento(pedidoId, dados) {
  const { valor, forma_pagamento, observacao, usuario_id } = dados;
  const [result] = await db.query(
    `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao) VALUES (?, ?, ?, ?, ?)`,
    [pedidoId, usuario_id || null, valor, forma_pagamento || null, observacao || null]
  );
  return result;
}

export async function marcarEntregue(pedidoId, dados) {
  const { motorista, veiculo, responsavel_entrega } = dados;
  const [result] = await db.query(
    `UPDATE pedidos SET status = 'ENTREGUE', data_entrega = CURDATE(), motorista = ?, veiculo = ?, responsavel_entrega = ? WHERE id = ?`,
    [motorista || null, veiculo || null, responsavel_entrega || null, pedidoId]
  );
  return result;
}

export async function marcarRetirado(pedidoId, dados) {
  const { responsavel_retirada } = dados;
  const [result] = await db.query(
    `UPDATE pedidos SET status = 'RETIRADO', data_retirada = CURDATE(), responsavel_retirada = ? WHERE id = ?`,
    [responsavel_retirada || null, pedidoId]
  );
  return result;
}

export async function finalizarConferencia(pedidoId) {
  const [result] = await db.query(`UPDATE pedidos SET status = 'FINALIZADO' WHERE id = ?`, [pedidoId]);
  return result;
}

export async function inserirOcorrencia(pedidoId, dados) {
  const { tipo, descricao, valor, usuario_id } = dados;
  const [result] = await db.query(
    `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor) VALUES (?, ?, ?, ?, ?)`,
    [pedidoId, usuario_id || null, tipo || 'Geral', descricao || null, valor || 0]
  );
  return result;
}

export async function kpis() {

  const [[ativos]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE status NOT IN ('FINALIZADO','CANCELADO')
  `);

  const [[entregasHoje]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE DATE(data_entrega) = CURDATE()
  `);

  const [[retiradasHoje]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE DATE(data_retirada) = CURDATE()
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
    WHERE p.status NOT IN ('CANCELADO')
  `);

  const [[atrasados]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pedidos p
    WHERE (
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