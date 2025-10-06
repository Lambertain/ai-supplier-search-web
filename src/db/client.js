import pg from 'pg';
import { newDb } from 'pg-mem';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
let pool;

if (connectionString) {
  const sslOption = process.env.PGSSL === 'false'
    ? false
    : (process.env.PGSSL || connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined);

  pool = new Pool({
    connectionString,
    ssl: sslOption
  });
} else {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool: MemPool } = db.adapters.createPg();
  pool = new MemPool();
  console.warn('[db] DATABASE_URL is not set. Using in-memory pg-mem database for this session. Data will be lost after restart.');
}

export { pool };

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
