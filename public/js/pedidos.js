
/* ======================================================
   FUNÇÕES UTILITÁRIAS
====================================================== */

// Atalho para buscar elementos pelo ID
const $ = id => document.getElementById(id);

// Formata valores monetários no padrão brasileiro
const fmt = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

// Escapa caracteres HTML para evitar XSS ao injetar texto
const esc = s => (s || '').toString().replace(/[&<>"]/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[ch]));

// Pequeno debounce para evitar requisições a cada tecla
function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}


/* ======================================================
   ESTADO GLOBAL
====================================================== */

let clienteSelecionado = null; // Cliente atualmente vinculado ao pedido
let itens              = [];   // Itens adicionados ao pedido
let prodSel            = null; // Produto selecionado no autocomplete
let tabAtiva           = 'buscar'; // Aba ativa do painel cliente
let enderecoSelecionado = null;

/* ======================================================
   CLIENTE - EXIBIÇÃO PRINCIPAL
====================================================== */

function renderCliente() {
  const box = $('cliente-display');

  // Nenhum cliente selecionado -> mostra botão para abrir o painel
  if (!clienteSelecionado) {
    box.innerHTML = `
      <button type="button" class="btn-dashed" id="btn-abrir-painel">
        + Buscar ou Cadastrar Cliente
      </button>
    `;
    $('btn-abrir-painel').onclick = () => togglePainel(true);
    return;
  }

  // Cliente selecionado -> mostra dados resumidos + botão alterar
  const c = clienteSelecionado;
  box.innerHTML = `
    <div class="cliente-box">
      <div class="cliente-info">
        <div class="nome">${esc(c.nome)}</div>
        <div class="meta">
          ${esc(c.cpf || '')} ${c.cpf ? '·' : ''}
          ${esc(c.telefone || '')} ${c.telefone ? '·' : ''}
          ${esc(c.email || '')}
        </div>
      </div>
      <button type="button" class="btn-alterar" id="btn-alterar">Alterar</button>
    </div>
  `;
  $('btn-alterar').onclick = () => togglePainel(true);

  // Preenche automaticamente o telefone do cliente
  if (c.telefone) $('tel-cliente').value = c.telefone;
}


/* ======================================================
   CLIENTE - PAINEL (ABRIR / FECHAR / TABS)
====================================================== */

function togglePainel(abrir) {
  const painel = $('cliente-painel');
  if (!painel) return;

  if (!abrir) {
    painel.style.display = 'none';
    return;
  }

  // Monta a estrutura interna do painel (header + tabs + corpo)
  painel.style.display = 'block';
  painel.innerHTML = `
    <div class="client-panel">
      <div class="client-panel-header">
        <strong>Buscar ou cadastrar cliente</strong>
        <button type="button" class="btn-close" id="btn-fechar-painel">✖</button>
      </div>

      <div class="tabs">
        <button type="button" id="tab-buscar">🔍 Buscar</button>
        <button type="button" id="tab-cadastrar">➕ Cadastrar⚠️</button>
      </div>

      <div id="painel-body"></div>
    </div>
  `;

  $('btn-fechar-painel').onclick = () => togglePainel(false);
  $('tab-buscar').onclick        = () => setClientTab('buscar');
  $('tab-cadastrar').onclick     = () => setClientTab('cadastrar');

  setClientTab(tabAtiva);
}

function setClientTab(tab) {
  tabAtiva = tab;

  // Destaca a aba ativa
  $('tab-buscar').classList.toggle('active', tab === 'buscar');
  $('tab-cadastrar').classList.toggle('active', tab === 'cadastrar');

  // Renderiza o conteúdo correspondente
  if (tab === 'buscar') renderBuscaCliente();
  else                  renderCadastroCliente();
}


/* ======================================================
   CLIENTE - BUSCA (usa endpoint /pedidos/buscar-clientes)
====================================================== */

function renderBuscaCliente() {
  const body = $('painel-body');

  body.innerHTML = `
    <input id="busca-cliente" class="input"
      placeholder="Buscar por nome, CPF, telefone, email ou endereço..."
      autocomplete="off" />
    <div id="lista-clientes" class="lista-clientes"></div>
  `;

  const input = $('busca-cliente');
  const lista = $('lista-clientes');
  input.focus();

  // Busca clientes no backend conforme o usuário digita (com debounce)
  const buscar = debounce(async () => {
    const termo = input.value.trim();

    if (!termo) { lista.innerHTML = ''; return; }

    try {
      const res = await fetch(`/pedidos/buscar-clientes?q=${encodeURIComponent(termo || '')}`);
      if (!res.ok) {
  const erroTexto = await res.text();
  throw new Error(erroTexto);
}
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        lista.innerHTML = `<div class="lista-vazia">Nenhum cliente encontrado.</div>`;
        return;
      }

      // Renderiza os resultados
      lista.innerHTML = data.map(c => `
  <button type="button" class="cliente-card"
    data-cliente='${esc(JSON.stringify(c))}'>

    <div class="cliente-avatar">
      ${esc(c.nome?.charAt(0) || '?')}
    </div>

    <div class="cliente-info">
      <div class="cliente-nome">${esc(c.nome || '')}</div>

      <div class="cliente-meta">
        ${c.cpf ? `CPF: ${esc(c.cpf)}` : ''}
        ${c.telefone ? ` • ${esc(c.telefone)}` : ''}
        ${c.email ? ` • ${esc(c.email)}` : ''}
      </div>
    </div>

  </button>
`).join('');

      // Clique seleciona o cliente
      lista.querySelectorAll('.cliente-card').forEach(btn => {
        btn.onclick = () => {
          try {
            clienteSelecionado = JSON.parse(btn.dataset.cliente
              .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
          } catch (e) { console.error(e); }
          renderCliente();
          togglePainel(false);
        };
      });
    } catch (err) {
      console.error("ERRO REAL:", err);
      lista.innerHTML = `<div class="lista-vazia">${err.message}</div>`;
      }
  }, 300);

  input.addEventListener('input', buscar);
}

function preencherClienteSelecionado() {
  if (!clienteSelecionado) return;

  // telefone do cliente no pedido
  $('tel-contato').value = clienteSelecionado.telefone || '';

}

/* ======================================================
   CLIENTE - CADASTRO (usa endpoint /pedidos/criarCliente)
====================================================== */

function renderCadastroCliente() {
  const body = $('painel-body');

  body.innerHTML = `
    <form id="form-novo" class="form-grid-clientes">

  <div class="field">
    <label>Nome completo</label>
    <input name="nome" class="input" placeholder="Nome completo" required />
  </div>

  <div class="field">
    <label>CPF</label>
    <input name="cpf" class="input" placeholder="000.000.000-00" />
  </div>

  <div class="field">
    <label>Telefone</label>
    <input name="telefone" class="input" placeholder="(00) 00000-0000" />
  </div>

  <div class="field">
    <label>Email</label>
    <input name="email" class="input" placeholder="email@exemplo.com" />
  </div>

  <div class="field full">
    <label>Endereço</label>
    <input name="endereco" class="input" placeholder="Rua, número, bairro, cidade" />
  </div>

  <div class="form-actions-client">
    <button type="submit" class="btn btn-teal">Salvar cliente</button>
  </div>

</form>
  `;

  $('form-novo').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;

    const novo = {
      nome:     f.nome.value.trim(),
      cpf:      f.cpf.value.trim(),
      telefone: f.telefone.value.trim(),
      email:    f.email.value.trim(),
      endereco: f.endereco.value.trim()
    };

    try {
      const res = await fetch('/pedidos/criarCliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo)
      });
      if (!res.ok) throw new Error('Erro ao cadastrar');

      // Backend deve retornar o cliente salvo (com id)
      const clienteSalvo = await res.json();
      clienteSelecionado = clienteSalvo;
      renderCliente();
      togglePainel(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar cliente');
    }
  };
}


 /* ======================================================
   PRODUTOS - AUTOCOMPLETE (usa /pedidos/buscar-produtos)
====================================================== */

const prodQuery = $('prod-query');
const prodList  = $('prod-list');

const endRua    = $('end-rua');
const endList   = $('end-list');
const endCidade = $('end-cidade');
const endEstado = $('end-estado');
const endBairro = $('end-bairro');


const buscarProdutos = debounce(async () => {
  const q = prodQuery.value.trim();
  prodSel = null;

  if (!prodQuery || !prodList) {
    console.error("Autocomplete de produto não encontrado no DOM");
    return;
  }

  try {
    const response = await fetch(`/pedidos/buscar-produtos?q=${encodeURIComponent(q)}`);
    const produtos = await response.json();

    if (!Array.isArray(produtos) || !produtos.length) {
      prodList.style.display = 'none';
      return;
    }

    prodList.innerHTML = produtos.map(p => `
      <button type="button" class="autocomplete-item"
        data-id="${esc(p.id)}"
        data-nome="${esc(p.nome)}"
        data-preco="${esc(p.preco_venda)}">
        <span>${esc(p.nome)}</span>
        <span class="preco">${fmt(p.preco_venda)}</span>
      </button>
    `).join('');

    prodList.style.display = 'block';

    prodList.querySelectorAll('.autocomplete-item').forEach(btn => {
      btn.onclick = () => {
        prodSel = {
          id:    btn.dataset.id,
          nome:  btn.dataset.nome,
          preco: Number(btn.dataset.preco)
        };

        prodQuery.value = prodSel.nome;
        prodList.style.display = 'none';
      };
    });

  } catch (erro) {
    console.error('Erro produtos:', erro);
  }
}, 250);


/* eventos do autocomplete de produtos */
prodQuery.addEventListener('input', buscarProdutos);
prodQuery.addEventListener('focus', buscarProdutos);


/* fechar lista ao clicar fora */
document.addEventListener('click', e => {
  if (!prodQuery.contains(e.target) && !prodList.contains(e.target)) {
    prodList.style.display = 'none';
  }
});


/* ======================================================
   ITENS DO PEDIDO - ADICIONAR / RENDERIZAR / REMOVER
====================================================== */

$('btn-add-item').onclick = () => {
  if (!prodSel) return alert('Selecione um produto da lista.');

  const qtd = Math.max(1, Number($('prod-qtd').value) || 1);

  itens.push({
    produto_id: prodSel.id,
    nome:       prodSel.nome,
    preco:      prodSel.preco,
    quantidade: qtd
  });

  // Limpa os campos do formulário de adição
  prodSel = null;
  prodQuery.value = '';
  $('prod-qtd').value = '1';
  prodList.style.display = 'none';

  renderItens();
  updateResumo();
};

function renderItens() {
  const tbody = $('itens-tbody');

  if (!itens.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Nenhum item adicionado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = itens.map((i, idx) => `
    <tr>
      <td>${esc(i.nome)}</td>
      <td class="text-center">
        <input class="qtd-input" type="number" min="1"
          value="${i.quantidade}" data-idx="${idx}" />
      </td>
      <td class="text-right">${fmt(i.preco)}</td>
      <td class="text-right">${fmt(i.preco * i.quantidade)}</td>
      <td class="text-center">
        <button class="btn-remove" data-idx="${idx}">✕</button>
      </td>
    </tr>
  `).join('');

  // Atualiza quantidade ao editar
  tbody.querySelectorAll('.qtd-input').forEach(inp => {
    inp.onchange = () => {
      const idx = +inp.dataset.idx;
      itens[idx].quantidade = Math.max(1, Number(inp.value) || 1);
      renderItens();
      updateResumo();
    };
  });

  // Remove item
  tbody.querySelectorAll('.btn-remove').forEach(b => {
    b.onclick = () => {
      itens.splice(+b.dataset.idx, 1);
      renderItens();
      updateResumo();
    };
  });
}


/* ======================================================
   RESUMO FINANCEIRO
====================================================== */

function updateResumo() {
  const totalProdutos = itens.reduce(
    (s, i) => s + (Number(i.preco) * Number(i.quantidade)), 0
  );

  const frete    = Math.max(0, Number($('frete').value)    || 0);
  const desconto = Math.max(0, Number($('desconto').value) || 0);
  const pago     = Math.max(0, Number($('pago').value)     || 0);

  const total    = totalProdutos + frete - desconto;
  const restante = Math.max(0, total - pago);

  $('r-produtos').textContent = fmt(totalProdutos);
  $('r-frete').textContent    = fmt(frete);
  $('r-desconto').textContent = '- ' + fmt(desconto);
  $('r-pago').textContent     = fmt(pago);
  $('r-restante').textContent = fmt(restante);
  $('r-total').textContent    = fmt(total);
}

// Recalcula sempre que os campos financeiros mudam
['frete', 'desconto', 'pago'].forEach(id =>
  $(id).addEventListener('input', updateResumo)
);


/* ======================================================
   CONFIRMAR PEDIDO (envia para /pedidos/criar)
====================================================== */
function toNull(v) {
  return v === '' ? null : v;
}
$('btn-confirmar-pedido').addEventListener('click', () => {

  if (!clienteSelecionado)
    return alert('Selecione um cliente.');

  if (!itens.length)
    return alert('Adicione pelo menos um item.');

  abrirModalConfirmacao();
});
 $('btn-salvar-final').addEventListener('click', async () => {

  const pedido = {
    cliente_id: clienteSelecionado.id,
    endereco_id: enderecoSelecionado?.id || null,
    telefone_contato: $('tel-contato').value,
    data_evento: toNull($('data-evento').value),
    data_entrega: toNull($('data-entrega').value),
    data_retirada: toNull($('data-retirada').value),
    tipo_pedido: $('tipo-pedido').value,
    status: $('status-pedido').value,
    distancia_km: Number($('distancia-km').value) || 0,
    valor_frete: Number($('frete').value) || 0,
    valor_desconto: Number($('desconto').value) || 0,
    valor_pago: Number($('pago').value) || 0,
    forma_pagamento: $('forma-pagamento').value,
    observacao_pagamento: $('obs-pagamento').value,
    observacoes: $('observacoes').value,

    rua: $('end-rua').value,
    numero: $('end-numero').value,
    bairro: $('end-bairro').value,
    cidade: $('end-cidade').value,
    estado: $('end-estado').value,

    itens: itens.map(i => ({
      produto_id: i.produto_id,
      quantidade: i.quantidade
    }))
  };

  try {

    const response = await fetch('/pedidos/criar', {
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body: JSON.stringify(pedido)
    });

    const data = await response.json();

    if(!response.ok){
      alert(data.erro || 'Erro ao salvar pedido');
      return;
    }

    alert(`Pedido #${data.pedidoId} salvo com sucesso!`);

    $('modal-confirmacao').style.display = 'none';

  } catch(err){
    console.error(err);
    alert('Erro de conexão');
  }

});

const PRECO_KM = 2.50;

function calcularFrete() {
  const km = Number($('distancia-km').value) || 0;

  const frete = km * PRECO_KM;

  $('frete').value = frete.toFixed(2);

  $('info-frete').innerHTML =
    km > 0
      ? `${km} km × R$ ${PRECO_KM.toFixed(2)} = <b>R$ ${frete.toFixed(2)}</b>`
      : '';

  updateResumo();
}
/* ======================================================
   ENDEREÇO - AUTOCOMPLETE (/pedidos/buscar-enderecos)
====================================================== */

const endNumero = $('end-numero');


$('btn-endereco').addEventListener('click', async () => {
  const filtros = {
    rua: $('end-rua').value.trim(),
    numero: $('end-numero').value.trim(),
    bairro: $('end-bairro').value.trim(),
    cidade: $('end-cidade').value.trim(),
    estado: $('end-estado').value.trim()
  };

  const query = Object.values(filtros)
    .filter(v => v)
    .join(' ');

  if (!query) {
    alert("Digite pelo menos um campo do endereço");
    return;
  }

  const params = new URLSearchParams(filtros);

const res = await fetch(
  `/pedidos/buscar-enderecos?${params}`
);
  const data = await res.json();

  const painel = $('painel-endereco');
  painel.style.display = 'block';

  if (!data.length) {
    painel.innerHTML = `
      <div class="lista-vazia">
        Nenhum endereço encontrado.
        <button onclick="cadastrarEndereco()">Cadastrar novo endereço</button>
      </div>
    `;
    return;
  }

  painel.innerHTML = data.map(e => `
    <button type="button" class="cliente-card"
      onclick='selecionarEndereco(${JSON.stringify(e)})'>

      <div><strong>${e.rua}</strong>, ${e.numero || ''}</div>
      <small>
        ${e.bairro || ''} - ${e.cidade || ''}/${e.estado || ''}
      </small>

    </button>
  `).join('');
});

function selecionarEndereco(e) {

  enderecoSelecionado = e;

  $('end-rua').value = e.rua;
  $('end-numero').value = e.numero;
  $('end-bairro').value = e.bairro;
  $('end-cidade').value = e.cidade;
  $('end-estado').value = e.estado;

  $('painel-endereco').style.display = 'none';
}

async function cadastrarEndereco() {
  const endereco = {
    rua: $('end-rua').value,
    numero: $('end-numero').value,
    bairro: $('end-bairro').value,
    cidade: $('end-cidade').value,
    estado: $('end-estado').value
  };
  console.log('Pedido enviado:', pedido);

  const res = await fetch('/pedidos/criarEndereco', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(endereco)
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.erro || "Erro ao cadastrar endereço");
    return;
  }

  const enderecoFinal = {
    ...endereco,
    id: data.id
  };

  selecionarEndereco(enderecoFinal);

  // ✔ mensagem só depois de tudo certo
  const msg = $('msg-endereco');
  if (msg) {
    msg.textContent = "Endereço cadastrado com sucesso!";
    msg.style.display = "block";

    setTimeout(() => {
      msg.style.display = "none";
    }, 3000);
  }
}
function montarPedido() {
  return {
    cliente: clienteSelecionado,

    telefone_contato: $('tel-contato').value,

    tipo_pedido: $('tipo-pedido').value,
    status: $('status-pedido').value,

    distancia_km: Number($('distancia-km').value) || 0,
    valor_frete: Number($('frete').value) || 0,
    valor_desconto: Number($('desconto').value) || 0,
    valor_pago: Number($('pago').value) || 0,

    forma_pagamento: $('forma-pagamento').value,
    observacao_pagamento: $('obs-pagamento').value,

    data_evento: $('data-evento').value || null,
    data_entrega: $('data-entrega').value || null,
    data_retirada: $('data-retirada').value || null,

    endereco: {
      rua: $('end-rua').value,
      numero: $('end-numero').value,
      bairro: $('end-bairro').value,
      cidade: $('end-cidade').value,
      estado: $('end-estado').value,
    },

    itens: itens.map(i => ({
      nome: i.nome,
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      preco: i.preco
    })),

    resumo: {
      total: Number($('r-total').textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0
    }
  };
}

/* fechar ao clicar fora */
document.addEventListener('click', e => {
  if (!endRua.contains(e.target) && !endList.contains(e.target)) {
    endList.style.display = 'none';
  }
});

function abrirModalConfirmacao() {
  const pedido = montarPedido();

  const itensHtml = pedido.itens.map(i => `
    <div style="
      display:flex;
      justify-content:space-between;
      padding:6px 0;
      border-bottom:1px solid #eee;
      font-size:14px;
    ">
      <span>${i.nome} <b>×${i.quantidade}</b></span>
      <span style="color:#14b8a6;font-weight:600;">
        ${fmt(i.preco * i.quantidade)}
      </span>
    </div>
  `).join('');

  const html = `
    <div style="display:grid;gap:12px;font-size:14px;">

      <!-- CLIENTE -->
      <div class="section">
        <div class="section-title">👤 Cliente</div>
        <b>${pedido.cliente?.nome || ''}</b><br>
        <small>
        ⚠️CPF: ${pedido.cliente?.cpf || '-'} <br>
        📞 ${pedido.cliente?.telefone || '-'} <br>
        ✉️ ${pedido.cliente?.email || '-'}
        </small>
      </div>

      <!-- PEDIDO -->
      <div class="section">
        <div class="section-title">📦 Pedido</div>

        <div><b>Tipo:</b> ${pedido.tipo_pedido || '-'}</div>
        <div><b>Status:</b> ${pedido.status || '-'}</div>
        <div><b>Contato:</b> ${pedido.telefone_contato || '-'}</div>
      </div>

      <!-- DATAS -->
      <div class="section">
        <div class="section-title">📅 Datas</div>
        <div>Evento: ${pedido.data_evento || '-'}</div>
        <div>Entrega: ${pedido.data_entrega || '-'}</div>
        <div>Retirada: ${pedido.data_retirada || '-'}</div>
      </div>

      <!-- ENDEREÇO -->
      <div class="section">
        <div class="section-title">📍 Entrega</div>
        ${pedido.endereco.rua}, ${pedido.endereco.numero}<br>
        ${pedido.endereco.bairro} - ${pedido.endereco.cidade}/${pedido.endereco.estado}
        <br><br>
        <b>${pedido.distancia_km} km</b> • Frete: <b>${fmt(pedido.valor_frete)}</b>
      </div>

      <!-- PAGAMENTO -->
      <div class="section">
        <div class="section-title">💰 Pagamento</div>
        <div><b>Forma:</b> ${pedido.forma_pagamento}</div>
        <div><b>Pago:</b> ${fmt(pedido.valor_pago)}</div>
        <div><b>Desconto:</b> ${fmt(pedido.valor_desconto)}</div>
        <div><b>Obs:</b> ${pedido.observacao_pagamento || '-'}</div>
      </div>

      <!-- ITENS -->
      <div class="section">
        <div class="section-title">🛒 Itens</div>
        ${itensHtml}
      </div>

      <!-- TOTAL -->
      <div class="section" style="background:#ecfdf5;">
        <div class="section-title">📊 Total</div>
        <div><b>Total:</b> ${fmt(pedido.resumo.total)}</div>
      </div>

    </div>
  `;

  $('resumo-confirmacao').innerHTML = html;
  $('modal-confirmacao').style.display = 'flex';
}

$('btn-fechar-modal').addEventListener('click', () => {
  $('modal-confirmacao').style.display = 'none';
});
$('modal-confirmacao').addEventListener('click', (e) => {
  if (e.target.id === 'modal-confirmacao') {
    $('modal-confirmacao').style.display = 'none';
  }
});
// recalcula ao digitar distância
$('distancia-km').addEventListener('input', calcularFrete);

// botão opcional
$('btn-calc-frete').addEventListener('click', calcularFrete);

// se usuário editar o frete manualmente, atualiza resumo
$('frete').addEventListener('input', updateResumo);


/* ======================================================
   INICIALIZAÇÃO
====================================================== */

window.addEventListener('DOMContentLoaded', () => {
  renderCliente();
  renderItens();
  updateResumo();
});




