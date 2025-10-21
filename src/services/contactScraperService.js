import logger from '../utils/logger.js';
import pLimit from 'p-limit';

/**
 * Contact scraper service - extracts contact information from supplier websites
 * Uses HTML fetching + regex patterns to find emails, phones, addresses
 */

// Limit concurrent scraping requests to avoid overwhelming servers
const scrapingLimiter = pLimit(3);

/**
 * Regex patterns for extracting contact information
 */
const CONTACT_PATTERNS = {
  // Email patterns
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone patterns (international formats)
  phone: /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,

  // Common contact page URLs
  contactUrls: /\/(contact|about|contact-us|about-us|contactus|aboutus|reach-us|get-in-touch|inquiry)(\.(html|php|aspx|jsp))?$/i
};

/**
 * Common contact page keywords for finding contact links
 */
const CONTACT_KEYWORDS = [
  'contact',
  'about',
  'contact us',
  'about us',
  'get in touch',
  'reach us',
  'inquiry',
  '联系我们', // Chinese: Contact us
  '关于我们', // Chinese: About us
  'お問い合わせ', // Japanese: Contact
  '문의' // Korean: Inquiry
];

/**
 * Extract emails from text using regex
 * @param {string} text - Text to extract emails from
 * @returns {string[]} Array of unique emails
 */
function extractEmails(text) {
  if (!text) return [];

  const emails = text.match(CONTACT_PATTERNS.email) || [];

  // Filter out common false positives
  const filtered = emails.filter(email => {
    const lower = email.toLowerCase();
    return !lower.includes('example.com') &&
           !lower.includes('test.com') &&
           !lower.includes('wix.com') &&
           !lower.includes('sentry') &&
           !lower.includes('gtag') &&
           !lower.includes('@w.org');
  });

  // Return unique emails
  return [...new Set(filtered)];
}

/**
 * Extract phone numbers from text using regex
 * @param {string} text - Text to extract phones from
 * @returns {string[]} Array of unique phone numbers
 */
function extractPhones(text) {
  if (!text) return [];

  const phones = text.match(CONTACT_PATTERNS.phone) || [];

  // Filter out common false positives (too short, looks like dates, etc)
  const filtered = phones.filter(phone => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 7 && cleaned.length <= 15;
  });

  // Return unique phones
  return [...new Set(filtered)];
}

/**
 * Find contact page URL from HTML content
 * @param {string} html - HTML content of main page
 * @param {string} baseUrl - Base URL of the website
 * @returns {string|null} Contact page URL or null
 */
function findContactPageUrl(html, baseUrl) {
  if (!html) return null;

  try {
    const urlObj = new URL(baseUrl);
    const domain = `${urlObj.protocol}//${urlObj.hostname}`;

    // Extract all links from HTML
    const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
    const links = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      links.push(match[1]);
    }

    // Find contact links by checking href and link text
    for (const link of links) {
      const linkLower = link.toLowerCase();

      // Check if link matches contact URL patterns
      if (CONTACT_PATTERNS.contactUrls.test(linkLower)) {
        // Make absolute URL
        if (link.startsWith('http')) {
          return link;
        } else if (link.startsWith('/')) {
          return domain + link;
        } else {
          return domain + '/' + link;
        }
      }

      // Check if link text contains contact keywords
      for (const keyword of CONTACT_KEYWORDS) {
        if (linkLower.includes(keyword)) {
          // Make absolute URL
          if (link.startsWith('http')) {
            return link;
          } else if (link.startsWith('/')) {
            return domain + link;
          } else {
            return domain + '/' + link;
          }
        }
      }
    }

    // Fallback: try common contact page URLs
    const commonUrls = [
      '/contact',
      '/contact-us',
      '/about',
      '/about-us',
      '/contact.html',
      '/about.html',
      '/en/contact',
      '/en/about'
    ];

    for (const path of commonUrls) {
      return domain + path;
    }

    return null;
  } catch (error) {
    logger.error('[ContactScraper] Error finding contact page URL', {
      error: error.message,
      baseUrl
    });
    return null;
  }
}

/**
 * Fetch HTML content from URL with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<string|null>} HTML content or null
 */
async function fetchHtml(url, timeout = 10000) {
  try {
    logger.debug('[ContactScraper] Fetching HTML', { url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('[ContactScraper] HTTP error', {
        url,
        status: response.status
      });
      return null;
    }

    const html = await response.text();

    logger.debug('[ContactScraper] HTML fetched', {
      url,
      length: html.length
    });

    return html;
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn('[ContactScraper] Fetch timeout', { url });
    } else {
      logger.error('[ContactScraper] Fetch error', {
        url,
        error: error.message
      });
    }
    return null;
  }
}

/**
 * Scrape contact information from a supplier website
 * @param {string} websiteUrl - Supplier website URL
 * @returns {Promise<Object>} Contact information { email, phone, address }
 */
export async function scrapeSupplierContacts(websiteUrl) {
  return scrapingLimiter(async () => {
    try {
      logger.info('[ContactScraper] Scraping contacts', { website: websiteUrl });

      const startTime = Date.now();
      const result = {
        email: '',
        phone: '',
        address: '',
        scrapedAt: new Date().toISOString()
      };

      // Step 1: Fetch main page HTML
      const mainHtml = await fetchHtml(websiteUrl, 10000);

      if (!mainHtml) {
        logger.warn('[ContactScraper] Failed to fetch main page', { website: websiteUrl });
        return result;
      }

      // Step 2: Extract contacts from main page
      const mainEmails = extractEmails(mainHtml);
      const mainPhones = extractPhones(mainHtml);

      if (mainEmails.length > 0) {
        result.email = mainEmails[0]; // Take first valid email
      }

      if (mainPhones.length > 0) {
        result.phone = mainPhones[0]; // Take first valid phone
      }

      // Step 3: Find and scrape contact page if main page doesn't have contacts
      if (!result.email || !result.phone) {
        const contactPageUrl = findContactPageUrl(mainHtml, websiteUrl);

        if (contactPageUrl) {
          logger.debug('[ContactScraper] Found contact page URL', {
            website: websiteUrl,
            contactUrl: contactPageUrl
          });

          const contactHtml = await fetchHtml(contactPageUrl, 10000);

          if (contactHtml) {
            const contactEmails = extractEmails(contactHtml);
            const contactPhones = extractPhones(contactHtml);

            if (!result.email && contactEmails.length > 0) {
              result.email = contactEmails[0];
            }

            if (!result.phone && contactPhones.length > 0) {
              result.phone = contactPhones[0];
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      logger.info('[ContactScraper] Scraping completed', {
        website: websiteUrl,
        hasEmail: Boolean(result.email),
        hasPhone: Boolean(result.phone),
        duration: `${duration}ms`
      });

      return result;
    } catch (error) {
      logger.error('[ContactScraper] Scraping failed', {
        website: websiteUrl,
        error: error.message
      });

      return {
        email: '',
        phone: '',
        address: '',
        scrapedAt: new Date().toISOString()
      };
    }
  });
}

/**
 * Scrape contacts for multiple suppliers in parallel
 * @param {Array<Object>} suppliers - Array of supplier objects with website field
 * @returns {Promise<Array<Object>>} Suppliers with enriched contact information
 */
export async function enrichSuppliersWithContacts(suppliers) {
  logger.info('[ContactScraper] Enriching suppliers with contacts', {
    count: suppliers.length
  });

  const startTime = Date.now();

  const enrichedSuppliers = await Promise.all(
    suppliers.map(async (supplier) => {
      if (!supplier.website) {
        logger.debug('[ContactScraper] Skipping supplier without website', {
          company: supplier.company_name
        });
        return supplier;
      }

      // Skip if already has email and phone
      if (supplier.email && supplier.phone) {
        logger.debug('[ContactScraper] Skipping supplier with existing contacts', {
          company: supplier.company_name
        });
        return supplier;
      }

      const contacts = await scrapeSupplierContacts(supplier.website);

      return {
        ...supplier,
        email: supplier.email || contacts.email,
        phone: supplier.phone || contacts.phone,
        address: supplier.address || contacts.address,
        contacts_scraped_at: contacts.scrapedAt
      };
    })
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const withEmail = enrichedSuppliers.filter(s => s.email).length;
  const withPhone = enrichedSuppliers.filter(s => s.phone).length;

  logger.info('[ContactScraper] Enrichment completed', {
    total: suppliers.length,
    withEmail,
    withPhone,
    duration: `${duration}s`
  });

  return enrichedSuppliers;
}
