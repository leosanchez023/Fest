const $o = id => document.getElementById(id);

const fmt = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

const loadOrcamentos = async () => {
  const q = $o('q').value.trim();
  try {
    const res = await fetch(`/orcamentos/list`);
    const data = await res.json();

    $o('orcamentos-tbody').innerHTML = data.map(o => `
      <tr>
        <td><strong>${o.id}</strong></td>
        <td>${o.cliente || '-'}</td>
        <td>${o.telefone_contato || '-'}</td>
        <td>${o.data_evento ? new Date(o.data_evento).toLocaleDateString('pt-BR') : '-'}</td>
        <td>${fmt(o.valor_total)}</td>
        <td>${fmt(o.valor_pago)}</td>
        <td>${fmt((o.valor_total || 0) - (o.valor_pago || 0))}</td>
        <td>${o.status || '-'}</td>
        <td>
              <button class="btn" onclick="convert(${o.id})">Converter</button>
              <button class="btn" onclick="edit(${o.id})">Editar</button>
              <button class="btn" onclick="duplicate(${o.id})">Duplicar</button>
              <button class="btn btn-red" onclick="del(${o.id})">Excluir</button>
            </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
};

window.convert = async (id) => {
  if (!confirm('Converter este orçamento em pedido?')) return;
  try {
    const res = await fetch(`/orcamentos/${id}/convert`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha');
    alert('Orçamento convertido');
    loadOrcamentos();
  } catch (err) {
    console.error(err);
    alert('Erro ao converter');
  }
};

window.duplicate = async (id) => {
  try {
    const res = await fetch(`/orcamentos/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha');
    const data = await res.json();
    // abrir o formulário de pedidos com o novo orçamento
    window.location.href = `/pedidos?orcamento=${data.novoId}`;
  } catch (err) {
    console.error(err);
    alert('Erro ao duplicar');
  }
};

window.edit = (id) => {
  // abre a tela de pedidos carregando o orçamento para edição
  window.location.href = `/pedidos?orcamento=${id}`;
};

window.del = async (id) => {
  if (!confirm('Excluir orçamento?')) return;
  try {
    const res = await fetch(`/orcamentos/${id}/delete`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha');
    alert('Orçamento excluído');
    loadOrcamentos();
  } catch (err) {
    console.error(err);
    alert('Erro ao excluir');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  $o('q').addEventListener('input', () => setTimeout(loadOrcamentos, 200));
  $o('btn-new').addEventListener('click', () => { window.location.href = '/pedidos'; });
  loadOrcamentos();
});
