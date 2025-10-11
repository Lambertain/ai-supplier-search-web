// Utility functions for validating incoming payloads and supplier data.

export function validateSearchRequest(payload = {}) {
  const errors = [];
  const productDescription = String(payload.product_description || payload.productDescription || '').trim();
  const targetPrice = String(payload.target_price || payload.targetPrice || '').trim();
  const quantity = String(payload.quantity || '').trim();
  const additionalRequirements = String(payload.additional_requirements || payload.additionalRequirements || '').trim();

  const minSuppliersRaw = payload.min_suppliers ?? payload.minSuppliers;
  const maxSuppliersRaw = payload.max_suppliers ?? payload.maxSuppliers;

  let minSuppliers = null;
  let maxSuppliers = null;

  if (minSuppliersRaw !== undefined && minSuppliersRaw !== null && String(minSuppliersRaw).trim() !== '') {
    minSuppliers = Number(minSuppliersRaw);
    if (!Number.isInteger(minSuppliers) || minSuppliers < 1) {
      errors.push('Мінімальна кількість постачальників має бути цілим числом від 1.');
    }
  }

  if (maxSuppliersRaw !== undefined && maxSuppliersRaw !== null && String(maxSuppliersRaw).trim() !== '') {
    maxSuppliers = Number(maxSuppliersRaw);
    if (!Number.isInteger(maxSuppliers) || maxSuppliers < 1) {
      errors.push('Максимальна кількість постачальників має бути цілим числом від 1.');
    }
  }

  if (minSuppliers !== null && maxSuppliers !== null && minSuppliers > maxSuppliers) {
    errors.push('Мінімальна кількість постачальників не може перевищувати максимальну.');
  }

  if (!productDescription || productDescription.length < 10) {
    errors.push('Product description must be at least 10 characters long.');
  }

  if (quantity && !/^[-A-Za-z0-9 ,._xX]+$/.test(quantity)) {
    errors.push('Quantity must contain only numbers and simple descriptors.');
  }

  if (targetPrice && !/^[$€¥£]?[0-9.,\- ]+$/.test(targetPrice)) {
    errors.push('Target price should look like a numeric amount (optionally with currency symbol).');
  }

  if (errors.length) {
    const error = new Error('Invalid search request');
    error.details = errors;
    throw error;
  }

  return {
    productDescription,
    targetPrice,
    quantity,
    additionalRequirements,
    minSuppliers,
    maxSuppliers,
  };
}

export function isBusinessEmail(email = '') {
  const value = String(email).toLowerCase().trim();
  if (!value.includes('@') || value.endsWith('@')) {
    return false;
  }

  // Blocked free email providers (consumer-only, not used by businesses)
  const blockedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'mail.ru'];
  if (blockedDomains.some((domain) => value.endsWith(domain))) {
    return false;
  }

  // Chinese email providers are ALLOWED (commonly used by legitimate Chinese manufacturers)
  // QQ.com, 163.com, 126.com, yeah.net, sina.com, etc. are valid business emails in China

  return /@.+\./.test(value) && !/@\d+\./.test(value);
}

export function normalizeWebsite(url = '') {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function sanitizeString(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function clampNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

