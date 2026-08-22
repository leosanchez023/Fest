import db from '../../../database/connection.js';

export async function listarCombos() {
  const [rows] = await db.query(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM combo_itens ci WHERE ci.combo_id = c.id) AS total_itens
    FROM combos c
    WHERE c.ativo = 1
    ORDER BY c.nome ASC
  `);

  return rows;
}

export async function buscarComboPorId(id) {
  const [rows] = await db.query(`
    SELECT * FROM combos WHERE id = ?
  `, [id]);
  return rows[0] || null;
}

export async function listarItensDoCombo(comboId) {
  const [rows] = await db.query(`
    SELECT ci.*, p.nome AS produto_nome, p.codigo, p.estoque
    FROM combo_itens ci
    LEFT JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.combo_id = ?
    ORDER BY p.nome ASC
  `, [comboId]);
  return rows;
}

export async function criarCombo(dados) {
  if (!dados.nome || !String(dados.nome).trim()) {
    throw new Error('Nome do combo é obrigatório.');
  }

  if (dados.codigo) {
    const [existente] = await db.query(
      `SELECT id FROM combos WHERE codigo = ? AND id <> ?`,
      [String(dados.codigo).trim(), Number(dados.id || 0)]
    );
    if (existente.length) {
      throw new Error('Já existe um combo com este código.');
    }
  }

  const [result] = await db.query(`
    INSERT INTO combos (nome, descricao, codigo, preco_venda, preco_aluguel, ativo)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    String(dados.nome).trim(),
    dados.descricao || null,
    dados.codigo ? String(dados.codigo).trim() : null,
    Number(dados.preco_venda || 0),
    Number(dados.preco_aluguel || 0),
    dados.ativo === false ? 0 : 1
  ]);

  if (Array.isArray(dados.itens)) {
    for (const item of dados.itens) {
      await adicionarItemCombo(result.insertId, item);
    }
  }

  return { id: result.insertId };
}

export async function adicionarItemCombo(comboId, item) {
  const produtoId = Number(item.produto_id || 0);
  const quantidade = Number(item.quantidade || 1);

  if (!comboId || !produtoId) {
    throw new Error('Combo e produto são obrigatórios.');
  }

  if (quantidade <= 0) {
    throw new Error('Quantidade do item do combo deve ser maior que zero.');
  }

  const [produtoRows] = await db.query(
    `SELECT id, ativo FROM produtos WHERE id = ? LIMIT 1`,
    [produtoId]
  );

  if (!produtoRows.length) {
    throw new Error('Produto inexistente.');
  }

  if (Number(produtoRows[0].ativo || 0) === 0) {
    throw new Error('Produto inativo não pode compor combo.');
  }

  const [duplicado] = await db.query(
    `SELECT id FROM combo_itens WHERE combo_id = ? AND produto_id = ? LIMIT 1`,
    [comboId, produtoId]
  );

  if (duplicado.length) {
    throw new Error('Este produto já está adicionado ao combo.');
  }

  const [result] = await db.query(`
    INSERT INTO combo_itens (combo_id, produto_id, quantidade)
    VALUES (?, ?, ?)
  `, [comboId, produtoId, quantidade]);

  return { id: result.insertId, produto_id: produtoId, quantidade };
}

export async function atualizarCombo(id, dados) {
  if (!id) {
    throw new Error('Combo inválido.');
  }

  await db.query(`
    UPDATE combos
    SET nome = ?, descricao = ?, codigo = ?, preco_venda = ?, preco_aluguel = ?, ativo = ?
    WHERE id = ?
  `, [
    String(dados.nome || '').trim(),
    dados.descricao || null,
    dados.codigo ? String(dados.codigo).trim() : null,
    Number(dados.preco_venda || 0),
    Number(dados.preco_aluguel || 0),
    dados.ativo === false ? 0 : 1,
    id
  ]);

  if (Array.isArray(dados.itens)) {
    await db.query(`DELETE FROM combo_itens WHERE combo_id = ?`, [id]);
    for (const item of dados.itens) {
      await adicionarItemCombo(id, item);
    }
  }
}

export async function atualizarItemCombo(id, item) {
  await db.query(`
    UPDATE combo_itens SET produto_id = ?, quantidade = ? WHERE id = ?
  `, [item.produto_id, Number(item.quantidade || 1), id]);
}

export async function removerItemCombo(id) {
  await db.query(`DELETE FROM combo_itens WHERE id = ?`, [id]);
}

export async function desativarCombo(id) {
  await db.query(`UPDATE combos SET ativo = 0 WHERE id = ?`, [id]);
}

export async function calcularDisponibilidadeCombo(comboId) {
  const itens = await listarItensDoCombo(comboId);
  if (!itens.length) return { disponivel: 0, limitante: null };

  const opcoes = [];

  for (const item of itens) {
    const [rows] = await db.query(`SELECT * FROM produtos WHERE id = ?`, [item.produto_id]);
    const p = rows[0];
    if (!p) continue;

    const disponivel = Number(p.estoque || 0) - Number(p.estoque_reservado || 0) - Number(p.estoque_em_uso || 0) - Number(p.estoque_manutencao || 0) - Number(p.estoque_danificado || 0);
    const qtdPorCombo = Number(item.quantidade || 1);
    const qtdDisponivel = qtdPorCombo > 0 ? Math.floor(disponivel / qtdPorCombo) : 0;
    opcoes.push({ produto_id: p.id, nome: p.nome, disponivel, qtdPorCombo, qtdDisponivel });
  }

  const limitante = opcoes.reduce((menor, atual) => (!menor || atual.qtdDisponivel < menor.qtdDisponivel ? atual : menor), null);

  return {
    disponivel: limitante ? limitante.qtdDisponivel : 0,
    limitante: limitante || null
  };
}
