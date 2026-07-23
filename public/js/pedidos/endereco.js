import { state } from "./state.js";
import { $, esc } from "./utils.js";

function selecionarEndereco(endereco) {
  state.enderecoSelecionado = endereco;

  if ($("end-rua")) $("end-rua").value = endereco?.rua || "";
  if ($("end-numero")) $("end-numero").value = endereco?.numero || "";
  if ($("end-bairro")) $("end-bairro").value = endereco?.bairro || "";
  if ($("end-cidade")) $("end-cidade").value = endereco?.cidade || "";
  if ($("end-estado")) $("end-estado").value = endereco?.estado || "";

  const painel = $("painel-endereco");
  if (painel) painel.style.display = "none";
}

async function buscarEndereco() {
  const filtros = {
    rua: $("end-rua")?.value.trim() || "",
    numero: $("end-numero")?.value.trim() || "",
    bairro: $("end-bairro")?.value.trim() || "",
    cidade: $("end-cidade")?.value.trim() || "",
    estado: $("end-estado")?.value.trim() || ""
  };

  const query = Object.values(filtros).filter(Boolean).join(" ");
  if (!query) {
    alert("Digite pelo menos um campo do endereço para buscar.");
    return;
  }

  const params = new URLSearchParams(filtros);
  const painel = $("painel-endereco");
  if (!painel) return;

  try {
    const res = await fetch(`/pedidos/buscar-enderecos?${params}`);
    const dados = await res.json();

    if (!dados.length) {
      painel.innerHTML = '<div class="lista-vazia">Nenhum endereço encontrado.</div>';
      painel.style.display = "block";
      return;
    }

    painel.innerHTML = dados.map((endereco) => `
      <button type="button" class="cliente-card" data-id="${endereco.id}">
        <div><strong>${esc(endereco.rua || "")}</strong>, ${esc(endereco.numero || "")}</div>
        <small>${esc(endereco.bairro || "")} - ${esc(endereco.cidade || "")}/${esc(endereco.estado || "")}</small>
      </button>
    `).join("");

    painel.querySelectorAll(".cliente-card").forEach((botao) => {
      botao.onclick = () => {
        const encontrado = dados.find((item) => String(item.id) === botao.dataset.id);
        if (encontrado) selecionarEndereco(encontrado);
      };
    });

    painel.style.display = "block";
  } catch (err) {
    console.error(err);
    painel.innerHTML = '<div class="lista-vazia">Erro ao buscar endereço.</div>';
    painel.style.display = "block";
  }
}

async function cadastrarEndereco() {
  const payload = {
    rua: $("end-rua")?.value.trim() || "",
    numero: $("end-numero")?.value.trim() || "",
    bairro: $("end-bairro")?.value.trim() || "",
    cidade: $("end-cidade")?.value.trim() || "",
    estado: $("end-estado")?.value.trim() || ""
  };

  try {
    const res = await fetch("/pedidos/criarEndereco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro ao cadastrar endereço");

    selecionarEndereco({ ...payload, id: data.id });
    alert("Endereço salvo com sucesso.");
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

export function inicializarEndereco() {
  const btnBuscar = $("btn-endereco");
  if (btnBuscar) btnBuscar.addEventListener("click", buscarEndereco);

  const btnCadastrar = $("btn-cadastrar-endereco");
  if (btnCadastrar) btnCadastrar.addEventListener("click", cadastrarEndereco);
}
