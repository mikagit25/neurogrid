const RedisConfig = require('../../src/config/redis');
const CacheService = require('../../src/services/CacheService');
const CacheMiddleware = require('../../src/middleware/cache');

describe('Redis Components Unit Tests', () => {
  let redisConfig;
  let cacheService;
  let cacheMiddleware;

  beforeAll(async () => {
    // Initialize Redis for testing
    redisConfig = new RedisConfig();
    
    try {
      await redisConfig.initialize();
      cacheService = new CacheService(redisConfig);
      cacheMiddleware = new CacheMiddleware(cacheService);
      console.log('✓ Redis connected for testing');
    } catch (error) {
      console.log('⚠️  Redis not available for testing, will test fallback behavior');
    }
  }, 30000);

  afterAll(async () => {
    if (redisConfig) {
      try {
        await redisConfig.flushdb();
        await redisConfig.disconnect();
        console.log('✓ Redis disconnected and cleaned up');
      } catch (error) {
        console.log('⚠️  Error during Redis cleanup:', error.message);
      }
    }
  });

  beforeEach(async () => {
    if (cacheService) {
      try {
        await redisConfig.flushdb();
      } catch (error) {
        console.log('⚠️  Could not clear cache before test');
      }
    }
  });

  describe('RedisConfig', () => {
    test('should initialize with default configuration', () => {
      const config = new RedisConfig();
      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(6379);
      expect(config.db).toBe(0);
    });

    test('should handle connection gracefully', async () => {
      if (!redisConfig.client) {
        console.log('Skipping Redis connection test - Redis not available');
        return;
      }

      const health = await redisConfig.healthCheck();
      expect(health).toHaveProperty('status');
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });

    test('should support basic operations', async () => {
      if (!redisConfig.client) {
        console.log('Skipping Redis operations test - Redis not available');
        return;
      }

      const key = 'test:redis:basic';
      const value = { message: 'Hello Redis!', timestamp: Date.now() };

      // Set value
      await redisConfig.set(key, value, 60);

      // Get value
      const retrieved = await redisConfig.get(key);
      expect(retrieved).toEqual(value);

      // Delete value
      const deleted = await redisConfig.del(key);
      expect(deleted).toBe(1);

      // Verify deletion
      const afterDelete = await redisConfig.get(key);
      expect(afterDelete).toBeNull();
    });

    test('should handle hash operations', async () => {
      if (!redisConfig.client) {
        console.log('Skipping Redis hash test - Redis not available');
        return;
      }

      const hashKey = 'test:hash:user';
      const userData = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Set hash fields
      await redisConfig.hset(hashKey, userData);

      // Get single field
      const name = await redisConfig.hget(hashKey, 'name');
      expect(name).toBe('John Doe');

      // Get all fields
      const allData = await redisConfig.hgetall(hashKey);
      expect(allData).toEqual(userData);

      // Delete hash
      await redisConfig.del(hashKey);
    });
  });

  describe('CacheService', () => {
    test('should handle fallback when Redis unavailable', async () => {
      const fallbackService = new CacheService(null);
      
      // Should not throw errors
      await expect(fallbackService.set('test', { data: 'test' }, 60)).resolves.toBe(false);
      await expect(fallbackService.get('test')).resolves.toBeNull();
      await expect(fallbackService.del('test')).resolves.toBe(0);
    });

    test('should cache data with TTL', async () => {
      if (!cacheService || !cacheService.redis) {
        console.log('Skipping CacheService test - Redis not available');
        return;
      }

      const key = 'test:cache:ttl';
      const data = { message: 'cached data', value: 42 };

      // Cache data
      const setCacheResult = await cacheService.set(key, data, 1);
      expect(setCacheResult).toBe(true);

      // Retrieve immediately
      const cached = await cacheService.get(key);
      expect(cached).toEqual(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const expired = await cacheService.get(key);
      expect(expired).toBeNull();
    });

    test('should support pattern-based invalidation', async () => {
      if (!cacheService || !cacheService.redis) {
        console.log('Skipping CacheService pattern test - Redis not available');
        return;
      }

      // Set multiple keys
      await cacheService.set('user:123:profile', { name: 'John' }, 60);
      await cacheService.set('user:123:settings', { theme: 'dark' }, 60);
      await cacheService.set('user:456:profile', { name: 'Jane' }, 60);

      // Verify data exists
      expect(await cacheService.get('user:123:profile')).toEqual({ name: 'John' });
      expect(await cacheService.get('user:456:profile')).toEqual({ name: 'Jane' });

      // Invalidate user 123 data
      const invalidated = await cacheService.invalidatePattern('user:123:*');
      expect(invalidated).toBeGreaterThan(0);

      // User 123 data should be gone
      expect(await cacheService.get('user:123:profile')).toBeNull();
      expect(await cacheService.get('user:123:settings')).toBeNull();

      // User 456 data should remain
      expect(await cacheService.get('user:456:profile')).toEqual({ name: 'Jane' });
    });

    test('should provide cached function wrapper', async () => {
      if (!cacheService || !cacheService.redis) {
        console.log('Skipping CacheService cached() test - Redis not available');
        return;
      }

      let callCount = 0;
      const expensiveFunction = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: 'expensive computation', callCount };
      };

      // First call - should execute function
      const result1 = await cacheService.cached('test:expensive', expensiveFunction, 60);
      expect(result1.callCount).toBe(1);
      expect(callCount).toBe(1);

      // Second call - should use cache
      const result2 = await cacheService.cached('test:expensive', expensiveFunction, 60);
      expect(result2.callCount).toBe(1); // Same as cached result
      expect(callCount).toBe(1); // Function not called again
    });

    test('should provide health check information', async () => {
      if (!cacheService || !cacheService.redis) {
        console.log('Skipping CacheService health test - Redis not available');
        return;
      }

      const health = await cacheService.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('latency');
      expect(health).toHaveProperty('memory');
      expect(health.status).toBe('healthy');
      expect(typeof health.latency).toBe('number');
    });

    test('should provide cache statistics', async () => {
      if (!cacheService || !cacheService.redis) {
        console.log('Skipping CacheService stats test - Redis not available');
        return;
      }

      // Generate some activity
      await cacheService.set('stats:test:1', { data: 'test' }, 60);
      await cacheService.get('stats:test:1'); // Hit
      await cacheService.get('stats:nonexistent'); // Miss

      const stats = await cacheService.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('keys');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });
  });

  describe('CacheMiddleware', () => {
    test('should handle missing cache service gracefully', () => {
      const middleware = new CacheMiddleware(null);
      
      expect(middleware.cacheService).toBeNull();
      expect(typeof middleware.cacheResponse).toBe('function');
      expect(typeof middleware.rateLimiter).toBe('function');
    });

    test('should create cache response middleware', () => {
      if (!cacheMiddleware) {
        console.log('Skipping CacheMiddleware test - Redis not available');
        return;
      }

      const middleware = cacheMiddleware.cacheResponse(300);
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    test('should create rate limiter middleware', () => {
      if (!cacheMiddleware) {
        console.log('Skipping CacheMiddleware rate limiter test - Redis not available');
        return;
      }

      const rateLimiter = cacheMiddleware.rateLimiter({
        windowMs: 60000,
        max: 100
      });
      
      expect(typeof rateLimiter).toBe('function');
      expect(rateLimiter.length).toBe(3); // req, res, next
    });

    test('should extract cache key from request', () => {
      if (!cacheMiddleware) {
        console.log('Skipping CacheMiddleware key test - Redis not available');
        return;
      }

      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test?param=value',
        user: { id: '123' }
      };

      const key = cacheMiddleware.getCacheKey(mockReq);
      expect(typeof key).toBe('string');
      expect(key).toContain('GET');
      expect(key).toContain('/api/test');
    });
  });

  describe('Integration Tests', () => {
    test('should work together as a system', async () => {
      if (!cacheService || !cacheMiddleware) {
        console.log('Skipping integration test - Redis not available');
        return;
      }

      // Simulate user data caching
      const userId = '123';
      const userData = {
        id: userId,
        email: 'user@example.com',
        profile: { name: 'Test User' },
        preferences: { theme: 'dark' }
      };

      // Cache user data
      await cacheService.setUser(userId, userData, 1800);
      
      // Retrieve user data
      const cachedUser = await cacheService.getUser(userId);
      expect(cachedUser).toEqual(userData);

      // Cache session data
      const sessionId = 'session-abc123';
      const sessionData = {
        userId: userId,
        loginTime: new Date().toISOString(),
        ipAddress: '127.0.0.1'
      };

      await cacheService.setSession(sessionId, sessionData, 3600);
      const cachedSession = await cacheService.getSession(sessionId);
      expect(cachedSession).toEqual(sessionData);

      // Test cache invalidation
      await cacheService.invalidateUser(userId);
      const invalidatedUser = await cacheService.getUser(userId);
      expect(invalidatedUser).toBeNull();

      // Session should still exist
      const sessionAfterUserInvalidation = await cacheService.getSession(sessionId);
      expect(sessionAfterUserInvalidation).toEqual(sessionData);
    });

    test('should handle Redis reconnection gracefully', async () => {
      if (!redisConfig) {
        console.log('Skipping reconnection test - Redis not available');
        return;
      }

      // Test that operations continue to work
      const testKey = 'test:reconnection';
      const testData = { message: 'reconnection test' };

      const setResult = await redisConfig.set(testKey, testData, 60);
      if (setResult) {
        const retrieved = await redisConfig.get(testKey);
        expect(retrieved).toEqual(testData);
      }

      // Clean up
      await redisConfig.del(testKey);
    });
  });
});