import db from '../../../database/connection.js';

export async function buscarOrcamentos(query) {
  const where = `WHERE p.status_documento = 'ORCAMENTO'`;

  const [rows] = await db.query(
    `SELECT p.*, c.nome as cliente,
      (SELECT COALESCE(SUM(valor),0) FROM pagamentos WHERE pedido_id = p.id) as valor_pago
     FROM pedidos p
     LEFT JOIN cliente c ON c.id = p.cliente_id
     ${where}
     ORDER BY p.data_pedido DESC
    `
  );

  return rows;
}
