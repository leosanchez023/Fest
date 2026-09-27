const debtor$ = (id) => document.getElementById(id);
let debtorRows = [];
let paymentOrder = null;

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "-";
const filters = () => ({ client: debtor$("debtor-client").value.trim(), overdue: debtor$("debtor-overdue").value, period: debtor$("debtor-period").value });
const queryString = (values = filters()) => new URLSearchParams(Object.entries(values).filter(([, value]) => value && value !== "all")).toString();

function renderSummary(summary) {
  debtor$("debtors-clients").textContent = summary.total_clientes;
  debtor$("debtors-open").textContent = money(summary.valor_em_aberto);
  debtor$("debtors-overdue-value").textContent = money(summary.valor_vencido);
}

function renderRows(rows) {
  debtorRows = rows;
  debtor$("debtors-count").textContent = `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`;
  debtor$("debtors-body").innerHTML = rows.length ? rows.map((row) => {
    const delay = Number(row.dias_em_atraso || 0);
    const rowClass = delay >= 30 ? "debtors-row--high" : delay > 0 ? "debtors-row--moderate" : "";
    const delayClass = delay >= 30 ? "debtors-delay-badge--high" : delay > 0 ? "debtors-delay-badge--moderate" : "";
    return `
    <tr class="${rowClass}">
      <td><strong>#${row.pedido_id}</strong></td>
      <td><strong>${row.cliente_nome}</strong></td><td>${row.telefone || "-"}</td><td>${date(row.data_evento)}</td>
      <td>${money(row.valor_total)}</td><td class="debtors-paid">${money(row.total_pago)}</td><td class="debtors-pending">${money(row.saldo_pendente)}</td>
      <td><span class="debtors-delay-badge ${delayClass}">${delay > 0 ? `${delay} dias` : "0 dias"}</span></td>
      <td><div class="debtors-actions"><button class="iconbtn" data-debtor-view="${row.pedido_id}" title="Visualizar pedido" aria-label="Visualizar pedido"><i class="fa-solid fa-eye"></i></button><button class="iconbtn" data-debtor-client="${encodeURIComponent(row.cliente_nome)}" title="Visualizar cliente" aria-label="Visualizar cliente"><i class="fa-solid fa-user"></i></button><button class="iconbtn" data-debtor-pay="${row.pedido_id}" title="Registrar pagamento" aria-label="Registrar pagamento"><i class="fa-solid fa-money-bill-wave"></i></button></div></td>
    </tr>`;
  }).join("") : '<tr><td colspan="9" class="debtors-empty">Nenhum cliente devedor encontrado.</td></tr>';
  document.querySelectorAll("[data-debtor-view]").forEach((button) => { button.onclick = () => { window.location.href = `/entregas?pedido=${button.dataset.debtorView}`; }; });
  document.querySelectorAll("[data-debtor-client]").forEach((button) => { button.onclick = () => { window.location.href = `/clientes?q=${button.dataset.debtorClient}`; }; });
  document.querySelectorAll("[data-debtor-pay]").forEach((button) => { button.onclick = () => openPayment(Number(button.dataset.debtorPay)); });
}

async function loadDebtors() {
  const response = await fetch(`/devedores/dados?${queryString()}`);
  if (!response.ok) throw new Error("Não foi possível carregar os devedores.");
  const data = await response.json();
  renderSummary(data.resumo); renderRows(data.devedores);
}

function openPayment(id) {
  paymentOrder = debtorRows.find((row) => Number(row.pedido_id) === id);
  if (!paymentOrder) return;
  debtor$("debtor-payment-order").textContent = `${paymentOrder.cliente_nome} • Pedido #${paymentOrder.pedido_id}`;
  debtor$("debtor-payment-balance").textContent = `Saldo pendente: ${money(paymentOrder.saldo_pendente)}`;
  debtor$("debtor-payment-value").value = ""; debtor$("debtor-payment-value").max = paymentOrder.saldo_pendente;
  debtor$("debtor-payment-method").value = ""; debtor$("debtor-payment-note").value = "";
  debtor$("debtor-payment-modal").classList.add("open");
}

function closePayment() { debtor$("debtor-payment-modal").classList.remove("open"); paymentOrder = null; }

async function submitPayment() {
  if (!paymentOrder) return;
  const value = Number(debtor$("debtor-payment-value").value);
  const method = debtor$("debtor-payment-method").value;
  if (!value || value <= 0 || value > Number(paymentOrder.saldo_pendente)) return alert("Informe um valor válido dentro do saldo pendente.");
  if (!method) return alert("Selecione a forma de pagamento.");
  const response = await fetch(`/devedores/${paymentOrder.pedido_id}/pagamento`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: value, forma_pagamento: method, observacao: debtor$("debtor-payment-note").value }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return alert(result.message || "Não foi possível registrar o pagamento.");
  closePayment(); await loadDebtors();
}

document.addEventListener("DOMContentLoaded", () => {
  ["debtor-overdue", "debtor-period"].forEach((id) => debtor$(id).addEventListener("change", () => loadDebtors().catch((error) => alert(error.message))));
  debtor$("debtor-client").addEventListener("input", () => { clearTimeout(window.debtorSearchTimer); window.debtorSearchTimer = setTimeout(() => loadDebtors().catch((error) => alert(error.message)), 300); });
  debtor$("debtor-clear").onclick = () => { debtor$("debtor-client").value = ""; debtor$("debtor-overdue").value = "all"; debtor$("debtor-period").value = "all"; loadDebtors().catch((error) => alert(error.message)); };
  debtor$("debtors-export").onclick = () => { window.location.href = `/devedores/exportar?${queryString()}`; };
  debtor$("debtor-payment-close").onclick = closePayment; debtor$("debtor-payment-cancel").onclick = closePayment; debtor$("debtor-payment-submit").onclick = () => submitPayment().catch((error) => alert(error.message));
  loadDebtors().catch((error) => { debtor$("debtors-body").innerHTML = `<tr><td colspan="9" class="debtors-empty">${error.message}</td></tr>`; });
});