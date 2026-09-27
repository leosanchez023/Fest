import * as model from "./devedores.model.js";
import * as pedidosService from "../pedidos/pedidos.service.js";

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function resolvePeriod(period) {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (period === "current_month") return formatDateInput(currentMonth);
  if (period === "last_month") {
    return formatDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  }
  if (period === "last_3_months") {
    return formatDateInput(new Date(now.getFullYear(), now.getMonth() - 3, 1));
  }
  return null;
}

function normalizeFilters(query = {}) {
  const overdue = ["all", "1", "7", "15", "30", "60", "90"].includes(query.overdue)
    ? query.overdue
    : "all";
  const period = ["all", "current_month", "last_month", "last_3_months"].includes(query.period)
    ? query.period
    : "all";

  return {
    client: String(query.client || "").trim().slice(0, 100),
    overdue,
    period,
    periodFrom: resolvePeriod(period)
  };
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    ...row,
    valor_total: normalizeMoney(row.valor_total),
    total_pago: normalizeMoney(row.total_pago),
    saldo_pendente: normalizeMoney(row.saldo_pendente),
    dias_em_atraso: Number(row.dias_em_atraso || 0)
  }));
}

export async function listar(query) {
  const filtros = normalizeFilters(query);
  const [rows, resumo] = await Promise.all([
    model.listarDevedores(filtros),
    model.resumoDevedores(filtros)
  ]);

  return {
    filtros,
    devedores: normalizeRows(rows),
    resumo: {
      total_pedidos: Number(resumo.total_pedidos || 0),
      total_clientes: Number(resumo.total_clientes || 0),
      valor_em_aberto: normalizeMoney(resumo.valor_em_aberto),
      pedidos_em_atraso: Number(resumo.pedidos_em_atraso || 0),
      valor_vencido: normalizeMoney(resumo.valor_vencido)
    }
  };
}

export async function registrarPagamento(pedidoId, dados, usuarioId) {
  const valor = Number(dados.valor || 0);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor de pagamento inválido.");
  }

  const financeiro = await pedidosService.buscarFinanceiroPedido(pedidoId);
  if (!financeiro) throw new Error("Pedido não encontrado.");
  if (valor > Number(financeiro.saldo || 0)) {
    throw new Error("O pagamento não pode exceder o saldo pendente.");
  }

  return pedidosService.adicionarPagamentoPedido(pedidoId, {
    ...dados,
    valor,
    usuario_id: usuarioId || null
  });
}

export function filtrosParaQuery(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.client) params.set("client", filtros.client);
  if (filtros.overdue && filtros.overdue !== "all") params.set("overdue", filtros.overdue);
  if (filtros.period && filtros.period !== "all") params.set("period", filtros.period);
  return params.toString();
}
