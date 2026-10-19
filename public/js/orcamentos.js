const $o = id => document.getElementById(id);

const formatarMoeda = valor => 'R$ ' + Number(valor || 0).toFixed(2).replace('.', ',');
const escaparHtml = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[caractere]);

async function respostaJson(res) {
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.message || dados.erro || 'Não foi possível concluir a operação.');
  return dados;
}

async function confirmar(titulo, texto) {
  if (window.FestAlert?.confirm) {
    const resultado = await window.FestAlert.confirm(titulo, texto);
    return Boolean(resultado?.isConfirmed);
  }
  return window.confirm(`${titulo}\n\n${texto}`);
}

async function avisar(tipo, titulo, texto) {
  if (window.FestAlert?.[tipo]) {
    await window.FestAlert[tipo](titulo, texto);
    return;
  }
  if (tipo === 'error') window.alert(`${titulo}\n\n${texto}`);
}

const formatarData = valor => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
};

const loadOrcamentos = async () => {
  const termo = $o('q').value.trim();
  try {
    const res = await fetch(`/orcamentos/list?search=${encodeURIComponent(termo)}`);
    const orcamentos = await respostaJson(res);
    $o('orcamentos-tbody').innerHTML = orcamentos.map(orcamento => {
      const id = Number(orcamento.id);
      const total = Number(orcamento.valor_total || 0);
      const pago = Number(orcamento.valor_pago || 0);

      return `
        <tr>
          <td><strong>${escaparHtml(id)}</strong></td>
          <td>${escaparHtml(orcamento.cliente || '-')}</td>
          <td>${escaparHtml(orcamento.telefone_contato || '-')}</td>
          <td>${escaparHtml(formatarData(orcamento.data_evento))}</td>
          <td>${formatarMoeda(total)}</td>
          <td>${formatarMoeda(pago)}</td>
          <td>${formatarMoeda(total - pago)}</td>
          <td>${escaparHtml(orcamento.status || '-')}</td>
          <td>
            <div class="orcamentos-actions">
              <button class="btn" type="button" data-action="convert" data-id="${id}">Converter</button>
              <button class="btn" type="button" data-action="edit" data-id="${id}">Editar</button>
              <button class="btn" type="button" data-action="duplicate" data-id="${id}">Duplicar</button>
              <button class="btn btn-red" type="button" data-action="delete" data-id="${id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    await avisar('error', 'Erro ao carregar orçamentos', err.message);
  }
};

async function converter(id) {
  if (!await confirmar('Converter orçamento', 'Converter este orçamento em pedido?')) return;
  try {
    const res = await fetch(`/orcamentos/${id}/convert`, { method: 'POST' });
    const dados = await respostaJson(res);
    await avisar('success', 'Orçamento convertido', dados.message || 'O orçamento foi convertido em pedido.');
    await loadOrcamentos();
  } catch (err) {
    console.error(err);
    await avisar('error', 'Erro ao converter', err.message);
  }
}

async function duplicar(id) {
  try {
    const res = await fetch(`/orcamentos/${id}/duplicate`, { method: 'POST' });
    const dados = await respostaJson(res);
    window.location.href = `/pedidos?orcamento=${encodeURIComponent(dados.novoId)}`;
  } catch (err) {
    console.error(err);
    await avisar('error', 'Erro ao duplicar', err.message);
  }
}

function editar(id) {
  // A tela de pedidos já carrega e salva orçamentos existentes via ?orcamento=ID.
  window.location.href = `/pedidos?orcamento=${encodeURIComponent(id)}`;
}

async function excluir(id) {
  if (!await confirmar('Excluir orçamento', 'Cancelar este orçamento? Ele será removido da lista, sem apagar seu histórico financeiro.')) return;
  try {
    const res = await fetch(`/orcamentos/${id}/delete`, { method: 'POST' });
    const dados = await respostaJson(res);
    await avisar('success', 'Orçamento excluído', dados.message || 'O orçamento foi removido da lista.');
    await loadOrcamentos();
  } catch (err) {
    console.error(err);
    await avisar('error', 'Erro ao excluir', err.message);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  let searchTimer;
  $o('q').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadOrcamentos, 200);
  });
  $o('orcamentos-tbody').addEventListener('click', event => {
    const button = event.target.closest('button[data-action][data-id]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    if (button.dataset.action === 'convert') converter(id);
    if (button.dataset.action === 'edit') editar(id);
    if (button.dataset.action === 'duplicate') duplicar(id);
    if (button.dataset.action === 'delete') excluir(id);
  });
  $o('btn-new').addEventListener('click', () => { window.location.href = '/pedidos'; });
  loadOrcamentos();
});
