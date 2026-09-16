import db from "../../../database/connection.js";
import {
  reservarItensPedidoComCombos,
  registrarVendaItensPedidoNaTransacao,
  ajustarReservasPedidoNaTransacao,
  liberarReservasPedidoNaTransacao
} from "../estoque/estoque.service.js";

// ---------------- CLIENTES ----------------
export async function buscarClientes(termo) {
  const [rows] = await db.query(
    `
    SELECT id, nome, email, telefone, cpf
    FROM cliente
    WHERE
      nome LIKE ?
      OR cpf LIKE ?
      OR telefone LIKE ?
      OR email LIKE ?
    ORDER BY nome
    LIMIT 10
    `,
    [
      `%${termo}%`,
      `%${termo}%`,
      `%${termo}%`,
      `%${termo}%`
    ]
  );

  return rows;
}

export async function criarCliente(cliente) {
  const [enderecoResult] = await db.query(
    `
    INSERT INTO endereco (rua, numero, cidade, estado)
    VALUES (?, ?, ?, ?)
    `,
    [
      cliente.rua || null,
      cliente.numero || null,
      cliente.cidade || null,
      cliente.estado || null
    ]
  );

  const idEndereco = enderecoResult.insertId;

  const [clienteResult] = await db.query(
    `
    INSERT INTO cliente (
      nome, email, telefone, cpf, nascimento, id_endereco
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      cliente.nome,
      cliente.email,
      cliente.telefone,
      cliente.cpf,
      cliente.nascimento || null,
      idEndereco
    ]
  );

  return {
    id: clienteResult.insertId,
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone,
    cpf: cliente.cpf,
    nascimento: cliente.nascimento,
    id_endereco: idEndereco
  };
}

// ---------------- PRODUTOS ----------------
export async function buscarProdutos(termo) {
  const [rows] = await db.query(
    `
    SELECT id, nome, preco_venda
    FROM produtos
    WHERE nome LIKE ?
    ORDER BY nome
    LIMIT 20
    `,
    [`%${termo}%`]
  );

  return rows;
}

export async function buscarItens(termo) {
  const busca = `%${String(termo || "").trim()}%`;
  const [rows] = await db.query(
    `SELECT id, nome, preco_venda, preco_aluguel, 'PRODUTO' AS origem
     FROM produtos
     WHERE ativo = 1 AND (nome LIKE ? OR codigo LIKE ?)
     UNION ALL
     SELECT id, nome, preco_venda, preco_aluguel, 'COMBO' AS origem
     FROM combos
     WHERE ativo = 1 AND (nome LIKE ? OR codigo LIKE ?)
     ORDER BY nome
     LIMIT 30`,
    [busca, busca, busca, busca]
  );
  return rows;
}

export async function buscarProdutoPorId(id) {
  const [rows] = await db.query(
    `
    SELECT id, nome, preco_venda, estoque
    FROM produtos
    WHERE id = ?
    `,
    [id]
  );

  return rows[0];
}

export async function buscarComboPorId(id) {
  const [rows] = await db.query(
    `SELECT c.id, c.nome, c.preco_venda, c.preco_aluguel, c.ativo,
            COUNT(ci.id) AS total_componentes
     FROM combos c
     LEFT JOIN combo_itens ci ON ci.combo_id = c.id
     WHERE c.id = ?
     GROUP BY c.id`,
    [id]
  );
  return rows[0] || null;
}

// ---------------- PEDIDOS ----------------
export async function criarPedido(dados) {
  const conn = await db.getConnection();

  await conn.beginTransaction();

  try {
    const [pedido] = await conn.query(
      `
      INSERT INTO pedidos (
      cliente_id,
      endereco_id,
      data_evento,
      data_entrega,
      data_retirada,
      telefone_contato,
      tipo_pedido,
      status,
      status_documento,
      valor_produtos,
      valor_frete,
      valor_desconto,
      valor_total,
      observacoes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
      dados.cliente_id,
      dados.endereco_id || null,
      dados.data_evento,
      dados.data_entrega,
      dados.data_retirada,
      dados.telefone_contato,
      dados.tipo_pedido || "ALUGUEL",
      dados.status || "ORCAMENTO",
      dados.status_documento || (dados.status === 'CONFIRMADO' ? 'PEDIDO' : 'ORCAMENTO'),
      dados.valor_produtos,
      dados.valor_frete,
      dados.valor_desconto,
      dados.valor_total,
      dados.observacoes || null
    ]
    );

    const pedidoId = pedido.insertId;

    const itensPedido = Array.isArray(dados.itens) ? dados.itens : [];

    for (const item of itensPedido) {
      const [itemResult] = await conn.query(
        `
        INSERT INTO pedido_itens (
          pedido_id,
          produto_id,
          tipo_item,
          combo_id,
          quantidade,
          valor_unitario,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pedidoId,
          item.produto_id,
          (item.tipo_item || dados.tipo_pedido || 'ALUGUEL').toUpperCase() === 'VENDA' ? 'VENDA' : 'ALUGUEL',
          item.combo_id || null,
          item.quantidade,
          item.preco_unitario,
          item.subtotal
        ]
      );
        item.pedido_item_id = itemResult.insertId;
    }

    if ((dados.status || '').toUpperCase() === 'CONFIRMADO' || (dados.status || '').toUpperCase() === 'PEDIDO') {
      const itensAluguel = itensPedido.filter((item) => (item.tipo_item || dados.tipo_pedido || 'ALUGUEL').toUpperCase() !== 'VENDA');

      await registrarVendaItensPedidoNaTransacao(conn, {
        itens: itensPedido,
        pedidoId,
        usuarioId: dados.usuario_id || null
      });
      await reservarItensPedidoComCombos({
        conn,
        itens: itensAluguel,
        pedidoId,
        usuarioId: dados.usuario_id || null
      });
    }

    if ((dados.valor_pago || 0) > 0) {
      await conn.query(
        `
        INSERT INTO pagamentos (
          pedido_id,
          valor,
          forma_pagamento,
          observacao
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          pedidoId,
          dados.valor_pago,
          dados.forma_pagamento,
          dados.observacao_pagamento || null
        ]
      );
    }

    await conn.commit();

    return {
      sucesso: true,
      pedidoId
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
export async function atualizarStatusDocumento(pedidoId, novoStatusDocumento) {
  const [res] = await db.query(
    `UPDATE pedidos SET status_documento = ? WHERE id = ?`,
    [novoStatusDocumento, pedidoId]
  );
  return res.affectedRows > 0;
}
export async function buscarEnderecos(f) {
  const filtros = [];
  const params = [];

  if (f.rua) {
    filtros.push("e.rua LIKE ?");
    params.push(`%${f.rua.trim()}%`);
  }

  if (f.numero) {
    filtros.push("e.numero = ?");
    params.push(f.numero.trim());
  }

  if (f.bairro) {
    filtros.push("e.bairro LIKE ?");
    params.push(`%${f.bairro.trim()}%`);
  }

  if (f.cidade) {
    filtros.push("e.cidade LIKE ?");
    params.push(`%${f.cidade.trim()}%`);
  }

  if (f.referencia) {
    filtros.push("e.referencia LIKE ?");
    params.push(`%${f.referencia.trim()}%`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const [rows] = await db.query(
    `
    SELECT DISTINCT
      e.id,
      e.rua,
      e.numero,
      e.bairro,
      e.cidade,
      e.estado,
      e.referencia
    FROM endereco e
    ${where}
    ORDER BY e.rua
    LIMIT 10
    `,
    params
  );

  return rows;
}
export async function criarEndereco(dados) {
  const rua = dados.rua?.trim();
  const numero = dados.numero?.trim();
  const bairro = dados.bairro?.trim();
  const cidade = dados.cidade?.trim();
  const estado = dados.estado?.trim();
  const referencia = dados.referencia?.trim();

  const [existe] = await db.query(
    `SELECT id FROM endereco
     WHERE rua = ? AND numero = ? AND cidade = ? AND estado = ? AND referencia <=> ?
     LIMIT 1`,
    [rua, numero, cidade, estado, referencia || null]
  );

  if (existe.length) {
    return { id: existe[0].id, existente: true };
  }

  const [result] = await db.query(
    `INSERT INTO endereco (rua, numero, bairro, cidade, estado, referencia)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rua, numero, bairro, cidade, estado, referencia || null]
  );

  return { id: result.insertId, criado: true };
}
export async function buscarPedidoPorId(id) {
  const [rows] = await db.query(
    `SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email, c.cpf as cliente_cpf,
            e.rua as endereco_rua, e.numero as endereco_numero, e.bairro as endereco_bairro, e.cidade as endereco_cidade, e.estado as endereco_estado, e.referencia as endereco_referencia
     FROM pedidos p
     LEFT JOIN cliente c ON c.id = p.cliente_id
     LEFT JOIN endereco e ON e.id = p.endereco_id
     WHERE p.id = ?
    `,
    [id]
  );

  if (!rows.length) return null;

  const pedido = rows[0];

  const [itens] = await db.query(
    `SELECT pi.*, pr.nome as produto_nome, c.nome as combo_nome FROM pedido_itens pi
     LEFT JOIN produtos pr ON pr.id = pi.produto_id
     LEFT JOIN combos c ON c.id = pi.combo_id
     WHERE pi.pedido_id = ?`,
    [id]
  );

  const [pagamentos] = await db.query(`SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY data_pagamento DESC`, [id]);

  // montar objeto com endereco aninhado
  pedido.endereco = {
    id: pedido.endereco_id || null,
    rua: pedido.endereco_rua || null,
    numero: pedido.endereco_numero || null,
    bairro: pedido.endereco_bairro || null,
    cidade: pedido.endereco_cidade || null,
    estado: pedido.endereco_estado || null,
    referencia: pedido.endereco_referencia || null
  };

  return {
    pedido,
    itens,
    pagamentos
  };
}

export async function atualizarPedido(id, dados) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [pedidoRows] = await conn.query(
      `SELECT id, status, status_documento, tipo_pedido
       FROM pedidos WHERE id = ? FOR UPDATE`,
      [id]
    );
    const pedidoAtual = pedidoRows[0];
    if (!pedidoAtual) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'ENTREGUE', 'RETIRADO'].includes(pedidoAtual.status)) {
      throw new Error('Pedido entregue, retirado ou cancelado não pode ser editado.');
    }

    await conn.query(
      `UPDATE pedidos SET
         cliente_id = ?, endereco_id = ?, data_evento = ?, data_entrega = ?, data_retirada = ?, telefone_contato = ?, tipo_pedido = ?, observacoes = ?
       WHERE id = ?`,
      [
        dados.cliente_id,
        dados.endereco_id || null,
        dados.data_evento || null,
        dados.data_entrega || null,
        dados.data_retirada || null,
        dados.telefone_contato || null,
        dados.tipo_pedido || 'ALUGUEL',
        dados.observacoes || null,
        id
      ]
    );

    const novos = Array.isArray(dados.itens) ? dados.itens : [];
    if (!novos.length) throw new Error('Pedido sem itens.');
    const vistos = new Set();
    const itensNormalizados = [];

    for (const item of novos) {
      const comboId = item.combo_id ? Number(item.combo_id) : null;
      const produtoId = item.produto_id ? Number(item.produto_id) : null;
      const quantidade = Number(item.quantidade || 0);
      if (quantidade <= 0) throw new Error('Quantidade deve ser maior que zero.');
      if ((comboId && produtoId) || (!comboId && !produtoId)) throw new Error('Cada item deve ser produto ou combo.');

      const chave = `${comboId ? 'c' : 'p'}:${comboId || produtoId}`;
      if (vistos.has(chave)) throw new Error('Não é permitido repetir o mesmo produto ou combo.');
      vistos.add(chave);

      if (comboId) {
        const [combos] = await conn.query(`SELECT id, ativo FROM combos WHERE id = ? FOR UPDATE`, [comboId]);
        if (!combos.length || Number(combos[0].ativo) !== 1) throw new Error('Combo inexistente ou inativo.');
      } else {
        const [produtos] = await conn.query(`SELECT id, ativo FROM produtos WHERE id = ? FOR UPDATE`, [produtoId]);
        if (!produtos.length || Number(produtos[0].ativo) !== 1) throw new Error('Produto inexistente ou inativo.');
      }

      const preco = Number(item.preco_unitario ?? item.preco ?? 0);
      itensNormalizados.push({
        produto_id: produtoId,
        combo_id: comboId,
        tipo_item: (item.tipo_item || dados.tipo_pedido || pedidoAtual.tipo_pedido || 'ALUGUEL').toUpperCase() === 'VENDA' ? 'VENDA' : 'ALUGUEL',
        quantidade,
        preco,
        subtotal: preco * quantidade
      });
    }

    await conn.query(`DELETE FROM pedido_itens WHERE pedido_id = ?`, [id]);
    for (const item of itensNormalizados) {
      const [inserted] = await conn.query(
        `INSERT INTO pedido_itens
          (pedido_id, produto_id, tipo_item, combo_id, quantidade, valor_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, item.produto_id, item.tipo_item, item.combo_id, item.quantidade, item.preco, item.subtotal]
      );

      if (item.combo_id) {
        const [componentes] = await conn.query(
          `SELECT produto_id, quantidade FROM combo_itens WHERE combo_id = ? FOR UPDATE`,
          [item.combo_id]
        );
        if (!componentes.length) throw new Error('Combo sem componentes.');
        for (const componente of componentes) {
          await conn.query(
            `INSERT INTO pedido_item_componentes
              (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
             VALUES (?, ?, ?, ?, ?)`,
            [inserted.insertId, id, componente.produto_id, componente.quantidade, Number(componente.quantidade) * item.quantidade]
          );
        }
      }
    }

    if (pedidoAtual.status_documento === 'PEDIDO' && pedidoAtual.status !== 'ORCAMENTO') {
      await ajustarReservasPedidoNaTransacao(conn, {
        pedidoId: id,
        itens: itensNormalizados,
        usuarioId: dados.usuario_id || null,
        observacao: 'Ajuste de itens do pedido'
      });
    }

    const [somaRows] = await conn.query(`SELECT COALESCE(SUM(subtotal), 0) AS valor_produtos FROM pedido_itens WHERE pedido_id = ?`, [id]);
    const valorProdutos = Number(somaRows[0].valor_produtos || 0);
    const valorFrete = Number(dados.valor_frete || 0);
    const valorDesconto = Number(dados.valor_desconto || 0);
    await conn.query(
      `UPDATE pedidos SET valor_produtos = ?, valor_frete = ?, valor_desconto = ?, valor_total = ? WHERE id = ?`,
      [valorProdutos, valorFrete, valorDesconto, valorProdutos + valorFrete - valorDesconto, id]
    );

    await conn.commit();

    return { sucesso: true, pedidoId: id };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function cancelarPedido(pedidoId, dados = {}) {
  const { usuario_id = null, observacao = '' } = dados;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await liberarReservasPedidoNaTransacao(conn, {
      pedidoId,
      usuarioId: usuario_id,
      observacao: observacao || `Cancelamento do pedido ${pedidoId}`
    });

    await conn.query(
      `UPDATE pedidos SET status = 'CANCELADO' WHERE id = ?`,
      [pedidoId]
    );

    await conn.commit();
    return { sucesso: true, pedidoId };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function alterarQuantidadeItemPedido(pedidoId, produtoId, novaQuantidade, dados = {}) {
  const qtdNova = Number(novaQuantidade || 0);
  if (!pedidoId || !produtoId || qtdNova <= 0) {
    throw new Error('Quantidade inválida para alteração do item do pedido.');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, quantidade FROM pedido_itens WHERE pedido_id = ? AND produto_id = ? FOR UPDATE`,
      [pedidoId, produtoId]
    );

    if (!rows.length) {
      throw new Error('Item do pedido não encontrado.');
    }

    const [itens] = await conn.query(
      `SELECT id, produto_id, combo_id, tipo_item, quantidade
       FROM pedido_itens WHERE pedido_id = ? FOR UPDATE`,
      [pedidoId]
    );
    const itensAtualizados = itens.map((item) => ({
      ...item,
      quantidade: item.id === rows[0].id ? qtdNova : item.quantidade
    }));

    await ajustarReservasPedidoNaTransacao(conn, {
      pedidoId,
      itens: itensAtualizados,
      usuarioId: dados.usuario_id || null,
      observacao: dados.observacao || 'Ajuste de quantidade do pedido'
    });

    await conn.query(
      `UPDATE pedido_itens SET quantidade = ?, subtotal = valor_unitario * ? WHERE id = ?`,
      [qtdNova, qtdNova, rows[0].id]
    );

    await conn.commit();
    return { sucesso: true, pedidoId, produtoId, quantidade: qtdNova };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
export async function buscarClientePorId(id){

    const [rows] = await db.query(
        "SELECT id FROM cliente WHERE id = ?",
        [id]
    );

    return rows[0] || null;
}


export async function buscarEnderecoPorId(id){

    const [rows] = await db.query(
        "SELECT id FROM endereco WHERE id = ?",
        [id]
    );

    return rows[0] || null;
}

export async function buscarFinanceiroPedido(pedidoId) {
  const [rows] = await db.query(
    `SELECT p.id, p.valor_produtos, p.valor_frete, p.valor_desconto,
            p.valor_total,
            COALESCE(SUM(CASE WHEN pg.valor > 0 THEN pg.valor ELSE 0 END), 0) AS pagamentos,
            COALESCE(SUM(CASE WHEN pg.valor < 0 THEN ABS(pg.valor) ELSE 0 END), 0) AS reembolsos
     FROM pedidos p
     LEFT JOIN pagamentos pg ON pg.pedido_id = p.id
     WHERE p.id = ?
     GROUP BY p.id`,
    [pedidoId]
  );
  if (!rows.length) return null;
  const financeiro = rows[0];
  financeiro.saldo = Number(financeiro.valor_total) - Number(financeiro.pagamentos) + Number(financeiro.reembolsos);
  return financeiro;
}

export async function inserirPagamentoPedido(pedidoId, dados) {
  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor de pagamento inválido.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query('SELECT id FROM pedidos WHERE id = ? FOR UPDATE', [pedidoId]);
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    const [result] = await conn.query(
      `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [pedidoId, dados.usuario_id || null, valor, dados.forma_pagamento || 'TRANSFERENCIA', dados.observacao || null]
    );
    await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status)
       VALUES (?, ?, 'PAGAMENTO', ?, ?, 'RESOLVIDO')`,
      [pedidoId, dados.usuario_id || null, `Pagamento de ${valor.toFixed(2)}`, valor]
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

export async function inserirCobrancaPedido(pedidoId, dados) {
  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor de cobrança inválido.');
  const tipos = ['DANO', 'ATRASO', 'PERDA', 'TAXA', 'OUTRO'];
  if (!tipos.includes(dados.tipo)) throw new Error('Tipo de cobrança inválido.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT id FROM pedidos WHERE id = ? FOR UPDATE', [pedidoId]);
    await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status)
       VALUES (?, ?, ?, ?, ?, 'ABERTO')`,
      [pedidoId, dados.usuario_id || null, dados.tipo, dados.descricao, valor]
    );
    await conn.query('UPDATE pedidos SET valor_total = valor_total + ? WHERE id = ?', [valor, pedidoId]);
    await conn.commit();
    return { pedidoId, valor, tipo: dados.tipo };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}