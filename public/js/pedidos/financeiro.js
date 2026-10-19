import { $, esc, fmt } from "./utils.js";
import { state } from "./state.js";

export function updateResumo() {
  const totalProdutos = state.itens.reduce(
    (s, i) => s + Number(i.preco || 0) * Number(i.quantidade || 0),
    0
  );

  const frete = Math.max(0, Number($("frete")?.value || 0));
  const desconto = Math.max(0, Number($("desconto")?.value || 0));
  const pago = Math.max(0, Number($("pago")?.value || 0));

  const total = totalProdutos + frete - desconto;
  const restante = Math.max(0, total - pago);

  const produtosEl = $("r-produtos");
  const freteEl = $("r-frete");
  const descontoEl = $("r-desconto");
  const pagoEl = $("r-pago");
  const restanteEl = $("r-restante");
  const totalEl = $("r-total");

  if (produtosEl) produtosEl.textContent = fmt(totalProdutos);
  if (freteEl) freteEl.textContent = fmt(frete);
  if (descontoEl) descontoEl.textContent = "- " + fmt(desconto);
  if (pagoEl) pagoEl.textContent = fmt(pago);
  if (restanteEl) restanteEl.textContent = fmt(restante);
  if (totalEl) totalEl.textContent = fmt(total);
}

export function invalidarRota(mensagem = "Selecione a origem e o destino para calcular a distância pelas vias.") {
  state.rotaCalculada = null;
  state.recalcularRota = false;
  if ($("distancia-km")) $("distancia-km").value = "";
  if ($("frete")) $("frete").value = "";
  if ($("info-frete")) $("info-frete").textContent = "";
  const resumo = $("resumo-rota");
  if (resumo) resumo.textContent = mensagem;
  updateResumo();
}

export async function calcularFrete() {
  const destino = state.enderecoSelecionado;
  const info = $("info-frete");
  if (!state.configEntrega?.configurado) {
    invalidarRota("Configure e salve a origem padrão e a regra de frete antes de calcular.");
    $("painel-config-entrega")?.removeAttribute("hidden");
    $("painel-config-entrega")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!destino?.selectionToken) {
    invalidarRota("Selecione uma sugestão geocodificada para o destino antes de calcular.");
    return;
  }

  const button = $("btn-calc-frete");
  if (button) button.disabled = true;
  if (info) info.textContent = "Calculando a rota pelas vias...";
  try {
    const response = await fetch("/pedidos/calcular-rota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinoToken: destino.selectionToken,
        destinoNumero: $("end-numero")?.value.trim() || "",
        destinoEndereco: {
          rua: $("end-rua")?.value.trim() || "",
          numero: $("end-numero")?.value.trim() || "",
          bairro: $("end-bairro")?.value.trim() || "",
          cidade: $("end-cidade")?.value.trim() || "",
          estado: $("end-estado")?.value.trim() || "",
          cep: $("end-cep")?.value.trim() || ""
        }
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.erro || "Não foi possível calcular a rota.");
    state.rotaCalculada = result;
    state.recalcularRota = true;
    state.podeManterRotaSalva = false;
    if ($("distancia-km")) $("distancia-km").value = result.distanciaCobradaKm.toFixed(2);
    if ($("frete")) $("frete").value = result.valorFrete.toFixed(2);
    if (info) info.textContent = "";
    const resumo = $("resumo-rota");
    if (resumo) {
      resumo.innerHTML = `
        <strong>Origem:</strong> ${esc(result.origem)}<br>
        <strong>Destino:</strong> ${esc(result.destino)}<br>
        <strong>Rota de ida:</strong> ${result.distanciaKm.toFixed(2)} km<br>
        ${result.sentidoDistancia === "IDA_VOLTA" ? `<strong>Rota de retorno:</strong> ${result.distanciaRetornoKm.toFixed(2)} km<br>` : ""}
        <strong>Distância cobrada (${result.sentidoDistancia === "IDA" ? "somente ida" : "ida e volta"}):</strong> ${result.distanciaCobradaKm.toFixed(2)} km<br>
        <strong>Regra aplicada:</strong> ${esc(result.formula)}<br>
        ${result.numeroLocalizado ? "<strong>Número:</strong> localização do imóvel encontrada pelo Photon.<br>" : result.destinoAproximado ? `<strong>Atenção:</strong> ${result.numeroLookupFalhou ? "não foi possível consultar o número do imóvel; " : "o número não possui ponto geográfico confiável; "}a rota usa a localização aproximada da rua.<br>` : ""}
        ${result.origemAproximada ? "<strong>Atenção:</strong> a origem usa uma localização aproximada.<br>" : ""}
        <strong>Frete:</strong> ${fmt(result.valorFrete)}
      `;
    }
    updateResumo();
  } catch (error) {
    console.error(error);
    invalidarRota(error.message);
    if (info) info.textContent = "O frete não foi calculado; não é possível salvar o pedido com esta rota.";
  } finally {
    if (button) button.disabled = false;
  }
}

export function inicializarFinanceiro() {
  const calcBtn = $("btn-calc-frete");
  if (calcBtn) calcBtn.addEventListener("click", calcularFrete);

  const desconto = $("desconto");
  if (desconto) desconto.addEventListener("input", updateResumo);

  const pago = $("pago");
  if (pago) pago.addEventListener("input", updateResumo);

  updateResumo();
}
