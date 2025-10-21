/**
 * Centralized error messages and user-facing text
 * Internal logs should be in English
 * User-facing messages can be localized
 */

// API Error Messages (user-facing, can be localized)
export const ERROR_MESSAGES = {
  OPENAI_KEY_MISSING: 'OpenAI API key is not configured. Add it in settings or via environment variable.',
  SENDGRID_KEY_MISSING: 'SendGrid API key is not configured. Add it in settings or via environment variable.',
  GOOGLE_API_KEY_MISSING: 'Google API key is not configured. Add GOOGLE_API_KEY in settings or via environment variable.',
  GOOGLE_SEARCH_ENGINE_ID_MISSING: 'Google Search Engine ID is not configured. Add GOOGLE_SEARCH_ENGINE_ID in settings or via environment variable.',
  DAILY_LIMIT_REACHED: 'Daily email limit reached. Try again tomorrow.',
  INVALID_REQUEST: 'Invalid request parameters'
};

// Internal log messages (always English for consistency)
export const LOG_MESSAGES = {
  SEARCH_INITIALIZED: 'Search initialized',
  SEARCH_COMPLETED: 'Search completed',
  SUPPLIERS_VALIDATED: (count) => `Validated ${count} suppliers`,
  EMAIL_QUEUED: (companyName) => `Email queued for ${companyName}`,
  EMAIL_SENT: (companyName) => `Email sent to ${companyName}`,
  EMAIL_FAILED: (companyName) => `Failed to email ${companyName}`,
  DAILY_LIMIT_WARNING: (limit, sent) => `Daily limit ${limit} reached (sent: ${sent})`,
  RATE_LIMIT_WAIT: (seconds) => `Waiting ${seconds}s before next send (rate limiting)`,
  SUMMARY_EMAIL_FAILED: 'Failed to send summary email'
};

// Settings recommendations (user-facing)
export const RECOMMENDATIONS = {
  SENDGRID_POLICY: 'Use a professional domain, alternate email subjects, and do not exceed the daily limit.'
};
