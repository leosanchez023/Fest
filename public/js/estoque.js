function brl(v){
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
}

function escaparHTML(valor){
  return String(valor ?? '').replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[caractere]));
}

function renderProdutosEstoque(produtos){
  const tbody = document.getElementById('estoque-tbody');
  const busca = (document.getElementById('estoque-busca')?.value || '').toLowerCase();
  const filtroStatus = document.getElementById('estoque-status')?.value || '';
  const filtrados = (produtos || []).filter((produto) => {
    const nome = `${produto.nome || ''} ${produto.codigo || ''} ${produto.categoria || ''}`.toLowerCase();
    const status = produto.status || produto.status_estoque || 'NORMAL';
    return nome.includes(busca) && (!filtroStatus || status === filtroStatus);
  });

  if(!filtrados.length){
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center">Nenhum produto encontrado.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtrados.map(produto => {
    const disponivel = Number(produto.disponivel || 0);
    const status = produto.status || produto.status_estoque || 'NORMAL';
    const badge = {
      NORMAL: 'badge-success',
      BAIXO_ESTOQUE: 'badge-warning',
      RESERVADO: 'badge-info',
      EM_USO: 'badge-purple',
      MANUTENCAO: 'badge-amber',
      DANIFICADO: 'badge-danger',
      INATIVO: 'badge-muted'
    }[status] || 'badge-muted';

    return `
      <tr>
        <td>${produto.nome || '-'}</td>
        <td>${produto.estoque || 0}</td>
        <td>${produto.estoque_reservado || 0}</td>
        <td>${produto.estoque_em_uso || 0}</td>
        <td>${produto.estoque_manutencao || 0}</td>
        <td>${produto.estoque_danificado || 0}</td>
        <td>${disponivel}</td>
        <td>${produto.estoque_minimo || 0}</td>
        <td><span class="badge ${badge}">${status}</span></td>
        <td>
          <button class="iconbtn" onclick="visualizarProduto(${produto.id})"><i class="fa-solid fa-eye"></i></button>
          <button class="iconbtn" title="Registrar entrada" onclick="entradaEstoque(${produto.id})"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="iconbtn" onclick="baixarEstoque(${produto.id})">⤓</button>
          <button class="iconbtn" onclick="reservarProduto(${produto.id})"><i class="fa-solid fa-lock"></i></button>
          <button class="iconbtn" title="Devolver reserva" onclick="devolverReserva(${produto.id})"><i class="fa-solid fa-unlock"></i></button>
          <button class="iconbtn" onclick="enviarManutencao(${produto.id})"><i class="fa-solid fa-screwdriver-wrench"></i></button>
          <button class="iconbtn" title="Finalizar manutenção" onclick="finalizarManutencao(${produto.id})"><i class="fa-solid fa-check"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function carregarResumo() {
  try {
    const res = await fetch('/estoque/resumo');
    const resposta = await res.json();
    if (!res.ok || !resposta.success) {
      throw new Error(resposta.message || 'Não foi possível carregar o resumo.');
    }
    const dados = resposta.data || {};

    document.getElementById('kpi-total').textContent = dados.total_produtos || dados.total || 0;
    document.getElementById('kpi-fisico').textContent = dados.estoque_fisico || 0;
    document.getElementById('kpi-reservado').textContent = dados.estoque_reservado || 0;
    document.getElementById('kpi-uso').textContent = dados.estoque_em_uso || 0;
    document.getElementById('kpi-manutencao').textContent = dados.estoque_manutencao || 0;
    document.getElementById('kpi-danificado').textContent = dados.estoque_danificado || 0;
    document.getElementById('kpi-disponivel').textContent = dados.disponivel || 0;
  } catch (error) {
    console.error('Erro ao carregar resumo do estoque:', error);
  }
}

async function carregarProdutosEstoque(){
  try{
    const res = await fetch('/produtos/api');
    const produtos = await res.json();
    renderProdutosEstoque(produtos);
  }catch(err){
    console.error('Erro ao carregar produtos do estoque:', err);
  }
}

async function carregarHistorico(){
  const tbody = document.getElementById('estoque-historico-tbody');
  if (!tbody) return;
  try {
    const res = await fetch('/produtos/api/historico');
    const resposta = await res.json();
    if (!res.ok) throw new Error(resposta.erro || 'Não foi possível carregar o histórico.');
    const historico = Array.isArray(resposta) ? resposta : (resposta.data || []);
    tbody.innerHTML = historico.slice(0, 50).map((item) => `
      <tr>
        <td>${escaparHTML(item.data_movimentacao || item.createdAt || '-')}</td>
        <td>${escaparHTML(item.produto_nome || item.nome || item.produto_id || '-')}</td>
        <td>${escaparHTML(item.tipo_movimento || item.tipo || '-')}</td>
        <td>${escaparHTML(item.quantidade || 0)}</td>
        <td>${escaparHTML(item.observacao || '-')}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">Nenhuma movimentação registrada.</td></tr>';
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
  }
}


// ==========================
// AÇÕES RÁPIDAS
// ==========================

async function baixarEstoque(id){
  const quantidade = prompt('Quantidade para saída:');
  if(!quantidade) return;

  try{
    await fetch(`/produtos/${id}/saida`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ quantidade })
    });
    carregarResumo();
    carregarProdutosEstoque();
  }catch(err){
    console.error('Erro na saída de estoque:', err);
  }
}

async function executarAcao(url, quantidade, mensagem) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ quantidade })
  });
  const resposta = await res.json();
  if (!res.ok || resposta.success === false || resposta.sucesso === false) {
    throw new Error(resposta.message || resposta.erro || 'Operação não realizada.');
  }
  alert(mensagem);
  await Promise.all([carregarResumo(), carregarProdutosEstoque()]);
}

async function entradaEstoque(id){
  const quantidade = prompt('Quantidade para entrada:');
  if(!quantidade) return;
  try { await executarAcao(`/produtos/${id}/entrada`, quantidade, 'Entrada registrada.'); }
  catch (error) { alert(error.message); }
}

async function reservarProduto(id){
  const quantidade = prompt('Quantidade para reserva:');
  if(!quantidade) return;

  try{
    await executarAcao(`/produtos/${id}/reservar`, quantidade, 'Reserva registrada.');
  }catch(err){
    alert(err.message);
  }
}

async function enviarManutencao(id){
  const confirmar = confirm('Enviar 1 unidade para manutenção?');
  if(!confirmar) return;

  try{
    await executarAcao(`/produtos/${id}/manutencao`, 1, 'Produto enviado para manutenção.');
  }catch(err){
    alert(err.message);
  }
}

async function devolverReserva(id){
  const quantidade = prompt('Quantidade para liberar:');
  if(!quantidade) return;
  try { await executarAcao(`/produtos/${id}/devolver`, quantidade, 'Reserva liberada.'); }
  catch (error) { alert(error.message); }
}

async function finalizarManutencao(id){
  const quantidade = prompt('Quantidade reparada:');
  if(!quantidade) return;
  try { await executarAcao(`/produtos/${id}/finalizar-manutencao`, quantidade, 'Manutenção finalizada.'); }
  catch (error) { alert(error.message); }
}

function visualizarProduto(id){
  window.location.href = `/produtos/editar/${id}`;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('estoque-busca')?.addEventListener('input', carregarProdutosEstoque);
  document.getElementById('estoque-status')?.addEventListener('change', carregarProdutosEstoque);
  carregarResumo();
  carregarProdutosEstoque();
  carregarHistorico();
});
