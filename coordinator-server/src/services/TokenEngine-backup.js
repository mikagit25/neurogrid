const logger = require('../utils/logger');

/**
 * Token Engine Service
 * Manages token economics, rewards, and payments
 */
class TokenEngine {
  constructor() {
    this.tokenBalances = new Map();
    this.transactions = new Map();
    this.rewardRates = {
      'standard': 1.0,
      'high': 1.5,
      'critical': 2.0
    };
    this.taskCosts = {
      'llama2': 0.1,
      'stable-diffusion': 0.2,
      'whisper': 0.05
    };
    this.minimumBalance = 1.0;
    this.transactionFee = 0.01;
  }

  /**
   * Initialize user account with starting balance
   */
  async createAccount(userId, initialBalance = 10.0) {
    try {
      if (this.tokenBalances.has(userId)) {
        logger.warn(`Account already exists for user: ${userId}`);
        return this.tokenBalances.get(userId);
      }

      const account = {
        userId,
        balance: initialBalance,
        totalEarned: 0,
        totalSpent: 0,
        createdAt: new Date(),
        lastUpdated: new Date(),
        transactionCount: 0
      };

      this.tokenBalances.set(userId, account);

      // Record initial balance transaction
      await this.recordTransaction({
        userId,
        type: 'credit',
        amount: initialBalance,
        description: 'Initial account balance',
        taskId: null,
        nodeId: null
      });

      logger.info(`Created token account for user ${userId}`, {
        userId,
        initialBalance
      });

      return account;
    } catch (error) {
      logger.error(`Error creating account for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate task cost based on model and priority
   */
  calculateTaskCost(model, priority = 'standard', estimatedDuration = 1) {
    const baseCost = this.taskCosts[model] || 0.1;
    const priorityMultiplier = this.rewardRates[priority] || 1.0;
    const durationMultiplier = Math.max(0.5, estimatedDuration / 60); // per minute

    return +(baseCost * priorityMultiplier * durationMultiplier).toFixed(4);
  }

  /**
   * Calculate node reward for completing task
   */
  calculateNodeReward(taskCost, nodeRating, completionTime, priority = 'standard') {
    // Base reward is 80% of task cost (20% goes to platform)
    const baseReward = taskCost * 0.8;

    // Rating bonus (0.5-1.5x multiplier based on rating)
    const ratingMultiplier = 0.5 + (nodeRating * 1.0);

    // Time bonus (faster completion gets bonus, up to 20%)
    const expectedTime = 300; // 5 minutes expected
    const timeBonus = completionTime < expectedTime
      ? Math.min(0.2, (expectedTime - completionTime) / expectedTime * 0.2)
      : 0;

    // Priority multiplier
    const priorityMultiplier = this.rewardRates[priority] || 1.0;

    const totalReward = baseReward * ratingMultiplier * priorityMultiplier * (1 + timeBonus);

    return +Math.max(0.01, totalReward).toFixed(4);
  }

  /**
   * Check if user has sufficient balance for task
   */
  async checkBalance(userId, requiredAmount) {
    const account = this.tokenBalances.get(userId);
    if (!account) {
      return { sufficient: false, balance: 0, required: requiredAmount };
    }

    const sufficient = account.balance >= requiredAmount;
    return {
      sufficient,
      balance: account.balance,
      required: requiredAmount,
      shortfall: sufficient ? 0 : requiredAmount - account.balance
    };
  }

  /**
   * Debit tokens from user account for task submission
   */
  async debitTokens(userId, amount, taskId, description = 'Task submission') {
    try {
      const account = this.tokenBalances.get(userId);
      if (!account) {
        throw new Error(`Account not found for user: ${userId}`);
      }

      if (account.balance < amount) {
        throw new Error(`Insufficient balance. Required: ${amount}, Available: ${account.balance}`);
      }

      // Debit the amount
      account.balance -= amount;
      account.totalSpent += amount;
      account.lastUpdated = new Date();
      account.transactionCount++;

      // Record transaction
      await this.recordTransaction({
        userId,
        type: 'debit',
        amount,
        description,
        taskId,
        nodeId: null
      });

      logger.info(`Debited ${amount} tokens from user ${userId}`, {
        userId,
        amount,
        taskId,
        newBalance: account.balance
      });

      return {
        success: true,
        newBalance: account.balance,
        transactionId: await this.getLastTransactionId(userId)
      };
    } catch (error) {
      logger.error(`Error debiting tokens for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Credit tokens to node account for task completion
   */
  async creditTokens(nodeId, amount, taskId, description = 'Task completion reward') {
    try {
      // Get or create node account
      let account = this.tokenBalances.get(nodeId);
      if (!account) {
        account = await this.createAccount(nodeId, 0);
      }

      // Credit the amount
      account.balance += amount;
      account.totalEarned += amount;
      account.lastUpdated = new Date();
      account.transactionCount++;

      // Record transaction
      await this.recordTransaction({
        userId: nodeId,
        type: 'credit',
        amount,
        description,
        taskId,
        nodeId
      });

      logger.info(`Credited ${amount} tokens to node ${nodeId}`, {
        nodeId,
        amount,
        taskId,
        newBalance: account.balance
      });

      return {
        success: true,
        newBalance: account.balance,
        transactionId: await this.getLastTransactionId(nodeId)
      };
    } catch (error) {
      logger.error(`Error crediting tokens to node ${nodeId}:`, error);
      throw error;
    }
  }

  /**
   * Process payment for completed task
   */
  async processTaskPayment(taskId, userId, nodeId, taskData) {
    try {
      const { model, priority, startTime, endTime } = taskData;
      const completionTime = (endTime - startTime) / 1000; // seconds

      // Calculate cost and reward
      const taskCost = this.calculateTaskCost(model, priority, completionTime / 60);
      const nodeReward = this.calculateNodeReward(
        taskCost,
        taskData.nodeRating || 0.5,
        completionTime,
        priority
      );

      // Platform fee
      const platformFee = taskCost - nodeReward;

      // Credit node
      await this.creditTokens(
        nodeId,
        nodeReward,
        taskId,
        `Reward for completing task (${model})`
      );

      // Record platform earnings
      await this.recordTransaction({
        userId: 'platform',
        type: 'credit',
        amount: platformFee,
        description: `Platform fee for task ${taskId}`,
        taskId,
        nodeId
      });

      logger.info(`Processed payment for task ${taskId}`, {
        taskId,
        userId,
        nodeId,
        taskCost,
        nodeReward,
        platformFee,
        completionTime
      });

      return {
        success: true,
        taskCost,
        nodeReward,
        platformFee,
        completionTime
      };
    } catch (error) {
      logger.error(`Error processing payment for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Handle failed task refund
   */
  async processTaskRefund(taskId, userId, reason = 'Task failed') {
    try {
      // Find the original debit transaction
      const transactions = Array.from(this.transactions.values());
      const originalTransaction = transactions.find(t =>
        t.taskId === taskId &&
        t.userId === userId &&
        t.type === 'debit'
      );

      if (!originalTransaction) {
        throw new Error(`Original transaction not found for task ${taskId}`);
      }

      // Refund the amount
      await this.creditTokens(
        userId,
        originalTransaction.amount,
        taskId,
        `Refund: ${reason}`
      );

      logger.info(`Processed refund for task ${taskId}`, {
        taskId,
        userId,
        amount: originalTransaction.amount,
        reason
      });

      return {
        success: true,
        refundAmount: originalTransaction.amount
      };
    } catch (error) {
      logger.error(`Error processing refund for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get account balance and info
   */
  getAccount(userId) {
    const account = this.tokenBalances.get(userId);
    if (!account) {
      return null;
    }

    return {
      ...account,
      netBalance: account.totalEarned - account.totalSpent
    };
  }

  /**
   * Get transaction history for user
   */
  getTransactionHistory(userId, limit = 50) {
    const transactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return transactions;
  }

  /**
   * Record a transaction
   */
  async recordTransaction(transactionData) {
    try {
      const transaction = {
        id: this.generateTransactionId(),
        ...transactionData,
        timestamp: new Date(),
        status: 'completed'
      };

      this.transactions.set(transaction.id, transaction);

      return transaction;
    } catch (error) {
      logger.error('Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Get platform statistics
   */
  getPlatformStats() {
    const allAccounts = Array.from(this.tokenBalances.values());
    const allTransactions = Array.from(this.transactions.values());

    const totalSupply = allAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalEarned = allAccounts.reduce((sum, acc) => sum + acc.totalEarned, 0);
    const totalSpent = allAccounts.reduce((sum, acc) => sum + acc.totalSpent, 0);

    const platformAccount = this.tokenBalances.get('platform');
    const platformBalance = platformAccount ? platformAccount.balance : 0;

    const recentTransactions = allTransactions
      .filter(t => Date.now() - t.timestamp.getTime() < 24 * 60 * 60 * 1000)
      .length;

    return {
      totalSupply: +totalSupply.toFixed(4),
      totalEarned: +totalEarned.toFixed(4),
      totalSpent: +totalSpent.toFixed(4),
      platformBalance: +platformBalance.toFixed(4),
      totalAccounts: allAccounts.length,
      totalTransactions: allTransactions.length,
      recentTransactions,
      averageBalance: allAccounts.length > 0 ? +(totalSupply / allAccounts.length).toFixed(4) : 0
    };
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get last transaction ID for user
   */
  async getLastTransactionId(userId) {
    const transactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return transactions.length > 0 ? transactions[0].id : null;
  }

  /**
   * Add tokens to account (admin function)
   */
  async addTokens(userId, amount, description = 'Admin credit') {
    try {
      let account = this.tokenBalances.get(userId);
      if (!account) {
        account = await this.createAccount(userId, 0);
      }

      await this.creditTokens(userId, amount, null, description);

      logger.info(`Admin added ${amount} tokens to user ${userId}`, {
        userId,
        amount,
        description
      });

      return this.getAccount(userId);
    } catch (error) {
      logger.error(`Error adding tokens to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Set token prices (admin function)
   */
  updatePricing(model, price) {
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Price must be a positive number');
    }

    this.taskCosts[model] = price;

    logger.info(`Updated pricing for ${model}`, {
      model,
      newPrice: price
    });

    return this.taskCosts;
  }

  /**
   * Initialize the token engine
   */
  async initialize() {
    logger.info('Token engine initialized');

    // Create platform account
    await this.createAccount('platform', 0);

    return true;
  }
}

module.exports = TokenEngine;
