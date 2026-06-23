//import * as service from "./dashboard.service.js"

export async function listar(req, res) {
  try { 
    res.render("pages/dashboard")
  } catch (err) {
    console.error(err)
    res.redirect("/dashboard")
  }
}