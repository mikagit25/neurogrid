const request = require('supertest');
const app = require('../../src/app');
const { models } = require('../../src/models');

describe('API Integration Tests', () => {
  let testUser, testToken, testApiKey;

  beforeEach(async () => {
    testUser = await testUtils.createTestUser({
      username: 'apitest',
      email: 'apitest@example.com'
    });
    testToken = testUtils.generateTestToken(testUser.id, testUser.role);
    testApiKey = await testUtils.createTestApiKey(testUser.id);
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login - should authenticate user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'apitest@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('apitest@example.com');
    });

    test('POST /api/auth/login - should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'apitest@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('POST /api/auth/register - should register new user', async () => {
      const userData = {
        username: testUtils.randomUsername(),
        email: testUtils.randomEmail(),
        password: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
    });

    test('GET /api/auth/profile - should return user profile', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    test('GET /api/auth/profile - should reject without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Jobs Endpoints', () => {
    test('GET /api/jobs - should return user jobs', async () => {
      await testUtils.createTestJob(testUser.id, { title: 'Job 1' });
      await testUtils.createTestJob(testUser.id, { title: 'Job 2' });

      const response = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toHaveLength(2);
    });

    test('POST /api/jobs - should create new job', async () => {
      const jobData = {
        title: 'New Test Job',
        description: 'Test job description',
        job_type: 'ml_training',
        requirements: { gpu_memory: '8GB' },
        parameters: { epochs: 10 }
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${testToken}`)
        .send(jobData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job.title).toBe(jobData.title);
      expect(response.body.data.job.user_id).toBe(testUser.id);
    });

    test('GET /api/jobs/:id - should return specific job', async () => {
      const job = await testUtils.createTestJob(testUser.id);

      const response = await request(app)
        .get(`/api/jobs/${job.id}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job.id).toBe(job.id);
    });

    test('PUT /api/jobs/:id - should update job', async () => {
      const job = await testUtils.createTestJob(testUser.id);

      const response = await request(app)
        .put(`/api/jobs/${job.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'Updated Job Title' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job.title).toBe('Updated Job Title');
    });

    test('DELETE /api/jobs/:id - should delete job', async () => {
      const job = await testUtils.createTestJob(testUser.id);

      const response = await request(app)
        .delete(`/api/jobs/${job.id}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Nodes Endpoints', () => {
    test('GET /api/nodes - should return user nodes', async () => {
      await testUtils.createTestNode(testUser.id, { name: 'Node 1' });
      await testUtils.createTestNode(testUser.id, { name: 'Node 2' });

      const response = await request(app)
        .get('/api/nodes')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.nodes).toHaveLength(2);
    });

    test('POST /api/nodes - should create new node', async () => {
      const nodeData = {
        name: 'New Test Node',
        description: 'Test node description',
        node_type: 'compute',
        capabilities: { gpu: true, cpu_cores: 8 },
        hardware_info: { ram: '16GB' }
      };

      const response = await request(app)
        .post('/api/nodes')
        .set('Authorization', `Bearer ${testToken}`)
        .send(nodeData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.node.name).toBe(nodeData.name);
      expect(response.body.data.node.user_id).toBe(testUser.id);
    });
  });

  describe('API Key Authentication', () => {
    test('should authenticate with valid API key', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('X-API-Key', testApiKey.key);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('X-API-Key', 'invalid-api-key');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting', async () => {
      // Make multiple requests quickly
      const requests = Array(6).fill().map(() => 
        request(app)
          .get('/api/jobs')
          .set('Authorization', `Bearer ${testToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({}); // Empty payload should cause validation error

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });
});