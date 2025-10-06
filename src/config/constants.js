/**
 * Централізовані константи для OpenAI API та інших налаштувань
 */

export const OPENAI_MODELS = {
  SEARCH: 'gpt-4o',
  EMAIL: 'gpt-4o-mini',
  RESPONSE: 'gpt-4o-mini'
};

export const MAX_TOKENS = {
  SEARCH: 4000,
  EMAIL: 600,
  RESPONSE: 700
};

export const TEMPERATURE = {
  SEARCH: 0.1,
  EMAIL: 0.3,
  RESPONSE: 0.3
};

export const RATE_LIMITS = {
  EMAIL: {
    PER_MINUTE: 10,
    PER_HOUR: 100,
    BURST_SIZE: 5
  }
};

export const DAILY_LIMITS = {
  NEW_SENDER: {
    DAILY_LIMIT: 200,
    WARMUP_DAYS: 14
  },
  ESTABLISHED: {
    DAILY_LIMIT: 1000
  }
};
