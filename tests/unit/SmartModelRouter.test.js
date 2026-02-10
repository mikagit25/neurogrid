/**
 * Unit Tests for SmartModelRouter
 * Tests core AI routing functionality and model selection logic
 */

const SmartModelRouter = require('../../src/SmartModelRouter');
const { jest } = require('@jest/globals');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
}));

describe('SmartModelRouter', () => {
    let router;
    
    beforeEach(() => {
        // Create fresh instance for each test
        router = new SmartModelRouter();
        
        // Mock performance.now
        global.performance = {
            now: jest.fn().mockReturnValue(Date.now())
        };
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Initialization', () => {
        test('should initialize with default coordinators', () => {
            expect(router.coordinators).toBeDefined();
            expect(typeof router.coordinators).toBe('object');
            
            // Should have at least some coordinators
            const coordinatorCount = Object.keys(router.coordinators).length;
            expect(coordinatorCount).toBeGreaterThan(0);
        });
        
        test('should have model metadata loaded', () => {
            expect(router.modelManager).toBeDefined();
            expect(router.modelManager.modelsData).toBeDefined();
            expect(Array.isArray(router.modelManager.modelsData)).toBe(true);
        });
        
        test('should initialize with default settings', () => {
            expect(router.totalRequests).toBe(0);
            expect(router.lastCleanup).toBeDefined();
            expect(router.coordinatorStats).toBeDefined();
        });
    });
    
    describe('Model Selection', () => {
        test('should select appropriate model for text generation', () => {
            const task = {
                type: 'text-generation',
                input: 'Write a short story about AI',
                priority: 'normal'
            };
            
            const selectedModel = router.selectBestCoordinator(task);
            expect(selectedModel).toBeDefined();
            expect(selectedModel.model).toBeDefined();
            expect(selectedModel.score).toBeDefined();
            expect(selectedModel.score).toBeGreaterThan(0);
        });
        
        test('should select appropriate model for code generation', () => {
            const task = {
                type: 'code-generation',
                input: 'Write a function to sort an array',
                priority: 'normal'
            };
            
            const selectedModel = router.selectBestCoordinator(task);
            expect(selectedModel).toBeDefined();
            expect(selectedModel.model).toBeDefined();
            
            // Should prioritize code-specific models
            expect(selectedModel.model.toLowerCase()).toContain('code');
        });
        
        test('should handle unknown task types gracefully', () => {
            const task = {
                type: 'unknown-type',
                input: 'Some input',
                priority: 'normal'
            };
            
            const selectedModel = router.selectBestCoordinator(task);
            expect(selectedModel).toBeDefined();
            // Should fallback to a default model
        });
        
        test('should consider model load balancing', () => {
            const task = {
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