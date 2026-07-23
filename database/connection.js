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

try {
  const conn = await db.getConnection();
  console.log("Banco de dados CONECTADO");
  conn.release();
} catch (err) {
  console.error("Erro ao conectar ao banco:", err.message);
}

export default db;