import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { SCHEMA_SQL } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let pool = null;

export async function initDb() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'swasthya_sense';

  // Step 1: Connect to server without database selected to create DB if needed
  const rootConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  await rootConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await rootConn.end();

  // Step 2: Create connection pool for the database
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
  });

  // Step 3: Run table migrations/creation
  for (const statement of SCHEMA_SQL) {
    await pool.query(statement);
  }

  // Step 4: Run column additions safely if tables already existed
  try {
    await pool.query(`ALTER TABLE check_ins ADD COLUMN client_uuid VARCHAR(64) UNIQUE;`);
  } catch (err) {
    // Column already exists or duplicate key - safe to ignore
  }

  try {
    await pool.query(`ALTER TABLE patients ADD COLUMN abha_id VARCHAR(20) DEFAULT NULL;`);
  } catch (err) {
    // Column already exists - safe to ignore
  }

  console.log(`[Database] MySQL connected and tables verified on ${database}`);
  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDb() first.');
  }
  return pool;
}
