import db from "../../database/connection.js";

const permissionByPath = [
  ["/usuarios", "cadastro_admin"],
  ["/produtos", "produtos"],
  ["/clientes", "clientes"],
  ["/dashboard", "dashboard"],
  ["/entregas", "entregas"],
  ["/fornecedores", "fornecedor"],
  ["/pedidos", "pedidos"],
  ["/orcamentos", "pedidos"],
  ["/estoque", "produtos"],
  ["/combos", "produtos"],
  ["/relatorios", "relatorios"],
  ["/devedores", "relatorios"]
];

function isPublicRequest(req) {
  return req.path === "/" || req.path === "/login" || req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.startsWith("/img/");
}

export async function protegerAplicacao(req, res, next) {
  if (isPublicRequest(req)) return next();
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.accepts("html")) return res.redirect("/");
    return res.status(401).json({ success: false, message: "Autenticação necessária." });
  }

  const entrada = permissionByPath.find(([prefix]) => req.path === prefix || req.path.startsWith(`${prefix}/`));

  try {
    const [permissionRows] = await db.query(
      `SELECT dashboard, clientes, produtos, pedidos, entregas, relatorios,
              funcionarios, fornecedor, cadastro_admin
       FROM user_permissions
       WHERE usuario_id = ?
       LIMIT 1`,
      [req.user.id]
    );
    res.locals.userPermissions = permissionRows[0] || {};

    if (!entrada) return next();

    const [rows] = await db.query(
      `SELECT ?? AS permitido FROM user_permissions WHERE usuario_id = ? LIMIT 1`,
      [entrada[1], req.user.id]
    );
    if (!rows.length || Number(rows[0].permitido) !== 1) {
      return res.status(403).json({ success: false, message: "Você não tem permissão para esta operação." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}