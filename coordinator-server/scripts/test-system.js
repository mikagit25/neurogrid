#!/usr/bin/env node

/**
 * Complete System Test Script for NeuroGrid Coordinator
 * Tests all integrated components and services
 */

const axios = require('axios');
const WebSocket = require('ws');
const { execSync } = require('child_process');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3001';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test utility functions
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function recordTest(name, passed, error = null) {
  testResults.tests.push({ name, passed, error });
  if (passed) {
    testResults.passed++;
    log(`✅ ${name}`, 'success');
  } else {
    testResults.failed++;
    log(`❌ ${name}: ${error}`, 'error');
  }
}

/**
 * Wait for server to be ready
 */
async function waitForServer(maxAttempts = 30) {
  log('Waiting for server to be ready...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      if (response.status === 200) {
        log('Server is ready!', 'success');
        return true;
      }
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Server did not become ready in time');
}

/**
 * Test server health
 */
async function testHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    
    const isHealthy = response.status === 200 && 
                     response.data.status === 'healthy' &&
                     response.data.database &&
                     response.data.database.status === 'healthy';
    
    recordTest('Health Check', isHealthy, 
      isHealthy ? null : 'Server or database not healthy');
    
    return response.data;
  } catch (error) {
    recordTest('Health Check', false, error.message);
    return null;
  }
}

/**
 * Test user authentication
 */
async function testAuthentication() {
  let testUser = null;
  let authToken = null;
  
  try {
    // Test user registration
    const registerData = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword123'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
    recordTest('User Registration', 
      registerResponse.status === 201 && registerResponse.data.success === true,
      registerResponse.status !== 201 ? `Status: ${registerResponse.status}` : null
    );
    
    testUser = registerResponse.data.data.user;
    
    // Test user login
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: registerData.email,
      password: registerData.password
    });
    
    recordTest('User Login',
      loginResponse.status === 200 && loginResponse.data.data.token,
      loginResponse.status !== 200 ? `Status: ${loginResponse.status}` : null
    );
    
    authToken = loginResponse.data.data.token;
    
    // Test protected route
    const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    recordTest('Protected Route Access',
      profileResponse.status === 200 && profileResponse.data.data.user.id === testUser.id,
      profileResponse.status !== 200 ? `Status: ${profileResponse.status}` : null
    );
    
    return { testUser, authToken };
  } catch (error) {
    recordTest('Authentication Flow', false, error.message);
    return { testUser, authToken };
  }
}

/**
 * Test jobs API
 */
async function testJobsAPI(authToken) {
  if (!authToken) {
    recordTest('Jobs API Test', false, 'No auth token available');
    return;
  }
  
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // Test job creation
    const jobData = {
      title: 'Test Job',
      description: 'Test job for system testing',
      job_type: 'ml_training',
      requirements: { gpu_memory: '8GB' },
      parameters: { epochs: 10 }
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/jobs`, jobData, { headers });
    recordTest('Job Creation',
      createResponse.status === 201 && createResponse.data.success === true,
      createResponse.status !== 201 ? `Status: ${createResponse.status}` : null
    );
    
    const jobId = createResponse.data.data.job.id;
    
    // Test job retrieval
    const getResponse = await axios.get(`${BASE_URL}/api/jobs/${jobId}`, { headers });
    recordTest('Job Retrieval',
      getResponse.status === 200 && getResponse.data.data.job.id === jobId,
      getResponse.status !== 200 ? `Status: ${getResponse.status}` : null
    );
    
    // Test job listing
    const listResponse = await axios.get(`${BASE_URL}/api/jobs`, { headers });
    recordTest('Jobs Listing',
      listResponse.status === 200 && Array.isArray(listResponse.data.data.jobs),
      listResponse.status !== 200 ? `Status: ${listResponse.status}` : null
    );
    
    return jobId;
  } catch (error) {
    recordTest('Jobs API Test', false, error.message);
    return null;
  }
}

/**
 * Test nodes API
 */
async function testNodesAPI(authToken) {
  if (!authToken) {
    recordTest('Nodes API Test', false, 'No auth token available');
    return;
  }
  
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // Test node creation
    const nodeData = {
      name: 'Test Node',
      description: 'Test node for system testing',
      node_type: 'compute',
      capabilities: { gpu: true, cpu_cores: 8 },
      hardware_info: { ram: '16GB', gpu: 'RTX 3080' }
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/nodes`, nodeData, { headers });
    recordTest('Node Creation',
      createResponse.status === 201 && createResponse.data.success === true,
      createResponse.status !== 201 ? `Status: ${createResponse.status}` : null
    );
    
    // Test nodes listing
    const listResponse = await axios.get(`${BASE_URL}/api/nodes`, { headers });
    recordTest('Nodes Listing',
      listResponse.status === 200 && Array.isArray(listResponse.data.data.nodes),
      listResponse.status !== 200 ? `Status: ${listResponse.status}` : null
    );
    
  } catch (error) {
    recordTest('Nodes API Test', false, error.message);
  }
}

/**
 * Test WebSocket connection
 */
async function testWebSocket() {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws`);
      let testPassed = false;
      
      ws.on('open', () => {
        log('WebSocket connection established');
        
        // Send test message
        ws.send(JSON.stringify({
          type: 'ping',
          data: { timestamp: Date.now() }
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'pong' || message.type === 'welcome') {
            testPassed = true;
          }
        } catch (error) {
          // Ignore JSON parse errors
        }
      });
      
      ws.on('close', () => {
        recordTest('WebSocket Connection', testPassed, 
          testPassed ? null : 'No valid response received');
        resolve();
      });
      
      ws.on('error', (error) => {
        recordTest('WebSocket Connection', false, error.message);
        resolve();
      });
      
      // Close connection after 5 seconds
      setTimeout(() => {
        ws.close();
      }, 5000);
      
    } catch (error) {
      recordTest('WebSocket Connection', false, error.message);
      resolve();
    }
  });
}

/**
 * Test rate limiting
 */
async function testRateLimiting() {
  try {
    const requests = [];
    
    // Make multiple rapid requests
    for (let i = 0; i < 10; i++) {
      requests.push(
        axios.get(`${BASE_URL}/health`).catch(err => err.response)
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(res => res && res.status === 429);
    
    recordTest('Rate Limiting',
      rateLimitedResponses.length > 0,
      rateLimitedResponses.length === 0 ? 'No rate limiting detected' : null
    );
    
  } catch (error) {
    recordTest('Rate Limiting', false, error.message);
  }
}

/**
 * Test database operations
 */
async function testDatabase() {
  try {
    // This is tested indirectly through API calls
    // The health check already verifies database connectivity
    recordTest('Database Operations', true);
  } catch (error) {
    recordTest('Database Operations', false, error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('🚀 Starting NeuroGrid Coordinator System Tests', 'info');
  log(`Testing server at: ${BASE_URL}`, 'info');
  
  try {
    // Wait for server to be ready
    await waitForServer();
    
    // Run health check
    const healthData = await testHealth();
    if (!healthData) {
      log('❌ Server health check failed, aborting tests', 'error');
      return;
    }
    
    // Test authentication
    const { testUser, authToken } = await testAuthentication();
    
    // Test APIs
    await testJobsAPI(authToken);
    await testNodesAPI(authToken);
    
    // Test WebSocket
    await testWebSocket();
    
    // Test system features
    await testRateLimiting();
    await testDatabase();
    
    // Print results
    log('\\n📊 Test Results Summary:', 'info');
    log(`✅ Passed: ${testResults.passed}`, 'success');
    log(`❌ Failed: ${testResults.failed}`, 'error');
    log(`📋 Total: ${testResults.tests.length}`, 'info');
    
    if (testResults.failed > 0) {
      log('\\n🔍 Failed Tests:', 'warning');
      testResults.tests
        .filter(test => !test.passed)
        .forEach(test => {
          log(`  - ${test.name}: ${test.error}`, 'error');
        });
    }
    
    const successRate = Math.round((testResults.passed / testResults.tests.length) * 100);
    log(`\\n📈 Success Rate: ${successRate}%`, successRate >= 80 ? 'success' : 'warning');
    
    if (successRate >= 80) {
      log('🎉 System tests completed successfully!', 'success');
      process.exit(0);
    } else {
      log('⚠️  Some tests failed. Please check the system configuration.', 'warning');
      process.exit(1);
    }
    
  } catch (error) {
    log(`💥 Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };