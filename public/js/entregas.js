console.log("entregas carregada")

const $ = (id) => document.getElementById(id);

const formatMoney = (value) =>
  "R$ " + Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split("T")[0] || "—";
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
  `<span class="badge ${badgeClass(type)}">${text || "—"}</span>`;

const formatAddress = (order) => {
  const parts = [order.endereco_rua, order.endereco_numero, order.endereco_bairro, order.endereco_cidade]
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
};

const paymentStatus = (paid, total) => {
  if (paid <= 0) return "Não Pago";
  if (paid < total) return "Parcialmente Pago";
  return "Pago Integralmente";
};

const deliveryStatus = (status) => {
  return {
    ORCAMENTO: "Aguardando",
    CONFIRMADO: "Aguardando",
    EM_PREPARO: "Em preparo/rota",
    ENTREGUE: "Entregue",
    RETIRADO: "Retirado",
    CONFERENCIA: "Em Conferência",
    PENDENTE: "Pendente",
    FINALIZADO: "Finalizado",
    CANCELADO: "Cancelado",
  }[status] || "Pendente";
};

const orderStatusBadge = (status) => {
  const label = deliveryStatus(status);
  switch (status) {
    case "ORCAMENTO":
      return renderBadge(label, "muted");
    case "CONFIRMADO":
      return renderBadge(label, "info");
    case "EM_PREPARO":
      return renderBadge(label, "warning");
    case "ENTREGUE":
      return renderBadge(label, "success");
    case "RETIRADO":
      return renderBadge(label, "info");
    case "CONFERENCIA":
      return renderBadge(label, "info");
    case "PENDENTE":
      return renderBadge(label, "warning");
    case "FINALIZADO":
      return renderBadge(label, "muted");
    case "CANCELADO":
      return renderBadge(label, "danger");
    default:
      return renderBadge(label, "muted");
  }
};

let orders = [];
let activeKpiFilter = null;
let currentOrderId = null;
let currentReturnItems = [];
let currentOrderContext = null;
let eventOrder = 'desc'; // 'desc' = mais recentes primeiro, 'asc' = mais antigos primeiro
let selectedOrders = new Set();

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
  // ordenação por data do evento
  params.append("sort", eventOrder === 'asc' ? 'event_asc' : 'event_desc');

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
    conferencia_finalizada: Number(o.conferencia_finalizada || 0) === 1,
    endereco_rua: o.endereco_rua || o.rua || "",
    endereco_numero: o.endereco_numero || o.numero || "",
    endereco_bairro: o.endereco_bairro || o.bairro || "",
    endereco_cidade: o.endereco_cidade || o.cidade || "",
    endereco_estado: o.endereco_estado || o.estado || "",
    endereco_cep: o.endereco_cep || o.cep || "",
    itens: Array.isArray(o.itens) ? o.itens : [],
    pagamentos: Array.isArray(o.pagamentos) ? o.pagamentos : [],
    ocorrencias: Array.isArray(o.ocorrencias) ? o.ocorrencias : [],
    devolucoes: Array.isArray(o.devolucoes) ? o.devolucoes : [],
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
    .map((o) => {
      const checked = selectedOrders.has(Number(o.id)) ? 'checked' : '';
      const totalPercent = Math.min(100, Math.round((o.valor_pago / Math.max(1, o.valor_total)) * 100));
      const saldo = Math.max(0, o.valor_total - o.valor_pago);
      const canDeliver = ["CONFIRMADO", "EM_PREPARO"].includes(o.status);
      return `
        <tr>
          <td><input type="checkbox" class="select-order" data-id="${o.id}" ${checked} /></td>
          <td><strong>${o.id}</strong></td>
          <td>
            <div style="font-weight:600;">${o.cliente}</div>
          </td>
          <td>${o.telefone || "—"}</td>
          <td>${formatAddress(o)}</td>
          <td>${formatDate(o.data_evento)}</td>
          <td>${formatDate(o.data_entrega)}</td>
          <td>${formatDate(o.data_retirada)}</td>
          <td>
            <strong>${formatMoney(o.valor_total)}</strong>
            <div class="progress"><div style="width:${totalPercent}%"></div></div>
            <div class="muted">${paymentStatus(o.valor_pago, o.valor_total)}</div>
          </td>
          <td>${formatMoney(o.valor_pago)}</td>
          <td>${formatMoney(saldo)}</td>
          <td>${orderStatusBadge(o.status)}</td>
          <td>
            <div class="delivery-actions">
              <button class="iconbtn" type="button" data-delivery-action="view" data-id="${o.id}" title="Visualizar pedido" aria-label="Visualizar pedido"><i class="fa-solid fa-eye"></i></button>
              <button class="iconbtn" type="button" data-delivery-action="payment" data-id="${o.id}" title="Registrar pagamento" aria-label="Registrar pagamento"><i class="fa-solid fa-money-bill"></i></button>
              <button class="iconbtn" type="button" data-delivery-action="charge" data-id="${o.id}" title="Gerar cobrança" aria-label="Gerar cobrança"><i class="fa-solid fa-file-invoice-dollar"></i></button>
              <button class="iconbtn" type="button" data-delivery-action="deliver" data-id="${o.id}" title="Marcar como entregue" aria-label="Marcar como entregue" ${canDeliver ? "" : "disabled"}><i class="fa-solid fa-truck"></i></button>
              ${o.status === "ENTREGUE" ? `<button class="iconbtn" type="button" data-delivery-action="return" data-id="${o.id}" title="Recolher" aria-label="Recolher"><i class="fa-solid fa-box-archive"></i></button>` : ""}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // ligar handlers de seleção
  document.querySelectorAll('.select-order').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = Number(cb.dataset.id);
      if (cb.checked) selectedOrders.add(id); else selectedOrders.delete(id);
      updateSelectedCount();
    });
  });

  tbody.querySelectorAll('[data-delivery-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.deliveryAction;
      if (action === 'view') return openOrderModal(id);
      if (action === 'deliver') return openOrderFinanceOrDelivery(id, 'delivery');
      if (action === 'payment') return openOrderFinanceOrDelivery(id, 'payment');
      if (action === 'charge') return openOrderFinanceOrDelivery(id, 'charge');
      if (action === 'return') return openOrderFinanceOrDelivery(id, 'return');
    });
  });

};

const updateSelectedCount = () => {
  const el = document.getElementById('selected-count');
  if (el) el.textContent = String(selectedOrders.size);
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
          <i class="fa-solid fa-${item.icon}"></i>
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
    console.log("Orders:", orders);
console.log(document.getElementById("orders-tbody"));
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
  const itens = Array.isArray(order.itens) ? order.itens : [];
  const pagamentos = Array.isArray(order.pagamentos) ? order.pagamentos : [];
  const devolucoes = Array.isArray(order.devolucoes) ? order.devolucoes : [];

  const createdDate = order.data_pedido || order.data_evento || null;
  const firstPayment = pagamentos
    .filter((payment) => Number(payment.valor || payment.valor_pago || 0) > 0)
    .sort((a, b) => new Date(a.data_pagamento || 0) - new Date(b.data_pagamento || 0))[0] || null;

  // A entrega deve ser considerada concluída somente pelo status do pedido
  const isDelivered = order.status === "ENTREGUE";

  const totalQty = itens.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const returnedQty = itens.reduce((sum, item) => sum + Number(item.quantidade_devolvida || 0), 0);
  const pendingReturnQty = Math.max(0, totalQty - returnedQty);
  const allItemsReturned = totalQty === 0 || returnedQty >= totalQty;
  const conferenceCompleted = Boolean(order.conferencia_finalizada);

  const totalValue = Number(order.valor_total || 0);
  const paidValue = Number(order.valor_pago || 0);
  const paymentComplete = paidValue >= totalValue;
  const finalStepCompleted = order.status === "FINALIZADO";

  const pendingReasons = [];
  if (!paymentComplete) {
    pendingReasons.push(`Falta pagamento de ${formatMoney(Math.max(0, totalValue - paidValue))}`);
  }
  if (!allItemsReturned) {
    pendingReasons.push(`${pendingReturnQty} item${pendingReturnQty === 1 ? "" : "s"} ainda ${pendingReturnQty === 1 ? "não foi" : "não foram"} devolvido${pendingReturnQty === 1 ? "" : "s"}`);
  }
  if (!conferenceCompleted) {
    pendingReasons.push("Conferência dos itens pendente");
  }

  const steps = [
    {
      title: "Pedido criado",
      state: "done",
      label: "Concluído",
      icon: "fa-circle-check",
      meta: createdDate ? formatDateTime(createdDate) : "Data de criação não informada",
    },
    {
      title: "Primeiro pagamento",
      state: firstPayment ? "done" : "waiting",
      label: firstPayment ? "Concluído" : "Aguardando",
      icon: firstPayment ? "fa-circle-check" : "fa-circle",
      meta: firstPayment
        ? `${formatDateTime(firstPayment.data_pagamento)} • ${formatMoney(firstPayment.valor || 0)}`
        : "Ainda não há pagamento registrado",
    },
    {
      title: "Pedido entregue",
      state: isDelivered ? "done" : "waiting",
      label: isDelivered ? "Concluído" : "Aguardando",
      icon: isDelivered ? "fa-circle-check" : "fa-circle",
      meta: isDelivered
        ? `${order.responsavel_entrega || "Responsável não informado"} • ${formatDateTime(order.data_entrega || order.data_retirada || order.data_evento)}`
        : "Entrega ainda não confirmada",
    },
    {
      title: "Devolução",
      // marcada como concluída somente se houver devolução registrada e todos os itens devolvidos
      state: devolucoes.length > 0 && allItemsReturned ? "done" : devolucoes.length > 0 && pendingReturnQty > 0 ? "pending" : "waiting",
      label: devolucoes.length > 0 && allItemsReturned ? "Concluído" : devolucoes.length > 0 && pendingReturnQty > 0 ? "Pendência" : "Aguardando",
      icon: devolucoes.length > 0 && allItemsReturned ? "fa-circle-check" : devolucoes.length > 0 && pendingReturnQty > 0 ? "fa-triangle-exclamation" : "fa-circle",
      meta: devolucoes.length > 0 && allItemsReturned
        ? `${devolucoes[devolucoes.length - 1]?.responsavel || "Responsável não informado"} • ${formatDateTime(devolucoes[devolucoes.length - 1]?.data_devolucao || order.data_retirada)}`
        : devolucoes.length > 0 && pendingReturnQty > 0
          ? `${pendingReturnQty} item${pendingReturnQty === 1 ? "" : "s"} ainda pendente${pendingReturnQty === 1 ? "" : "s"}`
          : "Aguardando devolução",
    },
    {
      title: "Conferência",
      state: conferenceCompleted ? "done" : "waiting",
      label: conferenceCompleted ? "Concluído" : "Aguardando",
      icon: conferenceCompleted ? "fa-circle-check" : "fa-circle",
      meta: conferenceCompleted
        ? "Conferência finalizada"
        : "Aguardando finalização da conferência",
    },
    {
      title: finalStepCompleted ? "Pedido finalizado" : "Pendências",
      state: finalStepCompleted ? "done" : "pending",
      label: finalStepCompleted ? "Concluído" : "Pendência",
      icon: finalStepCompleted ? "fa-circle-check" : "fa-triangle-exclamation",
      meta: finalStepCompleted ? "Todos os critérios do aluguel foram concluídos" : pendingReasons.join(" • "),
    },
  ];

  const getStepStyle = (state) => {
    if (state === "done") return { border: "1px solid #bbf7d0", background: "#f0fdf4", dot: "#16a34a", text: "#166534" };
    if (state === "pending") return { border: "1px solid #fde68a", background: "#fffbeb", dot: "#d97706", text: "#92400e" };
    return { border: "1px solid #e5e7eb", background: "#f8fafc", dot: "#94a3b8", text: "#475569" };
  };

  $("m-timeline").innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${steps
        .map((step) => {
          const style = getStepStyle(step.state);
          return `
            <div style="display:flex; gap:12px; align-items:flex-start; padding:12px 14px; border-radius:12px; border:${style.border}; background:${style.background};">
              <div style="width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; background:${style.dot}; flex-shrink:0;">
                <i class="fa-solid ${step.icon}" aria-hidden="true"></i>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
                  <strong style="font-size:14px; color:${style.text};">${step.title}</strong>
                  <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:${style.text};">${step.label}</span>
                </div>
                <div style="margin-top:4px; font-size:12px; color:#64748b; line-height:1.4;">${step.meta}</div>
              </div>
            </div>
          `;
        })
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
          <td>${item.combo_nome || item.produto_nome || item.nome || "—"}</td>
          <td>${item.quantidade ?? "—"}</td>
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
      <div class="field-row"><span class="l">Entrega</span><span class="v">${renderBadge(deliveryStatus(order.status), order.status === "ENTREGUE" ? "success" : "info")}</span></div>
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

  const deliveryDate = order.data_entrega ? formatDateTime(order.data_entrega_hora || order.data_entrega) : "-";
  const pickupDate = order.data_retirada ? formatDateTime(order.data_retirada_hora || order.data_retirada) : "-";
  const deliveredItems = (order.itens || []).reduce((sum, item) => sum + Number(item.quantidade_entregue || 0), 0);
  const returnedItems = (order.itens || []).reduce((sum, item) => sum + Number(item.quantidade_devolvida || 0), 0);
  const pendingItems = Math.max(0, deliveredItems - returnedItems);

  const itemRows = (order.itens || [])
    .map((item) => {
      const enviada = Number(item.quantidade || 0);
      const entregue = Number(item.quantidade_entregue || 0);
      const devolvida = Number(item.quantidade_devolvida || 0);
      const faltante = Math.max(0, entregue - devolvida);
      const danificada = 0;
      return `
        <tr>
          <td>${item.combo_nome || item.produto_nome || item.nome || "—"}</td>
          <td>${enviada}</td>
          <td>${entregue}</td>
          <td>${devolvida}</td>
          <td>${faltante}</td>
          <td>${danificada}</td>
        </tr>
      `;
    })
    .join("") || `<tr><td colspan="6" style="text-align:center; color:#6b7280;">Nenhum item cadastrado</td></tr>`;

  const actionButtons = [];
  if (["CONFIRMADO", "EM_PREPARO"].includes(order.status)) {
    actionButtons.push(`<button class="btn-primary btn" id="show-delivery-modal" type="button">Marcar como Entregue</button>`);
  }
  if (order.status === "ENTREGUE") {
    actionButtons.push(`<button class="btn-primary btn" id="show-return-modal" type="button">Registrar Devolução</button>`);
  }
  if (["RETIRADO", "PENDENTE"].includes(order.status)) {
    actionButtons.push(`<button class="btn-primary btn" onclick="markConferencia(${order.id})">Iniciar Conferência</button>`);
  }
  if (["CONFERENCIA", "PENDENTE"].includes(order.status)) {
    actionButtons.push(`<button class="btn btn" onclick="finalizarConferencia(${order.id})">Finalizar Conferência</button>`);
  }

  $("m-log").innerHTML = `
    <div style="display:grid; gap:16px;">
      <div class="grid grid-2" style="gap:16px;">
        <div class="section-card">
          <div class="section-title">Entrega</div>
          <div class="field-row"><span class="l">Data</span><span class="v">${deliveryDate}</span></div>
          <div class="field-row"><span class="l">Responsável</span><span class="v">${order.responsavel_entrega || "-"}</span></div>
          <div class="field-row"><span class="l">Observação</span><span class="v">${order.observacao_entrega || "-"}</span></div>
        </div>
        <div class="section-card">
          <div class="section-title">Retirada</div>
          <div class="field-row"><span class="l">Data</span><span class="v">${pickupDate}</span></div>
          <div class="field-row"><span class="l">Responsável</span><span class="v">${order.responsavel_retirada || "-"}</span></div>
          <div class="field-row"><span class="l">Observação</span><span class="v">${order.observacao_retirada || "-"}</span></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">Controle de itens</div>
        <table class="table-bordered" style="width:100%; margin-top:12px;">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Enviada</th>
              <th>Entregue</th>
              <th>Devolvida</th>
              <th>Faltante</th>
              <th>Danificada</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <div class="section-card">
        <div class="section-title">Resumo da devolução</div>
        <div class="grid grid-3" style="margin-top:10px; gap:12px;">
          <div class="field-row"><span class="l">Quantidade entregue</span><span class="v">${deliveredItems}</span></div>
          <div class="field-row"><span class="l">Quantidade devolvida</span><span class="v">${returnedItems}</span></div>
          <div class="field-row"><span class="l">Quantidade pendente</span><span class="v">${pendingItems}</span></div>
        </div>
        ${actionButtons.length ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">${actionButtons.join("")}</div>` : ""}
      </div>
    </div>
  `;

  const finActions = document.createElement("div");
  finActions.style.marginTop = "12px";
  finActions.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn-primary btn" id="show-pay-form" type="button">Registrar Pagamento</button>
      <button class="btn btn" id="gen-charge" type="button">Gerar Cobrança</button>
      <button class="btn btn" id="show-refund-form" type="button">Fazer Restituição</button>
    </div>
  `;
  $("m-fin").appendChild(finActions);

  setTimeout(() => {
    const deliveryBtn = document.getElementById("show-delivery-modal");
    if (deliveryBtn) deliveryBtn.onclick = () => openDeliveryModal(order);
    const returnBtn = document.getElementById("show-return-modal");
    if (returnBtn) returnBtn.onclick = () => openReturnModal(order);
  }, 0);

  const openFinanceModal = (mode) => {
    const modal = $("finance-modal");
    const title = $("finance-modal-title");
    const valor = $("finance-valor");
    const descricao = $("finance-descricao");
    const availableEl = $("finance-available");
    const confirmBtn = $("finance-confirm-btn");
    const formaPagamentoSelect = $("finance-forma-pagamento");
    const methodGroup = $("finance-method-group");

    title.textContent = mode === "payment" ? "Registrar pagamento" : mode === "refund" ? "Fazer restituição" : "Gerar cobrança";
    valor.value = "";
    descricao.value = "";
    formaPagamentoSelect.value = "";
    const recebido = (order.pagamentos || []).reduce((total, pagamento) => {
      const valor = Number(pagamento.valor || 0);
      return total + (valor > 0 ? valor : 0);
    }, 0);
    const restituido = (order.pagamentos || []).reduce((total, pagamento) => {
      const valor = Number(pagamento.valor || 0);
      return total + (valor < 0 ? Math.abs(valor) : 0);
    }, 0);
    const disponivel = Math.max(0, recebido - restituido);
    if (availableEl) {
      availableEl.textContent = mode === "refund"
        ? `Pago: ${formatMoney(recebido)} | Já restituído: ${formatMoney(restituido)} | Disponível: ${formatMoney(disponivel)}`
        : "";
    }
    valor.max = mode === "refund" ? disponivel.toFixed(2) : "";
    methodGroup.style.display = mode === "payment" || mode === "refund" ? "block" : "none";
    modal.dataset.mode = mode;
    modal.classList.add("open");
    valor.focus();

    confirmBtn.onclick = async () => {
      const value = Number(parseFloat(valor.value.replace(',', '.')) || 0);
      const text = (descricao.value || "").trim();

      if (!value || value <= 0) {
        alert("Informe um valor válido.");
        return;
      }

      if (mode === "refund" && value > disponivel) {
        alert(`O valor máximo disponível para restituição é ${formatMoney(disponivel)}.`);
        return;
      }

      if (mode === "charge" && !text) {
        alert("Informe uma descrição ou observação.");
        return;
      }

      try {
        if (mode === "payment") {
          const metodo = (formaPagamentoSelect.value || "").trim();
          if (!metodo) {
            alert("Selecione a forma de pagamento.");
            return;
          }

          const res = await fetch(`/entregas/pedidos/${order.id}/pagamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valor: value, forma_pagamento: metodo, observacao: text })
          });
          if (!res.ok) {
            const erro = await res.json().catch(() => ({}));
            throw new Error(erro.message || "Falha ao salvar pagamento");
          }
        } else if (mode === "refund") {
          const metodo = (formaPagamentoSelect.value || "").trim();
          if (!metodo) {
            alert("Selecione a forma de restituição.");
            return;
          }
          const res = await fetch(`/entregas/pedidos/${order.id}/reembolso`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valor: value, forma_pagamento: metodo, observacao: text })
          });
          if (!res.ok) {
            const erro = await res.json().catch(() => ({}));
            throw new Error(erro.message || "Falha ao registrar restituição");
          }
        } else {
          const res = await fetch(`/entregas/pedidos/${order.id}/ocorrencias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: "COBRANCA", descricao: text, valor: value })
          });
          if (!res.ok) {
            const erro = await res.json().catch(() => ({}));
            throw new Error(erro.message || "Falha ao gerar cobrança");
          }
        }

        closeFinanceModal();
        openOrderModal(order.id);
      } catch (err) {
        console.error(err);
        alert(`Erro ao ${mode === "payment" ? "registrar pagamento" : mode === "refund" ? "registrar restituição" : "gerar cobrança"}: ${err.message}`);
      }
    };
  };

  const closeFinanceModal = () => {
    $("finance-modal").classList.remove("open");
  };

  $("show-pay-form").onclick = () => openFinanceModal("payment");
  $("gen-charge").onclick = () => openFinanceModal("charge");
  $("show-refund-form").onclick = () => openFinanceModal("refund");
  $("finance-cancel-btn").onclick = closeFinanceModal;
  $("finance-modal").onclick = (event) => {
    if (event.target.id === "finance-modal") closeFinanceModal();
  };
  $("delivery-cancel-btn").onclick = closeDeliveryModal;
  $("delivery-confirm-btn").onclick = markEntregue;
  $("delivery-modal").onclick = (event) => {
    if (event.target.id === "delivery-modal") closeDeliveryModal();
  };
  $("return-cancel-btn").onclick = closeReturnModal;
  $("return-confirm-btn").onclick = submitReturn;
  $("return-modal").onclick = (event) => {
    if (event.target.id === "return-modal") closeReturnModal();
  };

  setTimeout(() => {
    const returnBtn = document.getElementById("show-return-modal");
    if (returnBtn) returnBtn.onclick = () => openReturnModal(order);
  }, 0);

  const occurrences = [];
  if (order.observacoes) occurrences.push({ date: order.data_pedido, type: "Observação", description: order.observacoes });
  if (order.observacao_entrega) occurrences.push({ date: order.data_entrega || order.data_pedido, type: "Entrega", description: order.observacao_entrega });
  if (order.observacao_retirada) occurrences.push({ date: order.data_retirada || order.data_pedido, type: "Retirada", description: order.observacao_retirada });

  $("m-oco").innerHTML = occurrences.length
    ? occurrences
        .map(
          (occ) => `
            <div class="alert a-warning" style="margin-bottom:12px;">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <div>
                <div class="title">${occ.type} • ${formatDate(occ.date)}</div>
                <div class="desc">${occ.description}</div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="alert a-success"><i class="fa-solid fa-circle-check"></i><div><div class="title">Sem ocorrências</div><div class="desc">Nenhuma anotação registrada para este pedido.</div></div></div>`;

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

const openDeliveryModal = (order) => {
  currentOrderContext = order;
  const modal = $("delivery-modal");
  $("delivery-datetime").value = order.data_entrega_hora ? order.data_entrega_hora.slice(0, 16) : new Date().toISOString().slice(0, 16);
  $("delivery-responsavel").value = order.responsavel_entrega || "";
  $("delivery-observacao").value = order.observacao_entrega || "";
  modal.classList.add("open");
};

const closeDeliveryModal = () => {
  $("delivery-modal").classList.remove("open");
};

const openOrderFinanceOrDelivery = async (id, mode) => {
  await openOrderModal(id);
  const buttonId = mode === "delivery"
    ? "show-delivery-modal"
    : mode === "payment"
      ? "show-pay-form"
      : mode === "return"
        ? "show-return-modal"
        : "gen-charge";
  document.getElementById(buttonId)?.click();
};

const openReturnModal = (order) => {
  currentOrderContext = order;
  currentReturnItems = (order.itens || []).map((item) => ({
    produto_id: item.produto_id,
    nome: item.combo_nome || item.produto_nome || item.nome || "Produto",
    quantidade: Number(item.quantidade_entregue || item.quantidade || 0),
    combo_id: item.combo_id || null,
    item_id: item.id,
    quantidade_devolvida: Number(item.quantidade_devolvida || 0),
    valor_unitario: Number(item.valor_unitario || item.valor_unitario || 0),
    quantidade_pendente: Math.max(0, Number(item.quantidade_entregue || item.quantidade || 0) - Number(item.quantidade_devolvida || 0)),
  })).filter((item) => item.quantidade_pendente > 0);

  const body = $("return-modal-body");
  body.innerHTML = `
    <div class="return-items">
      <table style="width:100%;">
        <thead><tr><th>Produto</th><th>Alugado</th><th>Devolvido</th><th>Pendente</th><th>Qtd. devolvida</th></tr></thead>
        <tbody>
          ${currentReturnItems.map((item, index) => `
            <tr>
              <td>${item.nome}</td>
              <td>${item.quantidade}</td>
              <td>${item.quantidade_devolvida}</td>
              <td>${item.quantidade_pendente}</td>
              <td><input type="number" min="0" max="${item.quantidade_pendente}" value="0" data-index="${index}" class="return-input" /></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div style="margin-top:10px;">
        <label>Responsável</label>
        <input id="return-responsavel" placeholder="Nome do responsável" />
      </div>
      <div style="margin-top:10px;">
        <label>Observação</label>
        <textarea id="return-observacao" rows="3" placeholder="Informações da devolução"></textarea>
      </div>
      <div style="margin-top:12px;">
        <div><strong>Produtos devolvidos:</strong> <span id="return-total">R$ 0,00</span></div>
        <div style="margin-top:6px;"><strong>Valor do reembolso sugerido:</strong> <span id="return-refund">R$ 0,00</span></div>
      </div>
    </div>
  `;
  $("return-modal").classList.add("open");

  // atualizar totais quando usuário digitar quantidades
  const inputs = Array.from(document.querySelectorAll('#return-modal-body input.return-input'));
  const totalEl = document.getElementById('return-total');
  const refundEl = document.getElementById('return-refund');

  const formatMoneyLocal = (v) => formatMoney(v);

  const recompute = () => {
    let total = 0;
    inputs.forEach((inp) => {
      const idx = Number(inp.dataset.index || 0);
      const qtd = Number(inp.value || 0);
      const item = currentReturnItems[idx];
      if (qtd > 0 && item) {
        total += qtd * Number(item.valor_unitario || 0);
      }
    });
    if (totalEl) totalEl.textContent = formatMoneyLocal(total);
    if (refundEl) refundEl.textContent = formatMoneyLocal(total);
  };

  inputs.forEach((inp) => inp.addEventListener('input', () => {
    // validar limites
    const max = Number(inp.max || 0);
    let v = Number(inp.value || 0);
    if (v < 0) inp.value = 0;
    if (v > max) inp.value = max;
    recompute();
  }));

  // inicial compute
  recompute();
};

const closeReturnModal = () => {
  $("return-modal").classList.remove("open");
};

// Ações de backend chamadas pela UI
const markEntregue = async () => {
  const order = currentOrderContext;
  if (!order) return;
  const datetime = $("delivery-datetime").value;
  const responsavel = $("delivery-responsavel").value.trim();
  const observacao = $("delivery-observacao").value.trim();

  if (!datetime || !responsavel) {
    alert("Informe a data/hora e o responsável da entrega.");
    return;
  }

  try {
    const res = await fetch(`/entregas/pedidos/${order.id}/marcar-entregue`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ data_entrega: datetime, responsavel_entrega: responsavel, observacao_entrega: observacao, usuario_id: 1 })
    });
    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new Error(erro.message || 'Falha ao marcar entregue');
    }
    closeDeliveryModal();
    await openOrderModal(order.id);
    await loadOrders();
  } catch (err) {
    console.error(err);
    alert(`Erro ao marcar entregue: ${err.message}`);
  }
};

const submitReturn = async () => {
  const order = currentOrderContext;
  if (!order) return;

  const rows = Array.from(document.querySelectorAll("#return-modal-body input[type='number']"));
  const itens = rows.map((input) => {
    const index = Number(input.dataset.index || 0);
    const item = currentReturnItems[index];
    const qtd = Number(input.value || 0);
    return {
      id: item.item_id,
      produto_id: item.produto_id,
      combo_id: item.combo_id,
      quantidade_entregue: item.quantidade,
      quantidade_devolvida: qtd,
      observacao: "",
    };
  }).filter((item) => item.quantidade_devolvida > 0);

  const responsavel = $("return-responsavel").value.trim();
  const observacao = $("return-observacao").value.trim();

  if (!itens.length) {
    alert("Informe ao menos uma quantidade para devolução.");
    return;
  }

  if (!responsavel) {
    alert("Informe o responsável pela devolução.");
    return;
  }

  try {
    const res = await fetch(`/entregas/pedidos/${order.id}/devolucoes`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ itens, observacao, responsavel, usuario_id: 1 })
    });
    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new Error(erro.message || erro.sql || 'Falha ao registrar devolução');
    }
    closeReturnModal();
    await openOrderModal(order.id);
    await loadOrders();
  } catch (err) {
    console.error(err);
    alert('Erro ao registrar devolução');
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

const markConferencia = async (id) => {
  if (!confirm('Marcar pedido como em conferência?')) return;
  try {
    const res = await fetch(`/entregas/pedidos/${id}/marcar-conferencia`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao atualizar conferência');
    alert('Pedido marcado em conferência');
    openOrderModal(id);
    loadOrders();
  } catch (err) {
    console.error(err);
    alert('Erro ao marcar conferência');
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
window.markConferencia = markConferencia;
window.finalizarConferencia = finalizarConferencia;
window.submitOcorrencia = submitOcorrencia;
window.submitReturn = submitReturn;

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
    currentOrderContext = normalized;

    renderOrderHeader(normalized);
    renderTimeline(normalized);
    renderOrderPanels(normalized);

    $("modal").classList.add("open");
    return normalized;
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

const updateEventOrderIndicator = () => {
  const button = document.getElementById("toggle-event-order");
  if (!button) return;
  const recentesPrimeiro = eventOrder === "desc";
  button.textContent = recentesPrimeiro ? "↓" : "↑";
  button.title = recentesPrimeiro
    ? "Mais recentes para mais antigos"
    : "Mais antigos para mais recentes";
  button.setAttribute("aria-label", `Ordenação: ${button.title.toLowerCase()}`);
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

  // Alternar ordem por evento
  const toggleBtn = document.getElementById('toggle-event-order');
  if (toggleBtn) {
    updateEventOrderIndicator();
    toggleBtn.addEventListener('click', () => {
      eventOrder = eventOrder === 'desc' ? 'asc' : 'desc';
      updateEventOrderIndicator();
      loadOrders();
    });
  }

  // seleção: botões
  const selectAllBtn = document.getElementById('select-all');
  const deselectAllBtn = document.getElementById('deselect-all');
  const invertBtn = document.getElementById('invert-selection');
  const toggleOrderBtn = document.getElementById('toggle-order');
  const genBtn = document.getElementById('generate-report');

  if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
    orders.forEach(o => selectedOrders.add(Number(o.id)));
    renderTable(); updateSelectedCount();
  });
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', () => { selectedOrders.clear(); renderTable(); updateSelectedCount(); });
  if (invertBtn) invertBtn.addEventListener('click', () => {
    const current = new Set(selectedOrders);
    selectedOrders.clear();
    orders.forEach(o => {
      if (!current.has(Number(o.id))) selectedOrders.add(Number(o.id));
    });
    renderTable(); updateSelectedCount();
  });
  if (toggleOrderBtn) toggleOrderBtn.addEventListener('click', () => { eventOrder = eventOrder === 'desc' ? 'asc' : 'desc'; loadOrders(); });
  if (genBtn) genBtn.addEventListener('click', () => generateReport());


const generateReport = () => {
  if (!selectedOrders.size) return alert('Selecione ao menos um pedido para gerar o relatório.');
  // manter ordem visível conforme DOM (ordem atual da tabela)
  const boxes = Array.from(document.querySelectorAll('#orders-tbody .select-order'));
  const idsOrdered = boxes.map(b => Number(b.dataset.id)).filter(id => selectedOrders.has(id));
  const idsParam = idsOrdered.join(',');
  if (!idsParam) return alert('Selecione ao menos um pedido para gerar o relatório.');
  window.open(`/entregas/relatorio?ids=${encodeURIComponent(idsParam)}`, '_blank');
};
  $("modal")?.addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });
};

window.addEventListener("DOMContentLoaded", init);
