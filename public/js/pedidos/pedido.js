import { state } from "./state.js";
import { $, esc, fmt } from "./utils.js";
import { updateResumo } from "./financeiro.js";
import {
  enderecoCorrespondeASelecao,
  preencherCamposEnderecoParaEdicao
} from "./endereco.js";

export function adicionarItem() {
  const prodQuery = $("prod-query");
  const prodList = $("prod-list");
  const prodQtd = $("prod-qtd");

  const selecionado = state.itemSel;
  if (!selecionado) {
    window.FestAlert?.warning?.("Pedido", "Selecione um item da lista.");
    return;
  }

  const qtd = Number(prodQtd?.value);
  if (!Number.isSafeInteger(qtd) || qtd <= 0 || qtd > 9999) {
    window.FestAlert?.warning?.("Quantidade inválida", "Informe uma quantidade inteira entre 1 e 9999.");
    return;
  }
  const chave = selecionado.origem === "COMBO" ? `c:${selecionado.id}` : `p:${selecionado.id}`;
  const existente = state.itens.findIndex((item) => item.chave === chave);

  if (existente >= 0) {
    state.itens[existente].quantidade += qtd;
  } else {
    state.itens.push({
      produto_id: selecionado.origem === "COMBO" ? null : selecionado.id,
      combo_id: selecionado.origem === "COMBO" ? selecionado.id : null,
      chave,
      nome: selecionado.nome,
      preco: selecionado.preco,
      preco_venda: selecionado.preco_venda,
      preco_aluguel: selecionado.preco_aluguel,
      tipo_item: selecionado.tipo_item || "ALUGUEL",
      pode_alternar_tipo: Boolean(selecionado.pode_alternar_tipo),
      quantidade: qtd
    });
  }

  state.prodSel = null;
  state.comboSel = null;
  state.itemSel = null;
  if (prodQuery) prodQuery.value = "";
  if (prodQtd) prodQtd.value = "1";
  if (prodList) prodList.style.display = "none";

  renderItens();
  updateResumo();
}

export function montarPedido() {
  const totalProdutos = state.itens.reduce(
    (soma, item) => soma + Number(item.preco) * Number(item.quantidade),
    0
  );
  const valorFrete = Number($("frete")?.value || 0);
  const valorDesconto = Number($("desconto")?.value || 0);
  const total = totalProdutos + valorFrete - valorDesconto;
  const endereco = {
    rua: $("end-rua")?.value.trim() || "",
    numero: $("end-numero")?.value.trim() || "",
    bairro: $("end-bairro")?.value.trim() || "",
    cidade: $("end-cidade")?.value.trim() || "",
    estado: $("end-estado")?.value.trim() || "",
    cep: $("end-cep")?.value.trim() || "",
    referencia: $("end-referencia")?.value.trim() || ""
  };
  const camposEndereco = ["rua", "numero", "bairro", "cidade", "estado", "cep", "referencia"];
  const enderecoAindaSelecionado = state.enderecoSelecionado
    && camposEndereco.every((campo) => String(state.enderecoSelecionado[campo] || "").trim() === endereco[campo]);
  const destinoGeocodificado = enderecoCorrespondeASelecao(state.enderecoSelecionado, endereco);
  return {
    cliente_id: state.clienteSelecionado?.id || null,

  nome_cliente:
    state.clienteSelecionado?.nome || "Não informado",

  telefone_cliente:
    state.clienteSelecionado?.telefone ||
    $("tel-cliente")?.value ||
    "Não informado",

  endereco_id: enderecoAindaSelecionado ? state.enderecoSelecionado.id || null : null,
  endereco,
  endereco_origem: state.rotaCalculada?.origem || "",
  origem_token: "",
  destino_token: destinoGeocodificado ? state.enderecoSelecionado.selectionToken : "",
  recalcular_rota: state.recalcularRota,
    telefone_contato: $("tel-contato")?.value.trim() || "",
    tipo_pedido: state.itens.some((item) => item.tipo_item === "VENDA")
      && state.itens.some((item) => item.tipo_item === "ALUGUEL")
      ? "MISTO"
      : state.itens.some((item) => item.tipo_item === "VENDA") ? "VENDA" : "ALUGUEL",
    distancia_km: Number($("distancia-km")?.value) || 0,
    valor_frete: valorFrete,
    valor_desconto: valorDesconto,
    valor_pago: Number($("pago")?.value || 0),
    forma_pagamento: $("forma-pagamento")?.value || null,
    observacao_pagamento: $("obs-pagamento")?.value || null,
    observacoes: $("observacoes")?.value || null,
    data_evento: $("data-evento")?.value || null,
    data_entrega: $("data-entrega")?.value || null,
    data_retirada: $("data-retirada")?.value || null,
    local_evento: $("local-evento")?.value.trim() || null,
    observacao_entrega: $("observacao-entrega")?.value.trim() || null,
    observacao_retirada: $("observacao-retirada")?.value.trim() || null,
    valor_produtos: totalProdutos,
    itens: state.itens.map((item) => ({
      produto_id: item.produto_id,
      combo_id: item.combo_id,
      tipo_item: item.tipo_item,
      quantidade: item.quantidade,
      preco_unitario: Number(item.preco || 0),
      subtotal: Number(item.preco || 0) * Number(item.quantidade || 0),
      nome: item.nome
    })),
    valor_total: total
  };
}

let salvamentoEmAndamento = false;

async function avisar(tipo, titulo, mensagem) {
  if (window.FestAlert?.[tipo]) {
    await window.FestAlert[tipo](titulo, mensagem);
    return;
  }
  if (tipo !== "success") window.alert(`${titulo}\n\n${mensagem}`);
}

export async function enviarPedido(saveAs = "CONFIRMADO") {
  if (salvamentoEmAndamento) return false;
  try {
    validarFormulario();
  } catch (error) {
    await avisar("warning", "Dados incompletos", error.message);
    return false;
  }

  if (!state.clienteSelecionado) {
    await avisar("warning", "Pedido", "Selecione um cliente.");
    return false;
  }

  if (!state.itens.length) {
    await avisar("warning", "Pedido", "Adicione pelo menos um item.");
    return false;
  }

  if (!state.rotaCalculada && !state.podeManterRotaSalva) {
    await avisar("warning", "Pedido", "Calcule uma rota válida antes de salvar o pedido.");
    return false;
  }

  const pedido = montarPedido();
  pedido.status = saveAs === "ORCAMENTO" ? "ORCAMENTO" : "CONFIRMADO";
  pedido.status_documento = saveAs === "ORCAMENTO" ? "ORCAMENTO" : "PEDIDO";

  if (state.editingId && state.editingStatusDocumento === "PEDIDO" && saveAs === "ORCAMENTO") {
    await avisar("warning", "Pedido confirmado", "Um pedido confirmado não pode ser convertido novamente em orçamento.");
    return false;
  }

  const buttons = [$("btn-confirmar-modal"), $("btn-gerar-orcamento-modal")].filter(Boolean);
  salvamentoEmAndamento = true;
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });

  try {
    let url = "/pedidos/criar";
    let method = "POST";

    if (state.editingId) {
      url = `/pedidos/${state.editingId}`;
      method = "PUT";
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || "Erro ao salvar o pedido");

    const pedidoId = data.pedidoId || state.editingId;
    if (!pedidoId) throw new Error("O servidor não retornou o identificador do registro salvo.");

    const convertendoOrcamento = state.editingId
      && state.editingStatusDocumento === "ORCAMENTO"
      && saveAs === "CONFIRMADO";
    if (convertendoOrcamento) {
      const conversao = await fetch(`/orcamentos/${pedidoId}/convert`, { method: "POST" });
      const resultadoConversao = await conversao.json().catch(() => ({}));
      if (!conversao.ok || !resultadoConversao.success) {
        throw new Error(resultadoConversao.message || "O orçamento foi salvo, mas não foi possível convertê-lo em pedido.");
      }
    }

    const eOrcamento = saveAs === "ORCAMENTO";
    await avisar(
      "success",
      eOrcamento ? "Orçamento salvo" : "Pedido confirmado",
      eOrcamento ? "Orçamento salvo com sucesso." : "Pedido confirmado com sucesso."
    );
    window.location.href = eOrcamento
      ? "/orcamentos"
      : `/entregas?pedido=${encodeURIComponent(pedidoId)}`;
    return true;

  } catch (err) {
    console.error(err);
    await avisar("error", "Erro ao salvar", err.message || "Não foi possível salvar o pedido.");
    return false;
  } finally {
    salvamentoEmAndamento = false;
    buttons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    });
  }
}

async function carregarPedidoParaEdicao(id) {
  try {
    const res = await fetch(`/pedidos/obter/${id}`);
    if (!res.ok) throw new Error('Pedido não encontrado');
    const data = await res.json();

    const pedido = data.pedido || {};
    const itens = data.itens || [];
    const pagamentos = data.pagamentos || [];
    const valorPago = pagamentos.reduce((soma, pagamento) => soma + Number(pagamento.valor || 0), 0);

    // Cliente
    state.clienteSelecionado = {
      id: pedido.cliente_id,
      nome: pedido.cliente_nome,
      telefone: pedido.cliente_telefone,
      email: pedido.cliente_email
    };

    // Endereço (retornado como objeto pelo model)
    state.enderecoSelecionado = pedido.endereco || null;

    // Itens
    state.itens = itens.map(it => ({
      produto_id: it.produto_id,
      combo_id: it.combo_id,
      chave: it.combo_id ? `c:${it.combo_id}` : `p:${it.produto_id}`,
      nome: it.produto_nome || it.combo_nome || it.nome,
      preco: it.valor_unitario ?? it.preco_unitario ?? 0,
      preco_venda: it.produto_preco_venda ?? it.preco_combo ?? it.valor_unitario ?? 0,
      preco_aluguel: it.produto_preco_aluguel ?? it.preco_combo ?? it.valor_unitario ?? 0,
      quantidade: it.quantidade,
      tipo_item: it.tipo_item || pedido.tipo_pedido || "ALUGUEL",
      pode_alternar_tipo: true
    }));

    // Campos simples
    if ($("tel-cliente")) $("tel-cliente").value = state.clienteSelecionado.telefone || "";
    if ($("tel-contato")) $("tel-contato").value = pedido.telefone_contato || "";
    if ($("data-evento")) $("data-evento").value = pedido.data_evento ? String(pedido.data_evento).split('T')[0] : "";
    if ($("data-entrega")) $("data-entrega").value = pedido.data_entrega ? String(pedido.data_entrega).split('T')[0] : "";
    if ($("data-retirada")) $("data-retirada").value = pedido.data_retirada ? String(pedido.data_retirada).split('T')[0] : "";
    if ($("local-evento")) $("local-evento").value = pedido.local_evento || "";
    if ($("observacao-entrega")) $("observacao-entrega").value = pedido.observacao_entrega || "";
    if ($("observacao-retirada")) $("observacao-retirada").value = pedido.observacao_retirada || "";
    if ($("distancia-km")) $("distancia-km").value = pedido.distancia_cobrada_km || pedido.distancia_km || 0;
    if ($("frete")) $("frete").value = pedido.valor_frete || 0;
    state.rotaCalculada = pedido.endereco?.selectionToken && pedido.origem_token
      ? {
        distanciaKm: Number(pedido.distancia_km || 0),
        distanciaCobradaKm: Number(pedido.distancia_cobrada_km || pedido.distancia_km || 0),
        distanciaRetornoKm: Number(pedido.distancia_retorno_km || 0),
        valorFrete: Number(pedido.valor_frete || 0),
        formula: pedido.frete_formula || `${Number(pedido.distancia_km || 0).toFixed(2)} km × frete salvo`
      }
      : null;
    state.recalcularRota = false;
    const routeSummary = $("resumo-rota");
    if (routeSummary && state.rotaCalculada) {
      routeSummary.textContent = `Rota salva: ${state.rotaCalculada.distanciaKm.toFixed(2)} km ida${state.rotaCalculada.distanciaRetornoKm ? ` + ${state.rotaCalculada.distanciaRetornoKm.toFixed(2)} km retorno` : ""} • Considerada: ${state.rotaCalculada.distanciaCobradaKm.toFixed(2)} km • ${state.rotaCalculada.formula} • Frete: ${fmt(state.rotaCalculada.valorFrete)}`;
    }
    if ($("desconto")) $("desconto").value = pedido.valor_desconto || 0;
    if ($("pago")) $("pago").value = valorPago.toFixed(2);
    if ($("forma-pagamento") && pagamentos.length) $("forma-pagamento").value = pagamentos[0].forma_pagamento || "PIX";
    if ($("obs-pagamento") && pagamentos.length) $("obs-pagamento").value = pagamentos[0].observacao || "";
    if ($("observacoes")) $("observacoes").value = pedido.observacoes || "";

    // marca modo edição
    state.editingId = pedido.id;
    state.editingStatusDocumento = pedido.status_documento || "PEDIDO";

    // Atualiza título da página/header
    const pageMeta = document.querySelector('.page-meta');
    if (pageMeta) {
      pageMeta.dataset.title = `Editar Pedido #${pedido.id}`;
      pageMeta.dataset.subtitle = 'Editando pedido/orçamento';
    }

    // renderiza cliente e itens
    const box = $("cliente-display");
    if (box) {
      box.innerHTML = `
        <div class="cliente-box">
          <div class="cliente-info">
            <div class="nome">${esc(state.clienteSelecionado.nome || "")}</div>
            <div class="meta">${esc(state.clienteSelecionado.telefone || "")}</div>
          </div>
          <button type="button" class="btn-alterar" id="btn-alterar">Alterar</button>
        </div>
      `;
      const alterar = $("btn-alterar");
      if (alterar) alterar.onclick = () => {
        const abrir = $("btn-abrir-painel");
        if (abrir) abrir.click();
      };
    }

    preencherCamposEnderecoParaEdicao(pedido);
    if (!pedido.endereco?.selectionToken || !pedido.origem_token) {
      state.podeManterRotaSalva = true;
    }
    renderItens();
    updateResumo();

  } catch (err) {
    console.error(err);
    avisar('error', 'Erro ao carregar pedido', err.message || 'Não foi possível carregar o pedido.');
  }
}

function renderItens() {
  const tbody = $("itens-tbody");
  if (!tbody) return;

  if (!state.itens.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum item adicionado.</td></tr>';
    return;
  }

  tbody.innerHTML = state.itens.map((item, idx) => `
    <tr>
      <td>${esc(item.nome)}</td>
      <td class="text-center">${item.pode_alternar_tipo ? `
        <select class="tipo-item-input" data-idx="${idx}" aria-label="Modalidade de ${esc(item.nome)}">
          <option value="ALUGUEL" ${item.tipo_item === 'ALUGUEL' ? 'selected' : ''}>Aluguel</option>
          <option value="VENDA" ${item.tipo_item === 'VENDA' ? 'selected' : ''}>Venda</option>
        </select>` : item.tipo_item === 'VENDA' ? 'Venda' : 'Aluguel'}</td>
      <td class="text-center">
        <input class="qtd-input" type="number" min="1" value="${item.quantidade}" data-idx="${idx}" />
      </td>
      <td class="text-right">${fmt(item.preco)}</td>
      <td class="text-right">${fmt(item.preco * item.quantidade)}</td>
      <td class="text-center">
        <button type="button" class="btn-remove" data-idx="${idx}" aria-label="Remover item"><i class="fa-solid fa-xmark"></i></button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".qtd-input").forEach((input) => {
    input.onchange = () => {
      const idx = Number(input.dataset.idx);
      state.itens[idx].quantidade = Math.max(1, Number(input.value) || 1);
      renderItens();
      updateResumo();
    };
  });

  tbody.querySelectorAll(".tipo-item-input").forEach((select) => {
    select.onchange = () => {
      const item = state.itens[Number(select.dataset.idx)];
      item.tipo_item = select.value;
      item.preco = select.value === "VENDA" ? Number(item.preco_venda || item.preco) : Number(item.preco_aluguel || item.preco);
      updateResumo();
      renderItens();
    };
  });

  tbody.querySelectorAll(".btn-remove").forEach((button) => {
    button.onclick = () => {
      state.itens.splice(Number(button.dataset.idx), 1);
      renderItens();
      updateResumo();
    };
  });
}

function criarData(valor) {

  const [ano, mes, dia] =
    valor.split("-").map(Number);

  return new Date(ano, mes - 1, dia);

}

function validarFormulario() {

  // CLIENTE

  if (!state.clienteSelecionado) {
    throw new Error("Selecione um cliente.");
  }

  // ENDEREÇO

  if (!$("end-rua")?.value.trim() || !$("end-cidade")?.value.trim()) {
    throw new Error("Informe a rua e a cidade do endereço de entrega.");
  }
  if (!state.rotaCalculada && !state.podeManterRotaSalva) {
    throw new Error("Selecione origem e destino nas sugestões e calcule a rota antes de salvar.");
  }

  // ITENS

  if (!state.itens.length) {
    throw new Error("Adicione pelo menos um item.");
  }

  // DATAS

  if (!$("data-evento")?.value) {
    throw new Error("Informe a data do evento.");
  }

  if (!$("data-entrega")?.value) {
    throw new Error("Informe a data de entrega.");
  }

  if (!$("data-retirada")?.value) {
    throw new Error("Informe a data de retirada.");
  }

  const evento =
    criarData($("data-evento").value);

  const entrega =
    criarData($("data-entrega").value);

  const retirada =
    criarData($("data-retirada").value);

  if (isNaN(evento.getTime())) {
    throw new Error("Data do evento inválida.");
  }

  if (isNaN(entrega.getTime())) {
    throw new Error("Data de entrega inválida.");
  }

  if (isNaN(retirada.getTime())) {
    throw new Error("Data de retirada inválida.");
  }

  const hoje = new Date();

  hoje.setHours(0, 0, 0, 0);
  evento.setHours(0, 0, 0, 0);
  entrega.setHours(0, 0, 0, 0);
  retirada.setHours(0, 0, 0, 0);

  if (evento < hoje) {
    throw new Error("O evento não pode ser em uma data passada.");
  }

  if (entrega < hoje) {
    throw new Error("A entrega não pode ser em uma data passada.");
  }

  if (retirada < hoje) {
    throw new Error("A retirada não pode ser em uma data passada.");
  }

  if (entrega > evento) {
    throw new Error("A entrega não pode ocorrer após o evento.");
  }

  if (retirada < evento) {
    throw new Error("A retirada não pode ocorrer antes do evento.");
  }

  // TELEFONE

  const telefone =
    $("tel-contato")?.value.replace(/\D/g, "") || "";

  if (
    telefone &&
    telefone.length !== 10 &&
    telefone.length !== 11
  ) {
    throw new Error("Telefone para contato inválido.");
  }

  // DESCONTO

  const desconto =
    Number($("desconto")?.value || 0);

  if (desconto < 0) {
    throw new Error("Desconto inválido.");
  }

  // PAGAMENTO

  const pago =
    Number($("pago")?.value || 0);

  if (!Number.isFinite(pago) || pago < 0) {
    throw new Error("Valor pago inválido.");
  }

  // FRETE

  const distancia =
    Number($("distancia-km")?.value || 0);

  if (!Number.isFinite(distancia) || distancia < 0) {
    throw new Error("Distância inválida.");
  }

  const valorFrete = Number($("frete")?.value || 0);
  if (!Number.isFinite(valorFrete) || valorFrete < 0) {
    throw new Error("Valor do frete inválido.");
  }
  if (!Number.isFinite(desconto) || desconto > valorFrete + state.itens.reduce(
    (soma, item) => soma + Number(item.preco) * Number(item.quantidade),
    0
  )) {
    throw new Error("O desconto não pode exceder o valor do pedido.");
  }
  if (pago > valorFrete + state.itens.reduce(
    (soma, item) => soma + Number(item.preco) * Number(item.quantidade),
    0
  ) - desconto) {
    throw new Error("O valor pago não pode exceder o total do pedido.");
  }
  if (pago > 0 && !$("forma-pagamento")?.value) {
    throw new Error("Selecione a forma de pagamento.");
  }
  if (state.itens.some((item) =>
    !Number.isSafeInteger(Number(item.quantidade)) || Number(item.quantidade) <= 0 ||
    !Number.isFinite(Number(item.preco)) || Number(item.preco) < 0
  )) {
    throw new Error("Revise as quantidades e os valores dos itens.");
  }
}
export function inicializarPedido() {
  const btnSalvarTela = $("btn-salvar-pedido");

if (btnSalvarTela) {

  btnSalvarTela.addEventListener("click", () => {

    try {

      validarFormulario();

      const pedido = montarPedido();

      window.ModalPedido.abrir({

        tipo: pedido.tipo_pedido,

        cliente: {
          nome: pedido.nome_cliente,
          telefone: pedido.telefone_cliente,
          telefoneContato: pedido.telefone_contato,
          endereco: `${pedido.endereco.rua}, ${pedido.endereco.numero}`,
          cidade: pedido.endereco.cidade,
          estado: pedido.endereco.estado
        },

        frete: {
          origem: pedido.endereco_origem,
          rua: pedido.endereco.rua,
          numero: pedido.endereco.numero,
          bairro: pedido.endereco.bairro,
          cidade: pedido.endereco.cidade,
          estado: pedido.endereco.estado,
          cep: pedido.endereco.cep,
          referencia: pedido.endereco.referencia,
          km: pedido.distancia_cobrada_km || pedido.distancia_km,
          valor: pedido.valor_frete,
          formula: pedido.frete_formula || state.rotaCalculada?.formula || ""
        },

        pagamento: {
          forma: pedido.forma_pagamento,
          pago: pedido.valor_pago,
          desconto: pedido.valor_desconto,
          observacao: pedido.observacao_pagamento
        },

        itens: pedido.itens.map(item => ({
          nome: item.nome,
          qtd: item.quantidade,
          valor: item.preco_unitario
        })),

        observacoes: pedido.observacoes,
        dataEvento: pedido.data_evento,
        dataEntrega: pedido.data_entrega,
        dataRetirada: pedido.data_retirada,
        localEvento: pedido.local_evento,
        observacaoEntrega: pedido.observacao_entrega,
        observacaoRetirada: pedido.observacao_retirada,
        orcamento: pedido.status_documento === "ORCAMENTO"

      });

    } catch (erro) {

      avisar('error', 'Erro ao carregar pedido', erro.message || 'Não foi possível carregar os dados do pedido.');

    }

  });

}

// CONFIRMAR PEDIDO
const btnConfirmar = $("btn-confirmar-modal");

if (btnConfirmar) {
  btnConfirmar.addEventListener("click", async () => {

    if (await enviarPedido("CONFIRMADO")) window.ModalPedido.fechar();

  });
}


// GERAR ORÇAMENTO
const btnOrcamento = $("btn-gerar-orcamento-modal");

if (btnOrcamento) {
  btnOrcamento.addEventListener("click", async () => {

    if (await enviarPedido("ORCAMENTO")) window.ModalPedido.fechar();

  });
}
  // IMPRIMIR
  const btnImprimir = $("btn-imprimir-pedido");

  if(btnImprimir){

    btnImprimir.addEventListener("click",()=>{

      const pedido = montarPedido();

      imprimirOrcamento(pedido);

    });

  }


  renderItens();
  updateResumo();

  // Se a URL indicar um orçamento para edição (?orcamento=ID), carrega os dados
  try {
    const params = new URLSearchParams(window.location.search);
    const orcId = params.get('orcamento') || params.get('editar') || params.get('id');
    if (orcId) {
      carregarPedidoParaEdicao(orcId);
    }
  } catch (e) {
    // ignore
  }

}


function imprimirOrcamento(pedido) {
  const janela = window.open("", "_blank");

  const formatar = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  janela.document.write(`
<!DOCTYPE html>
<html>

<head>
  <title>Orçamento Fest</title>

  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #222;
    }

    /* CABEÇALHO */

    .header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-bottom: 2px solid #000;
  padding-bottom: 15px;
  min-height: 110px;
}

.logo {
  position: absolute;
  left: 0;
  top: 0;
}

.logo img {
  width: 100px;
  height: auto;
}

.empresa {
  text-align: center;
}

.empresa h1 {
  margin: 0;
  font-size: 35px;
}

.empresa p {
  margin: 4px 0;
  font-size: 14px;
}

    .header h1 {
      margin: 0;
      font-size: 35px;
    }

    .header p {
      margin: 4px;
      font-size: 14px;
    }

    /* CARDS SUPERIORES */

    .topo {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 15px;
      margin-top: 20px;
    }

    .card {
      border: 1px solid #aaa;
      padding: 12px;
      min-height: 130px;
    }

    .titulo {
      margin-bottom: 10px;
      padding-bottom: 5px;
      font-size: 15px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
    }

    /* PRODUTOS */

    table {
      width: 100%;
      margin-top: 25px;
      border-collapse: collapse;
    }

    th {
      background: #eee;
    }

    td,
    th {
      padding: 8px;
      font-size: 13px;
      border: 1px solid #aaa;
    }

    .right {
      text-align: right;
    }

    /* RESUMO */

    .resumo {
      width: 300px;
      margin-top: 25px;
    }

    .resumo div {
      display: flex;
      justify-content: space-between;
      padding: 5px;
    }

    .total {
      font-size: 18px;
      font-weight: bold;
      border-top: 2px solid #000;
    }

    /* ASSINATURA */

    .assinatura {
      display: flex;
      justify-content: space-around;
      margin-top: 80px;
    }

    .linha {
      width: 200px;
      margin-top: 40px;
      border-top: 1px solid #000;
    }

    /* RODAPÉ */

    .footer {
      margin-top: 30px;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>

<body>

  <div class="header">

  <div class="logo">
    <img
  src="/img/ChatGPT%20Image%2024%20de%20jul.%20de%202026,%2019_53_14.png"
  alt="Logo Serve Festa"
  style="width:190px;height:auto;"
>
  </div>

  <div class="empresa">
    <h1>SERVE FESTA</h1>

    <p>Locação de artigos para festas</p>

    <p><strong>ORÇAMENTO</strong></p><br>



     <p>
       <p><strong><i class="fa-solid fa-phone"></i> (14) 99674-9672</strong></p> Rua Tupinambas, 10-A esquina c/ Joaquim Abarca - Centro - Tupã/SP
     </p>
  </div>

</div>
CNPJ: 20.894.431/0001-56
  <div class="topo">

    <!-- SOLICITANTE -->

    <div class="card">

      <div class="titulo">
        Dados do Solicitante
      </div>

      <p>
        <strong>Nome:</strong>
        ${pedido.nome_cliente || "Não informado"}
      </p>

      <p>
        <strong>Telefone:</strong>
        ${pedido.telefone_cliente || "-"}
      </p>

    </div>

    <!-- ENDEREÇO -->

    <div class="card">

      <div class="titulo">
        Endereço de Entrega
      </div>

      <p>
        ${pedido.endereco?.rua || ""}
        ${pedido.endereco?.numero || ""}
      </p>

      <p>
        ${pedido.endereco?.bairro || ""}
      </p>

      <p>
        ${pedido.endereco?.cidade || ""}
        -
        ${pedido.endereco?.estado || ""}
      </p>

      <br>

    </div>

    <!-- EVENTO -->

    <div class="card">

      <div class="titulo">
        Dados do Evento
      </div>

      <p>
        <strong>Evento:</strong>
        ${pedido.data_evento || "-"}
      </p>

      <p>
        <strong>Entrega:</strong>
        ${pedido.data_entrega || "-"}
      </p>

      <p>
        <strong>Retirada:</strong>
        ${pedido.data_retirada || "-"}
      </p>

    </div>

  </div>

  <h3>Produtos do Orçamento</h3>

  <table>

    <thead>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Valor Unit.</th>
        <th>Total</th>
      </tr>
    </thead>

    <tbody>

      ${pedido.itens.map(item => `
        <tr>
          <td>${item.nome}</td>
          <td class="right">${item.quantidade}</td>
          <td class="right">${formatar(item.preco_unitario)}</td>
          <td class="right">${formatar(item.subtotal)}</td>
        </tr>
      `).join("")}

    </tbody>

  </table>

  <!-- VALORES -->

  <div class="resumo">

    <div>
      <span>Produtos:</span>
      <span>${formatar(pedido.valor_produtos)}</span>
    </div>

    <div>
      <span>Frete:</span>
      <span>${formatar(pedido.valor_frete)}</span>
    </div>

    <div>
      <span>Desconto:</span>
      <span>${formatar(pedido.valor_desconto)}</span>
    </div>

    <div class="total">
      <span>TOTAL:</span>
      <span>
        ${formatar(
          pedido.valor_produtos +
          pedido.valor_frete -
          pedido.valor_desconto
        )}
      </span>
    </div>

  </div>

  <!-- ASSINATURAS -->

  <div class="assinatura">

    <div>
      <div class="linha"></div>
      Cliente
    </div>

    <div>
      <div class="linha"></div>
      Serve Festa
    </div>

  </div>

  <!-- RODAPÉ -->

  <div class="footer">
    Obrigado pela preferência!
    <br>
    Este orçamento depende da disponibilidade dos produtos.
  </div>

</body>

</html>
  `);

  janela.document.close();
  janela.print();
}