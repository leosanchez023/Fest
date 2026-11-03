import bcrypt from "bcrypt";
import { pathToFileURL } from "node:url";
import db from "../../../database/connection.js";
import { ACTION_KEYS, PERMISSION_KEYS } from "../../modules/usuarios/funcionarios.validation.js";
import { isValidPassword, normalizarEmail } from "../../config/security.js";

const ADMIN_ROLE = "Administrador";
const BCRYPT_ROUNDS = 10;

function validateInput({ name, email, password }) {
  const normalizedName = String(name ?? "").trim();
  const normalizedEmail = normalizarEmail(email);
  const normalizedPassword = String(password ?? "");

  if (!normalizedName || normalizedName.length > 100) {
    throw new Error("INITIAL_ADMIN_NAME deve conter de 1 a 100 caracteres.");
  }
  if (
    normalizedEmail.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new Error("INITIAL_ADMIN_EMAIL deve conter um e-mail válido com até 100 caracteres.");
  }
  if (!isValidPassword(normalizedPassword)) {
    throw new Error("INITIAL_ADMIN_PASSWORD deve ter pelo menos 8 caracteres.");
  }
  if (Buffer.byteLength(normalizedPassword, "utf8") > 72) {
    throw new Error("INITIAL_ADMIN_PASSWORD não pode exceder 72 bytes em UTF-8.");
  }

  return {
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword
  };
}

function fullPermissions() {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, 1]));
}

function fullActionGrants() {
  return PERMISSION_KEYS.flatMap((moduleKey) =>
    ACTION_KEYS.map((actionKey) => [moduleKey, actionKey])
  );
}

async function insertProfileActions(connection, cargo) {
  const rows = fullActionGrants();
  const values = [];
  const placeholders = rows.map(([moduleKey, actionKey]) => {
    const start = values.length + 1;
    values.push(cargo, moduleKey, actionKey);
    return `($${start}, $${start + 1}, $${start + 2})`;
  });

  await connection.query(
    `INSERT INTO funcionario_perfil_acoes (cargo, module_key, action_key)
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

async function saveAdministratorProfile(connection) {
  const permissions = fullPermissions();
  const { rows: existingProfiles } = await connection.query(
    `SELECT cargo
     FROM funcionario_perfis_permissoes
     WHERE LOWER(cargo) = LOWER($1)
     FOR UPDATE`,
    [ADMIN_ROLE]
  );
  const cargo = existingProfiles[0]?.cargo || ADMIN_ROLE;
  const values = PERMISSION_KEYS.map((key) => permissions[key]);

  if (existingProfiles.length) {
    await connection.query(
      `UPDATE funcionario_perfis_permissoes
       SET ${PERMISSION_KEYS.map((key, index) => `${key} = $${index + 1}`).join(", ")},
           updated_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(cargo) = LOWER($${PERMISSION_KEYS.length + 1})`,
      [...values, cargo]
    );
    await connection.query(
      "DELETE FROM funcionario_perfil_acoes WHERE LOWER(cargo) = LOWER($1)",
      [cargo]
    );
  } else {
    await connection.query(
      `INSERT INTO funcionario_perfis_permissoes
        (cargo, ${PERMISSION_KEYS.join(", ")}, updated_by)
       VALUES ($1, ${PERMISSION_KEYS.map((_, index) => `$${index + 2}`).join(", ")}, NULL)`,
      [cargo, ...values]
    );
  }

  await insertProfileActions(connection, cargo);
}

async function assignAdministratorPermissions(connection, userId) {
  const permissions = fullPermissions();
  const values = PERMISSION_KEYS.map((key) => permissions[key]);
  await connection.query(
    `INSERT INTO user_permissions (usuario_id, ${PERMISSION_KEYS.join(", ")})
     VALUES ($1, ${PERMISSION_KEYS.map((_, index) => `$${index + 2}`).join(", ")})`,
    [userId, ...values]
  );

  const actions = fullActionGrants();
  const params = [];
  const placeholders = actions.map(([moduleKey, actionKey]) => {
    const start = params.length + 1;
    params.push(userId, moduleKey, actionKey);
    return `($${start}, $${start + 1}, $${start + 2})`;
  });
  await connection.query(
    `INSERT INTO user_permission_actions (usuario_id, module_key, action_key)
     VALUES ${placeholders.join(", ")}`,
    params
  );
}

export async function seedInitialAdmin({ pool = db, name, email, password }) {
  const input = validateInput({ name, email, password });
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock($1)", [732918406]);
    await connection.query("SET LOCAL row_security = off");

    const { rows: userCountRows } = await connection.query(
      "SELECT COUNT(*)::integer AS total FROM usuario"
    );
    if (Number(userCountRows[0]?.total) !== 0) {
      throw new Error("O seed do administrador inicial só pode ser usado quando não há usuários cadastrados.");
    }

    await saveAdministratorProfile(connection);
    const { rows: insertedUsers } = await connection.query(
      `INSERT INTO usuario
        (nome, email, senha, cargo, ativo, login_habilitado)
       VALUES ($1, $2, $3, $4, 1, 1)
       RETURNING id`,
      [input.name, input.email, passwordHash, ADMIN_ROLE]
    );
    const userId = insertedUsers[0].id;
    await assignAdministratorPermissions(connection, userId);

    await connection.query("COMMIT");
    return userId;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

async function runFromCommandLine() {
  try {
    const id = await seedInitialAdmin({
      name: process.env.INITIAL_ADMIN_NAME,
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD
    });
    console.log(`Administrador inicial criado (id: ${id}).`);
  } catch (error) {
    console.error(`Não foi possível criar o administrador inicial: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runFromCommandLine();
}
