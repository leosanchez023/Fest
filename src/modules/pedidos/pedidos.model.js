import db from "../../../database/connection.js";

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

    for (const item of dados.itens) {
      await conn.query(
        `
        INSERT INTO pedido_itens (
          pedido_id,
          produto_id,
          quantidade,
          valor_unitario,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          pedidoId,
          item.produto_id,
          item.quantidade,
          item.preco_unitario,
          item.subtotal
        ]
      );

      await conn.query(
      `UPDATE produtos
      SET estoque = estoque - ?
      WHERE id = ?
      `,
      [
        item.quantidade,
        item.produto_id
      ]
    );
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

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const [rows] = await db.query(
    `
    SELECT DISTINCT
      e.id,
      e.rua,
      e.numero,
      e.bairro,
      e.cidade,
      e.estado
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

  const [existe] = await db.query(
    `SELECT id FROM endereco
     WHERE rua = ? AND numero = ? AND cidade = ? AND estado = ?
     LIMIT 1`,
    [rua, numero, cidade, estado]
  );

  if (existe.length) {
    return { id: existe[0].id, existente: true };
  }

  const [result] = await db.query(
    `INSERT INTO endereco (rua, numero, bairro, cidade, estado)
     VALUES (?, ?, ?, ?, ?)`,
    [rua, numero, bairro, cidade, estado]
  );

  return { id: result.insertId, criado: true };
}
export async function buscarPedidoPorId(id) {
  const [rows] = await db.query(
    `SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email, c.cpf as cliente_cpf
     FROM pedidos p
     LEFT JOIN cliente c ON c.id = p.cliente_id
     WHERE p.id = ?
    `,
    [id]
  );

  if (!rows.length) return null;

  const pedido = rows[0];

  const [itens] = await db.query(
    `SELECT pi.*, pr.nome as produto_nome FROM pedido_itens pi
     LEFT JOIN produtos pr ON pr.id = pi.produto_id
     WHERE pi.pedido_id = ?`,
    [id]
  );

  const [pagamentos] = await db.query(`SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY data_pagamento DESC`, [id]);

  return {
    pedido,
    itens,
    pagamentos
  };
}
export async function buscarClientePorId(id){

    const [rows] = await db.query(
        "SELECT id FROM clientes WHERE id = ?",
        [id]
    );

    return rows[0] || null;
}
export async function buscarEnderecoPorId(id){

    const [rows] = await db.query(
        "SELECT id FROM enderecos WHERE id = ?",
        [id]
    );

    return rows[0] || null;
}