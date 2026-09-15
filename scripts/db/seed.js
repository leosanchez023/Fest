import dotenv from 'dotenv';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || process.env.DB_USER_NAME;
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || process.env.DB_DATABASE || 'fest';

const sqlFile = path.join(process.cwd(), 'database', 'seed.sql');

if (!DB_USER) {
  console.error('DB_USER not set in environment (.env).');
  process.exit(1);
}

if (!fs.existsSync(sqlFile)) {
  console.error('Seed file not found:', sqlFile);
  process.exit(1);
}

console.log('Executando seed:', sqlFile);

const mysql = spawn('mysql', ['-u', DB_USER, `-p${DB_PASSWORD}`, DB_NAME], { stdio: ['pipe', 'inherit', 'inherit'] });

const stream = fs.createReadStream(sqlFile);
stream.pipe(mysql.stdin);

mysql.on('close', (code) => {
  if (code === 0) {
    console.log('Seed executado com sucesso.');
  } else {
    console.error('mysql process exited with code', code);
  }
});
