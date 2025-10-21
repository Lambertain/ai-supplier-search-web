import 'dotenv/config';
import { runSupplierSearch } from './src/services/searchService.js';
import { getSettings } from './src/storage/settingsStore.js';

console.log('='.repeat(70));
console.log('ТЕСТ ПОШУКУ ПОСТАЧАЛЬНИКІВ ЧЕРЕЗ GOOGLE SEARCH API');
console.log('='.repeat(70));
console.log('');

const testQuery = {
  productDescription: 'LED світильники для офісу',
  quantity: '1000 штук',
  targetPrice: '$5-10 за штуку',
  additionalRequirements: 'Сертифікати CE, ISO 9001',
  preferredRegion: 'china'
};

console.log('Параметри пошуку:');
console.log(`  Продукт: ${testQuery.productDescription}`);
console.log(`  Кількість: ${testQuery.quantity}`);
console.log(`  Ціна: ${testQuery.targetPrice}`);
console.log(`  Вимоги: ${testQuery.additionalRequirements}`);
console.log(`  Регіон: ${testQuery.preferredRegion}`);
console.log('');
console.log('Шукаю постачальників через Google Search API...');
console.log('');

try {
  const settings = await getSettings();
  const startTime = Date.now();
  const results = await runSupplierSearch(testQuery, settings);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Пошук завершено за ${duration} секунд`);
  console.log('');
  console.log('='.repeat(70));
  console.log(`ЗНАЙДЕНО ПОСТАЧАЛЬНИКІВ: ${results.length}`);
  console.log('='.repeat(70));
  console.log('');

  results.forEach((supplier, index) => {
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
  console.log('ВИСНОВОК:');
  console.log('='.repeat(70));

  const withEmail = results.filter(s => s.email).length;
  const withWebsite = results.filter(s => s.website).length;
  const withCertifications = results.filter(s => s.certifications).length;

  console.log(`✅ Постачальників з email: ${withEmail}/${results.length}`);
  console.log(`✅ Постачальників з веб-сайтом: ${withWebsite}/${results.length}`);
  console.log(`✅ Постачальників з сертифікатами: ${withCertifications}/${results.length}`);
  console.log('');
  console.log('🎉 ТЕСТ УСПІШНИЙ! Google Search інтеграція працює');
  console.log('');

} catch (error) {
  console.error('');
  console.error('❌ ПОМИЛКА ПІД ЧАС ПОШУКУ:');
  console.error('Повідомлення:', error.message);
  console.error('Stack:', error.stack);
  console.error('');
  process.exit(1);
}
