async function deletarProduto(id) {
  const result = await window.FestAlert?.confirm?.(
    "Confirmar exclusão",
    "Tem certeza que quer excluir este produto?"
  ) ?? { isConfirmed: true };

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`/produtos/deletar/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      await window.FestAlert.success("Produto excluído", "O produto foi removido com sucesso.");
      window.location.reload();
    } else {
      await window.FestAlert.error("Não foi possível excluir", data.mensagem || "Erro ao deletar");
    }
  } catch (err) {
    await window.FestAlert.error("Erro de conexão", "Não foi possível concluir a exclusão.");
    console.error(err);
  }
}

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