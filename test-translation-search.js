import 'dotenv/config';
import { prepareSearchQuery } from './src/services/translationService.js';
import { searchSuppliers } from './src/services/googleSearchService.js';
import { chatCompletionJson } from './src/services/openaiService.js';

console.log('='.repeat(70));
console.log('ТЕСТ ПОШУКУ З АВТОМАТИЧНИМ ПЕРЕКЛАДОМ');
console.log('='.repeat(70));
console.log('');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID || !OPENAI_API_KEY) {
  console.error('Помилка: Не всі API ключі налаштовані');
  process.exit(1);
}

// Тест з українським описом продукту
const testCases = [
  {
    productDescription: 'LED світильники для офісу',
    preferredRegion: 'china',
    name: 'Український запит → Китай'
  },
  {
    productDescription: 'Керамічні чашки з логотипом',
    preferredRegion: 'china',
    name: 'Український запит → Китай'
  }
];

async function runTest(testCase) {
  console.log('='.repeat(70));
  console.log(`ТЕСТ: ${testCase.name}`);
  console.log('='.repeat(70));
  console.log('');
  console.log(`Оригінальний запит: "${testCase.productDescription}"`);
  console.log(`Регіон: ${testCase.preferredRegion}`);
  console.log('');

  try {
    // КРОК 1: Переклад
    console.log('КРОК 1: Переклад запиту на мову регіону...');
    const startTranslation = Date.now();

    const translationResult = await prepareSearchQuery(
      testCase.productDescription,
      testCase.preferredRegion,
      OPENAI_API_KEY
    );

    const translationDuration = ((Date.now() - startTranslation) / 1000).toFixed(2);

    console.log(`✅ Переклад завершено за ${translationDuration} сек`);
    console.log(`   Оригінал: "${translationResult.original}"`);
    console.log(`   Переклад: "${translationResult.translated}"`);
    console.log(`   Мова: ${translationResult.language}`);
    console.log(`   Було перекладено: ${translationResult.wasTranslated ? 'Так' : 'Ні'}`);
    console.log('');

    // КРОК 2: Google Search з перекладеним запитом
    console.log('КРОК 2: Google Search з перекладеним запитом...');
    const searchQuery = `${translationResult.translated} supplier manufacturer ${testCase.preferredRegion} B2B wholesale`;
    console.log(`Query: "${searchQuery}"`);
    console.log('');

    const startGoogle = Date.now();
    const googleResults = await searchSuppliers({
      query: searchQuery,
      maxResults: 10,
      apiKey: GOOGLE_API_KEY,
      searchEngineId: GOOGLE_SEARCH_ENGINE_ID
    });
    const googleDuration = ((Date.now() - startGoogle) / 1000).toFixed(2);

    console.log(`✅ Google Search завершено за ${googleDuration} сек`);
    console.log(`   Знайдено: ${googleResults.length} результатів`);
    console.log('');

    if (googleResults.length > 0) {
      console.log('Топ-3 результати:');
      googleResults.slice(0, 3).forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}`);
        console.log(`   URL: ${r.link}`);
        console.log('');
      });
    }

    // КРОК 3: Структурування через GPT
    console.log('КРОК 3: Структурування результатів через GPT...');

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
3. Extract company name from the website domain or title
4. Use the website link directly from Google results

OUTPUT FORMAT: JSON object with "suppliers" array containing 5-10 suppliers.

Each supplier MUST have:
- company_name: Extract from domain or title (REQUIRED)
- website: Direct link from Google (REQUIRED)
- email: Only if found in snippet, otherwise empty string
- phone: Only if found in snippet, otherwise empty string
- country: Infer from domain or use "${testCase.preferredRegion}"
- manufacturing_capabilities: Infer from product mentions in snippet`
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
      model: 'gpt-4o-mini',
      messages: [structuringPrompt, userPrompt],
      temperature: 0.3,
      maxTokens: 4000,
      apiKey: OPENAI_API_KEY
    });
    const gptDuration = ((Date.now() - startGPT) / 1000).toFixed(2);

    const suppliers = structuredSuppliers.suppliers || [];

    console.log(`✅ GPT структурування завершено за ${gptDuration} сек`);
    console.log(`   Знайдено постачальників: ${suppliers.length}`);
    console.log('');

    if (suppliers.length > 0) {
      console.log('Перші 3 постачальники:');
      suppliers.slice(0, 3).forEach((s, i) => {
        console.log(`${i + 1}. ${s.company_name}`);
        console.log(`   Країна: ${s.country}`);
        console.log(`   Веб-сайт: ${s.website || 'не вказано'}`);
        console.log('');
      });
    }

    console.log('='.repeat(70));
    console.log('ПІДСУМОК ТЕСТУ:');
    console.log('='.repeat(70));
    console.log(`⏱️  Переклад: ${translationDuration} сек`);
    console.log(`⏱️  Google Search: ${googleDuration} сек`);
    console.log(`⏱️  GPT Структурування: ${gptDuration} сек`);
    console.log(`⏱️  Загалом: ${((Date.now() - startTranslation) / 1000).toFixed(2)} сек`);
    console.log(`📊 Google результатів: ${googleResults.length}`);
    console.log(`📊 Постачальників: ${suppliers.length}`);
    console.log('');

    return {
      success: true,
      googleResults: googleResults.length,
      suppliers: suppliers.length,
      wasTranslated: translationResult.wasTranslated,
      totalTime: ((Date.now() - startTranslation) / 1000).toFixed(2)
    };

  } catch (error) {
    console.error('');
    console.error('❌ ПОМИЛКА:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('');
    return {
      success: false,
      error: error.message
    };
  }
}

// Запуск тестів
async function runAllTests() {
  console.log('Запуск тестів пошуку з автоматичним перекладом...');
  console.log('');

  const results = [];

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push({ testCase, result });

    // Пауза між тестами
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      console.log('Пауза 2 секунди між тестами...');
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('='.repeat(70));
  console.log('ЗАГАЛЬНІ РЕЗУЛЬТАТИ');
  console.log('='.repeat(70));
  console.log('');

  results.forEach(({ testCase, result }) => {
    console.log(`${testCase.name}:`);
    if (result.success) {
      console.log(`  ✅ Успішно`);
      console.log(`  📊 Google результатів: ${result.googleResults}`);
      console.log(`  📊 Постачальників: ${result.suppliers}`);
      console.log(`  🌐 Було перекладено: ${result.wasTranslated ? 'Так' : 'Ні'}`);
      console.log(`  ⏱️  Час: ${result.totalTime} сек`);
    } else {
      console.log(`  ❌ Помилка: ${result.error}`);
    }
    console.log('');
  });

  const successCount = results.filter(r => r.result.success).length;
  console.log(`🎉 ТЕСТИ ЗАВЕРШЕНО: ${successCount}/${results.length} успішних`);
  console.log('');
}

runAllTests().catch(error => {
  console.error('Критична помилка:', error);
  process.exit(1);
});
