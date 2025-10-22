const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const logger = require('../../utils/logger');

// Mock service instances (would be injected in real app)
let tokenEngine = null;

// Initialize services
const initializeServices = (services) => {
  tokenEngine = services.tokenEngine;
};

/**
 * @route   GET /api/tokens/balance/:userId
 * @desc    Get token balance for user
 * @access  Public (would be protected in production)
 */
router.get('/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const account = tokenEngine.getAccount(userId);
    
    if (!account) {
      return res.json({
        success: true,
        balance: 0,
        exists: false
      });
    }

    res.json({
      success: true,
      balance: account.balance,
      totalEarned: account.totalEarned,
      totalSpent: account.totalSpent,
      transactionCount: account.transactionCount,
      createdAt: account.createdAt,
      exists: true
    });
  } catch (error) {
    logger.error('Error getting token balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance'
    });
  }
});

/**
 * @route   POST /api/tokens/account
 * @desc    Create new token account
 * @access  Public (would be protected in production)
 */
router.post('/account', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('initialBalance').optional().isFloat({ min: 0 }).withMessage('Initial balance must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId, initialBalance = 10.0 } = req.body;

    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const account = await tokenEngine.createAccount(userId, initialBalance);

    res.status(201).json({
      success: true,
      account: {
        userId: account.userId,
        balance: account.balance,
        createdAt: account.createdAt
      }
    });
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({
      success: false,
      error: error.message.includes('already exists') ? error.message : 'Failed to create account'
    });
  }
});

/**
 * @route   GET /api/tokens/transactions/:userId
 * @desc    Get transaction history for user
 * @access  Public (would be protected in production)
 */
router.get('/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const transactions = tokenEngine.getTransactionHistory(userId, limit);

    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    logger.error('Error getting transaction history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction history'
    });
  }
});

/**
 * @route   POST /api/tokens/estimate
 * @desc    Estimate cost for task
 * @access  Public
 */
router.post('/estimate', [
  body('model').notEmpty().withMessage('Model is required'),
  body('priority').optional().isIn(['standard', 'high', 'critical']).withMessage('Invalid priority'),
  body('estimatedDuration').optional().isFloat({ min: 0 }).withMessage('Duration must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { model, priority = 'standard', estimatedDuration = 1 } = req.body;

    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const estimatedCost = tokenEngine.calculateTaskCost(model, priority, estimatedDuration);

    res.json({
      success: true,
      estimate: {
        model,
        priority,
        estimatedDuration,
        cost: estimatedCost
      }
    });
  } catch (error) {
    logger.error('Error estimating cost:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate cost'
    });
  }
});

/**
 * @route   GET /api/tokens/stats
 * @desc    Get platform token statistics
 * @access  Public (would be admin-only in production)
 */
router.get('/stats', async (req, res) => {
  try {
    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const stats = tokenEngine.getPlatformStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

/**
 * @route   POST /api/tokens/admin/add
 * @desc    Add tokens to account (admin only)
 * @access  Admin
 */
router.post('/admin/add', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('description').optional().isString().withMessage('Description must be string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId, amount, description = 'Admin credit' } = req.body;

    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const account = await tokenEngine.addTokens(userId, amount, description);

    res.json({
      success: true,
      account: {
        userId: account.userId,
        balance: account.balance,
        totalEarned: account.totalEarned
      },
      added: amount
    });
  } catch (error) {
    logger.error('Error adding tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add tokens'
    });
  }
});

/**
 * @route   PUT /api/tokens/admin/pricing
 * @desc    Update model pricing (admin only)
 * @access  Admin
 */
router.put('/admin/pricing', [
  body('model').notEmpty().withMessage('Model is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { model, price } = req.body;

    if (!tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Token service not available'
      });
    }

    const updatedPricing = tokenEngine.updatePricing(model, price);

    res.json({
      success: true,
      model,
      newPrice: price,
      allPricing: updatedPricing
    });
  } catch (error) {
    logger.error('Error updating pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pricing'
    });
  }
});

module.exports = { router, initializeServices };