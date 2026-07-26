import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(currentDir, '../../server/mysql-init.sql');

const required = ['MYSQL_HOST', 'MYSQL_USERNAME', 'MYSQL_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

const sql = await fs.readFile(sqlPath, 'utf8');
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  multipleStatements: true,
  ssl: process.env.MYSQL_SSL_ENABLED === 'true' ? {} : undefined,
});

try {
  await connection.query(sql);
  console.log(`Database initialized from ${sqlPath}`);
} finally {
  await connection.end();
}
