const express = require('express');
const router = express.Router();
const TokenEngine = require('../services/TokenEngine');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// Initialize TokenEngine
const tokenEngine = new TokenEngine();

/**
 * @swagger
 * components:
 *   schemas:
 *     Balance:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         balance:
 *           type: number
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         amount:
 *           type: number
 *         type:
 *           type: string
 *           enum: [credit, debit, escrow]
 *         description:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *     CostEstimate:
 *       type: object
 *       properties:
 *         model:
 *           type: string
 *         priority:
 *           type: string
 *         baseCost:
 *           type: number
 *         totalCost:
 *           type: number
 *         estimatedReward:
 *           type: number
 */

/**
 * @swagger
 * /api/tokens/balance:
 *   get:
 *     summary: Get user token balance
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User balance information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Balance'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await tokenEngine.getUserBalance(userId);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error('Error getting user balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tokens/transactions:
 *   get:
 *     summary: Get user transaction history
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of transactions per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [credit, debit, escrow]
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   type: object
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    if (type) {
      options.type = type;
    }
    
    const transactions = await tokenEngine.getTransactionHistory(userId, options);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: transactions.length
      }
    });
  } catch (error) {
    logger.error('Error getting transaction history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction history',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tokens/cost-estimate:
 *   post:
 *     summary: Get cost estimate for a task
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *             properties:
 *               model:
 *                 type: string
 *                 description: AI model name
 *               priority:
 *                 type: string
 *                 enum: [standard, high, critical]
 *                 default: standard
 *               estimatedDuration:
 *                 type: number
 *                 description: Estimated duration in minutes
 *     responses:
 *       200:
 *         description: Cost estimate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CostEstimate'
 */
router.post('/cost-estimate', authenticateToken, async (req, res) => {
  try {
    const { model, priority = 'standard', estimatedDuration } = req.body;
    
    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model is required'
      });
    }
    
    const estimate = tokenEngine.calculateTaskCost(model, priority, estimatedDuration);
    
    res.json({
      success: true,
      data: {
        model,
        priority,
        ...estimate
      }
    });
  } catch (error) {
    logger.error('Error calculating cost estimate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate cost estimate',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tokens/add-funds:
 *   post:
 *     summary: Add funds to user account
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Amount to add
 *               paymentMethod:
 *                 type: string
 *                 enum: [credit_card, bank_transfer, crypto, manual]
 *                 default: manual
 *               externalTxId:
 *                 type: string
 *                 description: External transaction ID
 *     responses:
 *       200:
 *         description: Funds added successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/add-funds', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, paymentMethod = 'manual', externalTxId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive'
      });
    }
    
    const result = await tokenEngine.addFunds(userId, amount, paymentMethod, externalTxId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error adding funds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add funds',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tokens/withdraw:
 *   post:
 *     summary: Withdraw funds from user account
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Amount to withdraw
 *               withdrawalMethod:
 *                 type: string
 *                 enum: [bank_transfer, crypto, manual]
 *                 default: manual
 *     responses:
 *       200:
 *         description: Funds withdrawn successfully
 *       400:
 *         description: Invalid request or insufficient funds
 *       500:
 *         description: Server error
 */
router.post('/withdraw', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, withdrawalMethod = 'manual' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive'
      });
    }
    
    const result = await tokenEngine.withdrawFunds(userId, amount, withdrawalMethod);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error withdrawing funds:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to withdraw funds',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tokens/stats:
 *   get:
 *     summary: Get platform token statistics
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTransactions:
 *                       type: number
 *                     totalVolume:
 *                       type: number
 *                     averageTransactionSize:
 *                       type: number
 *                     transactionsByType:
 *                       type: object
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await tokenEngine.getPlatformStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform stats',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/tokens/process-payment:
 *   post:
 *     summary: Process payment for a task (internal)
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - model
 *             properties:
 *               taskId:
 *                 type: string
 *               model:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [standard, high, critical]
 *                 default: standard
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       400:
 *         description: Insufficient funds or invalid request
 *       500:
 *         description: Server error
 */
router.post('/process-payment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, model, priority = 'standard' } = req.body;
    
    if (!taskId || !model) {
      return res.status(400).json({
        success: false,
        error: 'TaskId and model are required'
      });
    }
    
    const result = await tokenEngine.processTaskPayment(userId, taskId, model, priority);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error processing payment:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to process payment',
      message: error.message
    });
  }
});

module.exports = router;