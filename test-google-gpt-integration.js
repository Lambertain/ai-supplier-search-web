import 'dotenv/config';
import { searchSuppliers } from './src/services/googleSearchService.js';
import { chatCompletionJson } from './src/services/openaiService.js';

const OPENAI_MODELS = {
  SMART: 'gpt-4o-mini'
};

const TEMPERATURE = {
  FACTUAL: 0.3
};

const MAX_TOKENS = {
  SEARCH: 4000
};

console.log('='.repeat(70));
console.log('ПОВНИЙ ТЕСТ: GOOGLE SEARCH + GPT СТРУКТУРУВАННЯ');
console.log('='.repeat(70));
console.log('');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
  console.error('Помилка: Google API ключі не налаштовані');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Помилка: OpenAI API ключ не налаштований');
  process.exit(1);
}

const input = {
  productDescription: 'LED світильники для офісу',
  quantity: '1000 штук',
  targetPrice: '$5-10 за штуку',
  additionalRequirements: 'Сертифікати CE, ISO 9001',
  preferredRegion: 'china'
};

const settings = {
  searchConfig: {
    minSuppliers: 5,
    maxSuppliers: 10
  },
  apiKeys: {
    google: GOOGLE_API_KEY,
    openai: OPENAI_API_KEY
  },
  searchEngineId: GOOGLE_SEARCH_ENGINE_ID
};

console.log('Параметри пошуку:');
console.log(`  Продукт: ${input.productDescription}`);
console.log(`  Кількість: ${input.quantity}`);
console.log(`  Ціна: ${input.targetPrice}`);
console.log(`  Вимоги: ${input.additionalRequirements}`);
console.log(`  Регіон: ${input.preferredRegion}`);
console.log(`  Потрібно постачальників: ${settings.searchConfig.minSuppliers}-${settings.searchConfig.maxSuppliers}`);
console.log('');

try {
  // КРОК 1: Google Search
  console.log('КРОК 1: Пошук через Google Search API...');
  const searchQuery = `${input.productDescription} supplier manufacturer ${input.preferredRegion} B2B wholesale`;
  console.log(`Query: "${searchQuery}"`);
  console.log('');

  const startGoogle = Date.now();
  const googleResults = await searchSuppliers({
    query: searchQuery,
    maxResults: 20,
    apiKey: GOOGLE_API_KEY,
    searchEngineId: GOOGLE_SEARCH_ENGINE_ID
  });
  const googleDuration = ((Date.now() - startGoogle) / 1000).toFixed(2);

  console.log(`✅ Google Search завершено за ${googleDuration} сек`);
  console.log(`   Знайдено: ${googleResults.length} результатів`);
  console.log('');

  console.log('Перші 3 результати Google:');
  googleResults.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   URL: ${r.link}`);
    console.log(`   Snippet: ${r.snippet.substring(0, 100)}...`);
    console.log('');
  });

  // КРОК 2: GPT Структурування
  console.log('КРОК 2: Структурування через GPT...');
  console.log('');

  const googleResultsContext = googleResults.map((result, index) => ({
    index: index + 1,
    title: result.title,
    link: result.link,
    snippet: result.snippet,
    displayLink: result.displayLink
  }));

  const structuringPrompt = {
    role: 'system',
    content: `You are a procurement assistant that structures supplier information from Google Search results.

CRITICAL RULES:
1. ONLY use information from the provided Google Search results
2. DO NOT invent or hallucinate any company names, emails, or contact information
3. If contact information is not in the search results, use empty string
4. Extract company name from the website domain or title
5. Use the website link directly from Google results
6. Infer manufacturing capabilities from snippet text only

OUTPUT FORMAT: JSON object with "suppliers" array containing ${settings.searchConfig.minSuppliers}-${settings.searchConfig.maxSuppliers} suppliers.

Each supplier MUST have:
- company_name: Extract from domain or title (REQUIRED)
- website: Direct link from Google (REQUIRED)
- email: Only if found in snippet, otherwise empty string
- phone: Only if found in snippet, otherwise empty string
- country: Infer from domain (.cn = China, etc) or use "${input.preferredRegion}"
- city: Only if mentioned in snippet, otherwise empty string
- manufacturing_capabilities: Infer from product mentions in snippet
- production_capacity: Only if mentioned, otherwise empty string
- certifications: Only if mentioned (ISO, CE, etc), otherwise empty string
- years_in_business: Only if mentioned, otherwise empty string
- estimated_price_range: Only if mentioned, otherwise empty string
- minimum_order_quantity: Only if mentioned, otherwise empty string

PRODUCT REQUIREMENTS:
- Product: ${input.productDescription}
- Quantity: ${input.quantity}
- Target Price: ${input.targetPrice}
- Additional: ${input.additionalRequirements}
- Region: ${input.preferredRegion}`
  };

  const userPrompt = {
    role: 'user',
    content: `Here are ${googleResults.length} REAL supplier search results from Google. Structure them into the supplier format.

GOOGLE SEARCH RESULTS:
${JSON.stringify(googleResultsContext, null, 2)}

Return ONLY suppliers that match the product requirements. Prioritize results with clear B2B/manufacturer indicators.`
  };

  const startGPT = Date.now();
  const structuredSuppliers = await chatCompletionJson({
    model: OPENAI_MODELS.SMART,
    messages: [structuringPrompt, userPrompt],
    temperature: TEMPERATURE.FACTUAL,
    maxTokens: MAX_TOKENS.SEARCH,
    apiKey: OPENAI_API_KEY
  });
  const gptDuration = ((Date.now() - startGPT) / 1000).toFixed(2);

  console.log(`✅ GPT структурування завершено за ${gptDuration} сек`);
  console.log('');

  const suppliers = structuredSuppliers.suppliers || [];

  console.log('='.repeat(70));
  console.log(`ЗНАЙДЕНО ПОСТАЧАЛЬНИКІВ: ${suppliers.length}`);
  console.log('='.repeat(70));
  console.log('');

  suppliers.forEach((supplier, index) => {
    console.log(`${index + 1}. ${supplier.company_name}`);
    console.log(`   📧 Email: ${supplier.email || 'не вказано'}`);
    console.log(`   📞 Телефон: ${supplier.phone || 'не вказано'}`);
    console.log(`   🌍 Країна: ${supplier.country}`);
    console.log(`   🏙️  Місто: ${supplier.city || 'не вказано'}`);
    console.log(`   🌐 Веб-сайт: ${supplier.website || 'не вказано'}`);
    console.log(`   🏭 Виробництво: ${supplier.manufacturing_capabilities || 'не вказано'}`);
    console.log(`   📦 Потужність: ${supplier.production_capacity || 'не вказано'}`);
    console.log(`   ✅ Сертифікати: ${supplier.certifications || 'не вказано'}`);
    console.log(`   📅 Років в бізнесі: ${supplier.years_in_business || 'не вказано'}`);
    console.log(`   💰 Ціна: ${supplier.estimated_price_range || 'не вказано'}`);
    console.log(`   📊 MOQ: ${supplier.minimum_order_quantity || 'не вказано'}`);
    console.log('');
  });

  console.log('='.repeat(70));
  console.log('СТАТИСТИКА:');
  console.log('='.repeat(70));

  const withEmail = suppliers.filter(s => s.email).length;
  const withPhone = suppliers.filter(s => s.phone).length;
  const withWebsite = suppliers.filter(s => s.website).length;
  const withCertifications = suppliers.filter(s => s.certifications).length;

  console.log(`✅ З email: ${withEmail}/${suppliers.length}`);
  console.log(`✅ З телефоном: ${withPhone}/${suppliers.length}`);
  console.log(`✅ З веб-сайтом: ${withWebsite}/${suppliers.length}`);
  console.log(`✅ З сертифікатами: ${withCertifications}/${suppliers.length}`);
  console.log('');
  console.log(`⏱️  Google Search: ${googleDuration} сек`);
  console.log(`⏱️  GPT Structure: ${gptDuration} сек`);
  console.log(`⏱️  Загалом: ${((Date.now() - startGoogle) / 1000).toFixed(2)} сек`);
  console.log('');
  console.log('🎉 ТЕСТ УСПІШНИЙ! Повна інтеграція Google + GPT працює');
  console.log('');

} catch (error) {
  console.error('');
  console.error('❌ ПОМИЛКА:');
  console.error('Повідомлення:', error.message);
  if (error.status) {
    console.error('HTTP статус:', error.status);
  }
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  console.error('');
  process.exit(1);
}
