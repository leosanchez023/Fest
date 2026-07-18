const $ = (id) => document.getElementById(id);

const formatMoney = (value) =>
  "R$ " + Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split("T")[0];
  return date.toLocaleDateString("pt-BR");
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ");
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const badgeClass = (type) => {
  return {
    success: "b-success",
    warning: "b-warning",
    danger: "b-danger",
    info: "b-info",
    muted: "b-muted",
  }[type] || "b-muted";
};

const renderBadge = (text, type) =>
  `<span class="badge ${badgeClass(type)}">${text || "-"}</span>`;

const paymentStatus = (paid, total) => {
  if (paid <= 0) return "Não Pago";
  if (paid < total) return "Parcialmente Pago";
  return "Pago Integralmente";
};

const deliveryStatus = (status) => {
  return {
    ORCAMENTO: "Aguardando Entrega",
    CONFIRMADO: "Aguardando Entrega",
    EM_PREPARO: "Em Rota",
    ENTREGUE: "Entregue",
    RETIRADO: "Entregue",
    FINALIZADO: "Entregue",
    CANCELADO: "Cancelado",
  }[status] || "Aguardando Entrega";
};

const orderStatusBadge = (status) => {
  switch (status) {
    case "ORCAMENTO":
    case "CONFIRMADO":
      return renderBadge(status, "info");
    case "EM_PREPARO":
      return renderBadge(status, "warning");
    case "ENTREGUE":
    case "RETIRADO":
    case "FINALIZADO":
      return renderBadge(status, "success");
    case "CANCELADO":
      return renderBadge(status, "danger");
    default:
      return renderBadge(status, "muted");
  }
};

let orders = [];
let activeKpiFilter = null;
let currentOrderId = null;

const getFilters = () => {
  const params = new URLSearchParams();
  const search = $("f-search").value.trim();
  const from = $("f-from").value;
  const to = $("f-to").value;
  const status = $("f-status").value;
  const pay = $("f-pay").value;
  const delivery = $("f-deliv").value;

  if (search) params.append("search", search);
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  if (status) params.append("status", status);
  if (pay) params.append("pay", pay);
  if (delivery) params.append("delivery", delivery);

  return params;
};

const normalizeOrder = (o) => {
  return {
    ...o,
    cliente: o.cliente || o.nome_cliente || "-",
    telefone: o.telefone || o.telefone_contato || "-",
    cpf: o.cpf || "-",
    valor_total: Number(o.valor_total || 0),
    valor_pago: Number(o.valor_pago || 0),
    endereco_rua: o.endereco_rua || o.rua || "",
    endereco_numero: o.endereco_numero || o.numero || "",
    endereco_bairro: o.endereco_bairro || o.bairro || "",
    endereco_cidade: o.endereco_cidade || o.cidade || "",
    endereco_estado: o.endereco_estado || o.estado || "",
    endereco_cep: o.endereco_cep || o.cep || "",
    itens: Array.isArray(o.itens) ? o.itens : [],
    pagamentos: Array.isArray(o.pagamentos) ? o.pagamentos : [],
  };
};

const renderTable = () => {
  const tbody = $("orders-tbody");
  if (!tbody) return;

  const todayStr = new Date().toISOString().split("T")[0];

  const filtered = orders.filter((o) => {
    if (activeKpiFilter === "active") {
      return o.status !== "FINALIZADO" && o.status !== "CANCELADO";
    }
    if (activeKpiFilter === "delivery") {
      return o.data_entrega?.split("T")[0] === todayStr;
    }
    if (activeKpiFilter === "pickup") {
      return o.data_retirada?.split("T")[0] === todayStr;
    }
    if (activeKpiFilter === "late") {
      return Number(o.valor_pago || 0) < Number(o.valor_total || 0);
    }
    return true;
  });

  $("count-badge").textContent = `${filtered.length} pedidos`;

  tbody.innerHTML = filtered
    .map(
      (o) => `
        <tr>
          <td><strong>${o.id}</strong></td>
          <td>
            <div style="font-weight:600;">${o.cliente}</div>
            <div class="muted">${o.telefone}</div>
          </td>
          <td>${formatDate(o.data_evento)}</td>
          <td>${formatDate(o.data_entrega)}</td>
          <td>${formatDate(o.data_retirada)}</td>
          <td>
            <strong>${formatMoney(o.valor_total)}</strong>
            <div class="progress"><div style="width:${Math.min(100, Math.round((o.valor_pago / Math.max(1, o.valor_total)) * 100))}%"></div></div>
            <div class="muted">${paymentStatus(o.valor_pago, o.valor_total)}</div>
          </td>
          <td>${formatMoney(o.valor_pago)}</td>
          <td>${orderStatusBadge(o.status)}</td>
          <td><button class="btn" type="button" onclick="openModal(${o.id})">Ver</button></td>
        </tr>
      `
    )
    .join("");
};

const renderKPIs = () => {
  const todayStr = new Date().toISOString().split("T")[0];
  const active = orders.filter((o) => o.status !== "FINALIZADO" && o.status !== "CANCELADO").length;
  const delivery = orders.filter((o) => o.data_entrega?.split("T")[0] === todayStr).length;
  const pickup = orders.filter((o) => o.data_retirada?.split("T")[0] === todayStr).length;
  const late = orders.filter((o) => Number(o.valor_pago || 0) < Number(o.valor_total || 0) && o.status !== "FINALIZADO" && o.status !== "CANCELADO").length;

  $("kpi-active").textContent = active;
  $("kpi-delivery").textContent = delivery;
  $("kpi-pickup").textContent = pickup;
  $("kpi-late").textContent = late;
};

const renderAlerts = () => {
  const alerts = [];
  const overdue = orders.filter((o) => Number(o.valor_pago || 0) < Number(o.valor_total || 0));

  if (overdue.length) {
    alerts.push({
      class: "a-warning",
      icon: "dollar-sign",
      title: `${overdue.length} pedidos com saldo`,
      desc: formatMoney(overdue.reduce((sum, o) => sum + (Number(o.valor_total || 0) - Number(o.valor_pago || 0)), 0)),
    });
  }

  if (!alerts.length) {
    alerts.push({
      class: "a-success",
      icon: "check-circle",
      title: "Tudo em ordem!",
      desc: "Sem pendências",
    });
  }

  $("alerts").innerHTML = alerts
    .map(
      (item) => `
        <div class="alert ${item.class}">
          <i class="lucide lucide-${item.icon}"></i>
          <div>
            <div class="title">${item.title}</div>
            <div class="desc">${item.desc}</div>
          </div>
        </div>
      `
    )
    .join("");
};

const loadOrders = async () => {
  try {
    const res = await fetch(`/entregas/pedidos?${getFilters()}`);
    if (!res.ok) throw new Error("Erro ao carregar pedidos");
    orders = (await res.json()).map(normalizeOrder);
    renderKPIs();
    renderAlerts();
    renderTable();
  } catch (error) {
    console.error(error);
  }
};

const renderOrderHeader = (order) => {
  const idEl = $("m-id");
  const customerEl = $("m-customer");
  const statusEl = $("m-status");

  if (idEl) idEl.textContent = `PED-${String(order.id).padStart(4, "0")}`;
  if (customerEl) customerEl.textContent = order.cliente;
  if (statusEl) statusEl.innerHTML = orderStatusBadge(order.status);
};

const renderTimeline = (order) => {
  const steps = [
    {
      title: "Pedido criado",
      done: true,
      meta: formatDateTime(order.data_pedido || order.data_pedido),
      color: "success",
    },
    {
      title: "Pagamento inicial",
      done: order.pagamentos?.length > 0,
      meta: order.pagamentos?.length > 0 ? `${formatDateTime(order.pagamentos[0].data_pagamento)} • ${order.pagamentos[0].forma_pagamento}` : "Sem pagamento",
      color: order.pagamentos?.length > 0 ? "success" : "muted",
    },
    {
      title: "Entrega",
      done: !!order.data_entrega,
      meta: order.data_entrega ? formatDateTime(order.data_entrega) : "Pendente",
      color: order.data_entrega ? "info" : "muted",
    },
    {
      title: "Evento",
      done: !!order.data_evento,
      meta: order.data_evento ? formatDate(order.data_evento) : "Pendente",
      color: order.data_evento ? "info" : "muted",
    },
    {
      title: "Retirada",
      done: !!order.data_retirada,
      meta: order.data_retirada ? formatDateTime(order.data_retirada) : "Pendente",
      color: order.data_retirada ? "info" : "muted",
    },
  ];

  $("m-timeline").innerHTML = `
    <div class="timeline-steps">
      ${steps
        .map(
          (step, index) => `
            <div class="timeline-step ${step.done ? "done" : "pending"}">
              <div class="marker">${index + 1}</div>
              <div class="step-body">
                <div class="step-title">${step.title}</div>
                <div class="step-meta ${step.color}">${step.meta}</div>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const renderOrderPanels = (order) => {
  const address = order.endereco_rua
    ? `${order.endereco_rua}${order.endereco_numero ? `, ${order.endereco_numero}` : ""}`
    : "-";
  const itemsHtml = order.itens
    .map(
      (item) => `
        <tr>
          <td>${item.produto_nome || item.nome || "-"}</td>
          <td>${item.quantidade}</td>
          <td>${formatMoney(item.valor_unitario)}</td>
          <td>${formatMoney(item.subtotal)}</td>
        </tr>
      `
    )
    .join("") || `<tr><td colspan="4" style="text-align:center; color:#6b7280;">Nenhum item cadastrado</td></tr>`;

  $("m-dados").innerHTML = `
    <div class="grid grid-2" style="gap:16px; margin-bottom:16px;">
      <div class="section-card">
        <div class="section-title">Dados do cliente</div>
        <div class="field-row"><span class="l">Cliente</span><span class="v">${order.cliente}</span></div>
        <div class="field-row"><span class="l">Telefone</span><span class="v">${order.telefone}</span></div>
        <div class="field-row"><span class="l">CPF/CNPJ</span><span class="v">${order.cpf || "-"}</span></div>
        <div class="field-row"><span class="l">Endereço</span><span class="v">${address}</span></div>
        <div class="field-row"><span class="l">Bairro</span><span class="v">${order.endereco_bairro || "-"}</span></div>
        <div class="field-row"><span class="l">Cidade</span><span class="v">${order.endereco_cidade || "-"}</span></div>
      </div>
      <div class="section-card">
        <div class="section-title">Detalhes do pedido</div>
        <div class="field-row"><span class="l">Evento</span><span class="v">${formatDate(order.data_evento)}</span></div>
        <div class="field-row"><span class="l">Local</span><span class="v">${order.local_evento || "-"}</span></div>
        <div class="field-row"><span class="l">Tipo</span><span class="v">${order.tipo_pedido || "-"}</span></div>
        <div class="field-row"><span class="l">Contato</span><span class="v">${order.telefone_contato || "-"}</span></div>
        <div class="field-row"><span class="l">Status</span><span class="v">${orderStatusBadge(order.status)}</span></div>
      </div>
    </div>
    <div class="section-card">
      <div class="section-title">Itens do pedido</div>
      <table class="table-bordered" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qtd</th>
            <th>Valor unit.</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
  `;

  const saldo = Number(order.valor_total || 0) - Number(order.valor_pago || 0);
  const pagamentoLabel = paymentStatus(order.valor_pago, order.valor_total);

  $("m-fin").innerHTML = `
    <div class="grid grid-3" style="gap:16px; margin-bottom:16px;">
      <div class="section-card">
        <div class="section-title">Total</div>
        <div class="field-row"><span class="v">${formatMoney(order.valor_total)}</span></div>
      </div>
      <div class="section-card">
        <div class="section-title">Pago</div>
        <div class="field-row"><span class="v">${formatMoney(order.valor_pago)}</span></div>
      </div>
      <div class="section-card">
        <div class="section-title">Saldo</div>
        <div class="field-row"><span class="v">${formatMoney(saldo)}</span></div>
      </div>
    </div>
    <div class="section-card">
      <div class="section-title">Situação financeira</div>
      <div class="field-row"><span class="l">Pagamento</span><span class="v">${renderBadge(pagamentoLabel, order.valor_pago < order.valor_total ? "warning" : "success")}</span></div>
      <div class="field-row"><span class="l">Entrega</span><span class="v">${renderBadge(deliveryStatus(order.status), ["ENTREGUE", "RETIRADO", "FINALIZADO"].includes(order.status) ? "success" : "info")}</span></div>
    </div>
    <div class="section-card">
      <div class="section-title">Histórico de pagamentos</div>
      <table class="table-bordered" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th>Data</th>
            <th>Forma</th>
            <th>Valor</th>
            <th>Obs</th>
          </tr>
        </thead>
        <tbody>
          ${order.pagamentos.length
            ? order.pagamentos
                .map(
                  (payment) => `
                    <tr>
                      <td>${formatDateTime(payment.data_pagamento)}</td>
                      <td>${payment.forma_pagamento || "-"}</td>
                      <td>${formatMoney(payment.valor)}</td>
                      <td>${payment.observacao || "-"}</td>
                    </tr>
                  `
                )
                .join("")
            : `<tr><td colspan="4" style="text-align:center; color:#6b7280;">Nenhum pagamento registrado</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const deliveryDate = order.data_entrega ? formatDate(order.data_entrega) : "-";
  const pickupDate = order.data_retirada ? formatDate(order.data_retirada) : "-";

  $("m-log").innerHTML = `
    <div class="data-grid" style="gap:16px;">
      <div class="section-card">
        <div class="section-title">Entrega</div>
        <div class="field-row"><span class="l">Data</span><span class="v">${deliveryDate}</span></div>
        <div class="field-row"><span class="l">Motorista</span><span class="v">${order.motorista || "-"}</span></div>
        <div class="field-row"><span class="l">Veículo</span><span class="v">${order.veiculo || "-"}</span></div>
        <div class="field-row"><span class="l">Responsável</span><span class="v">${order.responsavel_entrega || "-"}</span></div>
      </div>
      <div class="section-card">
        <div class="section-title">Retirada</div>
        <div class="field-row"><span class="l">Data</span><span class="v">${pickupDate}</span></div>
        <div class="field-row"><span class="l">Responsável</span><span class="v">${order.responsavel_retirada || "-"}</span></div>
        <div class="field-row"><span class="l">Observação</span><span class="v">${order.observacao_retirada || "-"}</span></div>
      </div>
    </div>
  `;

  // ações: botões para marcar entregue/retirado
  const logActions = document.createElement("div");
  logActions.style.marginTop = "10px";
  logActions.innerHTML = `
    <div style="display:flex; gap:8px; margin-top:8px;">
      <button class="btn-primary btn" onclick="markEntregue(${order.id})">Marcar como Entregue</button>
      <button class="btn-primary btn" onclick="markRetirado(${order.id})">Marcar como Retirado</button>
    </div>
  `;
  $("m-log").appendChild(logActions);

  // adicionar botão de registrar pagamento no financeiro
  const finActions = document.createElement("div");
  finActions.style.marginTop = "12px";
  finActions.innerHTML = `
    <div style="display:flex; gap:8px;">
      <button class="btn-primary btn" id="show-pay-form">Registrar Pagamento</button>
      <button class="btn btn" id="gen-charge">Gerar Cobrança Extra</button>
    </div>
    <div id="m-pay-form" style="margin-top:12px; display:none;">
      <div style="display:flex; gap:8px; max-width:520px;">
        <input id="pay-valor" placeholder="Valor" />
        <select id="pay-forma"><option value="PIX">PIX</option><option value="DINHEIRO">DINHEIRO</option><option value="CARTAO_DEBITO">CARTAO_DEBITO</option><option value="CARTAO_CREDITO">CARTAO_CREDITO</option></select>
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        <input id="pay-obs" placeholder="Observação" style="flex:1;" />
        <button class="btn-primary btn" id="submit-pay">Salvar</button>
      </div>
    </div>
  `;
  $("m-fin").appendChild(finActions);

  $("show-pay-form").addEventListener("click", () => {
    const f = $("m-pay-form");
    f.style.display = f.style.display === "none" ? "block" : "none";
  });

  $("submit-pay").addEventListener("click", async () => {
    const valor = parseFloat($("pay-valor").value.replace(',', '.')) || 0;
    const forma_pagamento = $("pay-forma").value;
    const observacao = $("pay-obs").value;
    try {
      const res = await fetch(`/entregas/pedidos/${order.id}/pagamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor, forma_pagamento, observacao })
      });
      if (!res.ok) throw new Error('Falha ao salvar pagamento');
      alert('Pagamento registrado');
      openOrderModal(order.id);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar pagamento');
    }
  });

  $("gen-charge").addEventListener("click", async () => {
    const amount = prompt('Valor da cobrança extra (use ponto decimal):');
    if (!amount) return;
    const val = parseFloat(amount);
    if (Number.isNaN(val)) return alert('Valor inválido');
    try {
      const res = await fetch(`/entregas/pedidos/${order.id}/ocorrencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'Cobranca Extra', descricao: 'Cobrança gerada pelo usuário', valor: val })
      });
      if (!res.ok) throw new Error('Falha ao gerar cobrança');
      alert('Cobrança registrada como ocorrência');
      openOrderModal(order.id);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar cobrança');
    }
  });

  const devolucaoRows = order.itens
    .map((item) => {
      const missing = Math.max(0, item.quantidade - (Number(item.quantidade_entregue) || 0));
      const damaged = 0;
      return `
        <tr>
          <td>${item.produto_nome || item.nome || "-"}</td>
          <td>${item.quantidade}</td>
          <td>${item.quantidade_entregue || 0}</td>
          <td>${item.quantidade_devolvida || 0}</td>
          <td>${missing}</td>
          <td>${damaged}</td>
        </tr>
      `;
    })
    .join("") || `<tr><td colspan="6" style="text-align:center; color:#6b7280;">Nenhum item registrado</td></tr>`;

  $("m-dev").innerHTML = `
    <div class="section-card">
      <div class="section-title">Conferência de itens</div>
      <table class="table-bordered" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Enviado</th>
            <th>Entregue</th>
            <th>Devolvido</th>
            <th>Faltante</th>
            <th>Danificado</th>
          </tr>
        </thead>
        <tbody>${devolucaoRows}</tbody>
      </table>
    </div>
  `;

  // botões na aba Devolução
  const devActions = document.createElement('div');
  devActions.style.marginTop = '10px';
  devActions.innerHTML = `
    <div style="display:flex; gap:8px;">
      <button class="btn-primary btn" onclick="finalizarConferencia(${order.id})">Finalizar Conferência</button>
      <button class="btn" onclick="markRetirado(${order.id})">Marcar como Retirado</button>
    </div>
  `;
  $("m-dev").appendChild(devActions);

  const occurrences = [];
  if (order.observacoes) occurrences.push({ date: order.data_pedido, type: "Observação", description: order.observacoes });
  if (order.observacao_entrega) occurrences.push({ date: order.data_entrega || order.data_pedido, type: "Entrega", description: order.observacao_entrega });
  if (order.observacao_retirada) occurrences.push({ date: order.data_retirada || order.data_pedido, type: "Retirada", description: order.observacao_retirada });

  $("m-oco").innerHTML = occurrences.length
    ? occurrences
        .map(
          (occ) => `
            <div class="alert a-warning" style="margin-bottom:12px;">
              <i class="lucide lucide-alert-circle"></i>
              <div>
                <div class="title">${occ.type} • ${formatDate(occ.date)}</div>
                <div class="desc">${occ.description}</div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="alert a-success"><i class="lucide lucide-check-circle"></i><div><div class="title">Sem ocorrências</div><div class="desc">Nenhuma anotação registrada para este pedido.</div></div></div>`;

  // adicionar formulário rápido de ocorrência
  const ocoForm = document.createElement('div');
  ocoForm.style.marginTop = '12px';
  ocoForm.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; max-width:600px; margin-top:12px;">
      <div style="display:flex; gap:8px;"><input id="oco-tipo" placeholder="Tipo" style="width:200px;" /><input id="oco-valor" placeholder="Valor (opcional)" style="width:140px;" /></div>
      <textarea id="oco-desc" placeholder="Descrição" rows="2" style="width:100%;"></textarea>
      <div style="display:flex; gap:8px;"><button class="btn-primary btn" id="oco-submit">Registrar Ocorrência</button></div>
    </div>
  `;
  $("m-oco").appendChild(ocoForm);

  $("oco-submit").addEventListener('click', () => submitOcorrencia(order.id));
};

// Ações de backend chamadas pela UI
const markEntregue = async (id) => {
  if (!confirm('Confirmar marcar como entregue?')) return;
  try {
    const res = await fetch(`/entregas/pedidos/${id}/marcar-entregue`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
    if (!res.ok) throw new Error('Falha ao marcar entregue');
    alert('Pedido marcado como entregue');
    openOrderModal(id);
    loadOrders();
  } catch (err) {
    console.error(err);
    alert('Erro ao marcar entregue');
  }
};

const markRetirado = async (id) => {
  if (!confirm('Confirmar marcar como retirado?')) return;
  try {
    const res = await fetch(`/entregas/pedidos/${id}/marcar-retirado`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
    if (!res.ok) throw new Error('Falha ao marcar retirado');
    alert('Pedido marcado como retirado');
    openOrderModal(id);
    loadOrders();
  } catch (err) {
    console.error(err);
    alert('Erro ao marcar retirado');
  }
};

const finalizarConferencia = async (id) => {
  if (!confirm('Finalizar conferência e marcar pedido como finalizado?')) return;
  try {
    const res = await fetch(`/entregas/pedidos/${id}/finalizar-conferencia`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao finalizar conferência');
    alert('Conferência finalizada');
    openOrderModal(id);
    loadOrders();
  } catch (err) {
    console.error(err);
    alert('Erro ao finalizar conferência');
  }
};

const submitOcorrencia = async (id) => {
  const tipo = $("oco-tipo").value || 'Geral';
  const descricao = $("oco-desc").value || '';
  const valor = parseFloat($("oco-valor").value.replace(',', '.') || 0) || 0;
  try {
    const res = await fetch(`/entregas/pedidos/${id}/ocorrencias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, descricao, valor })
    });
    if (!res.ok) throw new Error('Falha ao registrar ocorrência');
    alert('Ocorrência registrada');
    openOrderModal(id);
  } catch (err) {
    console.error(err);
    alert('Erro ao registrar ocorrência');
  }
};

window.markEntregue = markEntregue;
window.markRetirado = markRetirado;
window.finalizarConferencia = finalizarConferencia;
window.submitOcorrencia = submitOcorrencia;

const openOrderModal = async (id) => {
  currentOrderId = id;

  try {
    const res = await fetch(`/entregas/pedidos/${id}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    const order = await res.json();

    const normalized = normalizeOrder(order);

    renderOrderHeader(normalized);
    renderTimeline(normalized);
    renderOrderPanels(normalized);

    $("modal").classList.add("open");
  } catch (error) {
    console.error("openOrderModal error:", error);
    alert("Erro ao abrir o pedido: " + error.message);
  }
};

window.openModal = openOrderModal;
window.openOrderModal = openOrderModal;

const closeModal = () => {
  $("modal").classList.remove("open");
};

const filterByKpi = (filter) => {
  activeKpiFilter = filter;
  renderTable();
};

const activateTabs = () => {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      $("tab-" + tab.dataset.tab).classList.add("active");
    });
  });
};

const init = () => {
  window.carregarPedidos = loadOrders;
  window.closeModal = closeModal;
  window.filterByKpi = filterByKpi;

  loadOrders();
  activateTabs();

  ["f-from", "f-to", "f-status", "f-pay", "f-deliv"].forEach((id) => {
    $(id)?.addEventListener("change", loadOrders);
  });

  $("f-search")?.addEventListener("input", () => {
    clearTimeout(window.searchTimer);
    window.searchTimer = setTimeout(loadOrders, 300);
  });

  $("modal")?.addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });
};

window.addEventListener("DOMContentLoaded", init);
