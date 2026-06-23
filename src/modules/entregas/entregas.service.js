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
