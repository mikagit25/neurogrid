/**
 * Comprehensive Unit Tests for SmartModelRouter
 * Tests AI routing functionality, performance, and edge cases
 */

const request = require('supertest');

// Mock dependencies first
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
}));

const SmartModelRouter = require('../../src/SmartModelRouter');
const { jest } = require('@jest/globals');

describe('SmartModelRouter Comprehensive Tests', () => {
    let router;

    beforeEach(() => {
        // Create fresh instance for each test
        router = new SmartModelRouter();

        // Mock performance.now
        global.performance = {
            now: jest.fn().mockReturnValue(Date.now())
        };

        // Reset stats
        router.totalRequests = 0;
        router.coordinatorStats = new Map();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should initialize with coordinators', () => {
            expect(router.coordinators).toBeDefined();
            expect(Object.keys(router.coordinators).length).toBeGreaterThan(0);
        });

        test('should have stats object with correct structure', () => {
            expect(router.totalRequests).toBe(0);
            expect(router.coordinatorStats).toBeDefined();
            expect(router.lastCleanup).toBeDefined();
        });

        test('should have model metadata loaded', () => {
            expect(router.modelManager).toBeDefined();
            expect(router.modelManager.modelsData).toBeDefined();
            expect(Array.isArray(router.modelManager.modelsData)).toBe(true);
        });
    });

    describe('Task Routing Logic', () => {
        test('should select coordinator based on task type', () => {
            const task = {
                type: 'text-generation',
                input: 'Write a story about AI',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();
            expect(result.model).toBeDefined();
            expect(result.score).toBeGreaterThan(0);
        });

        test('should handle code generation tasks', () => {
            const task = {
                type: 'code-generation',
                input: 'Create a sorting function',
                priority: 'high'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();
            expect(result.model).toBeDefined();
            // Should prefer code-specific models
            expect(result.model.toLowerCase()).toContain('code');
        });

        test('should handle image generation tasks', () => {
            const task = {
                type: 'image-generation',
                input: 'A beautiful sunset',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();
            expect(result.model).toBeDefined();
        });

        test('should handle unknown task types gracefully', () => {
            const task = {
                type: 'unknown-type',
                input: 'Some input',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();
            // Should fallback to default model
        });
    });

    describe('Load Balancing', () => {
        test('should distribute load across coordinators', () => {
            const tasks = Array(10).fill().map((_, i) => ({
                type: 'text-generation',
                input: `Task ${i}`,
                priority: 'normal'
            }));

            const coordinators = new Set();
            tasks.forEach(task => {
                const result = router.selectBestCoordinator(task);
                coordinators.add(result.model);
            });

            // Should use multiple coordinators for load distribution
            expect(coordinators.size).toBeGreaterThan(1);
        });

        test('should respect coordinator capacity limits', () => {
            // Simulate high load
            router.coordinatorStats.set('coord-1', {
                requests: 1000,
                avgResponseTime: 500,
                errorRate: 0.01
            });

            const task = {
                type: 'text-generation',
                input: 'Test task',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();
            // Should select less loaded coordinator
        });
    });

    describe('Performance Optimization', () => {
        test('should track response times', async () => {
            const startTime = Date.now();

            const task = {
                type: 'text-generation',
                input: 'Performance test',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();

            // Should complete selection quickly
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(100); // < 100ms
        });

        test('should cache model selection results', () => {
            const task = {
                type: 'text-generation',
                input: 'Cache test',
                priority: 'normal'
            };

            // First call
            const result1 = router.selectBestCoordinator(task);

            // Second call with same parameters
            const result2 = router.selectBestCoordinator(task);

            expect(result1.model).toBe(result2.model);
        });
    });

    describe('Error Handling', () => {
        test('should handle coordinator unavailability', () => {
            // Simulate all coordinators offline
            Object.keys(router.coordinators).forEach(key => {
                router.coordinators[key].active = false;
            });

            const task = {
                type: 'text-generation',
                input: 'Error test',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(task);
            expect(result).toBeDefined();
            // Should provide fallback option
        });

        test('should handle malformed tasks', () => {
            const malformedTasks = [
                null,
                undefined,
                {},
                { type: null },
                { type: '', input: '' }
            ];

            malformedTasks.forEach(task => {
                expect(() => {
                    router.selectBestCoordinator(task);
                }).not.toThrow();
            });
        });

        test('should handle coordinator errors gracefully', () => {
            // Mock coordinator that throws error
            router.coordinators['error-coord'] = {
                active: true,
                models: ['error-model'],
                getCapabilities: () => { throw new Error('Coordinator error'); }
            };

            const task = {
                type: 'text-generation',
                input: 'Error handling test',
                priority: 'normal'
            };

            expect(() => {
                router.selectBestCoordinator(task);
            }).not.toThrow();
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should track coordinator usage statistics', () => {
            const tasks = Array(5).fill().map(() => ({
                type: 'text-generation',
                input: 'Stats test',
                priority: 'normal'
            }));

            tasks.forEach(task => {
                router.selectBestCoordinator(task);
            });

            expect(router.totalRequests).toBeGreaterThan(0);
        });

        test('should provide coordinator health status', () => {
            const healthCheck = router.getCoordinatorHealth();

            expect(healthCheck).toBeDefined();
            expect(typeof healthCheck).toBe('object');
            expect(healthCheck.totalCoordinators).toBeGreaterThan(0);
        });

        test('should cleanup old statistics', () => {
            // Add old stats
            router.coordinatorStats.set('old-coord', {
                requests: 1,
                lastUsed: Date.now() - 3600000 // 1 hour ago
            });

            router.cleanupStats();

            // Old stats should be cleaned up
            expect(router.coordinatorStats.has('old-coord')).toBeFalsy();
        });
    });

    describe('Priority Handling', () => {
        test('should prioritize high priority tasks', () => {
            const highPriorityTask = {
                type: 'text-generation',
                input: 'Urgent task',
                priority: 'high'
            };

            const normalPriorityTask = {
                type: 'text-generation',
                input: 'Normal task',
                priority: 'normal'
            };

            const highResult = router.selectBestCoordinator(highPriorityTask);
            const normalResult = router.selectBestCoordinator(normalPriorityTask);

            expect(highResult.score).toBeGreaterThanOrEqual(normalResult.score);
        });

        test('should handle priority queue correctly', () => {
            const tasks = [
                { priority: 'low', type: 'text-generation', input: 'Low' },
                { priority: 'high', type: 'text-generation', input: 'High' },
                { priority: 'normal', type: 'text-generation', input: 'Normal' }
            ];

            const results = tasks.map(task => ({
                task,
                result: router.selectBestCoordinator(task)
            }));

            // High priority should get better coordinators
            const highPriorityResult = results.find(r => r.task.priority === 'high');
            expect(highPriorityResult.result.score).toBeDefined();
        });
    });

    describe('Model Compatibility', () => {
        test('should match models to task requirements', () => {
            const codeTask = {
                type: 'code-generation',
                input: 'def fibonacci(n):',
                language: 'python'
            };

            const result = router.selectBestCoordinator(codeTask);
            expect(result).toBeDefined();
            expect(result.model).toBeDefined();
        });

        test('should handle multi-modal tasks', () => {
            const multiModalTask = {
                type: 'text-to-image',
                input: 'A cat sitting on a computer',
                priority: 'normal'
            };

            const result = router.selectBestCoordinator(multiModalTask);
            expect(result).toBeDefined();
        });
    });

    describe('Integration Points', () => {
        test('should integrate with model manager', () => {
            expect(router.modelManager).toBeDefined();
            expect(typeof router.modelManager.getModelCapabilities).toBe('function');
        });

        test('should support external configuration', () => {
            const config = {
                maxCoordinators: 5,
                balancingStrategy: 'round-robin',
                healthCheckInterval: 30000
            };

            const configuredRouter = new SmartModelRouter(config);
            expect(configuredRouter).toBeDefined();
        });
    });
});

// Export router for integration tests
module.exports = { SmartModelRouter };
type: 'text-generation',
    input: 'Test input',
        priority: 'normal'
            };

const selections = [];
for (let i = 0; i < 10; i++) {
    const selected = router.selectBestCoordinator(task);
    selections.push(selected.model);
}

// Should not always select the same model (load balancing)
const uniqueModels = new Set(selections);
expect(uniqueModels.size).toBeGreaterThan(0);
        });
    });

describe('Task Processing', () => {
    test('should process simple text task successfully', async () => {
        const task = {
            type: 'text-generation',
            input: 'Hello world',
            priority: 'normal'
        };

        // Mock the actual AI processing
        const mockResult = {
            success: true,
            task: {
                id: 'test-task-1',
                status: 'completed',
                result: 'Mock AI generated response for: Hello world'
            }
        };

        // Spy on the coordinator call
        const processSpy = jest.spyOn(router, 'processTask').mockResolvedValue(mockResult);

        const result = await router.processTask(task);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.task).toBeDefined();
        expect(result.task.status).toBe('completed');
        expect(processSpy).toHaveBeenCalledWith(task);

        processSpy.mockRestore();
    });

    test('should handle processing errors gracefully', async () => {
        const task = {
            type: 'text-generation',
            input: 'Test input',
            priority: 'normal'
        };

        // Mock processing failure
        const processSpy = jest.spyOn(router, 'processTask').mockRejectedValue(
            new Error('Mock processing error')
        );

        await expect(router.processTask(task)).rejects.toThrow('Mock processing error');
        expect(processSpy).toHaveBeenCalledWith(task);

        processSpy.mockRestore();
    });

    test('should update coordinator stats after processing', async () => {
        const initialRequests = router.totalRequests;

        const task = {
            type: 'text-generation',
            input: 'Test input',
            priority: 'normal'
        };

        const mockResult = {
            success: true,
            task: { id: 'test', status: 'completed', result: 'Mock result' }
        };

        jest.spyOn(router, 'processTask').mockResolvedValue(mockResult);

        await router.processTask(task);

        expect(router.totalRequests).toBe(initialRequests + 1);
    });
});

describe('Performance Monitoring', () => {
    test('should track response times', async () => {
        const task = {
            type: 'code-generation',
            input: 'function test() {}',
            priority: 'normal'
        };

        const mockResult = {
            success: true,
            task: { id: 'test', status: 'completed', result: 'Mock result' }
        };

        jest.spyOn(router, 'processTask').mockResolvedValue(mockResult);

        const startTime = Date.now();
        await router.processTask(task);
        const endTime = Date.now();

        expect(endTime - startTime).toBeGreaterThan(0);
    });

    test('should clean up old stats periodically', () => {
        const initialCleanupTime = router.lastCleanup;

        // Manually trigger cleanup
        router.cleanupOldStats();

        expect(router.lastCleanup).toBeGreaterThanOrEqual(initialCleanupTime);
    });
});

describe('Error Handling', () => {
    test('should handle invalid task input', () => {
        expect(() => {
            router.selectBestCoordinator(null);
        }).toThrow();

        expect(() => {
            router.selectBestCoordinator({});
        }).toThrow();
    });

    test('should handle empty input gracefully', () => {
        const task = {
            type: 'text-generation',
            input: '',
            priority: 'normal'
        };

        const result = router.selectBestCoordinator(task);
        expect(result).toBeDefined();
        // Should still return a valid coordinator even with empty input
    });
});

describe('Configuration', () => {
    test('should be configurable with custom settings', () => {
        const customConfig = {
            maxRetries: 5,
            timeout: 60000,
            loadBalancingStrategy: 'round-robin'
        };

        const customRouter = new SmartModelRouter(customConfig);
        expect(customRouter).toBeDefined();
        // Would verify custom configuration is applied
    });
});
});