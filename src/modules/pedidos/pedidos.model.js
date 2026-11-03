import db from "../../../database/connection.js";
import {
  reservarItensPedidoComCombos,
  registrarVendaItensPedidoNaTransacao,
  ajustarReservasPedidoNaTransacao,
  liberarReservasPedidoNaTransacao
} from "../estoque/estoque.service.js";
import { calcularSaldoPendente } from "./financeiro.js";

// ---------------- CLIENTES ----------------
export async function buscarClientes(termo) {
  const { rows: rows } = await db.query(
    `
    SELECT id, nome, email, telefone, cpf
    FROM cliente
    WHERE
      nome ILIKE $1
      OR cpf ILIKE $2
      OR telefone ILIKE $3
      OR email ILIKE $4
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
  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const { rows: existentes } = await conn.query(
      `SELECT id FROM cliente WHERE LOWER(email) = LOWER($1) OR ($2 IS NOT NULL AND cpf = $3) LIMIT 1 FOR UPDATE`,
      [cliente.email, cliente.cpf, cliente.cpf]
    );
    if (existentes.length) {
      throw new Error("Já existe um cliente com este e-mail ou CPF.");
    }

    const idEndereco = await obterOuCriarEndereco(conn, {
      rua: cliente.rua,
      numero: cliente.numero,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      referencia: cliente.referencia
    });
    const clienteResult = await conn.query(
      `INSERT INTO cliente (nome, email, telefone, cpf, nascimento, id_endereco)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        cliente.nome,
        cliente.email,
        cliente.telefone,
        cliente.cpf,
        cliente.nascimento || null,
        idEndereco
      ]
    );
    await client.query('COMMIT');
    return {
      id: clienteResult.rows[0].id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      cpf: cliente.cpf,
      nascimento: cliente.nascimento,
      id_endereco: idEndereco
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

// ---------------- PRODUTOS ----------------
export async function buscarProdutos(termo) {
  const { rows: rows } = await db.query(
    `
    SELECT id, nome, preco_venda
    FROM produtos
    WHERE nome ILIKE $1
    ORDER BY nome
    LIMIT 20
    `,
    [`%${termo}%`]
  );

  return rows;
}

export async function buscarItens(termo) {
  const busca = `%${String(termo || "").trim()}%`;
  const { rows: rows } = await db.query(
    `    SELECT id, nome, preco_venda, preco_aluguel, 'PRODUTO' AS origem
     FROM produtos
     WHERE ativo = 1 AND (nome ILIKE $1 OR codigo ILIKE $2)
     UNION ALL
     SELECT id, nome,
            COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco_venda,
            COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco_aluguel,
            'COMBO' AS origem
     FROM combos
     WHERE ativo = 1 AND (nome ILIKE $3 OR codigo ILIKE $4)
     ORDER BY nome
     LIMIT 30`,
    [busca, busca, busca, busca]
  );
  return rows;
}

export async function buscarConfiguracaoEntrega() {
  const { rows: rows } = await db.query(
    `SELECT origem_rua, origem_numero, origem_bairro, origem_cidade, origem_estado,
            origem_cep, origem_referencia, origem_lat, origem_lon, origem_aproximada,
            regra_cobranca, valor_fixo, taxa_inicial, valor_por_km, taxa_minima,
            distancia_maxima_km, sentido_distancia, atualizado_em
     FROM configuracoes_entrega WHERE id = 1 LIMIT 1`
  );
  return rows[0] || null;
}

export async function salvarConfiguracaoEntrega(config) {
  await db.query(
    `INSERT INTO configuracoes_entrega (
       id, origem_rua, origem_numero, origem_bairro, origem_cidade, origem_estado,
       origem_cep, origem_referencia, origem_lat, origem_lon, origem_aproximada,
       regra_cobranca, valor_fixo, taxa_inicial, valor_por_km, taxa_minima,
       distancia_maxima_km, sentido_distancia
     ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (id) DO UPDATE SET
       origem_rua = EXCLUDED.origem_rua,
       origem_numero = EXCLUDED.origem_numero,
       origem_bairro = EXCLUDED.origem_bairro,
       origem_cidade = EXCLUDED.origem_cidade,
       origem_estado = EXCLUDED.origem_estado,
       origem_cep = EXCLUDED.origem_cep,
       origem_referencia = EXCLUDED.origem_referencia,
       origem_lat = EXCLUDED.origem_lat,
       origem_lon = EXCLUDED.origem_lon,
       origem_aproximada = EXCLUDED.origem_aproximada,
       regra_cobranca = EXCLUDED.regra_cobranca,
       valor_fixo = EXCLUDED.valor_fixo,
       taxa_inicial = EXCLUDED.taxa_inicial,
       valor_por_km = EXCLUDED.valor_por_km,
       taxa_minima = EXCLUDED.taxa_minima,
       distancia_maxima_km = EXCLUDED.distancia_maxima_km,
       sentido_distancia = EXCLUDED.sentido_distancia`,
    [
      config.origem_rua,
      config.origem_numero,
      config.origem_bairro,
      config.origem_cidade,
      config.origem_estado,
      config.origem_cep,
      config.origem_referencia,
      config.origem_lat,
      config.origem_lon,
      config.origem_aproximada ? 1 : 0,
      config.regra_cobranca,
      config.valor_fixo,
      config.taxa_inicial,
      config.valor_por_km,
      config.taxa_minima,
      config.distancia_maxima_km,
      config.sentido_distancia
    ]
  );
  return buscarConfiguracaoEntrega();
}

async function obterOuCriarEndereco(conn, dados, enderecoId = null) {
  const fields = ["rua", "numero", "bairro", "cidade", "estado", "cep", "referencia"];
  const endereco = Object.fromEntries(fields.map((field) => {
    const value = String(dados?.[field] || "").trim();
    return [field, value || null];
  }));
  const hasAddress = Object.values(endereco).some(Boolean);

  if (!hasAddress) {
    if (!enderecoId) return null;
    const { rows: rows } = await conn.query("SELECT id FROM endereco WHERE id = $1", [enderecoId]);
    if (!rows.length) throw new Error("Endereço inválido.");
    return rows[0].id;
  }
  if (!endereco.rua || !endereco.cidade) {
    throw new Error("Informe rua e cidade para salvar o endereço de entrega.");
  }

  const where = fields.map((field, index) => `${field} IS NOT DISTINCT FROM $${index + 1}`).join(" AND ");
  const values = fields.map((field) => endereco[field]);

  if (enderecoId) {
    const whereComId = fields.map((field, index) => `${field} IS NOT DISTINCT FROM $${index + 2}`).join(" AND ");
    const { rows: selected } = await conn.query(
      `SELECT id FROM endereco WHERE id = $1 AND ${whereComId} LIMIT 1`,
      [enderecoId, ...values]
    );
    if (selected.length) return selected[0].id;
  }

  const { rows: matches } = await conn.query(
    `SELECT id FROM endereco WHERE ${where} LIMIT 1`,
    values
  );
  if (matches.length) return matches[0].id;

  const result = await conn.query(
    `INSERT INTO endereco
      (rua, numero, bairro, cidade, estado, cep, referencia)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    values
  );
  return result.rows[0].id;
}

export async function buscarProdutoPorId(id) {
  const { rows: rows } = await db.query(
    `
    SELECT id, nome, preco_venda, preco_aluguel, estoque, ativo
    FROM produtos
    WHERE id = $1
    `,
    [id]
  );

  return rows[0];
}

export async function buscarComboPorId(id) {
  const { rows: rows } = await db.query(
    `SELECT c.id, c.nome,
            COALESCE(NULLIF(c.preco_aluguel, 0), c.preco_venda, 0) AS preco,
            c.ativo,
            COUNT(ci.id) AS total_componentes
     FROM combos c
     LEFT JOIN combo_itens ci ON ci.combo_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  );
  return rows[0] || null;
}

// ---------------- PEDIDOS ----------------
export async function criarPedido(dados) {
  const client = await db.connect();
  const conn = client;

  await client.query('BEGIN');

  try {
    const enderecoId = await obterOuCriarEndereco(
      conn,
      dados.endereco,
      dados.endereco_id
    );
    const pedido = await conn.query(
      `
      INSERT INTO pedidos (
      cliente_id,
      usuario_id,
      endereco_id,
      data_evento,
      data_entrega,
      data_retirada,
      telefone_contato,
      endereco_origem,
      origem_lat,
      origem_lon,
      destino_lat,
      destino_lon,
      distancia_km,
      distancia_retorno_km,
      distancia_cobrada_km,
      frete_formula,
      origem_aproximada,
      destino_aproximado,
      tipo_pedido,
      status,
      status_documento,
      valor_produtos,
      valor_frete,
      valor_desconto,
      valor_total,
      local_evento,
      observacao_entrega,
      observacao_retirada,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
    RETURNING id
      `,
      [
      dados.cliente_id,
      dados.usuario_id || null,
      enderecoId,
      dados.data_evento,
      dados.data_entrega,
      dados.data_retirada,
      dados.telefone_contato,
      dados.endereco_origem,
      dados.origem_lat,
      dados.origem_lon,
      dados.destino_lat,
      dados.destino_lon,
      dados.distancia_km,
      dados.distancia_retorno_km,
      dados.distancia_cobrada_km,
      dados.frete_formula,
      Boolean(dados.origem_aproximada),
      Boolean(dados.destino_aproximado),
      dados.tipo_pedido || "ALUGUEL",
      dados.status || "ORCAMENTO",
      dados.status_documento || (dados.status === 'CONFIRMADO' ? 'PEDIDO' : 'ORCAMENTO'),
      dados.valor_produtos,
      dados.valor_frete,
      dados.valor_desconto,
      dados.valor_total,
      dados.local_evento,
      dados.observacao_entrega,
      dados.observacao_retirada,
      dados.observacoes || null
    ]
    );

    const pedidoId = pedido.rows[0].id;

    const itensPedido = Array.isArray(dados.itens) ? dados.itens : [];

    for (const item of itensPedido) {
      const itemResult = await conn.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
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
        item.pedido_item_id = itemResult.rows[0].id;
      if (item.combo_id && dados.status_documento === "ORCAMENTO") {
        const { rows: componentes } = await conn.query(
          "SELECT produto_id, quantidade FROM combo_itens WHERE combo_id = $1 FOR UPDATE",
          [item.combo_id]
        );
        if (!componentes.length) throw new Error("Combo sem componentes.");
        for (const componente of componentes) {
          await conn.query(
            `INSERT INTO pedido_item_componentes
              (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              item.pedido_item_id,
              pedidoId,
              componente.produto_id,
              componente.quantidade,
              Number(componente.quantidade) * Number(item.quantidade)
            ]
          );
        }
      }
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
          usuario_id,
          valor,
          forma_pagamento,
          observacao
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          pedidoId,
          dados.usuario_id || null,
          dados.valor_pago,
          dados.forma_pagamento,
          dados.observacao_pagamento || null
        ]
      );
    }

    await client.query('COMMIT');

    return {
      sucesso: true,
      pedidoId
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    conn.release();
  }
}
export async function atualizarStatusDocumento(pedidoId, novoStatusDocumento) {
  const res = await db.query(
    `UPDATE pedidos SET status_documento = $1 WHERE id = $2`,
    [novoStatusDocumento, pedidoId]
  );
  return res.rowCount > 0;
}
export async function buscarEnderecos(f) {
  const filtros = [];
  const params = [];

  if (f.rua) {
    filtros.push(`e.rua ILIKE $${params.length + 1}`);
    params.push(`%${f.rua.trim()}%`);
  }

  if (f.numero) {
    filtros.push(`e.numero = $${params.length + 1}`);
    params.push(f.numero.trim());
  }

  if (f.bairro) {
    filtros.push(`e.bairro ILIKE $${params.length + 1}`);
    params.push(`%${f.bairro.trim()}%`);
  }

  if (f.cidade) {
    filtros.push(`e.cidade ILIKE $${params.length + 1}`);
    params.push(`%${f.cidade.trim()}%`);
  }

  if (f.estado) {
    filtros.push(`e.estado = $${params.length + 1}`);
    params.push(f.estado.trim());
  }

  if (f.cep) {
    filtros.push(`e.cep ILIKE $${params.length + 1}`);
    params.push(`%${f.cep.trim()}%`);
  }

  if (f.referencia) {
    filtros.push(`e.referencia ILIKE $${params.length + 1}`);
    params.push(`%${f.referencia.trim()}%`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const { rows: rows } = await db.query(
    `
    SELECT DISTINCT
      e.id,
      e.rua,
      e.numero,
      e.bairro,
      e.cidade,
      e.estado,
      e.cep,
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
  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const { rows: before } = await conn.query(
      `SELECT id FROM endereco
       WHERE rua IS NOT DISTINCT FROM $1 AND numero IS NOT DISTINCT FROM $2 AND bairro IS NOT DISTINCT FROM $3 AND cidade IS NOT DISTINCT FROM $4
         AND estado IS NOT DISTINCT FROM $5 AND cep IS NOT DISTINCT FROM $6 AND referencia IS NOT DISTINCT FROM $7
       LIMIT 1`,
      ["rua", "numero", "bairro", "cidade", "estado", "cep", "referencia"]
        .map((field) => String(dados[field] || "").trim() || null)
    );
    const id = await obterOuCriarEndereco(conn, dados);
    await client.query('COMMIT');
    return before.length
      ? { id, existente: true }
      : { id, criado: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}
export async function buscarPedidoPorId(id) {
  const { rows: rows } = await db.query(
    `SELECT p.*,

            c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email, c.cpf as cliente_cpf,
            e.rua as endereco_rua, e.numero as endereco_numero, e.bairro as endereco_bairro, e.cidade as endereco_cidade, e.estado as endereco_estado, e.cep as endereco_cep, e.referencia as endereco_referencia
     FROM pedidos p
     LEFT JOIN cliente c ON c.id = p.cliente_id
     LEFT JOIN endereco e ON e.id = p.endereco_id
     WHERE p.id = $1
    `,
    [id]
  );

  if (!rows.length) return null;

  const pedido = rows[0];

  const { rows: itens } = await db.query(
    `SELECT pi.*, pr.nome as produto_nome,
            pr.preco_venda AS produto_preco_venda,
            pr.preco_aluguel AS produto_preco_aluguel,
            c.nome as combo_nome,
            COALESCE(NULLIF(c.preco_aluguel, 0), c.preco_venda, 0) AS preco_combo
     FROM pedido_itens pi
     LEFT JOIN produtos pr ON pr.id = pi.produto_id
     LEFT JOIN combos c ON c.id = pi.combo_id
     WHERE pi.pedido_id = $1`,
    [id]
  );

  const { rows: pagamentos } = await db.query(`SELECT * FROM pagamentos WHERE pedido_id = $1 ORDER BY data_pagamento DESC`, [id]);

  // montar objeto com endereco aninhado
  pedido.endereco = {
    id: pedido.endereco_id || null,
    rua: pedido.endereco_rua || null,
    numero: pedido.endereco_numero || null,
    bairro: pedido.endereco_bairro || null,
    cidade: pedido.endereco_cidade || null,
    estado: pedido.endereco_estado || null,
    cep: pedido.endereco_cep || null,
    referencia: pedido.endereco_referencia || null
  };

  return {
    pedido,
    itens,
    pagamentos
  };
}

export async function atualizarPedido(id, dados) {
  const client = await db.connect();
  const conn = client;

  try {
    await client.query('BEGIN');

    const { rows: pedidoRows } = await conn.query(
      `SELECT p.*, e.rua AS endereco_rua, e.numero AS endereco_numero,
              e.bairro AS endereco_bairro, e.cidade AS endereco_cidade,
              e.estado AS endereco_estado, e.cep AS endereco_cep,
              e.referencia AS endereco_referencia
       FROM pedidos p
       LEFT JOIN endereco e ON e.id = p.endereco_id
       WHERE p.id = $1 FOR UPDATE OF p`,
      [id]
    );
    const pedidoAtual = pedidoRows[0];
    if (!pedidoAtual) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'ENTREGUE', 'RETIRADO'].includes(pedidoAtual.status)) {
      throw new Error('Pedido entregue, retirado ou cancelado não pode ser editado.');
    }
    const tipoPedidoPadrao = dados.tipo_pedido || pedidoAtual.tipo_pedido || 'ALUGUEL';
    if (!['VENDA', 'ALUGUEL', 'MISTO'].includes(tipoPedidoPadrao)) {
      throw new Error('Tipo de pedido inválido.');
    }

    const clienteId = Number(dados.cliente_id);
    const enderecoSelecionadoId = dados.endereco_id ? Number(dados.endereco_id) : null;
    if (!Number.isInteger(clienteId) || clienteId <= 0) throw new Error('Cliente inválido.');
    const { rows: clientes } = await conn.query('SELECT id FROM cliente WHERE id = $1 FOR UPDATE', [clienteId]);
    if (!clientes.length) throw new Error('Cliente não encontrado.');
    if (enderecoSelecionadoId !== null) {
      if (!Number.isInteger(enderecoSelecionadoId) || enderecoSelecionadoId <= 0) {
        throw new Error('Endereço inválido.');
      }
      const { rows: enderecos } = await conn.query('SELECT id FROM endereco WHERE id = $1 FOR UPDATE', [enderecoSelecionadoId]);
      if (!enderecos.length) throw new Error('Endereço inválido.');
    }
    const enderecoId = await obterOuCriarEndereco(
      conn,
      dados.endereco,
      enderecoSelecionadoId
    );
    let rota = dados.rota;
    if (!rota) {
      const enderecoAtual = {
        rua: pedidoAtual.endereco_rua || "",
        numero: pedidoAtual.endereco_numero || "",
        bairro: pedidoAtual.endereco_bairro || "",
        cidade: pedidoAtual.endereco_cidade || "",
        estado: pedidoAtual.endereco_estado || "",
        cep: pedidoAtual.endereco_cep || "",
        referencia: pedidoAtual.endereco_referencia || ""
      };
      const enderecoEnviado = Object.fromEntries(
        Object.keys(enderecoAtual).map((field) => [
          field,
          String(dados.endereco?.[field] || "").trim()
        ])
      );
      if (Object.keys(enderecoAtual).filter((field) => field !== "referencia")
        .some((field) => enderecoAtual[field] !== enderecoEnviado[field])) {
        throw new Error("O destino foi alterado. Selecione novamente o endereço e recalcule a rota.");
      }
      rota = {
        distanciaKm: Number(pedidoAtual.distancia_km),
        distanciaRetornoKm: Number(pedidoAtual.distancia_retorno_km || 0),
        distanciaCobradaKm: Number(pedidoAtual.distancia_cobrada_km || pedidoAtual.distancia_km),
        formula: pedidoAtual.frete_formula,
        origemAproximada: Boolean(pedidoAtual.origem_aproximada),
        destinoAproximado: Boolean(pedidoAtual.destino_aproximado),
        valorFrete: Number(pedidoAtual.valor_frete),
        origemLatitude: pedidoAtual.origem_lat,
        origemLongitude: pedidoAtual.origem_lon,
        destinoLatitude: pedidoAtual.destino_lat,
        destinoLongitude: pedidoAtual.destino_lon
      };
    }
    const pedidoLegadoSemRota = !dados.rota
      && pedidoAtual.origem_lat == null
      && pedidoAtual.origem_lon == null
      && pedidoAtual.destino_lat == null
      && pedidoAtual.destino_lon == null;
    if (!Number.isFinite(Number(rota.distanciaKm))
        || (Number(rota.distanciaKm) <= 0 && !pedidoLegadoSemRota)
        || !Number.isFinite(Number(rota.valorFrete)) || Number(rota.valorFrete) < 0) {
      throw new Error("A rota não possui distância e frete válidos. Recalcule antes de salvar.");
    }

    await conn.query(
      `UPDATE pedidos SET
         cliente_id = $1, endereco_id = $2, data_evento = $3, data_entrega = $4, data_retirada = $5,
         telefone_contato = $6, endereco_origem = $7, origem_lat = $8, origem_lon = $9,
         destino_lat = $10, destino_lon = $11, distancia_km = $12, distancia_retorno_km = $13,
         distancia_cobrada_km = $14, frete_formula = $15, origem_aproximada = $16,
         destino_aproximado = $17, valor_frete = $18, local_evento = $19,
         observacao_entrega = $20, observacao_retirada = $21, observacoes = $22
       WHERE id = $23`,
      [
        clienteId,
        enderecoId,
        dados.data_evento || null,
        dados.data_entrega || null,
        dados.data_retirada || null,
        dados.telefone_contato || null,
        dados.endereco_origem || pedidoAtual.endereco_origem || null,
        rota.origemLatitude,
        rota.origemLongitude,
        rota.destinoLatitude,
        rota.destinoLongitude,
        rota.distanciaKm,
        rota.distanciaRetornoKm || 0,
        rota.distanciaCobradaKm || rota.distanciaKm,
        rota.formula || pedidoAtual.frete_formula || null,
        Boolean(rota.origemAproximada),
        Boolean(rota.destinoAproximado),
        rota.valorFrete,
        dados.local_evento || null,
        dados.observacao_entrega || null,
        dados.observacao_retirada || null,
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
      if (!Number.isInteger(quantidade) || quantidade <= 0 || quantidade > 9999) {
        throw new Error('Quantidade deve ser um inteiro positivo válido.');
      }
      if ((comboId !== null && (!Number.isInteger(comboId) || comboId <= 0)) ||
          (produtoId !== null && (!Number.isInteger(produtoId) || produtoId <= 0))) {
        throw new Error('Produto ou combo inválido.');
      }
      if ((comboId && produtoId) || (!comboId && !produtoId)) throw new Error('Cada item deve ser produto ou combo.');

      const chave = `${comboId ? 'c' : 'p'}:${comboId || produtoId}`;
      if (vistos.has(chave)) throw new Error('Não é permitido repetir o mesmo produto ou combo.');
      vistos.add(chave);

      let precoOficial;
      let tipoItem;
      if (comboId) {
        const { rows: combos } = await conn.query(
          `SELECT id, ativo, COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco
           FROM combos WHERE id = $1 FOR UPDATE`,
          [comboId]
        );
        if (!combos.length || Number(combos[0].ativo) !== 1) throw new Error('Combo inexistente ou inativo.');
        tipoItem = String(item.tipo_item || (tipoPedidoPadrao === 'VENDA' ? 'VENDA' : 'ALUGUEL')).toUpperCase();
        precoOficial = Number(combos[0].preco);
      } else {
        const { rows: produtos } = await conn.query(
          `SELECT id, ativo, preco_venda, preco_aluguel
           FROM produtos WHERE id = $1 FOR UPDATE`,
          [produtoId]
        );
        if (!produtos.length || Number(produtos[0].ativo) !== 1) throw new Error('Produto inexistente ou inativo.');
        tipoItem = String(item.tipo_item || (
          tipoPedidoPadrao === 'VENDA' ? 'VENDA' : 'ALUGUEL'
        )).toUpperCase();
        if (!['VENDA', 'ALUGUEL'].includes(tipoItem)) {
          throw new Error(`Tipo de item inválido para o produto ${produtos[0].id}.`);
        }
        precoOficial = Number(tipoItem === 'VENDA' ? produtos[0].preco_venda : produtos[0].preco_aluguel);
      }

      if (!['VENDA', 'ALUGUEL'].includes(tipoItem)) throw new Error('Tipo de item inválido.');
      if (!Number.isFinite(precoOficial) || precoOficial < 0) throw new Error('Preço cadastrado inválido.');
      const preco = precoOficial;
      itensNormalizados.push({
        produto_id: produtoId,
        combo_id: comboId,
        tipo_item: tipoItem,
        quantidade,
        preco,
        subtotal: preco * quantidade
      });
    }

    await conn.query(`DELETE FROM pedido_itens WHERE pedido_id = $1`, [id]);
    for (const item of itensNormalizados) {
      const inserted = await conn.query(
        `INSERT INTO pedido_itens
          (pedido_id, produto_id, tipo_item, combo_id, quantidade, valor_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [id, item.produto_id, item.tipo_item, item.combo_id, item.quantidade, item.preco, item.subtotal]
      );

      if (item.combo_id) {
        const { rows: componentes } = await conn.query(
          `SELECT produto_id, quantidade FROM combo_itens WHERE combo_id = $1 FOR UPDATE`,
          [item.combo_id]
        );
        if (!componentes.length) throw new Error('Combo sem componentes.');
        for (const componente of componentes) {
          await conn.query(
            `INSERT INTO pedido_item_componentes
              (pedido_item_id, pedido_id, produto_id, quantidade_por_unidade, quantidade_total)
             VALUES ($1, $2, $3, $4, $5)`,
            [inserted.rows[0].id, id, componente.produto_id, componente.quantidade, Number(componente.quantidade) * item.quantidade]
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

    const { rows: somaRows } = await conn.query(`SELECT COALESCE(SUM(subtotal), 0) AS valor_produtos FROM pedido_itens WHERE pedido_id = $1`, [id]);
    const valorProdutos = Number(somaRows[0].valor_produtos || 0);
    const valorFrete = Number(rota.valorFrete);
    const valorDesconto = Number(dados.valor_desconto || 0);
    if (!Number.isFinite(valorFrete) || valorFrete < 0 ||
        !Number.isFinite(valorDesconto) || valorDesconto < 0 ||
        valorDesconto > valorProdutos + valorFrete) {
      throw new Error('Frete ou desconto inválido.');
    }
    const valorTotal = valorProdutos + valorFrete - valorDesconto;
    const tiposItens = new Set(itensNormalizados.map((item) => item.tipo_item));
    const tipoPedido = tiposItens.size > 1 ? 'MISTO' : [...tiposItens][0];
    const { rows: pagamentosExistentes } = await conn.query(
      'SELECT id, valor FROM pagamentos WHERE pedido_id = $1 FOR UPDATE',
      [id]
    );
    const totalPago = pagamentosExistentes.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0);
    const valorPagoSolicitado = dados.valor_pago === undefined
      ? totalPago
      : Number(dados.valor_pago);
    if (!Number.isFinite(valorPagoSolicitado) || valorPagoSolicitado < 0) {
      throw new Error('Valor pago inválido.');
    }
    if (valorTotal + 0.001 < valorPagoSolicitado) {
      throw new Error('O valor pago não pode exceder o total atualizado.');
    }
    if (valorPagoSolicitado + 0.001 < totalPago) {
      throw new Error('O total editado não pode ser menor que o valor já pago.');
    }
    if (valorPagoSolicitado > totalPago + 0.001) {
      const formasPagamento = ['PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'TRANSFERENCIA'];
      if (!formasPagamento.includes(dados.forma_pagamento)) {
        throw new Error('Selecione uma forma de pagamento válida para registrar o valor adicional.');
      }
      const diferenca = Math.round((valorPagoSolicitado - totalPago) * 100) / 100;
      await conn.query(
        `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, dados.usuario_id || null, diferenca, dados.forma_pagamento, dados.observacao_pagamento || null]
      );
    }
    await conn.query(
      `UPDATE pedidos
       SET valor_produtos = $1, valor_frete = $2, valor_desconto = $3, valor_total = $4, tipo_pedido = $5
       WHERE id = $6`,
      [valorProdutos, valorFrete, valorDesconto, valorTotal, tipoPedido, id]
    );

    await client.query('COMMIT');

    return { sucesso: true, pedidoId: id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    conn.release();
  }
}

export async function cancelarPedido(pedidoId, dados = {}) {
  const { usuario_id = null, observacao = '' } = dados;

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: pedidos } = await conn.query(
      'SELECT id, status FROM pedidos WHERE id = $1 FOR UPDATE',
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'ENTREGUE', 'RETIRADO', 'FINALIZADO'].includes(pedidos[0].status)) {
      throw new Error('O pedido não pode ser cancelado no estado atual.');
    }

    await liberarReservasPedidoNaTransacao(conn, {
      pedidoId,
      usuarioId: usuario_id,
      observacao: observacao || `Cancelamento do pedido ${pedidoId}`
    });

    await conn.query(
      `UPDATE pedidos SET status = 'CANCELADO' WHERE id = $1`,
      [pedidoId]
    );

    await client.query('COMMIT');
    return { sucesso: true, pedidoId };
  } catch (error) {
    await client.query('ROLLBACK');
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

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');

    const { rows: rows } = await conn.query(
      `SELECT id, quantidade FROM pedido_itens WHERE pedido_id = $1 AND produto_id = $2 FOR UPDATE`,
      [pedidoId, produtoId]
    );

    if (!rows.length) {
      throw new Error('Item do pedido não encontrado.');
    }

    const { rows: itens } = await conn.query(
      `SELECT id, produto_id, combo_id, tipo_item, quantidade
       FROM pedido_itens WHERE pedido_id = $1 FOR UPDATE`,
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
      `UPDATE pedido_itens SET quantidade = $1, subtotal = valor_unitario * $2 WHERE id = $3`,
      [qtdNova, qtdNova, rows[0].id]
    );

    await client.query('COMMIT');
    return { sucesso: true, pedidoId, produtoId, quantidade: qtdNova };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}
export async function buscarClientePorId(id){

    const { rows: rows } = await db.query(
        "SELECT id FROM cliente WHERE id = $1",
        [id]
    );

    return rows[0] || null;
}


export async function buscarEnderecoPorId(id){

    const { rows: rows } = await db.query(
        "SELECT id FROM endereco WHERE id = $1",
        [id]
    );

    return rows[0] || null;
}

export async function buscarFinanceiroPedido(pedidoId) {
  const { rows: rows } = await db.query(
    `SELECT p.id, p.valor_produtos, p.valor_frete, p.valor_desconto,
            p.valor_total,
            COALESCE(SUM(CASE WHEN pg.valor > 0 THEN pg.valor ELSE 0 END), 0) AS pagamentos,
            COALESCE(SUM(CASE WHEN pg.valor < 0 THEN ABS(pg.valor) ELSE 0 END), 0) AS reembolsos
     FROM pedidos p
     LEFT JOIN pagamentos pg ON pg.pedido_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [pedidoId]
  );
  if (!rows.length) return null;
  const financeiro = rows[0];
  financeiro.saldo = calcularSaldoPendente(
    financeiro.valor_total,
    financeiro.pagamentos,
    financeiro.reembolsos
  );
  return financeiro;
}

export async function inserirPagamentoPedido(pedidoId, dados) {
  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0 || Math.round(valor * 100) !== valor * 100) {
    throw new Error('Valor de pagamento inválido.');
  }

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const { rows: pedidos } = await conn.query(
      'SELECT id, status, valor_total FROM pedidos WHERE id = $1 FOR UPDATE',
      [pedidoId]
    );
    const pedido = pedidos[0];
    if (!pedido) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedido.status)) {
      throw new Error('Não é possível registrar pagamento para este pedido.');
    }
    const { rows: [totais] } = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS pagos,
              COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END), 0) AS reembolsos
       FROM pagamentos WHERE pedido_id = $1`,
      [pedidoId]
    );
    const saldo = calcularSaldoPendente(pedido.valor_total, totais.pagos, totais.reembolsos);
    if (!Number.isFinite(saldo) || valor > saldo + 0.001) {
      throw new Error('O pagamento não pode exceder o saldo pendente.');
    }
    const result = await conn.query(
      `INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao)
       VALUES ($1, $2, $3, $4, $5)`,
      [pedidoId, dados.usuario_id || null, valor, dados.forma_pagamento || 'TRANSFERENCIA', dados.observacao || null]
    );
    await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status)
       VALUES ($1, $2, 'PAGAMENTO', $3, $4, 'RESOLVIDO')`,
      [pedidoId, dados.usuario_id || null, `Pagamento de ${valor.toFixed(2)}`, valor]
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function inserirCobrancaPedido(pedidoId, dados) {
  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-7) {
    throw new Error('Valor de cobrança inválido.');
  }
  const tipos = ['DANO', 'ATRASO', 'PERDA', 'TAXA', 'OUTRO'];
  if (!tipos.includes(dados.tipo)) throw new Error('Tipo de cobrança inválido.');

  const client = await db.connect();
  const conn = client;
  try {
    await client.query('BEGIN');
    const { rows: pedidos } = await conn.query(
      'SELECT id, status FROM pedidos WHERE id = $1 FOR UPDATE',
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedidos[0].status)) {
      throw new Error('Não é possível cobrar este pedido no estado atual.');
    }
    await conn.query(
      `INSERT INTO ocorrencias (pedido_id, usuario_id, tipo, descricao, valor, status)
       VALUES ($1, $2, $3, $4, $5, 'ABERTO')`,
      [pedidoId, dados.usuario_id || null, dados.tipo, dados.descricao, valor]
    );
    await conn.query('UPDATE pedidos SET valor_total = valor_total + $1 WHERE id = $2', [valor, pedidoId]);
    await client.query('COMMIT');
    return { pedidoId, valor, tipo: dados.tipo };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}