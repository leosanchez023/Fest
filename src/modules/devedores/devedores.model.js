import db from "../../../database/connection.js";

function buildFilters({ client = "", overdue = "all", periodFrom = null } = {}) {
  const where = [
    "p.status_documento = 'PEDIDO'",
    "p.status <> 'CANCELADO'",
    "p.valor_total > 0"
  ];
  const params = [];

  if (client) {
    where.push("c.nome LIKE ?");
    params.push(`%${client}%`);
  }

  if (periodFrom) {
    where.push("COALESCE(p.data_evento, DATE(p.data_pedido)) >= ?");
    params.push(periodFrom);
  }

  const minimumOverdue = Number(overdue);
  if (Number.isInteger(minimumOverdue) && minimumOverdue > 0) {
    where.push("p.data_evento IS NOT NULL AND p.data_evento < CURDATE()");
    where.push("DATEDIFF(CURDATE(), p.data_evento) >= ?");
    params.push(minimumOverdue);
  }

  return { where: where.join(" AND "), params };
}

const debtorSelect = `
  SELECT
    p.id AS pedido_id,
    p.cliente_id,
    c.nome AS cliente_nome,
    c.telefone,
    p.tipo_pedido,
    p.data_evento,
    DATE(p.data_pedido) AS data_pedido,
    p.valor_total,
    COALESCE(SUM(pg.valor), 0) AS total_pago,
    p.valor_total - COALESCE(SUM(pg.valor), 0) AS saldo_pendente,
    CASE
      WHEN p.data_evento IS NOT NULL AND p.data_evento < CURDATE()
      THEN DATEDIFF(CURDATE(), p.data_evento)
      ELSE 0
    END AS dias_em_atraso,
    p.status
  FROM pedidos p
  INNER JOIN cliente c ON c.id = p.cliente_id
  LEFT JOIN pagamentos pg ON pg.pedido_id = p.id
  WHERE {{where}}
  GROUP BY p.id, p.cliente_id, c.nome, c.telefone, p.tipo_pedido,
           p.data_evento, p.data_pedido, p.valor_total, p.status
  HAVING saldo_pendente > 0
`;

export async function listarDevedores(filtros) {
  const { where, params } = buildFilters(filtros);
  const [rows] = await db.query(
    `${debtorSelect.replace("{{where}}", where)} ORDER BY dias_em_atraso DESC, saldo_pendente DESC, c.nome ASC`,
    params
  );
  return rows;
}

export async function resumoDevedores(filtros) {
  const { where, params } = buildFilters(filtros);
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS total_pedidos,
       COUNT(DISTINCT cliente_id) AS total_clientes,
       COALESCE(SUM(saldo_pendente), 0) AS valor_em_aberto,
       SUM(dias_em_atraso > 0) AS pedidos_em_atraso,
       COALESCE(SUM(CASE WHEN dias_em_atraso > 0 THEN saldo_pendente ELSE 0 END), 0) AS valor_vencido
     FROM (${debtorSelect.replace("{{where}}", where)}) devedores`,
    params
  );
  return rows[0] || {};
}
