import * as model from './orcamentos.model.js';
import db from '../../../database/connection.js';
import { reservarItensPedidoComCombos, registrarVendaItensPedidoNaTransacao } from '../estoque/estoque.service.js';

export async function buscarOrcamentos(query) {
  return await model.buscarOrcamentos(query);
}

function validarId(id) {
  const valor = Number(id);
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new Error('Orçamento inválido.');
  }
  return valor;
}

export async function converterParaPedido(id) {
  id = validarId(id);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [pedidos] = await conn.query(
      `SELECT * FROM pedidos
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );
    const pedido = pedidos[0];
    if (!pedido || (pedido.status_documento !== 'ORCAMENTO' && pedido.status_documento !== 'PEDIDO')) {
      await conn.rollback();
      return false;
    }

    // A committed conversion is a no-op on retries, preventing duplicate stock
    // movements and reservations after a lost response or repeated click.
    if (pedido.status_documento === 'PEDIDO') {
      await conn.commit();
      return true;
    }
    if (pedido.status === 'CANCELADO') {
      await conn.rollback();
      return false;
    }

    const [itens] = await conn.query(
      `SELECT * FROM pedido_itens WHERE pedido_id = ? FOR UPDATE`,
      [id]
    );
    if (!itens.length) throw new Error('O orçamento precisa ter ao menos um produto.');

    const itensAluguel = itens.filter((item) => (item.tipo_item || pedido.tipo_pedido || 'ALUGUEL').toUpperCase() !== 'VENDA');

    await registrarVendaItensPedidoNaTransacao(conn, {
      itens,
      pedidoId: id,
      usuarioId: pedido.usuario_id,
      observacao: 'Venda confirmada na conversão do orçamento'
    });
    await reservarItensPedidoComCombos({
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
  id = validarId(id);
  const [res] = await db.query(
    `UPDATE pedidos
     SET status = 'CANCELADO'
     WHERE id = ? AND status_documento = 'ORCAMENTO' AND status <> 'CANCELADO'`,
    [id]
  );
  return res.affectedRows > 0;
}

export async function duplicarOrcamento(id) {
  id = validarId(id);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM pedidos
       WHERE id = ? AND status_documento = 'ORCAMENTO' AND status <> 'CANCELADO'
       FOR UPDATE`,
      [id]
    );
    if (!rows.length) throw new Error('Orçamento não encontrado ou indisponível para duplicação.');
    const origem = rows[0];

    const [ins] = await conn.query(
      `INSERT INTO pedidos (
         cliente_id, endereco_id, usuario_id, data_pedido, data_evento, data_entrega, data_retirada,
         data_entrega_hora, data_retirada_hora, telefone_contato, endereco_origem,
         origem_lat, origem_lon, destino_lat, destino_lon,
         distancia_km, distancia_retorno_km, distancia_cobrada_km, frete_formula,
         origem_aproximada, destino_aproximado, tipo_pedido, status, status_documento,
         valor_produtos, valor_frete, valor_desconto, valor_total, local_evento, observacoes
       ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORCAMENTO',
         'ORCAMENTO', ?, ?, ?, ?, ?, ?)`,
      [
        origem.cliente_id, origem.endereco_id, origem.usuario_id, origem.data_evento,
        origem.data_entrega, origem.data_retirada, origem.data_entrega_hora, origem.data_retirada_hora,
        origem.telefone_contato, origem.endereco_origem,
        origem.origem_lat, origem.origem_lon, origem.destino_lat, origem.destino_lon,
        origem.distancia_km, origem.distancia_retorno_km, origem.distancia_cobrada_km,
        origem.frete_formula, origem.origem_aproximada, origem.destino_aproximado,
        origem.tipo_pedido, origem.valor_produtos, origem.valor_frete, origem.valor_desconto,
        origem.valor_total, origem.local_evento, origem.observacoes
      ]
    );

    const novoId = ins.insertId;

    const [itens] = await conn.query(
      `SELECT id, produto_id, combo_id, tipo_item, quantidade, valor_unitario, subtotal
       FROM pedido_itens WHERE pedido_id = ? FOR UPDATE`,
      [id]
    );
    if (!itens.length) throw new Error('O orçamento precisa ter ao menos um produto para ser duplicado.');

    for (const it of itens) {
      const [itemInserido] = await conn.query(
        `INSERT INTO pedido_itens
          (pedido_id, produto_id, combo_id, tipo_item, quantidade, valor_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [novoId, it.produto_id, it.combo_id, it.tipo_item, it.quantidade, it.valor_unitario, it.subtotal]
      );

      if (it.combo_id) {
        const [componentes] = await conn.query(
          `SELECT produto_id, quantidade_por_unidade, quantidade_total
           FROM pedido_item_componentes
           WHERE pedido_item_id = ? FOR UPDATE`,
          [it.id]
        );
        for (const componente of componentes) {
          await conn.query(
            `INSERT INTO pedido_item_componentes
              (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
             VALUES (?, ?, ?, ?, ?)`,
            [
              itemInserido.insertId, novoId, componente.produto_id,
              componente.quantidade_por_unidade, componente.quantidade_total
            ]
          );
        }
      }
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
