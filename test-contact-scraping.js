import 'dotenv/config';
import { scrapeSupplierContacts, enrichSuppliersWithContacts } from './src/services/contactScraperService.js';

console.log('='.repeat(70));
console.log('ТЕСТ СКРАПІНГУ КОНТАКТІВ З САЙТІВ ПОСТАЧАЛЬНИКІВ');
console.log('='.repeat(70));
console.log('');

// Тестові постачальники з реальними сайтами B2B
const testSuppliers = [
  {
    company_name: 'Made-in-China.com',
    website: 'https://www.made-in-china.com',
    email: '',
    phone: ''
  },
  {
    company_name: 'Global Sources',
    website: 'https://www.globalsources.com',
    email: '',
    phone: ''
  },
  {
    company_name: 'Alibaba',
    website: 'https://www.alibaba.com',
    email: '',
    phone: ''
  }
];

async function testSingleScraping() {
  console.log('='.repeat(70));
  console.log('ТЕСТ 1: Скрапінг одного сайту');
  console.log('='.repeat(70));
  console.log('');

  const testUrl = 'https://www.made-in-china.com';
  console.log(`Сайт: ${testUrl}`);
  console.log('');

  try {
    const startTime = Date.now();
    const contacts = await scrapeSupplierContacts(testUrl);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ Скрапінг завершено за', duration, 'сек');
    console.log('');
    console.log('Знайдені контакти:');
    console.log(`  📧 Email: ${contacts.email || 'не знайдено'}`);
    console.log(`  📞 Телефон: ${contacts.phone || 'не знайдено'}`);
    console.log(`  🏠 Адреса: ${contacts.address || 'не знайдено'}`);
    console.log(`  ⏰ Час скрапінгу: ${contacts.scrapedAt}`);
    console.log('');

    return contacts;
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    console.error('');
    return null;
  }
}

async function testBatchScraping() {
  console.log('='.repeat(70));
  console.log('ТЕСТ 2: Збагачення кількох постачальників контактами');
  console.log('='.repeat(70));
  console.log('');

  console.log(`Кількість постачальників: ${testSuppliers.length}`);
  console.log('');

  testSuppliers.forEach((supplier, i) => {
    console.log(`${i + 1}. ${supplier.company_name}`);
    console.log(`   Веб-сайт: ${supplier.website}`);
    console.log('');
  });

  try {
    const startTime = Date.now();
    const enrichedSuppliers = await enrichSuppliersWithContacts(testSuppliers);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Збагачення завершено за ${duration} сек`);
    console.log('');

    console.log('='.repeat(70));
    console.log('РЕЗУЛЬТАТИ:');
    console.log('='.repeat(70));
    console.log('');

    enrichedSuppliers.forEach((supplier, i) => {
      console.log(`${i + 1}. ${supplier.company_name}`);
      console.log(`   📧 Email: ${supplier.email || 'не знайдено'}`);
      console.log(`   📞 Телефон: ${supplier.phone || 'не знайдено'}`);
      console.log(`   🌐 Веб-сайт: ${supplier.website}`);
      console.log(`   ⏰ Час скрапінгу: ${supplier.contacts_scraped_at || 'не скрапилось'}`);
      console.log('');
    });

    // Статистика
    const withEmail = enrichedSuppliers.filter(s => s.email).length;
    const withPhone = enrichedSuppliers.filter(s => s.phone).length;

    console.log('='.repeat(70));
    console.log('СТАТИСТИКА:');
    console.log('='.repeat(70));
    console.log(`📊 Всього постачальників: ${enrichedSuppliers.length}`);
    console.log(`📧 З email: ${withEmail}/${enrichedSuppliers.length} (${((withEmail / enrichedSuppliers.length) * 100).toFixed(1)}%)`);
    console.log(`📞 З телефоном: ${withPhone}/${enrichedSuppliers.length} (${((withPhone / enrichedSuppliers.length) * 100).toFixed(1)}%)`);
    console.log(`⏱️  Загальний час: ${duration} сек`);
    console.log(`⏱️  Середній час на постачальника: ${(parseFloat(duration) / enrichedSuppliers.length).toFixed(2)} сек`);
    console.log('');

    return enrichedSuppliers;
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('');
    return null;
  }
}

async function runAllTests() {
  console.log('Запуск тестів веб-скрапінгу контактів...');
  console.log('');

  // Тест 1: Один сайт
  await testSingleScraping();

  console.log('Пауза 2 секунди між тестами...');
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Тест 2: Кілька постачальників
  await testBatchScraping();

  console.log('='.repeat(70));
  console.log('🎉 ВСІ ТЕСТИ ЗАВЕРШЕНО');
  console.log('='.repeat(70));
  console.log('');
}

runAllTests().catch(error => {
  console.error('Критична помилка:', error);
  process.exit(1);
});
