// usuarios.service.js
import bcrypt from "bcrypt";
import * as model from "./usuarios.model.js";

export async function getUsuarios() {
  return await model.buscarUsuariosComPermissoes();
}

export async function criarUsuario(data) {
  const { nome, email, senha } = data;

  // verifica email
  const existente = await model.buscarPorEmail(email);

  if (existente.length > 0) {
    throw new Error("E-mail já cadastrado");
  }

  // hash
  const hash = await bcrypt.hash(senha, 10);

  // cria usuário
  const userId = await model.inserirUsuario(nome, email, hash);

  // permissões
  const permissoes = {
    dashboard: data.dashboard ? 1 : 0,
    clientes: data.clientes ? 1 : 0,
    produtos: data.produtos ? 1 : 0,
    pedidos: data.pedidos ? 1 : 0,
    entregas: data.entregas ? 1 : 0,
    retiradas: data.retiradas ? 1 : 0,
    pagamentos: data.pagamentos ? 1 : 0,
    relatorios: data.relatorios ? 1 : 0,
    funcionarios: data.funcionarios ? 1 : 0,
    fornecedor: data.fornecedor ? 1 : 0,
    cadastro_admin: data.cadastro_admin ? 1 : 0,
  };

  await model.inserirPermissoes(userId, permissoes);
}