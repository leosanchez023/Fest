export function telaLogin(req, res) {
  const error = res.locals.error_msg?.[0] || req.flash("error_msg")[0] || null;
  res.render("pages/login", { layout: false, error });
}

