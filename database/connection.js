import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o arquivo .env
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const ensureSchema = async () => {
  const statements = [
    "ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_entrega_hora DATETIME NULL",
    "ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_retirada_hora DATETIME NULL",
    "ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS conferencia_finalizada TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE devolucoes ADD COLUMN IF NOT EXISTS responsavel VARCHAR(100) NULL",
    "ALTER TABLE devolucoes ADD COLUMN IF NOT EXISTS data_devolucao_hora DATETIME NULL",
  ];

  for (const sql of statements) {
    try {
      await db.query(sql);
    } catch (err) {
      if (!/already exists|Duplicate column/i.test(err.message)) {
        console.warn("Aviso de schema:", err.message);
      }
    }
  }
};

try {
  const conn = await db.getConnection();
  console.log("Banco de dados CONECTADO");
  conn.release();
  await ensureSchema();
} catch (err) {
  console.error("Erro ao conectar ao banco:", err.message);
}

export default db;