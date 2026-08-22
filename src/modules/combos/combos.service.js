import * as model from './combos.model.js';

export async function listarCombos() {
  return await model.listarCombos();
}

export async function buscarComboPorId(id) {
  return await model.buscarComboPorId(id);
}

export async function listarItensDoCombo(comboId) {
  return await model.listarItensDoCombo(comboId);
}

export async function criarCombo(dados) {
  if (!dados.nome || !String(dados.nome).trim()) {
    throw new Error('Nome do combo é obrigatório.');
  }

  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  if (!itens.length) {
    throw new Error('Combo deve ter pelo menos um componente.');
  }

  const itensValidados = [];
  const vistos = new Set();

  for (const item of itens) {
    const produtoId = Number(item.produto_id || 0);
    const quantidade = Number(item.quantidade || 1);

    if (!produtoId) {
      throw new Error('Selecione um produto válido para cada componente.');
    }
    if (quantidade <= 0) {
      throw new Error('Quantidade do componente deve ser maior que zero.');
    }
    if (vistos.has(produtoId)) {
      throw new Error('Não é permitido repetir o mesmo produto no combo.');
    }
    vistos.add(produtoId);

    itensValidados.push({ produto_id: produtoId, quantidade });
  }

  const combo = await model.criarCombo({
    nome: String(dados.nome).trim(),
    descricao: dados.descricao || '',
    codigo: dados.codigo || null,
    preco_venda: Number(dados.preco_venda || 0),
    preco_aluguel: Number(dados.preco_aluguel || 0),
    ativo: dados.ativo !== false,
    itens: itensValidados
  });

  return combo;
}

export async function adicionarItemCombo(comboId, item) {
  if (!comboId || !item.produto_id) {
    throw new Error('Combo e produto são obrigatórios.');
  }

  const quantidade = Number(item.quantidade || 1);
  if (quantidade <= 0) {
    throw new Error('Quantidade do item do combo deve ser maior que zero.');
  }

  return await model.adicionarItemCombo(comboId, { ...item, quantidade });
}

export async function atualizarCombo(id, dados) {
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  if (!dados.nome || !String(dados.nome).trim()) {
    throw new Error('Nome do combo é obrigatório.');
  }
  if (!itens.length) {
    throw new Error('Combo deve ter pelo menos um componente.');
  }

  const vistos = new Set();
  for (const item of itens) {
    const produtoId = Number(item.produto_id || 0);
    const quantidade = Number(item.quantidade || 1);
    if (!produtoId) {
      throw new Error('Selecione um produto válido para cada componente.');
    }
    if (quantidade <= 0) {
      throw new Error('Quantidade do componente deve ser maior que zero.');
    }
    if (vistos.has(produtoId)) {
      throw new Error('Não é permitido repetir o mesmo produto no combo.');
    }
    vistos.add(produtoId);
  }

  await model.atualizarCombo(id, {
    nome: String(dados.nome).trim(),
    descricao: dados.descricao || '',
    codigo: dados.codigo || null,
    preco_venda: Number(dados.preco_venda || 0),
    preco_aluguel: Number(dados.preco_aluguel || 0),
    ativo: dados.ativo !== false,
    itens
  });
}

export async function atualizarItemCombo(id, item) {
  return await model.atualizarItemCombo(id, item);
}

export async function removerItemCombo(id) {
  return await model.removerItemCombo(id);
}

export async function desativarCombo(id) {
  return await model.desativarCombo(id);
}

export async function calcularDisponibilidadeCombo(comboId) {
  return await model.calcularDisponibilidadeCombo(comboId);
}
