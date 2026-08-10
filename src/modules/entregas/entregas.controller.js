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

export async function relatorio(req, res) {
  try {
    const idsParam = req.query.ids || '';
    const ids = idsParam.split(',').map((s) => Number(s)).filter(Boolean);
    const results = [];
    let pos = 1;
    for (const id of ids) {
      const pedido = await service.buscarPedido(id);
      if (pedido) {
        const telefone_contato =
          pedido.telefone_contato?.trim() ||
          pedido.telefone?.trim() ||
          pedido.telefone_cliente?.trim() ||
          pedido.cliente?.telefone?.trim() ||
          "Não informado";
        const formatMoney = (value) =>
          typeof value === "number"
            ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : value || "-";

        const data_evento_formatada = pedido.data_evento
          ? new Date(pedido.data_evento).toLocaleDateString("pt-BR")
          : "Não informado";
        const data_entrega_formatada = pedido.data_entrega
          ? new Date(pedido.data_entrega).toLocaleDateString("pt-BR")
          : "Não informado";
        const data_retirada_formatada = pedido.data_retirada
          ? new Date(pedido.data_retirada).toLocaleDateString("pt-BR")
          : "Não informado";
        const observacoes_entrega = pedido.observacao_entrega?.trim() || pedido.observacoes?.trim() || "-";

        results.push({
          pos,
          pedido,
          itens: pedido.itens || [],
          telefone_contato,
          data_evento_formatada,
          data_entrega_formatada,
          data_retirada_formatada,
          observacoes_entrega,
          valor_total_formatado: formatMoney(Number(pedido.valor_total || 0)),
          valor_frete_formatado: formatMoney(Number(pedido.valor_frete || 0)),
          valor_desconto_formatado: formatMoney(Number(pedido.valor_desconto || 0)),
          valor_pago_formatado: formatMoney(Number(pedido.valor_pago || 0)),
        });
        pos++;
      }
    }
    return res.render("pages/relatorio_entregas", {
      layout: false,
      pedidos: results,
      data_rota: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("Erro relatorio:", err);
    return res.status(500).send("Erro ao gerar relatório");
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

    const {
      data_entrega,
      responsavel_entrega,
      observacao_entrega,
      usuario_id
    } = req.body;

    const resultado = await service.marcarEntregue(id, {
      data_entrega,
      responsavel_entrega,
      observacao_entrega,
      usuario_id
    });

    return res.json({
      sucesso: true,
      resultado
    });

  } catch (err) {
    console.error("Erro marcarEntregue:", err);

    return res.status(500).json({
      message: err.message,
      stack: err.stack
    });
  }
}

export async function registrarDevolucao(req, res) {
  try {
    const id = req.params.id;
    const { itens, observacao, responsavel, usuario_id } = req.body;

    await service.registrarDevolucao(id, {
      itens,
      observacao,
      responsavel,
      usuario_id
    });

    return res.json({ sucesso: true });

  } catch (err) {
    console.error("================================");
    console.error("ERRO AO REGISTRAR DEVOLUÇÃO");
    console.error("Mensagem:", err.message);
    console.error("SQL:", err.sqlMessage);
    console.error("Código:", err.code);
    console.error(err);
    console.error("================================");

    return res.status(500).json({
      message: err.message,
      sql: err.sqlMessage,
      code: err.code
    });
  }
}

export async function registrarReembolso(req, res) {
  try {
    const id = req.params.id;
    const { valor, forma_pagamento, observacao, usuario_id } = req.body;
    await service.registrarReembolso(id, { valor, forma_pagamento, observacao, usuario_id });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro registrarReembolso:', err);
    return res.status(500).json({ message: err.message });
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

export async function marcarConferencia(req, res) {
  try {
    await service.marcarConferencia(req.params.id);
    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao marcar conferência" });
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
