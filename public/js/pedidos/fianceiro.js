import { $, fmt } from "./utils.js";
import { state } from "./state.js";


const PRECO_KM = 2.50;


/* ======================================================
   RESUMO FINANCEIRO
====================================================== */

function updateResumo() {
  const totalProdutos = state.itens.reduce(
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

window.addEventListener('DOMContentLoaded', () => {
  renderCliente();
  renderItens();
  updateResumo();
  // se vier com ?orcamento=ID, carregar dados para edição/duplicação
  const params = new URLSearchParams(window.location.search);
  const orcamentoId = params.get('orcamento');
  if (orcamentoId) {
    (async () => {
      try {
        const res = await fetch(`/pedidos/obter/${orcamentoId}`);
        if (!res.ok) throw new Error('Orçamento não encontrado');
        const data = await res.json();

        // preencher campos
        const p = data.pedido;
        if (p.cliente_id) {
          state.clienteSelecionado = { id: p.cliente_id, nome: p.cliente_nome, telefone: p.cliente_telefone, email: p.cliente_email, cpf: p.cliente_cpf };
          renderCliente();
        }

        state.enderecoSelecionado = p.endereco_id ? { id: p.endereco_id, rua: p.rua, numero: p.numero, bairro: p.bairro, cidade: p.cidade, estado: p.estado } : null;

        // preencher campos simples
        $('tel-cliente').value = p.telefone_contato || '';
        $('tel-contato').value = p.telefone_contato || '';
        $('data-evento').value = p.data_evento ? p.data_evento.split('T')[0] : '';
        $('data-entrega').value = p.data_entrega ? p.data_entrega.split('T')[0] : '';
        $('data-retirada').value = p.data_retirada ? p.data_retirada.split('T')[0] : '';
        $('tipo-pedido').value = p.tipo_pedido || 'ALUGUEL';
        $('status-pedido').value = p.status || 'ORCAMENTO';
        $('frete').value = p.valor_frete || 0;
        $('desconto').value = p.valor_desconto || 0;
        $('pago').value = p.valor_pago || 0;
        $('forma-pagamento').value = p.forma_pagamento || 'PIX';
        $('obs-pagamento').value = p.observacao_pagamento || '';
        $('observacoes').value = p.observacoes || '';

        // itens
        state.itens = (data.itens || []).map(i => ({
    produto_id: i.produto_id,
    nome: i.produto_nome || i.nome,
    preco: Number(i.valor_unitario || i.preco || 0),
    quantidade: Number(i.quantidade)
}));

        renderItens();
        updateResumo();

      } catch (err) {
        console.error(err);
        alert('Erro ao carregar orçamento');
      }
    })();
  }
});

// recalcula ao digitar distância
$('distancia-km').addEventListener('input', calcularFrete);

// botão opcional
$('btn-calc-frete').addEventListener('click', calcularFrete);

// se usuário editar o frete manualmente, atualiza resumo
$('frete').addEventListener('input', updateResumo);
