import * as model from './orcamentos.model.js';
import db from '../../../database/connection.js';
import { reservarItensPedido, reservarComponentesCombos, registrarVendaNaTransacao } from '../estoque/estoque.service.js';

export async function buscarOrcamentos(query) {
  return await model.buscarOrcamentos(query);
}

export async function converterParaPedido(id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [pedidos] = await conn.query(
      `SELECT * FROM pedidos
       WHERE id = ? AND status_documento = 'ORCAMENTO'
       FOR UPDATE`,
      [id]
    );
    const pedido = pedidos[0];
    if (!pedido) {
      await conn.rollback();
      return false;
    }

    const [itens] = await conn.query(
      `SELECT * FROM pedido_itens WHERE pedido_id = ? FOR UPDATE`,
      [id]
    );
    if (!itens.length) throw new Error('O orçamento precisa ter ao menos um produto.');

    const itensVenda = itens.filter((item) => (item.tipo_item || pedido.tipo_pedido || 'ALUGUEL').toUpperCase() === 'VENDA');
    const itensAluguel = itens.filter((item) => (item.tipo_item || pedido.tipo_pedido || 'ALUGUEL').toUpperCase() !== 'VENDA');

    for (const item of itensVenda) {
      await registrarVendaNaTransacao(conn, {
        produtoId: item.produto_id,
        quantidade: Number(item.quantidade),
        pedidoId: id,
        usuarioId: pedido.usuario_id,
        observacao: 'Venda confirmada na conversão do orçamento'
      });
    }

    await reservarItensPedido({
      conn,
      itens: itensAluguel.filter((item) => !item.combo_id),
      pedidoId: id,
      usuarioId: pedido.usuario_id
    });
    await reservarComponentesCombos({
      conn,
      itens: itensAluguel,
      pedidoId: id,
      usuarioId: pedido.usuario_id
    });

    await conn.query(
      `UPDATE pedidos
       SET status_documento = 'PEDIDO', status = 'CONFIRMADO'
       WHERE id = ?`,
      [id]
    );
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
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
      [origem.cliente_id, origem.endereco_id, origem.usuario_id, origem.data_evento, origem.data_entrega, origem.data_retirada, origem.telefone_contato, origem.tipo_pedido, origem.valor_produtos, origem.valor_frete, origem.valor_desconto, origem.valor_total, origem.local_evento, origem.observacoes]
    );

    const novoId = ins.insertId;

    const [itens] = await conn.query(`SELECT produto_id, combo_id, tipo_item, quantidade, valor_unitario, subtotal FROM pedido_itens WHERE pedido_id = ?`, [id]);
    for (const it of itens) {
      await conn.query(`INSERT INTO pedido_itens (pedido_id, produto_id, combo_id, tipo_item, quantidade, valor_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`, [novoId, it.produto_id, it.combo_id, it.tipo_item, it.quantidade, it.valor_unitario, it.subtotal]);
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
