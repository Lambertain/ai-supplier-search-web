import { testConnection } from '../db/client.js';
import { emailQueue, getQueueHealth } from '../queues/emailQueue.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get application version from package.json
 * @returns {string} Application version
 */
function getAppVersion() {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

/**
 * Check database health
 * @returns {Promise<Object>} Database health status
 */
async function checkDatabase() {
  try {
    await testConnection();
    return {
      status: 'healthy',
      message: 'Database connection successful',
      responseTime: 'OK'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      error: error.message
    };
  }
}

/**
 * Check Redis/Bull Queue health
 * @returns {Promise<Object>} Redis health status
 */
async function checkRedis() {
  // Skip Redis check if REDIS_URL is not configured
  if (!process.env.REDIS_URL && !process.env.REDIS_TLS_URL) {
    return {
      status: 'skipped',
      message: 'Redis not configured (optional service)'
    };
  }

  try {
    const queueHealth = await getQueueHealth();
    return {
      status: 'healthy',
      message: 'Redis/Queue connection successful',
      queueStatus: queueHealth.status,
      jobCounts: queueHealth.counts
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Redis/Queue connection failed',
      error: error.message
    };
  }
}

/**
 * Get overall system health
 * @returns {Promise<Object>} Complete health check results
 */
export async function getSystemHealth() {
  const startTime = Date.now();

  const [database, redis] = await Promise.allSettled([
    checkDatabase(),
    checkRedis()
  ]);

  const dbHealth = database.status === 'fulfilled' ? database.value : { status: 'unhealthy', error: database.reason?.message };
  const redisHealth = redis.status === 'fulfilled' ? redis.value : { status: 'unhealthy', error: redis.reason?.message };

  // System is healthy if database is healthy and Redis is either healthy or skipped
  const isHealthy = dbHealth.status === 'healthy' && (redisHealth.status === 'healthy' || redisHealth.status === 'skipped');
  const responseTime = Date.now() - startTime;

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    version: getAppVersion(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    checks: {
      database: dbHealth,
      redis: redisHealth
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: {
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
      }
    }
  };
}
