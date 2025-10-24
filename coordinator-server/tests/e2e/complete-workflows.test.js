const request = require('supertest');
const { CoordinatorServer } = require('../../src/app');
const ConfigManager = require('../../src/config/manager');

describe('E2E Tests - Complete User Workflows', () => {
  let app;
  let server;
  let testUsers = {};
  let testData = {};

  beforeAll(async () => {
    // Initialize test server
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    
    try {
      const config = await ConfigManager.create();
      const testServer = new CoordinatorServer(config);
      await testServer.initialize();
      
      app = testServer.app;
      server = testServer.server;
    } catch (error) {
      console.error('Failed to initialize test server for E2E:', error);
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

  describe('Complete User Journey - Task Creation and Management', () => {
    test('User Registration → Login → Profile → Task Creation → Task Management', async () => {
      const timestamp = Date.now();
      
      // Step 1: User Registration
      const userData = {
        username: `e2euser_${timestamp}`,
        email: `e2euser_${timestamp}@neurogrid.com`,
        password: 'SecurePassword123!'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.user.username).toBe(userData.username);
      
      testUsers.regular = {
        ...userData,
        id: registerResponse.body.user.id
      };

      // Step 2: User Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: userData.password
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();
      
      testUsers.regular.token = loginResponse.body.token;

      // Step 3: Get User Profile
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testUsers.regular.token}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.user.username).toBe(userData.username);

      // Step 4: Create a new task
      const taskData = {
        title: 'E2E Test AI Training Task',
        description: 'Complete end-to-end test task for AI model training',
        type: 'ai_training',
        budget: 150,
        requirements: {
          gpu: true,
          memory: '16GB',
          compute: 'high',
          framework: 'pytorch'
        },
        dataset: {
          name: 'CIFAR-10',
          size: '170MB'
        }
      };

      const createTaskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUsers.regular.token}`)
        .send(taskData)
        .expect(201);

      expect(createTaskResponse.body.success).toBe(true);
      expect(createTaskResponse.body.task.title).toBe(taskData.title);
      expect(createTaskResponse.body.task.status).toBe('pending');
      
      testData.task = createTaskResponse.body.task;

      // Step 5: List user's tasks
      const listTasksResponse = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${testUsers.regular.token}`)
        .expect(200);

      expect(listTasksResponse.body.success).toBe(true);
      expect(listTasksResponse.body.tasks.length).toBeGreaterThan(0);
      
      const userTask = listTasksResponse.body.tasks.find(t => t.id === testData.task.id);
      expect(userTask).toBeDefined();

      // Step 6: Get specific task details
      const getTaskResponse = await request(app)
        .get(`/api/tasks/${testData.task.id}`)
        .set('Authorization', `Bearer ${testUsers.regular.token}`)
        .expect(200);

      expect(getTaskResponse.body.success).toBe(true);
      expect(getTaskResponse.body.task.id).toBe(testData.task.id);
      expect(getTaskResponse.body.task.requirements).toEqual(taskData.requirements);

      // Step 7: Update task
      const updateData = {
        title: 'Updated E2E Test Task',
        budget: 200,
        priority: 'high'
      };

      const updateTaskResponse = await request(app)
        .put(`/api/tasks/${testData.task.id}`)
        .set('Authorization', `Bearer ${testUsers.regular.token}`)
        .send(updateData)
        .expect(200);

      expect(updateTaskResponse.body.success).toBe(true);
      expect(updateTaskResponse.body.task.title).toBe(updateData.title);
      expect(updateTaskResponse.body.task.budget).toBe(updateData.budget);

      // Step 8: Add task comment/note
      const commentResponse = await request(app)
        .post(`/api/tasks/${testData.task.id}/comments`)
        .set('Authorization', `Bearer ${testUsers.regular.token}`)
        .send({
          comment: 'This is a test comment for E2E testing'
        })
        .expect(201);

      expect(commentResponse.body.success).toBe(true);
    });
  });

  describe('Complete Admin Journey - Node Management', () => {
    test('Admin Registration → Node Registration → Node Management → Network Stats', async () => {
      const timestamp = Date.now();
      
      // Step 1: Admin Registration
      const adminData = {
        username: `admin_${timestamp}`,
        email: `admin_${timestamp}@neurogrid.com`,
        password: 'AdminPassword123!',
        role: 'admin'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(adminData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      
      testUsers.admin = {
        ...adminData,
        id: registerResponse.body.user.id
      };

      // Step 2: Admin Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: adminData.username,
          password: adminData.password
        })
        .expect(200);

      testUsers.admin.token = loginResponse.body.token;

      // Step 3: Register a new compute node
      const nodeData = {
        node_id: `e2e-node-${timestamp}`,
        capabilities: ['gpu', 'cpu', 'memory'],
        region: 'us-west-2',
        hardware_info: {
          gpu: 'NVIDIA RTX 4090',
          gpu_memory: '24GB',
          cpu: 'AMD Ryzen 9 7950X',
          cpu_cores: 16,
          memory: '64GB',
          storage: '2TB NVMe SSD',
          network: '10Gbps'
        },
        supported_frameworks: ['pytorch', 'tensorflow', 'huggingface'],
        pricing: {
          gpu_hour: 2.50,
          cpu_hour: 0.10,
          storage_gb: 0.05
        }
      };

      const registerNodeResponse = await request(app)
        .post('/api/nodes/register')
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .send(nodeData)
        .expect(201);

      expect(registerNodeResponse.body.success).toBe(true);
      expect(registerNodeResponse.body.node.node_id).toBe(nodeData.node_id);
      expect(registerNodeResponse.body.node.status).toBe('pending');
      
      testData.node = registerNodeResponse.body.node;

      // Step 4: List all nodes
      const listNodesResponse = await request(app)
        .get('/api/nodes')
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .expect(200);

      expect(listNodesResponse.body.success).toBe(true);
      expect(Array.isArray(listNodesResponse.body.nodes)).toBe(true);

      // Step 5: Approve the node
      const approveNodeResponse = await request(app)
        .post(`/api/nodes/${testData.node.id}/approve`)
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .expect(200);

      expect(approveNodeResponse.body.success).toBe(true);
      expect(approveNodeResponse.body.node.status).toBe('approved');

      // Step 6: Update node status to online
      const updateNodeResponse = await request(app)
        .put(`/api/nodes/${testData.node.id}`)
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .send({
          status: 'online',
          last_seen: new Date().toISOString()
        })
        .expect(200);

      expect(updateNodeResponse.body.success).toBe(true);
      expect(updateNodeResponse.body.node.status).toBe('online');

      // Step 7: Get network statistics
      const statsResponse = await request(app)
        .get('/api/nodes/stats')
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.stats.total_nodes).toBeGreaterThan(0);
      expect(typeof statsResponse.body.stats.active_nodes).toBe('number');
    });
  });

  describe('Payment Processing Workflow', () => {
    test('User → Task Creation → Payment Setup → Payment Processing', async () => {
      // Use existing user
      const userToken = testUsers.regular.token;

      // Step 1: Create a wallet
      const walletResponse = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'E2E Test Wallet',
          currency: 'USD'
        })
        .expect(201);

      expect(walletResponse.body.success).toBe(true);
      testData.wallet = walletResponse.body.wallet;

      // Step 2: Add funds to wallet (simulated)
      const addFundsResponse = await request(app)
        .post(`/api/wallets/${testData.wallet.id}/deposit`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 500,
          payment_method: 'test_card',
          description: 'E2E test deposit'
        })
        .expect(200);

      expect(addFundsResponse.body.success).toBe(true);

      // Step 3: Create paid task
      const paidTaskData = {
        title: 'E2E Paid AI Task',
        description: 'Paid task for E2E testing',
        type: 'ai_inference',
        budget: 100,
        payment_required: true,
        wallet_id: testData.wallet.id
      };

      const createPaidTaskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paidTaskData)
        .expect(201);

      expect(createPaidTaskResponse.body.success).toBe(true);
      testData.paidTask = createPaidTaskResponse.body.task;

      // Step 4: Process payment for task
      const paymentResponse = await request(app)
        .post(`/api/payments/process`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          task_id: testData.paidTask.id,
          wallet_id: testData.wallet.id,
          amount: paidTaskData.budget
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.payment.status).toBe('completed');

      // Step 5: Verify wallet balance
      const walletBalanceResponse = await request(app)
        .get(`/api/wallets/${testData.wallet.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(walletBalanceResponse.body.success).toBe(true);
      expect(walletBalanceResponse.body.wallet.balance).toBe(400); // 500 - 100
    });
  });

  describe('Complete Analytics Workflow', () => {
    test('Admin → View Analytics → Generate Reports → Export Data', async () => {
      const adminToken = testUsers.admin.token;

      // Step 1: Get dashboard analytics
      const dashboardResponse = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(dashboardResponse.body.success).toBe(true);
      expect(dashboardResponse.body.data).toHaveProperty('tasks');
      expect(dashboardResponse.body.data).toHaveProperty('users');
      expect(dashboardResponse.body.data).toHaveProperty('revenue');

      // Step 2: Get task performance analytics
      const taskAnalyticsResponse = await request(app)
        .get('/api/analytics/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString()
        })
        .expect(200);

      expect(taskAnalyticsResponse.body.success).toBe(true);
      expect(Array.isArray(taskAnalyticsResponse.body.data)).toBe(true);

      // Step 3: Get user analytics
      const userAnalyticsResponse = await request(app)
        .get('/api/analytics/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(userAnalyticsResponse.body.success).toBe(true);
      expect(userAnalyticsResponse.body.data).toHaveProperty('total_users');
      expect(userAnalyticsResponse.body.data).toHaveProperty('active_users');

      // Step 4: Generate and download report
      const reportResponse = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'summary',
          format: 'json',
          date_range: '7d'
        })
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.report).toBeDefined();
    });
  });

  describe('Real-time Features Workflow', () => {
    test('WebSocket Connection → Real-time Updates → Notifications', async () => {
      // Note: This would require WebSocket testing setup
      // For now, we'll test the REST endpoints that support real-time features

      const userToken = testUsers.regular.token;

      // Step 1: Subscribe to notifications
      const subscribeResponse = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          types: ['task_update', 'payment_received', 'system_alert'],
          delivery_method: 'websocket'
        })
        .expect(200);

      expect(subscribeResponse.body.success).toBe(true);

      // Step 2: Get notification history
      const notificationsResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(notificationsResponse.body.success).toBe(true);
      expect(Array.isArray(notificationsResponse.body.notifications)).toBe(true);

      // Step 3: Mark notifications as read
      if (notificationsResponse.body.notifications.length > 0) {
        const notificationId = notificationsResponse.body.notifications[0].id;
        
        const markReadResponse = await request(app)
          .put(`/api/notifications/${notificationId}/read`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(markReadResponse.body.success).toBe(true);
      }
    });
  });

  describe('System Health and Monitoring Workflow', () => {
    test('Health Checks → Metrics Collection → Alert Management', async () => {
      // Step 1: Check system health
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // Step 2: Check detailed monitoring health
      const monitoringHealthResponse = await request(app)
        .get('/api/monitoring/health/detailed')
        .expect(200);

      expect(monitoringHealthResponse.body.overall).toBeDefined();
      expect(monitoringHealthResponse.body.components).toBeDefined();

      // Step 3: Get system metrics
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics')
        .expect(200);

      expect(metricsResponse.body.health).toBeDefined();
      expect(metricsResponse.body.system).toBeDefined();

      // Step 4: Get Prometheus metrics
      const prometheusResponse = await request(app)
        .get('/api/monitoring/metrics/prometheus')
        .expect(200);

      expect(prometheusResponse.type).toBe('text/plain');

      // Step 5: Check alert status
      const alertsResponse = await request(app)
        .get('/api/monitoring/alerts/active')
        .expect(200);

      expect(Array.isArray(alertsResponse.body)).toBe(true);
    });
  });

  describe('Data Integrity and Consistency', () => {
    test('Cross-service data consistency verification', async () => {
      const userToken = testUsers.regular.token;
      const adminToken = testUsers.admin.token;

      // Step 1: Verify user data consistency
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userId = profileResponse.body.user.id;

      // Step 2: Verify task ownership
      const userTasksResponse = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      userTasksResponse.body.tasks.forEach(task => {
        expect(task.user_id).toBe(userId);
      });

      // Step 3: Verify wallet ownership
      const userWalletsResponse = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      userWalletsResponse.body.wallets.forEach(wallet => {
        expect(wallet.user_id).toBe(userId);
      });

      // Step 4: Verify payment consistency
      const paymentHistoryResponse = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // All payments should belong to the user
      paymentHistoryResponse.body.payments.forEach(payment => {
        expect(payment.user_id).toBe(userId);
      });
    });
  });

  describe('Performance and Load Testing', () => {
    test('Concurrent requests handling', async () => {
      const userToken = testUsers.regular.token;

      // Create multiple concurrent requests
      const concurrentRequests = Array(20).fill().map((_, index) => 
        request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: `Load Test Task ${index}`,
            description: 'Task created during load testing',
            type: 'ai_training',
            budget: 50
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all tasks were created
      const allTasksResponse = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(allTasksResponse.body.tasks.length).toBeGreaterThanOrEqual(20);
    });
  });
});