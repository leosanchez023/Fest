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

export async function adicionarPagamento(req, res) {
  try {
    const id = req.params.id;
    const { valor, forma_pagamento, observacao, usuario_id } = req.body;
    await service.adicionarPagamento(id, { valor, forma_pagamento, observacao, usuario_id });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro adicionarPagamento:', err);
    return res.status(500).json({ message: 'Erro ao adicionar pagamento' });
  }
}

export async function marcarEntregue(req, res) {
  try {
    const id = req.params.id;
    const { motorista, veiculo, responsavel_entrega } = req.body;
    await service.marcarEntregue(id, { motorista, veiculo, responsavel_entrega });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro marcarEntregue:', err);
    return res.status(500).json({ message: 'Erro ao marcar entregue' });
  }
}

export async function marcarRetirado(req, res) {
  try {
    const id = req.params.id;
    const { responsavel_retirada } = req.body;
    await service.marcarRetirado(id, { responsavel_retirada });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro marcarRetirado:', err);
    return res.status(500).json({ message: 'Erro ao marcar retirado' });
  }
}

export async function finalizarConferencia(req, res) {
  try {
    const id = req.params.id;
    await service.finalizarConferencia(id);
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro finalizarConferencia:', err);
    return res.status(500).json({ message: 'Erro ao finalizar conferência' });
  }
}

export async function registrarOcorrencia(req, res) {
  try {
    const id = req.params.id;
    const { tipo, descricao, valor, usuario_id } = req.body;
    await service.registrarOcorrencia(id, { tipo, descricao, valor, usuario_id });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro registrarOcorrencia:', err);
    return res.status(500).json({ message: 'Erro ao registrar ocorrência' });
  }
}
