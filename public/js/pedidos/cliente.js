import { state } from "./state.js";
import { $, esc, debounce } from "./utils.js";

function renderCliente() {
  const box = $("cliente-display");
  if (!box) return;

  if (!state.clienteSelecionado) {
    box.innerHTML = `
      <button type="button" class="btn-dashed" id="btn-abrir-painel">
        + Buscar ou Cadastrar Cliente
      </button>
    `;
    const abrir = $("btn-abrir-painel");
    if (abrir) abrir.onclick = () => togglePainel(true);
    return;
  }

  const cliente = state.clienteSelecionado;
  box.innerHTML = `
    <div class="cliente-box">
      <div class="cliente-info">
        <div class="nome">${esc(cliente.nome || "")}</div>
        <div class="meta">
          ${esc(cliente.cpf || "")}
          ${cliente.telefone ? " • " + esc(cliente.telefone) : ""}
          ${cliente.email ? " • " + esc(cliente.email) : ""}
        </div>
      </div>
      <button type="button" class="btn-alterar" id="btn-alterar">Alterar</button>
    </div>
  `;

  const alterar = $("btn-alterar");
  if (alterar) alterar.onclick = () => togglePainel(true);

  // Preenche o telefone do cliente
if ($("tel-cliente")) {
  $("tel-cliente").value = cliente.telefone || "";
}

// Deixa o telefone para contato vazio
if ($("tel-contato")) {
  $("tel-contato").value = "";
}
}

function togglePainel(abrir) {
  const painel = $("cliente-painel");
  if (!painel) return;

  painel.style.display = abrir ? "block" : "none";
  if (!abrir) return;

  const fechar = $("btn-fechar-painel");
  if (fechar) fechar.onclick = () => togglePainel(false);

  const buscarTab = $("tab-buscar");
  const cadastrarTab = $("tab-cadastrar");
  if (buscarTab && cadastrarTab) {
    buscarTab.onclick = () => renderBuscaCliente();
    cadastrarTab.onclick = () => renderCadastroCliente();
  }

  renderBuscaCliente();
}

function renderBuscaCliente() {
  const buscar = $("buscar-cliente");
  const cadastro = $("cadastro-cliente");

  if (buscar) {
    buscar.style.display = "block";
  }

  if (cadastro) {
    cadastro.style.display = "none";
  }

  const body = $("buscar-cliente");
  if (!body) return;

  body.innerHTML = `
    <input id="busca-cliente" class="input" placeholder="Buscar cliente..." autocomplete="off">
    <div id="lista-clientes"></div>
  `;

  const input = $("busca-cliente");
  const lista = $("lista-clientes");
  if (!input || !lista) return;

  const buscar = debounce(async () => {
    const termo = input.value.trim();
    if (!termo) {
      lista.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`/pedidos/buscar-clientes?q=${encodeURIComponent(termo)}`);
      const clientes = await res.json();

      if (!clientes.length) {
        lista.innerHTML = '<div>Nenhum cliente encontrado</div>';
        return;
      }

      lista.innerHTML = clientes.map((cliente) => `
        <button type="button" class="cliente-card" data-cliente='${esc(JSON.stringify(cliente))}'>
          <b>${esc(cliente.nome || "")}</b>
          <small>${esc(cliente.telefone || "")} ${esc(cliente.email || "")}</small>
        </button>
      `).join("");

      lista.querySelectorAll(".cliente-card").forEach((botao) => {
        botao.onclick = () => {
          state.clienteSelecionado = JSON.parse(botao.dataset.cliente);
          renderCliente();
          togglePainel(false);
        };
      });
    } catch (err) {
      console.error(err);
      lista.innerHTML = '<div>Erro ao buscar clientes</div>';
    }
  }, 300);

  input.addEventListener("input", buscar);
}

function renderCadastroCliente() {

  const buscar = $("buscar-cliente");
  const cadastro = $("cadastro-cliente");

  if (buscar) buscar.style.display = "none";
  if (cadastro) cadastro.style.display = "block";

  const form = $("form-cadastro-cliente");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const res = await fetch(form.action, {
      method: "POST",
      headers: {
        Accept: "application/json"
      },
      body: formData
    });

    const cliente = await res.json();

    if (!res.ok) {
      throw new Error(cliente.erro || "Erro ao cadastrar cliente.");
    }

    state.clienteSelecionado = cliente;

    renderCliente();
    togglePainel(false);
  });

}


export function inicializarCliente() {
  renderCliente();
}
