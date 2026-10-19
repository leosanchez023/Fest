(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const brl = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const statusLabel = {
    DISPONIVEL: 'Disponível',
    RESERVADO: 'Reservado',
    EM_USO: 'Em uso',
    MANUTENCAO: 'Manutenção',
    DANIFICADO: 'Danificado',
    BAIXO_ESTOQUE: 'Estoque baixo',
    INDISPONIVEL: 'Indisponível',
    INATIVO: 'Inativo'
  };

  const statusClasse = {
    DISPONIVEL: 'badge-success',
    RESERVADO: 'badge-info',
    EM_USO: 'badge-purple',
    MANUTENCAO: 'badge-amber',
    DANIFICADO: 'badge-danger',
    BAIXO_ESTOQUE: 'badge-warning',
    INDISPONIVEL: 'badge-danger',
    INATIVO: 'badge-muted'
  };

  async function jsonFetch(url) {
    const response = await fetch(url);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || body.erro || 'Falha ao carregar dados.');
    return body;
  }

  function filtrosProdutos() {
    return {
      busca: document.getElementById('busca')?.value.trim() || '',
      categoria: document.getElementById('filtro-categoria')?.value || '',
      fornecedor: document.getElementById('filtro-fornecedor')?.value || '',
      status: document.querySelector('#chips .chip.active')?.dataset.status || ''
    };
  }

  function renderProdutos(produtos) {
    const tbody = document.getElementById('estoque-tbody');
    if (!tbody) return;
    if (!produtos.length) {
      tbody.innerHTML = '<tr><td colspan="10">Nenhum produto encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = produtos.map((produto) => {
      const status = produto.status_estoque || 'DISPONIVEL';
      return `<tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${Number(produto.estoque || 0)}</td>
        <td>${Number(produto.estoque_reservado || 0)}</td>
        <td>${Number(produto.estoque_em_uso || 0)}</td>
        <td>${Number(produto.estoque_manutencao || 0)}</td>
        <td>${Number(produto.estoque_danificado || 0)}</td>
        <td title="Calculado: estoque físico menos reservado, em uso, manutenção e danificado">${Number(produto.disponivel || 0)}</td>
        <td>${Number(produto.estoque_minimo || 0)}</td>
        <td>
          <span class="badge ${statusClasse[status] || 'badge-muted'}">${statusLabel[status] || escapeHtml(status)}</span>
          <span class="badge ${Number(produto.ativo) === 1 ? 'badge-success' : 'badge-muted'}">${Number(produto.ativo) === 1 ? 'Ativo' : 'Inativo'}</span>
        </td>
        <td>
          <button type="button" class="btn-edit" data-stock-edit="${Number(produto.id)}">Editar estoque</button>
          <a href="/produtos/editar/${Number(produto.id)}" class="btn-edit">Editar cadastro</a>
        </td>
      </tr>`;
    }).join('');
  }

  function linhaEdicao(produto) {
    const input = (campo, valor, aria) => `<input type="number" min="0" step="1" required
      data-stock-field="${campo}" aria-label="${aria}" value="${Number(valor || 0)}">`;
    return `<td>${escapeHtml(produto.nome)}</td>
      <td>${input('estoque', produto.estoque, 'Estoque físico')}</td>
      <td>${input('estoque_reservado', produto.estoque_reservado, 'Quantidade reservada')}</td>
      <td>${Number(produto.estoque_em_uso || 0)}</td>
      <td>${Number(produto.estoque_manutencao || 0)}</td>
      <td>${input('estoque_danificado', produto.estoque_danificado, 'Quantidade danificada')}</td>
      <td title="Calculado automaticamente">${Number(produto.disponivel || 0)}</td>
      <td>${input('estoque_minimo', produto.estoque_minimo, 'Estoque mínimo')}</td>
      <td>${statusLabel[produto.status_estoque] || 'Disponível'}<br><small>Disponibilidade calculada</small></td>
      <td>
        <button type="button" class="btn-edit" data-stock-save="${Number(produto.id)}">Salvar</button>
        <button type="button" class="btn-edit" data-stock-cancel="${Number(produto.id)}">Cancelar</button>
      </td>`;
  }

  async function editarEstoque(id, row) {
    try {
      const produto = await jsonFetch(`/produtos/api/${id}`);
      const disponivel = Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0)
        - Number(produto.estoque_em_uso || 0) - Number(produto.estoque_manutencao || 0)
        - Number(produto.estoque_danificado || 0);
      const minimo = Number(produto.estoque_minimo || 0);
      const status_estoque = disponivel <= 0 ? 'INDISPONIVEL'
        : Number(produto.estoque_manutencao || 0) > 0 ? 'MANUTENCAO'
          : Number(produto.estoque_danificado || 0) > 0 ? 'DANIFICADO'
            : Number(produto.estoque_em_uso || 0) > 0 ? 'EM_USO'
              : Number(produto.estoque_reservado || 0) > 0 ? 'RESERVADO'
                : disponivel <= minimo ? 'BAIXO_ESTOQUE' : 'DISPONIVEL';
      const snapshot = { ...produto, disponivel, status_estoque };
      row.dataset.stockSnapshot = JSON.stringify(snapshot);
      row.innerHTML = linhaEdicao(snapshot);
    } catch (error) {
      await window.FestAlert?.error?.('Erro ao editar estoque', error.message);
    }
  }

  async function salvarEstoque(id, row, button) {
    const campos = ['estoque', 'estoque_reservado', 'estoque_danificado', 'estoque_minimo'];
    const dados = Object.fromEntries(campos.map((campo) => [
      campo,
      row.querySelector(`[data-stock-field="${campo}"]`)?.value
    ]));
    if (Object.values(dados).some((value) => value === undefined || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
      await window.FestAlert?.warning?.('Estoque inválido', 'Informe quantidades inteiras e não negativas.');
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch(`/produtos/api/${id}/estoque`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      const result = await response.json();
      if (!response.ok || !result.sucesso) throw new Error(result.erro || 'Não foi possível atualizar o estoque.');
      await window.FestAlert?.success?.('Estoque atualizado', 'As quantidades foram salvas.');
      await Promise.all([carregarProdutosControle(), carregarResumoEstoque()]);
    } catch (error) {
      await window.FestAlert?.error?.('Erro ao salvar estoque', error.message);
      button.disabled = false;
    }
  }

  async function carregarProdutosControle() {
    const query = new URLSearchParams();
    Object.entries(filtrosProdutos()).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    try {
      const produtos = await jsonFetch(`/produtos/api?${query}`);
      renderProdutos(produtos);
    } catch (error) {
      console.error('Erro ao carregar resumo por produto:', error);
    }
  }

  async function carregarResumoEstoque() {
    try {
      const resposta = await jsonFetch('/estoque/resumo');
      const dados = resposta.data || {};
      document.getElementById('kpi-total').textContent = Number(dados.total_produtos || 0);
      document.getElementById('kpi-disponivel').textContent = Number(dados.disponivel || 0);
      document.getElementById('kpi-reservados').textContent = Number(dados.estoque_reservado || 0);
      document.getElementById('kpi-manutencao').textContent = Number(dados.estoque_manutencao || 0);
      document.getElementById('kpi-danificados').textContent = Number(dados.estoque_danificado || 0);
      document.getElementById('kpi-baixo-estoque').textContent = Number(dados.baixo_estoque || 0);
      document.getElementById('kpi-valor-estoque').textContent = brl(dados.valor_estoque);
    } catch (error) {
      console.error('Erro ao carregar resumo do estoque:', error);
    }
  }

  let paginaHistorico = 1;

  function filtrosHistorico() {
    return {
      produto: document.getElementById('historico-produto')?.value.trim() || '',
      tipo: document.getElementById('historico-tipo')?.value || '',
      de: document.getElementById('historico-de')?.value || '',
      ate: document.getElementById('historico-ate')?.value || ''
    };
  }

  async function carregarHistoricoControle() {
    const query = new URLSearchParams();
    Object.entries(filtrosHistorico()).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    query.set('pagina', String(paginaHistorico));
    query.set('limite', document.getElementById('historico-limite')?.value || '25');
    const tbody = document.getElementById('hist');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">Carregando movimentações...</td></tr>';
    try {
      const resposta = await jsonFetch(`/estoque/historico?${query}`);
      if (!tbody) return;
      const historico = resposta.data?.items || [];
      const tipos = resposta.data?.tipos || [];
      const tipoSelect = document.getElementById('historico-tipo');
      if (tipoSelect) {
        const selecionado = tipoSelect.value;
        tipoSelect.innerHTML = '<option value="">Todos os tipos</option>' + tipos
          .map((tipo) => `<option value="${escapeHtml(tipo)}">${escapeHtml(tipo.replaceAll('_', ' '))}</option>`)
          .join('');
        tipoSelect.value = selecionado;
      }
      const pagina = resposta.data?.pagination || { pagina: 1, limite: 25, total: 0, totalPaginas: 0 };
      paginaHistorico = pagina.pagina;
      tbody.innerHTML = historico.length ? historico.map((item) => `<tr>
        <td>${escapeHtml(new Date(item.data_movimentacao).toLocaleString('pt-BR'))}</td>
        <td>${escapeHtml(item.produto_nome)}</td>
        <td>${escapeHtml(item.tipo)}</td>
        <td class="num">${Number(item.quantidade || 0)}</td>
        <td>${escapeHtml(item.usuario_nome || '-')}</td>
        <td>${escapeHtml(item.observacao || '-')}</td>
      </tr>`).join('') : '<tr><td colspan="6">Nenhuma movimentação encontrada.</td></tr>';
      renderPaginacaoHistorico(pagina);
    } catch (error) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message || 'Não foi possível carregar o histórico.')}</td></tr>`;
      const resumo = document.getElementById('historico-resumo');
      if (resumo) resumo.textContent = 'Falha ao carregar os resultados.';
      const paginas = document.getElementById('historico-paginas');
      if (paginas) paginas.replaceChildren();
    }
  }

  function renderPaginacaoHistorico(pagina) {
    const resumo = document.getElementById('historico-resumo');
    const nav = document.getElementById('historico-paginas');
    if (resumo) {
      resumo.textContent = `Página ${pagina.pagina} de ${pagina.totalPaginas} — ${pagina.total} movimentações`;
    }
    if (!nav) return;
    const pages = new Set([1, pagina.pagina - 1, pagina.pagina, pagina.pagina + 1, pagina.totalPaginas]);
    const valid = [...pages].filter((n) => n > 0 && n <= pagina.totalPaginas).sort((a, b) => a - b);
    let previous = 0;
    const numbers = [];
    for (const n of valid) {
      if (previous && n > previous + 1) numbers.push('<span aria-hidden="true">…</span>');
      numbers.push(`<button type="button" data-history-page="${n}" ${n === pagina.pagina ? 'aria-current="page" disabled' : ''}>${n}</button>`);
      previous = n;
    }
    nav.innerHTML = `<button type="button" data-history-page="${pagina.pagina - 1}" ${pagina.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
      ${numbers.join('')}
      <button type="button" data-history-page="${pagina.pagina + 1}" ${pagina.pagina >= pagina.totalPaginas ? 'disabled' : ''}>Próxima</button>`;
  }

  function limparHistorico() {
    ['historico-produto', 'historico-de', 'historico-ate'].forEach((id) => {
      const campo = document.getElementById(id);
      if (campo) campo.value = '';
    });
    const tipo = document.getElementById('historico-tipo');
    if (tipo) tipo.value = '';
    paginaHistorico = 1;
    carregarHistoricoControle();
  }

  function configurarControle() {
    ['busca', 'filtro-categoria', 'filtro-fornecedor'].forEach((id) => {
      document.getElementById(id)?.addEventListener(id === 'busca' ? 'input' : 'change', carregarProdutosControle);
    });
    document.querySelectorAll('#chips .chip').forEach((chip) => chip.addEventListener('click', () => {
      document.querySelectorAll('#chips .chip').forEach((item) => item.classList.remove('active'));
      chip.classList.add('active');
      carregarProdutosControle();
    }));
    document.getElementById('estoque-tbody')?.addEventListener('click', (event) => {
      const target = event.target.closest('[data-stock-edit], [data-stock-save], [data-stock-cancel]');
      if (!target) return;
      const row = target.closest('tr');
      if (target.hasAttribute('data-stock-edit')) editarEstoque(target.dataset.stockEdit, row);
      if (target.hasAttribute('data-stock-save')) salvarEstoque(target.dataset.stockSave, row, target);
      if (target.hasAttribute('data-stock-cancel')) carregarProdutosControle();
    });
    document.getElementById('historico-aplicar')?.addEventListener('click', () => {
      paginaHistorico = 1;
      carregarHistoricoControle();
    });
    document.getElementById('historico-limpar')?.addEventListener('click', limparHistorico);
    document.getElementById('historico-limite')?.addEventListener('change', () => {
      paginaHistorico = 1;
      carregarHistoricoControle();
    });
    document.getElementById('historico-paginas')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-history-page]');
      if (!button || button.disabled) return;
      paginaHistorico = Number(button.dataset.historyPage);
      carregarHistoricoControle();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    configurarControle();
    carregarResumoEstoque();
    carregarProdutosControle();
    carregarHistoricoControle();
  });
})();
