import pRetry, { AbortError } from 'p-retry';

/**
 * Retry configuration for different services
 */
export const RETRY_CONFIG = {
  openai: {
    retries: 3,
    minTimeout: 1000,  // 1 second
    maxTimeout: 4000,  // 4 seconds
    factor: 2,         // exponential backoff
    onFailedAttempt: (error) => {
      console.log(
        `OpenAI API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
        `Error: ${error.message}`
      );
    }
  },
  sendgrid: {
    retries: 3,
    minTimeout: 1000,  // 1 second
    maxTimeout: 4000,  // 4 seconds
    factor: 2,         // exponential backoff
    onFailedAttempt: (error) => {
      console.log(
        `SendGrid API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
        `Error: ${error.message}`
      );
    }
  }
};

/**
 * Determines if error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error should trigger a retry
 */
function isRetryableError(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // Rate limit errors (429)
  if (error.status === 429) {
    return true;
  }

  // Server errors (500-599)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Temporary unavailable (503)
  if (error.status === 503) {
    return true;
  }

  return false;
}

/**
 * Wraps an async function with retry logic
 * @param {Function} fn - Async function to wrap
 * @param {Object} config - Retry configuration
 * @returns {Function} - Wrapped function with retry logic
 */
export function withRetry(fn, config = RETRY_CONFIG.openai) {
  return async (...args) => {
    return pRetry(
      async () => {
        try {
          return await fn(...args);
        } catch (error) {
          // If error is not retryable, throw AbortError to stop retrying
          if (!isRetryableError(error)) {
            throw new AbortError(error.message);
          }
          throw error;
        }
      },
      config
    );
  };
}

/**
 * Wraps OpenAI API calls with retry logic
 * @param {Function} fn - OpenAI API function
 * @returns {Function} - Wrapped function
 */
export function withOpenAIRetry(fn) {
  return withRetry(fn, RETRY_CONFIG.openai);
}

/**
 * Wraps SendGrid API calls with retry logic
 * @param {Function} fn - SendGrid API function
 * @returns {Function} - Wrapped function
 */
export function withSendGridRetry(fn) {
  return withRetry(fn, RETRY_CONFIG.sendgrid);
}
