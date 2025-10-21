import { ERROR_MESSAGES } from '../utils/messages.js';
import pLimit from 'p-limit';

const GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

// Rate limiter: максимум 3 одновременных запроса к Google Search API
// Google Free Tier: 100 queries/day, Paid: up to 10k queries/day
const googleSearchLimiter = pLimit(3);

/**
 * Ensure Google API credentials are available
 * @param {string} apiKey - Optional API key override
 * @param {string} searchEngineId - Optional Search Engine ID override
 * @returns {Object} Validated credentials
 */
function ensureGoogleCredentials(apiKey, searchEngineId) {
  const finalApiKey = apiKey || process.env.GOOGLE_API_KEY;
  const finalSearchEngineId = searchEngineId || process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!finalApiKey) {
    throw new Error(ERROR_MESSAGES.GOOGLE_API_KEY_MISSING || 'Google API key is missing');
  }

  if (!finalSearchEngineId) {
    throw new Error(ERROR_MESSAGES.GOOGLE_SEARCH_ENGINE_ID_MISSING || 'Google Search Engine ID is missing');
  }

  return { apiKey: finalApiKey, searchEngineId: finalSearchEngineId };
}

/**
 * Call Google Custom Search JSON API
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {number} params.num - Number of results (1-10, default: 10)
 * @param {number} params.start - Starting index (1-based, default: 1)
 * @param {string} params.apiKey - Optional API key override
 * @param {string} params.searchEngineId - Optional Search Engine ID override
 * @param {AbortSignal} params.signal - Optional abort signal
 * @returns {Promise<Object>} Google Search API response
 */
async function callGoogleSearchAPI({ query, num = 10, start = 1, apiKey, searchEngineId, signal }) {
  const credentials = ensureGoogleCredentials(apiKey, searchEngineId);

  const url = new URL(GOOGLE_SEARCH_ENDPOINT);
  url.searchParams.append('key', credentials.apiKey);
  url.searchParams.append('cx', credentials.searchEngineId);
  url.searchParams.append('q', query);
  url.searchParams.append('num', Math.min(num, 10)); // Max 10 per request
  url.searchParams.append('start', start);

  console.log('[GoogleSearch] Sending request:', {
    query: query.substring(0, 100),
    num,
    start,
    endpoint: GOOGLE_SEARCH_ENDPOINT
  });

  return googleSearchLimiter(async () => {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal
      });

      const data = await response.json();

      console.log('[GoogleSearch] Response received:', {
        status: response.status,
        ok: response.ok,
        hasError: Boolean(data.error),
        resultCount: data.items?.length || 0
      });

      if (!response.ok) {
        console.error('[GoogleSearch] API Error:', {
          status: response.status,
          errorMessage: data.error?.message,
          errorCode: data.error?.code,
          fullError: JSON.stringify(data, null, 2)
        });
        const err = new Error(data.error?.message || 'Google Search API request failed');
        err.status = response.status;
        err.payload = data;
        throw err;
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        const abortError = new Error('Google Search request was aborted');
        abortError.code = 'ABORT';
        throw abortError;
      }
      throw error;
    }
  });
}

/**
 * Search for suppliers using Google Custom Search API
 * Returns structured search results with company information
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query for suppliers
 * @param {number} params.maxResults - Maximum number of results (default: 10, max: 30)
 * @param {string} params.apiKey - Optional API key override
 * @param {string} params.searchEngineId - Optional Search Engine ID override
 * @param {AbortSignal} params.signal - Optional abort signal
 * @returns {Promise<Array>} Array of search results with title, link, snippet
 */
export async function searchSuppliers({ query, maxResults = 10, apiKey, searchEngineId, signal }) {
  try {
    const results = [];
    const requestedResults = Math.min(maxResults, 30); // Cap at 30 total results
    const numPerRequest = 10; // Google max per request

    // Calculate how many requests we need (max 3 requests for 30 results)
    const numRequests = Math.ceil(requestedResults / numPerRequest);

    console.log('[GoogleSearch] Searching suppliers:', {
      query: query.substring(0, 100),
      requestedResults,
      numRequests
    });

    for (let i = 0; i < numRequests; i++) {
      const start = i * numPerRequest + 1; // 1-based indexing
      const num = Math.min(numPerRequest, requestedResults - results.length);

      const response = await callGoogleSearchAPI({
        query,
        num,
        start,
        apiKey,
        searchEngineId,
        signal
      });

      if (response.items && Array.isArray(response.items)) {
        // Extract relevant information from search results
        const processedItems = response.items.map(item => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          displayLink: item.displayLink,
          formattedUrl: item.formattedUrl,
          // Optional: include structured data if available
          pagemap: item.pagemap
        }));

        results.push(...processedItems);
      }

      // Stop if we got fewer results than requested (no more results available)
      if (!response.items || response.items.length < num) {
        break;
      }
    }

    console.log('[GoogleSearch] Search completed:', {
      totalResults: results.length,
      requestedResults
    });

    return results;
  } catch (error) {
    console.error('[GoogleSearch] Search failed:', {
      error: error.message,
      query: query.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Test Google Search API connectivity and credentials
 * @param {string} apiKey - Optional API key override
 * @param {string} searchEngineId - Optional Search Engine ID override
 * @returns {Promise<boolean>} True if credentials are valid
 */
export async function testGoogleSearchAPI(apiKey, searchEngineId) {
  try {
    const response = await callGoogleSearchAPI({
      query: 'test',
      num: 1,
      start: 1,
      apiKey,
      searchEngineId
    });

    return Boolean(response.items);
  } catch (error) {
    console.error('[GoogleSearch] Credentials test failed:', error.message);
    return false;
  }
}
