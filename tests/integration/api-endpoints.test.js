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
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('Health Checks', () => {
        test('GET /health should return 200 OK', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body.status).toBe('OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('service');
        });

        test('GET /api/health should return detailed system info', async () => {
            const response = await request(app).get('/api/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('coordinators');
            expect(response.body).toHaveProperty('performance');
            expect(response.body.coordinators).toHaveProperty('total');
            expect(response.body.coordinators).toHaveProperty('active');
        });
    });

    describe('AI Task Management', () => {
        test('POST /api/tasks should create new task', async () => {
            const taskData = {
                type: 'text-generation',
                input: 'Write a short story about a robot learning to love',
                model: 'gpt-3.5-turbo',
                priority: 'normal'
            };

            const response = await request(app)
                .post('/api/tasks')
                .send(taskData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('taskId');
            expect(response.body).toHaveProperty('status', 'pending');
            expect(response.body.taskId).toMatch(/^task-\d+$/);
        });

        test('POST /api/tasks should validate required fields', async () => {
            const incompleteTask = {
                type: 'text-generation'
                // Missing required 'input' field
            };

            const response = await request(app)
                .post('/api/tasks')
                .send(incompleteTask);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('input');
        });

        test('POST /api/tasks should handle code generation', async () => {
            const codeTask = {
                type: 'code-generation',
                input: 'Create a Python function to calculate fibonacci numbers',
                language: 'python',
                priority: 'high'
            };

            const response = await request(app)
                .post('/api/tasks')
                .send(codeTask);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('taskId');
        });

        test('POST /api/tasks should handle image generation', async () => {
            const imageTask = {
                type: 'image-generation',
                input: 'A futuristic cityscape with flying cars at sunset',
                style: 'digital art',
                priority: 'normal'
            };

            const response = await request(app)
                .post('/api/tasks')
                .send(imageTask);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('taskId');
        });

        test('GET /api/tasks/:id should return task status', async () => {
            // First create a task
            const createResponse = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: 'Test task for status check'
                });

            const taskId = createResponse.body.taskId;

            // Then check its status
            const statusResponse = await request(app)
                .get(`/api/tasks/${taskId}`);

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body).toHaveProperty('taskId', taskId);
            expect(statusResponse.body).toHaveProperty('status');
            expect(['pending', 'processing', 'completed', 'failed']).toContain(statusResponse.body.status);
        });

        test('GET /api/tasks/nonexistent should return 404', async () => {
            const response = await request(app)
                .get('/api/tasks/nonexistent-task-id');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Model Management', () => {
        test('GET /api/models should return available models', async () => {
            const response = await request(app).get('/api/models');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);

            // Check model structure
            const model = response.body[0];
            expect(model).toHaveProperty('id');
            expect(model).toHaveProperty('name');
            expect(model).toHaveProperty('category');
            expect(model).toHaveProperty('capabilities');
        });

        test('GET /api/models/stats should return model statistics', async () => {
            const response = await request(app).get('/api/models/stats');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalModels');
            expect(response.body).toHaveProperty('categories');
            expect(response.body).toHaveProperty('performance');
            expect(typeof response.body.totalModels).toBe('number');
        });

        test('GET /api/models/:category should filter by category', async () => {
            const response = await request(app).get('/api/models/text');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);

            // All models should be text category
            response.body.forEach(model => {
                expect(model.category).toBe('text');
            });
        });
    });

    describe('Node Management', () => {
        test('GET /api/nodes should return node statistics', async () => {
            const response = await request(app).get('/api/nodes');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalNodes');
            expect(response.body).toHaveProperty('activeNodes');
            expect(response.body).toHaveProperty('networkLoad');
            expect(typeof response.body.totalNodes).toBe('number');
            expect(typeof response.body.activeNodes).toBe('number');
        });

        test('GET /api/nodes/performance should return performance metrics', async () => {
            const response = await request(app).get('/api/nodes/performance');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('avgResponseTime');
            expect(response.body).toHaveProperty('throughput');
            expect(response.body).toHaveProperty('uptime');
            expect(typeof response.body.avgResponseTime).toBe('number');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid JSON', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .set('Content-Type', 'application/json')
                .send('invalid json');

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
        });

        test('should handle unsupported methods', async () => {
            const response = await request(app)
                .delete('/api/models');

            expect(response.status).toBe(405);
        });

        test('should handle rate limiting', async () => {
            // Make multiple rapid requests
            const promises = Array.from({ length: 20 }, () =>
                request(app).post('/api/tasks').send({
                    type: 'text-generation',
                    input: 'Rate limit test'
                })
            );

            const responses = await Promise.all(promises);

            // Some should be rate limited
            const rateLimited = responses.some(response => response.status === 429);
            expect(rateLimited).toBe(true);
        });
    });

    describe('Static File Serving', () => {
        test('should serve static files', async () => {
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/text\/html/);
        });

        test('should handle 404 for non-existent files', async () => {
            const response = await request(app).get('/nonexistent.html');

            expect(response.status).toBe(404);
        });
    });

    describe('WebSocket Integration', () => {
        test('should accept WebSocket connections', (done) => {
            const WebSocket = require('ws');
            const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);

            ws.on('open', () => {
                expect(ws.readyState).toBe(WebSocket.OPEN);
                ws.close();
                done();
            });

            ws.on('error', done);
        });

        test('should handle WebSocket messages', (done) => {
            const WebSocket = require('ws');
            const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    topic: 'tasks'
                }));
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message).toHaveProperty('type');
                ws.close();
                done();
            });

            ws.on('error', done);
        });
    });

    describe('Performance Tests', () => {
        test('should handle concurrent requests', async () => {
            const concurrentRequests = 10;
            const promises = Array.from({ length: concurrentRequests }, (_, i) =>
                request(app)
                    .post('/api/tasks')
                    .send({
                        type: 'text-generation',
                        input: `Concurrent test ${i}`,
                        priority: 'low'
                    })
            );

            const responses = await Promise.all(promises);

            // All should be successful (or rate limited, which is also acceptable)
            responses.forEach(response => {
                expect([201, 429]).toContain(response.status);
            });
        });

        test('should respond within reasonable time', async () => {
            const startTime = Date.now();

            await request(app)
                .get('/api/models');

            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        });
    });
});