import pLimit from 'p-limit';
import { normalizeWebsite, isBusinessEmail } from './validation.js';

const DEFAULT_CONTACT_PATHS = [
  '/',
  '/contact',
  '/contact-us',
  '/contactus',
  '/contacts',
  '/en/contact',
  '/en/contact-us',
  '/about',
  '/about-us',
  '/company/contact',
  '/support',
  '/sales',
  '/en/about-us'
];

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4})/g;

function decodeHtmlEntities(value = '') {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractEmailsFromHtml(html = '') {
  if (!html) return [];
  const decoded = decodeHtmlEntities(html);
  const matches = decoded.match(EMAIL_REGEX);
  if (!matches) return [];

  const unique = new Set();
  for (const raw of matches) {
    const email = raw.trim().replace(/[\s"'<>]/g, '').toLowerCase();
    if (!email || email.endsWith('@') || !isBusinessEmail(email)) {
      continue;
    }
    unique.add(email);
  }
  return Array.from(unique);
}

function extractPhonesFromHtml(html = '') {
  if (!html) return [];
  const decoded = decodeHtmlEntities(html);
  const matches = decoded.match(PHONE_REGEX);
  if (!matches) return [];

  const unique = new Set();
  for (const raw of matches) {
    const normalized = raw.replace(/[^\d+]/g, '');
    if (normalized.length < 7) {
      continue;
    }
    unique.add(normalized);
  }
  return Array.from(unique);
}

function extractHostname(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function extractEmailDomain(email) {
  const parts = String(email).split('@');
  return parts.length === 2 ? parts[1] : '';
}

function buildCandidateUrls(website, paths = DEFAULT_CONTACT_PATHS) {
  try {
    const parsed = new URL(website);
    const origins = new Set();
    const hostname = parsed.hostname;
    const protocol = parsed.protocol || 'https:';

    origins.add(`${protocol}//${hostname}`);
    if (hostname.startsWith('www.')) {
      origins.add(`${protocol}//${hostname.slice(4)}`);
    } else {
      origins.add(`${protocol}//www.${hostname}`);
    }

    const urls = new Set();
    origins.forEach((origin) => {
      paths.forEach((path) => {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        urls.add(`${origin}${normalizedPath}`);
      });
    });

    return Array.from(urls);
  } catch {
    return [];
  }
}

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SupplierSearchBot/1.0)',
        'Accept-Language': 'en-US,en;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timer);

    const contentType = response.headers.get('content-type') || '';
    const text = contentType.includes('text') ? await response.text() : '';

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      html: text
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      url,
      error: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

function serializeEmailSources(map) {
  return Array.from(map.entries()).map(([email, source]) => ({
    email,
    url: source.url
  }));
}

async function verifySupplierContactInternal(supplier, options) {
  const {
    timeout = 12000,
    contactPaths = DEFAULT_CONTACT_PATHS
  } = options;

  const website = normalizeWebsite(supplier.website || '');
  if (!website) {
    return {
      supplier,
      status: 'failed',
      reason: 'Missing website URL',
      evidence: {
        candidateEmail: supplier.email || null,
        pages: []
      }
    };
  }

  const candidateEmail = (supplier.email || '').toLowerCase();
  const siteDomain = extractHostname(website);
  const candidateUrls = buildCandidateUrls(website, contactPaths);

  if (!candidateUrls.length) {
    return {
      supplier,
      status: 'failed',
      reason: 'Invalid website URL',
      evidence: {
        candidateEmail: candidateEmail || null,
        pages: []
      }
    };
  }

  const visited = [];
  const emailSources = new Map();
  const phoneSources = new Map();

  for (const url of candidateUrls) {
    const page = await fetchWithTimeout(url, timeout);
    visited.push({
      url,
      finalUrl: page.finalUrl || null,
      status: page.status || null,
      error: page.error || null
    });

    if (page.error || !page.html) {
      continue;
    }

    const emails = extractEmailsFromHtml(page.html);
    const phones = extractPhonesFromHtml(page.html);

    for (const email of emails) {
      if (!emailSources.has(email)) {
        emailSources.set(email, { url: page.finalUrl || url });
      }
    }

    for (const phone of phones) {
      if (!phoneSources.has(phone)) {
        phoneSources.set(phone, { url: page.finalUrl || url });
      }
    }

    if (candidateEmail && emailSources.has(candidateEmail)) {
      break;
    }
  }

  const emails = Array.from(emailSources.keys());
  const phones = Array.from(phoneSources.keys());

  let resolvedEmail = candidateEmail;
  let status = 'failed';
  let matchedSource = candidateEmail ? emailSources.get(candidateEmail) : null;

  if (candidateEmail && emailSources.has(candidateEmail)) {
    status = 'matched';
  } else if (emails.length) {
    const domainMatch = emails.find((email) => extractEmailDomain(email) === siteDomain);
    if (domainMatch) {
      resolvedEmail = domainMatch;
      matchedSource = emailSources.get(domainMatch);
      status = candidateEmail ? 'domain-matched' : 'extracted';
    } else if (!candidateEmail) {
      resolvedEmail = emails[0];
      matchedSource = emailSources.get(resolvedEmail);
      status = 'extracted';
    }
  }

  if (status === 'failed') {
    return {
      supplier,
      status,
      reason: emails.length ? 'Email evidence domain mismatch' : 'No contact email found on website',
      evidence: {
        candidateEmail: candidateEmail || null,
        siteDomain,
        emails,
        phones,
        sources: serializeEmailSources(emailSources),
        pages: visited
      }
    };
  }

  return {
    supplier: {
      ...supplier,
      email: resolvedEmail
    },
    status,
    evidence: {
      candidateEmail: candidateEmail || null,
      resolvedEmail,
      siteDomain,
      emails,
      phones,
      sources: serializeEmailSources(emailSources),
      matchedSource: matchedSource ? matchedSource.url : null,
      pages: visited
    }
  };
}

export async function verifySupplierContacts(suppliers, options = {}) {
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    return {
      verified: [],
      rejected: []
    };
  }

  const limit = pLimit(Math.max(1, options.concurrency || 3));
  const tasks = suppliers.map((supplier) =>
    limit(() => verifySupplierContactInternal(supplier, options))
  );

  const results = await Promise.all(tasks);

  const verified = [];
  const rejected = [];

  for (const result of results) {
    if (result.status === 'failed') {
      rejected.push(result);
    } else {
      verified.push(result);
    }
  }

  return { verified, rejected };
}

export async function verifySupplierContact(supplier, options = {}) {
  return verifySupplierContactInternal(supplier, options);
}
