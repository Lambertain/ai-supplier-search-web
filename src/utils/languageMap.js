/**
 * Language Mapping Utility
 * Maps countries to their primary business languages for automated email generation
 */
import logger from './logger.js';

/**
 * Country to Language mapping for multilingual email generation
 * Based on primary business communication language in each country
 */
export const COUNTRY_LANGUAGE_MAP = {
  // Asia
  'China': 'zh',           // Simplified Chinese
  'Taiwan': 'zh-TW',       // Traditional Chinese
  'Hong Kong': 'zh-TW',    // Traditional Chinese
  'Japan': 'ja',           // Japanese
  'South Korea': 'ko',     // Korean
  'Korea': 'ko',           // Korean (alternative name)
  'India': 'en',           // English (business language)
  'Vietnam': 'vi',         // Vietnamese
  'Thailand': 'th',        // Thai
  'Indonesia': 'id',       // Indonesian
  'Malaysia': 'ms',        // Malay
  'Singapore': 'en',       // English
  'Philippines': 'en',     // English

  // Europe
  'Germany': 'de',         // German
  'Austria': 'de',         // German
  'Switzerland': 'de',     // German (primary)
  'France': 'fr',          // French
  'Belgium': 'fr',         // French (primary)
  'Spain': 'es',           // Spanish
  'Italy': 'it',           // Italian
  'Portugal': 'pt',        // Portuguese
  'Netherlands': 'nl',     // Dutch
  'Poland': 'pl',          // Polish
  'Czech Republic': 'cs',  // Czech
  'Greece': 'el',          // Greek
  'Turkey': 'tr',          // Turkish
  'Russia': 'ru',          // Russian
  'Ukraine': 'uk',         // Ukrainian

  // Middle East & Africa
  'Saudi Arabia': 'ar',    // Arabic
  'UAE': 'ar',             // Arabic
  'United Arab Emirates': 'ar',
  'Egypt': 'ar',           // Arabic
  'Israel': 'he',          // Hebrew
  'South Africa': 'en',    // English

  // Americas
  'USA': 'en',             // English
  'United States': 'en',
  'Canada': 'en',          // English (primary)
  'Mexico': 'es',          // Spanish
  'Brazil': 'pt',          // Portuguese
  'Argentina': 'es',       // Spanish
  'Chile': 'es',           // Spanish
  'Colombia': 'es',        // Spanish

  // Oceania
  'Australia': 'en',       // English
  'New Zealand': 'en'      // English
};

/**
 * Language names for display purposes
 */
export const LANGUAGE_NAMES = {
  'zh': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'it': 'Italian',
  'pt': 'Portuguese',
  'nl': 'Dutch',
  'pl': 'Polish',
  'cs': 'Czech',
  'el': 'Greek',
  'tr': 'Turkish',
  'ru': 'Russian',
  'uk': 'Ukrainian',
  'ar': 'Arabic',
  'he': 'Hebrew',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'id': 'Indonesian',
  'ms': 'Malay',
  'hi': 'Hindi'
};

/**
 * Get language code for a given country
 * @param {string} country - Country name
 * @returns {string} ISO 639-1 language code or 'en' as fallback
 */
export function getLanguageForCountry(country) {
  if (!country || typeof country !== 'string') {
    return 'en'; // Default to English
  }

  const normalizedCountry = country.trim();
  const languageCode = COUNTRY_LANGUAGE_MAP[normalizedCountry];

  if (languageCode) {
    return languageCode;
  }

  // Fallback to English for unknown countries
  logger.info('[Language Map] Unknown country, defaulting to English', { country });
  return 'en';
}

/**
 * Get display name for a language code
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {string} Language display name
 */
export function getLanguageName(languageCode) {
  return LANGUAGE_NAMES[languageCode] || 'English';
}

/**
 * Check if a language code is supported
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {boolean} True if language is supported
 */
export function isLanguageSupported(languageCode) {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, languageCode);
}

/**
 * Get all supported languages
 * @returns {Array<{code: string, name: string}>} List of supported languages
 */
export function getSupportedLanguages() {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code,
    name
  }));
}
