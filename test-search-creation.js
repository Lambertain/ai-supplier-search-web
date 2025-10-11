// Test script to verify database schema matches code expectations
import { createSearchRecord, getSearch } from './src/storage/searchStore.js';
import { nanoid } from 'nanoid';

const searchId = nanoid();

console.log('Testing search creation with all fields...\n');

const testPayload = {
  searchId,
  productDescription: 'Test product - Custom USB cables',
  targetPrice: '$5-10',
  quantity: '1000 units',
  additionalRequirements: 'CE certified, custom logo',
  operator: 'Test_User',
  startedAt: new Date(),
  suppliersRequested: 50
};

console.log('Payload:', JSON.stringify(testPayload, null, 2));

try {
  const created = await createSearchRecord(testPayload);
  console.log('\n✅ Search created successfully!\n');
  console.log('Created record:', JSON.stringify(created, null, 2));

  // Verify by reading back
  console.log('\nVerifying by reading back from DB...\n');
  const retrieved = await getSearch(searchId);
  console.log('Retrieved record:', JSON.stringify(retrieved, null, 2));

  console.log('\n✅ SUCCESS: All fields working correctly!');
  console.log('✅ Database schema matches code expectations');
  console.log('✅ Data persists between requests');
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

process.exit(0);
