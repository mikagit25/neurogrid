#!/usr/bin/env node

const fetch = require('node-fetch').default || require('node-fetch');

async function testAPI() {
  console.log('🧪 Testing NeuroGrid Smart Model Router API...\n');

  try {
    // Test 1: Available coordinators
    console.log('📋 Testing /api/models/available...');
    const coordResponse = await fetch('http://localhost:8080/api/models/available');
    if (coordResponse.ok) {
      const coordinators = await coordResponse.json();
      console.log('✅ Available coordinators:', JSON.stringify(coordinators, null, 2));
    } else {
      console.log('❌ Failed to get coordinators:', coordResponse.status);
    }

    console.log('\n' + '─'.repeat(50) + '\n');

    // Test 2: Smart AI Processing
    console.log('🤖 Testing /api/ai/process...');
    const processResponse = await fetch('http://localhost:8080/api/ai/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Create a simple React functional component called HelloWorld',
        type: 'code-generation',
        complexity: 'low',
        preferredProvider: 'openai'
      })
    });

    if (processResponse.ok) {
      const result = await processResponse.json();
      console.log('✅ Smart AI Processing Result:', JSON.stringify(result, null, 2));
    } else {
      const error = await processResponse.text();
      console.log('❌ AI Processing failed:', processResponse.status, error);
    }

    console.log('\n' + '─'.repeat(50) + '\n');

    // Test 3: Stats
    console.log('📊 Testing /api/models/stats...');
    const statsResponse = await fetch('http://localhost:8080/api/models/stats');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ System Stats:', JSON.stringify(stats, null, 2));
    } else {
      console.log('❌ Failed to get stats:', statsResponse.status);
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    console.log('\n📝 Make sure the server is running:');
    console.log('   GOOGLE_API_KEY=test-key OPENAI_API_KEY=test-key node enhanced-server.js');
  }
}

testAPI();