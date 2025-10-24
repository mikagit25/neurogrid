const request = require('supertest');
const { CoordinatorServer } = require('../../src/app');
const ConfigManager = require('../../src/config/manager');

describe('API Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Initialize test server
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Use random available port
    
    try {
      const config = await ConfigManager.create();
      const testServer = new CoordinatorServer(config);
      await testServer.initialize();
      
      app = testServer.app;
      server = testServer.server;
    } catch (error) {
      console.error('Failed to initialize test server:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (server && server.close) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('Health Endpoints', () => {
    test('GET /health - should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('memory');
    });

    test('GET /api/monitoring/health - should return monitoring health', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('components');
      expect(response.body).toHaveProperty('lastCheck');
    });

    test('GET /api/monitoring/health/live - should return liveness probe', async () => {
      const response = await request(app)
        .get('/api/monitoring/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
    });

    test('GET /api/monitoring/health/ready - should return readiness probe', async () => {
      const response = await request(app)
        .get('/api/monitoring/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('components');
    });
  });

  describe('Authentication API', () => {
    let testUser;
    let authToken;

    beforeAll(() => {
      testUser = {
        username: 'testuser_' + Date.now(),
        email: `test_${Date.now()}@neurogrid.com`,
        password: 'SecurePassword123!'
      };
    });

    test('POST /api/auth/register - should register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('username', testUser.username);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('POST /api/auth/register - should fail with duplicate user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/auth/login - should authenticate user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      
      authToken = response.body.token;
    });

    test('POST /api/auth/login - should fail with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('GET /api/auth/profile - should get user profile with token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('username', testUser.username);
    });

    test('GET /api/auth/profile - should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on auth endpoints', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'wrongpassword'
      };

      // Make multiple rapid requests to trigger rate limit
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/tasks')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization,Content-Type')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Monitoring Endpoints', () => {
    test('GET /api/monitoring/metrics - should return metrics', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('health');
      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('system');
    });

    test('GET /api/monitoring/metrics/prometheus - should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics/prometheus')
        .expect(200);

      expect(response.type).toBe('text/plain');
      expect(response.text).toContain('#');
    });

    test('GET /api/monitoring/system/info - should return system information', async () => {
      const response = await request(app)
        .get('/api/monitoring/system/info')
        .expect(200);

      expect(response.body).toHaveProperty('hostname');
      expect(response.body).toHaveProperty('platform');
      expect(response.body).toHaveProperty('architecture');
      expect(response.body).toHaveProperty('nodeVersion');
    });
  });
});