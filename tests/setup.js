/**
 * Jest Test Setup
 * Global configuration and helpers for NeuroGrid tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002'; // Different port for testing
process.env.DATABASE_URL = 'sqlite::memory:';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods for cleaner test output (optional)
global.console = {
    ...console,
    // Uncomment to suppress logs during tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};

// Global test utilities
global.testUtils = {
    // Helper function to create mock request/response objects
    createMockReq: (options = {}) => ({
        body: {},
        params: {},
        query: {},
        headers: {},
        ...options
    }),
    
    createMockRes: () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        res.end = jest.fn().mockReturnValue(res);
        return res;
    }
};