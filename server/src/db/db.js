import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { SCHEMA_SQL } from './schema.js';
import { runSeed } from '../seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let pool = null;

function getDbConfig() {
  // 1. Support full connection URLs provided by Railway / Render / TiDB (MYSQL_URL, MYSQLPRIVATEURL, DATABASE_URL)
  const connectionUrl = process.env.MYSQLPRIVATEURL || process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (connectionUrl) {
    try {
      const parsed = new URL(connectionUrl);
      let database = (parsed.pathname || '').replace(/^\//, '') || 'test';
      if (database === 'sys') database = 'test'; // sys is a read-only metadata catalog in MySQL/TiDB

      const isCloudHost = parsed.hostname.includes('tidbcloud.com') || parsed.hostname.includes('aivencloud.com') || parsed.hostname.includes('rlwy.net');
      const ssl = parsed.searchParams.get('ssl') === 'false' 
        ? undefined 
        : (isCloudHost || process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined);

      return {
        isCloud: true,
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || 'root'),
        password: decodeURIComponent(parsed.password || ''),
        database,
        ssl
      };
    } catch (e) {
      console.warn('[Database] Could not parse connection URL, falling back to env variables:', e.message);
    }
  }

  // 2. Check Railway individual env vars or custom env vars
  const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT) || 3306;
  const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
  const password = process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '');
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME || 'swasthya_sense';
  const isCloud = !!(process.env.MYSQLHOST || process.env.MYSQL_URL || process.env.MYSQLPRIVATEURL || process.env.DATABASE_URL || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production');

  return { isCloud, host, port, user, password, database };
}

export async function initDb({ skipAutoSeed = false } = {}) {
  const config = getDbConfig();

  // Step 1: For local environments, ensure DB exists if needed
  if (!config.isCloud && (config.host === 'localhost' || config.host === '127.0.0.1')) {
    try {
      const rootConn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
      });

      await rootConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      await rootConn.end();
    } catch (err) {
      console.warn(`[Database] Notice during local DB creation check: ${err.message}`);
    }
  }

  // Step 2: Create connection pool for the database
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    ...(config.ssl ? { ssl: config.ssl } : {})
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

  // Step 5: Check if this is a fresh database requiring initial seeding
  if (!skipAutoSeed) {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM users');
      if (rows && rows[0] && rows[0].cnt === 0) {
        console.log('[Database] Fresh database detected (0 users). Auto-seeding initial synthetic clinical data...');
        await runSeed({ pool, exitOnComplete: false });
        console.log('[Database] Auto-seeding completed successfully.');
      }
    } catch (err) {
      console.warn('[Database] Seed check warning:', err.message);
    }
  }

  console.log(`[Database] MySQL connected and tables verified on ${config.database}`);
  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDb() first.');
  }
  return pool;
}
