import db from "../../../database/connection.js";

export async function findAll() {
  const [rows] = await db.query(
    `SELECT 
        c.id AS cliente_id,
        c.nome,
        c.email,
        c.telefone,
        c.cpf,
        DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
        e.rua,
        e.numero,
        e.cidade,
        e.estado
     FROM cliente c
     LEFT JOIN endereco e ON c.id_endereco = e.id
     ORDER BY c.id`
  );
  return rows;
}

export async function findWithFilter({ q = "", page = 1, limit = 10 } = {}) {
  const offset = (Number(page) - 1) * Number(limit);

  const hasQuery = q && q.trim() !== "";
  let where = "";
  const params = [];

  if (hasQuery) {
    where = "WHERE (c.nome LIKE ? OR c.email LIKE ? OR c.cpf LIKE ? )";
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  // Select paginated rows
  const [rows] = await db.query(
    `SELECT 
        c.id AS cliente_id,
        c.nome,
        c.email,
        c.telefone,
        c.cpf,
        DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
        e.rua,
        e.numero,
        e.cidade,
        e.estado
     FROM cliente c
     LEFT JOIN endereco e ON c.id_endereco = e.id
     ${where}
     ORDER BY c.id
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  // Count total matching
  const countParams = hasQuery ? [ `%${q}%`, `%${q}%`, `%${q}%` ] : [];
  const countSql = `SELECT COUNT(*) as total FROM cliente c ${hasQuery ? where : ''}`;
  const [countRows] = await db.query(countSql, countParams);

  const total = countRows && countRows[0] ? countRows[0].total : 0;

  return { rows, total };
}

export async function findById(id) {
  const [rows] = await db.query(
  `SELECT 
      c.id AS cliente_id,
      c.id_endereco, -- 🔥 ADICIONA ISSO
      c.nome,
      c.email,
      c.telefone,
      c.cpf,
      DATE_FORMAT(c.nascimento, '%Y-%m-%d') AS nascimento,
      e.rua,
      e.numero,
      e.cidade,
      e.estado
   FROM cliente c 
   LEFT JOIN endereco e ON c.id_endereco = e.id 
   WHERE c.id = ?`,
  [id]
);
  return rows[0];
}

export async function atualizarCliente(id, { nome, email, telefone, cpf, nascimento, id_endereco }) {
  await db.query(
    `UPDATE cliente 
     SET nome = ?, email = ?, telefone = ?, cpf = ?, nascimento = ?, id_endereco = ?
     WHERE id = ?`,
    [nome, email, telefone, cpf, nascimento, id_endereco, id]
  );
}
export async function atualizarEndereco(id, { rua, numero, cidade, estado }) {
  await db.query(
    `UPDATE endereco 
     SET rua = ?, numero = ?, cidade = ?, estado = ?
     WHERE id = ?`,
    [rua, numero, cidade, estado, id]
  );
}

export async function criarEndereco({ rua, numero, cidade, estado }) {
  const [result] = await db.query(
    `INSERT INTO endereco (rua, numero, cidade, estado)
     VALUES (?, ?, ?, ?)`,
    [rua, numero, cidade, estado]
  );

  return result.insertId;
}


export async function criarCliente({ nome, email, telefone, cpf, nascimento, id_endereco }) {
  await db.query(
    `INSERT INTO cliente (nome, email, telefone, cpf, nascimento, id_endereco)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, email, telefone, cpf, nascimento, id_endereco]
  );
}


export async function excluir(id) {
  await db.query(
    "DELETE FROM cliente WHERE id = ?",
    [id]
  );
}