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
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existentes] = await conn.query(
      `SELECT id FROM cliente WHERE email = ? OR (? IS NOT NULL AND cpf = ?) LIMIT 1 FOR UPDATE`,
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
    const [clienteResult] = await conn.query(
      `INSERT INTO cliente (nome, email, telefone, cpf, nascimento, id_endereco)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cliente.nome,
        cliente.email,
        cliente.telefone,
        cliente.cpf,
        cliente.nascimento || null,
        idEndereco
      ]
    );
    await conn.commit();
    return {
      id: clienteResult.insertId,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      cpf: cliente.cpf,
      nascimento: cliente.nascimento,
      id_endereco: idEndereco
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
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
    `    SELECT id, nome, preco_venda, preco_aluguel, 'PRODUTO' AS origem
     FROM produtos
     WHERE ativo = 1 AND (nome LIKE ? OR codigo LIKE ?)
     UNION ALL
     SELECT id, nome,
            COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco_venda,
            COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco_aluguel,
            'COMBO' AS origem
     FROM combos
     WHERE ativo = 1 AND (nome LIKE ? OR codigo LIKE ?)
     ORDER BY nome
     LIMIT 30`,
    [busca, busca, busca, busca]
  );
  return rows;
}

export async function buscarConfiguracaoEntrega() {
  const [rows] = await db.query(
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
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       origem_rua = VALUES(origem_rua),
       origem_numero = VALUES(origem_numero),
       origem_bairro = VALUES(origem_bairro),
       origem_cidade = VALUES(origem_cidade),
       origem_estado = VALUES(origem_estado),
       origem_cep = VALUES(origem_cep),
       origem_referencia = VALUES(origem_referencia),
       origem_lat = VALUES(origem_lat),
       origem_lon = VALUES(origem_lon),
       origem_aproximada = VALUES(origem_aproximada),
       regra_cobranca = VALUES(regra_cobranca),
       valor_fixo = VALUES(valor_fixo),
       taxa_inicial = VALUES(taxa_inicial),
       valor_por_km = VALUES(valor_por_km),
       taxa_minima = VALUES(taxa_minima),
       distancia_maxima_km = VALUES(distancia_maxima_km),
       sentido_distancia = VALUES(sentido_distancia)`,
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
    const [rows] = await conn.query("SELECT id FROM endereco WHERE id = ?", [enderecoId]);
    if (!rows.length) throw new Error("Endereço inválido.");
    return rows[0].id;
  }
  if (!endereco.rua || !endereco.cidade) {
    throw new Error("Informe rua e cidade para salvar o endereço de entrega.");
  }

  const where = fields.map((field) => `${field} <=> ?`).join(" AND ");
  const values = fields.map((field) => endereco[field]);

  if (enderecoId) {
    const [selected] = await conn.query(
      `SELECT id FROM endereco WHERE id = ? AND ${where} LIMIT 1`,
      [enderecoId, ...values]
    );
    if (selected.length) return selected[0].id;
  }

  const [matches] = await conn.query(
    `SELECT id FROM endereco WHERE ${where} LIMIT 1`,
    values
  );
  if (matches.length) return matches[0].id;

  const [result] = await conn.query(
    `INSERT INTO endereco
      (rua, numero, bairro, cidade, estado, cep, referencia)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  return result.insertId;
}

export async function buscarProdutoPorId(id) {
  const [rows] = await db.query(
    `
    SELECT id, nome, preco_venda, preco_aluguel, estoque, ativo
    FROM produtos
    WHERE id = ?
    `,
    [id]
  );

  return rows[0];
}

export async function buscarComboPorId(id) {
  const [rows] = await db.query(
    `SELECT c.id, c.nome,
            COALESCE(NULLIF(c.preco_aluguel, 0), c.preco_venda, 0) AS preco,
            c.ativo,
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
    const enderecoId = await obterOuCriarEndereco(
      conn,
      dados.endereco,
      dados.endereco_id
    );
    const [pedido] = await conn.query(
      `
      INSERT INTO pedidos (
      cliente_id,
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
      observacoes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
      dados.cliente_id,
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
      dados.origem_aproximada ? 1 : 0,
      dados.destino_aproximado ? 1 : 0,
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

  if (f.estado) {
    filtros.push("e.estado = ?");
    params.push(f.estado.trim());
  }

  if (f.cep) {
    filtros.push("e.cep LIKE ?");
    params.push(`%${f.cep.trim()}%`);
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
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [before] = await conn.query(
      `SELECT id FROM endereco
       WHERE rua <=> ? AND numero <=> ? AND bairro <=> ? AND cidade <=> ?
         AND estado <=> ? AND cep <=> ? AND referencia <=> ?
       LIMIT 1`,
      ["rua", "numero", "bairro", "cidade", "estado", "cep", "referencia"]
        .map((field) => String(dados[field] || "").trim() || null)
    );
    const id = await obterOuCriarEndereco(conn, dados);
    await conn.commit();
    return before.length
      ? { id, existente: true }
      : { id, criado: true };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
export async function buscarPedidoPorId(id) {
  const [rows] = await db.query(
    `SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.email as cliente_email, c.cpf as cliente_cpf,
            e.rua as endereco_rua, e.numero as endereco_numero, e.bairro as endereco_bairro, e.cidade as endereco_cidade, e.estado as endereco_estado, e.cep as endereco_cep, e.referencia as endereco_referencia
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
    `SELECT pi.*, pr.nome as produto_nome,
            pr.preco_venda AS produto_preco_venda,
            pr.preco_aluguel AS produto_preco_aluguel,
            c.nome as combo_nome,
            COALESCE(NULLIF(c.preco_aluguel, 0), c.preco_venda, 0) AS preco_combo
     FROM pedido_itens pi
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
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [pedidoRows] = await conn.query(
      `SELECT p.*, e.rua AS endereco_rua, e.numero AS endereco_numero,
              e.bairro AS endereco_bairro, e.cidade AS endereco_cidade,
              e.estado AS endereco_estado, e.cep AS endereco_cep,
              e.referencia AS endereco_referencia
       FROM pedidos p
       LEFT JOIN endereco e ON e.id = p.endereco_id
       WHERE p.id = ? FOR UPDATE`,
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
    const [clientes] = await conn.query('SELECT id FROM cliente WHERE id = ? FOR UPDATE', [clienteId]);
    if (!clientes.length) throw new Error('Cliente não encontrado.');
    if (enderecoSelecionadoId !== null) {
      if (!Number.isInteger(enderecoSelecionadoId) || enderecoSelecionadoId <= 0) {
        throw new Error('Endereço inválido.');
      }
      const [enderecos] = await conn.query('SELECT id FROM endereco WHERE id = ? FOR UPDATE', [enderecoSelecionadoId]);
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
         cliente_id = ?, endereco_id = ?, data_evento = ?, data_entrega = ?, data_retirada = ?,
         telefone_contato = ?, endereco_origem = ?, origem_lat = ?, origem_lon = ?,
         destino_lat = ?, destino_lon = ?, distancia_km = ?, distancia_retorno_km = ?,
         distancia_cobrada_km = ?, frete_formula = ?, origem_aproximada = ?,
         destino_aproximado = ?, valor_frete = ?,
         observacoes = ?
       WHERE id = ?`,
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
        rota.origemAproximada ? 1 : 0,
        rota.destinoAproximado ? 1 : 0,
        rota.valorFrete,
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
        const [combos] = await conn.query(
          `SELECT id, ativo, COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco
           FROM combos WHERE id = ? FOR UPDATE`,
          [comboId]
        );
        if (!combos.length || Number(combos[0].ativo) !== 1) throw new Error('Combo inexistente ou inativo.');
        tipoItem = String(item.tipo_item || (tipoPedidoPadrao === 'VENDA' ? 'VENDA' : 'ALUGUEL')).toUpperCase();
        precoOficial = Number(combos[0].preco);
      } else {
        const [produtos] = await conn.query(
          `SELECT id, ativo, preco_venda, preco_aluguel
           FROM produtos WHERE id = ? FOR UPDATE`,
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
              (pedido_item_id, produto_id, quantidade_por_unidade, quantidade_total)
             VALUES (?, ?, ?, ?)`,
            [inserted.insertId, componente.produto_id, componente.quantidade, Number(componente.quantidade) * item.quantidade]
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
    const [[pagamentos]] = await conn.query(
      'SELECT COALESCE(SUM(valor), 0) AS total_pago FROM pagamentos WHERE pedido_id = ?',
      [id]
    );
    if (valorTotal + 0.001 < Number(pagamentos.total_pago || 0)) {
      throw new Error('O total editado não pode ser menor que o valor já pago.');
    }
    await conn.query(
      `UPDATE pedidos
       SET valor_produtos = ?, valor_frete = ?, valor_desconto = ?, valor_total = ?, tipo_pedido = ?
       WHERE id = ?`,
      [valorProdutos, valorFrete, valorDesconto, valorTotal, tipoPedido, id]
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

    const [pedidos] = await conn.query(
      'SELECT id, status FROM pedidos WHERE id = ? FOR UPDATE',
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

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query(
      'SELECT id, status, valor_total FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );
    const pedido = pedidos[0];
    if (!pedido) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedido.status)) {
      throw new Error('Não é possível registrar pagamento para este pedido.');
    }
    const [[totais]] = await conn.query(
      `SELECT COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS pagos,
              COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END), 0) AS reembolsos
       FROM pagamentos WHERE pedido_id = ?`,
      [pedidoId]
    );
    const saldo = calcularSaldoPendente(pedido.valor_total, totais.pagos, totais.reembolsos);
    if (!Number.isFinite(saldo) || valor > saldo + 0.001) {
      throw new Error('O pagamento não pode exceder o saldo pendente.');
    }
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
  if (!Number.isFinite(valor) || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-7) {
    throw new Error('Valor de cobrança inválido.');
  }
  const tipos = ['DANO', 'ATRASO', 'PERDA', 'TAXA', 'OUTRO'];
  if (!tipos.includes(dados.tipo)) throw new Error('Tipo de cobrança inválido.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = await conn.query(
      'SELECT id, status FROM pedidos WHERE id = ? FOR UPDATE',
      [pedidoId]
    );
    if (!pedidos.length) throw new Error('Pedido não encontrado.');
    if (['CANCELADO', 'FINALIZADO'].includes(pedidos[0].status)) {
      throw new Error('Não é possível cobrar este pedido no estado atual.');
    }
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