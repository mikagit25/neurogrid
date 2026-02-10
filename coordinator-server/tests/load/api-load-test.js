import { check, sleep } from 'k6';
import http from 'k6/http';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

/**
 * NeuroGrid API Load Testing Script
 * Tests coordinator-server performance under load
 */

// Test configuration
export const options = {
  stages: [
    // Warm up
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    
    // Load testing
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 50 },    // Stay at 50 users
    
    // Stress testing
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    
    // Peak testing
    { duration: '30s', target: 200 },  // Spike to 200 users
    { duration: '30s', target: 200 },  // Stay at 200 users
    
    // Ramp down
    { duration: '1m', target: 0 },     // Ramp down to 0 users
  ],
  
  thresholds: {
    // API Response time requirements
    'http_req_duration': ['p(95)<500'], // 95% of requests under 500ms
    'http_req_duration{name:health}': ['p(95)<100'], // Health checks under 100ms
    'http_req_duration{name:auth}': ['p(95)<1000'], // Auth under 1s
    'http_req_duration{name:tasks}': ['p(95)<2000'], // Tasks under 2s
    
    // Error rate requirements
    'http_req_failed': ['rate<0.02'], // Error rate under 2%
    'http_req_failed{name:health}': ['rate<0.01'], // Health checks under 1%
    
    // Throughput requirements
    'http_reqs': ['rate>50'], // More than 50 requests per second
  }
};

// Environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

// Test data
const testUsers = [
  { email: 'loadtest1@example.com', password: 'TestPass123!' },
  { email: 'loadtest2@example.com', password: 'TestPass123!' },
  { email: 'loadtest3@example.com', password: 'TestPass123!' },
];

const testTasks = [
  {
    model: 'gpt-3.5-turbo',
    type: 'text-generation',
    input_data: { prompt: 'Hello, world!' },
    parameters: { max_tokens: 50 }
  },
  {
    model: 'stable-diffusion-xl',
    type: 'image-generation',
    input_data: { prompt: 'A beautiful sunset over mountains' },
    parameters: { steps: 20, guidance_scale: 7.5 }
  }
];

// Authentication token cache
let authToken = null;

export function setup() {
  // Setup phase - authenticate and get token
  console.log('Setting up load test...');
  
  // Test if server is accessible
  const healthCheck = http.get(`${BASE_URL}/api/v1/health`);
  if (healthCheck.status !== 200) {
    console.error('Server health check failed!');
    return null;
  }
  
  return { authToken };
}

export default function(data) {
  // Main test function - runs for each virtual user
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test/1.0'
    }
  };
  
  // Add authentication if available
  if (data && data.authToken) {
    params.headers['Authorization'] = `Bearer ${data.authToken}`;
  } else if (API_KEY) {
    params.headers['X-API-Key'] = API_KEY;
  }
  
  // Test scenario: Mix of different API calls
  const scenario = Math.floor(Math.random() * 4);
  
  switch (scenario) {
    case 0:
      testHealthCheck();
      break;
    case 1:
      testAuthEndpoints();
      break;
    case 2:
      testTaskSubmission(params);
      break;
    case 3:
      testAnalytics(params);
      break;
  }
  
  // Random think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

function testHealthCheck() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/v1/health`, null, { tags: { name: 'health' } }],
    ['GET', `${BASE_URL}/metrics`, null, { tags: { name: 'metrics' } }]
  ]);
  
  responses.forEach((response, index) => {
    const endpoint = ['health', 'metrics'][index];
    
    check(response, {
      [`${endpoint} status is 200`]: (r) => r.status === 200,
      [`${endpoint} response time < 200ms`]: (r) => r.timings.duration < 200,
      [`${endpoint} has valid response`]: (r) => r.body && r.body.length > 0
    });
  });
}

function testAuthEndpoints() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  // Login attempt
  const loginResponse = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth' }
    }
  );
  
  check(loginResponse, {
    'auth login status is 200 or 401': (r) => [200, 401].includes(r.status),
    'auth login response time < 1s': (r) => r.timings.duration < 1000,
    'auth login has response body': (r) => r.body && r.body.length > 0
  });
}

function testTaskSubmission(params) {
  const task = testTasks[Math.floor(Math.random() * testTasks.length)];
  
  // Submit task
  const taskResponse = http.post(
    `${BASE_URL}/api/v1/tasks`,
    JSON.stringify(task),
    {
      ...params,
      tags: { name: 'tasks' }
    }
  );
  
  check(taskResponse, {
    'task submission status is 201 or 401': (r) => [201, 401].includes(r.status),
    'task submission response time < 2s': (r) => r.timings.duration < 2000
  });
}

function testAnalytics(params) {
  const analyticsEndpoints = [
    '/api/v1/analytics/overview',
    '/api/v1/analytics/tasks',
    '/api/v1/analytics/nodes'
  ];
  
  const endpoint = analyticsEndpoints[Math.floor(Math.random() * analyticsEndpoints.length)];
  
  const analyticsResponse = http.get(
    `${BASE_URL}${endpoint}`,
    {
      ...params,
      tags: { name: 'analytics' }
    }
  );
  
  check(analyticsResponse, {
    'analytics status is 200 or 401': (r) => [200, 401].includes(r.status),
    'analytics response time < 1s': (r) => r.timings.duration < 1000
  });
}

export function teardown(data) {
  // Cleanup phase
  console.log('Tearing down load test...');
  
  // Final health check
  const finalHealth = http.get(`${BASE_URL}/api/v1/health`);
  
  console.log(`Final server status: ${finalHealth.status}`);
  console.log('Load test completed!');
}

// Generate HTML report
export function handleSummary(data) {
  return {
    'load-test-results.html': htmlReport(data),
    stdout: '\n' + JSON.stringify(data, null, 2) + '\n'
  };
}