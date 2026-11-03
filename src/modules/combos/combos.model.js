import db from '../../../database/connection.js';

async function adicionarItemNaTransacao(conn, comboId, item) {
  const produtoId = Number(item.produto_id);
  const quantidade = Number(item.quantidade);
  if (!Number.isSafeInteger(produtoId) || produtoId <= 0 ||
      !Number.isSafeInteger(quantidade) || quantidade <= 0) {
    throw new Error('Produto e quantidade do componente devem ser válidos.');
  }

  const { rows: combos } = await conn.query('SELECT id FROM combos WHERE id = $1 FOR UPDATE', [comboId]);
  if (!combos.length) throw new Error('Combo inexistente.');
  const { rows: produtos } = await conn.query(
    'SELECT id, ativo FROM produtos WHERE id = $1 FOR UPDATE',
    [produtoId]
  );
  if (!produtos.length || Number(produtos[0].ativo) !== 1) {
    throw new Error('Produto inexistente ou inativo.');
  }
  const { rows: duplicados } = await conn.query(
    'SELECT id FROM combo_itens WHERE combo_id = $1 AND produto_id = $2 LIMIT 1 FOR UPDATE',
    [comboId, produtoId]
  );
  if (duplicados.length) throw new Error('Este produto já está adicionado ao combo.');

  return conn.query(
    'INSERT INTO combo_itens (combo_id, produto_id, quantidade) VALUES ($1, $2, $3) RETURNING id',
    [comboId, produtoId, quantidade]
  );
}

export async function listarCombos() {
  const { rows } = await db.query(`
    SELECT c.id, c.nome, c.descricao, c.codigo, c.ativo,
      c."createdAt" AS "createdAt", c."updatedAt" AS "updatedAt",
      COALESCE(NULLIF(c.preco_aluguel, 0), c.preco_venda, 0) AS preco,
      (SELECT COUNT(*) FROM combo_itens ci WHERE ci.combo_id = c.id) AS total_itens
    FROM combos c
    ORDER BY c.nome ASC
  `);

  return rows;
}

export async function buscarComboPorId(id) {
  const { rows } = await db.query(`
    SELECT id, nome, descricao, codigo, ativo,
      "createdAt" AS "createdAt", "updatedAt" AS "updatedAt",
      COALESCE(NULLIF(preco_aluguel, 0), preco_venda, 0) AS preco
    FROM combos WHERE id = $1
  `, [id]);
  return rows[0] || null;
}

export async function listarItensDoCombo(comboId) {
  const { rows } = await db.query(`
    SELECT ci.*, p.nome AS produto_nome, p.codigo, p.estoque
    FROM combo_itens ci
    LEFT JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.combo_id = $1
    ORDER BY p.nome ASC
  `, [comboId]);
  return rows;
}

export async function criarCombo(dados) {
  if (!dados.nome || !String(dados.nome).trim()) {
    throw new Error('Nome do combo é obrigatório.');
  }

  const preco = Number(dados.preco ?? dados.preco_aluguel ?? dados.preco_venda ?? 0);
  if (!Number.isFinite(preco) || preco < 0) throw new Error('O preço do combo deve ser válido e não negativo.');
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');
    if (dados.codigo) {
      const { rows: existente } = await conn.query(
        'SELECT id FROM combos WHERE LOWER(codigo) = LOWER($1) FOR UPDATE',
        [String(dados.codigo).trim()]
      );
      if (existente.length) throw new Error('Já existe um combo com este código.');
    }

    const { rows } = await conn.query(`
      INSERT INTO combos (nome, descricao, codigo, preco_venda, preco_aluguel, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      String(dados.nome).trim(),
      dados.descricao || null,
      dados.codigo ? String(dados.codigo).trim() : null,
      preco,
      preco,
      dados.ativo === false ? 0 : 1
    ]);

    for (const item of (Array.isArray(dados.itens) ? dados.itens : [])) {
      await adicionarItemNaTransacao(conn, rows[0].id, item);
    }
    await conn.query('COMMIT');
    return { id: rows[0].id };
  } catch (error) {
    await conn.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function adicionarItemCombo(comboId, item) {
  comboId = Number(comboId);
  if (!Number.isSafeInteger(comboId) || comboId <= 0) throw new Error('Combo inválido.');
  const produtoId = Number(item.produto_id);
  const quantidade = Number(item.quantidade ?? 1);
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');
    const result = await adicionarItemNaTransacao(conn, comboId, { produto_id: produtoId, quantidade });
    await conn.query('COMMIT');
    return { id: result.rows[0].id, produto_id: produtoId, quantidade };
  } catch (error) {
    await conn.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function atualizarCombo(id, dados) {
  id = Number(id);
  const preco = Number(dados.preco ?? dados.preco_aluguel ?? dados.preco_venda ?? 0);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Combo inválido.');
  if (!Number.isFinite(preco) || preco < 0) throw new Error('O preço do combo deve ser válido e não negativo.');
  if (dados.ativo !== undefined && typeof dados.ativo !== 'boolean') {
    throw new Error('Estado do combo inválido.');
  }

  const conn = await db.connect();
  try {
    await conn.query('BEGIN');
    const { rows: combos } = await conn.query('SELECT id FROM combos WHERE id = $1 FOR UPDATE', [id]);
    if (!combos.length) throw new Error('Combo inexistente.');
    if (dados.codigo) {
      const { rows: existente } = await conn.query(
        'SELECT id FROM combos WHERE LOWER(codigo) = LOWER($1) AND id <> $2 FOR UPDATE',
        [String(dados.codigo).trim(), id]
      );
      if (existente.length) throw new Error('Já existe um combo com este código.');
    }
    await conn.query(`
      UPDATE combos
      SET nome = $1, descricao = $2, codigo = $3, preco_venda = $4, preco_aluguel = $5,
          ativo = COALESCE($6::smallint, ativo)
      WHERE id = $7
    `, [
      String(dados.nome || '').trim(),
      dados.descricao || null,
      dados.codigo ? String(dados.codigo).trim() : null,
      preco,
      preco,
      dados.ativo === undefined ? null : (dados.ativo ? 1 : 0),
      id
    ]);

    if (Array.isArray(dados.itens)) {
      await conn.query('DELETE FROM combo_itens WHERE combo_id = $1', [id]);
      for (const item of dados.itens) await adicionarItemNaTransacao(conn, id, item);
    }
    await conn.query('COMMIT');
  } catch (error) {
    await conn.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function atualizarItemCombo(id, item) {
  await db.query(`
    UPDATE combo_itens SET produto_id = $1, quantidade = $2 WHERE id = $3
  `, [item.produto_id, Number(item.quantidade || 1), id]);
}

export async function removerItemCombo(id) {
  await db.query(`DELETE FROM combo_itens WHERE id = $1`, [id]);
}

export async function desativarCombo(id) {
  return atualizarStatusCombo(id, false);
}

export async function atualizarStatusCombo(id, ativo) {
  const comboId = Number(id);
  if (!Number.isSafeInteger(comboId) || comboId <= 0) throw new Error('Combo inválido.');
  if (typeof ativo !== 'boolean') throw new Error('Estado do combo inválido.');

  const conn = await db.connect();
  try {
    await conn.query('BEGIN');
    const { rows: combos } = await conn.query(
      'SELECT id, ativo FROM combos WHERE id = $1 FOR UPDATE',
      [comboId]
    );
    if (!combos.length) {
      const error = new Error('Combo não encontrado.');
      error.statusCode = 404;
      throw error;
    }

    let estadoPersistido = Number(combos[0].ativo);
    if (estadoPersistido !== Number(ativo)) {
      const { rows, rowCount } = await conn.query(
        'UPDATE combos SET ativo = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, ativo',
        [
        ativo ? 1 : 0,
        comboId
        ]
      );
      if (rowCount !== 1 || !rows.length) {
        throw new Error('Não foi possível confirmar a atualização do combo no banco de dados.');
      }
      estadoPersistido = Number(rows[0].ativo);
    }
    if (estadoPersistido !== Number(ativo)) {
      throw new Error('O PostgreSQL não confirmou o novo estado do combo.');
    }
    await conn.query('COMMIT');
    return { id: comboId, ativo: estadoPersistido === 1 };
  } catch (error) {
    await conn.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

export async function calcularDisponibilidadeCombo(comboId) {
  const itens = await listarItensDoCombo(comboId);
  if (!itens.length) return { disponivel: null, limitante: null };

  const opcoes = [];

  for (const item of itens) {
    const { rows } = await db.query(
      'SELECT * FROM produtos WHERE id = $1 AND COALESCE(controla_estoque, TRUE)',
      [item.produto_id]
    );
    const p = rows[0];
    if (!p) continue;

    const disponivel = Number(p.estoque || 0) - Number(p.estoque_reservado || 0) - Number(p.estoque_em_uso || 0) - Number(p.estoque_manutencao || 0) - Number(p.estoque_danificado || 0);
    const qtdPorCombo = Number(item.quantidade || 1);
    const qtdDisponivel = qtdPorCombo > 0 ? Math.floor(disponivel / qtdPorCombo) : 0;
    opcoes.push({ produto_id: p.id, nome: p.nome, disponivel, qtdPorCombo, qtdDisponivel });
  }

  const limitante = opcoes.reduce((menor, atual) => (!menor || atual.qtdDisponivel < menor.qtdDisponivel ? atual : menor), null);

  return {
    disponivel: limitante ? limitante.qtdDisponivel : null,
    limitante: limitante || null
  };
}
