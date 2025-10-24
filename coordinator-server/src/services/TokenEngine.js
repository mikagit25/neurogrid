const logger = require('../utils/logger');
const { db } = require('../config/database-universal');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Token Engine Service
 * Manages token economics, rewards, and payments using database
 */
class TokenEngine {
  constructor() {
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
      // Check if balance record already exists
      const existingBalance = await Transaction.getUserBalance(userId);
      if (existingBalance.balance > 0) {
        logger.warn(`Account already exists for user: ${userId}`);
        return existingBalance;
      }

      // Create initial credit transaction
      await Transaction.create({
        user_id: userId,
        transaction_type: 'credit',
        amount: initialBalance,
        description: 'Initial account balance',
        status: 'completed'
      });

      const balance = await Transaction.getUserBalance(userId);
      
      logger.info(`Account created for user ${userId}`, {
        userId,
        initialBalance,
        balance: balance.balance
      });

      return balance;
    } catch (error) {
      logger.error(`Error creating account for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user balance
   */
  async getUserBalance(userId) {
    try {
      return await Transaction.getUserBalance(userId);
    } catch (error) {
      logger.error(`Error getting balance for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process payment for task
   */
  async processTaskPayment(userId, taskId, model, priority = 'standard') {
    try {
      // Calculate task cost
      const baseCost = this.taskCosts[model] || 0.1;
      const priorityMultiplier = this.rewardRates[priority] || 1.0;
      const totalCost = baseCost * priorityMultiplier + this.transactionFee;

      // Check if user has sufficient balance
      const userBalance = await this.getUserBalance(userId);
      if (userBalance.balance < totalCost) {
        throw new Error(`Insufficient balance. Required: ${totalCost}, Available: ${userBalance.balance}`);
      }

      // Create debit transaction for task payment
      const transaction = await Transaction.create({
        user_id: userId,
        job_id: taskId,
        transaction_type: 'debit',
        amount: totalCost,
        description: `Payment for ${model} task (${priority} priority)`,
        metadata: {
          model,
          priority,
          baseCost,
          priorityMultiplier,
          transactionFee: this.transactionFee
        }
      });

      logger.info(`Task payment processed for user ${userId}`, {
        userId,
        taskId,
        model,
        priority,
        amount: totalCost,
        transactionId: transaction.id
      });

      return {
        success: true,
        transactionId: transaction.id,
        amount: totalCost,
        remainingBalance: userBalance.balance - totalCost
      };

    } catch (error) {
      logger.error(`Error processing task payment for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process task completion reward
   */
  async processTaskReward(nodeUserId, taskId, model, priority = 'standard', performanceScore = 1.0) {
    try {
      // Calculate reward
      const baseReward = this.taskCosts[model] || 0.1;
      const priorityMultiplier = this.rewardRates[priority] || 1.0;
      const performanceBonus = Math.max(0, performanceScore - 1) * 0.1; // 10% bonus for good performance
      const totalReward = (baseReward * priorityMultiplier * 0.8) + performanceBonus; // 80% of task cost as reward

      // Create credit transaction for node reward
      const transaction = await Transaction.create({
        user_id: nodeUserId,
        job_id: taskId,
        transaction_type: 'credit',
        amount: totalReward,
        description: `Reward for completing ${model} task`,
        metadata: {
          model,
          priority,
          baseReward,
          priorityMultiplier,
          performanceScore,
          performanceBonus
        }
      });

      logger.info(`Task reward processed for node user ${nodeUserId}`, {
        nodeUserId,
        taskId,
        model,
        priority,
        performanceScore,
        amount: totalReward,
        transactionId: transaction.id
      });

      return {
        success: true,
        transactionId: transaction.id,
        amount: totalReward,
        performanceScore
      };

    } catch (error) {
      logger.error(`Error processing task reward for node user ${nodeUserId}:`, error);
      throw error;
    }
  }

  /**
   * Hold funds in escrow for task
   */
  async holdEscrow(userId, taskId, amount) {
    try {
      await Transaction.processEscrow(taskId, amount, 'hold');
      
      logger.info(`Escrow held for task ${taskId}`, {
        userId,
        taskId,
        amount
      });

      return { success: true, amount };
    } catch (error) {
      logger.error(`Error holding escrow:`, error);
      throw error;
    }
  }

  /**
   * Release escrow funds
   */
  async releaseEscrow(taskId, amount) {
    try {
      await Transaction.processEscrow(taskId, amount, 'release');
      
      logger.info(`Escrow released for task ${taskId}`, {
        taskId,
        amount
      });

      return { success: true, amount };
    } catch (error) {
      logger.error(`Error releasing escrow:`, error);
      throw error;
    }
  }

  /**
   * Refund escrow funds
   */
  async refundEscrow(taskId, amount) {
    try {
      await Transaction.processEscrow(taskId, amount, 'refund');
      
      logger.info(`Escrow refunded for task ${taskId}`, {
        taskId,
        amount
      });

      return { success: true, amount };
    } catch (error) {
      logger.error(`Error refunding escrow:`, error);
      throw error;
    }
  }

  /**
   * Add funds to user account
   */
  async addFunds(userId, amount, paymentMethod = 'manual', externalTxId = null) {
    try {
      const transaction = await Transaction.create({
        user_id: userId,
        transaction_type: 'credit',
        amount: amount,
        description: `Funds added via ${paymentMethod}`,
        payment_method: paymentMethod,
        external_transaction_id: externalTxId
      });

      const balance = await this.getUserBalance(userId);

      logger.info(`Funds added for user ${userId}`, {
        userId,
        amount,
        paymentMethod,
        newBalance: balance.balance,
        transactionId: transaction.id
      });

      return {
        success: true,
        transactionId: transaction.id,
        amount,
        newBalance: balance.balance
      };

    } catch (error) {
      logger.error(`Error adding funds for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Withdraw funds from user account
   */
  async withdrawFunds(userId, amount, withdrawalMethod = 'manual') {
    try {
      // Check balance
      const balance = await this.getUserBalance(userId);
      if (balance.balance < amount) {
        throw new Error(`Insufficient balance for withdrawal. Available: ${balance.balance}, Requested: ${amount}`);
      }

      // Check minimum balance after withdrawal
      if (balance.balance - amount < this.minimumBalance) {
        throw new Error(`Withdrawal would leave balance below minimum of ${this.minimumBalance}`);
      }

      const transaction = await Transaction.create({
        user_id: userId,
        transaction_type: 'debit',
        amount: amount,
        description: `Funds withdrawn via ${withdrawalMethod}`,
        payment_method: withdrawalMethod
      });

      const newBalance = await this.getUserBalance(userId);

      logger.info(`Funds withdrawn for user ${userId}`, {
        userId,
        amount,
        withdrawalMethod,
        newBalance: newBalance.balance,
        transactionId: transaction.id
      });

      return {
        success: true,
        transactionId: transaction.id,
        amount,
        newBalance: newBalance.balance
      };

    } catch (error) {
      logger.error(`Error withdrawing funds for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(userId, options = {}) {
    try {
      return await Transaction.getUserTransactions(userId, options);
    } catch (error) {
      logger.error(`Error getting transaction history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    try {
      const stats = await Transaction.getTransactionStats();
      
      return {
        totalTransactions: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
        totalVolume: stats.reduce((sum, stat) => sum + parseFloat(stat.total_amount || 0), 0),
        averageTransactionSize: stats.reduce((sum, stat) => sum + parseFloat(stat.avg_amount || 0), 0) / stats.length || 0,
        transactionsByType: stats.reduce((acc, stat) => {
          acc[stat.transaction_type] = {
            count: parseInt(stat.count),
            volume: parseFloat(stat.total_amount || 0)
          };
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting platform stats:', error);
      throw error;
    }
  }

  /**
   * Calculate task cost estimate
   */
  calculateTaskCost(model, priority = 'standard', estimatedDuration = null) {
    const baseCost = this.taskCosts[model] || 0.1;
    const priorityMultiplier = this.rewardRates[priority] || 1.0;
    let cost = baseCost * priorityMultiplier + this.transactionFee;

    // Duration-based pricing if provided
    if (estimatedDuration) {
      const durationMultiplier = Math.max(1, estimatedDuration / 60); // Per minute pricing
      cost *= durationMultiplier;
    }

    return {
      baseCost,
      priorityMultiplier,
      transactionFee: this.transactionFee,
      totalCost: cost,
      estimatedReward: cost * 0.8 // Node gets 80% of task cost
    };
  }

  /**
   * Initialize the service
   */
  async initialize() {
    logger.info('TokenEngine initialized with database integration');
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    logger.info('TokenEngine shut down');
  }
}

module.exports = TokenEngine;