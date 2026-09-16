import db from "../../../database/connection.js";

export async function findAll(filtros = {}) {
  const { busca = "", categoria = "", status = "", fornecedor = "" } = filtros;
  let sql = `
    SELECT p.*, f.nome AS fornecedor,
      p.estoque_reservado AS reservado,
      (COALESCE(p.estoque, 0) - COALESCE(p.estoque_reservado, 0)
       - COALESCE(p.estoque_em_uso, 0) - COALESCE(p.estoque_manutencao, 0)
       - COALESCE(p.estoque_danificado, 0)) AS disponivel,
      CASE
        WHEN p.ativo = 0 THEN 'INATIVO'
        WHEN COALESCE(p.estoque_manutencao, 0) > 0 THEN 'MANUTENCAO'
        WHEN COALESCE(p.estoque_danificado, 0) > 0 THEN 'DANIFICADO'
        WHEN COALESCE(p.estoque_reservado, 0) > 0 THEN 'RESERVADO'
        WHEN COALESCE(p.estoque_em_uso, 0) > 0 THEN 'EM_USO'
        WHEN COALESCE(p.estoque, 0) <= COALESCE(p.estoque_minimo, 0) THEN 'BAIXO_ESTOQUE'
        ELSE 'DISPONIVEL'
      END AS status
    FROM produtos p
    LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
    WHERE 1 = 1
  `;
  const params = [];

  if (busca) {
    sql += " AND (p.nome LIKE ? OR p.codigo LIKE ? OR p.categoria LIKE ? OR f.nome LIKE ?)";
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  if (categoria) {
    sql += " AND p.categoria = ?";
    params.push(categoria);
  }
  if (fornecedor) {
    sql += " AND p.fornecedor_id = ?";
    params.push(fornecedor);
  }
  if (status) {
    sql += " HAVING status = ?";
    params.push(status);
  }
  sql += " ORDER BY p.nome ASC";

  const [rows] = await db.query(sql, params);
  return rows;
}

export async function buscarPorId(id) {
  const [rows] = await db.query(
    `SELECT p.*, f.nome AS fornecedor
     FROM produtos p
     LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0];
}

export async function create(dados) {
  const [result] = await db.query(
    `INSERT INTO produtos
      (nome, codigo, categoria, tipo, tipo_produto, fornecedor_id, imagem, localizacao,
       estoque, preco_venda, preco_aluguel, estoque_reservado, estoque_em_uso,
       estoque_manutencao, estoque_danificado, estoque_minimo, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 1)`,
    [
      dados.nome,
      dados.codigo || null,
      dados.categoria || null,
      dados.tipo || null,
      dados.tipo_produto || "PRODUTO",
      dados.fornecedor_id || null,
      dados.imagem || null,
      dados.localizacao || null,
      Number(dados.estoque || 0),
      Number(dados.precoVenda || 0),
      Number(dados.precoAluguel || 0),
      Number(dados.estoque_minimo || 0)
    ]
  );
  return { id: result.insertId };
}

export async function atualizar(id, dados) {
  await db.query(
    `UPDATE produtos SET
       nome = ?, codigo = ?, categoria = ?, tipo = ?, tipo_produto = ?,
       fornecedor_id = ?, imagem = ?, localizacao = ?, preco_venda = ?,
       preco_aluguel = ?, estoque_minimo = ?, updatedAt = NOW()
     WHERE id = ?`,
    [
      dados.nome,
      dados.codigo || null,
      dados.categoria || null,
      dados.tipo || null,
      dados.tipo_produto || "PRODUTO",
      dados.fornecedor_id || null,
      dados.imagem || null,
      dados.localizacao || null,
      Number(dados.precoVenda || 0),
      Number(dados.precoAluguel || 0),
      Number(dados.estoque_minimo || 0),
      id
    ]
  );
}

export async function excluir(id) {
  await db.query("UPDATE produtos SET ativo = 0 WHERE id = ?", [id]);
}

export async function dashboard() {
  const [rows] = await db.query(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(estoque - estoque_reservado - estoque_em_uso - estoque_manutencao - estoque_danificado), 0) AS disponiveis,
      COALESCE(SUM(estoque_reservado), 0) AS reservados,
      COALESCE(SUM(estoque_em_uso), 0) AS em_uso,
      COALESCE(SUM(estoque_manutencao), 0) AS manutencao,
      COALESCE(SUM(estoque_danificado), 0) AS danificados,
      COALESCE(SUM(CASE WHEN estoque <= COALESCE(estoque_minimo, 0) THEN 1 ELSE 0 END), 0) AS baixo_estoque,
      COALESCE(SUM(estoque * COALESCE(preco_venda, 0)), 0) AS valor_estoque
    FROM produtos
    WHERE ativo = 1
  `);
  return rows[0];
}

export async function historico() {
  const [rows] = await db.query(`
    SELECT m.*, p.nome AS produto
    FROM movimentacao_estoque m
    INNER JOIN produtos p ON p.id = m.produto_id
    ORDER BY m.data_movimentacao DESC
    LIMIT 100
  `);
  return rows;
}
