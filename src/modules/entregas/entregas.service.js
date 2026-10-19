import * as model from "./entregas.model.js";

const normalizarStatus = (pedido) => ({
  ...pedido,
  status: pedido?.status ? String(pedido.status).trim().toUpperCase() : pedido?.status
});

export function calcularSaldoPendente(total, entradasPagamento) {
  const valorTotal = Number(total || 0);
  const entradas = entradasPagamento || [];
  const valorRecebido = entradas.reduce((sum, amount) => {
    const value = Number(amount || 0);
    return sum + (value > 0 ? value : 0);
  }, 0);
  const valorReembolsado = entradas.reduce((sum, amount) => {
    const value = Number(amount || 0);
    return sum + (value < 0 ? Math.abs(value) : 0);
  }, 0);
  return Math.max(0, valorTotal - valorRecebido - valorReembolsado);
}

export async function listarPedidos(filtros) {
  const resultado = await model.buscarPedidos(filtros);
  return {
    ...resultado,
    rows: resultado.rows.map(normalizarStatus)
  };
}

export async function buscarPedido(id) {
  const pedido = await model.buscarPedidoPorId(id);
  if (!pedido) return null;

  pedido.status = normalizarStatus(pedido).status;

  pedido.itens       = await model.itensDoPedido(id);
  pedido.pagamentos  = await model.pagamentosDoPedido(id);
  pedido.ocorrencias = await model.ocorrenciasDoPedido(id);
  pedido.devolucoes  = await model.devolucoesDoPedido(id);
  return pedido;
}

export async function kpis() {
  return await model.kpis();
}

export async function adicionarPagamento(id, dados) {
  return await model.inserirPagamento(id, dados);
}

export async function marcarEntregue(id, dados) {
  const dataEntrega = (dados.data_entrega || '').toString().trim();
  const responsavel = (dados.responsavel_entrega || '').toString().trim();

  if (!dataEntrega) {
    throw new Error("Informe a data e hora da entrega.");
  }
  if (!responsavel) {
    throw new Error("Informe o responsável pela entrega.");
  }
  if (Number.isNaN(new Date(dataEntrega).getTime())) {
    throw new Error("Informe uma data e hora válidas para a entrega.");
  }

  return await model.marcarEntregue(id, {
    ...dados,
    data_entrega: dataEntrega,
    responsavel_entrega: responsavel
  });
}

export async function registrarDevolucao(id, dados) {
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  if (!itens.length) {
    throw new Error("Informe ao menos um item para devolução.");
  }

  return await model.registrarDevolucao(id, dados);
}

export async function registrarReembolso(id, dados) {
  const valor = Number(dados.valor || 0);
  if (valor <= 0) {
    throw new Error("Valor do reembolso deve ser maior que zero.");
  }

  return await model.inserirReembolso(id, dados);
}

export async function marcarRetirado(id, dados) {
  return await model.marcarRetirado(id, dados);
}

export async function marcarConferencia(id) {
  return await model.marcarConferencia(id);
}

export async function finalizarConferencia(id) {
  return await model.finalizarConferencia(id);
}

export async function registrarOcorrencia(id, dados) {
  const valor = Number(dados.valor || 0);
  if (valor < 0) {
    throw new Error("Valor inválido.");
  }

  const descricaoInformada = (dados.descricao || "").toString().trim();
  if ((dados.tipo || "").toString().trim().toUpperCase() === "COBRANCA" && !descricaoInformada) {
    throw new Error("Informe uma observação para a cobrança.");
  }
  const descricao = descricaoInformada || "Ocorrência registrada";

  return await model.inserirOcorrencia(id, {
    ...dados,
    valor,
    descricao,
    tipo: dados.tipo || "Geral"
  });
}
