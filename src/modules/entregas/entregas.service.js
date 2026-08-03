import * as model from "./entregas.model.js";

export async function listarPedidos(filtros) {
  // Já vem agregado por pedido (sem duplicação de JOIN)
  return await model.buscarPedidos(filtros);
}

export async function buscarPedido(id) {
  const pedido = await model.buscarPedidoPorId(id);
  if (!pedido) return null;

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

  return await model.marcarEntregue(id, dados);
}

export async function registrarDevolucao(id, dados) {
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  if (!itens.length) {
    throw new Error("Informe ao menos um item para devolução.");
  }

  return await model.registrarDevolucao(id, dados);
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

  const descricao = (dados.descricao || "Ocorrência registrada").toString().trim();
  if (!descricao) {
    throw new Error("Informe uma descrição.");
  }

  return await model.inserirOcorrencia(id, {
    ...dados,
    valor,
    descricao,
    tipo: dados.tipo || "Geral"
  });
}
