#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

console.log('\n🧪 Testing Opportunities4Africa Bot...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Environment Variables
  console.log('Test 1: Environment Variables');
  try {
    if (process.env.BOT_TOKEN && process.env.CHANNEL_ID && process.env.ADMIN_USER_ID) {
      console.log('✅ PASSED - All required env vars present\n');
      passed++;
    } else {
      console.log('❌ FAILED - Missing required env vars\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - ${error.message}\n`);
    failed++;
  }

  // Test 2: Bot Server Running
  console.log('Test 2: Bot Server');
  try {
    const response = await axios.get('http://localhost:3000', { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ PASSED - Server is responding\n');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Bot: ${response.data.bot}\n`);
      passed++;
    } else {
      console.log('❌ FAILED - Server returned unexpected status\n');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED - Server not responding');
    console.log('💡 Make sure bot is running: npm run dev\n');
    failed++;
  }

  // Test 3: Health Endpoint
  console.log('Test 3: Health Check');
  try {
    const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    if (response.status === 200 && response.data.status === 'healthy') {
      console.log('✅ PASSED - Health check OK\n');
      passed++;
    } else {
      console.log('❌ FAILED - Health check failed\n');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED - Health endpoint not accessible\n');
    failed++;
  }

  // Test 4: Status Endpoint
  console.log('Test 4: Status Endpoint');
  try {
    const response = await axios.get('http://localhost:3000/status', { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ PASSED - Status endpoint working\n');
      console.log(`   Total posts: ${response.data.total_opportunities_posted}`);
      console.log(`   Cache size: ${response.data.cache_size}\n`);
      passed++;
    } else {
      console.log('❌ FAILED - Status endpoint failed\n');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED - Status endpoint not accessible\n');
    failed++;
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 TEST SUMMARY\n');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    console.log('✅ Your bot is working correctly!');
    console.log('💡 Test it in Telegram by sending a message to your bot\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed\n');
    console.log('🔧 Please check the errors above\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});
