async function deletarProduto(id) {
  if (!confirm("Tem certeza que quer excluir?")) return;

  try {
    const res = await fetch(`/produtos/deletar/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      window.location.reload(); // recarrega a tabela
    } else {
      alert(data.mensagem || "Erro ao deletar");
    }
  } catch (err) {
    alert("Erro de conexão ao deletar");
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

abaProdutosBtn?.addEventListener("click", () => abrirAbaProdutos("produtos"));
abaCadastroBtn?.addEventListener("click", () => abrirAbaProdutos("cadastro"));