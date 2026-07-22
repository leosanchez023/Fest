import * as model from './orcamentos.model.js';
import db from '../../../database/connection.js';

export async function buscarOrcamentos(query) {
  return await model.buscarOrcamentos(query);
}

export async function converterParaPedido(id) {
  // atualiza status_documento para PEDIDO e também status para CONFIRMADO
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE pedidos SET status_documento = 'PEDIDO', status = 'CONFIRMADO' WHERE id = ?`, [id]);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function excluirOrcamento(id) {
  const [res] = await db.query(`DELETE FROM pedidos WHERE id = ? AND status_documento = 'ORCAMENTO'`, [id]);
  return res.affectedRows > 0;
}

export async function duplicarOrcamento(id) {
  // cria um clone básico (pedido + itens) como novo orçamento
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(`SELECT * FROM pedidos WHERE id = ?`, [id]);
    if (!rows.length) throw new Error('Orçamento não encontrado');
    const origem = rows[0];

    const [ins] = await conn.query(
      `INSERT INTO pedidos (cliente_id, endereco_id, usuario_id, data_pedido, data_evento, data_entrega, data_retirada, telefone_contato, tipo_pedido, status, status_documento, valor_produtos, valor_frete, valor_desconto, valor_total, local_evento, observacoes)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'ORCAMENTO', 'ORCAMENTO', ?, ?, ?, ?, ?, ?)`,
      [origem.cliente_id, origem.endereco_id, origem.usuario_id, origem.data_evento, origem.data_entrega, origem.data_retirada, origem.telefone_contato, origem.tipo_pedido, origem.status, origem.valor_produtos, origem.valor_frete, origem.valor_desconto, origem.valor_total, origem.local_evento, origem.observacoes]
    );

    const novoId = ins.insertId;

    const [itens] = await conn.query(`SELECT produto_id, quantidade, valor_unitario, subtotal FROM pedido_itens WHERE pedido_id = ?`, [id]);
    for (const it of itens) {
      await conn.query(`INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, valor_unitario, subtotal) VALUES (?, ?, ?, ?, ?)`, [novoId, it.produto_id, it.quantidade, it.valor_unitario, it.subtotal]);
    }

    await conn.commit();
    return novoId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
