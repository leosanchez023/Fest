(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const brl = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const statusLabel = {
    NAO_CONTROLADO: 'Sem controle de estoque',
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
    NAO_CONTROLADO: 'badge-muted',
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
      disponivelMinimo: document.getElementById('filtro-minimo')?.value || '',
      ordenacao: document.getElementById('filtro-ordenacao')?.value || 'nome',
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
      const controlaEstoque = produto.controla_estoque !== false;
      const disponivel = produto.disponivel === null ? null : Number(produto.disponivel ?? 0);
      const minimo = Number(produto.estoque_minimo || 0);
      const disponibilidadeStatus = !controlaEstoque ? 'NAO_CONTROLADO' : disponivel <= 0 ? 'INDISPONIVEL'
        : disponivel <= minimo ? 'BAIXO_ESTOQUE' : 'DISPONIVEL';
      return `<tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${Number(produto.estoque || 0)}</td>
        <td>${Number(produto.estoque_reservado || 0)}</td>
        <td>${Number(produto.estoque_em_uso || 0)}</td>
        <td>${Number(produto.estoque_manutencao || 0)}</td>
        <td>${Number(produto.estoque_danificado || 0)}</td>
        <td title="Calculado apenas para produtos com controle de estoque">${disponivel === null ? '—' : disponivel}</td>
        <td>${Number(produto.estoque_minimo || 0)}</td>
        <td>
          <span class="badge ${statusClasse[disponibilidadeStatus]}">${statusLabel[disponibilidadeStatus]}${disponivel === null ? '' : ` (${disponivel})`}</span>
          <span class="badge ${statusClasse[status] || 'badge-muted'}">${statusLabel[status] || escapeHtml(status)}</span>
          <span class="badge ${Number(produto.ativo) === 1 ? 'badge-success' : 'badge-muted'}">${Number(produto.ativo) === 1 ? 'Ativo' : 'Inativo'}</span>
        </td>
        <td>
          <div class="actions product-actions">
            <button type="button" class="iconbtn" data-product-menu="${Number(produto.id)}"
              aria-label="Ações do produto ${escapeHtml(produto.nome)}" aria-expanded="false">
              <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
            </button>
            <div class="product-menu" id="menu-produto-${Number(produto.id)}" hidden>
              <a href="/produtos/editar/${Number(produto.id)}">Editar cadastro</a>
              ${controlaEstoque ? `<button type="button" data-stock-edit="${Number(produto.id)}">Editar estoque</button>` : ''}
              <button type="button" data-product-delete="${Number(produto.id)}">Excluir produto</button>
            </div>
          </div>
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
      if (produto.controla_estoque === false) throw new Error('O controle de estoque está desativado para este produto.');
      const disponivel = Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0)
        - Number(produto.estoque_em_uso || 0) - Number(produto.estoque_manutencao || 0)
        - Number(produto.estoque_danificado || 0);
      const minimo = Number(produto.estoque_minimo || 0);
      const status_estoque = disponivel <= 0 ? 'INDISPONIVEL'
        : disponivel <= minimo ? 'BAIXO_ESTOQUE'
          : Number(produto.estoque_manutencao || 0) > 0 ? 'MANUTENCAO'
          : Number(produto.estoque_danificado || 0) > 0 ? 'DANIFICADO'
            : Number(produto.estoque_em_uso || 0) > 0 ? 'EM_USO'
              : Number(produto.estoque_reservado || 0) > 0 ? 'RESERVADO'
                : 'DISPONIVEL';
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
      document.getElementById('kpi-ativos').textContent = Number(dados.produtos_ativos || 0);
      document.getElementById('kpi-inativos').textContent = Number(dados.produtos_inativos || 0);
      document.getElementById('kpi-reservados').textContent = Number(dados.estoque_reservado || 0);
      document.getElementById('kpi-manutencao').textContent = Number(dados.estoque_manutencao || 0);
      document.getElementById('kpi-danificados').textContent = Number(dados.estoque_danificado || 0);
      document.getElementById('kpi-baixo-estoque').textContent = Number(dados.baixo_estoque || 0);
      document.getElementById('kpi-valor-estoque').textContent = brl(dados.valor_estoque);
    } catch (error) {
      console.error('Erro ao carregar resumo do estoque:', error);
    }
  }

  function configurarControle() {
    ['busca', 'filtro-categoria', 'filtro-fornecedor', 'filtro-minimo', 'filtro-ordenacao'].forEach((id) => {
      document.getElementById(id)?.addEventListener(id === 'busca' ? 'input' : 'change', carregarProdutosControle);
    });
    document.querySelectorAll('#chips .chip').forEach((chip) => chip.addEventListener('click', () => {
      document.querySelectorAll('#chips .chip').forEach((item) => item.classList.remove('active'));
      chip.classList.add('active');
      carregarProdutosControle();
    }));
    document.getElementById('estoque-tbody')?.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-stock-edit], [data-stock-save], [data-stock-cancel]');
      const menuButton = event.target.closest('[data-product-menu]');
      if (menuButton) {
        const id = menuButton.dataset.productMenu;
        const menu = document.getElementById(`menu-produto-${id}`);
        const abrir = menu?.hidden;
        document.querySelectorAll('.product-menu').forEach((item) => { item.hidden = true; });
        document.querySelectorAll('[data-product-menu]').forEach((item) => item.setAttribute('aria-expanded', 'false'));
        if (menu && abrir) {
          menu.hidden = false;
          menuButton.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      const deleteButton = event.target.closest('[data-product-delete]');
      if (deleteButton) {
        await window.deletarProduto?.(deleteButton.dataset.productDelete);
        return;
      }
      if (!target) return;
      const row = target.closest('tr');
      if (target.hasAttribute('data-stock-edit')) editarEstoque(target.dataset.stockEdit, row);
      if (target.hasAttribute('data-stock-save')) salvarEstoque(target.dataset.stockSave, row, target);
      if (target.hasAttribute('data-stock-cancel')) carregarProdutosControle();
    });

    const formulario = document.getElementById('produto-form');
    const campoControle = document.getElementById('produto-controla-estoque');
    const campoEstoque = document.getElementById('produto-estoque');
    const campoSituacao = document.getElementById('produto-ativo');
    if (formulario && campoSituacao) {
      formulario.dataset.situacaoOriginal = campoSituacao.value;
      let confirmacaoPendente = false;
      formulario.addEventListener('submit', async (event) => {
        if (confirmacaoPendente || campoSituacao.value === formulario.dataset.situacaoOriginal) return;
        event.preventDefault();
        const ativo = campoSituacao.value === '1';
        const acao = ativo ? 'reativar' : 'inativar';
        const resultado = await window.FestAlert?.confirm?.(
          `${ativo ? 'Reativar' : 'Inativar'} produto`,
          `Confirma ${acao} este produto? A alteração não modifica o controle nem a disponibilidade do estoque.`
        ) ?? { isConfirmed: window.confirm(`Confirma ${acao} este produto? A alteração não modifica o controle nem a disponibilidade do estoque.`) };
        if (!resultado?.isConfirmed) {
          campoSituacao.value = formulario.dataset.situacaoOriginal;
          return;
        }
        confirmacaoPendente = true;
        if (event.submitter) formulario.requestSubmit(event.submitter);
        else formulario.requestSubmit();
      });
    }
    if (formulario && campoControle && campoEstoque) {
      formulario.dataset.controleOriginal = campoControle.value;
      campoControle.addEventListener('change', () => {
        const ativando = formulario.dataset.controleOriginal === '0' && campoControle.value === '1';
        campoEstoque.required = ativando;
        campoEstoque.min = ativando ? '1' : '0';
        if (ativando) {
          const inicial = window.prompt('Informe a quantidade inicial de estoque:');
          if (inicial === null) {
            campoControle.value = '0';
            campoEstoque.required = false;
            campoEstoque.min = '0';
          } else {
            campoEstoque.value = inicial;
          }
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    configurarControle();
    carregarResumoEstoque();
    carregarProdutosControle();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.product-actions')) return;
    document.querySelectorAll('.product-menu').forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll('[data-product-menu], [data-product-list-menu]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.product-menu').forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll('[data-product-menu], [data-product-list-menu]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  });
})();
