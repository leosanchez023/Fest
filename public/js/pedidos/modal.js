import { fmt, $ } from "./utils.js";


function abrirModalConfirmacao() {


  const pedido = montarPedido();

  const itensHtml = pedido.itens.map(i => `
    <div style="
      display:flex;
      justify-content:space-between;
      padding:6px 0;
      border-bottom:1px solid #eee;
      font-size:14px;
    ">
      <span>${i.nome} <b>×${i.quantidade}</b></span>
      <span style="color:#14b8a6;font-weight:600;">
        ${fmt(i.preco * i.quantidade)}
      </span>
    </div>
  `).join('');

  const html = `
    <div style="display:grid;gap:12px;font-size:14px;">

      <!-- CLIENTE -->
      <div class="section">
        <div class="section-title">👤 Cliente</div>
        <b>${pedido.cliente?.nome || ''}</b><br>
        <small>
        ⚠️CPF: ${pedido.cliente?.cpf || '-'} <br>
        📞 ${pedido.cliente?.telefone || '-'} <br>
        ✉️ ${pedido.cliente?.email || '-'}
        </small>
      </div>

      <!-- PEDIDO -->
      <div class="section">
        <div class="section-title">📦 Pedido</div>

        <div><b>Tipo:</b> ${pedido.tipo_pedido || '-'}</div>
        <div><b>Status:</b> ${pedido.status || '-'}</div>
        <div><b>Contato:</b> ${pedido.telefone_contato || '-'}</div>
      </div>

      <!-- DATAS -->
      <div class="section">
        <div class="section-title">📅 Datas</div>
        <div>Evento: ${pedido.data_evento || '-'}</div>
        <div>Entrega: ${pedido.data_entrega || '-'}</div>
        <div>Retirada: ${pedido.data_retirada || '-'}</div>
      </div>

      <!-- ENDEREÇO -->
      <div class="section">
        <div class="section-title">📍 Entrega</div>
        ${pedido.endereco.rua}, ${pedido.endereco.numero}<br>
        ${pedido.endereco.bairro} - ${pedido.endereco.cidade}/${pedido.endereco.estado}
        <br><br>
        <b>${pedido.distancia_km} km</b> • Frete: <b>${fmt(pedido.valor_frete)}</b>
      </div>

      <!-- PAGAMENTO -->
      <div class="section">
        <div class="section-title">💰 Pagamento</div>
        <div><b>Forma:</b> ${pedido.forma_pagamento}</div>
        <div><b>Pago:</b> ${fmt(pedido.valor_pago)}</div>
        <div><b>Desconto:</b> ${fmt(pedido.valor_desconto)}</div>
        <div><b>Obs:</b> ${pedido.observacao_pagamento || '-'}</div>
      </div>

      <!-- ITENS -->
      <div class="section">
        <div class="section-title">🛒 Itens</div>
        ${itensHtml}
      </div>

      <!-- TOTAL -->
      <div class="section" style="background:#ecfdf5;">
        <div class="section-title">📊 Total</div>
        <div><b>Total:</b> ${fmt(pedido.resumo.total)}</div>
      </div>

    </div>
  `;

  $('resumo-confirmacao').innerHTML = html;
  $('modal-confirmacao').style.display = 'flex';
}


$('btn-fechar-modal').addEventListener('click', () => {
  $('modal-confirmacao').style.display = 'none';
});
$('modal-confirmacao').addEventListener('click', (e) => {
  if (e.target.id === 'modal-confirmacao') {
    $('modal-confirmacao').style.display = 'none';
  }
});
