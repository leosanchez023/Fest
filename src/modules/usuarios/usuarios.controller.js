// usuarios.controller.js
import * as service from "./usuarios.service.js";

export async function listarUsuarios(req, res) {
  try {
    const usuarios = await service.getUsuarios();

    res.render("pages/funcionarios", {
      usuarios,
      erros: []
    });

  } catch (err) {
    console.error(err);

    res.render("pages/funcionarios", {
      usuarios: [],
      erros: [{ texto: "Erro ao carregar usuários" }]
    });
  }
}


export async function criarUsuario(req, res) {
  const { nome, email, senha, senha2 } = req.body;

  let erros = [];

  if (!nome) erros.push({ texto: "Nome inválido" });
  if (!email) erros.push({ texto: "E-mail inválido" });
  if (!senha) erros.push({ texto: "Senha inválida" });

  if (senha && senha.length < 4) {
    erros.push({ texto: "A senha deve ter pelo menos 4 caracteres" });
  }

  if (senha !== senha2) {
    erros.push({ texto: "As senhas não coincidem" });
  }

  if (erros.length > 0) {
    const usuarios = await service.getUsuarios();

    return res.render("pages/funcionarios", {
      erros,
      usuarios
    });
  }

  try {
    await service.criarUsuario(req.body);

    res.redirect("/usuarios");

  } catch (err) {
    console.error(err);

    const usuarios = await service.getUsuarios();

    res.render("pages/funcionarios", {
      erros: [{ texto: err.message }],
      usuarios
    });
  }
}