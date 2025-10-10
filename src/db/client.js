import pg from 'pg';
import { newDb } from 'pg-mem';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
let pool;

/**
 * Initialize database pool with PostgreSQL or pg-mem fallback
 * Supports both Railway production and local development
 */
if (connectionString) {
  const sslOption = process.env.PGSSL === 'false'
    ? false
    : (process.env.PGSSL || connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined);

  pool = new Pool({
    connectionString,
    ssl: sslOption,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
  });

  logger.info('PostgreSQL pool created', {
    ssl: !!sslOption,
    maxConnections: parseInt(process.env.DB_POOL_MAX || '20', 10)
  });
} else {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool: MemPool } = db.adapters.createPg();
  pool = new MemPool();
  logger.warn('Using in-memory pg-mem database - data will be lost after restart');
}

export { pool };

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connected successfully', {
      timestamp: result.rows[0].now
    });
    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Execute a query with automatic error handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params) {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development' && duration > 100) {
      logger.warn('Slow query detected', {
        queryPreview: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }

    return result;
  } catch (error) {
    logger.error('Database query error', {
      queryPreview: text.substring(0, 200),
      params,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} callback - Async function receiving client as parameter
 * @returns {Promise<*>} Transaction result
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed and rolled back', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a client from the pool for manual transaction control
 * @returns {Promise<Object>} Database client
 */
export async function getClient() {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    logger.error('Failed to get client from pool', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Gracefully close the database pool
 * @returns {Promise<void>}
 */
export async function closePool() {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Handle graceful shutdown on process termination
 */
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database pool');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database pool');
  await closePool();
  process.exit(0);
});
