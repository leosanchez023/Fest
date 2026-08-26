import { state } from "./state.js";
import { $, esc, fmt } from "./utils.js";
import { updateResumo } from "./financeiro.js";

export function adicionarItem() {
  const prodQuery = $("prod-query");
  const prodList = $("prod-list");
  const prodQtd = $("prod-qtd");

  if (!state.prodSel) {
    alert("Selecione um produto da lista.");
    return;
  }

  const qtd = Math.max(1, Number(prodQtd?.value) || 1);
  const existente = state.itens.findIndex((item) => String(item.produto_id) === String(state.prodSel.id));

  if (existente >= 0) {
    state.itens[existente].quantidade += qtd;
  } else {
    state.itens.push({
      produto_id: state.prodSel.id,
      nome: state.prodSel.nome,
      preco: state.prodSel.preco,
      quantidade: qtd
    });
  }

  state.prodSel = null;
  if (prodQuery) prodQuery.value = "";
  if (prodQtd) prodQtd.value = "1";
  if (prodList) prodList.style.display = "none";

  renderItens();
  updateResumo();
}

export function montarPedido() {
  const totalText = $("r-total")?.textContent || "0";
  const total = Number(totalText.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

  return {
    cliente_id: state.clienteSelecionado?.id || null,

  nome_cliente:
    state.clienteSelecionado?.nome || "Não informado",

  telefone_cliente:
    state.clienteSelecionado?.telefone ||
    $("tel-cliente")?.value ||
    "Não informado",

  endereco_id: state.enderecoSelecionado?.id || null,

  endereco: {
    rua: $("end-rua")?.value || "",
    numero: $("end-numero")?.value || "",
    bairro: $("end-bairro")?.value || "",
    cidade: $("end-cidade")?.value || "",
    estado: $("end-estado")?.value || ""
  },
    telefone_contato: $("tel-contato")?.value.trim() || "",
    tipo_pedido: $("tipo-pedido")?.value || "ALUGUEL",
    distancia_km: Number($("distancia-km")?.value) || 0,
    valor_frete: Number($("frete")?.value) || 0,
    valor_desconto: Number($("desconto")?.value) || 0,
    valor_pago: Number($("pago")?.value) || 0,
    forma_pagamento: $("forma-pagamento")?.value || null,
    observacao_pagamento: $("obs-pagamento")?.value || null,
    observacoes: $("observacoes")?.value || null,
    data_evento: $("data-evento")?.value || null,
    data_entrega: $("data-entrega")?.value || null,
    data_retirada: $("data-retirada")?.value || null,
    valor_produtos: state.itens.reduce(
  (total, item) =>
    total + (Number(item.preco) * Number(item.quantidade)),
  0
),
    itens: state.itens.map((item) => ({
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: Number(item.preco || 0),
      subtotal: Number(item.preco || 0) * Number(item.quantidade || 0),
      nome: item.nome
    })),
    valor_total: total
  };
}

export async function enviarPedido(saveAs = "CONFIRMADO") {
  if (!state.clienteSelecionado) {
    alert("Selecione um cliente.");
    return;
  }

  if (!state.itens.length) {
    alert("Adicione pelo menos um item.");
    return;
  }

  const pedido = montarPedido();
  pedido.status = saveAs === "ORCAMENTO" ? "ORCAMENTO" : "CONFIRMADO";
  pedido.status_documento = saveAs === "ORCAMENTO" ? "ORCAMENTO" : "PEDIDO";

  try {
    let url = "/pedidos/criar";
    let method = "POST";

    if (state.editingId) {
      url = `/pedidos/${state.editingId}`;
      method = "PUT";
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro ao salvar o pedido");

    if (state.editingId) {
      alert("Orçamento atualizado com sucesso!");
      window.location.href = '/orcamentos';
      return;
    }

    alert(saveAs === "ORCAMENTO" ? "Orçamento salvo com sucesso!" : "Pedido confirmado com sucesso!");
    state.itens = [];
    renderItens();
    updateResumo();
    document.querySelector("form")?.reset();

    state.clienteSelecionado = null;
    state.enderecoSelecionado = null;

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function carregarPedidoParaEdicao(id) {
  try {
    const res = await fetch(`/pedidos/obter/${id}`);
    if (!res.ok) throw new Error('Pedido não encontrado');
    const data = await res.json();

    const pedido = data.pedido || {};
    const itens = data.itens || [];

    // Cliente
    state.clienteSelecionado = {
      id: pedido.cliente_id,
      nome: pedido.cliente_nome,
      telefone: pedido.cliente_telefone,
      email: pedido.cliente_email
    };

    // Endereço (retornado como objeto pelo model)
    state.enderecoSelecionado = pedido.endereco || null;

    // Itens
    state.itens = itens.map(it => ({
      produto_id: it.produto_id,
      nome: it.produto_nome || it.nome,
      preco: it.valor_unitario ?? it.preco_unitario ?? 0,
      quantidade: it.quantidade
    }));

    // Campos simples
    if ($("tel-cliente")) $("tel-cliente").value = state.clienteSelecionado.telefone || "";
    if ($("tel-contato")) $("tel-contato").value = pedido.telefone_contato || "";
    if ($("data-evento")) $("data-evento").value = pedido.data_evento ? pedido.data_evento.split('T')[0] : "";
    if ($("data-entrega")) $("data-entrega").value = pedido.data_entrega ? pedido.data_entrega.split('T')[0] : "";
    if ($("data-retirada")) $("data-retirada").value = pedido.data_retirada ? pedido.data_retirada.split('T')[0] : "";
    if ($("tipo-pedido")) $("tipo-pedido").value = pedido.tipo_pedido || "ALUGUEL";
    if ($("frete")) $("frete").value = pedido.valor_frete || 0;
    if ($("desconto")) $("desconto").value = pedido.valor_desconto || 0;
    if ($("pago")) $("pago").value = pedido.valor_pago || 0;
    if ($("observacoes")) $("observacoes").value = pedido.observacoes || "";

    // marca modo edição
    state.editingId = pedido.id;

    // Atualiza título da página/header
    const pageMeta = document.querySelector('.page-meta');
    if (pageMeta) {
      pageMeta.dataset.title = `Editar Pedido #${pedido.id}`;
      pageMeta.dataset.subtitle = 'Editando pedido/orçamento';
    }

    // renderiza cliente e itens
    const box = $("cliente-display");
    if (box) {
      box.innerHTML = `
        <div class="cliente-box">
          <div class="cliente-info">
            <div class="nome">${esc(state.clienteSelecionado.nome || "")}</div>
            <div class="meta">${esc(state.clienteSelecionado.telefone || "")}</div>
          </div>
          <button type="button" class="btn-alterar" id="btn-alterar">Alterar</button>
        </div>
      `;
      const alterar = $("btn-alterar");
      if (alterar) alterar.onclick = () => {
        const abrir = $("btn-abrir-painel");
        if (abrir) abrir.click();
      };
    }

    preencherEndereco(state.enderecoSelecionado || {});
    renderItens();
    updateResumo();

  } catch (err) {
    console.error(err);
    alert(err.message || 'Erro ao carregar pedido');
  }
}

function renderItens() {
  const tbody = $("itens-tbody");
  if (!tbody) return;

  if (!state.itens.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum item adicionado.</td></tr>';
    return;
  }

  tbody.innerHTML = state.itens.map((item, idx) => `
    <tr>
      <td>${esc(item.nome)}</td>
      <td class="text-center">
        <input class="qtd-input" type="number" min="1" value="${item.quantidade}" data-idx="${idx}" />
      </td>
      <td class="text-right">${fmt(item.preco)}</td>
      <td class="text-right">${fmt(item.preco * item.quantidade)}</td>
      <td class="text-center">
        <button type="button" class="btn-remove" data-idx="${idx}">✕</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".qtd-input").forEach((input) => {
    input.onchange = () => {
      const idx = Number(input.dataset.idx);
      state.itens[idx].quantidade = Math.max(1, Number(input.value) || 1);
      renderItens();
      updateResumo();
    };
  });

  tbody.querySelectorAll(".btn-remove").forEach((button) => {
    button.onclick = () => {
      state.itens.splice(Number(button.dataset.idx), 1);
      renderItens();
      updateResumo();
    };
  });
}

function preencherEndereco(endereco) {
  state.enderecoSelecionado = endereco;

  if ($("end-rua")) $("end-rua").value = endereco?.rua || "";
  if ($("end-numero")) $("end-numero").value = endereco?.numero || "";
  if ($("end-bairro")) $("end-bairro").value = endereco?.bairro || "";
  if ($("end-cidade")) $("end-cidade").value = endereco?.cidade || "";
  if ($("end-estado")) $("end-estado").value = endereco?.estado || "";

  const painel = $("painel-endereco");
  if (painel) painel.style.display = "none";
}

async function buscarEnderecos() {
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
    const data = await res.json();

    if (!data.length) {
      painel.innerHTML = '<div class="lista-vazia">Nenhum endereço encontrado.</div>';
      painel.style.display = "block";
      return;
    }

    painel.innerHTML = data.map((endereco) => `
      <button type="button" class="cliente-card" data-id="${endereco.id}">
        <div><strong>${esc(endereco.rua || "")}</strong>, ${esc(endereco.numero || "")}</div>
        <small>${esc(endereco.bairro || "")} - ${esc(endereco.cidade || "")}/${esc(endereco.estado || "")}</small>
      </button>
    `).join("");

    painel.querySelectorAll(".cliente-card").forEach((button) => {
      button.onclick = () => {
        const endereco = data.find((item) => String(item.id) === button.dataset.id);
        if (endereco) preencherEndereco(endereco);
      };
    });

    painel.style.display = "block";
  } catch (err) {
    console.error(err);
    painel.innerHTML = '<div class="lista-vazia">Erro ao buscar endereço.</div>';
    painel.style.display = "block";
  }
}

function criarData(valor) {

  const [ano, mes, dia] =
    valor.split("-").map(Number);

  return new Date(ano, mes - 1, dia);

}

function validarFormulario() {

  // CLIENTE

  if (!state.clienteSelecionado) {
    throw new Error("Selecione um cliente.");
  }

  // ENDEREÇO

  if (!state.enderecoSelecionado) {
    throw new Error("Selecione um endereço.");
  }

  // ITENS

  if (!state.itens.length) {
    throw new Error("Adicione pelo menos um item.");
  }

  // DATAS

  if (!$("data-evento")?.value) {
    throw new Error("Informe a data do evento.");
  }

  if (!$("data-entrega")?.value) {
    throw new Error("Informe a data de entrega.");
  }

  if (!$("data-retirada")?.value) {
    throw new Error("Informe a data de retirada.");
  }

  const evento =
    criarData($("data-evento").value);

  const entrega =
    criarData($("data-entrega").value);

  const retirada =
    criarData($("data-retirada").value);

  if (isNaN(evento.getTime())) {
    throw new Error("Data do evento inválida.");
  }

  if (isNaN(entrega.getTime())) {
    throw new Error("Data de entrega inválida.");
  }

  if (isNaN(retirada.getTime())) {
    throw new Error("Data de retirada inválida.");
  }

  const hoje = new Date();

  hoje.setHours(0, 0, 0, 0);
  evento.setHours(0, 0, 0, 0);
  entrega.setHours(0, 0, 0, 0);
  retirada.setHours(0, 0, 0, 0);

  if (evento < hoje) {
    throw new Error("O evento não pode ser em uma data passada.");
  }

  if (entrega < hoje) {
    throw new Error("A entrega não pode ser em uma data passada.");
  }

  if (retirada < hoje) {
    throw new Error("A retirada não pode ser em uma data passada.");
  }

  if (entrega > evento) {
    throw new Error("A entrega não pode ocorrer após o evento.");
  }

  if (retirada < evento) {
    throw new Error("A retirada não pode ocorrer antes do evento.");
  }

  // TELEFONE

  const telefone =
    $("tel-contato")?.value.replace(/\D/g, "") || "";

  if (
    telefone &&
    telefone.length !== 10 &&
    telefone.length !== 11
  ) {
    throw new Error("Telefone para contato inválido.");
  }

  // DESCONTO

  const desconto =
    Number($("desconto")?.value || 0);

  if (desconto < 0) {
    throw new Error("Desconto inválido.");
  }

  // PAGAMENTO

  const pago =
    Number($("pago")?.value || 0);

  if (pago < 0) {
    throw new Error("Valor pago inválido.");
  }

  // FRETE

  const distancia =
    Number($("distancia-km")?.value || 0);

  if (distancia < 0) {
    throw new Error("Distância inválida.");
  }

}
export function inicializarPedido() {

  const btnAdd = $("btn-add-item");

  if (btnAdd) {
    btnAdd.addEventListener("click", adicionarItem);
  }


  const btnSalvarTela = $("btn-salvar-pedido");

if (btnSalvarTela) {

  btnSalvarTela.addEventListener("click", () => {

    try {

      validarFormulario();

      const pedido = montarPedido();

      window.ModalPedido.abrir({

        tipo: pedido.tipo_pedido,

        cliente: {
          nome: pedido.nome_cliente,
          telefone: pedido.telefone_cliente,
          telefoneContato: pedido.telefone_contato,
          endereco: `${pedido.endereco.rua}, ${pedido.endereco.numero}`,
          cidade: pedido.endereco.cidade,
          estado: pedido.endereco.estado
        },

        frete: {
          rua: pedido.endereco.rua,
          numero: pedido.endereco.numero,
          bairro: pedido.endereco.bairro,
          cidade: pedido.endereco.cidade,
          estado: pedido.endereco.estado,
          km: pedido.distancia_km,
          valor: pedido.valor_frete
        },

        pagamento: {
          forma: pedido.forma_pagamento,
          pago: pedido.valor_pago,
          desconto: pedido.valor_desconto,
          observacao: pedido.observacao_pagamento
        },

        itens: pedido.itens.map(item => ({
          nome: item.nome,
          qtd: item.quantidade,
          valor: item.preco_unitario
        })),

        observacoes: pedido.observacoes,
        dataEvento: pedido.data_evento,
        dataEntrega: pedido.data_entrega,
        dataRetirada: pedido.data_retirada,
        orcamento: pedido.status_documento === "ORCAMENTO"

      });

    } catch (erro) {

      alert(erro.message);

    }

  });

}

// CONFIRMAR PEDIDO
const btnConfirmar = $("btn-confirmar-modal");

if (btnConfirmar) {
  btnConfirmar.addEventListener("click", async () => {

    await enviarPedido("CONFIRMADO");

    window.ModalPedido.fechar();

  });
}


// GERAR ORÇAMENTO
const btnOrcamento = $("btn-gerar-orcamento-modal");

if (btnOrcamento) {
  btnOrcamento.addEventListener("click", async () => {

    await enviarPedido("ORCAMENTO");

    window.ModalPedido.fechar();

  });
}
   // BUSCAR ENDEREÇO
  const btnEndereco = $("btn-endereco");

  if (btnEndereco) {

    btnEndereco.addEventListener(
      "click",
      buscarEnderecos
    );

  }



  // IMPRIMIR
  const btnImprimir = $("btn-imprimir-pedido");

  if(btnImprimir){

    btnImprimir.addEventListener("click",()=>{

      const pedido = montarPedido();

      imprimirOrcamento(pedido);

    });

  }


  renderItens();
  updateResumo();

  // Se a URL indicar um orçamento para edição (?orcamento=ID), carrega os dados
  try {
    const params = new URLSearchParams(window.location.search);
    const orcId = params.get('orcamento') || params.get('editar') || params.get('id');
    if (orcId) {
      carregarPedidoParaEdicao(orcId);
    }
  } catch (e) {
    // ignore
  }

}


function imprimirOrcamento(pedido) {
  const janela = window.open("", "_blank");

  const formatar = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  janela.document.write(`
<!DOCTYPE html>
<html>

<head>
  <title>Orçamento Fest</title>

  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #222;
    }

    /* CABEÇALHO */

    .header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-bottom: 2px solid #000;
  padding-bottom: 15px;
  min-height: 110px;
}

.logo {
  position: absolute;
  left: 0;
  top: 0;
}

.logo img {
  width: 100px;
  height: auto;
}

.empresa {
  text-align: center;
}

.empresa h1 {
  margin: 0;
  font-size: 35px;
}

.empresa p {
  margin: 4px 0;
  font-size: 14px;
}

    .header h1 {
      margin: 0;
      font-size: 35px;
    }

    .header p {
      margin: 4px;
      font-size: 14px;
    }

    /* CARDS SUPERIORES */

    .topo {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 15px;
      margin-top: 20px;
    }

    .card {
      border: 1px solid #aaa;
      padding: 12px;
      min-height: 130px;
    }

    .titulo {
      margin-bottom: 10px;
      padding-bottom: 5px;
      font-size: 15px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
    }

    /* PRODUTOS */

    table {
      width: 100%;
      margin-top: 25px;
      border-collapse: collapse;
    }

    th {
      background: #eee;
    }

    td,
    th {
      padding: 8px;
      font-size: 13px;
      border: 1px solid #aaa;
    }

    .right {
      text-align: right;
    }

    /* RESUMO */

    .resumo {
      width: 300px;
      margin-top: 25px;
    }

    .resumo div {
      display: flex;
      justify-content: space-between;
      padding: 5px;
    }

    .total {
      font-size: 18px;
      font-weight: bold;
      border-top: 2px solid #000;
    }

    /* ASSINATURA */

    .assinatura {
      display: flex;
      justify-content: space-around;
      margin-top: 80px;
    }

    .linha {
      width: 200px;
      margin-top: 40px;
      border-top: 1px solid #000;
    }

    /* RODAPÉ */

    .footer {
      margin-top: 30px;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>

<body>

  <div class="header">

  <div class="logo">
    <img
  src="/img/ChatGPT%20Image%2024%20de%20jul.%20de%202026,%2019_53_14.png"
  alt="Logo Serve Festa"
  style="width:190px;height:auto;"
>
  </div>

  <div class="empresa">
    <h1>SERVE FESTA</h1>

    <p>Locação de artigos para festas</p>

    <p><strong>ORÇAMENTO</strong></p><br>



     <p>
       <p><strong><i class="fa-solid fa-phone"></i> (14) 99674-9672</strong></p> Rua Tupinambas, 10-A esquina c/ Joaquim Abarca - Centro - Tupã/SP
     </p>
  </div>

</div>
CNPJ: 20.894.431/0001-56
  <div class="topo">

    <!-- SOLICITANTE -->

    <div class="card">

      <div class="titulo">
        Dados do Solicitante
      </div>

      <p>
        <strong>Nome:</strong>
        ${pedido.nome_cliente || "Não informado"}
      </p>

      <p>
        <strong>Telefone:</strong>
        ${pedido.telefone_cliente || "-"}
      </p>

    </div>

    <!-- ENDEREÇO -->

    <div class="card">

      <div class="titulo">
        Endereço de Entrega
      </div>

      <p>
        ${pedido.endereco?.rua || ""}
        ${pedido.endereco?.numero || ""}
      </p>

      <p>
        ${pedido.endereco?.bairro || ""}
      </p>

      <p>
        ${pedido.endereco?.cidade || ""}
        -
        ${pedido.endereco?.estado || ""}
      </p>

      <br>

    </div>

    <!-- EVENTO -->

    <div class="card">

      <div class="titulo">
        Dados do Evento
      </div>

      <p>
        <strong>Evento:</strong>
        ${pedido.data_evento || "-"}
      </p>

      <p>
        <strong>Entrega:</strong>
        ${pedido.data_entrega || "-"}
      </p>

      <p>
        <strong>Retirada:</strong>
        ${pedido.data_retirada || "-"}
      </p>

    </div>

  </div>

  <h3>Produtos do Orçamento</h3>

  <table>

    <thead>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Valor Unit.</th>
        <th>Total</th>
      </tr>
    </thead>

    <tbody>

      ${pedido.itens.map(item => `
        <tr>
          <td>${item.nome}</td>
          <td class="right">${item.quantidade}</td>
          <td class="right">${formatar(item.preco_unitario)}</td>
          <td class="right">${formatar(item.subtotal)}</td>
        </tr>
      `).join("")}

    </tbody>

  </table>

  <!-- VALORES -->

  <div class="resumo">

    <div>
      <span>Produtos:</span>
      <span>${formatar(pedido.valor_produtos)}</span>
    </div>

    <div>
      <span>Frete:</span>
      <span>${formatar(pedido.valor_frete)}</span>
    </div>

    <div>
      <span>Desconto:</span>
      <span>${formatar(pedido.valor_desconto)}</span>
    </div>

    <div class="total">
      <span>TOTAL:</span>
      <span>
        ${formatar(
          pedido.valor_produtos +
          pedido.valor_frete -
          pedido.valor_desconto
        )}
      </span>
    </div>

  </div>

  <!-- ASSINATURAS -->

  <div class="assinatura">

    <div>
      <div class="linha"></div>
      Cliente
    </div>

    <div>
      <div class="linha"></div>
      Serve Festa
    </div>

  </div>

  <!-- RODAPÉ -->

  <div class="footer">
    Obrigado pela preferência!
    <br>
    Este orçamento depende da disponibilidade dos produtos.
  </div>

</body>

</html>
  `);

  janela.document.close();
  janela.print();
}