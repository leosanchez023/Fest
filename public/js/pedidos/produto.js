import { state } from "./state.js";
import { $, esc, fmt, debounce } from "./utils.js";
import { adicionarItem } from "./pedido.js";

export function inicializarProduto() {
  const prodQuery = $("prod-query");
  const prodList = $("prod-list");
  const btnAdd = $("btn-add-item");

  if (!prodQuery || !prodList) return;

  const buscarItens = debounce(async () => {
    const q = prodQuery.value.trim();
    state.prodSel = null;
    state.comboSel = null;
    state.itemSel = null;

    if (!q) {
      prodList.style.display = "none";
      prodList.innerHTML = "";
      return;
    }

    try {
      const endpoint = `/pedidos/buscar-itens?q=${encodeURIComponent(q)}`;
      const res = await fetch(endpoint);
      const itens = await res.json();
      const resultados = Array.isArray(itens) ? itens : [];

      if (!Array.isArray(resultados) || !resultados.length) {
        prodList.style.display = "none";
        prodList.innerHTML = "";
        return;
      }

      prodList.innerHTML = resultados.map((p) => `
        <button type="button" class="autocomplete-item"
          data-id="${esc(p.id)}"
          data-nome="${esc(p.nome)}"
          data-origem="${esc(p.origem)}"
          data-preco-venda="${esc(p.preco_venda)}"
          data-preco-aluguel="${esc(p.preco_aluguel)}">
          <span>${esc(p.nome)} <small>(${p.origem === "COMBO" ? "Combo" : "Produto"})</small></span>
          <span class="preco">${p.origem === "COMBO"
            ? `Preço ${fmt(p.preco_aluguel)}`
            : `Venda ${fmt(p.preco_venda)} · Aluguel ${fmt(p.preco_aluguel)}`}</span>
        </button>
      `).join("");

      prodList.style.display = "block";
      prodList.querySelectorAll(".autocomplete-item").forEach((btn) => {
        btn.onclick = () => {
        const precoVenda = Number(btn.dataset.precoVenda || 0);
        const precoAluguel = Number(btn.dataset.precoAluguel || 0);
        const selecionado = {
          id: btn.dataset.id,
          nome: btn.dataset.nome,
          preco: precoAluguel,
          preco_venda: precoVenda,
          preco_aluguel: precoAluguel,
          origem: btn.dataset.origem,
          tipo_item: "ALUGUEL",
          pode_alternar_tipo: true
        };
          state.itemSel = selecionado;
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
  document.addEventListener("click", (e) => {
    if (!prodQuery.contains(e.target) && !prodList.contains(e.target)) {
      prodList.style.display = "none";
    }
  });

  if (btnAdd) btnAdd.addEventListener("click", adicionarItem);
}