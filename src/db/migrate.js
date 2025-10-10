import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './client.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create migrations tracking table
 * Tracks which migrations have been applied to prevent duplicate runs
 */
async function createMigrationsTable() {
  const client = await pool.connect();
  try {
    // Simplified SQL for pg-mem compatibility - removed constraints that pg-mem doesn't support
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL,
        version VARCHAR(255),
        filename VARCHAR(500),
        applied_at TIMESTAMP
      );
    `);
    logger.info('[migrate] Migrations tracking table ready');
  } catch (error) {
    logger.error('[migrate] Failed to create migrations table', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get list of applied migrations from database
 * @returns {Promise<Set<string>>} Set of applied migration filenames
 */
async function getAppliedMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT filename FROM schema_migrations ORDER BY applied_at');
    const applied = new Set(result.rows.map(row => row.filename));
    logger.info('[migrate] Found applied migrations', { count: applied.size });
    return applied;
  } catch (error) {
    logger.error('[migrate] Failed to get applied migrations', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get list of migration files from migrations directory
 * @returns {Promise<Array<string>>} Sorted array of migration filenames
 */
async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');

  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info('[migrate] Found migration files', { count: sqlFiles.length });
    return sqlFiles;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('[migrate] Migrations directory not found', { migrationsDir });
      return [];
    }
    throw error;
  }
}

/**
 * Apply a single migration file
 * @param {string} filename - Migration filename
 * @returns {Promise<void>}
 */
async function applyMigration(filename) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const filepath = path.join(migrationsDir, filename);

  logger.info('[migrate] Applying migration', { filename });

  const client = await pool.connect();
  try {
    const sql = await fs.readFile(filepath, 'utf-8');

    await client.query('BEGIN');

    await client.query(sql);

    const version = filename.replace(/\.sql$/, '');
    await client.query(
      'INSERT INTO schema_migrations (version, filename, applied_at) VALUES ($1, $2, $3)',
      [version, filename, new Date()]
    );

    await client.query('COMMIT');

    logger.info('[migrate] Successfully applied migration', { filename });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[migrate] Failed to apply migration', { filename, error: error.message, stack: error.stack });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 * @returns {Promise<number>} Number of migrations applied
 */
export async function runMigrations() {
  logger.info('[migrate] Starting migration process...');

  try {
    await createMigrationsTable();

    const applied = await getAppliedMigrations();
    const allMigrations = await getMigrationFiles();

    const pending = allMigrations.filter(filename => !applied.has(filename));

    if (pending.length === 0) {
      logger.info('[migrate] No pending migrations');
      return 0;
    }

    logger.info('[migrate] Found pending migrations', { count: pending.length });

    for (const filename of pending) {
      await applyMigration(filename);
    }

    logger.info('[migrate] Successfully applied migrations', { count: pending.length });
    return pending.length;
  } catch (error) {
    logger.error('[migrate] Migration process failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Rollback the last applied migration
 * WARNING: This requires manual SQL rollback files
 * @returns {Promise<void>}
 */
export async function rollbackMigration() {
  logger.warn('[migrate] Rollback is not implemented');
  logger.warn('[migrate] Please manually write and execute rollback SQL');
  throw new Error('Rollback not implemented');
}

/**
 * Get migration status
 * @returns {Promise<Object>} Migration status information
 */
export async function getMigrationStatus() {
  try {
    await createMigrationsTable();

    const applied = await getAppliedMigrations();
    const allMigrations = await getMigrationFiles();
    const pending = allMigrations.filter(filename => !applied.has(filename));

    return {
      total: allMigrations.length,
      applied: applied.size,
      pending: pending.length,
      appliedList: Array.from(applied),
      pendingList: pending
    };
  } catch (error) {
    logger.error('[migrate] Failed to get migration status', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * CLI entry point for running migrations manually
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(count => {
      logger.info('[migrate] Migration complete', { appliedCount: count });
      process.exit(0);
    })
    .catch(error => {
      logger.error('[migrate] Migration failed', { error: error.message, stack: error.stack });
      process.exit(1);
    });
}
