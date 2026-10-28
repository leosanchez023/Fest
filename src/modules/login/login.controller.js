export function telaLogin(req, res) {
  const error = res.locals.error_msg?.[0] || req.flash("error_msg")[0] || null;
  res.render("pages/login", { layout: false, error });
}

export function semPermissoes(req, res) {
  res.status(403).render("pages/access-denied", {
    title: "Acesso ainda não liberado",
    message: "Sua autenticação foi aceita, mas este usuário ainda não possui permissões atribuídas. Solicite a liberação dos módulos necessários."
  });
}
