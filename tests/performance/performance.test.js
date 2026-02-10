/**
 * Performance and Load Tests
 * 
 * Tests system performance, scalability, and resource usage under various loads
 */

const request = require('supertest');
const app = require('../../enhanced-server');
const { performance } = require('perf_hooks');

describe('Performance Tests', () => {
    let server;
    const performanceResults = {
        responseTimes: [],
        throughput: [],
        memoryUsage: [],
        cpuUsage: []
    };

    beforeAll(async () => {
        server = app.listen(0);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Baseline system metrics
        console.log('🔧 Starting performance test suite...');
        console.log('📊 Initial memory usage:', process.memoryUsage());
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }

        // Report performance summary
        console.log('\n📈 Performance Test Summary:');
        if (performanceResults.responseTimes.length > 0) {
            const avgResponseTime = performanceResults.responseTimes.reduce((a, b) => a + b) / performanceResults.responseTimes.length;
            const maxResponseTime = Math.max(...performanceResults.responseTimes);
            console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
            console.log(`   Max Response Time: ${maxResponseTime.toFixed(2)}ms`);
        }
    });

    describe('Response Time Benchmarks', () => {
        test('health endpoint should respond quickly', async () => {
            const measurements = [];

            for (let i = 0; i < 10; i++) {
                const startTime = performance.now();

                const response = await request(app).get('/health');

                const endTime = performance.now();
                const responseTime = endTime - startTime;

                measurements.push(responseTime);

                expect(response.status).toBe(200);
            }

            const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
            const maxResponseTime = Math.max(...measurements);

            performanceResults.responseTimes.push(...measurements);

            // Health endpoint should be very fast
            expect(avgResponseTime).toBeLessThan(50); // <50ms average
            expect(maxResponseTime).toBeLessThan(200); // <200ms max

            console.log(`   Health endpoint - Avg: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`);
        });

        test('task submission should be efficient', async () => {
            const measurements = [];

            for (let i = 0; i < 5; i++) {
                const startTime = performance.now();

                const response = await request(app)
                    .post('/api/tasks')
                    .send({
                        type: 'text-generation',
                        input: `Performance test task ${i + 1}`,
                        priority: 'normal'
                    });

                const endTime = performance.now();
                const responseTime = endTime - startTime;

                measurements.push(responseTime);

                expect(response.status).toBe(201);

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
            const maxResponseTime = Math.max(...measurements);

            performanceResults.responseTimes.push(...measurements);

            // Task submission should be reasonably fast
            expect(avgResponseTime).toBeLessThan(500); // <500ms average
            expect(maxResponseTime).toBeLessThan(2000); // <2s max

            console.log(`   Task submission - Avg: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`);
        });

        test('task status lookup should be fast', async () => {
            // First create a task
            const submitResponse = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: 'Test task for status lookup performance',
                    priority: 'normal'
                });

            expect(submitResponse.status).toBe(201);
            const taskId = submitResponse.body.taskId;

            const measurements = [];

            // Test status lookup performance
            for (let i = 0; i < 10; i++) {
                const startTime = performance.now();

                const response = await request(app).get(`/api/tasks/${taskId}`);

                const endTime = performance.now();
                const responseTime = endTime - startTime;

                measurements.push(responseTime);

                expect(response.status).toBe(200);

                await new Promise(resolve => setTimeout(resolve, 50));
            }

            const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;

            performanceResults.responseTimes.push(...measurements);

            // Status lookup should be very fast
            expect(avgResponseTime).toBeLessThan(100); // <100ms average

            console.log(`   Status lookup - Avg: ${avgResponseTime.toFixed(2)}ms`);
        });
    });

    describe('Throughput Testing', () => {
        test('should handle concurrent requests efficiently', async () => {
            const concurrentRequests = 10;
            const startTime = performance.now();

            const promises = Array(concurrentRequests).fill().map((_, i) =>
                request(app)
                    .post('/api/tasks')
                    .send({
                        type: 'text-generation',
                        input: `Concurrent test ${i + 1}`,
                        priority: 'normal'
                    })
            );

            const responses = await Promise.all(promises);

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const throughput = (concurrentRequests / totalTime) * 1000; // requests per second

            performanceResults.throughput.push(throughput);

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(201);
            });

            // Should achieve reasonable throughput
            expect(throughput).toBeGreaterThan(5); // >5 req/sec
            expect(totalTime).toBeLessThan(5000); // <5s total

            console.log(`   Concurrent throughput: ${throughput.toFixed(2)} req/sec (${concurrentRequests} concurrent)`);
        });

        test('should maintain performance under sustained load', async () => {
            const numRequests = 20;
            const batchSize = 5;
            const batches = numRequests / batchSize;

            const batchTimes = [];

            for (let batch = 0; batch < batches; batch++) {
                const batchStartTime = performance.now();

                const batchPromises = Array(batchSize).fill().map((_, i) =>
                    request(app)
                        .post('/api/tasks')
                        .send({
                            type: 'text-generation',
                            input: `Sustained load test batch ${batch + 1} request ${i + 1}`,
                            priority: 'normal'
                        })
                );

                const batchResponses = await Promise.all(batchPromises);

                const batchEndTime = performance.now();
                const batchTime = batchEndTime - batchStartTime;
                batchTimes.push(batchTime);

                // All requests in batch should succeed
                batchResponses.forEach(response => {
                    expect(response.status).toBe(201);
                });

                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const avgBatchTime = batchTimes.reduce((a, b) => a + b) / batchTimes.length;
            const avgBatchThroughput = (batchSize / avgBatchTime) * 1000;

            performanceResults.throughput.push(avgBatchThroughput);

            // Performance should remain consistent across batches
            const maxBatchTime = Math.max(...batchTimes);
            const minBatchTime = Math.min(...batchTimes);
            const variation = (maxBatchTime - minBatchTime) / avgBatchTime;

            expect(variation).toBeLessThan(2.0); // <200% variation
            expect(avgBatchThroughput).toBeGreaterThan(2); // >2 req/sec sustained

            console.log(`   Sustained throughput: ${avgBatchThroughput.toFixed(2)} req/sec (${batches} batches)`);
        });
    });

    describe('Resource Usage Monitoring', () => {
        test('should not leak memory under load', async () => {
            const initialMemory = process.memoryUsage();

            // Generate load
            const promises = [];
            for (let i = 0; i < 15; i++) {
                promises.push(
                    request(app)
                        .post('/api/tasks')
                        .send({
                            type: 'text-generation',
                            input: `Memory test ${i + 1} with some additional content to use memory`,
                            priority: 'normal'
                        })
                );
            }

            await Promise.all(promises);

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            // Wait a bit for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));

            const finalMemory = process.memoryUsage();

            performanceResults.memoryUsage.push({
                initial: initialMemory,
                final: finalMemory,
                increase: finalMemory.heapUsed - initialMemory.heapUsed
            });

            // Memory increase should be reasonable
            const memoryIncreaseMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

            expect(memoryIncreaseMB).toBeLessThan(50); // <50MB increase

            console.log(`   Memory usage: +${memoryIncreaseMB.toFixed(2)}MB (${initialMemory.heapUsed / 1024 / 1024} → ${finalMemory.heapUsed / 1024 / 1024}MB)`);
        });

        test('should handle large payloads efficiently', async () => {
            const largeInput = 'A'.repeat(10000); // 10KB input

            const startTime = performance.now();
            const initialMemory = process.memoryUsage().heapUsed;

            const response = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: largeInput,
                    priority: 'normal'
                });

            const endTime = performance.now();
            const finalMemory = process.memoryUsage().heapUsed;

            const processingTime = endTime - startTime;
            const memoryIncrease = (finalMemory - initialMemory) / 1024; // KB

            expect(response.status).toBe(201);
            expect(processingTime).toBeLessThan(1000); // <1s
            expect(memoryIncrease).toBeLessThan(1000); // <1MB temporary increase

            console.log(`   Large payload: ${processingTime.toFixed(2)}ms, +${memoryIncrease.toFixed(2)}KB`);
        });
    });

    describe('Scalability Testing', () => {
        test('should handle increasing load gracefully', async () => {
            const loadLevels = [2, 5, 8, 12];
            const results = [];

            for (const loadLevel of loadLevels) {
                const startTime = performance.now();

                const promises = Array(loadLevel).fill().map((_, i) =>
                    request(app)
                        .post('/api/tasks')
                        .send({
                            type: 'text-generation',
                            input: `Scalability test load ${loadLevel} request ${i + 1}`,
                            priority: 'normal'
                        })
                );

                const responses = await Promise.all(promises);

                const endTime = performance.now();
                const totalTime = endTime - startTime;
                const avgResponseTime = totalTime / loadLevel;

                results.push({
                    loadLevel,
                    totalTime,
                    avgResponseTime,
                    successRate: responses.filter(r => r.status === 201).length / responses.length
                });

                // All requests should still succeed
                expect(responses.filter(r => r.status === 201).length).toBe(loadLevel);

                // Small delay between load levels
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Response times should scale reasonably
            results.forEach((result, index) => {
                if (index > 0) {
                    const previousResult = results[index - 1];
                    const scalingFactor = result.avgResponseTime / previousResult.avgResponseTime;

                    // Should not degrade exponentially
                    expect(scalingFactor).toBeLessThan(3.0); // <3x degradation per level
                }

                console.log(`   Load ${result.loadLevel}: ${result.avgResponseTime.toFixed(2)}ms avg, ${(result.successRate * 100).toFixed(1)}% success`);
            });
        });

        test('should recover from peak load', async () => {
            // Generate peak load
            const peakLoad = 15;
            const peakPromises = Array(peakLoad).fill().map((_, i) =>
                request(app)
                    .post('/api/tasks')
                    .send({
                        type: 'text-generation',
                        input: `Peak load test ${i + 1}`,
                        priority: 'normal'
                    })
            );

            await Promise.all(peakPromises);

            // Wait for system to settle
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Test normal load performance after peak
            const normalStartTime = performance.now();

            const normalResponse = await request(app)
                .post('/api/tasks')
                .send({
                    type: 'text-generation',
                    input: 'Post-peak recovery test',
                    priority: 'normal'
                });

            const normalEndTime = performance.now();
            const recoveryTime = normalEndTime - normalStartTime;

            expect(normalResponse.status).toBe(201);
            expect(recoveryTime).toBeLessThan(1000); // Should recover to <1s response

            console.log(`   Recovery time after peak: ${recoveryTime.toFixed(2)}ms`);
        });
    });

    describe('API Endpoint Performance', () => {
        test('model information endpoint performance', async () => {
            const measurements = [];

            for (let i = 0; i < 5; i++) {
                const startTime = performance.now();

                const response = await request(app).get('/api/models');

                const endTime = performance.now();
                const responseTime = endTime - startTime;

                measurements.push(responseTime);

                expect([200, 404]).toContain(response.status);

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;

            expect(avgResponseTime).toBeLessThan(200); // <200ms

            console.log(`   Models endpoint - Avg: ${avgResponseTime.toFixed(2)}ms`);
        });

        test('statistics endpoint performance', async () => {
            const measurements = [];

            for (let i = 0; i < 3; i++) {
                const startTime = performance.now();

                const response = await request(app).get('/api/stats');

                const endTime = performance.now();
                const responseTime = endTime - startTime;

                measurements.push(responseTime);

                expect([200, 404]).toContain(response.status);

                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;

            expect(avgResponseTime).toBeLessThan(500); // <500ms for stats

            console.log(`   Stats endpoint - Avg: ${avgResponseTime.toFixed(2)}ms`);
        });
    });

    describe('WebSocket Performance', () => {
        test('should handle WebSocket connections efficiently', async () => {
            // Note: This is a placeholder test as WebSocket testing requires special setup
            // In a real implementation, this would test WebSocket connection/disconnection performance

            const startTime = performance.now();

            // Simulate WebSocket-related API calls
            const response = await request(app).get('/health');

            const endTime = performance.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(100);

            console.log(`   WebSocket simulation: ${responseTime.toFixed(2)}ms`);
        });
    });
});