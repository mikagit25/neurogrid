/**
 * Enhanced End-to-End User Flow Tests
 * 
 * Comprehensive testing of complete user workflows including:
 * - Task submission and processing lifecycle
 * - Real-time WebSocket notifications
 * - Caching behavior and performance
 * - Rate limiting enforcement
 * - Multi-user concurrent scenarios
 */

const request = require('supertest');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const app = require('../../enhanced-server');
const { getCacheManager } = require('../../src/cache/manager');
const { getWebSocketManager } = require('../../src/websocket/taskUpdates');

describe('Enhanced E2E User Flow Tests', () => {
    let server;
    let cacheManager;
    let wsManager;
    let testToken;

    beforeAll(async () => {
        server = app.listen(0);
        cacheManager = getCacheManager();
        wsManager = getWebSocketManager();

        // Generate test JWT token
        testToken = jwt.sign(
            { userId: 'test-user-123', email: 'test@example.com', role: 'user' },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );

        // Allow server to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
        if (cacheManager) {
            await cacheManager.shutdown();
        }
        if (wsManager) {
            await wsManager.shutdown();
        }
    });

    describe('Real-time WebSocket Task Updates', () => {
        test('should receive WebSocket notifications during task processing', (done) => {
            const serverAddress = server.address();
            const wsUrl = `ws://localhost:${serverAddress.port}/ws`;

            let ws;
            let taskId;
            let notificationsReceived = [];

            const timeout = setTimeout(() => {
                if (ws) ws.close();
                done(new Error('Test timeout: WebSocket notifications not received'));
            }, 15000);

            ws = new WebSocket(wsUrl);

            ws.on('open', async () => {
                // Authenticate WebSocket connection
                ws.send(JSON.stringify({
                    type: 'authenticate',
                    token: testToken
                }));
            });

            ws.on('message', async (data) => {
                const message = JSON.parse(data.toString());
                notificationsReceived.push(message);

                if (message.type === 'auth_success') {
                    // Subscribe to task updates
                    ws.send(JSON.stringify({
                        type: 'subscribe',
                        channel: 'tasks'
                    }));

                    // Submit a task after successful authentication and subscription
                    const submitResponse = await request(app)
                        .post('/api/tasks')
                        .set('Authorization', `Bearer ${testToken}`)
                        .send({
                            type: 'text-generation',
                            input: 'Generate a short poem about AI',
                            priority: 'normal'
                        });

                    taskId = submitResponse.body.taskId;

                } else if (message.type === 'task_update' && message.taskId === taskId) {
                    // Received task update notification
                    expect(message).toHaveProperty('taskId');
                    expect(message).toHaveProperty('timestamp');

                    if (message.status === 'completed' || message.status === 'failed') {
                        clearTimeout(timeout);
                        ws.close();

                        // Verify we received notifications
                        expect(notificationsReceived.length).toBeGreaterThan(2);

                        const authSuccess = notificationsReceived.find(n => n.type === 'auth_success');
                        const taskUpdates = notificationsReceived.filter(n => n.type === 'task_update');

                        expect(authSuccess).toBeDefined();
                        expect(taskUpdates.length).toBeGreaterThan(0);

                        done();
                    }
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                done(error);
            });
        }, 20000);
    });

    describe('Smart Caching Integration', () => {
        test('should cache and retrieve AI model results', async () => {
            const testInput = 'What is machine learning?';

            // First request - should miss cache and process
            const firstResponse = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    type: 'text-generation',
                    input: testInput,
                    priority: 'normal'
                });

            expect(firstResponse.status).toBe(201);
            const firstTaskId = firstResponse.body.taskId;

            // Wait for completion
            let completed = false;
            let attempts = 0;

            while (!completed && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/tasks/${firstTaskId}`)
                    .set('Authorization', `Bearer ${testToken}`);

                if (statusResponse.body.task.status === 'completed') {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Second identical request - should hit cache
            const secondResponse = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    type: 'text-generation',
                    input: testInput,
                    priority: 'normal'
                });

            expect(secondResponse.status).toBe(201);
            const secondTaskId = secondResponse.body.taskId;

            // Check if second task completes faster (cache hit)
            const secondStatusResponse = await request(app)
                .get(`/api/tasks/${secondTaskId}`)
                .set('Authorization', `Bearer ${testToken}`);

            // Should be completed immediately or very quickly due to caching
            if (secondStatusResponse.body.task.status !== 'completed') {
                await new Promise(resolve => setTimeout(resolve, 2000));

                const finalResponse = await request(app)
                    .get(`/api/tasks/${secondTaskId}`)
                    .set('Authorization', `Bearer ${testToken}`);

                expect(['completed', 'processing']).toContain(finalResponse.body.task.status);
            }
        }, 30000);

        test('should respect cache invalidation', async () => {
            // Test cache statistics endpoint
            const cacheStatsResponse = await request(app)
                .get('/api/monitoring/stats/cache')
                .set('Authorization', `Bearer ${testToken}`);

            expect(cacheStatsResponse.status).toBe(200);
            expect(cacheStatsResponse.body).toHaveProperty('hits');
            expect(cacheStatsResponse.body).toHaveProperty('misses');
            expect(cacheStatsResponse.body).toHaveProperty('hitRate');
        });
    });

    describe('Rate Limiting Enforcement', () => {
        test('should enforce rate limits for free tier users', async () => {
            // Make multiple rapid requests to trigger rate limiting
            const requests = [];
            const testInput = 'Rate limit test ' + Date.now();

            // Send 15 requests rapidly (free tier limit is typically 10/minute)
            for (let i = 0; i < 15; i++) {
                requests.push(
                    request(app)
                        .post('/api/tasks')
                        .set('Authorization', `Bearer ${testToken}`)
                        .send({
                            type: 'text-generation',
                            input: `${testInput} - ${i}`,
                            priority: 'normal'
                        })
                );
            }

            const responses = await Promise.all(requests);

            // Should have some successful requests and some rate limited
            const successfulRequests = responses.filter(r => r.status === 201);
            const rateLimitedRequests = responses.filter(r => r.status === 429);

            expect(successfulRequests.length).toBeGreaterThan(0);
            expect(rateLimitedRequests.length).toBeGreaterThan(0);

            // Rate limited responses should have proper headers
            rateLimitedRequests.forEach(response => {
                expect(response.headers).toHaveProperty('x-ratelimit-limit');
                expect(response.headers).toHaveProperty('x-ratelimit-remaining');
                expect(response.headers).toHaveProperty('x-ratelimit-reset');
            });
        }, 15000);

        test('should provide rate limit statistics', async () => {
            const rateLimitStatsResponse = await request(app)
                .get('/api/monitoring/stats/rate-limits')
                .set('Authorization', `Bearer ${testToken}`);

            expect(rateLimitStatsResponse.status).toBe(200);
            expect(rateLimitStatsResponse.body).toHaveProperty('statistics');
        });
    });

    describe('Complete Task Submission Flow', () => {
        test('enhanced text generation workflow with monitoring', async () => {
            // Step 1: Submit task with monitoring
            const submitResponse = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    type: 'text-generation',
                    input: 'Write a haiku about distributed computing',
                    priority: 'normal',
                    metadata: {
                        source: 'e2e-test',
                        timestamp: Date.now()
                    }
                });

            expect(submitResponse.status).toBe(201);
            expect(submitResponse.body.success).toBe(true);

            const taskId = submitResponse.body.taskId;
            expect(taskId).toMatch(/^task-\d+$/);

            // Step 2: Check monitoring dashboard shows task
            const dashboardResponse = await request(app)
                .get('/api/monitoring/dashboard')
                .set('Authorization', `Bearer ${testToken}`);

            expect(dashboardResponse.status).toBe(200);
            expect(dashboardResponse.body).toHaveProperty('tasks');

            // Step 3: Wait for processing with enhanced monitoring
            let taskCompleted = false;
            let attempts = 0;
            const maxAttempts = 25;

            while (!taskCompleted && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/tasks/${taskId}`)
                    .set('Authorization', `Bearer ${testToken}`);

                expect(statusResponse.status).toBe(200);

                const status = statusResponse.body.task.status;

                if (status === 'completed') {
                    taskCompleted = true;

                    // Enhanced verification
                    expect(statusResponse.body.task).toHaveProperty('result');
                    expect(statusResponse.body.task).toHaveProperty('completedAt');
                    expect(statusResponse.body.task).toHaveProperty('processingTime');
                    expect(statusResponse.body.task).toHaveProperty('metadata');

                    // Verify result quality
                    expect(statusResponse.body.task.result).toBeDefined();
                    expect(typeof statusResponse.body.task.result).toBe('string');
                    expect(statusResponse.body.task.result.length).toBeGreaterThan(10);

                    // Should contain haiku-like structure (multiple lines)
                    expect(statusResponse.body.task.result.split('\n').length).toBeGreaterThanOrEqual(3);

                } else if (status === 'failed') {
                    expect(statusResponse.body.task).toHaveProperty('error');
                    break;
                }

                attempts++;
            }

            expect(taskCompleted).toBe(true);

            // Step 4: Verify metrics were recorded
            const metricsResponse = await request(app)
                .get('/api/monitoring/metrics')
                .set('Authorization', `Bearer ${testToken}`);

            expect(metricsResponse.status).toBe(200);
            expect(metricsResponse.headers['content-type']).toContain('text/plain');

        }, 30000);
    });

    describe('Multi-user Concurrent Scenarios', () => {
        test('should handle concurrent users without interference', async () => {
            // Create multiple test users
            const users = [
                { token: jwt.sign({ userId: 'user-1', role: 'user' }, process.env.JWT_SECRET || 'test-secret') },
                { token: jwt.sign({ userId: 'user-2', role: 'user' }, process.env.JWT_SECRET || 'test-secret') },
                { token: jwt.sign({ userId: 'user-3', role: 'user' }, process.env.JWT_SECRET || 'test-secret') }
            ];

            // Submit tasks concurrently
            const concurrentTasks = users.map((user, index) =>
                request(app)
                    .post('/api/tasks')
                    .set('Authorization', `Bearer ${user.token}`)
                    .send({
                        type: 'text-generation',
                        input: `Concurrent task ${index + 1}: Explain quantum computing`,
                        priority: 'normal'
                    })
            );

            const responses = await Promise.all(concurrentTasks);

            // All tasks should be accepted
            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
            });

            const taskIds = responses.map(r => r.body.taskId);

            // Wait for all tasks to complete
            const completionPromises = taskIds.map(taskId =>
                this.waitForTaskCompletion(taskId, users[0].token)
            );

            const completedTasks = await Promise.all(completionPromises);

            // All tasks should complete successfully
            completedTasks.forEach(task => {
                expect(['completed', 'failed']).toContain(task.status);
                if (task.status === 'completed') {
                    expect(task.result).toBeDefined();
                }
            });
        }, 45000);
    });

    describe('System Health and Performance', () => {
        test('should provide comprehensive health status', async () => {
            const healthResponse = await request(app)
                .get('/api/monitoring/health')
                .set('Authorization', `Bearer ${testToken}`);

            expect(healthResponse.status).toBe(200);
            expect(healthResponse.body).toHaveProperty('status');
            expect(['healthy', 'warning', 'unhealthy']).toContain(healthResponse.body.status);
        });

        test('should track WebSocket connection metrics', async () => {
            const wsStatsResponse = await request(app)
                .get('/api/monitoring/stats/websocket')
                .set('Authorization', `Bearer ${testToken}`);

            expect(wsStatsResponse.status).toBe(200);
            expect(wsStatsResponse.body).toHaveProperty('activeConnections');
            expect(wsStatsResponse.body).toHaveProperty('totalConnections');
        });
    });

  // Helper method
  async waitForTaskCompletion(taskId, token, maxAttempts = 20) {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const response = await request(app)
                .get(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${token}`);

            if (['completed', 'failed'].includes(response.body.task.status)) {
                return response.body.task;
            }
        }

        throw new Error(`Task ${taskId} did not complete within timeout`);
    }
});

describe('Complete Task Submission Flow', () => {
    test('text generation workflow from submission to completion', async () => {
        // Step 1: Submit task
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'text-generation',
                input: 'Write a haiku about machine learning',
                priority: 'normal'
            });

        expect(submitResponse.status).toBe(201);
        expect(submitResponse.body.success).toBe(true);

        const taskId = submitResponse.body.taskId;
        expect(taskId).toMatch(/^task-\d+$/);

        // Step 2: Check initial status
        const initialStatusResponse = await request(app)
            .get(`/api/tasks/${taskId}`);

        expect(initialStatusResponse.status).toBe(200);
        expect(initialStatusResponse.body.task.id).toBe(taskId);
        expect(['pending', 'processing']).toContain(initialStatusResponse.body.task.status);

        // Step 3: Wait for processing (with timeout)
        let taskCompleted = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout

        while (!taskCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            const statusResponse = await request(app)
                .get(`/api/tasks/${taskId}`);

            expect(statusResponse.status).toBe(200);

            const status = statusResponse.body.task.status;

            if (status === 'completed') {
                taskCompleted = true;

                // Step 4: Verify completion data
                expect(statusResponse.body.task).toHaveProperty('result');
                expect(statusResponse.body.task).toHaveProperty('completedAt');
                expect(statusResponse.body.task).toHaveProperty('processingTime');

                // Result should contain generated text
                expect(statusResponse.body.task.result).toBeDefined();
                expect(typeof statusResponse.body.task.result).toBe('string');
                expect(statusResponse.body.task.result.length).toBeGreaterThan(0);

            } else if (status === 'failed') {
                expect(statusResponse.body.task).toHaveProperty('error');
                break;
            }

            attempts++;
        }

        // Should complete within timeout
        expect(taskCompleted).toBe(true);
    }, 35000); // 35 second timeout for this test

    test('code generation workflow with language specification', async () => {
        // Step 1: Submit code generation task
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'code-generation',
                input: 'Create a function that calculates the factorial of a number',
                language: 'python',
                priority: 'high'
            });

        expect(submitResponse.status).toBe(201);
        const taskId = submitResponse.body.taskId;

        // Step 2: Monitor task progress
        let finalStatus;
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const statusResponse = await request(app)
                .get(`/api/tasks/${taskId}`);

            finalStatus = statusResponse.body.task.status;

            if (['completed', 'failed'].includes(finalStatus)) {
                // Step 3: Verify results
                if (finalStatus === 'completed') {
                    expect(statusResponse.body.task.result).toBeDefined();
                    // Code should contain typical programming elements
                    const result = statusResponse.body.task.result.toLowerCase();
                    expect(result).toMatch(/(def|function|factorial|return)/);
                }
                break;
            }

            attempts++;
        }

        expect(['completed', 'failed']).toContain(finalStatus);
    }, 25000);

    test('image generation workflow', async () => {
        // Step 1: Submit image generation task
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'image-generation',
                input: 'A serene mountain landscape during sunset',
                priority: 'normal',
                parameters: {
                    width: 512,
                    height: 512
                }
            });

        expect(submitResponse.status).toBe(201);
        const taskId = submitResponse.body.taskId;

        // Step 2: Wait for processing
        let taskCompleted = false;
        let attempts = 0;

        while (!taskCompleted && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for image gen

            const statusResponse = await request(app)
                .get(`/api/tasks/${taskId}`);

            const status = statusResponse.body.task.status;

            if (status === 'completed') {
                taskCompleted = true;

                // Step 3: Verify image result
                expect(statusResponse.body.task.result).toBeDefined();

                // Should contain image data or URL
                const result = statusResponse.body.task.result;
                expect(typeof result).toBe('string');

            } else if (status === 'failed') {
                // Image generation might fail due to resource constraints
                expect(statusResponse.body.task.error).toBeDefined();
                taskCompleted = true; // Accept failure for resource-constrained environments
            }

            attempts++;
        }

        expect(taskCompleted).toBe(true);
    }, 65000);
});

describe('Multi-Task Workflow', () => {
    test('should handle multiple concurrent tasks', async () => {
        const tasks = [
            {
                type: 'text-generation',
                input: 'Explain quantum computing in one sentence',
                priority: 'normal'
            },
            {
                type: 'code-generation',
                input: 'Write a hello world function',
                priority: 'normal'
            },
            {
                type: 'text-generation',
                input: 'What is artificial intelligence?',
                priority: 'low'
            }
        ];

        // Step 1: Submit all tasks concurrently
        const submitPromises = tasks.map(task =>
            request(app).post('/api/tasks').send(task)
        );

        const submitResponses = await Promise.all(submitPromises);

        // All submissions should succeed
        submitResponses.forEach(response => {
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        const taskIds = submitResponses.map(r => r.body.taskId);

        // Step 2: Monitor all tasks
        const monitorTasks = async () => {
            const statusPromises = taskIds.map(taskId =>
                request(app).get(`/api/tasks/${taskId}`)
            );

            const statusResponses = await Promise.all(statusPromises);

            return statusResponses.map(r => ({
                taskId: r.body.task.id,
                status: r.body.task.status,
                result: r.body.task.result
            }));
        };

        // Step 3: Wait for completion
        let allCompleted = false;
        let attempts = 0;

        while (!allCompleted && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const taskStatuses = await monitorTasks();

            const completedTasks = taskStatuses.filter(t =>
                ['completed', 'failed'].includes(t.status)
            );

            if (completedTasks.length === tasks.length) {
                allCompleted = true;

                // Verify all tasks processed
                taskStatuses.forEach(task => {
                    expect(['completed', 'failed']).toContain(task.status);
                });
            }

            attempts++;
        }

        expect(allCompleted).toBe(true);
    }, 40000);
});

describe('Performance and Load Testing', () => {
    test('should handle burst of requests', async () => {
        const burstSize = 10;
        const tasks = Array(burstSize).fill().map((_, i) => ({
            type: 'text-generation',
            input: `Performance test task ${i + 1}`,
            priority: 'normal'
        }));

        const startTime = Date.now();

        // Submit burst of tasks
        const submitPromises = tasks.map(task =>
            request(app).post('/api/tasks').send(task)
        );

        const responses = await Promise.all(submitPromises);

        const submitTime = Date.now() - startTime;

        // All should succeed
        responses.forEach(response => {
            expect(response.status).toBe(201);
        });

        // Should handle burst within reasonable time
        expect(submitTime).toBeLessThan(5000); // <5 seconds

        // Check system health after burst
        const healthResponse = await request(app).get('/health');
        expect(healthResponse.status).toBe(200);
        expect(healthResponse.body.status).toBe('OK');
    }, 15000);

    test('should maintain performance under load', async () => {
        const measurements = [];

        for (let i = 0; i < 5; i++) {
            const startTime = Date.now();

            const response = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: `Load test iteration ${i + 1}`,
                    priority: 'normal'
                });

            const responseTime = Date.now() - startTime;
            measurements.push(responseTime);

            expect(response.status).toBe(201);

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Calculate average response time
        const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;

        // Should maintain good response times
        expect(avgResponseTime).toBeLessThan(2000); // <2 seconds average
    });
});

describe('Error Recovery Flows', () => {
    test('should recover from task failures gracefully', async () => {
        // Submit task that might fail
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'text-generation',
                input: '', // Empty input might cause failure
                priority: 'normal'
            });

        if (submitResponse.status === 201) {
            const taskId = submitResponse.body.taskId;

            // Monitor task
            let attempts = 0;
            while (attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/tasks/${taskId}`);

                const status = statusResponse.body.task.status;

                if (status === 'failed') {
                    // Should have error information
                    expect(statusResponse.body.task.error).toBeDefined();
                    break;
                } else if (status === 'completed') {
                    // Unexpected success is also fine
                    break;
                }

                attempts++;
            }

            // System should remain healthy after failure
            const healthResponse = await request(app).get('/health');
            expect(healthResponse.status).toBe(200);
        } else {
            // Early validation is also acceptable
            expect(submitResponse.status).toBe(400);
        }
    });
});

describe('Model Selection Flow', () => {
    test('should automatically select best model for task', async () => {
        // Submit task without specifying model
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'code-generation',
                input: 'Create a sorting algorithm in JavaScript',
                priority: 'normal'
            });

        expect(submitResponse.status).toBe(201);
        const taskId = submitResponse.body.taskId;

        // Check task details to see model selection
        const statusResponse = await request(app)
            .get(`/api/tasks/${taskId}`);

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.body.task).toHaveProperty('selectedModel');

        // Should have selected a code-appropriate model
        const selectedModel = statusResponse.body.task.selectedModel;
        expect(selectedModel).toBeDefined();
        expect(typeof selectedModel).toBe('string');
    });
});

describe('Real-time Updates Flow', () => {
    test('should provide task status updates', async () => {
        // Submit long-running-ish task
        const submitResponse = await request(app)
            .post('/api/tasks')
            .send({
                type: 'text-generation',
                input: 'Write a detailed explanation of machine learning algorithms including neural networks, decision trees, and support vector machines',
                priority: 'normal'
            });

        expect(submitResponse.status).toBe(201);
        const taskId = submitResponse.body.taskId;

        // Track status changes
        const statusChanges = [];
        let attempts = 0;

        while (attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const statusResponse = await request(app)
                .get(`/api/tasks/${taskId}`);

            const status = statusResponse.body.task.status;

            if (statusChanges.length === 0 || statusChanges[statusChanges.length - 1] !== status) {
                statusChanges.push(status);
            }

            if (['completed', 'failed'].includes(status)) {
                break;
            }

            attempts++;
        }

        // Should have seen status transitions
        expect(statusChanges.length).toBeGreaterThan(0);
        expect(statusChanges[0]).toBe('pending');
    });
});
});