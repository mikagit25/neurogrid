/**
 * API Integration Tests
 * 
 * Comprehensive testing of REST API endpoints with real server interaction
 */

const request = require('supertest');
const app = require('../../enhanced-server');

describe('API Integration Tests', () => {
    let server;

    beforeAll(async () => {
        // Start server for testing
        server = app.listen(0); // Use random port
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Health Check Endpoint', () => {
        test('GET /health should return 200 OK', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body.status).toBe('OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('service');
        });

        test('should include performance metrics', async () => {
            const response = await request(app).get('/health');

            expect(response.body).toHaveProperty('performance');
            expect(response.body.performance).toHaveProperty('uptime');
            expect(response.body.performance).toHaveProperty('requests');
        });

        test('should include coordinator information', async () => {
            const response = await request(app).get('/health');

            expect(response.body).toHaveProperty('coordinators');
            expect(response.body.coordinators).toHaveProperty('total');
            expect(response.body.coordinators).toHaveProperty('active');
        });
    });

    describe('Task Management Endpoints', () => {
        describe('POST /api/tasks', () => {
            test('should create new AI task', async () => {
                const taskData = {
                    type: 'text-generation',
                    input: 'Write a short poem about artificial intelligence',
                    priority: 'normal'
                };

                const response = await request(app)
                    .post('/api/tasks')
                    .send(taskData)
                    .expect('Content-Type', /json/);

                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('taskId');
                expect(response.body.taskId).toMatch(/^task-\d+$/);
            });

            test('should handle image generation tasks', async () => {
                const taskData = {
                    type: 'image-generation',
                    input: 'A futuristic cityscape at sunset',
                    priority: 'normal'
                };

                const response = await request(app)
                    .post('/api/tasks')
                    .send(taskData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.taskId).toBeDefined();
            });

            test('should validate required fields', async () => {
                const invalidTaskData = {
                    type: 'text-generation'
                    // Missing required 'input' field
                };

                const response = await request(app)
                    .post('/api/tasks')
                    .send(invalidTaskData);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('Missing required field');
            });

            test('should reject invalid task types', async () => {
                const invalidTaskData = {
                    type: 'invalid-task-type',
                    input: 'Some input'
                };

                const response = await request(app)
                    .post('/api/tasks')
                    .send(invalidTaskData);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });

            test('should handle high priority tasks', async () => {
                const taskData = {
                    type: 'code-generation',
                    input: 'Create a Python function to calculate fibonacci',
                    priority: 'high'
                };

                const response = await request(app)
                    .post('/api/tasks')
                    .send(taskData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
            });
        });

        describe('GET /api/tasks/:taskId', () => {
            let testTaskId;

            beforeAll(async () => {
                // Create a test task
                const taskResponse = await request(app)
                    .post('/api/tasks')
                    .send({
                        type: 'text-generation',
                        input: 'Test task for status check',
                        priority: 'normal'
                    });

                testTaskId = taskResponse.body.taskId;
            });

            test('should get task status', async () => {
                const response = await request(app)
                    .get(`/api/tasks/${testTaskId}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('task');
                expect(response.body.task).toHaveProperty('id', testTaskId);
                expect(response.body.task).toHaveProperty('status');
                expect(['pending', 'processing', 'completed', 'failed']).toContain(response.body.task.status);
            });

            test('should return 404 for non-existent task', async () => {
                const response = await request(app)
                    .get('/api/tasks/non-existent-task');

                expect(response.status).toBe(404);
                expect(response.body.success).toBe(false);
            });
        });

        describe('GET /api/tasks', () => {
            test('should list recent tasks', async () => {
                const response = await request(app).get('/api/tasks');

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('tasks');
                expect(Array.isArray(response.body.tasks)).toBe(true);
            });

            test('should support pagination', async () => {
                const response = await request(app)
                    .get('/api/tasks')
                    .query({ limit: 5, offset: 0 });

                expect(response.status).toBe(200);
                expect(response.body.tasks.length).toBeLessThanOrEqual(5);
            });

            test('should support status filtering', async () => {
                const response = await request(app)
                    .get('/api/tasks')
                    .query({ status: 'completed' });

                expect(response.status).toBe(200);
                response.body.tasks.forEach(task => {
                    expect(task.status).toBe('completed');
                });
            });
        });
    });

    describe('Model Information Endpoints', () => {
        describe('GET /api/models', () => {
            test('should return available models list', async () => {
                const response = await request(app).get('/api/models');

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBeGreaterThan(0);

                // Check first model structure
                const firstModel = response.body[0];
                expect(firstModel).toHaveProperty('id');
                expect(firstModel).toHaveProperty('name');
                expect(firstModel).toHaveProperty('type');
            });

            test('should include model capabilities', async () => {
                const response = await request(app).get('/api/models');

                const models = response.body;
                models.forEach(model => {
                    expect(model).toHaveProperty('capabilities');
                    expect(Array.isArray(model.capabilities)).toBe(true);
                });
            });

            test('should support model type filtering', async () => {
                const response = await request(app)
                    .get('/api/models')
                    .query({ type: 'text' });

                expect(response.status).toBe(200);
                response.body.forEach(model => {
                    expect(model.type).toBe('text');
                });
            });
        });

        describe('GET /api/models/:modelId', () => {
            test('should return specific model details', async () => {
                // Get list of models first
                const modelsResponse = await request(app).get('/api/models');
                const firstModel = modelsResponse.body[0];

                const response = await request(app)
                    .get(`/api/models/${firstModel.id}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('id', firstModel.id);
                expect(response.body).toHaveProperty('description');
                expect(response.body).toHaveProperty('parameters');
            });

            test('should return 404 for unknown model', async () => {
                const response = await request(app)
                    .get('/api/models/unknown-model');

                expect(response.status).toBe(404);
            });
        });

        describe('GET /api/models/stats', () => {
            test('should return model usage statistics', async () => {
                const response = await request(app).get('/api/models/stats');

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('totalModels');
                expect(response.body).toHaveProperty('activeModels');
                expect(response.body).toHaveProperty('usage');
            });
        });
    });

    describe('Node Network Endpoints', () => {
        describe('GET /api/nodes/stats', () => {
            test('should return network statistics', async () => {
                const response = await request(app).get('/api/nodes/stats');

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('totalNodes');
                expect(response.body).toHaveProperty('activeNodes');
                expect(response.body).toHaveProperty('totalGPUs');
                expect(response.body).toHaveProperty('networkHashrate');
            });

            test('should include geographic distribution', async () => {
                const response = await request(app).get('/api/nodes/stats');

                expect(response.body).toHaveProperty('distribution');
                expect(response.body.distribution).toHaveProperty('regions');
            });
        });
    });

    describe('Monitoring Endpoints', () => {
        describe('GET /metrics', () => {
            test('should return Prometheus metrics', async () => {
                const response = await request(app).get('/metrics');

                expect(response.status).toBe(200);
                expect(response.headers['content-type']).toMatch(/text\/plain/);

                // Should contain metric definitions
                expect(response.text).toContain('# HELP');
                expect(response.text).toContain('# TYPE');
                expect(response.text).toContain('neurogrid_');
            });

            test('should include HTTP request metrics', async () => {
                // Make a request to generate metrics
                await request(app).get('/health');

                const response = await request(app).get('/metrics');

                expect(response.text).toContain('neurogrid_http_requests_total');
                expect(response.text).toContain('neurogrid_http_request_duration');
            });

            test('should include system metrics', async () => {
                const response = await request(app).get('/metrics');

                expect(response.text).toContain('neurogrid_system_memory_usage');
                expect(response.text).toContain('neurogrid_system_uptime');
            });
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits on API endpoints', async () => {
            const requests = [];

            // Make multiple rapid requests
            for (let i = 0; i < 110; i++) { // Exceed typical limit of 100
                requests.push(request(app).get('/api/models'));
            }

            const responses = await Promise.allSettled(requests);

            // Some requests should be rate limited
            const rateLimitedResponses = responses.filter(
                r => r.value && r.value.status === 429
            );

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed JSON in request body', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        test('should return proper error format', async () => {
            const response = await request(app)
                .get('/api/non-existent-endpoint');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        test('should handle server errors gracefully', async () => {
            // Test with request that might cause server error
            const response = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: 'x'.repeat(100000) // Extremely long input
                });

            // Should not crash server
            expect([400, 413, 500]).toContain(response.status);
            expect(response.body).toHaveProperty('success', false);
        });
    });

    describe('CORS and Security', () => {
        test('should include CORS headers', async () => {
            const response = await request(app)
                .options('/api/models')
                .set('Origin', 'https://example.com');

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });

        test('should include security headers', async () => {
            const response = await request(app).get('/health');

            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
        });
    });

    describe('WebSocket Connection', () => {
        test('should accept WebSocket connections (basic test)', async () => {
            // Basic test for WebSocket endpoint availability
            const response = await request(app)
                .get('/ws')
                .set('Upgrade', 'websocket')
                .set('Connection', 'Upgrade')
                .set('Sec-WebSocket-Key', 'test-key')
                .set('Sec-WebSocket-Version', '13');

            // Should return appropriate response for WebSocket upgrade
            expect([101, 400, 426]).toContain(response.status);
        });
    });
});

module.exports = { app };