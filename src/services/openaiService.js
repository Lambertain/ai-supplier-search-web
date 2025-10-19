import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripCodeFences } from './textHelpers.js';
import { withOpenAIRetry } from '../utils/retryHelper.js';
import { ERROR_MESSAGES } from '../utils/messages.js';
import pLimit from 'p-limit';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.resolve(__dirname, '../../logs');


// Rate limiter: РјР°РєСЃРёРјСѓРј 5 РѕРґРЅРѕРІСЂРµРјРµРЅРЅС‹С… Р·Р°РїСЂРѕСЃРѕРІ Рє OpenAI API
// Р­С‚Рѕ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РїРµСЂРµРіСЂСѓР·РєСѓ API Рё СѓР»СѓС‡С€Р°РµС‚ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ
const openAILimiter = pLimit(5);



function ensureApiKey(provided) {
  const apiKey = provided || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.OPENAI_KEY_MISSING);
  }
  return apiKey;
}

async function callOpenAI(body, signal, apiKeyOverride, timeoutMs = 60000) {
  const apiKey = ensureApiKey(apiKeyOverride);

  // Log request details
  console.log('[OpenAI] Sending request:', {
    model: body.model,
    hasWebSearch: Boolean(body.web_search_options),
    messageCount: body.messages?.length,
    timeout: timeoutMs
  });

  // Rate-limited execution: РјР°РєСЃРёРјСѓРј 5 РѕРґРЅРѕРІСЂРµРјРµРЅРЅС‹С… Р·Р°РїСЂРѕСЃРѕРІ
  return openAILimiter(async () => {
    // Create timeout controller if no signal provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('[OpenAI] Request timeout after', timeoutMs, 'ms');
    }, timeoutMs);

    try {
      const response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: signal || controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      // Log response details
      console.log('[OpenAI] Response received:', {
        status: response.status,
        ok: response.ok,
        hasError: Boolean(data.error),
        errorMessage: data.error?.message
      });

      if (!response.ok) {
        console.error('[OpenAI] API Error:', {
          status: response.status,
          errorType: data.error?.type,
          errorCode: data.error?.code,
          errorMessage: data.error?.message,
          fullError: JSON.stringify(data, null, 2)
        });
        const err = new Error(data.error?.message || 'OpenAI API request failed');
        err.status = response.status;
        err.payload = data;
        throw err;
      }
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout errors
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`OpenAI request timeout after ${timeoutMs}ms`);
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }

      throw error;
    }
  });
}

export const chatCompletionJson = withOpenAIRetry(async function chatCompletionJsonInternal({
  model,
  messages,
  temperature = 0.1,
  maxTokens = 2000,
  responseFormat = { type: 'json_object' },
  signal,
  apiKey
}) {
  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat
  };

  const result = await callOpenAI(payload, signal, apiKey);
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not contain message content');
  }
  const normalized = stripCodeFences(content);
  const cleaned = trimTrailingNonJson(normalized);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const balancedObject = findBalancedJsonSegment(cleaned, '{', '}');
    if (balancedObject) {
      try {
        return JSON.parse(trimTrailingNonJson(balancedObject));
      } catch (innerError) {
        console.warn('[OpenAI] Secondary JSON parse attempt failed:', innerError.message);
      }
    }
    const err = new Error('Failed to parse JSON from OpenAI response');
    err.raw = cleaned;
    throw err;
  }
});

export const chatCompletionText = withOpenAIRetry(async function chatCompletionTextInternal({
  model,
  messages,
  temperature = 0.3,
  maxTokens = 800,
  signal,
  apiKey
}) {
  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  const result = await callOpenAI(payload, signal, apiKey);
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not contain message content');
  }
  return stripCodeFences(content);
});

/**
 * Chat completion with web search capability
 * Uses OpenAI's gpt-4o-search-preview model with web_search_options to find REAL suppliers from the internet
 * Note: gpt-4o-search-preview does not support temperature or response_format parameters with web_search
 */
export const chatCompletionWithWebSearch = withOpenAIRetry(async function chatCompletionWithWebSearchInternal({
  messages,
  searchContextSize = 'medium',
  maxTokens = 4000,
  signal,
  apiKey
}) {
  const payload = {
    model: 'gpt-4o-search-preview',
    messages,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }, // Enforce JSON mode
    web_search_options: {
      search_context_size: searchContextSize
    }
  };

  const result = await callOpenAI(payload, signal, apiKey);
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not contain message content');
  }

  // Directly parse the JSON content since we are enforcing JSON mode
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('[OpenAI] JSON parsing failed even with JSON mode enforced:', {
      error: error.message,
      content: content.substring(0, 500)
    });
    const err = new Error('Failed to parse JSON from OpenAI response (JSON mode was active)');
    err.raw = content;
    throw err;
  }
});

export async function listAvailableModels(apiKeyOverride) {
  const apiKey = ensureApiKey(apiKeyOverride);
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || 'Failed to fetch OpenAI models');
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  // Filter to only chat completion models (gpt-* models)
  const chatModels = data.data
    .filter(model => model.id.startsWith('gpt-'))
    .map(model => ({
      id: model.id,
      created: model.created,
      owned_by: model.owned_by
    }))
    .sort((a, b) => b.created - a.created); // Sort by newest first

  return chatModels;
}









