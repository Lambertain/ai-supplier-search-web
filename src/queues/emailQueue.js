import Queue from 'bull';
import { sendTransactionalEmail } from '../services/sendgridService.js';
import { updateSupplier } from '../storage/searchStore.js';
import { recordEmail } from '../utils/metrics.js';

// Email sending limits to avoid spam filters
const EMAIL_LIMITS = {
  // Daily limits based on email reputation
  NEW_SENDER: {
    dailyLimit: 200,        // First 2 weeks
    warmupDays: 14,
    description: 'New sender warm-up period'
  },
  ESTABLISHED: {
    dailyLimit: 1000,       // After warm-up
    description: 'Established sender'
  },
  // Rate limiting to avoid spam triggers
  RATE_LIMIT: {
    perHour: 100,           // Max 100 emails per hour
    perMinute: 10,          // Max 10 emails per minute
    burstSize: 5            // Max 5 emails in quick succession
  }
};

/**
 * Calculate current daily limit based on account age
 * @param {Date} accountCreatedAt - When the sender account was created
 * @returns {number} - Current daily email limit
 */
function calculateDailyLimit(accountCreatedAt = new Date()) {
  const daysSinceCreation = Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceCreation < EMAIL_LIMITS.NEW_SENDER.warmupDays) {
    // Gradual ramp-up during warm-up period
    const dailyIncrease = (EMAIL_LIMITS.ESTABLISHED.dailyLimit - EMAIL_LIMITS.NEW_SENDER.dailyLimit) / EMAIL_LIMITS.NEW_SENDER.warmupDays;
    return Math.floor(EMAIL_LIMITS.NEW_SENDER.dailyLimit + (dailyIncrease * daysSinceCreation));
  }

  return EMAIL_LIMITS.ESTABLISHED.dailyLimit;
}

/**
 * Get Redis connection config from environment
 */
function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

  if (redisUrl) {
    // Parse Redis URL for connection
    return redisUrl;
  }

  // Default local Redis
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0')
  };
}

// Create email queue with Redis connection
export const emailQueue = new Queue('email-sending', getRedisConfig(), {
  defaultJobOptions: {
    attempts: 3,                    // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000                   // Start with 2s, then 4s, 8s
    },
    removeOnComplete: true,         // Clean up completed jobs
    removeOnFail: false             // Keep failed jobs for debugging
  },
  limiter: {
    max: EMAIL_LIMITS.RATE_LIMIT.perMinute,      // Max 10 jobs per minute
    duration: 60000,                               // 1 minute window
    bounceBack: true                               // Retry when rate limited
  }
});

/**
 * Process email sending jobs
 */
emailQueue.process(async (job) => {
  const { prepared, searchId, supplierId } = job.data;

  console.log(`[EmailQueue] Processing email job for supplier ${supplierId} (search: ${searchId})`);

  try {
    // Send email via SendGrid
    const result = await sendTransactionalEmail(prepared, process.env.SENDGRID_API_KEY);

    console.log(`[EmailQueue] Email sent successfully to ${prepared.metadata.supplierInfo.email}`);

    // Update supplier status to 'Email Sent via SendGrid'
    await updateSupplier(searchId, supplierId, (current) => ({
      ...current,
      status: 'Email Sent via SendGrid',
      emails_sent: (current.emails_sent || 0) + 1,
      last_contact: new Date().toISOString(),
      conversation_history: [
        ...(current.conversation_history || []),
        {
          direction: 'outbound',
          subject: prepared.metadata.emailSubject,
          body: prepared.metadata.emailBody,
          provider: 'sendgrid',
          sent_at: new Date().toISOString(),
          message_id: result.headers?.['x-message-id'] || result.headers?.['X-Message-Id'] || 'unknown'
        }
      ]
    }));

    // Record successful email send in metrics
    recordEmail('sent');

    return {
      success: true,
      supplierId,
      emailStatus: result.status,
      sentAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[EmailQueue] Failed to send email to supplier ${supplierId}:`, error.message);

    // Update supplier status to 'Email Failed'
    await updateSupplier(searchId, supplierId, (current) => ({
      ...current,
      status: 'Email Failed',
      notes: [current.notes, `Send failed: ${error.message}`].filter(Boolean).join('\n')
    }));

    // Record failed email in metrics
    recordEmail('failed');

    throw error; // Let Bull handle retry logic
  }
});

/**
 * Event handlers for monitoring
 */
emailQueue.on('completed', (job, result) => {
  console.log(`[EmailQueue] Job ${job.id} completed:`, result);
});

emailQueue.on('failed', (job, error) => {
  console.error(`[EmailQueue] Job ${job.id} failed after ${job.attemptsMade} attempts:`, error.message);
});

emailQueue.on('stalled', (job) => {
  console.warn(`[EmailQueue] Job ${job.id} has stalled and will be retried`);
});

/**
 * Get daily email stats from queue
 * @returns {Promise<Object>} - Email stats for today
 */
export async function getDailyEmailStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  const completed = await emailQueue.getCompleted();
  const todayCompleted = completed.filter(job => job.finishedOn >= todayTimestamp);

  const failed = await emailQueue.getFailed();
  const todayFailed = failed.filter(job => job.finishedOn >= todayTimestamp);

  return {
    sent: todayCompleted.length,
    failed: todayFailed.length,
    total: todayCompleted.length + todayFailed.length,
    dailyLimit: calculateDailyLimit(),
    remaining: Math.max(0, calculateDailyLimit() - (todayCompleted.length + todayFailed.length))
  };
}

/**
 * Check if daily limit has been reached
 * @returns {Promise<boolean>} - True if limit reached
 */
export async function isDailyLimitReached() {
  const stats = await getDailyEmailStats();
  return stats.total >= stats.dailyLimit;
}

/**
 * Add email to queue with daily limit check
 * @param {Object} emailData - Email data { prepared, searchId, supplierId }
 * @returns {Promise<Object>} - Job object or error
 */
export async function queueEmail(emailData) {
  // Check daily limit
  if (await isDailyLimitReached()) {
    const stats = await getDailyEmailStats();
    throw new Error(`Daily email limit reached (${stats.total}/${stats.dailyLimit}). Try again tomorrow.`);
  }

  // Add to queue
  const job = await emailQueue.add(emailData, {
    priority: emailData.priority || 3  // Default medium priority
  });

  console.log(`[EmailQueue] Email queued for supplier ${emailData.supplierId} (job: ${job.id})`);

  return job;
}

/**
 * Get queue status and health
 * @returns {Promise<Object>} - Queue health status
 */
export async function getQueueHealth() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount()
  ]);

  const stats = await getDailyEmailStats();

  return {
    status: 'healthy',
    counts: {
      waiting,
      active,
      completed,
      failed,
      delayed
    },
    daily: stats,
    limits: {
      perMinute: EMAIL_LIMITS.RATE_LIMIT.perMinute,
      perHour: EMAIL_LIMITS.RATE_LIMIT.perHour,
      perDay: stats.dailyLimit
    }
  };
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[EmailQueue] Shutting down gracefully...');
  await emailQueue.close();
});
