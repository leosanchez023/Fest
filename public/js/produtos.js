async function deletarProduto(id) {
  const result = await window.FestAlert?.confirm?.(
    "Confirmar exclusão",
    "Tem certeza de que deseja excluir este produto? O histórico e os vínculos existentes serão preservados."
  ) ?? { isConfirmed: window.confirm("Tem certeza de que deseja excluir este produto? O histórico e os vínculos existentes serão preservados.") };

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`/produtos/deletar/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok && data.sucesso) {
      if (window.FestAlert?.success) {
        await window.FestAlert.success("Produto excluído", data.mensagem || "O produto foi removido da listagem; o histórico foi preservado.");
      } else {
        window.alert(data.mensagem || "O produto foi removido da listagem; o histórico foi preservado.");
      }
      window.location.reload();
    } else {
      const message = data.erro || data.mensagem || "Não foi possível excluir o produto.";
      if (window.FestAlert?.error) await window.FestAlert.error("Não foi possível excluir", message);
      else window.alert(message);
    }
  } catch (err) {
    console.error(err);
    if (window.FestAlert?.error) await window.FestAlert.error("Erro de conexão", "Não foi possível concluir a exclusão.");
    else window.alert("Não foi possível concluir a exclusão.");
  }
}

window.deletarProduto = deletarProduto;

function fecharMenusProduto() {
  document.querySelectorAll(".product-menu").forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll("[data-product-list-menu], [data-product-menu]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

document.addEventListener("click", (event) => {
  const menuButton = event.target.closest("[data-product-list-menu]");
  if (menuButton) {
    const menu = document.getElementById(`menu-lista-produto-${menuButton.dataset.productListMenu}`);
    const abrir = menu?.hidden;
    fecharMenusProduto();
    if (menu && abrir) {
      menu.hidden = false;
      menuButton.setAttribute("aria-expanded", "true");
    }
    return;
  }
  const deleteButton = event.target.closest("[data-product-list-delete]");
  if (deleteButton) {
    fecharMenusProduto();
    deletarProduto(deleteButton.dataset.productListDelete);
    return;
  }
  if (!event.target.closest(".product-actions")) fecharMenusProduto();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") fecharMenusProduto();
});

function abrirAbaProdutos(nome) {
  const abaProdutos = document.getElementById("aba-produtos");
  const abaCadastro = document.getElementById("aba-cadastro");
  const cadastroAtivo = nome === "cadastro";

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === nome);
  });

  if (abaProdutos) abaProdutos.style.display = cadastroAtivo ? "none" : "block";
  if (abaCadastro) abaCadastro.style.display = cadastroAtivo ? "block" : "none";
}

window.abrirAba = abrirAbaProdutos;

const abaProdutosBtn = document.querySelector('[data-tab="produtos"]');
const abaCadastroBtn = document.querySelector('[data-tab="cadastro"]');
const pageMeta = document.querySelector(".page-meta");
const defaultPageTitle = pageMeta?.dataset.title || "Controle de Estoque";
const defaultPageSubtitle = pageMeta?.dataset.subtitle || "Gerencie produtos, estoque, movimentações e disponibilidade.";

abaProdutosBtn?.addEventListener("click", () => abrirAbaProdutos("produtos"));
abaCadastroBtn?.addEventListener("click", () => abrirAbaProdutos("cadastro"));

function syncProductTabWithHash() {
  if (window.location.hash === "#cadastro") {
    abrirAbaProdutos("cadastro");
    if (pageMeta) {
      pageMeta.dataset.title = "Cadastro de Produtos";
      pageMeta.dataset.subtitle = "Cadastre novos produtos no sistema.";
    }
    return;
  }

  if (window.location.pathname === "/produtos") {
    abrirAbaProdutos("produtos");
    if (pageMeta) {
      pageMeta.dataset.title = defaultPageTitle;
      pageMeta.dataset.subtitle = defaultPageSubtitle;
    }
  }
}

window.addEventListener("hashchange", syncProductTabWithHash);
syncProductTabWithHash();