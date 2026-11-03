import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../../database/connection.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para aplicar migrations PostgreSQL.");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = path.join(root, "database", "schema.postgresql.sql");
const migrationDirectory = path.join(root, "database", "migrations", "postgresql");

async function applyMigration(client, name, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO public.locagest_schema_migrations (migration_name) VALUES ($1)",
      [name]
    );
    await client.query("COMMIT");
    console.log(`Migration aplicada: ${name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const client = await db.connect();
try {
  const { rows: migrationTables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'locagest_schema_migrations'
      AND table_type = 'BASE TABLE'
  `);

  if (!migrationTables.length) {
    const { rows: existingTables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type IN ('BASE TABLE', 'VIEW')
      LIMIT 1
    `);
    if (existingTables.length) {
      throw new Error(
        "O schema PostgreSQL já contém objetos. Aplique o baseline somente em um banco Supabase vazio."
      );
    }

    await client.query(`
      CREATE TABLE public.locagest_schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  const { rows: appliedRows } = await client.query(
    "SELECT migration_name FROM public.locagest_schema_migrations"
  );
  const applied = new Set(appliedRows.map((row) => row.migration_name));

  if (!applied.has("schema.postgresql.sql")) {
    const { rows: existingTables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> 'locagest_schema_migrations'
      LIMIT 1
    `);
    if (existingTables.length) {
      throw new Error(
        "O schema PostgreSQL já contém tabelas. Aplique o baseline somente em um banco Supabase vazio."
      );
    }

    await applyMigration(
      client,
      "schema.postgresql.sql",
      await fs.readFile(baselinePath, "utf8")
    );
  }

  let migrationFiles = [];
  try {
    migrationFiles = (await fs.readdir(migrationDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const name of migrationFiles) {
    if (applied.has(name)) continue;
    await applyMigration(
      client,
      name,
      await fs.readFile(path.join(migrationDirectory, name), "utf8")
    );
  }
} finally {
  client.release();
  await db.end();
}
