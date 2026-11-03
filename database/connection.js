import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const caCertificatePath = process.env.DATABASE_CA_CERT;
const caCertificate = caCertificatePath
  ? fs.readFileSync(path.resolve(caCertificatePath), "utf8")
  : undefined;

if (caCertificate && !caCertificate.includes("-----BEGIN CERTIFICATE-----")) {
  throw new Error("DATABASE_CA_CERT deve apontar para um certificado CA em formato PEM.");
}

const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: {
    rejectUnauthorized: true,
    ...(caCertificate ? { ca: caCertificate } : {})
  }
});

pool.on("error", (error) => {
  console.error("Erro inesperado no pool PostgreSQL:", error);
});

export default pool;
