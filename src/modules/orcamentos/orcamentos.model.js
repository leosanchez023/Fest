import db from '../../../database/connection.js';

export async function buscarOrcamentos(query) {
  const termo = String(query?.search || query?.q || '').trim();
  const where = `WHERE p.status_documento = 'ORCAMENTO'
    AND p.status <> 'CANCELADO'
    ${termo ? 'AND (c.nome ILIKE $1 OR c.telefone ILIKE $2 OR CAST(p.id AS TEXT) ILIKE $3)' : ''}`;
  const params = termo ? [`%${termo}%`, `%${termo}%`, `%${termo}%`] : [];

  const { rows: rows } = await db.query(
    `SELECT p.*, c.nome as cliente,
      (SELECT COALESCE(SUM(valor),0) FROM pagamentos WHERE pedido_id = p.id) as valor_pago
     FROM pedidos p
     LEFT JOIN cliente c ON c.id = p.cliente_id
     ${where}
     ORDER BY p.data_pedido DESC
    `,
    params
  );

  return rows;
}
