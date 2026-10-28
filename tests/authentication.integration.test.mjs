import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import db from "../database/connection.js";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ||= "isolated-auth-integration-test-secret";
const { default: app } = await import("../app.js");

const email = `auth-test-${randomUUID()}@example.test`;
const password = "Valid-Test-Password-42";
let userId;

try {
  const [[database]] = await db.query("SELECT DATABASE() AS name");
  assert.equal(
    database.name,
    "fest_auth_test",
    "Authentication integration tests must run only against the isolated fest_auth_test database"
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const [userResult] = await db.query(
    `INSERT INTO usuario (nome, email, senha, cargo, ativo, login_habilitado)
     VALUES ('Auth Integration Test', ?, ?, 'Administrador', 1, 1)`,
    [email, passwordHash]
  );
  userId = userResult.insertId;

  const anonymousResponse = await request(app).get("/usuarios");
  assert.equal(anonymousResponse.status, 302, "Protected pages must redirect anonymous users");
  assert.equal(anonymousResponse.headers.location, "/");

  const correctLoginWithoutPermissions = await request.agent(app)
    .post("/login")
    .type("form")
    .send({ email, senha: password });
  assert.equal(correctLoginWithoutPermissions.status, 302);
  assert.equal(correctLoginWithoutPermissions.headers.location, "/sem-permissoes");

  const noPermissionsAgent = request.agent(app);
  await noPermissionsAgent
    .post("/login")
    .type("form")
    .send({ email, senha: password })
    .expect(302);
  const noPermissionsPage = await noPermissionsAgent.get("/sem-permissoes");
  assert.equal(noPermissionsPage.status, 403);
  assert.match(noPermissionsPage.text, /autenticação foi aceita/i);
  assert.match(noPermissionsPage.text, /permissões atribuídas/i);

  const wrongPassword = await request.agent(app)
    .post("/login")
    .type("form")
    .send({ email, senha: "incorrect-password" });
  assert.equal(wrongPassword.status, 302);
  assert.equal(wrongPassword.headers.location, "/");

  const unknownEmail = await request.agent(app)
    .post("/login")
    .type("form")
    .send({ email: `missing-${email}`, senha: password });
  assert.equal(unknownEmail.status, 302);
  assert.equal(unknownEmail.headers.location, "/");

  await db.query("UPDATE usuario SET ativo = 0 WHERE id = ?", [userId]);
  const inactiveLogin = await request.agent(app)
    .post("/login")
    .type("form")
    .send({ email, senha: password });
  assert.equal(inactiveLogin.status, 302);
  assert.equal(inactiveLogin.headers.location, "/");

  await db.query("UPDATE usuario SET ativo = 1, login_habilitado = 0 WHERE id = ?", [userId]);
  const disabledLogin = await request.agent(app)
    .post("/login")
    .type("form")
    .send({ email, senha: password });
  assert.equal(disabledLogin.status, 302);
  assert.equal(disabledLogin.headers.location, "/");

  await db.query("UPDATE usuario SET login_habilitado = 1 WHERE id = ?", [userId]);
  await db.query(
    `INSERT INTO user_permissions (usuario_id, cadastro_admin)
     VALUES (?, 1)`,
    [userId]
  );
  await db.query(
    `INSERT INTO user_permission_actions (usuario_id, module_key, action_key)
     VALUES (?, 'cadastro_admin', 'view')`,
    [userId]
  );

  const authenticatedAgent = request.agent(app);
  const successfulLogin = await authenticatedAgent
    .post("/login")
    .type("form")
    .send({ email, senha: password });
  assert.equal(successfulLogin.status, 302);
  assert.equal(successfulLogin.headers.location, "/usuarios");

  const allowedPage = await authenticatedAgent.get("/usuarios/api/modelos-permissoes");
  assert.equal(allowedPage.status, 200, "The session must persist and an allowed page must be accessible");

  const deniedPage = await authenticatedAgent.get("/dashboard");
  assert.equal(deniedPage.status, 403, "A module without an assigned permission must remain protected");

  const userPage = await authenticatedAgent.get("/usuarios");
  assert.equal(userPage.status, 200);
  const csrfToken = userPage.text.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1];
  assert.ok(csrfToken, "An authenticated page must provide its CSRF token");

  const logout = await authenticatedAgent
    .post("/logout")
    .type("form")
    .send({ _csrf: csrfToken });
  assert.equal(logout.status, 302);
  assert.equal(logout.headers.location, "/");
  const afterLogout = await authenticatedAgent.get("/usuarios/api/modelos-permissoes");
  assert.equal(afterLogout.status, 401, "Logout must destroy the authenticated session");

  const originalQuery = db.query;
  try {
    db.query = () => Promise.reject(new Error("synthetic database connection failure"));
    const unavailableDatabaseLogin = await request.agent(app)
      .post("/login")
      .type("form")
      .send({ email, senha: password });
    assert.equal(unavailableDatabaseLogin.status, 500);
    assert.match(unavailableDatabaseLogin.text, /Não foi possível concluir a operação/);
  } finally {
    db.query = originalQuery;
  }

  console.log("Authentication integration tests passed");
} finally {
  if (userId) {
    await db.query("DELETE FROM funcionario_login_eventos WHERE usuario_id = ?", [userId]);
    await db.query("DELETE FROM user_permission_actions WHERE usuario_id = ?", [userId]);
    await db.query("DELETE FROM user_permissions WHERE usuario_id = ?", [userId]);
    await db.query("DELETE FROM usuario WHERE id = ?", [userId]);
  }
  await db.end();
}
