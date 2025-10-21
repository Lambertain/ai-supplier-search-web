import 'dotenv/config';
import { searchSuppliers } from './src/services/googleSearchService.js';

console.log('='.repeat(70));
console.log('ПРЯМИЙ ТЕСТ GOOGLE SEARCH ДЛЯ ПОШУКУ ПОСТАЧАЛЬНИКІВ');
console.log('='.repeat(70));
console.log('');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
  console.error('Помилка: Google API ключі не налаштовані');
  process.exit(1);
}

console.log('Тестуємо пошук для:');
console.log('  Продукт: LED світильники для офісу');
console.log('  Регіон: Китай');
console.log('  Кількість результатів: 10');
console.log('');

const testQuery = {
  query: 'China LED office lighting manufacturer supplier wholesale B2B',
  maxResults: 10,
  apiKey: GOOGLE_API_KEY,
  searchEngineId: GOOGLE_SEARCH_ENGINE_ID
};

try {
  console.log('Шукаю постачальників через Google Search API...');
  console.log('');

  const startTime = Date.now();
  const results = await searchSuppliers(testQuery);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Пошук завершено за ${duration} секунд`);
  console.log('');
  console.log('='.repeat(70));
  console.log(`ЗНАЙДЕНО ПОСТАЧАЛЬНИКІВ: ${results.length}`);
  console.log('='.repeat(70));
  console.log('');

  results.forEach((supplier, index) => {
    console.log(`${index + 1}. ${supplier.company_name}`);
    console.log(`   Країна: ${supplier.country}`);
    console.log(`   Веб-сайт: ${supplier.website || 'не вказано'}`);
    console.log(`   Email: ${supplier.email || 'не вказано'}`);
    console.log(`   Телефон: ${supplier.phone || 'не вказано'}`);
    if (supplier.description) {
      console.log(`   Опис: ${supplier.description.substring(0, 150)}...`);
    }
    console.log('');
  });

  console.log('='.repeat(70));
  console.log('СТАТИСТИКА:');
  console.log('='.repeat(70));
  const withEmail = results.filter(s => s.email).length;
  const withPhone = results.filter(s => s.phone).length;
  const withWebsite = results.filter(s => s.website).length;
  const fromChina = results.filter(s => s.country && s.country.toLowerCase().includes('china')).length;

  console.log(`✅ З email: ${withEmail}/${results.length}`);
  console.log(`✅ З телефоном: ${withPhone}/${results.length}`);
  console.log(`✅ З веб-сайтом: ${withWebsite}/${results.length}`);
  console.log(`✅ З Китаю: ${fromChina}/${results.length}`);
  console.log('');
  console.log('🎉 ТЕСТ УСПІШНИЙ! Google Search працює для пошуку постачальників');

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
