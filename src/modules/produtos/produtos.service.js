import * as model from "./produtos.model.js"

export async function listar() {
  return await model.findAll()
}

export async function buscarPorId(id) {
  return await model.findById(id)
}

export async function criar(dados) {
  if (!dados.nome) {
    throw new Error("Nome obrigatório");
  }

  return await model.create({
    nome: dados.nome,
    tipo: dados.tipo,
    estoque: Number(dados.estoque),
    precoVenda: Number(dados.precoVenda),
    precoAluguel: Number(dados.precoAluguel)
  });
}

export async function deletar(id) {
  return await model.excluir(id);
}

export async function atualizar(id, dados) {
  return await model.atualizar(id, dados)
}