// Test script to verify settings API endpoint works correctly
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

console.log('Testing settings API endpoint...\n');

// Test 1: GET settings
console.log('1. GET /api/settings');
const getResponse = await fetch(`${API_BASE}/api/settings`);
const currentSettings = await getResponse.json();
console.log('Status:', getResponse.status);
console.log('Current settings:', JSON.stringify(currentSettings, null, 2));
console.log('');

// Test 2: PUT settings with API keys
console.log('2. PUT /api/settings with API keys');
const testPayload = {
  apiKeys: {
    openai: 'sk-test-key-12345',
    sendgrid: 'SG.test-key-67890'
  },
  searchConfig: {
    temperature: 0.7
  }
};

console.log('Payload:', JSON.stringify(testPayload, null, 2));

const putResponse = await fetch(`${API_BASE}/api/settings`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPayload)
});

const result = await putResponse.json();
console.log('Status:', putResponse.status);
console.log('Response:', JSON.stringify(result, null, 2));

if (putResponse.status !== 200) {
  console.error('\n❌ ERROR: Settings save failed');
  if (result.errors) {
    console.error('Validation errors:');
    result.errors.forEach(err => {
      console.error(`  - ${err.field}: ${err.message}`);
    });
  }
  process.exit(1);
}

// Test 3: Verify keys were saved
console.log('\n3. GET /api/settings again to verify');
const verifyResponse = await fetch(`${API_BASE}/api/settings`);
const updatedSettings = await verifyResponse.json();
console.log('Status:', verifyResponse.status);
console.log('Updated settings:', JSON.stringify(updatedSettings, null, 2));

// Check if secrets are now set
if (updatedSettings.secrets?.openai && updatedSettings.secrets?.sendgrid) {
  console.log('\n✅ SUCCESS: API keys saved correctly!');
  console.log('✅ OpenAI key status:', updatedSettings.secrets.openai);
  console.log('✅ SendGrid key status:', updatedSettings.secrets.sendgrid);
} else {
  console.log('\n❌ ERROR: API keys not saved');
  console.log('Secrets:', updatedSettings.secrets);
  process.exit(1);
}

process.exit(0);
