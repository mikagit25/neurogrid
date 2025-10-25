const { models } = require('../../src/models');
const { db } = require('../../src/config/database');
const testUtils = require('../utils/testUtils');

describe('Database Models', () => {
  describe('User Model', () => {
    test('should create user', async () => {
      const userData = {
        username: testUtils.randomUsername(),
        email: testUtils.randomEmail(),
        password_hash: 'hashedpassword',
        role: 'user'
      };

      const user = await models.User.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.is_active).toBe(true);
    });

    test('should find user by email', async () => {
      const testUser = await testUtils.createTestUser({
        email: 'findme@example.com'
      });

      const foundUser = await models.User.findByEmail('findme@example.com');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(testUser.id);
      expect(foundUser.email).toBe('findme@example.com');
    });

    test('should find user by username', async () => {
      const testUser = await testUtils.createTestUser({
        username: 'findmeuser'
      });

      const foundUser = await models.User.findByUsername('findmeuser');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(testUser.id);
      expect(foundUser.username).toBe('findmeuser');
    });

    test('should update user', async () => {
      const testUser = await testUtils.createTestUser();

      const updatedUser = await models.User.update(testUser.id, {
        email: 'updated@example.com'
      });

      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.updated_at).not.toBe(testUser.updated_at);
    });

    test('should get active users', async () => {
      await testUtils.createTestUser({ username: 'active1', email: 'active1@example.com', is_active: true });
      await testUtils.createTestUser({ username: 'active2', email: 'active2@example.com', is_active: true });
      await testUtils.createTestUser({ username: 'inactive1', email: 'inactive1@example.com', is_active: false });

      const activeUsers = await models.User.getActiveUsers();

      expect(activeUsers.length).toBe(2);
      expect(activeUsers.every(user => user.is_active)).toBe(true);
    });
  });

  describe('Node Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser();
    });

    test('should create node', async () => {
      const nodeData = {
        user_id: testUser.id,
        name: 'Test Node',
        description: 'Test node description',
        status: 'online',
        node_type: 'compute'
      };

      const node = await models.Node.create(nodeData);

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.user_id).toBe(testUser.id);
      expect(node.name).toBe(nodeData.name);
      expect(node.status).toBe(nodeData.status);
    });

    test('should find nodes by user ID', async () => {
      await testUtils.createTestNode(testUser.id, { name: 'Node 1' });
      await testUtils.createTestNode(testUser.id, { name: 'Node 2' });

      const userNodes = await models.Node.findByUserId(testUser.id);

      expect(userNodes.length).toBe(2);
      expect(userNodes.every(node => node.user_id === testUser.id)).toBe(true);
    });

    test('should find available nodes', async () => {
      await testUtils.createTestNode(testUser.id, { status: 'online', is_verified: true });
      await testUtils.createTestNode(testUser.id, { status: 'offline', is_verified: true });
      await testUtils.createTestNode(testUser.id, { status: 'online', is_verified: false });

      const availableNodes = await models.Node.findAvailableNodes();

      expect(availableNodes.length).toBe(1);
      expect(availableNodes[0].status).toBe('online');
      expect(availableNodes[0].is_verified).toBe(true);
    });

    test('should update node status', async () => {
      const node = await testUtils.createTestNode(testUser.id, { status: 'offline' });

      const updatedNode = await models.Node.updateStatus(node.id, 'online');

      expect(updatedNode.status).toBe('online');
      expect(updatedNode.last_seen).toBeDefined();
    });
  });

  describe('Job Model', () => {
    let testUser, testNode;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser();
      testNode = await testUtils.createTestNode(testUser.id);
    });

    test('should create job', async () => {
      const jobData = {
        user_id: testUser.id,
        title: 'Test Job',
        description: 'Test job description',
        job_type: 'ml_training',
        status: 'pending',
        priority: 5
      };

      const job = await models.Job.create(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.user_id).toBe(testUser.id);
      expect(job.title).toBe(jobData.title);
      expect(job.status).toBe(jobData.status);
    });

    test('should find pending jobs', async () => {
      await testUtils.createTestJob(testUser.id, { status: 'pending', priority: 8 });
      await testUtils.createTestJob(testUser.id, { status: 'pending', priority: 3 });
      await testUtils.createTestJob(testUser.id, { status: 'completed' });

      const pendingJobs = await models.Job.findPendingJobs();

      expect(pendingJobs.length).toBe(2);
      expect(pendingJobs.every(job => job.status === 'pending')).toBe(true);
      // Should be ordered by priority DESC
      expect(pendingJobs[0].priority).toBeGreaterThan(pendingJobs[1].priority);
    });

    test('should assign job to node', async () => {
      const job = await testUtils.createTestJob(testUser.id, { status: 'pending' });

      const assignedJob = await models.Job.assignToNode(job.id, testNode.id);

      expect(assignedJob.node_id).toBe(testNode.id);
      expect(assignedJob.status).toBe('assigned');
      expect(assignedJob.started_at).toBeDefined();
    });

    test('should update job progress', async () => {
      const job = await testUtils.createTestJob(testUser.id);

      const updatedJob = await models.Job.updateProgress(job.id, 50, 'Processing...');

      expect(updatedJob.progress).toBe(50);
      expect(updatedJob.logs).toBe('Processing...');
    });

    test('should complete job', async () => {
      const job = await testUtils.createTestJob(testUser.id);
      const outputData = { result: 'success', accuracy: 0.95 };

      const completedJob = await models.Job.completeJob(job.id, outputData, 10.50);

      expect(completedJob.status).toBe('completed');
      expect(completedJob.progress).toBe(100);
      expect(completedJob.output_data).toEqual(outputData);
      expect(completedJob.actual_cost).toBe(10.50);
      expect(completedJob.completed_at).toBeDefined();
    });
  });

  describe('Transaction Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser();
    });

    test('should create transaction and update balance', async () => {
      const transactionData = {
        user_id: testUser.id,
        transaction_type: 'credit',
        amount: 100.00,
        description: 'Test credit'
      };

      const transaction = await models.Transaction.createTransaction(transactionData);

      expect(transaction).toBeDefined();
      expect(transaction.user_id).toBe(testUser.id);
      expect(transaction.amount).toBe(100.00);

      const balance = await models.Transaction.getUserBalance(testUser.id);
      expect(balance.balance).toBe(100.00);
    });

    test('should handle debit transaction', async () => {
      // First add some credit
      await models.Transaction.createTransaction({
        user_id: testUser.id,
        transaction_type: 'credit',
        amount: 100.00
      });

      // Then debit
      await models.Transaction.createTransaction({
        user_id: testUser.id,
        transaction_type: 'debit',
        amount: 30.00
      });

      const balance = await models.Transaction.getUserBalance(testUser.id);
      expect(balance.balance).toBe(70.00);
    });

    test('should handle escrow operations', async () => {
      // Setup initial balance
      await models.Transaction.createTransaction({
        user_id: testUser.id,
        transaction_type: 'credit',
        amount: 100.00
      });

      const job = await testUtils.createTestJob(testUser.id);

      // Hold funds in escrow
      await models.Transaction.processEscrow(job.id, 50.00, 'hold');

      let balance = await models.Transaction.getUserBalance(testUser.id);
      expect(balance.balance).toBe(50.00);
      expect(balance.escrow_balance).toBe(50.00);

      // Release escrow
      await models.Transaction.processEscrow(job.id, 50.00, 'release');

      balance = await models.Transaction.getUserBalance(testUser.id);
      expect(balance.balance).toBe(50.00);
      expect(balance.escrow_balance).toBe(0.00);
    });
  });
});
