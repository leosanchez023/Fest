import { state } from "./state.js";
import { $, esc, fmt, debounce } from "./utils.js";
import { adicionarItem } from "./pedido.js";

export function inicializarProduto() {
  const prodQuery = $("prod-query");
  const prodList = $("prod-list");
  const btnAdd = $("btn-add-item");

  if (!prodQuery || !prodList) return;

  const buscarProdutos = debounce(async () => {
    const q = prodQuery.value.trim();
    state.prodSel = null;

    if (!q) {
      prodList.style.display = "none";
      prodList.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`/pedidos/buscar-produtos?q=${encodeURIComponent(q)}`);
      const produtos = await res.json();

      if (!Array.isArray(produtos) || !produtos.length) {
        prodList.style.display = "none";
        prodList.innerHTML = "";
        return;
      }

      prodList.innerHTML = produtos.map((p) => `
        <button type="button" class="autocomplete-item"
          data-id="${esc(p.id)}"
          data-nome="${esc(p.nome)}"
          data-preco="${esc(p.preco_venda)}">
          <span>${esc(p.nome)}</span>
          <span class="preco">${fmt(p.preco_venda)}</span>
        </button>
      `).join("");

      prodList.style.display = "block";
      prodList.querySelectorAll(".autocomplete-item").forEach((btn) => {
        btn.onclick = () => {
          state.prodSel = {
            id: btn.dataset.id,
            nome: btn.dataset.nome,
            preco: Number(btn.dataset.preco)
          };
          prodQuery.value = state.prodSel.nome;
          prodList.style.display = "none";
        };
      });
    } catch (err) {
      console.error(err);
    }
  }, 250);

  prodQuery.addEventListener("input", buscarProdutos);
  prodQuery.addEventListener("focus", buscarProdutos);

  document.addEventListener("click", (e) => {
    if (!prodQuery.contains(e.target) && !prodList.contains(e.target)) {
      prodList.style.display = "none";
    }
  });

  if (btnAdd) btnAdd.addEventListener("click", adicionarItem);
}