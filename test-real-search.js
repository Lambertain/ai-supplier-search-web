/**
 * Real-world test for supplier search functionality
 * Tests with actual product search on production Railway instance
 */

const RAILWAY_URL = 'https://web-production-e6172.up.railway.app';

async function testSupplierSearch() {
  console.log('🧪 Starting real supplier search test...\n');

  // Test Case 1: China region - Ceramic mugs
  const testCase1 = {
    productDescription: 'Ceramic coffee mugs with custom logo printing, matte finish',
    quantity: '5000 pieces per month',
    targetPrice: '$2.50',
    additionalRequirements: 'Food-safe certification, dishwasher safe, microwave safe',
    preferredRegion: 'china',
    minSuppliers: 3,
    maxSuppliers: 5
  };

  console.log('📋 Test Case 1: China Region - Ceramic Mugs');
  console.log('Product:', testCase1.productDescription);
  console.log('Region:', testCase1.preferredRegion);
  console.log('Suppliers requested:', `${testCase1.minSuppliers}-${testCase1.maxSuppliers}\n`);

  try {
    console.log('🚀 Sending search request to Railway...');
    const startTime = Date.now();

    const response = await fetch(`${RAILWAY_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCase1)
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Search failed:', errorData);
      return;
    }

    const result = await response.json();
    console.log(`✅ Search completed in ${duration}s\n`);

    // Display results
    console.log('📊 SEARCH RESULTS:');
    console.log('─'.repeat(80));
    console.log(`Search ID: ${result.searchId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Suppliers validated: ${result.metrics?.suppliersValidated || 0}`);
    console.log(`Emails queued: ${result.emailResults?.filter(e => e.status === 'queued').length || 0}`);
    console.log(`Emails failed: ${result.emailResults?.filter(e => e.status === 'failed').length || 0}`);
    console.log('─'.repeat(80));

    // Display email results
    if (result.emailResults && result.emailResults.length > 0) {
      console.log('\n📧 EMAIL RESULTS:');
      result.emailResults.forEach((email, index) => {
        console.log(`\n  ${index + 1}. Supplier ID: ${email.supplierId}`);
        console.log(`     Status: ${email.status}`);
        console.log(`     Subject: ${email.subject || 'N/A'}`);
        if (email.jobId) {
          console.log(`     Job ID: ${email.jobId}`);
        }
        if (email.error) {
          console.log(`     Error: ${email.error}`);
        }
      });
    }

    // Verify supplier IDs format
    console.log('\n🔍 SUPPLIER ID VALIDATION:');
    const supplierIds = result.emailResults?.map(e => e.supplierId) || [];
    supplierIds.forEach(id => {
      const isValid = /^SUP_\d+_\d{3}$/.test(id);
      console.log(`  ${id}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    });

    console.log('\n✅ Test Case 1 completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Run test
console.log('═'.repeat(80));
console.log('🧪 REAL SUPPLIER SEARCH TEST');
console.log('═'.repeat(80));
console.log(`Target: ${RAILWAY_URL}`);
console.log(`Time: ${new Date().toLocaleString()}`);
console.log('═'.repeat(80));
console.log();

testSupplierSearch()
  .then(() => {
    console.log('\n═'.repeat(80));
    console.log('🎉 All tests completed!');
    console.log('═'.repeat(80));
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
