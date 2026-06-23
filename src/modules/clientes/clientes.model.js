import db from "../../database/connection.js";

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