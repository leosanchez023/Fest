// usuarios.model.js
import db from "../../../database/connection.js";


// 🔍 BUSCAR TODOS OS USUÁRIOS + PERMISSÕES
export async function buscarUsuariosComPermissoes() {
  const [rows] = await db.query(`
    SELECT u.*, p.*
    FROM usuario u
    LEFT JOIN user_permissions p 
      ON u.id = p.usuario_id
  `);

  return rows;
}


// 🔍 BUSCAR USUÁRIO POR EMAIL
export async function buscarPorEmail(email) {
  const [rows] = await db.query(
    "SELECT * FROM usuario WHERE email = ?",
    [email]
  );

  return rows;
}


// ➕ INSERIR USUÁRIO
export async function inserirUsuario(nome, email, senha) {
  const [result] = await db.query(
    "INSERT INTO usuario (nome, email, senha) VALUES (?, ?, ?)",
    [nome, email, senha]
  );

  return result.insertId;
}


// 🛡️ INSERIR PERMISSÕES
export async function inserirPermissoes(userId, p) {
  await db.query(`
    INSERT INTO user_permissions 
    (
      usuario_id,
      dashboard,
      clientes,
      produtos,
      pedidos,
      entregas,
      retiradas,
      pagamentos,
      relatorios,
      funcionarios,
      fornecedor,
      cadastro_admin
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    p.dashboard,
    p.clientes,
    p.produtos,
    p.pedidos,
    p.entregas,
    p.retiradas,
    p.pagamentos,
    p.relatorios,
    p.funcionarios,
    p.fornecedor,
    p.cadastro_admin
  ]);
}