#!/usr/bin/env node

// Quick integration test for Phase 3 on main enhanced-server (port 3001)

const http = require('http');
const BASE_URL = 'http://localhost:3001';

// Make HTTP request helper
function makeRequest(method, url, data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const jsonBody = body ? JSON.parse(body) : {};
                    resolve({ statusCode: res.statusCode, data: jsonBody });
                } catch (error) {
                    resolve({ statusCode: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runQuickTests() {
    console.log('🔍 Quick Phase 3 Integration Test (Enhanced Server - Port 3001)\n');
    
    const tests = [
        {
            name: 'Phase 3 Status',
            url: '/api/v3/status',
            method: 'GET'
        },
        {
            name: 'SDK Models List',
            url: '/api/v3/sdk/models',
            method: 'GET'
        },
        {
            name: 'Governance Proposals',
            url: '/api/v3/sdk/governance/proposals',
            method: 'GET'
        },
        {
            name: 'Analytics Leaderboard',
            url: '/api/v3/sdk/analytics/leaderboard',
            method: 'GET'
        },
        {
            name: 'Code Examples JS',
            url: '/api/v3/sdk/examples/javascript',
            method: 'GET'
        },
        {
            name: 'Enterprise Config',
            url: '/api/v3/sdk/enterprise/config',
            method: 'GET'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            console.log(`Testing: ${test.name}`);
            
            const response = await makeRequest(test.method, `${BASE_URL}${test.url}`, test.data);
            
            if (response.statusCode === 200 && response.data.success) {
                console.log(`  ✅ ${test.name} - OK (${response.statusCode})`);
                passed++;
            } else {
                console.log(`  ❌ ${test.name} - Failed (${response.statusCode})`);
                console.log(`     Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
                failed++;
            }
            
        } catch (error) {
            console.log(`  ❌ ${test.name} - Error: ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All Phase 3 integration tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Check server logs for details.');
    }
}

runQuickTests().catch(console.error);