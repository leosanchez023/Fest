import * as service from "./produtos.service.js"

// LISTAR
export async function listar(req, res) {
  const produtos = await service.listar()
  res.render("pages/produtos/index", { produtos })
}

// CRIAR
export async function criar(req, res) {
  try {
    await service.criar(req.body)
    req.flash("success_msg", "Produto criado com sucesso")
    res.redirect("/produtos")
  }catch (err) {
    req.flash("error_msg", err.message)
    res.redirect("/produtos") 
  }
}

export async function deletar(req, res) {
  try {
    await service.deletar(req.params.id);

    // Retorna JSON para fetch
    res.status(200).json({ mensagem: "Produto deletado com sucesso" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensagem: err.message });
  }
}

export async function editar(req, res) {
  try {
    const produto = await service.buscarPorId(req.params.id)
    const produtos = await service.listar()

    res.render("pages/produtos/index", {
      produto,   // 👈 ISSO PREENCHE O FORM
      produtos
    })

  } catch (err) {
    req.flash("error_msg", err.message)
    res.redirect("/produtos")
  }
}

export async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body)

    req.flash("success_msg", "Produto atualizado com sucesso")
    res.redirect("/produtos")

  } catch (err) {
    req.flash("error_msg", err.message)
    res.redirect("/produtos")
  }
}