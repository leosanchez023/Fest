import * as service from "./entregas.service.js";

export async function listarPedidos(req, res) {
  try {
    const { search, from, to, status, pay, delivery } = req.query;

    const pedidos = await service.listarPedidos({
      search: search?.trim() || null,
      from:   from   || null,
      to:     to     || null,
      status: status || null,
      pay:    pay    || null,
      delivery: delivery || null,
    });

    return res.json(pedidos);
  } catch (err) {
    console.error("Erro listarPedidos:", err);
    return res.status(500).json({ message: "Erro ao buscar pedidos" });
  }
}

export async function buscarPedido(req, res) {
  try {
    const pedido = await service.buscarPedido(req.params.id);
    if (!pedido) return res.status(404).json({ message: "Pedido não encontrado" });
    return res.json(pedido);
  } catch (err) {
    console.error("Erro buscarPedido:", err);
    return res.status(500).json({ message: "Erro ao buscar pedido" });
  }
}

export async function kpis(req, res) {
  try {
    const data = await service.kpis();
    return res.json(data);
  } catch (err) {
    console.error("Erro kpis:", err);
    return res.status(500).json({ message: "Erro ao calcular KPIs" });
  }
}
