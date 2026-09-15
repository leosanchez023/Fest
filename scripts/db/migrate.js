import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

dotenv.config();

const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || process.env.DB_USER_NAME;
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || process.env.DB_DATABASE || 'fest';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;

const sqlFile = path.join(process.cwd(), 'database', 'migrations', '2026_09_07_pedido_itens_combos.sql');

if (!DB_USER) {
  console.error('DB_USER not set in environment (.env).');
  process.exit(1);
}

if (!fs.existsSync(sqlFile)) {
  console.error('Migration file not found:', sqlFile);
  process.exit(1);
}

console.log('Aplicando migration:', sqlFile);

const sql = fs.readFileSync(sqlFile, 'utf8');
const connection = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: true
});

try {
  await connection.query(sql);
  console.log('Migration aplicada com sucesso.');
} finally {
  await connection.end();
}
