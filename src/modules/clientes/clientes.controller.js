import * as service from "./clientes.service.js"

export async function listar(req, res) {
  try {
    const clientes = await service.listar()
    res.render("pages/clientes", { clientes })
  } catch (err) {
    req.flash("error_msg", err.message)
    res.redirect("/clientes")
  }
}

export async function criar(req, res) {
  try {
    await service.criar(req.body)
    res.redirect("/clientes")
  } catch (err) {
    req.flash("error_msg", err.message)
    res.redirect("/clientes")
  }
}

export async function editar(req, res) {
  try {
    const cliente = await service.findById(req.params.id)
    const clientes = await service.listar()

    res.render("pages/clientes", { cliente, clientes })
  } catch (err) {
    req.flash("error_msg", err.message)
    res.redirect("/clientes")
  }
}

export async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body)
    res.redirect("/clientes")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Erro ao atualizar")
    res.redirect("/clientes")
  }
}

export async function deletar(req, res) {
  try {
    await service.deletar(req.params.id)
    res.redirect("/clientes")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Erro ao deletar")
    res.redirect("/clientes")
  }
}