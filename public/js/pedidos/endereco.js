import { state } from "./state.js";
import { $, esc } from "./utils.js";
import { invalidarRota } from "./financeiro.js";

const minimoCaracteres = 3;
const debounceMs = 500;

function camposDestino() {
  return {
    rua: $("end-rua")?.value.trim() || "",
    numero: $("end-numero")?.value.trim() || "",
    bairro: $("end-bairro")?.value.trim() || "",
    cidade: $("end-cidade")?.value.trim() || "",
    estado: $("end-estado")?.value.trim() || "",
    cep: $("end-cep")?.value.trim() || "",
    referencia: $("end-referencia")?.value.trim() || ""
  };
}

function enderecoCorrespondeASelecao() {
  const selected = state.enderecoSelecionado;
  if (!selected?.selectionToken) return false;
  const actual = camposDestino();
  return ["rua", "bairro", "cidade", "estado", "cep"].every(
    (field) => String(selected[field] || "").trim() === actual[field]
  );
}

function mostrarEstado(list, message, error = false) {
  list.dataset.activeIndex = "-1";
  list._results = [];
  list._input?.removeAttribute("aria-activedescendant");
  list.innerHTML = `<li class="address-suggestion-status${error ? " is-error" : ""}" role="status">${esc(message)}</li>`;
  list.hidden = false;
}

function mostrarSemResultados(list, contextual, onBuscaAmpla) {
  list.dataset.activeIndex = "-1";
  list._results = [];
  list._input?.removeAttribute("aria-activedescendant");
  list.innerHTML = `
    <li class="address-suggestion-status" role="status">
      ${contextual
        ? "Nenhum resultado corresponde à localidade informada."
        : "Nenhum endereço encontrado."}
      ${contextual
        ? '<button type="button" class="address-broader-search">Buscar sem filtros de localidade</button>'
        : " Você ainda pode preencher o endereço manualmente."}
    </li>`;
  list.hidden = false;
  list.querySelector(".address-broader-search")?.addEventListener("click", onBuscaAmpla);
}

function displayDetails(place) {
  return [
    [place.rua, place.numero].filter(Boolean).join(", "),
    [
      place.bairro || (place.cidade ? "Bairro não informado" : ""),
      [place.cidade, place.estado].filter(Boolean).join("/")
    ].filter(Boolean).join(" • "),
    place.cep ? `CEP ${place.cep}` : "",
    place.descricao
  ].filter(Boolean);
}

function closeList(list) {
  list._cancelSearch?.();
  list.hidden = true;
  list.innerHTML = "";
  list.dataset.activeIndex = "-1";
  list._input?.removeAttribute("aria-activedescendant");
}

function setSelection(list, index) {
  list.querySelectorAll("[role=option]").forEach((option, optionIndex) => {
    const selected = optionIndex === index;
    option.setAttribute("aria-selected", String(selected));
    if (selected) {
      option.scrollIntoView({ block: "nearest" });
      list._input?.setAttribute("aria-activedescendant", option.id);
    }
  });
  list.dataset.activeIndex = String(index);
}

function renderResults(list, results, onSelect) {
  if (!results.length) {
    list._results = [];
    mostrarEstado(list, "Nenhum endereço encontrado. Você ainda pode preencher manualmente.", false);
    return;
  }
  list._results = results;
  list.innerHTML = results.map((place, index) => `
    <li id="${esc(list.id)}-option-${index}" role="option" aria-selected="false" data-index="${index}">
      <button type="button" class="address-suggestion" tabindex="-1">
        <strong>${esc([place.rua, place.numero].filter(Boolean).join(", ") || place.cidade || "Local")}</strong>
        ${displayDetails(place).slice(1).map((line) => `<small>${esc(line)}</small>`).join("")}
      </button>
    </li>
  `).join("");
  list.hidden = false;
  list.dataset.activeIndex = "-1";
  list._input?.removeAttribute("aria-activedescendant");
  list.querySelectorAll("[role=option]").forEach((option) => {
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.querySelector("button").addEventListener("click", () => {
      onSelect(results[Number(option.dataset.index)]);
    });
  });
}

function createAutocomplete({
  input,
  list,
  peerList,
  contextInputs = [],
  getContext,
  onSelect,
  onTyping
}) {
  let debounceTimer;
  let requestId = 0;
  let controller;
  const contextSignature = () => JSON.stringify(getContext?.() || {});
  const cancelSearch = () => {
    clearTimeout(debounceTimer);
    requestId += 1;
    controller?.abort();
  };
  list._input = input;
  list._cancelSearch = cancelSearch;

  const search = async (broad = false) => {
    const query = input.value.trim();
    if (query.length < minimoCaracteres) {
      closeList(list);
      return;
    }
    const currentRequest = ++requestId;
    const context = getContext?.() || {};
    const contextAtRequest = contextSignature();
    controller?.abort();
    controller = new AbortController();
    mostrarEstado(list, "Buscando endereços...");
    const params = new URLSearchParams({ q: query });
    if (!broad) {
      for (const [key, value] of Object.entries(context)) {
        if (value) params.set(key, value);
      }
    } else {
      params.set("ampla", "1");
    }
    try {
      const response = await fetch(`/pedidos/buscar-enderecos-osm?${params}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.erro || data.message
          || (response.status === 401 ? "Sua sessão expirou. Entre novamente para pesquisar endereços."
            : response.status === 403 ? "Você não tem permissão para pesquisar endereços."
              : `Falha ao buscar endereços (HTTP ${response.status}).`);
        throw new Error(message);
      }
      if (currentRequest !== requestId || input.value.trim() !== query
          || contextAtRequest !== contextSignature()) return;
      if (data.resultados.length) {
        renderResults(list, data.resultados, onSelect);
      } else {
        mostrarSemResultados(list, data.contextoAplicado && !data.buscaAmpla, () => search(true));
      }
    } catch (error) {
      if (error.name === "AbortError" || currentRequest !== requestId) return;
      mostrarEstado(list, `${error.message} O preenchimento manual continua disponível.`, true);
    }
  };

  const scheduleSearch = () => {
    clearTimeout(debounceTimer);
    requestId += 1;
    controller?.abort();
    onTyping();
    if (peerList) closeList(peerList);
    const query = input.value.trim();
    if (query.length < minimoCaracteres) {
      closeList(list);
      return;
    }
    mostrarEstado(list, "A busca será iniciada em instantes...");
    debounceTimer = setTimeout(() => search(), debounceMs);
  };

  input.addEventListener("input", scheduleSearch);
  input.addEventListener("focus", () => {
    if (peerList) closeList(peerList);
  });
  contextInputs.forEach((contextInput) => {
    contextInput.addEventListener("input", scheduleSearch);
  });

  input.addEventListener("keydown", (event) => {
    if (list.hidden) return;
    const options = [...list.querySelectorAll("[role=option]")];
    if (event.key === "Escape") {
      closeList(list);
      return;
    }
    if (!options.length) return;
    let index = Number(list.dataset.activeIndex ?? -1);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      index = event.key === "ArrowDown"
        ? (index + 1) % options.length
        : (index <= 0 ? options.length - 1 : index - 1);
      setSelection(list, index);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (index < 0) index = 0;
      options[index]?.querySelector("button")?.click();
    }
  });

  list.addEventListener("mousemove", (event) => {
    const option = event.target.closest("[role=option]");
    if (!option) return;
    setSelection(list, Number(option.dataset.index));
  });

  return { close: () => closeList(list) };
}

function selectDestination(place, list) {
  const previousNumber = $("end-numero").value.trim();
  const previousNeighborhood = $("end-bairro").value.trim();
  $("end-rua").value = place.rua || place.descricao || "";
  $("end-bairro").value = place.bairro || previousNeighborhood;
  $("end-cidade").value = place.cidade || "";
  $("end-estado").value = place.estado || "";
  $("end-cep").value = place.cep || "";
  if (place.numero && !previousNumber) $("end-numero").value = place.numero;
  state.enderecoSelecionado = { ...place, ...camposDestino() };
  state.podeManterRotaSalva = false;
  closeList(list);
  invalidarRota("Destino selecionado. Calcule novamente a rota.");
}

function configOriginAddress() {
  return {
    rua: $("origem-config-rua")?.value.trim() || "",
    numero: $("origem-config-numero")?.value.trim() || "",
    bairro: $("origem-config-bairro")?.value.trim() || "",
    cidade: $("origem-config-cidade")?.value.trim() || "",
    estado: $("origem-config-estado")?.value.trim() || "",
    cep: $("origem-config-cep")?.value.trim() || "",
    referencia: $("origem-config-referencia")?.value.trim() || ""
  };
}

function renderFreightRuleFields() {
  const rule = $("regra-cobranca")?.value;
  document.querySelectorAll(".delivery-rule-fixed").forEach((field) => {
    field.hidden = rule !== "FIXO";
  });
  document.querySelectorAll(".delivery-rule-initial").forEach((field) => {
    field.hidden = rule !== "FIXO_POR_KM";
  });
  document.querySelectorAll(".delivery-rule-km").forEach((field) => {
    field.hidden = !["POR_KM", "FIXO_POR_KM"].includes(rule);
  });
}

function preencherConfiguracao(config) {
  const fields = {
    "origem-config-rua": config.origem_rua,
    "origem-config-numero": config.origem_numero,
    "origem-config-bairro": config.origem_bairro,
    "origem-config-cidade": config.origem_cidade,
    "origem-config-estado": config.origem_estado,
    "origem-config-cep": config.origem_cep,
    "origem-config-referencia": config.origem_referencia,
    "regra-cobranca": config.regra_cobranca,
    "frete-valor-fixo": config.valor_fixo,
    "frete-taxa-inicial": config.taxa_inicial,
    "frete-valor-km": config.valor_por_km,
    "frete-minimo": config.taxa_minima,
    "frete-distancia-maxima": config.distancia_maxima_km,
    "sentido-distancia": config.sentido_distancia
  };
  for (const [id, value] of Object.entries(fields)) {
    const field = $(id);
    if (field) field.value = value ?? "";
  }
}

async function carregarConfiguracaoEntrega() {
  const status = $("entrega-config-status");
  try {
    const response = await fetch("/pedidos/configuracoes-entrega", {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.erro || data.message || `Não foi possível carregar as configurações (HTTP ${response.status}).`);
    }
    state.configEntrega = data;
    if (data.configurado) {
      preencherConfiguracao(data.configuracao);
      if (status) status.textContent = data.configuracao.origem_aproximada
        ? "Configuração salva. A origem usa um ponto aproximado, pois o número exato não foi localizado."
        : "Origem padrão e regra de frete configuradas.";
    } else if (status) {
      status.textContent = "Configure a origem padrão e a regra de frete antes de calcular ou salvar pedidos.";
    }
    if (!data.configurado) {
      $("painel-config-entrega").hidden = false;
      $("btn-config-entrega")?.setAttribute("aria-expanded", "true");
    }
    renderFreightRuleFields();
  } catch (error) {
    console.error(error);
    if (status) status.textContent = error.message;
  }
}

async function salvarConfiguracaoDeEntrega() {
  const feedback = $("config-entrega-feedback");
  const button = $("btn-salvar-config-entrega");
  if (feedback) feedback.textContent = "Salvando configurações...";
  if (button) button.disabled = true;
  try {
    const response = await fetch("/pedidos/configuracoes-entrega", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        origem: {
          ...configOriginAddress(),
          selectionToken: state.configEntregaSelecionada?.selectionToken || ""
        },
        regra_cobranca: $("regra-cobranca")?.value,
        valor_fixo: $("frete-valor-fixo")?.value,
        taxa_inicial: $("frete-taxa-inicial")?.value,
        valor_por_km: $("frete-valor-km")?.value,
        taxa_minima: $("frete-minimo")?.value,
        distancia_maxima_km: $("frete-distancia-maxima")?.value,
        sentido_distancia: $("sentido-distancia")?.value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.erro || data.message
        || `Não foi possível salvar as configurações (HTTP ${response.status}).`);
    }
    state.configEntrega = { configurado: true, configuracao: data.configuracao };
    state.configEntregaSelecionada = null;
    preencherConfiguracao(data.configuracao);
    if ($("entrega-config-status")) $("entrega-config-status").textContent = data.configuracao.origem_aproximada
      ? "Configuração salva. A origem usa um ponto aproximado, pois o número exato não foi localizado."
      : "Origem padrão e regra de frete configuradas.";
    if (feedback) feedback.textContent = "Configurações salvas. A nova regra será usada nos próximos cálculos.";
    invalidarRota("As configurações de entrega foram alteradas. Recalcule o frete deste pedido.");
  } catch (error) {
    console.error(error);
    if (feedback) feedback.textContent = error.message;
  } finally {
    if (button) button.disabled = false;
  }
}

async function salvarEndereco() {
  const payload = camposDestino();
  if (!payload.rua || !payload.cidade) {
    await window.FestAlert?.warning?.("Endereço", "Selecione ou preencha a rua e a cidade antes de salvar o endereço.");
    return;
  }
  try {
    const response = await fetch("/pedidos/criarEndereco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || "Não foi possível salvar o endereço.");
    state.enderecoSelecionado = {
      ...(state.enderecoSelecionado || {}),
      ...payload,
      id: data.id,
      selectionToken: state.enderecoSelecionado?.selectionToken || ""
    };
    await window.FestAlert?.success?.("Endereço salvo", "Endereço salvo com sucesso.");
  } catch (error) {
    console.error(error);
    await window.FestAlert?.error?.("Erro ao salvar endereço", error.message || "Não foi possível salvar o endereço.");
  }
}

export function inicializarEndereco() {
  const originInput = $("origem-config-query");
  const originList = $("origem-config-list");
  const destinationInput = $("end-rua");
  const destinationList = $("end-list");
  if (!destinationInput || !destinationList) return;

  if (originInput && originList) {
    createAutocomplete({
      input: originInput,
      list: originList,
      peerList: destinationList,
      getContext: () => ({
        cidade: $("origem-config-cidade")?.value.trim() || "",
        estado: $("origem-config-estado")?.value.trim() || "",
        bairro: $("origem-config-bairro")?.value.trim() || "",
        cep: $("origem-config-cep")?.value.trim() || ""
      }),
      contextInputs: ["origem-config-bairro", "origem-config-cidade", "origem-config-estado", "origem-config-cep"]
        .map((id) => $(id)).filter(Boolean),
      onTyping: () => { state.configEntregaSelecionada = null; },
      onSelect: (place) => {
        $("origem-config-query").value = place.descricao || displayDetails(place).slice(0, 2).join(", ");
        $("origem-config-rua").value = place.rua || "";
        if (place.numero && !$("origem-config-numero").value.trim()) $("origem-config-numero").value = place.numero;
        $("origem-config-bairro").value = place.bairro || "";
        $("origem-config-cidade").value = place.cidade || "";
        $("origem-config-estado").value = place.estado || "";
        $("origem-config-cep").value = place.cep || "";
        state.configEntregaSelecionada = place;
        closeList(originList);
      }
    });
    for (const id of ["origem-config-rua", "origem-config-bairro", "origem-config-cidade", "origem-config-estado", "origem-config-cep"]) {
      $(id)?.addEventListener("input", () => { state.configEntregaSelecionada = null; });
    }
  }
  createAutocomplete({
    input: destinationInput,
    list: destinationList,
    peerList: originList,
    contextInputs: ["end-bairro", "end-cidade", "end-estado", "end-cep"]
      .map((id) => $(id)).filter(Boolean),
    getContext: () => ({
      cidade: $("end-cidade")?.value.trim() || "",
      estado: $("end-estado")?.value.trim() || "",
      bairro: $("end-bairro")?.value.trim() || "",
      cep: $("end-cep")?.value.trim() || ""
    }),
    onTyping: () => {
      if (state.enderecoSelecionado && !enderecoCorrespondeASelecao()) {
        state.enderecoSelecionado = null;
        state.podeManterRotaSalva = false;
        invalidarRota("O destino mudou. Selecione outra sugestão e recalcule.");
      }
    },
    onSelect: (place) => selectDestination(place, destinationList)
  });

  document.addEventListener("click", (event) => {
    if (originInput && originList && !originInput.closest(".address-autocomplete")?.contains(event.target)) closeList(originList);
    if (!destinationInput.closest(".address-autocomplete")?.contains(event.target)) closeList(destinationList);
  });
  $("btn-cadastrar-endereco")?.addEventListener("click", salvarEndereco);
  $("btn-config-entrega")?.addEventListener("click", () => {
    const panel = $("painel-config-entrega");
    if (!panel) return;
    const expanded = panel.hidden;
    panel.hidden = !expanded;
    $("btn-config-entrega")?.setAttribute("aria-expanded", String(expanded));
  });
  $("regra-cobranca")?.addEventListener("change", renderFreightRuleFields);
  $("btn-salvar-config-entrega")?.addEventListener("click", salvarConfiguracaoDeEntrega);
  for (const id of ["end-numero"]) {
    $(id)?.addEventListener("input", () => {
      state.podeManterRotaSalva = false;
      invalidarRota("O número mudou. Recalcule a rota; o provedor pode localizar o imóvel ou usar uma aproximação.");
    });
  }
  carregarConfiguracaoEntrega();
}

export function preencherCamposEnderecoParaEdicao(pedido) {
  if (!pedido) return;
  const destination = pedido.endereco || {};
  state.enderecoSelecionado = destination;
  if ($("end-rua")) $("end-rua").value = destination.rua || "";
  if ($("end-numero")) $("end-numero").value = destination.numero || "";
  if ($("end-bairro")) $("end-bairro").value = destination.bairro || "";
  if ($("end-cidade")) $("end-cidade").value = destination.cidade || "";
  if ($("end-estado")) $("end-estado").value = destination.estado || "";
  if ($("end-cep")) $("end-cep").value = destination.cep || "";
  if ($("end-referencia")) $("end-referencia").value = destination.referencia || "";

  state.podeManterRotaSalva = true;
}
