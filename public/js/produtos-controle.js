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
    INATIVO: 'Inativo'
  };

  const statusClasse = {
    DISPONIVEL: 'badge-success',
    RESERVADO: 'badge-info',
    EM_USO: 'badge-purple',
    MANUTENCAO: 'badge-amber',
    DANIFICADO: 'badge-danger',
    BAIXO_ESTOQUE: 'badge-warning',
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
      const status = produto.status || 'DISPONIVEL';
      return `<tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${Number(produto.estoque || 0)}</td>
        <td>${Number(produto.estoque_reservado || 0)}</td>
        <td>${Number(produto.estoque_em_uso || 0)}</td>
        <td>${Number(produto.estoque_manutencao || 0)}</td>
        <td>${Number(produto.estoque_danificado || 0)}</td>
        <td>${Number(produto.disponivel || 0)}</td>
        <td>${Number(produto.estoque_minimo || 0)}</td>
        <td><span class="badge ${statusClasse[status] || 'badge-muted'}">${statusLabel[status] || escapeHtml(status)}</span></td>
        <td><a href="/produtos/editar/${Number(produto.id)}" class="btn-edit">Editar</a></td>
      </tr>`;
    }).join('');
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
    try {
      const resposta = await jsonFetch(`/estoque/historico?${query}`);
      const tbody = document.getElementById('hist');
      if (!tbody) return;
      const historico = resposta.data || [];
      tbody.innerHTML = historico.length ? historico.map((item) => `<tr>
        <td>${escapeHtml(new Date(item.data_movimentacao).toLocaleString('pt-BR'))}</td>
        <td>${escapeHtml(item.produto_nome)}</td>
        <td>${escapeHtml(statusLabel[item.tipo] || item.tipo)}</td>
        <td class="num">${Number(item.quantidade || 0)}</td>
        <td>${escapeHtml(item.usuario_nome || '-')}</td>
        <td>${escapeHtml(item.observacao || '-')}</td>
      </tr>`).join('') : '<tr><td colspan="6">Nenhuma movimentação encontrada.</td></tr>';
    } catch (error) {
      console.error('Erro ao carregar histórico de movimentação:', error);
    }
  }

  function limparHistorico() {
    ['historico-produto', 'historico-de', 'historico-ate'].forEach((id) => {
      const campo = document.getElementById(id);
      if (campo) campo.value = '';
    });
    const tipo = document.getElementById('historico-tipo');
    if (tipo) tipo.value = '';
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
    ['historico-produto', 'historico-de', 'historico-ate'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', carregarHistoricoControle);
    });
    document.getElementById('historico-tipo')?.addEventListener('change', carregarHistoricoControle);
    document.getElementById('historico-limpar')?.addEventListener('click', limparHistorico);
  }

  document.addEventListener('DOMContentLoaded', () => {
    configurarControle();
    carregarResumoEstoque();
    carregarProdutosControle();
    carregarHistoricoControle();
  });
})();
