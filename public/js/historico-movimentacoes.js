(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const tbody = document.getElementById('hist');
  if (!tbody) return;

  let paginaHistorico = 1;

  function filtrosHistorico() {
    return {
      produto: document.getElementById('historico-produto').value.trim(),
      tipo: document.getElementById('historico-tipo').value,
      usuario: document.getElementById('historico-usuario').value,
      de: document.getElementById('historico-de').value,
      ate: document.getElementById('historico-ate').value
    };
  }

  function formatarData(valor) {
    if (!valor) return '-';
    const data = new Date(String(valor).replace(' ', 'T'));
    return Number.isNaN(data.getTime()) ? escapeHtml(valor) : escapeHtml(data.toLocaleString('pt-BR'));
  }

  function atualizarOpcoes(select, primeiroItem, valores, valueFor, labelFor) {
    const selecionado = select.value;
    select.innerHTML = `<option value="">${primeiroItem}</option>${valores.map((valor) =>
      `<option value="${escapeHtml(valueFor(valor))}">${escapeHtml(labelFor(valor))}</option>`
    ).join('')}`;
    if ([...select.options].some((option) => option.value === selecionado)) {
      select.value = selecionado;
    }
  }

  function renderPaginacao(paginacao) {
    const resumo = document.getElementById('historico-resumo');
    const nav = document.getElementById('historico-paginas');
    resumo.textContent = `Página ${paginacao.pagina} de ${paginacao.totalPaginas} — ${paginacao.total} movimentações`;

    const paginas = new Set([1, paginacao.pagina - 1, paginacao.pagina, paginacao.pagina + 1, paginacao.totalPaginas]);
    const validas = [...paginas].filter((numero) => numero > 0 && numero <= paginacao.totalPaginas).sort((a, b) => a - b);
    let anterior = 0;
    const botoes = [];
    for (const numero of validas) {
      if (anterior && numero > anterior + 1) botoes.push('<span aria-hidden="true">…</span>');
      botoes.push(`<button type="button" data-history-page="${numero}" ${numero === paginacao.pagina ? 'aria-current="page" disabled' : ''}>${numero}</button>`);
      anterior = numero;
    }
    nav.innerHTML = `<button type="button" data-history-page="${paginacao.pagina - 1}" ${paginacao.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
      ${botoes.join('')}
      <button type="button" data-history-page="${paginacao.pagina + 1}" ${paginacao.pagina >= paginacao.totalPaginas ? 'disabled' : ''}>Próxima</button>`;
  }

  async function carregarHistorico() {
    const query = new URLSearchParams();
    Object.entries(filtrosHistorico()).forEach(([chave, valor]) => {
      if (valor) query.set(chave, valor);
    });
    query.set('pagina', String(paginaHistorico));
    query.set('limite', document.getElementById('historico-limite').value);
    tbody.innerHTML = '<tr><td colspan="7">Carregando movimentações...</td></tr>';

    try {
      const resposta = await fetch(`/estoque/historico?${query}`);
      const resultado = await resposta.json();
      if (!resposta.ok || !resultado.success) {
        throw new Error(resultado.message || 'Não foi possível carregar as movimentações.');
      }

      const dados = resultado.data;
      atualizarOpcoes(
        document.getElementById('historico-tipo'),
        'Todos os tipos',
        dados.tipos || [],
        (tipo) => tipo,
        (tipo) => tipo.replaceAll('_', ' ')
      );
      atualizarOpcoes(
        document.getElementById('historico-usuario'),
        'Todos os responsáveis',
        dados.usuarios || [],
        (usuario) => usuario.id,
        (usuario) => usuario.nome
      );

      const items = dados.items || [];
      tbody.innerHTML = items.length ? items.map((item) => `<tr>
        <td>${formatarData(item.data_movimentacao)}</td>
        <td>${escapeHtml(item.produto_nome || '-')}</td>
        <td>${escapeHtml((item.tipo || '-').replaceAll('_', ' '))}</td>
        <td class="num">${Number(item.quantidade || 0)}</td>
        <td>${escapeHtml(item.usuario_nome || '-')}</td>
        <td>${escapeHtml(item.origem_destino || '-')}</td>
        <td>${escapeHtml(item.observacao || '-')}</td>
      </tr>`).join('') : '<tr><td colspan="7">Nenhuma movimentação encontrada.</td></tr>';
      paginaHistorico = dados.pagination.pagina;
      renderPaginacao(dados.pagination);
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message || 'Não foi possível carregar as movimentações.')}</td></tr>`;
      document.getElementById('historico-resumo').textContent = 'Falha ao carregar os resultados.';
      document.getElementById('historico-paginas').replaceChildren();
    }
  }

  function limparFiltros() {
    ['historico-produto', 'historico-de', 'historico-ate'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    document.getElementById('historico-tipo').value = '';
    document.getElementById('historico-usuario').value = '';
    paginaHistorico = 1;
    carregarHistorico();
  }

  document.getElementById('historico-aplicar').addEventListener('click', () => {
    paginaHistorico = 1;
    carregarHistorico();
  });
  document.getElementById('historico-limpar').addEventListener('click', limparFiltros);
  document.getElementById('historico-limite').addEventListener('change', () => {
    paginaHistorico = 1;
    carregarHistorico();
  });
  document.getElementById('historico-paginas').addEventListener('click', (event) => {
    const button = event.target.closest('[data-history-page]');
    if (!button || button.disabled) return;
    paginaHistorico = Number(button.dataset.historyPage);
    carregarHistorico();
  });
  ['historico-produto', 'historico-de', 'historico-ate'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      paginaHistorico = 1;
      carregarHistorico();
    });
  });

  const resumoInicial = document.getElementById('historico-resumo');
  renderPaginacao({
    pagina: Number(resumoInicial.dataset.pagina) || 1,
    total: Number(resumoInicial.dataset.total) || 0,
    totalPaginas: Number(resumoInicial.dataset.totalPaginas) || 0
  });
})();
