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
  return pedido;
}

export async function kpis() {
  return await model.kpis();
}

export async function adicionarPagamento(id, dados) {
  return await model.inserirPagamento(id, dados);
}

export async function marcarEntregue(id, dados) {
  return await model.marcarEntregue(id, dados);
}

export async function marcarRetirado(id, dados) {
  return await model.marcarRetirado(id, dados);
}

export async function finalizarConferencia(id) {
  return await model.finalizarConferencia(id);
}

export async function registrarOcorrencia(id, dados) {
  return await model.inserirOcorrencia(id, dados);
}
