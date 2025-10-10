import { runMigrations as runMigrationsFromRunner, getMigrationStatus } from './migrate.js';
import { testConnection } from './client.js';
import logger from '../utils/logger.js';

/**
 * Run database migrations on application startup
 * This is the main entry point called from server.js
 * @returns {Promise<void>}
 */
export async function runMigrations() {
  logger.info('[migrations] Initializing database...');

  try {
    await testConnection();

    logger.info('[migrations] Running schema migrations...');
    const appliedCount = await runMigrationsFromRunner();

    if (appliedCount > 0) {
      logger.info('[migrations] Applied new migrations', { appliedCount });
    }

    const status = await getMigrationStatus();
    logger.info('[migrations] Migration status', {
      total: status.total,
      applied: status.applied,
      pending: status.pending
    });

    logger.info('[migrations] Database initialization complete');
  } catch (error) {
    logger.error('[migrations] Database initialization failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
