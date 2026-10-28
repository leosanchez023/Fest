import * as service from "./entregas.service.js";

export async function listarPedidos(req, res) {
  try {
    const { search, from, to, status, pay, delivery, sort, kpi } = req.query;
    const page = Number.parseInt(req.query.page, 10);
    const limit = Number.parseInt(req.query.limit, 10);

    const resultado = await service.listarPedidos({
      search: search?.trim() || null,
      from:   from   || null,
      to:     to     || null,
      status: status || null,
      pay:    pay    || null,
      delivery: delivery || null,
      kpi: ["active", "delivery", "pickup", "late"].includes(kpi) ? kpi : null,
      sort: sort === "event_asc" ? "event_asc" : "event_desc",
      page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000000) : 1,
      limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25,
    });

    res.set({
      "X-Total-Count": String(resultado.total),
      "X-Page": String(resultado.page),
      "X-Page-Size": String(resultado.limit),
    });
    return res.json(resultado.rows);
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
    const rawIds = idsParam.split(',').map((value) => value.trim()).filter(Boolean);
    const ids = [...new Set(rawIds.map((value) => Number(value)))];
    if (!ids.length || ids.length > 100 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).send('Seleção de pedidos inválida.');
    }

    const results = [];
    let pos = 1;
    for (const id of ids) {
      const pedido = await service.buscarPedido(id);
      if (pedido) {
        const total = Number(pedido.valor_total || 0);
        const pago = Number(pedido.valor_pago || 0);
        const reembolsado = Number(pedido.valor_reembolsado || 0);
        const saldoPendente = service.calcularSaldoPendente(
          total,
          (pedido.pagamentos || []).map((pagamento) => pagamento.valor)
        );
        const formatMoney = (value) => Number(value || 0).toLocaleString("pt-BR", {
          style: "currency", currency: "BRL"
        });
        const formatDate = (value) => {
          if (!value) return '____/____/______';
          const isoDate = value instanceof Date
            ? value.toISOString().slice(0, 10)
            : String(value).slice(0, 10);
          return isoDate.split('-').reverse().join('/');
        };
        const endereco = [
          [pedido.endereco_rua, pedido.endereco_numero].filter(Boolean).join(', '),
          pedido.endereco_bairro,
          [pedido.endereco_cidade, pedido.endereco_estado].filter(Boolean).join(' - '),
          pedido.endereco_cep ? `CEP ${pedido.endereco_cep}` : '',
          pedido.endereco_referencia
        ].filter(Boolean).join(' - ');

        results.push({
          pos,
          id: pedido.id,
          cliente: pedido.cliente || 'Não informado',
          telefone: pedido.telefone || '—',
          telefone_contato: pedido.telefone_contato || '—',
          entregador: pedido.responsavel_entrega || '',
          veiculo: pedido.veiculo || pedido.motorista || '',
          endereco: endereco || 'Não informado',
          data_entrega: formatDate(pedido.data_entrega),
          data_evento: formatDate(pedido.data_evento),
          data_retirada: formatDate(pedido.data_retirada),
          itens: (pedido.itens || []).map((item) => ({
            quantidade: Number(item.quantidade || 0),
            produto: item.produto_nome || item.combo_nome || 'Item do pedido'
          })),
          total_formatado: formatMoney(total),
          pago_formatado: formatMoney(pago),
          reembolsado_formatado: formatMoney(reembolsado),
          receber_formatado: formatMoney(saldoPendente),
          observacao: pedido.observacao_entrega?.trim() || pedido.observacoes?.trim() || ''
        });
        pos++;
      }
    }

    if (results.length !== ids.length) {
      return res.status(404).send('Um ou mais pedidos selecionados não foram encontrados.');
    }

    return res.render("pages/relatorio_entregas", {
      layout: false,
      pedidos: results,
      data_rota: new Date().toLocaleDateString('pt-BR'),
      entregador_rota: results.find((pedido) => pedido.entregador)?.entregador || '',
      veiculo_rota: results.find((pedido) => pedido.veiculo)?.veiculo || '',
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
    const { valor, forma_pagamento, observacao } = req.body;
    await service.adicionarPagamento(id, { valor, forma_pagamento, observacao, usuario_id: req.user?.id || null });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro adicionarPagamento:', err);
    return res.status(err.code ? 500 : 400).json({
      message: err.code ? 'Não foi possível concluir a operação.' : err.message
    });
  }
}

export async function marcarEntregue(req, res) {
  try {
    const id = req.params.id;

    const {
      data_entrega,
      responsavel_entrega,
      observacao_entrega
    } = req.body;

    const resultado = await service.marcarEntregue(id, {
      data_entrega,
      responsavel_entrega,
      observacao_entrega,
      usuario_id: req.user?.id || null
    });

    return res.json({
      sucesso: true,
      resultado
    });

  } catch (err) {
    console.error("Erro marcarEntregue:", err);

    return res.status(err.code ? 500 : 400).json({
      message: err.code ? 'Não foi possível concluir a operação.' : err.message
    });
  }
}

export async function registrarDevolucao(req, res) {
  try {
    const id = req.params.id;
    const { itens, observacao, responsavel, idempotency_key } = req.body;

    await service.registrarDevolucao(id, {
      itens,
      observacao,
      responsavel,
      idempotency_key,
      usuario_id: req.user?.id || null
    });

    return res.json({ sucesso: true });

  } catch (err) {
    console.error('Erro ao registrar devolução:', err);
    return res.status(err.code ? 500 : 400).json({
      message: err.code ? 'Não foi possível concluir a operação.' : err.message
    });
  }
}

export async function registrarReembolso(req, res) {
  try {
    const id = req.params.id;
    const { valor, forma_pagamento, observacao } = req.body;
    await service.registrarReembolso(id, { valor, forma_pagamento, observacao, usuario_id: req.user?.id || null });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro registrarReembolso:', err);
    return res.status(err.code ? 500 : 400).json({
      message: err.code ? 'Não foi possível concluir a operação.' : err.message
    });
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
    const resultado = await service.finalizarConferencia(id);
    return res.json({ sucesso: true, status: resultado.status });
  } catch (err) {
    console.error('Erro finalizarConferencia:', err);
    return res.status(500).json({ message: 'Erro ao finalizar conferência' });
  }
}

export async function registrarOcorrencia(req, res) {
  try {
    const id = req.params.id;
    const { tipo, descricao, valor } = req.body;
    await service.registrarOcorrencia(id, { tipo, descricao, valor, usuario_id: req.user?.id || null });
    return res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro registrarOcorrencia:', err);
    return res.status(err.code ? 500 : 400).json({
      message: err.code ? 'Erro ao registrar ocorrência' : err.message
    });
  }
}
