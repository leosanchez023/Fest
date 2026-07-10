import db from "../../../database/connection.js";

export async function findAll() {
  try {
    const [rows] = await db.query("SELECT * FROM produtos");
    return rows;
  } catch (err) {
    console.error("======================");
    console.error(err);
    console.error("Código:", err.code);
    console.error("Mensagem:", err.message);
    console.error("SQL State:", err.sqlState);
    console.error("======================");
    throw err;
  }
}

export async function buscarPorId(id) {
  const [rows] = await db.query(
    "SELECT * FROM produtos WHERE id = ?",
    [id]
  );

  return rows[0];
}

export async function create({ nome, tipo, estoque, precoVenda, precoAluguel }) {
  await db.query(
    `INSERT INTO produtos
    (nome, tipo, estoque, preco_venda, preco_aluguel, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [nome, tipo, estoque, precoVenda, precoAluguel]
  );
}

export async function excluir(id) {
  await db.query(
    "DELETE FROM produtos WHERE id = ?",
    [id]
  );
}

export async function atualizar(id, dados) {
  const { nome, tipo, estoque, precoVenda, precoAluguel } = dados;

  await db.query(
    `UPDATE produtos
     SET nome = ?,
         tipo = ?,
         estoque = ?,
         preco_venda = ?,
         preco_aluguel = ?
     WHERE id = ?`,
    [nome, tipo, estoque, precoVenda, precoAluguel, id]
  );
}