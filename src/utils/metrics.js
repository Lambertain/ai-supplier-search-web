import { query } from '../db/client.js';
import { getQueueHealth, getDailyEmailStats } from '../queues/emailQueue.js';
import logger from './logger.js';

/**
 * In-memory metrics storage
 * Tracks API requests and errors since server start
 */
const metrics = {
  requests: {
    total: 0,
    byEndpoint: {},
    errors: 0,
    byStatus: {}
  },
  searches: {
    total: 0,
    inProgress: 0,
    completed: 0,
    failed: 0
  },
  emails: {
    queued: 0,
    sent: 0,
    failed: 0
  },
  startTime: Date.now()
};

/**
 * Increment request counter
 * @param {string} endpoint - API endpoint path
 * @param {number} statusCode - HTTP status code
 */
export function recordRequest(endpoint, statusCode) {
  metrics.requests.total++;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;
  metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;

  if (statusCode >= 400) {
    metrics.requests.errors++;
  }
}

/**
 * Record search execution
 * @param {string} status - Search status (completed/failed)
 */
export function recordSearch(status) {
  metrics.searches.total++;
  if (status === 'completed') {
    metrics.searches.completed++;
  } else if (status === 'failed') {
    metrics.searches.failed++;
  }
}

/**
 * Record email operation
 * @param {string} status - Email status (queued/sent/failed)
 */
export function recordEmail(status) {
  if (status === 'queued') {
    metrics.emails.queued++;
  } else if (status === 'sent') {
    metrics.emails.sent++;
  } else if (status === 'failed') {
    metrics.emails.failed++;
  }
}

/**
 * Get database metrics
 * @returns {Promise<Object>} Database statistics
 */
async function getDatabaseMetrics() {
  try {
    const searchesResult = await query('SELECT COUNT(*) as count FROM searches');
    const suppliersResult = await query('SELECT COUNT(*) as count FROM suppliers');
    const emailsSentResult = await query('SELECT COUNT(*) as count FROM email_sends WHERE status = $1', ['sent']);

    return {
      totalSearches: parseInt(searchesResult.rows[0]?.count || 0),
      totalSuppliers: parseInt(suppliersResult.rows[0]?.count || 0),
      totalEmailsSent: parseInt(emailsSentResult.rows[0]?.count || 0)
    };
  } catch (error) {
    logger.error('[Metrics] Error fetching database metrics', { error: error.message, stack: error.stack });
    return {
      totalSearches: 0,
      totalSuppliers: 0,
      totalEmailsSent: 0,
      error: error.message
    };
  }
}

/**
 * Get complete application metrics
 * @returns {Promise<Object>} All metrics
 */
export async function getMetrics() {
  const [dbMetrics, queueHealth, dailyEmailStats] = await Promise.allSettled([
    getDatabaseMetrics(),
    getQueueHealth(),
    getDailyEmailStats()
  ]);

  const db = dbMetrics.status === 'fulfilled' ? dbMetrics.value : { error: dbMetrics.reason?.message };
  const queue = queueHealth.status === 'fulfilled' ? queueHealth.value : { error: queueHealth.reason?.message };
  const dailyEmails = dailyEmailStats.status === 'fulfilled' ? dailyEmailStats.value : { error: dailyEmailStats.reason?.message };

  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const uptimeFormatted = formatUptime(uptimeSeconds);

  return {
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSeconds,
      formatted: uptimeFormatted
    },
    requests: {
      total: metrics.requests.total,
      errors: metrics.requests.errors,
      errorRate: metrics.requests.total > 0
        ? `${((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2)}%`
        : '0%',
      byEndpoint: metrics.requests.byEndpoint,
      byStatus: metrics.requests.byStatus
    },
    searches: {
      runtime: metrics.searches,
      database: {
        total: db.totalSearches || 0
      }
    },
    emails: {
      runtime: metrics.emails,
      database: {
        totalSent: db.totalEmailsSent || 0
      },
      daily: {
        sent: dailyEmails.sent || 0,
        failed: dailyEmails.failed || 0,
        total: dailyEmails.total || 0,
        limit: dailyEmails.dailyLimit || 0,
        remaining: dailyEmails.remaining || 0,
        limitReached: dailyEmails.total >= dailyEmails.dailyLimit
      }
    },
    queue: queue.counts ? {
      waiting: queue.counts.waiting,
      active: queue.counts.active,
      completed: queue.counts.completed,
      failed: queue.counts.failed,
      delayed: queue.counts.delayed,
      limits: queue.limits
    } : { error: queue.error },
    database: {
      suppliers: db.totalSuppliers || 0,
      searches: db.totalSearches || 0,
      emailsSent: db.totalEmailsSent || 0
    },
    system: {
      memory: {
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
      },
      cpu: {
        usage: process.cpuUsage()
      }
    }
  };
}

/**
 * Format uptime in human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Reset runtime metrics (useful for testing)
 */
export function resetMetrics() {
  metrics.requests.total = 0;
  metrics.requests.byEndpoint = {};
  metrics.requests.errors = 0;
  metrics.requests.byStatus = {};
  metrics.searches.total = 0;
  metrics.searches.inProgress = 0;
  metrics.searches.completed = 0;
  metrics.searches.failed = 0;
  metrics.emails.queued = 0;
  metrics.emails.sent = 0;
  metrics.emails.failed = 0;
  metrics.startTime = Date.now();
}
