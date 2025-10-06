import { stripCodeFences } from './textHelpers.js';
import { withOpenAIRetry } from '../utils/retryHelper.js';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function ensureApiKey(provided) {
  const apiKey = provided || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API ключ не налаштований. Додайте його у налаштуваннях або через змінну середовища.');
  }
  return apiKey;
}

async function callOpenAI(body, signal, apiKeyOverride) {
  const apiKey = ensureApiKey(apiKeyOverride);
  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || 'OpenAI API request failed');
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
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
  try {
    return JSON.parse(normalized);
  } catch (error) {
    const err = new Error('Failed to parse JSON from OpenAI response');
    err.raw = normalized;
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
