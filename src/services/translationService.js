import logger from '../utils/logger.js';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Region to search language mapping
 * Maps preferred_region values to optimal search language
 */
const REGION_LANGUAGE_MAP = {
  china: 'en',      // English is standard for B2B in China
  asia: 'en',       // English is common B2B language in Asia
  europe: 'en',     // English is business lingua franca in Europe
  usa: 'en',        // English for USA
  global: 'en'      // English for global search
};

/**
 * Language name mapping for prompts
 */
const LANGUAGE_NAMES = {
  en: 'English',
  uk: 'Ukrainian',
  ru: 'Russian'
};

/**
 * Detect if text is in Ukrainian or Russian
 * @param {string} text - Text to analyze
 * @returns {boolean} True if text is in Ukrainian or Russian
 */
function isUkrainianOrRussian(text) {
  // Check for Cyrillic characters
  const cyrillicPattern = /[\u0400-\u04FF]/;
  return cyrillicPattern.test(text);
}

/**
 * Translate product description to target language for search
 * @param {string} productDescription - Original product description
 * @param {string} targetLanguage - Target language code (en, uk, ru)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Translated product description
 */
export async function translateProductDescription(productDescription, targetLanguage, apiKey) {
  // If already in target language, return as is
  if (targetLanguage === 'en' && !isUkrainianOrRussian(productDescription)) {
    logger.debug('[Translation] Text already in English, skipping translation');
    return productDescription;
  }

  if ((targetLanguage === 'uk' || targetLanguage === 'ru') && isUkrainianOrRussian(productDescription)) {
    logger.debug('[Translation] Text already in Ukrainian/Russian, skipping translation');
    return productDescription;
  }

  try {
    logger.info('[Translation] Translating product description', {
      originalLength: productDescription.length,
      targetLanguage: LANGUAGE_NAMES[targetLanguage] || targetLanguage
    });

    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in B2B product descriptions.

TASK: Translate the product description to ${LANGUAGE_NAMES[targetLanguage] || targetLanguage}.

RULES:
1. Preserve technical terms and industry-specific vocabulary
2. Keep the same level of detail and specificity
3. Maintain professional B2B tone
4. DO NOT add explanations or extra text
5. Return ONLY the translated product description
6. Preserve quantities, measurements, and technical specifications exactly`
        },
        {
          role: 'user',
          content: `Translate this product description to ${LANGUAGE_NAMES[targetLanguage] || targetLanguage}:

${productDescription}`
        }
      ],
      temperature: 0.3, // Low temperature for consistent translations
      max_tokens: 500
    };

    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0].message.content.trim();

    logger.info('[Translation] Translation completed', {
      originalLength: productDescription.length,
      translatedLength: translatedText.length,
      targetLanguage: LANGUAGE_NAMES[targetLanguage] || targetLanguage
    });

    return translatedText;
  } catch (error) {
    logger.error('[Translation] Translation failed', {
      error: error.message,
      targetLanguage
    });

    // Fallback: return original text if translation fails
    logger.warn('[Translation] Using original text as fallback');
    return productDescription;
  }
}

/**
 * Get optimal search language for a region
 * @param {string} preferredRegion - Region code (china, asia, europe, usa, global)
 * @returns {string} Language code for search (en, uk, ru)
 */
export function getSearchLanguageForRegion(preferredRegion) {
  const language = REGION_LANGUAGE_MAP[preferredRegion] || 'en';

  logger.debug('[Translation] Search language for region', {
    region: preferredRegion,
    language: LANGUAGE_NAMES[language]
  });

  return language;
}

/**
 * Prepare product description for search based on region
 * Automatically translates if needed
 * @param {string} productDescription - Original product description
 * @param {string} preferredRegion - Target region (china, asia, europe, usa, global)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} { original, translated, language, wasTranslated }
 */
export async function prepareSearchQuery(productDescription, preferredRegion, apiKey) {
  const targetLanguage = getSearchLanguageForRegion(preferredRegion);
  const needsTranslation = isUkrainianOrRussian(productDescription) && targetLanguage === 'en';

  if (!needsTranslation) {
    logger.debug('[Translation] No translation needed', {
      region: preferredRegion,
      targetLanguage: LANGUAGE_NAMES[targetLanguage]
    });

    return {
      original: productDescription,
      translated: productDescription,
      language: targetLanguage,
      wasTranslated: false
    };
  }

  logger.info('[Translation] Translation required', {
    region: preferredRegion,
    targetLanguage: LANGUAGE_NAMES[targetLanguage]
  });

  const translated = await translateProductDescription(productDescription, targetLanguage, apiKey);

  return {
    original: productDescription,
    translated,
    language: targetLanguage,
    wasTranslated: true
  };
}
