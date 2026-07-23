import { state } from "./state.js";
import { $, esc, fmt } from "./utils.js";
import { updateResumo } from "./fianceiro.js";
import { abrirModalConfirmacao } from "./modal.js";

export function adicionarItem() {
  const prodQuery = $("prod-query");
  const prodList = $("prod-list");
  const prodQtd = $("prod-qtd");

  if (!state.prodSel) {
    alert("Selecione um produto da lista.");
    return;
  }

  const qtd = Math.max(1, Number(prodQtd?.value) || 1);
  const existente = state.itens.findIndex((item) => String(item.produto_id) === String(state.prodSel.id));

  if (existente >= 0) {
    state.itens[existente].quantidade += qtd;
  } else {
    state.itens.push({
      produto_id: state.prodSel.id,
      nome: state.prodSel.nome,
      preco: state.prodSel.preco,
      quantidade: qtd
    });
  }

  state.prodSel = null;
  if (prodQuery) prodQuery.value = "";
  if (prodQtd) prodQtd.value = "1";
  if (prodList) prodList.style.display = "none";

  renderItens();
  updateResumo();
}

export function montarPedido() {
  const totalText = $("r-total")?.textContent || "0";
  const total = Number(totalText.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

  return {
    cliente_id: state.clienteSelecionado?.id || null,
    endereco_id: state.enderecoSelecionado?.id || null,
    telefone_contato: $("tel-contato")?.value.trim() || "",
    tipo_pedido: $("tipo-pedido")?.value || "ALUGUEL",
    distancia_km: Number($("distancia-km")?.value) || 0,
    valor_frete: Number($("frete")?.value) || 0,
    valor_desconto: Number($("desconto")?.value) || 0,
    valor_pago: Number($("pago")?.value) || 0,
    forma_pagamento: $("forma-pagamento")?.value || null,
    observacao_pagamento: $("obs-pagamento")?.value || null,
    observacoes: $("observacoes")?.value || null,
    data_evento: $("data-evento")?.value || null,
    data_entrega: $("data-entrega")?.value || null,
    data_retirada: $("data-retirada")?.value || null,
    itens: state.itens.map((item) => ({
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: Number(item.preco || 0),
      subtotal: Number(item.preco || 0) * Number(item.quantidade || 0),
      nome: item.nome
    })),
    valor_total: total
  };
}

export async function enviarPedido(saveAs = "CONFIRMADO") {
  if (!state.clienteSelecionado) {
    alert("Selecione um cliente.");
    return;
  }

  if (!state.itens.length) {
    alert("Adicione pelo menos um item.");
    return;
  }

  const pedido = montarPedido();
  pedido.status = saveAs === "ORCAMENTO" ? "ORCAMENTO" : "CONFIRMADO";
  pedido.status_documento = saveAs === "ORCAMENTO" ? "ORCAMENTO" : "PEDIDO";

  try {
    const res = await fetch("/pedidos/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro ao salvar o pedido");

    alert(saveAs === "ORCAMENTO" ? "Orçamento salvo com sucesso!" : "Pedido confirmado com sucesso!");
    state.itens = [];
    renderItens();
    updateResumo();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

function renderItens() {
  const tbody = $("itens-tbody");
  if (!tbody) return;

  if (!state.itens.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum item adicionado.</td></tr>';
    return;
  }

  tbody.innerHTML = state.itens.map((item, idx) => `
    <tr>
      <td>${esc(item.nome)}</td>
      <td class="text-center">
        <input class="qtd-input" type="number" min="1" value="${item.quantidade}" data-idx="${idx}" />
      </td>
      <td class="text-right">${fmt(item.preco)}</td>
      <td class="text-right">${fmt(item.preco * item.quantidade)}</td>
      <td class="text-center">
        <button type="button" class="btn-remove" data-idx="${idx}">✕</button>
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

  tbody.querySelectorAll(".btn-remove").forEach((button) => {
    button.onclick = () => {
      state.itens.splice(Number(button.dataset.idx), 1);
      renderItens();
      updateResumo();
    };
  });
}

function preencherEndereco(endereco) {
  state.enderecoSelecionado = endereco;

  if ($("end-rua")) $("end-rua").value = endereco?.rua || "";
  if ($("end-numero")) $("end-numero").value = endereco?.numero || "";
  if ($("end-bairro")) $("end-bairro").value = endereco?.bairro || "";
  if ($("end-cidade")) $("end-cidade").value = endereco?.cidade || "";
  if ($("end-estado")) $("end-estado").value = endereco?.estado || "";

  const painel = $("painel-endereco");
  if (painel) painel.style.display = "none";
}

async function buscarEnderecos() {
  const filtros = {
    rua: $("end-rua")?.value.trim() || "",
    numero: $("end-numero")?.value.trim() || "",
    bairro: $("end-bairro")?.value.trim() || "",
    cidade: $("end-cidade")?.value.trim() || "",
    estado: $("end-estado")?.value.trim() || ""
  };

  const query = Object.values(filtros).filter(Boolean).join(" ");
  if (!query) {
    alert("Digite pelo menos um campo do endereço para buscar.");
    return;
  }

  const params = new URLSearchParams(filtros);
  const painel = $("painel-endereco");
  if (!painel) return;

  try {
    const res = await fetch(`/pedidos/buscar-enderecos?${params}`);
    const data = await res.json();

    if (!data.length) {
      painel.innerHTML = '<div class="lista-vazia">Nenhum endereço encontrado.</div>';
      painel.style.display = "block";
      return;
    }

    painel.innerHTML = data.map((endereco) => `
      <button type="button" class="cliente-card" data-id="${endereco.id}">
        <div><strong>${esc(endereco.rua || "")}</strong>, ${esc(endereco.numero || "")}</div>
        <small>${esc(endereco.bairro || "")} - ${esc(endereco.cidade || "")}/${esc(endereco.estado || "")}</small>
      </button>
    `).join("");

    painel.querySelectorAll(".cliente-card").forEach((button) => {
      button.onclick = () => {
        const endereco = data.find((item) => String(item.id) === button.dataset.id);
        if (endereco) preencherEndereco(endereco);
      };
    });

    painel.style.display = "block";
  } catch (err) {
    console.error(err);
    painel.innerHTML = '<div class="lista-vazia">Erro ao buscar endereço.</div>';
    painel.style.display = "block";
  }
}

export function inicializarPedido() {
  const btnAdd = $("btn-add-item");
  if (btnAdd) btnAdd.addEventListener("click", adicionarItem);

  const btnConfirmar = $("btn-confirmar-pedido");
  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", () => {
      if (!state.clienteSelecionado) {
        alert("Selecione um cliente.");
        return;
      }
      if (!state.itens.length) {
        alert("Adicione pelo menos um item.");
        return;
      }
      abrirModalConfirmacao(montarPedido());
    });
  }

  const btnOrcamento = $("btn-gerar-orcamento");
  if (btnOrcamento) {
    btnOrcamento.addEventListener("click", () => {
      if (!state.clienteSelecionado) {
        alert("Selecione um cliente.");
        return;
      }
      if (!state.itens.length) {
        alert("Adicione pelo menos um item.");
        return;
      }
      abrirModalConfirmacao(montarPedido());
    });
  }

  const btnSalvar = $("btn-salvar-pedido");
  if (btnSalvar) btnSalvar.addEventListener("click", () => enviarPedido("CONFIRMADO"));

  const btnSalvarOrcamento = $("btn-gerar-orcamento-modal");
  if (btnSalvarOrcamento) btnSalvarOrcamento.addEventListener("click", () => enviarPedido("ORCAMENTO"));

  const btnEndereco = $("btn-endereco");
  if (btnEndereco) btnEndereco.addEventListener("click", buscarEnderecos);

  renderItens();
  updateResumo();
}
