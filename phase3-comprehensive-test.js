#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Test Configuration
const BASE_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 5000;

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};

// Test results storage
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

// Helper function for making HTTP requests
function makeRequest(method, url, data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'NeuroGrid-Phase3-Test/1.0'
            },
            timeout: TEST_TIMEOUT
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const jsonBody = body ? JSON.parse(body) : {};
                    resolve({ 
                        statusCode: res.statusCode, 
                        data: jsonBody,
                        headers: res.headers 
                    });
                } catch (error) {
                    resolve({ 
                        statusCode: res.statusCode, 
                        data: body,
                        headers: res.headers 
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Test runner function
async function runTest(testName, testFunction) {
    const startTime = performance.now();
    testResults.total++;
    
    try {
        console.log(`\n${colors.blue}[TEST]${colors.reset} ${testName}`);
        
        await testFunction();
        
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        console.log(`${colors.green}[PASS]${colors.reset} ${testName} (${duration}ms)`);
        testResults.passed++;
        testResults.details.push({ name: testName, status: 'PASS', duration });
        
    } catch (error) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        console.log(`${colors.red}[FAIL]${colors.reset} ${testName} (${duration}ms)`);
        console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        testResults.failed++;
        testResults.details.push({ name: testName, status: 'FAIL', duration, error: error.message });
    }
}

// Individual test functions
async function testAPIConnectivity() {
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/status`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Status endpoint returned success: false');
    }
    
    // Check for phase3_id or phase3Id in different locations
    const phase3Id = response.data.phase3_id || 
                     response.data.phase3Id ||
                     (response.data.data && response.data.data.phase3Id) ||
                     (response.data.data && response.data.data.phase3_id);
    
    if (!phase3Id) {
        throw new Error('Missing phase3_id/phase3Id in response');
    }
    
    console.log(`   Phase 3 ID: ${phase3Id}`);
    console.log(`   Status: ${response.data.data ? 'Phase 3 Active' : response.data.status || 'Active'}`);
}

async function testModelsListAPI() {
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/models`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Models API returned success: false');
    }
    
    if (!response.data.data.models || !Array.isArray(response.data.data.models)) {
        throw new Error('Missing or invalid models array in response');
    }
    
    const models = response.data.data.models;
    console.log(`   Found ${models.length} models`);
    
    // Validate model structure
    for (const model of models.slice(0, 2)) {
        if (!model.id || !model.name || !model.type) {
            throw new Error(`Invalid model structure: ${JSON.stringify(model)}`);
        }
        console.log(`   Model: ${model.name} (${model.type})`);
    }
}

async function testSpecificModelAPI() {
    const modelId = 'artist-stable-diffusion';
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/models/${modelId}`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Model details API returned success: false');
    }
    
    const model = response.data.data.model;
    if (!model.id || model.id !== modelId) {
        throw new Error(`Expected model ID ${modelId}, got ${model.id}`);
    }
    
    console.log(`   Model ID: ${model.id}`);
    console.log(`   Model Name: ${model.name}`);
}

async function testModelInferenceAPI() {
    const modelId = 'community-llama2-finetuned';
    const testInput = { prompt: 'Test Phase 3 functionality' };
    
    const response = await makeRequest('POST', `${BASE_URL}/api/v3/sdk/models/${modelId}/call`, {
        input: testInput,
        options: { max_tokens: 100 }
    });
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Model inference API returned success: false');
    }
    
    const result = response.data.data.result;
    if (!result.model_id || result.model_id !== modelId) {
        throw new Error(`Expected model_id ${modelId}, got ${result.model_id}`);
    }
    
    console.log(`   Input: ${JSON.stringify(testInput)}`);
    console.log(`   Output: ${result.output}`);
    console.log(`   Processing time: ${result.processing_time}`);
}

async function testGovernanceProposals() {
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/governance/proposals`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Governance API returned success: false');
    }
    
    const proposals = response.data.data.proposals;
    if (!Array.isArray(proposals)) {
        throw new Error('Expected proposals to be an array');
    }
    
    console.log(`   Found ${proposals.length} proposals`);
    
    for (const proposal of proposals.slice(0, 2)) {
        if (!proposal.id || !proposal.title || !proposal.status) {
            throw new Error(`Invalid proposal structure: ${JSON.stringify(proposal)}`);
        }
        console.log(`   Proposal: ${proposal.title} (${proposal.status})`);
        console.log(`     Votes: ${proposal.votes_for} for, ${proposal.votes_against} against`);
    }
}

async function testGovernanceVoting() {
    const proposalId = 'prop-001';
    const voteChoice = 'for';
    
    const response = await makeRequest('POST', 
        `${BASE_URL}/api/v3/sdk/governance/proposals/${proposalId}/vote`, {
            choice: voteChoice
        });
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Voting API returned success: false');
    }
    
    const vote = response.data.data.vote;
    if (vote.proposal_id !== proposalId || vote.choice !== voteChoice) {
        throw new Error(`Vote mismatch: expected ${proposalId}/${voteChoice}, got ${vote.proposal_id}/${vote.choice}`);
    }
    
    console.log(`   Voted ${voteChoice} on proposal ${proposalId}`);
    console.log(`   Voting power: ${vote.voting_power}`);
    console.log(`   Transaction ID: ${vote.transaction_id}`);
}

async function testAnalyticsLeaderboard() {
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/analytics/leaderboard`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Analytics API returned success: false');
    }
    
    const leaderboard = response.data.data.leaderboard;
    if (!Array.isArray(leaderboard)) {
        throw new Error('Expected leaderboard to be an array');
    }
    
    console.log(`   Leaderboard type: ${response.data.data.type}`);
    console.log(`   Found ${leaderboard.length} entries`);
    
    for (const entry of leaderboard.slice(0, 3)) {
        console.log(`   ${entry.rank}. ${entry.name} - Performance: ${entry.performance || 'N/A'}`);
    }
}

async function testAnalyticsUserStats() {
    const userId = 'test-user-123';
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/analytics/users/${userId}`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('User analytics API returned success: false');
    }
    
    const stats = response.data.data.stats;
    if (!stats || typeof stats !== 'object') {
        throw new Error('Invalid user stats structure');
    }
    
    console.log(`   User ID: ${response.data.data.user_id}`);
    console.log(`   Total requests: ${stats.total_requests}`);
    console.log(`   Success rate: ${Math.round((stats.successful_requests/stats.total_requests)*100)}%`);
    console.log(`   Total spent: ${stats.total_spent}`);
}

async function testCodeExamples() {
    const languages = ['javascript', 'python', 'go', 'rust'];
    
    for (const language of languages) {
        const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/examples/${language}`);
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected status 200 for ${language}, got ${response.statusCode}`);
        }
        
        if (!response.data.success) {
            throw new Error(`Code examples API returned success: false for ${language}`);
        }
        
        const examples = response.data.data;
        if (!examples.setup || !examples.listModels || !examples.callModel) {
            throw new Error(`Missing code examples for ${language}`);
        }
        
        console.log(`   ${language}: setup, listModels, callModel examples available`);
    }
}

async function testEnterpriseConfig() {
    const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/enterprise/config`);
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('Enterprise config API returned success: false');
    }
    
    const config = response.data.data.enterprise_features;
    if (!config || typeof config !== 'object') {
        throw new Error('Invalid enterprise config structure');
    }
    
    console.log(`   SLA guarantee: ${config.sla_guarantee}`);
    console.log(`   Priority support: ${config.priority_support}`);
    console.log(`   API rate limit: ${config.api_rate_limits.requests_per_minute}/min`);
}

async function testAPIKeyValidation() {
    const testApiKey = 'test-api-key-1234567890';
    
    const response = await makeRequest('POST', `${BASE_URL}/api/v3/sdk/validate-key`, {
        apiKey: testApiKey
    });
    
    if (response.statusCode !== 200) {
        throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    if (!response.data.success) {
        throw new Error('API key validation returned success: false');
    }
    
    const validation = response.data.data;
    if (typeof validation.valid !== 'boolean') {
        throw new Error('Invalid validation response structure');
    }
    
    console.log(`   API key validation: ${validation.valid ? 'valid' : 'invalid'}`);
    console.log(`   Permissions: ${validation.permissions.join(', ')}`);
    console.log(`   Rate limit remaining: ${validation.rate_limits.remaining}`);
}

async function testErrorHandling() {
    // Test 404 endpoint
    try {
        const response = await makeRequest('GET', `${BASE_URL}/api/v3/non-existent-endpoint`);
        
        if (response.statusCode !== 404) {
            throw new Error(`Expected 404 for non-existent endpoint, got ${response.statusCode}`);
        }
        
        console.log('   ✓ 404 handling works correctly');
    } catch (error) {
        throw new Error(`404 test failed: ${error.message}`);
    }
    
    // Test invalid model ID
    try {
        const response = await makeRequest('GET', `${BASE_URL}/api/v3/sdk/models/invalid-model-id`);
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200 for invalid model ID, got ${response.statusCode}`);
        }
        
        // Should still return success but with appropriate data
        console.log('   ✓ Invalid model ID handling works correctly');
    } catch (error) {
        throw new Error(`Invalid model ID test failed: ${error.message}`);
    }
}

async function performanceTest() {
    const endpoints = [
        '/api/v3/status',
        '/api/v3/sdk/models',
        '/api/v3/sdk/governance/proposals',
        '/api/v3/sdk/analytics/leaderboard',
        '/api/v3/sdk/examples/javascript'
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
        const startTime = performance.now();
        
        try {
            const response = await makeRequest('GET', `${BASE_URL}${endpoint}`);
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            
            results.push({ endpoint, duration, status: response.statusCode });
            console.log(`   ${endpoint}: ${duration}ms (${response.statusCode})`);
            
        } catch (error) {
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            results.push({ endpoint, duration, status: 'ERROR' });
            console.log(`   ${endpoint}: ${duration}ms (ERROR)`);
        }
    }
    
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);
    console.log(`   Average response time: ${avgDuration}ms`);
    
    if (avgDuration > 500) {
        throw new Error(`Average response time too high: ${avgDuration}ms`);
    }
}

// Main test execution
async function runAllTests() {
    console.log(`${colors.magenta}🧪 NeuroGrid Phase 3 Comprehensive Test Suite${colors.reset}`);
    console.log(`${colors.blue}Target: ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Timeout: ${TEST_TIMEOUT}ms${colors.reset}\n`);
    
    // Core API Tests
    await runTest('API Connectivity', testAPIConnectivity);
    await runTest('Models List API', testModelsListAPI);
    await runTest('Specific Model API', testSpecificModelAPI);
    await runTest('Model Inference API', testModelInferenceAPI);
    
    // Governance Tests
    await runTest('Governance Proposals', testGovernanceProposals);
    await runTest('Governance Voting', testGovernanceVoting);
    
    // Analytics Tests
    await runTest('Analytics Leaderboard', testAnalyticsLeaderboard);
    await runTest('User Analytics', testAnalyticsUserStats);
    
    // Developer Tools Tests
    await runTest('Code Examples Generation', testCodeExamples);
    await runTest('Enterprise Configuration', testEnterpriseConfig);
    await runTest('API Key Validation', testAPIKeyValidation);
    
    // System Tests
    await runTest('Error Handling', testErrorHandling);
    await runTest('Performance Test', performanceTest);
    
    // Test Summary
    console.log(`\n${colors.magenta}📊 Test Results Summary${colors.reset}`);
    console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
    console.log(`Total: ${testResults.total}`);
    console.log(`Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
    
    // Detailed Results
    if (testResults.failed > 0) {
        console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
        testResults.details
            .filter(test => test.status === 'FAIL')
            .forEach(test => {
                console.log(`  ${colors.red}✗${colors.reset} ${test.name}: ${test.error}`);
            });
    }
    
    console.log(`\n${colors.blue}Performance Summary:${colors.reset}`);
    const avgTime = Math.round(
        testResults.details.reduce((sum, test) => sum + test.duration, 0) / testResults.details.length
    );
    console.log(`Average test duration: ${avgTime}ms\n`);
    
    // Exit with appropriate code
    if (testResults.failed > 0) {
        console.log(`${colors.red}❌ Some tests failed. Please review and fix issues.${colors.reset}`);
        process.exit(1);
    } else {
        console.log(`${colors.green}✅ All tests passed! Phase 3 is ready for production.${colors.reset}`);
        process.exit(0);
    }
}

// Run the test suite
if (require.main === module) {
    runAllTests().catch((error) => {
        console.error(`${colors.red}Fatal error running test suite:${colors.reset}`, error);
        process.exit(1);
    });
}

module.exports = { runAllTests };