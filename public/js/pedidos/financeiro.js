import { $, fmt } from "./utils.js";
import { state } from "./state.js";

const PRECO_KM = 2.5;

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

export function calcularFrete() {
  const km = Number($("distancia-km")?.value || 0);
  const frete = km * PRECO_KM;

  const freteInput = $("frete");
  if (freteInput) freteInput.value = frete.toFixed(2);

  const info = $("info-frete");
  if (info) {
    info.innerHTML = km > 0
      ? `${km} km × R$ ${PRECO_KM.toFixed(2)} = <b>R$ ${frete.toFixed(2)}</b>`
      : "";
  }

  updateResumo();
}

export function inicializarFinanceiro() {
  const distancia = $("distancia-km");
  if (distancia) distancia.addEventListener("input", calcularFrete);

  const calcBtn = $("btn-calc-frete");
  if (calcBtn) calcBtn.addEventListener("click", calcularFrete);

  const frete = $("frete");
  if (frete) frete.addEventListener("input", updateResumo);

  const desconto = $("desconto");
  if (desconto) desconto.addEventListener("input", updateResumo);

  const pago = $("pago");
  if (pago) pago.addEventListener("input", updateResumo);

  updateResumo();
}
