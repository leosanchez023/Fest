import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import test from "node:test";
import { seedInitialAdmin } from "../src/database/seeds/initial-admin.js";
import { ACTION_KEYS, PERMISSION_KEYS } from "../src/modules/usuarios/funcionarios.validation.js";

function fakePool({ existingUsers = 0 } = {}) {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("COUNT(*)::integer AS total")) {
        return { rows: [{ total: existingUsers }] };
      }
      if (sql.includes("RETURNING id")) return { rows: [{ id: 42 }] };
      if (sql.includes("SELECT cargo")) return { rows: [] };
      return { rows: [] };
    },
    release() {
      client.released = true;
    },
    released: false
  };

  return {
    queries,
    client,
    pool: {
      async connect() {
        return client;
      }
    }
  };
}

test("initial admin seed hashes the password and grants all application permissions", async () => {
  const { pool, queries, client } = fakePool();
  const userId = await seedInitialAdmin({
    pool,
    name: "Primeiro Administrador",
    email: " ADMIN@example.test ",
    password: "A-strong-initial-password"
  });

  assert.equal(userId, 42);
  assert.equal(client.released, true);
  assert.equal(queries.at(-1).sql, "COMMIT");

  const userInsert = queries.find(({ sql }) => sql.includes("INSERT INTO usuario"));
  assert.equal(userInsert.values[0], "Primeiro Administrador");
  assert.equal(userInsert.values[1], "admin@example.test");
  assert.equal(userInsert.values[3], "Administrador");
  assert.equal(await bcrypt.compare("A-strong-initial-password", userInsert.values[2]), true);
  assert.match(userInsert.sql, /ativo, login_habilitado\)\s*VALUES[\s\S]*1, 1/);

  const userPermissionInsert = queries.find(({ sql }) => sql.includes("INSERT INTO user_permissions"));
  assert.deepEqual(userPermissionInsert.values, [42, ...PERMISSION_KEYS.map(() => 1)]);

  const userActionInsert = queries.find(({ sql }) => sql.includes("INSERT INTO user_permission_actions"));
  assert.equal(userActionInsert.values.length, PERMISSION_KEYS.length * ACTION_KEYS.length * 3);
  for (const key of PERMISSION_KEYS) assert.ok(userActionInsert.values.includes(key));
  for (const action of ACTION_KEYS) assert.ok(userActionInsert.values.includes(action));

  const profileInsert = queries.find(({ sql }) => sql.includes("INSERT INTO funcionario_perfil_acoes"));
  assert.ok(profileInsert);
  assert.match(
    queries.find(({ sql }) => sql.includes("INSERT INTO funcionario_perfis_permissoes")).sql,
    /updated_by\)[\s\S]*NULL/
  );
});

test("initial admin seed refuses a populated user table and rolls back", async () => {
  const { pool, queries, client } = fakePool({ existingUsers: 1 });

  await assert.rejects(
    seedInitialAdmin({
      pool,
      name: "Administrator",
      email: "admin@example.test",
      password: "A-strong-initial-password"
    }),
    /só pode ser usado/
  );
  assert.equal(queries.at(-1).sql, "ROLLBACK");
  assert.equal(client.released, true);
  assert.equal(queries.some(({ sql }) => sql.includes("INSERT INTO usuario")), false);
});

test("initial admin seed rejects invalid credentials before opening a connection", async () => {
  const { pool, queries } = fakePool();

  await assert.rejects(
    seedInitialAdmin({
      pool,
      name: "Administrator",
      email: "not-an-email",
      password: "short"
    }),
    /INITIAL_ADMIN_EMAIL/
  );
  assert.equal(queries.length, 0);
});
