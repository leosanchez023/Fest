import * as service from "./fornecedores.service.js";

function statusDoErro(erro) {
  if (erro?.code) return 500;
  if (erro.message === "Fornecedor não encontrado.") return 404;
  if (erro.message.includes("produtos vinculados") || erro.message.includes("Já existe")) return 409;
  return 400;
}

function mensagemDoErro(erro) {
  return statusDoErro(erro) === 500
    ? "Não foi possível concluir a operação."
    : erro.message;
}

export async function listar(req, res) {
  try {
    const fornecedores = await service.listar(req.query);
    return res.render("pages/fornecedor", { fornecedores });
  } catch (erro) {
    console.error("Erro ao listar fornecedores:", erro);
    return res.status(500).render("pages/fornecedor", {
      fornecedores: [],
      error: "Não foi possível carregar os fornecedores."
    });
  }
}

export async function listarJSON(req, res) {
  try {
    return res.json(await service.listar(req.query));
  } catch (erro) {
    console.error("Erro ao listar fornecedores:", erro);
    const status = statusDoErro(erro);
    const mensagem = status === 500 ? "Não foi possível carregar os fornecedores." : erro.message;
    return res.status(status).json({ success: false, error: mensagem });
  }
}

export async function buscar(req, res) {
  try {
    return res.json(await service.buscarPorId(req.params.id));
  } catch (erro) {
    return res.status(statusDoErro(erro)).json({ success: false, error: mensagemDoErro(erro) });
  }
}

export async function criar(req, res) {
  try {
    const id = await service.criar(req.body);
    return res.status(201).json({ success: true, id });
  } catch (erro) {
    return res.status(statusDoErro(erro)).json({ success: false, error: mensagemDoErro(erro) });
  }
}

export async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body);
    return res.json({ success: true });
  } catch (erro) {
    return res.status(statusDoErro(erro)).json({ success: false, error: mensagemDoErro(erro) });
  }
}

export async function excluir(req, res) {
  try {
    await service.excluir(req.params.id);
    return res.json({ success: true });
  } catch (erro) {
    return res.status(statusDoErro(erro)).json({ success: false, error: mensagemDoErro(erro) });
  }
}
