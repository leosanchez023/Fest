import { fmt, $ } from "./utils.js";
import { state } from "./state.js";

export function abrirModalConfirmacao(pedido) {
  const itensHtml = (pedido.itens || []).map((i) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px;">
      <span>${i.nome || "Item"} <b>×${i.quantidade}</b></span>
      <span style="color:#14b8a6;font-weight:600;">${fmt(i.preco_unitario * i.quantidade)}</span>
    </div>
  `).join("");

  const cliente = state.clienteSelecionado || {};
  const html = `
    <div style="display:grid;gap:12px;font-size:14px;">
      <div class="section">
        <div class="section-title">👤 Cliente</div>
        <b>${cliente.nome || "-"}</b><br>
        <small>CPF: ${cliente.cpf || "-"} <br>📞 ${cliente.telefone || "-"} <br>✉️ ${cliente.email || "-"}</small>
      </div>
      <div class="section">
        <div class="section-title">📦 Pedido</div>
        <div><b>Tipo:</b> ${pedido.tipo_pedido || "-"}</div>
        <div><b>Contato:</b> ${pedido.telefone_contato || "-"}</div>
      </div>
      <div class="section">
        <div class="section-title">📅 Datas</div>
        <div>Evento: ${pedido.data_evento || "-"}</div>
        <div>Entrega: ${pedido.data_entrega || "-"}</div>
        <div>Retirada: ${pedido.data_retirada || "-"}</div>
      </div>
      <div class="section">
        <div class="section-title">📍 Entrega</div>
        ${$("end-rua")?.value || "-"}, ${$("end-numero")?.value || "-"}<br>
        ${$("end-bairro")?.value || "-"} - ${$("end-cidade")?.value || "-"}/${$("end-estado")?.value || "-"}
        <br><br>
        <b>${pedido.distancia_km || 0} km</b> • Frete: <b>${fmt(pedido.valor_frete || 0)}</b>
      </div>
      <div class="section">
        <div class="section-title">💰 Pagamento</div>
        <div><b>Forma:</b> ${pedido.forma_pagamento || "-"}</div>
        <div><b>Pago:</b> ${fmt(pedido.valor_pago || 0)}</div>
        <div><b>Desconto:</b> ${fmt(pedido.valor_desconto || 0)}</div>
        <div><b>Obs:</b> ${pedido.observacao_pagamento || "-"}</div>
      </div>
      <div class="section">
        <div class="section-title">🛒 Itens</div>
        ${itensHtml}
      </div>
      <div class="section" style="background:#ecfdf5;">
        <div class="section-title">📊 Total</div>
        <div><b>Total:</b> ${fmt(pedido.valor_total || 0)}</div>
      </div>
    </div>
  `;

  const resumo = $("resumo-confirmacao");
  const modal = $("modal-confirmacao");
  if (resumo) resumo.innerHTML = html;
  if (modal) modal.style.display = "flex";
}

export function inicializarModal() {
  const fechar = $("btn-fechar-modal");
  const modal = $("modal-confirmacao");

  if (fechar) fechar.addEventListener("click", () => {
    if (modal) modal.style.display = "none";
  });

  if (modal) modal.addEventListener("click", (e) => {
    if (e.target.id === "modal-confirmacao") {
      modal.style.display = "none";
    }
  });
}
