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
  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: pedidos } = await conn.query(
      `SELECT * FROM pedidos
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    const pedido = pedidos[0];
    if (!pedido || (pedido.status_documento !== 'ORCAMENTO' && pedido.status_documento !== 'PEDIDO')) {
      await client.query('ROLLBACK');
      return false;
    }

    // A committed conversion is a no-op on retries, preventing duplicate stock
    // movements and reservations after a lost response or repeated click.
    if (pedido.status_documento === 'PEDIDO') {
      await client.query('COMMIT');
      return true;
    }
    if (pedido.status === 'CANCELADO') {
      await client.query('ROLLBACK');
      return false;
    }

    const { rows: itens } = await conn.query(
      `SELECT * FROM pedido_itens WHERE pedido_id = $1 FOR UPDATE`,
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
       WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function excluirOrcamento(id) {
  id = validarId(id);
  const res = await db.query(
    `UPDATE pedidos
     SET status = 'CANCELADO'
     WHERE id = $1 AND status_documento = 'ORCAMENTO' AND status <> 'CANCELADO'`,
    [id]
  );
  return res.rowCount > 0;
}

export async function duplicarOrcamento(id) {
  id = validarId(id);
  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: rows } = await conn.query(
      `SELECT * FROM pedidos
       WHERE id = $1 AND status_documento = 'ORCAMENTO' AND status <> 'CANCELADO'
       FOR UPDATE`,
      [id]
    );
    if (!rows.length) throw new Error('Orçamento não encontrado ou indisponível para duplicação.');
    const origem = rows[0];

    const ins = await conn.query(
      `INSERT INTO pedidos (
         cliente_id, endereco_id, usuario_id, data_pedido, data_evento, data_entrega, data_retirada,
         data_entrega_hora, data_retirada_hora, telefone_contato, endereco_origem,
         origem_lat, origem_lon, destino_lat, destino_lon,
         distancia_km, distancia_retorno_km, distancia_cobrada_km, frete_formula,
         origem_aproximada, destino_aproximado, tipo_pedido, status, status_documento,
         valor_produtos, valor_frete, valor_desconto, valor_total, local_evento, observacoes
       ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'ORCAMENTO',
         'ORCAMENTO', $22, $23, $24, $25, $26, $27)
         RETURNING id`,
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

    const novoId = ins.rows[0].id;

    const { rows: itens } = await conn.query(
      `SELECT id, produto_id, combo_id, tipo_item, quantidade, valor_unitario, subtotal
       FROM pedido_itens WHERE pedido_id = $1 FOR UPDATE`,
      [id]
    );
    if (!itens.length) throw new Error('O orçamento precisa ter ao menos um produto para ser duplicado.');

    for (const it of itens) {
      const itemInserido = await conn.query(
        `INSERT INTO pedido_itens
          (pedido_id, produto_id, combo_id, tipo_item, quantidade, valor_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [novoId, it.produto_id, it.combo_id, it.tipo_item, it.quantidade, it.valor_unitario, it.subtotal]
      );

      if (it.combo_id) {
        const { rows: componentes } = await conn.query(
          `SELECT produto_id, quantidade_por_unidade, quantidade_total
           FROM pedido_item_componentes
           WHERE pedido_item_id = $1 FOR UPDATE`,
          [it.id]
        );
        for (const componente of componentes) {
          await conn.query(
            `INSERT INTO pedido_item_componentes
              (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              itemInserido.rows[0].id, novoId, componente.produto_id,
              componente.quantidade_por_unidade, componente.quantidade_total
            ]
          );
        }
      }
    }

    await client.query('COMMIT');
    return novoId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    conn.release();
  }
}
