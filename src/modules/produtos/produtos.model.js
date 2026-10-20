import db from "../../../database/connection.js";

export async function findAll(filtros = {}) {
  const {
    busca = "",
    categoria = "",
    status = "",
    fornecedor = "",
    ativo = "",
    disponivelMinimo = "",
    ordenacao = "nome"
  } = filtros;
  const disponivelSql = `(COALESCE(p.estoque, 0) - COALESCE(p.estoque_reservado, 0)
       - COALESCE(p.estoque_em_uso, 0) - COALESCE(p.estoque_manutencao, 0)
       - COALESCE(p.estoque_danificado, 0))`;
  const ordenacoesPermitidas = {
    nome: "p.nome ASC",
    codigo: "p.codigo ASC, p.nome ASC",
    categoria: "p.categoria ASC, p.nome ASC",
    estoque: "p.estoque DESC, p.nome ASC",
    disponivel: "disponivel DESC, p.nome ASC",
    preco_venda: "p.preco_venda DESC, p.nome ASC",
    preco_aluguel: "p.preco_aluguel DESC, p.nome ASC"
  };
  let sql = `
    SELECT p.id, p.nome, p.codigo, p.categoria, p.fornecedor_id, p.imagem,
      p.estoque, p.preco_venda, p.preco_aluguel, p.estoque_reservado,
      p.estoque_em_uso, p.estoque_manutencao, p.estoque_danificado,
      p.estoque_minimo, p.ativo, f.nome AS fornecedor,
      p.estoque_reservado AS reservado,
      ${disponivelSql} AS disponivel,
      CASE
        WHEN ${disponivelSql} <= 0 THEN 'INDISPONIVEL'
        WHEN ${disponivelSql} <= COALESCE(p.estoque_minimo, 0) THEN 'BAIXO_ESTOQUE'
        WHEN COALESCE(p.estoque_manutencao, 0) > 0 THEN 'MANUTENCAO'
        WHEN COALESCE(p.estoque_danificado, 0) > 0 THEN 'DANIFICADO'
        WHEN COALESCE(p.estoque_reservado, 0) > 0 THEN 'RESERVADO'
        WHEN COALESCE(p.estoque_em_uso, 0) > 0 THEN 'EM_USO'
        ELSE 'DISPONIVEL'
      END AS status_estoque
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
  if (disponivelMinimo !== "" && Number.isSafeInteger(Number(disponivelMinimo)) && Number(disponivelMinimo) >= 0) {
    sql += ` AND ${disponivelSql} >= ?`;
    params.push(Number(disponivelMinimo));
  }
  if (ativo !== "" && (ativo === "0" || ativo === "1")) {
    sql += " AND p.ativo = ?";
    params.push(Number(ativo));
  }
  if (status) {
    sql += " HAVING status_estoque = ?";
    params.push(status);
  }
  sql += ` ORDER BY ${ordenacoesPermitidas[ordenacao] || ordenacoesPermitidas.nome}`;

  const [rows] = await db.query(sql, params);
  return rows;
}

export async function buscarPorId(id) {
  const [rows] = await db.query(
    `SELECT p.id, p.nome, p.codigo, p.categoria, p.fornecedor_id, p.imagem,
       p.estoque, p.preco_venda, p.preco_aluguel, p.estoque_reservado,
       p.estoque_em_uso, p.estoque_manutencao, p.estoque_danificado,
       p.estoque_minimo, p.ativo, f.nome AS fornecedor
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
      (nome, codigo, categoria, fornecedor_id, imagem,
       estoque, preco_venda, preco_aluguel, estoque_reservado, estoque_em_uso,
       estoque_manutencao, estoque_danificado, estoque_minimo, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 1)`,
    [
      dados.nome,
      dados.codigo || null,
      dados.categoria || null,
      dados.fornecedor_id || null,
      dados.imagem || null,
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
       nome = ?, codigo = ?, categoria = ?, fornecedor_id = ?, imagem = ?, preco_venda = ?,
       preco_aluguel = ?, estoque_minimo = ?, updatedAt = NOW()
     WHERE id = ?`,
    [
      dados.nome,
      dados.codigo || null,
      dados.categoria || null,
      dados.fornecedor_id || null,
      dados.imagem || null,
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
  const { resumoEstoque } = await import('../estoque/estoque.service.js');
  const resumo = await resumoEstoque();
  return {
    total: resumo.total_produtos,
    disponiveis: resumo.disponivel,
    reservados: resumo.estoque_reservado,
    em_uso: resumo.estoque_em_uso,
    manutencao: resumo.estoque_manutencao,
    danificados: resumo.estoque_danificado,
    baixo_estoque: resumo.baixo_estoque,
    valor_estoque: resumo.valor_estoque
  };
}

export async function historico() {
  const { historicoMovimentacoes } = await import('../estoque/estoque.service.js');
  return historicoMovimentacoes();
}
