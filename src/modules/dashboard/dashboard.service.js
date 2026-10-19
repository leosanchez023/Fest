import db from "../../../database/connection.js";
import { calcularSaldoPendente } from "../pedidos/financeiro.js";

const pad = (value) => String(value).padStart(2, "0");
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value) => (value ? new Date(value) : null);
const safeNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildSeries = (rows, from, to) => {
  const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
  const groupedByDay = days <= 45;
  const map = new Map();

  if (groupedByDay) {
    for (let i = 0; i < days; i += 1) {
      const current = addDays(from, i);
      map.set(toIso(current), { rotulo: `${pad(current.getDate())}/${pad(current.getMonth() + 1)}`, valor: 0 });
    }
  } else {
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
      map.set(key, { rotulo: `${cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${String(cursor.getFullYear()).slice(2)}`, valor: 0 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  rows.forEach((row) => {
    if (!row.date) return;
    const key = groupedByDay ? toIso(row.date) : `${row.date.getFullYear()}-${pad(row.date.getMonth() + 1)}`;
    const bucket = map.get(key);
    if (bucket) {
      bucket.valor += safeNumber(row.valor);
    }
  });

  return [...map.values()];
};

const getPeriodWindow = (periodo) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let inicio;
  switch (periodo) {
    case "7":
      inicio = addDays(hoje, -6);
      break;
    case "mes":
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      break;
    case "90":
      inicio = addDays(hoje, -89);
      break;
    case "365":
      inicio = addDays(hoje, -364);
      break;
    default:
      inicio = addDays(hoje, -(Number(periodo || 30) - 1));
  }

  const span = Math.max(1, Math.round((hoje - inicio) / 86400000) + 1);
  const prevTo = addDays(inicio, -1);
  const prevFrom = addDays(prevTo, -(span - 1));

  return { inicio, fim: hoje, prevFrom, prevTo };
};

export async function montarDadosDashboard(periodo = "30") {
  const [pedidosRows] = await db.execute(`
    SELECT
      p.id,
      p.data_pedido,
      p.data_evento,
      p.data_entrega,
      p.data_retirada,
      p.tipo_pedido,
      p.status_documento,
      p.status,
      p.valor_total,
      c.nome AS cliente,
      COALESCE(pg.total_pago, 0) AS total_pago,
      COALESCE(pg.reembolsos, 0) AS reembolsos
    FROM pedidos p
    LEFT JOIN cliente c ON c.id = p.cliente_id
    LEFT JOIN (
      SELECT
        pedido_id,
        SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) AS total_pago,
        SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END) AS reembolsos
      FROM pagamentos
      GROUP BY pedido_id
    ) pg ON pg.pedido_id = p.id
    ORDER BY p.data_pedido DESC
  `);

  const [produtosRows] = await db.execute(`
    SELECT
      id,
      nome,
      categoria,
      estoque,
      COALESCE(estoque_em_uso, 0) AS alugados,
      COALESCE(preco_venda, 0) AS preco_venda,
      COALESCE(estoque_minimo, 0) AS estoque_minimo
    FROM produtos
    WHERE ativo = 1
    ORDER BY alugados DESC, nome ASC
  `);

  const pedidos = pedidosRows.map((pedido) => {
    const valor = safeNumber(pedido.valor_total, 0);
    const totalPago = safeNumber(pedido.total_pago, 0);
    const reembolsos = safeNumber(pedido.reembolsos, 0);
    const recebido = Math.max(totalPago - reembolsos, 0);
    const saldo = calcularSaldoPendente(valor, totalPago, reembolsos);
    const date = parseDate(pedido.data_pedido);

    return {
      num: Number(pedido.id),
      date,
      cliente: pedido.cliente || "Cliente não informado",
      status: pedido.status || "PENDENTE",
      tipo: pedido.tipo_pedido || "ALUGUEL",
      valor,
      recebido,
      saldo,
      fin: saldo > 0 ? "Pendente" : "Pago"
    };
  });

  const { inicio, fim, prevFrom, prevTo } = getPeriodWindow(periodo);
  const atual = pedidos.filter((pedido) => pedido.date && pedido.date >= inicio && pedido.date <= fim);
  const anterior = pedidos.filter((pedido) => pedido.date && pedido.date >= prevFrom && pedido.date <= prevTo);

  const somar = (lista, campo) => lista.reduce((total, item) => total + safeNumber(item[campo], 0), 0);
  const faturamentoAtual = somar(atual.filter((pedido) => pedido.status !== "CANCELADO" && pedido.status !== "ORCAMENTO"), "valor");
  const faturamentoAnterior = somar(anterior.filter((pedido) => pedido.status !== "CANCELADO" && pedido.status !== "ORCAMENTO"), "valor");
  const aReceber = atual.filter((pedido) => pedido.fin !== "Pago" && pedido.saldo > 0);
  const atrasados = aReceber.filter((pedido) => pedido.fin === "Pendente" || pedido.saldo > 0);
  const pedidosHoje = atual.filter((pedido) => pedido.date && toIso(pedido.date) === toIso(fim)).length;

  const statusPedidos = Object.entries(
    atual.reduce((acc, pedido) => {
      const key = pedido.status || "PENDENTE";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([rotulo, valor]) => ({ rotulo, valor }));

  const topProdutos = produtosRows
    .map((produto) => ({
      rotulo: produto.nome,
      valor: Math.max(1, Number(produto.alugados || 0))
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);

  const agenda = atual
    .slice(0, 6)
    .map((pedido) => ({
      data: pedido.date ? toIso(pedido.date) : toIso(fim),
      hora: "09:00",
      tipo: pedido.tipo === "ALUGUEL" ? "Entrega" : "Retirada",
      cliente: pedido.cliente,
      bairro: "Local",
      pedido: pedido.num,
      situacao: "Agendada"
    }));

  const alertas = [];
  if (atrasados.length > 0) {
    alertas.push({
      nivel: "bad",
      titulo: `${atrasados.length} pagamentos em atraso`,
      detalhe: `Total de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(somar(atrasados, "saldo"))}`,
      link: "financeiro"
    });
  }
  if (aReceber.length > 0) {
    alertas.push({
      nivel: "warn",
      titulo: `${aReceber.length} lançamentos em aberto`,
      detalhe: `Valor pendente: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(somar(aReceber, "saldo"))}`,
      link: "financeiro"
    });
  }
  alertas.push({
    nivel: "info",
    titulo: pedidosHoje ? `${pedidosHoje} pedido(s) hoje` : "Nenhum pedido hoje",
    detalhe: "Acompanhe a agenda e os próximos atendimentos.",
    link: "pedidos"
  });

  const percentual = (atualValor, anteriorValor) => {
    if (!Number.isFinite(atualValor) || !Number.isFinite(anteriorValor) || anteriorValor === 0) {
      return null;
    }
    return ((atualValor - anteriorValor) / anteriorValor) * 100;
  };

  return {
    periodo: { de: toIso(inicio), ate: toIso(fim) },
    kpis: [
      {
        rotulo: "Faturamento",
        valor: faturamentoAtual,
        formato: "moeda",
        variacao: percentual(faturamentoAtual, faturamentoAnterior),
        detalhe: null,
        cor: "#6d4aff"
      },
      {
        rotulo: "Pedidos no período",
        valor: atual.length,
        formato: "inteiro",
        variacao: percentual(atual.length, anterior.length),
        detalhe: null,
        cor: "#2f7cf6"
      },
      {
        rotulo: "A receber",
        valor: somar(aReceber, "saldo"),
        formato: "moeda",
        variacao: null,
        detalhe: `${aReceber.length} lançamentos em aberto`,
        cor: "#e8a317"
      },
      {
        rotulo: "Em atraso",
        valor: somar(atrasados, "saldo"),
        formato: "moeda",
        variacao: null,
        detalhe: `${atrasados.length} lançamentos vencidos`,
        cor: "#e5484d"
      }
    ],
    faturamento: buildSeries(atual.filter((pedido) => pedido.status !== "CANCELADO" && pedido.status !== "ORCAMENTO"), inicio, fim),
    statusPedidos,
    agenda,
    alertas,
    ultimosPedidos: atual
      .slice(0, 6)
      .map((pedido) => ({
        num: pedido.num,
        data: pedido.date ? toIso(pedido.date) : toIso(fim),
        cliente: pedido.cliente,
        status: pedido.status,
        valor: pedido.valor
      })),
    topProdutos
  };
}
