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
  state.prodSel = null;

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
        state.prodSel = {
          id: btn.dataset.id,
          nome: btn.dataset.nome,
          preco: Number(btn.dataset.preco)
        };

        prodQuery.value = state.prodSel.nome;
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

document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-salvar-pedido') {
        enviarPedido("CONFIRMADO");
    }

    if (e.target.id === 'btn-gerar-orcamento-modal') {
        enviarPedido("ORCAMENTO");
    }
});

function montarPedido() {
  return {
    cliente: state.clienteSelecionado,

    telefone_contato: $('tel-contato').value,

    tipo_pedido: $('tipo-pedido').value,
    status: "ORCAMENTO",

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

    itens: state.itens.map(i => ({
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



/* ======================================================
   ADICIONAR ITEM
====================================================== */


$('btn-add-item').onclick = () => {
  if (!state.prodSel) return alert('Selecione um produto da lista.');

  const qtd = Math.max(1, Number($('prod-qtd').value) || 1);

  state.itens.push({
    produto_id: state.prodSel.id,
    nome: state.prodSel.nome,
    preco: state.prodSel.preco,
    quantidade: qtd
  });

  // Limpa os campos do formulário de adição
  state.prodSel = null;
  prodQuery.value = '';
  $('prod-qtd').value = '1';
  prodList.style.display = 'none';

  renderItens();
  updateResumo();
};




/* ======================================================
   RENDER ITENS
====================================================== */


function renderItens() {
  const tbody = $('itens-tbody');

  if (!state.itens.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Nenhum item adicionado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.itens.map((i, idx) => `
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
      state.itens[idx].quantidade = Math.max(1, Number(inp.value) || 1);
      renderItens();
      updateResumo();
    };
  });

  // Remove item
  tbody.querySelectorAll('.btn-remove').forEach(b => {
    b.onclick = () => {
      state.itens.splice(+b.dataset.idx, 1);
      renderItens();
      updateResumo();
    };
  });
}





// Recalcula sempre que os campos financeiros mudam
['frete', 'desconto', 'pago'].forEach(id =>
  $(id).addEventListener('input', updateResumo)
);

/* ======================================================
   CONFIRMAR PEDIDO (envia para /pedidos/criar)
====================================================== */

$('btn-confirmar-pedido').addEventListener('click', () => {

  if (!state.clienteSelecionado)
    return alert('Selecione um cliente.');

  if (!state.itens.length)
    return alert('Adicione pelo menos um item.');

  abrirModalConfirmacao();
});
 // antigo listener removido — agora usamos `enviarPedido(saveAs)` via botões do modal



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
   ENDEREÇO
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
