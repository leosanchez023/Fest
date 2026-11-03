import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const seed = fs.readFileSync(
  new URL("../database/seed.postgresql.sql", import.meta.url),
  "utf8"
);

test("PostgreSQL seed only creates an initial administrator on an empty user table", () => {
  assert.match(seed, /BEGIN;/);
  assert.match(seed, /COMMIT;/);
  assert.match(seed, /pg_advisory_xact_lock/);
  assert.match(seed, /IF EXISTS \(SELECT 1 FROM public\.usuario\)[\s\S]*RAISE EXCEPTION/);
  assert.match(seed, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  assert.match(seed, /crypt\(v_password, gen_salt\('bf', 10\)\)/);
});

test("PostgreSQL seed provisions login and complete administrator permissions", () => {
  assert.match(
    seed,
    /INSERT INTO public\.usuario \(nome, email, senha, cargo, ativo, login_habilitado\)/
  );
  assert.match(seed, /v_admin_role,\s*1,\s*1/);
  assert.match(seed, /INSERT INTO public\.user_permissions/);
  assert.match(seed, /INSERT INTO public\.user_permission_actions/);
  assert.match(seed, /INSERT INTO public\.funcionario_perfis_permissoes/);
  assert.match(seed, /INSERT INTO public\.funcionario_perfil_acoes/);
  assert.match(seed, /'cadastro_admin'/);
});

test("PostgreSQL seed rejects placeholders and validates the configured email", () => {
  assert.match(seed, /v_name LIKE 'REPLACE_WITH_%'/);
  assert.match(seed, /v_email LIKE 'REPLACE_WITH_%'/);
  assert.match(seed, /v_password LIKE 'REPLACE_WITH_%'/);
  assert.match(seed, /v_email text := '[^']+@[^']+\.[^']+';/);
});
