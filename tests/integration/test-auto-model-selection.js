#!/usr/bin/env node
/**
 * Test script for auto model selection functionality
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3001';

// Test scenarios
const testCases = [
  {
    name: 'Auto Model Selection (text)',
    request: {
      message: 'Hello, how are you?',
      model: 'auto',
    }
  },
  {
    name: 'Auto Text Model Selection',
    request: {
      message: 'Tell me a joke.',
      model: 'auto-text',
    }
  },
  {
    name: 'Auto Model with Provider Preference',
    request: {
      message: 'What is AI?',
      model: 'auto',
      provider: 'huggingface'
    }
  },
  {
    name: 'Specific Model (normal flow)', 
    request: {
      message: 'Explain machine learning.',
      model: 'gemini-pro',
      provider: 'google-gemini'
    }
  }
];

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

async function runTest(testCase) {
  console.log(`\n${colors.blue}${colors.bold}Testing: ${testCase.name}${colors.reset}`);
  console.log(`Request: ${JSON.stringify(testCase.request, null, 2)}`);
  
  try {
    const response = await axios.post(`${SERVER_URL}/api/ai/chat`, testCase.request, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log(`${colors.green}✅ SUCCESS${colors.reset}`);
      console.log(`Provider Used: ${colors.yellow}${response.data.provider_used}${colors.reset}`);
      console.log(`Model: ${colors.yellow}${response.data.model}${colors.reset}`);
      console.log(`Tokens: ${response.data.tokens_used || 'N/A'}`);
      console.log(`Processing Time: ${response.data.processing_time}ms`);
      console.log(`Response: ${response.data.text?.substring(0, 100) || response.data.data?.substring(0, 100)}...`);
      return true;
    } else {
      console.log(`${colors.red}❌ API ERROR${colors.reset}`);
      console.log(`Error: ${response.data.error}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ REQUEST FAILED${colors.reset}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`Error: ${error.message}`);
    }
    return false;
  }
}

async function checkServerHealth() {
  console.log(`${colors.blue}${colors.bold}🩺 Checking server health...${colors.reset}`);
  
  try {
    const response = await axios.get(`${SERVER_URL}/api/ai/models`, {
      timeout: 5000
    });
    
    if (response.data && response.data.success && response.data.data && response.data.data.providers) {
      console.log(`${colors.green}✅ Server is healthy${colors.reset}`);
      console.log(`Available providers: ${Object.keys(response.data.data.providers).join(', ')}`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠️ Server responding but no providers configured${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Server not responding${colors.reset}`);
    console.log(`Error: ${error.message}`);
    console.log(`\n${colors.yellow}💡 Please start the test server first:${colors.reset}`);
    console.log(`   node test-ai-server.js`);
    return false;
  }
}

async function main() {
  console.log(`${colors.bold}🚀 Auto Model Selection Test Suite${colors.reset}`);
  console.log(`Server: ${SERVER_URL}`);
  
  // Check server health
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }
  
  console.log(`\n${colors.blue}${colors.bold}📋 Running ${testCases.length} test cases...${colors.reset}`);
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const success = await runTest(testCase);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Results summary
  console.log(`\n${colors.bold}📊 Test Results Summary${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${testCases.length}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}${colors.bold}🎉 All tests passed! Auto model selection is working correctly.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ ${failed} test(s) failed. Please review the errors above.${colors.reset}`);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}⏹️ Test interrupted by user${colors.reset}`);
  process.exit(130);
});

main().catch(error => {
  console.error(`${colors.red}${colors.bold}💥 Unexpected error:${colors.reset}`, error);
  process.exit(1);
});