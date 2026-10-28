import db from "../../database/connection.js";
import { permissionActionForRequest } from "./permission-actions.js";

const permissionByPath = [
  ["/dashboard", "dashboard"],
  ["/produtos", "produtos"],
  ["/clientes", "clientes"],
  ["/pedidos", "pedidos"],
  ["/estoque", "estoque"],
  ["/entregas", "entregas"],
  ["/retiradas", "retiradas"],
  ["/fornecedores", "fornecedor"],
  ["/relatorios", "relatorios"],
  ["/usuarios", "cadastro_admin"],
  ["/entregas/pedidos", "entregas"],
  ["/orcamentos", "pedidos"],
  ["/combos", "produtos"],
  ["/devedores", "relatorios"]
];

const landingPageCandidates = [
  ["/dashboard", "dashboard"],
  ["/pedidos", "pedidos"],
  ["/clientes", "clientes"],
  ["/produtos", "produtos"],
  ["/estoque", "estoque"],
  ["/entregas", "entregas"],
  ["/retiradas", "retiradas"],
  ["/fornecedores", "fornecedor"],
  ["/relatorios", "relatorios"],
  ["/usuarios", "cadastro_admin"]
];

const specializedPermissions = [
  [/^\/entregas\/pedidos\/\d+\/pagamentos(?:\/|$)/, "pagamentos"],
  [/^\/entregas\/pedidos\/\d+\/reembolso(?:\/|$)/, "pagamentos"],
  [/^\/entregas\/pedidos\/\d+\/marcar-retirado(?:\/|$)/, "retiradas"],
  [/^\/devedores\/\d+\/pagamento(?:\/|$)/, "pagamentos"]
];

function isPublicRequest(req) {
  return req.path === "/" || req.path === "/login" || req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.startsWith("/img/");
}

function isFuncionarioApi(req) {
  return req.path.startsWith("/usuarios/api/");
}

function denyPermission(res, req, { noPermissions = false } = {}) {
  const message = noPermissions
    ? "Sua autenticação foi aceita, mas este usuário ainda não possui permissões atribuídas. Solicite a liberação dos módulos necessários."
    : "Você não tem permissão para esta operação.";
  if (isFuncionarioApi(req)) {
    return res.status(403).json({
      data: null,
      error: {
        code: noPermissions ? "PERMISSIONS_NOT_ASSIGNED" : "FORBIDDEN",
        message
      },
      message
    });
  }
  if (noPermissions && req.accepts("html")) return res.redirect("/sem-permissoes");
  return res.status(403).json({ success: false, message });
}

function permissionForPath(path) {
  const specialized = specializedPermissions.find(([pattern]) => pattern.test(path));
  if (specialized) return specialized;
  return permissionByPath.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function landingPageForUser(userId) {
  const moduleKeys = [...new Set(landingPageCandidates.map(([, module]) => module))];
  const [permissionRows] = await db.query(
    `SELECT ${moduleKeys.join(", ")}
     FROM user_permissions
     WHERE usuario_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [userId]
  );
  if (!permissionRows.length) return "/sem-permissoes";

  const [actionRows] = await db.query(
    `SELECT module_key
     FROM user_permission_actions
     WHERE usuario_id = ? AND action_key = 'view'`,
    [userId]
  );
  const viewableModules = new Set(actionRows.map((row) => row.module_key));
  const landingPage = landingPageCandidates.find(([path, module]) =>
    Number(permissionRows[0][module]) === 1 && viewableModules.has(module)
  );
  return landingPage?.[0] || "/sem-permissoes";
}

export async function protegerAplicacao(req, res, next) {
  if (isPublicRequest(req)) return next();
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (isFuncionarioApi(req)) {
      return res.status(401).json({
        data: null,
        error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." },
        message: "Autenticação necessária."
      });
    }
    if (req.accepts("html")) return res.redirect("/");
    return res.status(401).json({ success: false, message: "Autenticação necessária." });
  }

  const entrada = permissionForPath(req.path);

  try {
    const [permissionRows] = await db.query(
      `SELECT dashboard, clientes, produtos, pedidos, entregas, retiradas,
              pagamentos, estoque, relatorios, funcionarios, fornecedor, cadastro_admin
       FROM user_permissions
       WHERE usuario_id = ?
       LIMIT 1`,
      [req.user.id]
    );
    res.locals.userPermissions = permissionRows[0] || {};

    if (!entrada) return next();
    if (!permissionRows.length) {
      return denyPermission(res, req, { noPermissions: true });
    }

    const [rows] = await db.query(
      `SELECT ?? AS permitido FROM user_permissions WHERE usuario_id = ? LIMIT 1`,
      [entrada[1], req.user.id]
    );
    if (!rows.length || Number(rows[0].permitido) !== 1) {
      return denyPermission(res, req);
    }

    const action = permissionActionForRequest(req);
    if (action) {
      const [actionRows] = await db.query(
        `SELECT 1 AS permitido
         FROM user_permission_actions
         WHERE usuario_id = ? AND module_key = ? AND action_key = ?
         LIMIT 1`,
        [req.user.id, entrada[1], action]
      );
      if (!actionRows.length) return denyPermission(res, req);
    }
    return next();
  } catch (error) {
    return next(error);
  }
}