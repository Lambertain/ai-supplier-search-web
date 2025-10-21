import 'dotenv/config';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

console.log('='.repeat(60));
console.log('ТЕСТ GOOGLE CUSTOM SEARCH API');
console.log('='.repeat(60));
console.log('');

console.log('Конфігурація:');
console.log(`API Key: ${GOOGLE_API_KEY ? GOOGLE_API_KEY.substring(0, 20) + '...' : 'ВІДСУТНІЙ'}`);
console.log(`Search Engine ID: ${GOOGLE_SEARCH_ENGINE_ID || 'ВІДСУТНІЙ'}`);
console.log('');

if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
  console.error('Помилка: Google API ключі не налаштовані в .env файлі');
  process.exit(1);
}

console.log('Тестовий запит: Пошук постачальників електроніки з Китаю...');
console.log('');

const query = 'China electronics manufacturer supplier LED lights';
const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;

try {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    console.error('Помилка Google API:');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`Статус: ${response.status} ${response.statusText}`);
  console.log(`Знайдено результатів: ${data.searchInformation?.totalResults || 0}`);
  console.log(`Час пошуку: ${data.searchInformation?.searchTime || 0} сек`);
  console.log('');
  console.log('Перші 5 результатів:');
  console.log('-'.repeat(60));

  if (data.items && data.items.length > 0) {
    data.items.forEach((item, index) => {
      console.log('');
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   URL: ${item.link}`);
      console.log(`   Опис: ${item.snippet.substring(0, 100)}...`);
    });
  } else {
    console.log('Результатів не знайдено');
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('ТЕСТ УСПІШНИЙ! Google Search API працює');
  console.log('='.repeat(60));

} catch (error) {
  console.error('');
  console.error('ПОМИЛКА:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
