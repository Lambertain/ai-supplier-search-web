/**
 * Website validation utilities
 * Validates that supplier websites are real and accessible
 */

import { normalizeWebsite } from './validation.js';

/**
 * Check if a website is accessible via HTTP(S)
 * @param {string} url - Website URL to check
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<{accessible: boolean, status: number|null, error: string|null}>}
 */
export async function checkWebsiteAccessibility(url, timeout = 10000) {
  if (!url || url.trim() === '') {
    return {
      accessible: false,
      status: null,
      error: 'Empty URL provided'
    };
  }

  const normalized = normalizeWebsite(url);
  if (!normalized) {
    return {
      accessible: false,
      status: null,
      error: 'Invalid URL format'
    };
  }

  // Ensure URL has protocol
  let fullUrl = normalized;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    // Try HTTPS first (more common for business websites)
    fullUrl = `https://${fullUrl}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(fullUrl, {
      method: 'HEAD', // Use HEAD to avoid downloading full page
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SupplierSearchBot/1.0)'
      },
      // Don't follow too many redirects
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    // Accept 2xx and 3xx status codes as accessible
    // Some sites return 403/401 for HEAD requests but are still valid
    const accessible = response.status < 400 || response.status === 403 || response.status === 401;

    return {
      accessible,
      status: response.status,
      error: accessible ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // If HTTPS failed, try HTTP as fallback
    if (fullUrl.startsWith('https://')) {
      const httpUrl = fullUrl.replace('https://', 'http://');
      try {
        const fallbackResponse = await fetch(httpUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SupplierSearchBot/1.0)'
          },
          redirect: 'follow'
        });

        const accessible = fallbackResponse.status < 400 || fallbackResponse.status === 403 || fallbackResponse.status === 401;

        return {
          accessible,
          status: fallbackResponse.status,
          error: accessible ? null : `HTTP ${fallbackResponse.status}`
        };
      } catch (fallbackError) {
        // Both HTTPS and HTTP failed
        return {
          accessible: false,
          status: null,
          error: error.name === 'AbortError' ? 'Timeout' : error.message
        };
      }
    }

    return {
      accessible: false,
      status: null,
      error: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

/**
 * Batch validate multiple websites with concurrency control
 * @param {Array<{website: string, company_name: string}>} suppliers - Array of suppliers with website
 * @param {number} concurrency - Maximum concurrent requests (default: 5)
 * @returns {Promise<Array<{website: string, company_name: string, validation: object}>>}
 */
export async function validateSupplierWebsites(suppliers, concurrency = 5) {
  const results = [];
  const queue = [...suppliers];

  // Process websites in batches to avoid overwhelming the network
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchResults = await Promise.all(
      batch.map(async (supplier) => {
        const validation = await checkWebsiteAccessibility(supplier.website);
        return {
          ...supplier,
          validation
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Filter suppliers by website accessibility
 * @param {Array<object>} suppliers - Array of supplier objects with website field
 * @param {boolean} requireAccessible - If true, only return suppliers with accessible websites
 * @returns {Promise<{valid: Array<object>, invalid: Array<object>}>}
 */
export async function filterSuppliersByWebsite(suppliers, requireAccessible = true) {
  console.log(`[WebsiteValidator] Validating ${suppliers.length} supplier websites...`);

  const validationResults = await validateSupplierWebsites(suppliers);

  const valid = [];
  const invalid = [];

  for (const result of validationResults) {
    if (requireAccessible && !result.validation.accessible) {
      console.warn(`[WebsiteValidator] REJECTED: ${result.company_name} - Website not accessible: ${result.website} (${result.validation.error})`);
      invalid.push(result);
    } else {
      console.log(`[WebsiteValidator] ACCEPTED: ${result.company_name} - Website accessible: ${result.website} (HTTP ${result.validation.status})`);
      valid.push(result);
    }
  }

  console.log(`[WebsiteValidator] Results: ${valid.length} valid, ${invalid.length} invalid`);

  return { valid, invalid };
}
