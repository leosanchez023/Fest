import express from "express";
import db from "../../../database/connection.js";
import { calcularSaldoPendente } from "../pedidos/financeiro.js";

const router = express.Router();

const normalizarStatusPedido = (status, statusDocumento) => {
  if (statusDocumento === "ORCAMENTO") return "Orçamento";
  const statusMap = {
    ORCAMENTO: "Orçamento",
    CONFIRMADO: "Em andamento",
    EM_PREPARO: "Em andamento",
    CONFERENCIA: "Em andamento",
    ENTREGUE: "Concluído",
    RETIRADO: "Concluído",
    FINALIZADO: "Concluído",
    PENDENTE: "Em andamento",
    CANCELADO: "Cancelado"
  };

  return statusMap[status] || "Em andamento";
};

const normalizarFinanceiro = ({ status, saldo, recebido, dataEvento }) => {
  if (status === "CANCELADO") return "Cancelado";
  if (saldo <= 0.009) return "Pago";
  if (dataEvento && new Date(dataEvento) < new Date(new Date().toDateString())) return "Atrasado";
  return recebido > 0 ? "Parcial" : "Pendente";
};

const normalizarEntrega = (status) => {
  const map = {
    ORCAMENTO: "Aguardando",
    CONFIRMADO: "Agendada",
    EM_PREPARO: "Em rota",
    ENTREGUE: "Concluída",
    RETIRADO: "Concluída",
    CONFERENCIA: "Concluída",
    FINALIZADO: "Concluída",
    PENDENTE: "Aguardando",
    CANCELADO: "Cancelada"
  };

  return map[status] || "Aguardando";
};

const normalizarTipoPedido = (tipo) => {
  if (tipo === "VENDA") return "Venda";
  if (tipo === "ALUGUEL") return "Locação";
  if (tipo === "MISTO") return "Misto";
  return "Locação";
};

const normalizarFiltroData = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Período inválido.");
  }
  return value;
};

export function construirFiltros(filtros) {
  const pedidos = [];
  const pedidosParams = [];
  const produtos = ["ativo = 1"];
  const produtosParams = [];
  const dataInicio = normalizarFiltroData(filtros.from);
  const dataFim = normalizarFiltroData(filtros.to);
  const tab = filtros.tab || "";
  const busca = String(filtros.q || "").trim();

  if (dataInicio && dataFim && dataInicio > dataFim) throw new Error("O início do período deve anteceder o fim.");

  if (tab !== "estoque") {
    const colunaData = tab === "entregas"
      ? "COALESCE(p.data_retirada, p.data_entrega, p.data_evento)"
      : "p.data_pedido";
    if (dataInicio) {
      pedidos.push(`${colunaData} >= ?`);
      pedidosParams.push(dataInicio);
    }
    if (dataFim) {
      pedidos.push(`${colunaData} < DATE_ADD(?, INTERVAL 1 DAY)`);
      pedidosParams.push(dataFim);
    }
    if (busca) {
      if (tab === "financeiro") {
        pedidos.push("(c.nome LIKE ? OR CAST(p.id AS CHAR) LIKE ? OR pg.formas_pagamento LIKE ?)");
        pedidosParams.push(`%${busca}%`, `%${busca}%`, `%${busca.toUpperCase().replace(/ /g, "_")}%`);
      } else if (tab === "entregas") {
        pedidos.push("(c.nome LIKE ? OR CAST(p.id AS CHAR) LIKE ? OR e.bairro LIKE ?)");
        pedidosParams.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
      } else if (tab === "pedidos") {
        pedidos.push("(c.nome LIKE ? OR CAST(p.id AS CHAR) LIKE ? OR itens.itens LIKE ?)");
        pedidosParams.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
      } else {
        pedidos.push("(c.nome LIKE ? OR CAST(p.id AS CHAR) LIKE ?)");
        pedidosParams.push(`%${busca}%`, `%${busca}%`);
      }
    }

    const status = String(filtros.status || "");
    if (tab === "pedidos") {
      const estados = {
        "Concluído": ["ENTREGUE", "RETIRADO", "FINALIZADO"],
        "Em andamento": ["CONFIRMADO", "EM_PREPARO", "CONFERENCIA", "PENDENTE"],
        "Orçamento": ["ORCAMENTO"],
        "Cancelado": ["CANCELADO"]
      }[status];
      if (estados) {
        if (status === "Orçamento") {
          pedidos.push("p.status_documento = 'ORCAMENTO'");
        } else {
          pedidos.push(`p.status IN (${estados.map(() => "?").join(",")})`);
          pedidosParams.push(...estados);
        }
      }
    } else if (tab === "financeiro") {
      const saldo = "GREATEST(COALESCE(p.valor_total, 0) - COALESCE(pg.total_pago, 0) - COALESCE(pg.reembolsos, 0), 0)";
      if (status === "Cancelado") pedidos.push("p.status = 'CANCELADO'");
      else if (status === "Pago") pedidos.push(`p.status <> 'CANCELADO' AND ${saldo} <= 0.009`);
      else if (status === "Parcial") pedidos.push(`p.status <> 'CANCELADO' AND ${saldo} > 0.009 AND COALESCE(pg.total_pago, 0) > 0`);
      else if (status === "Atrasado") pedidos.push(`p.status <> 'CANCELADO' AND ${saldo} > 0.009 AND p.data_evento < CURDATE()`);
      else if (status === "Pendente") pedidos.push(`p.status <> 'CANCELADO' AND ${saldo} > 0.009 AND COALESCE(pg.total_pago, 0) <= 0 AND (p.data_evento IS NULL OR p.data_evento >= CURDATE())`);
      pedidos.push("p.status_documento <> 'ORCAMENTO'");
    } else if (tab === "entregas") {
      const estados = {
        "Concluída": ["ENTREGUE", "RETIRADO", "CONFERENCIA", "FINALIZADO"],
        "Agendada": ["CONFIRMADO", "EM_PREPARO"],
        "Em rota": ["EM_PREPARO"],
        "Aguardando": ["ORCAMENTO", "PENDENTE"],
        "Cancelada": ["CANCELADO"]
      }[status];
      if (estados) {
        pedidos.push(`p.status IN (${estados.map(() => "?").join(",")})`);
        pedidosParams.push(...estados);
      }
      if (filtros.extraKey === "entTipo" && filtros.extra === "Retirada") pedidos.push("p.data_retirada IS NOT NULL");
      if (filtros.extraKey === "entTipo" && filtros.extra === "Entrega") pedidos.push("p.data_retirada IS NULL");
    } else if (tab === "clientes" && filtros.extraKey === "tipo") {
      if (filtros.extra === "PF") pedidos.push("c.cpf IS NOT NULL AND c.cpf <> ''");
      if (filtros.extra === "Não informado") pedidos.push("(c.cpf IS NULL OR c.cpf = '')");
    }

    if (tab === "pedidos" && filtros.extraKey === "tipo") {
      const tipo = { "Locação": "ALUGUEL", "Venda": "VENDA", "Misto": "MISTO" }[filtros.extra];
      if (tipo) {
        pedidos.push("p.tipo_pedido = ?");
        pedidosParams.push(tipo);
      }
    } else if (tab === "financeiro" && filtros.extraKey === "forma") {
      const forma = {
        "Dinheiro": "DINHEIRO",
        "Pix": "PIX",
        "Cartão de débito": "CARTAO_DEBITO",
        "Cartão de crédito": "CARTAO_CREDITO",
        "Transferência": "TRANSFERENCIA"
      }[filtros.extra];
      if (forma) {
        pedidos.push("EXISTS (SELECT 1 FROM pagamentos pf WHERE pf.pedido_id = p.id AND pf.forma_pagamento = ?)");
        pedidosParams.push(forma);
      } else if (filtros.extra === "Não informado") {
        pedidos.push("NOT EXISTS (SELECT 1 FROM pagamentos pf WHERE pf.pedido_id = p.id)");
      }
    }
  }

  if (tab === "estoque") {
    const disponivel = "GREATEST(COALESCE(estoque,0)-COALESCE(estoque_reservado,0)-COALESCE(estoque_em_uso,0)-COALESCE(estoque_manutencao,0)-COALESCE(estoque_danificado,0),0)";
    if (busca) {
      produtos.push("(nome LIKE ? OR categoria LIKE ? OR CAST(id AS CHAR) LIKE ?)");
      produtosParams.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }
    if (filtros.extraKey === "categoria" && filtros.extra) {
      if (filtros.extra === "Sem categoria") {
        produtos.push("(categoria IS NULL OR categoria = '')");
      } else {
        produtos.push("categoria = ?");
        produtosParams.push(filtros.extra);
      }
    }
    if (filtros.status === "Esgotado") produtos.push(`${disponivel} = 0`);
    else if (filtros.status === "Estoque baixo") produtos.push(`COALESCE(estoque_minimo,0) > 0 AND ${disponivel} > 0 AND ${disponivel} <= COALESCE(estoque_minimo,0)`);
    else if (filtros.status === "Disponível") produtos.push(`${disponivel} > 0 AND (${disponivel} > COALESCE(estoque_minimo,0) OR COALESCE(estoque_minimo,0) = 0)`);
  }

  return {
    pedidosSql: pedidos.length ? `WHERE ${pedidos.join(" AND ")}` : "",
    pedidosParams,
    produtosSql: `WHERE ${produtos.join(" AND ")}`,
    produtosParams
  };
}

export async function montarDadosRelatorio(filtros = {}) {
  const filtrosSql = construirFiltros(filtros);
  const [pedidosRows] = await db.execute(`
    SELECT
      p.id,
      p.cliente_id,
      p.data_pedido,
      p.data_evento,
      p.data_entrega,
      p.data_retirada,
      p.tipo_pedido,
      p.status_documento,
      p.status,
      p.valor_total,
      p.valor_produtos,
      p.valor_frete,
      c.nome AS cliente,
      c.cpf AS cliente_cpf,
      c.telefone AS cliente_telefone,
      c.email AS cliente_email,
      e.bairro,
      e.cidade,
      p.data_entrega_hora,
      p.data_retirada_hora,
      p.responsavel_entrega,
      p.responsavel_retirada,
      p.motorista,
      COALESCE(itens.itens, '') AS itens,
      COALESCE(itens.quantidade_itens, 0) AS quantidade_itens,
      COALESCE(pg.total_pago, 0) AS total_pago,
      COALESCE(pg.reembolsos, 0) AS reembolsos,
      pg.formas_pagamento,
      COALESCE(oc.cobrancas_adicionais, 0) AS cobrancas_adicionais
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    LEFT JOIN endereco e ON e.id = p.endereco_id
    LEFT JOIN (
      SELECT
        pedido_id,
        SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) AS total_pago,
        SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END) AS reembolsos,
        GROUP_CONCAT(DISTINCT forma_pagamento ORDER BY forma_pagamento SEPARATOR ',') AS formas_pagamento
      FROM pagamentos
      GROUP BY pedido_id
    ) pg ON pg.pedido_id = p.id
    LEFT JOIN (
      SELECT pedido_id, SUM(valor) AS cobrancas_adicionais
      FROM ocorrencias
      WHERE tipo = 'COBRANCA' AND status <> 'CANCELADO' AND valor > 0
      GROUP BY pedido_id
    ) oc ON oc.pedido_id = p.id
    LEFT JOIN (
      SELECT
        pi.pedido_id,
        GROUP_CONCAT(
          CONCAT(COALESCE(cb.nome, pr.nome, 'Item'), ' (', pi.quantidade, ')')
          ORDER BY pi.id SEPARATOR ', '
        ) AS itens,
        SUM(pi.quantidade) AS quantidade_itens
      FROM pedido_itens pi
      LEFT JOIN produtos pr ON pr.id = pi.produto_id
      LEFT JOIN combos cb ON cb.id = pi.combo_id
      GROUP BY pi.pedido_id
    ) itens ON itens.pedido_id = p.id
    ${filtrosSql.pedidosSql}
    ORDER BY p.data_pedido DESC
  `, filtrosSql.pedidosParams);

  const [produtosRows] = await db.execute(`
    SELECT
      id,
      nome,
      categoria,
      estoque,
      COALESCE(estoque_em_uso, 0) AS alugados,
      COALESCE(estoque_reservado, 0) AS reservados,
      COALESCE(estoque_manutencao, 0) AS manutencao,
      COALESCE(estoque_danificado, 0) AS danificados,
      COALESCE(estoque_minimo, 0) AS estoque_minimo,
      COALESCE(preco_aluguel, 0) AS preco_aluguel,
      COALESCE(preco_venda, 0) AS preco_venda,
      GREATEST(
        COALESCE(estoque, 0)
        - COALESCE(estoque_reservado, 0)
        - COALESCE(estoque_em_uso, 0)
        - COALESCE(estoque_manutencao, 0)
        - COALESCE(estoque_danificado, 0),
        0
      ) AS disponivel
    FROM produtos
    ${filtrosSql.produtosSql}
    ORDER BY nome ASC
  `, filtrosSql.produtosParams);

  const pedidos = pedidosRows.map((pedido) => {
    const valor = Number(pedido.valor_total || 0);
    const totalPago = Number(pedido.total_pago || 0);
    const reembolsos = Number(pedido.reembolsos || 0);
    const recebido = totalPago;
    const saldo = calcularSaldoPendente(valor, recebido, reembolsos);
    const formasPagamento = pedido.formas_pagamento
      ? pedido.formas_pagamento.split(",").map((forma) => ({
          DINHEIRO: "Dinheiro",
          PIX: "Pix",
          CARTAO_DEBITO: "Cartão de débito",
          CARTAO_CREDITO: "Cartão de crédito",
          TRANSFERENCIA: "Transferência"
        }[forma] || forma)).join(", ")
      : "Não informado";

    return {
      num: Number(pedido.id),
      clienteId: Number(pedido.cliente_id),
      date: pedido.data_pedido ? new Date(pedido.data_pedido) : null,
      dataEvento: pedido.data_evento ? new Date(pedido.data_evento) : null,
      dataEntrega: pedido.data_entrega ? new Date(pedido.data_entrega) : null,
      dataRetirada: pedido.data_retirada ? new Date(pedido.data_retirada) : null,
      dataPrevista: pedido.data_retirada
        ? new Date(pedido.data_retirada)
        : pedido.data_entrega
          ? new Date(pedido.data_entrega)
          : null,
      dataEfetiva: pedido.data_retirada_hora
        ? new Date(pedido.data_retirada_hora)
        : pedido.data_entrega_hora
          ? new Date(pedido.data_entrega_hora)
          : null,
      entregador: pedido.responsavel_entrega || pedido.responsavel_retirada || pedido.motorista || "Não informado",
      itens: pedido.itens || "Sem itens",
      quantidadeItens: Number(pedido.quantidade_itens || 0),
      dataOperacao: pedido.data_retirada
        ? new Date(pedido.data_retirada)
        : pedido.data_entrega
          ? new Date(pedido.data_entrega)
          : pedido.data_evento
            ? new Date(pedido.data_evento)
            : null,
      cliente: pedido.cliente || "Cliente não informado",
      telefone: pedido.cliente_telefone || "Não informado",
      email: pedido.cliente_email || "Não informado",
      cliTipo: pedido.cliente_cpf ? "PF" : "Não informado",
      tipo: normalizarTipoPedido(pedido.tipo_pedido),
      status: normalizarStatusPedido(pedido.status, pedido.status_documento),
      statusDocumento: pedido.status_documento,
      valor,
      recebido,
      reembolsado: reembolsos,
      cobrancasAdicionais: Number(pedido.cobrancas_adicionais || 0),
      saldo,
      forma: formasPagamento,
      fin: normalizarFinanceiro({
        status: pedido.status,
        saldo,
        recebido,
        dataEvento: pedido.data_evento
      }),
      entTipo: pedido.data_retirada_hora || pedido.data_retirada ? "Retirada" : "Entrega",
      bairro: pedido.bairro || "Não informado",
      ent: normalizarEntrega(pedido.status)
    };
  });

  const produtos = produtosRows.map((produto) => ({
    id: Number(produto.id),
    nome: produto.nome,
    categoria: produto.categoria || "Sem categoria",
    estoque: Number(produto.estoque || 0),
    alugados: Number(produto.alugados || 0),
    reservados: Number(produto.reservados || 0),
    manutencao: Number(produto.manutencao || 0),
    danificados: Number(produto.danificados || 0),
    disp: Number(produto.disponivel || 0),
    estoqueMinimo: Number(produto.estoque_minimo || 0),
    preco: Number(produto.preco_aluguel || 0),
    valorUnitario: Number(produto.preco_venda || 0),
    valorEstoque: Number(produto.preco_venda || 0) * Number(produto.estoque || 0),
    situacao: Number(produto.disponivel || 0) === 0
      ? "Esgotado"
      : Number(produto.estoque_minimo || 0) > 0
        && Number(produto.disponivel || 0) <= Number(produto.estoque_minimo)
        ? "Estoque baixo"
        : "Disponível"
  }));
  let categorias = [];
  if (filtros.tab === "estoque") {
    const [categoriaRows] = await db.execute(`
      SELECT DISTINCT COALESCE(NULLIF(categoria, ''), 'Sem categoria') AS categoria
      FROM produtos
      WHERE ativo = 1
      ORDER BY categoria ASC
    `);
    categorias = categoriaRows.map((row) => row.categoria);
  }

  const clientesAgrupados = pedidos.reduce((acc, pedido) => {
    const key = pedido.clienteId;
    if (!acc[key]) {
      acc[key] = {
        id: pedido.clienteId,
        cliente: pedido.cliente,
        tipo: pedido.cliTipo,
        pedidos: 0,
        total: 0,
        date: pedido.date
      };
    }

    if (pedido.status !== "Cancelado" && pedido.status !== "Orçamento") {
      acc[key].pedidos += 1;
      acc[key].total += pedido.valor;
    }
    if (pedido.date && (!acc[key].date || pedido.date > acc[key].date)) acc[key].date = pedido.date;

    return acc;
  }, {});

  const clientes = Object.values(clientesAgrupados)
    .filter((cliente) => cliente.pedidos > 0)
    .sort((a, b) => b.total - a.total)
    .map((cliente) => ({
      id: cliente.id,
      cliente: cliente.cliente,
      tipo: cliente.tipo,
      pedidos: cliente.pedidos,
      total: cliente.total,
      date: cliente.date
    }));

  return {
    generatedAt: new Date().toISOString(),
    pedidos,
    clientes,
    produtos,
    categorias
  };
}

router.get("/", (req, res) => {
  const reportDataJson = JSON.stringify({ pedidos: [], clientes: [], produtos: [] })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  res.render("pages/relatorios", { reportDataJson });
});

router.get("/data", async (req, res) => {
  try {
    const tab = String(req.query.tab || "");
    if (tab && !["pedidos", "financeiro", "entregas", "clientes", "estoque"].includes(tab)) {
      return res.status(400).json({ error: "Tipo de relatório inválido." });
    }
    const data = await montarDadosRelatorio({
      tab,
      from: String(req.query.from || ""),
      to: String(req.query.to || ""),
      status: String(req.query.status || ""),
      extraKey: String(req.query.extraKey || ""),
      extra: String(req.query.extra || ""),
      q: String(req.query.q || "")
    });
    res.json(data);
  } catch (error) {
    console.error("Erro ao consultar dados do relatório:", error);
    const status = error.message === "Período inválido." || error.message === "O início do período deve anteceder o fim." ? 400 : 500;
    res.status(status).json({
      error: status === 400 ? error.message : "Não foi possível consultar os dados do relatório."
    });
  }
});

export default router;