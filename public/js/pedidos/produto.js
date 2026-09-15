import { state } from "./state.js";
import { $, esc, fmt, debounce } from "./utils.js";
import { adicionarItem } from "./pedido.js";

export function inicializarProduto() {
  const prodQuery = $("prod-query");
  const prodList = $("prod-list");
  const btnAdd = $("btn-add-item");
  const tipoItem = $("tipo-item");
  const itemLabel = $("item-label");

  if (!prodQuery || !prodList) return;

  const buscarItens = debounce(async () => {
    const q = prodQuery.value.trim();
    state.prodSel = null;
    state.comboSel = null;

    if (!q) {
      prodList.style.display = "none";
      prodList.innerHTML = "";
      return;
    }

    try {
      const endpoint = state.tipoItem === "COMBO"
        ? "/combos/api"
        : `/pedidos/buscar-produtos?q=${encodeURIComponent(q)}`;
      const res = await fetch(endpoint);
      const itens = await res.json();
      const resultados = state.tipoItem === "COMBO"
        ? itens.filter((item) => `${item.nome || ""} ${item.codigo || ""}`.toLowerCase().includes(q.toLowerCase()))
        : itens;

      if (!Array.isArray(resultados) || !resultados.length) {
        prodList.style.display = "none";
        prodList.innerHTML = "";
        return;
      }

      prodList.innerHTML = resultados.map((p) => `
        <button type="button" class="autocomplete-item"
          data-id="${esc(p.id)}"
          data-nome="${esc(p.nome)}"
          data-preco="${esc(state.tipoItem === "COMBO" ? p.preco_aluguel : p.preco_venda)}">
          <span>${esc(p.nome)}</span>
          <span class="preco">${fmt(p.preco_venda)}</span>
        </button>
      `).join("");

      prodList.style.display = "block";
      prodList.querySelectorAll(".autocomplete-item").forEach((btn) => {
        btn.onclick = () => {
          const selecionado = { id: btn.dataset.id, nome: btn.dataset.nome, preco: Number(btn.dataset.preco) };
          if (state.tipoItem === "COMBO") state.comboSel = selecionado;
          else state.prodSel = selecionado;
          prodQuery.value = selecionado.nome;
          prodList.style.display = "none";
        };
      });
    } catch (err) {
      console.error(err);
    }
  }, 250);

  prodQuery.addEventListener("input", buscarItens);
  prodQuery.addEventListener("focus", buscarItens);
  tipoItem?.addEventListener("change", () => {
    state.tipoItem = tipoItem.value;
    itemLabel.textContent = state.tipoItem === "COMBO" ? "Combo" : "Produto";
    prodQuery.value = "";
    prodList.style.display = "none";
  });

  document.addEventListener("click", (e) => {
    if (!prodQuery.contains(e.target) && !prodList.contains(e.target)) {
      prodList.style.display = "none";
    }
  });

  if (btnAdd) btnAdd.addEventListener("click", adicionarItem);
}