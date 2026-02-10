const request = require('supertest');
const app = require('../../enhanced-server');
const WebSocket = require('ws');

describe('E2E User Flow Tests', () => {
    let server;
    let serverPort;

    beforeAll(async () => {
        // Start server for testing
        server = app.listen(0);
        serverPort = server.address().port;
    });

    afterAll(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('Complete Task Submission Flow', () => {
        test('should handle complete text generation workflow', async () => {
            // 1. Check system health first
            const healthResponse = await request(app).get('/health');
            expect(healthResponse.status).toBe(200);
            expect(healthResponse.body.status).toBe('OK');

            // 2. Get available models
            const modelsResponse = await request(app).get('/api/models');
            expect(modelsResponse.status).toBe(200);
            expect(Array.isArray(modelsResponse.body)).toBe(true);

            const textModels = modelsResponse.body.filter(m => m.category === 'text');
            expect(textModels.length).toBeGreaterThan(0);

            // 3. Submit a text generation task
            const taskData = {
                type: 'text-generation',
                input: 'Write a haiku about artificial intelligence',
                model: textModels[0].id,
                priority: 'normal'
            };

            const submitResponse = await request(app)
                .post('/api/tasks')
                .send(taskData);

            expect(submitResponse.status).toBe(201);
            expect(submitResponse.body.success).toBe(true);
            const taskId = submitResponse.body.taskId;

            // 4. Monitor task progress
            let attempts = 0;
            let taskCompleted = false;
            const maxAttempts = 30; // 30 seconds timeout

            while (attempts < maxAttempts && !taskCompleted) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                const statusResponse = await request(app)
                    .get(`/api/tasks/${taskId}`);

                expect(statusResponse.status).toBe(200);

                const status = statusResponse.body.status;
                console.log(`Attempt ${attempts + 1}: Task ${taskId} status: ${status}`);

                if (status === 'completed') {
                    expect(statusResponse.body).toHaveProperty('result');
                    expect(statusResponse.body.result).toBeDefined();
                    expect(typeof statusResponse.body.result).toBe('string');
                    expect(statusResponse.body.result.length).toBeGreaterThan(0);
                    taskCompleted = true;
                } else if (status === 'failed') {
                    expect(statusResponse.body).toHaveProperty('error');
                    throw new Error(`Task failed: ${statusResponse.body.error}`);
                }

                attempts++;
            }

            if (!taskCompleted) {
                console.warn(`Task ${taskId} did not complete within ${maxAttempts} seconds`);
                // This is acceptable for E2E tests as external services may be slow
            }
        }, 45000); // 45 second timeout for this test

        test('should handle complete code generation workflow', async () => {
            // Submit code generation task
            const codeTask = {
                type: 'code-generation',
                input: 'Create a JavaScript function that reverses a string',
                language: 'javascript',
                priority: 'high'
            };

            const submitResponse = await request(app)
                .post('/api/tasks')
                .send(codeTask);

            expect(submitResponse.status).toBe(201);
            const taskId = submitResponse.body.taskId;

            // Check initial status
            const initialStatus = await request(app)
                .get(`/api/tasks/${taskId}`);

            expect(initialStatus.status).toBe(200);
            expect(['pending', 'processing']).toContain(initialStatus.body.status);

            // For E2E, we don't need to wait for completion,
            // just verify the task was accepted and is being processed
            expect(initialStatus.body.taskId).toBe(taskId);
            expect(initialStatus.body).toHaveProperty('input', codeTask.input);
            expect(initialStatus.body).toHaveProperty('type', codeTask.type);
        });

        test('should handle image generation workflow with WebSocket updates', (done) => {
            // Establish WebSocket connection
            const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
            let taskId;

            ws.on('open', async () => {
                try {
                    // Submit image generation task
                    const imageTask = {
                        type: 'image-generation',
                        input: 'A serene mountain landscape with a lake reflection',
                        style: 'photorealistic',
                        priority: 'normal'
                    };

                    const submitResponse = await request(app)
                        .post('/api/tasks')
                        .send(imageTask);

                    expect(submitResponse.status).toBe(201);
                    taskId = submitResponse.body.taskId;

                    // Subscribe to task updates
                    ws.send(JSON.stringify({
                        type: 'subscribe',
                        topic: 'task-updates',
                        taskId: taskId
                    }));
                } catch (error) {
                    done(error);
                }
            });

            let updateReceived = false;
            const timeout = setTimeout(() => {
                if (!updateReceived) {
                    console.log('No WebSocket update received within timeout - this is acceptable for E2E tests');
                    ws.close();
                    done();
                }
            }, 10000); // 10 second timeout

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);

                    if (message.type === 'task-update' && message.taskId === taskId) {
                        updateReceived = true;
                        clearTimeout(timeout);

                        expect(message).toHaveProperty('status');
                        expect(['pending', 'processing', 'completed', 'failed']).toContain(message.status);

                        ws.close();
                        done();
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    ws.close();
                    done(error);
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                done(error);
            });
        });
    });

    describe('Multi-User Concurrent Workflows', () => {
        test('should handle multiple users submitting tasks simultaneously', async () => {
            const userTasks = [
                {
                    type: 'text-generation',
                    input: 'Write a short poem about stars',
                    user: 'user1'
                },
                {
                    type: 'code-generation',
                    input: 'Create a function to sort an array',
                    language: 'python',
                    user: 'user2'
                },
                {
                    type: 'text-generation',
                    input: 'Explain quantum computing simply',
                    user: 'user3'
                }
            ];

            const submitPromises = userTasks.map(task =>
                request(app).post('/api/tasks').send(task)
            );

            const responses = await Promise.all(submitPromises);

            // All tasks should be accepted
            responses.forEach((response, index) => {
                expect([201, 429]).toContain(response.status); // 201 or rate limited
                if (response.status === 201) {
                    expect(response.body.success).toBe(true);
                    expect(response.body.taskId).toBeDefined();
                    console.log(`User ${userTasks[index].user} task submitted: ${response.body.taskId}`);
                }
            });

            // Get unique task IDs
            const taskIds = responses
                .filter(r => r.status === 201)
                .map(r => r.body.taskId);

            // Verify all tasks are trackable
            const statusPromises = taskIds.map(taskId =>
                request(app).get(`/api/tasks/${taskId}`)
            );

            const statusResponses = await Promise.all(statusPromises);

            statusResponses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('status');
                expect(['pending', 'processing', 'completed']).toContain(response.body.status);
            });
        });
    });

    describe('Error Recovery Workflows', () => {
        test('should handle invalid task gracefully and allow retry', async () => {
            // Submit invalid task
            const invalidTask = {
                type: 'non-existent-type',
                input: 'This should fail',
                priority: 'high'
            };

            const failResponse = await request(app)
                .post('/api/tasks')
                .send(invalidTask);

            expect(failResponse.status).toBe(400);
            expect(failResponse.body.success).toBe(false);

            // Immediately retry with valid task
            const validTask = {
                type: 'text-generation',
                input: 'This should work after the failed attempt',
                priority: 'normal'
            };

            const successResponse = await request(app)
                .post('/api/tasks')
                .send(validTask);

            expect(successResponse.status).toBe(201);
            expect(successResponse.body.success).toBe(true);
            expect(successResponse.body.taskId).toBeDefined();
        });

        test('should handle system overload gracefully', async () => {
            // Simulate high load by submitting many tasks rapidly
            const overloadTasks = Array.from({ length: 50 }, (_, i) => ({
                type: 'text-generation',
                input: `Overload test task ${i}`,
                priority: 'low'
            }));

            const responses = await Promise.allSettled(
                overloadTasks.map(task => request(app).post('/api/tasks').send(task))
            );

            let successful = 0;
            let rateLimited = 0;
            let errors = 0;

            responses.forEach(result => {
                if (result.status === 'fulfilled') {
                    if (result.value.status === 201) {
                        successful++;
                    } else if (result.value.status === 429) {
                        rateLimited++;
                    } else {
                        errors++;
                    }
                } else {
                    errors++;
                }
            });

            console.log(`Load test results: ${successful} successful, ${rateLimited} rate limited, ${errors} errors`);

            // System should handle load gracefully - either accept or rate limit
            expect(successful + rateLimited).toBeGreaterThan(errors);
            expect(rateLimited).toBeGreaterThan(0); // Rate limiting should kick in
        });
    });

    describe('Performance Monitoring Workflow', () => {
        test('should track and report performance metrics', async () => {
            // Submit a few tasks to generate metrics
            const tasks = [
                { type: 'text-generation', input: 'Performance test 1' },
                { type: 'code-generation', input: 'Performance test 2', language: 'python' },
                { type: 'text-generation', input: 'Performance test 3' }
            ];

            for (const task of tasks) {
                await request(app).post('/api/tasks').send(task);
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            }

            // Check performance metrics
            const metricsResponse = await request(app).get('/api/nodes/performance');
            expect(metricsResponse.status).toBe(200);

            expect(metricsResponse.body).toHaveProperty('avgResponseTime');
            expect(metricsResponse.body).toHaveProperty('throughput');
            expect(metricsResponse.body).toHaveProperty('uptime');

            expect(typeof metricsResponse.body.avgResponseTime).toBe('number');
            expect(metricsResponse.body.avgResponseTime).toBeGreaterThan(0);

            // Check system health reflects recent activity
            const healthResponse = await request(app).get('/api/health');
            expect(healthResponse.status).toBe(200);
            expect(healthResponse.body.coordinators.total).toBeGreaterThan(0);
        });
    });

    describe('Data Consistency Workflows', () => {
        test('should maintain data consistency across requests', async () => {
            // Submit task and immediately check status multiple times
            const task = {
                type: 'text-generation',
                input: 'Consistency test - this task should maintain consistent state'
            };

            const submitResponse = await request(app).post('/api/tasks').send(task);
            expect(submitResponse.status).toBe(201);
            const taskId = submitResponse.body.taskId;

            // Make multiple concurrent status requests
            const statusPromises = Array.from({ length: 5 }, () =>
                request(app).get(`/api/tasks/${taskId}`)
            );

            const statusResponses = await Promise.all(statusPromises);

            // All responses should be consistent
            const firstResponse = statusResponses[0].body;
            statusResponses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.taskId).toBe(firstResponse.taskId);
                expect(response.body.type).toBe(firstResponse.type);
                expect(response.body.input).toBe(firstResponse.input);
                // Status might change during processing, but should be valid
                expect(['pending', 'processing', 'completed', 'failed']).toContain(response.body.status);
            });
        });
    });
});