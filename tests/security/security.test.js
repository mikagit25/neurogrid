/**
 * Security and Authentication Tests
 * 
 * Tests security features, authentication, authorization, and attack prevention
 */

const request = require('supertest');
const app = require('../../enhanced-server');

describe('Security Tests', () => {
    let server;

    beforeAll(async () => {
        server = app.listen(0);
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits on task submissions', async () => {
            const promises = [];

            // Attempt to exceed rate limit
            for (let i = 0; i < 15; i++) {
                promises.push(
                    request(app)
                        .post('/api/tasks')
                        .send({
                            type: 'text-generation',
                            input: `Rate limit test ${i}`,
                            priority: 'normal'
                        })
                );
            }

            const responses = await Promise.all(promises);

            // Some requests should be rate limited
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            const successfulResponses = responses.filter(r => r.status === 201);

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
            expect(successfulResponses.length).toBeGreaterThan(0);

            // Rate limited responses should have proper headers
            rateLimitedResponses.forEach(response => {
                expect(response.headers).toHaveProperty('x-ratelimit-limit');
                expect(response.headers).toHaveProperty('x-ratelimit-remaining');
                expect(response.headers).toHaveProperty('x-ratelimit-reset');
            });
        });

        test('should have different rate limits for different endpoints', async () => {
            // Test health endpoint (should have higher or no limit)
            const healthPromises = Array(10).fill().map(() =>
                request(app).get('/health')
            );

            const healthResponses = await Promise.all(healthPromises);

            // Health checks should mostly succeed
            const healthSuccesses = healthResponses.filter(r => r.status === 200);
            expect(healthSuccesses.length).toBeGreaterThanOrEqual(8);
        });
    });

    describe('Input Validation and Sanitization', () => {
        test('should reject malicious input in task requests', async () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '{{constructor.constructor("return process")()}}',
                '"; DROP TABLE tasks; --',
                '../../../etc/passwd',
                'javascript:alert(1)',
                '${7*7}',
                '<%=7*7%>',
                'eval("console.log(\'injected\')")'
            ];

            for (const maliciousInput of maliciousInputs) {
                const response = await request(app)
                    .post('/api/tasks')
                    .send({
                        type: 'text-generation',
                        input: maliciousInput,
                        priority: 'normal'
                    });

                // Should either reject or sanitize
                if (response.status === 201) {
                    // If accepted, should be sanitized
                    const taskId = response.body.taskId;
                    const statusResponse = await request(app).get(`/api/tasks/${taskId}`);

                    // The stored input should not contain the original malicious content
                    const storedInput = statusResponse.body.task.input;
                    expect(storedInput).not.toBe(maliciousInput);
                } else {
                    // Rejection is also acceptable
                    expect([400, 422]).toContain(response.status);
                }
            }
        });

        test('should validate task type enumeration', async () => {
            const invalidTypes = [
                'invalid-type',
                'system-admin',
                'sql-injection',
                'file-access',
                '../../../secret',
                null,
                undefined,
                123,
                { type: 'object' }
            ];

            for (const invalidType of invalidTypes) {
                const response = await request(app)
                    .post('/api/tasks')
                    .send({
                        type: invalidType,
                        input: 'Test input',
                        priority: 'normal'
                    });

                expect([400, 422]).toContain(response.status);
            }
        });

        test('should enforce input length limits', async () => {
            // Test extremely long input
            const longInput = 'A'.repeat(100000); // 100KB

            const response = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: longInput,
                    priority: 'normal'
                });

            // Should either reject or truncate
            expect([201, 400, 413]).toContain(response.status);

            if (response.status === 201) {
                // If accepted, verify it was processed safely
                const taskId = response.body.taskId;
                const statusResponse = await request(app).get(`/api/tasks/${taskId}`);
                expect(statusResponse.status).toBe(200);
            }
        });
    });

    describe('CORS and Security Headers', () => {
        test('should include proper security headers', async () => {
            const response = await request(app).get('/health');

            // Check for essential security headers
            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers['x-content-type-options']).toBe('nosniff');

            expect(response.headers).toHaveProperty('x-frame-options');
            expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);

            expect(response.headers).toHaveProperty('x-xss-protection');
        });

        test('should handle CORS properly', async () => {
            const response = await request(app)
                .options('/api/tasks')
                .set('Origin', 'https://example.com')
                .set('Access-Control-Request-Method', 'POST')
                .set('Access-Control-Request-Headers', 'Content-Type');

            expect(response.status).toBe(204);
            expect(response.headers).toHaveProperty('access-control-allow-origin');
            expect(response.headers).toHaveProperty('access-control-allow-methods');
        });
    });

    describe('Error Information Leakage', () => {
        test('should not leak sensitive information in error messages', async () => {
            // Test invalid endpoint
            const response = await request(app).get('/api/nonexistent');

            expect(response.status).toBe(404);

            // Should not contain stack traces or file paths
            const responseText = JSON.stringify(response.body).toLowerCase();
            expect(responseText).not.toMatch(/(\/users\/|\/home\/|c:\\|stack trace|at object\.|at function)/);
        });

        test('should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}');

            expect(response.status).toBe(400);

            // Should not reveal server internals
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toMatch(/(node_modules|enhanced-server|/usr / local) /);
    });
});

describe('HTTP Method Security', () => {
    test('should only allow appropriate HTTP methods', async () => {
        const methods = ['PUT', 'DELETE', 'PATCH', 'TRACE', 'CONNECT'];

        for (const method of methods) {
            const response = await request(app)[method.toLowerCase()]?.('/api/tasks') ||
                await request(app).get('/api/tasks').set('X-HTTP-Method-Override', method);

            // Should either be method not allowed or not found
            expect([404, 405]).toContain(response.status);
        }
    });

    test('should prevent HTTP parameter pollution', async () => {
        const response = await request(app)
            .get('/api/tasks/test-id?priority=high&priority=low&priority=critical');

        // Should handle parameter pollution gracefully
        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('Resource Protection', () => {
    test('should prevent access to system files', async () => {
        const systemPaths = [
            '/api/../package.json',
            '/api/../../etc/passwd',
            '/api/tasks/../../../config.json',
            '/health/../.env',
            '/api\\..\\package.json' // Windows-style
        ];

        for (const path of systemPaths) {
            const response = await request(app).get(path);

            // Should not return file contents
            expect([404, 400, 403]).toContain(response.status);
        }
    });

    test('should protect against server-side request forgery', async () => {
        const ssrfUrls = [
            'http://localhost:22/ssh',
            'http://127.0.0.1:3306/mysql',
            'http://169.254.169.254/metadata',
            'file:///etc/passwd',
            'gopher://localhost:11211'
        ];

        for (const url of ssrfUrls) {
            const response = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: 'Fetch content from: ' + url,
                    priority: 'normal'
                });

            // Should either reject or handle safely
            if (response.status === 201) {
                const taskId = response.body.taskId;

                // Monitor task to ensure it doesn't make malicious requests
                await new Promise(resolve => setTimeout(resolve, 2000));

                const statusResponse = await request(app).get(`/api/tasks/${taskId}`);

                // Task should not have accessed the malicious URL
                if (statusResponse.body.task.status === 'completed') {
                    const result = statusResponse.body.task.result || '';
                    expect(result.toLowerCase()).not.toMatch(/(ssh|mysql|metadata|passwd|root:x)/);
                }
            }
        }
    });
});

describe('Session and State Security', () => {
    test('should maintain secure session handling', async () => {
        // Create a task
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'text-generation',
                input: 'Test task for security',
                priority: 'normal'
            });

        expect(submitResponse.status).toBe(201);
        const taskId = submitResponse.body.taskId;

        // Verify task isolation - one user shouldn't access another's tasks
        // (In a more complete implementation, this would test with different user sessions)
        const statusResponse = await request(app).get(`/api/tasks/${taskId}`);
        expect(statusResponse.status).toBe(200);

        // Task data should be properly structured and not leak internals
        const task = statusResponse.body.task;
        expect(task).not.toHaveProperty('__proto__');
        expect(task).not.toHaveProperty('constructor');
        expect(task).not.toHaveProperty('prototype');
    });

    test('should prevent timing attacks on task lookup', async () => {
        const timings = [];

        // Test valid task IDs vs invalid ones
        for (let i = 0; i < 5; i++) {
            const start = process.hrtime.bigint();

            await request(app).get('/api/tasks/nonexistent-task-id-' + i);

            const end = process.hrtime.bigint();
            timings.push(Number(end - start) / 1000000); // Convert to milliseconds
        }

        // Response times should not vary dramatically (simple timing attack prevention)
        const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
        const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));

        // Should not have extreme timing variations (within 100ms deviation is reasonable)
        expect(maxDeviation).toBeLessThan(100);
    });
});

describe('Content Security', () => {
    test('should sanitize response content', async () => {
        const response = await request(app)
            .post('/api/tasks')
            .send({
                type: 'text-generation',
                input: 'Generate text with <script>alert("xss")</script> embedded',
                priority: 'normal'
            });

        if (response.status === 201) {
            const taskId = response.body.taskId;

            // Wait for potential completion
            await new Promise(resolve => setTimeout(resolve, 3000));

            const statusResponse = await request(app).get(`/api/tasks/${taskId}`);

            if (statusResponse.body.task.result) {
                const result = statusResponse.body.task.result;

                // Result should not contain unescaped script tags
                expect(result).not.toMatch(/<script[^>]*>.*?<\/script>/is);

                // If HTML is present, it should be properly escaped
                if (result.includes('<') && result.includes('>')) {
                    expect(result).toMatch(/(&lt;|&gt;)/);
                }
            }
        }
    });

    test('should validate content types', async () => {
        // Test with invalid content type
        const response = await request(app)
            .post('/api/tasks')
            .set('Content-Type', 'application/xml')
            .send('<xml><malicious>content</malicious></xml>');

        expect([400, 415]).toContain(response.status);
    });
});

describe('Denial of Service Protection', () => {
    test('should handle resource exhaustion attempts', async () => {
        const largeTasks = Array(5).fill().map((_, i) => ({
            type: 'text-generation',
            input: 'A'.repeat(10000), // Large input
            priority: 'normal'
        }));

        const startTime = Date.now();

        const promises = largeTasks.map(task =>
            request(app).post('/api/tasks').send(task)
        );

        const responses = await Promise.all(promises);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should handle load within reasonable time
        expect(totalTime).toBeLessThan(10000); // 10 seconds

        // Server should remain responsive
        const healthResponse = await request(app).get('/health');
        expect(healthResponse.status).toBe(200);
    });

    test('should limit concurrent connections gracefully', async () => {
        // Test many simultaneous connections
        const connections = Array(20).fill().map(() =>
            request(app).get('/health').timeout(5000)
        );

        const results = await Promise.allSettled(connections);

        // Most connections should succeed
        const successful = results.filter(r =>
            r.status === 'fulfilled' && r.value.status === 200
        );

        expect(successful.length).toBeGreaterThan(15); // At least 75% success rate
    });
});
});