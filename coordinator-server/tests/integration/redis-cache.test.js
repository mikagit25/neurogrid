const request = require('supertest');
const { app } = require('../../src/app');
const RedisConfig = require('../../src/config/redis');
const CacheService = require('../../src/services/CacheService');

describe('Redis Caching Integration', () => {
  let redisConfig;
  let cacheService;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Initialize Redis for testing
    redisConfig = new RedisConfig();
    
    try {
      await redisConfig.initialize();
      cacheService = new CacheService(redisConfig);
      console.log('Redis connected for testing');
    } catch (error) {
      console.log('Redis not available for testing, skipping Redis tests');
      return;
    }

    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'cache.test@example.com',
        password: 'TestPassword123!',
        username: 'cachetest'
      });

    if (registerResponse.status === 201) {
      testUser = registerResponse.body.data.user;
      authToken = registerResponse.body.data.token;
    } else {
      // User might already exist, try login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'cache.test@example.com',
          password: 'TestPassword123!'
        });
      
      testUser = loginResponse.body.data.user;
      authToken = loginResponse.body.data.token;
    }
  }, 30000);

  afterAll(async () => {
    if (redisConfig) {
      // Clean up test data
      await redisConfig.flushdb();
      await redisConfig.disconnect();
    }
  });

  beforeEach(async () => {
    if (cacheService) {
      // Clear cache before each test
      await redisConfig.flushdb();
    }
  });

  describe('Cache Demo Endpoints', () => {
    test('should handle cache demo without Redis', async () => {
      const response = await request(app)
        .get('/api/cache/demo')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('cached');
      expect(response.body.data).toHaveProperty('processing_time');
    });

    test('should cache and retrieve demo data with Redis', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      // First request - should miss cache
      const firstResponse = await request(app)
        .get('/api/cache/demo?key=test1&ttl=60')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.body.data.cached).toBe(false);
      expect(firstResponse.body.data.cache_key).toContain('demo:');

      // Second request - should hit cache
      const secondResponse = await request(app)
        .get('/api/cache/demo?key=test1&ttl=60')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.data.cached).toBe(true);
      expect(secondResponse.body.data.processing_time).toBeLessThan(50);
    });

    test('should invalidate cache key', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      // Set cache
      await request(app)
        .get('/api/cache/demo?key=test2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Invalidate cache
      const deleteResponse = await request(app)
        .delete('/api/cache/demo/test2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.deleted).toBe(true);

      // Next request should miss cache
      const response = await request(app)
        .get('/api/cache/demo?key=test2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.cached).toBe(false);
    });

    test('should return cached node list', async () => {
      const response = await request(app)
        .get('/api/cache/nodes?region=us-west-2&status=online')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('nodes');
      expect(response.body.data).toHaveProperty('cache_info');
      expect(Array.isArray(response.body.data.nodes)).toBe(true);
    });

    test('should return user data with caching', async () => {
      const response = await request(app)
        .get('/api/cache/user-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('preferences');
    });

    test('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/cache/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timestamp');
      
      if (cacheService) {
        expect(response.body.data).toHaveProperty('stats');
        expect(response.body.data).toHaveProperty('health');
      } else {
        expect(response.body.data.status).toBe('unavailable');
      }
    });
  });

  describe('Cache Service Direct Tests', () => {
    test('should cache and retrieve data', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      const testData = { message: 'test data', timestamp: new Date() };
      const key = 'test:direct:1';
      
      // Cache data
      await cacheService.set(key, testData, 60);
      
      // Retrieve data
      const retrieved = await cacheService.get(key);
      
      expect(retrieved).toEqual(testData);
    });

    test('should handle cache expiration', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      const testData = { message: 'expiring data' };
      const key = 'test:expiring:1';
      
      // Cache with 1 second TTL
      await cacheService.set(key, testData, 1);
      
      // Should be available immediately
      let retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(testData);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be null after expiration
      retrieved = await cacheService.get(key);
      expect(retrieved).toBeNull();
    });

    test('should support cache patterns and invalidation', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      // Set multiple keys with same pattern
      await cacheService.set('user:123:profile', { name: 'John' }, 60);
      await cacheService.set('user:123:settings', { theme: 'dark' }, 60);
      await cacheService.set('user:456:profile', { name: 'Jane' }, 60);

      // Verify data is cached
      expect(await cacheService.get('user:123:profile')).toEqual({ name: 'John' });
      expect(await cacheService.get('user:456:profile')).toEqual({ name: 'Jane' });

      // Invalidate user 123 data
      await cacheService.invalidatePattern('user:123:*');

      // User 123 data should be gone
      expect(await cacheService.get('user:123:profile')).toBeNull();
      expect(await cacheService.get('user:123:settings')).toBeNull();

      // User 456 data should still exist
      expect(await cacheService.get('user:456:profile')).toEqual({ name: 'Jane' });
    });

    test('should provide health check information', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      const health = await cacheService.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('latency');
      expect(health).toHaveProperty('memory');
      expect(health).toHaveProperty('connections');
      expect(health.status).toBe('healthy');
    });

    test('should provide cache statistics', async () => {
      if (!cacheService) {
        console.log('Skipping Redis test - Redis not available');
        return;
      }

      // Generate some cache activity
      await cacheService.set('stats:test:1', { data: 'test' }, 60);
      await cacheService.get('stats:test:1');
      await cacheService.get('stats:nonexistent');

      const stats = await cacheService.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('memory_usage');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });
  });

  describe('Cache Middleware Integration', () => {
    test('should work without authentication for public endpoints', async () => {
      // Test a monitoring endpoint which might use caching but doesn't require auth
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    test('should handle authentication errors gracefully', async () => {
      const response = await request(app)
        .get('/api/cache/demo')
        .expect(401); // Should get unauthorized without token

      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid tokens gracefully', async () => {
      const response = await request(app)
        .get('/api/cache/demo')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});