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

const sqlFiles = [
  '2026_09_07_pedido_itens_combos.sql',
  '2026_10_10_pedidos_rota_frete.sql',
  '2026_10_11_configuracoes_entrega.sql',
  '2026_10_12_detalhes_rota_entrega.sql',
  '2026_10_26_devolucao_idempotencia.sql',
  '2026_10_26_funcionarios_admin.sql',
  '2026_10_27_user_permissions_estoque.sql'
].map((file) => path.join(process.cwd(), 'database', 'migrations', file));

if (!DB_USER) {
  console.error('DB_USER not set in environment (.env).');
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: true
});

try {
  for (const sqlFile of sqlFiles) {
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Migration file not found: ${sqlFile}`);
    }
    console.log('Aplicando migration:', sqlFile);
    await connection.query(fs.readFileSync(sqlFile, 'utf8'));
  }
  console.log('Migrations aplicadas com sucesso.');
} finally {
  await connection.end();
}
