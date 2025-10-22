const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../../middleware/security');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');

// Service instances (injected from main app)
let paymentGateway = null;
let tokenEngine = null;

// Rate limiting for payment operations
const paymentLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 payment operations per minute per IP
  message: { error: 'Too many payment requests, please try again later' }
});

// Withdrawal rate limiting (more restrictive)
const withdrawalLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 withdrawals per hour per IP
  message: { error: 'Too many withdrawal requests, please try again later' }
});

// Initialize services
const initializeServices = (services) => {
  paymentGateway = services.paymentGateway;
  tokenEngine = services.tokenEngine;
};

/**
 * @route GET /api/payments/methods
 * @desc Get available payment methods for amount and currency
 * @access Public
 */
router.get('/methods', [
  query('currency').isIn(['USD', 'EUR', 'RUB', 'GBP', 'BTC', 'ETH', 'USDT']).withMessage('Invalid currency'),
  query('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  query('type').optional().isIn(['deposit', 'withdrawal']).withMessage('Invalid type')
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

    const { currency, amount, type = 'deposit' } = req.query;

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const methods = paymentGateway.getSupportedMethods(currency, parseFloat(amount));

    res.json({
      success: true,
      methods,
      currency,
      amount: parseFloat(amount),
      type
    });
  } catch (error) {
    logger.error('Error getting payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment methods'
    });
  }
});

/**
 * @route GET /api/payments/rates
 * @desc Get current exchange rates
 * @access Public
 */
router.get('/rates', async (req, res) => {
  try {
    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const rates = {};
    const currencies = ['USD', 'EUR', 'RUB', 'GBP', 'BTC', 'ETH'];
    
    for (const currency of currencies) {
      rates[`${currency}/NGRID`] = paymentGateway.exchangeRates.get(`${currency}/NGRID`) || 0;
      rates[`NGRID/${currency}`] = paymentGateway.exchangeRates.get(`NGRID/${currency}`) || 0;
    }

    res.json({
      success: true,
      rates,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting exchange rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get exchange rates'
    });
  }
});

/**
 * @route POST /api/payments/deposit
 * @desc Create deposit payment intent
 * @access Private
 */
router.post('/deposit', authenticate, paymentLimit, [
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least 1'),
  body('currency').isIn(['USD', 'EUR', 'RUB', 'GBP', 'BTC', 'ETH', 'USDT']).withMessage('Invalid currency'),
  body('paymentMethod').isIn(['stripe', 'paypal', 'crypto', 'bank']).withMessage('Invalid payment method'),
  body('returnUrl').optional().isURL().withMessage('Invalid return URL'),
  body('metadata').optional().isObject().withMessage('Metadata must be object')
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

    const { amount, currency, paymentMethod, returnUrl, metadata = {} } = req.body;
    const userId = req.user.id;

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    // Add user info to metadata
    metadata.userId = userId;
    metadata.userEmail = req.user.email;
    metadata.returnUrl = returnUrl;

    const paymentIntent = await paymentGateway.createDepositIntent(
      userId,
      amount,
      currency,
      paymentMethod,
      metadata
    );

    res.status(201).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        tokenAmount: paymentIntent.tokenAmount,
        paymentMethod: paymentIntent.paymentMethod,
        fees: paymentIntent.fees,
        netAmount: paymentIntent.netAmount,
        expiresAt: paymentIntent.expiresAt,
        providerData: paymentIntent.providerData
      }
    });
  } catch (error) {
    logger.error('Error creating deposit intent:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create deposit'
    });
  }
});

/**
 * @route POST /api/payments/withdraw
 * @desc Create withdrawal request
 * @access Private
 */
router.post('/withdraw', authenticate, withdrawalLimit, [
  body('tokenAmount').isFloat({ min: 1 }).withMessage('Token amount must be at least 1'),
  body('currency').isIn(['USD', 'EUR', 'RUB', 'GBP']).withMessage('Invalid withdrawal currency'),
  body('withdrawalMethod').isIn(['paypal', 'bank']).withMessage('Invalid withdrawal method'),
  body('destination').notEmpty().withMessage('Destination is required'),
  body('destination.email').if(body('withdrawalMethod').equals('paypal')).isEmail().withMessage('Valid email required for PayPal'),
  body('destination.bankAccount').if(body('withdrawalMethod').equals('bank')).notEmpty().withMessage('Bank account required for bank transfer'),
  body('metadata').optional().isObject().withMessage('Metadata must be object')
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

    const { tokenAmount, currency, withdrawalMethod, destination, metadata = {} } = req.body;
    const userId = req.user.id;

    if (!paymentGateway || !tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    // Check user balance
    const account = tokenEngine.getAccount(userId);
    if (!account || account.balance < tokenAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        balance: account?.balance || 0,
        required: tokenAmount
      });
    }

    // Reserve tokens for withdrawal
    await tokenEngine.debitTokens(
      userId,
      tokenAmount,
      null,
      'Withdrawal reservation'
    );

    try {
      const withdrawalRequest = await paymentGateway.createWithdrawalRequest(
        userId,
        tokenAmount,
        currency,
        withdrawalMethod,
        destination,
        metadata
      );

      res.status(201).json({
        success: true,
        withdrawalRequest: {
          id: withdrawalRequest.id,
          tokenAmount: withdrawalRequest.tokenAmount,
          fiatAmount: withdrawalRequest.fiatAmount,
          currency: withdrawalRequest.currency,
          withdrawalMethod: withdrawalRequest.withdrawalMethod,
          fees: withdrawalRequest.fees,
          netAmount: withdrawalRequest.netAmount,
          status: withdrawalRequest.status,
          createdAt: withdrawalRequest.createdAt
        }
      });
    } catch (error) {
      // Refund tokens if withdrawal creation failed
      await tokenEngine.creditTokens(
        userId,
        tokenAmount,
        null,
        'Withdrawal creation failed - refund'
      );
      throw error;
    }
  } catch (error) {
    logger.error('Error creating withdrawal request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create withdrawal'
    });
  }
});

/**
 * @route GET /api/payments/history
 * @desc Get user payment history
 * @access Private
 */
router.get('/history', authenticate, [
  query('type').optional().isIn(['deposit', 'withdrawal']).withMessage('Invalid type'),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
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

    const userId = req.user.id;
    const filters = {
      type: req.query.type,
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50
    };

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const history = paymentGateway.getTransactionHistory(userId, filters);

    // Remove sensitive data
    const sanitizedHistory = history.map(tx => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      tokenAmount: tx.tokenAmount,
      paymentMethod: tx.paymentMethod || tx.withdrawalMethod,
      fees: tx.fees,
      netAmount: tx.netAmount,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt
    }));

    res.json({
      success: true,
      history: sanitizedHistory,
      count: sanitizedHistory.length,
      filters
    });
  } catch (error) {
    logger.error('Error getting payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment history'
    });
  }
});

/**
 * @route GET /api/payments/transaction/:id
 * @desc Get specific transaction details
 * @access Private
 */
router.get('/transaction/:id', authenticate, [
  param('id').matches(/^tx_[0-9]+_[a-f0-9]+$/).withMessage('Invalid transaction ID')
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

    const { id } = req.params;
    const userId = req.user.id;

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const transaction = paymentGateway.pendingTransactions.get(id) || 
                       paymentGateway.completedTransactions.get(id);

    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Remove sensitive data
    const sanitizedTransaction = {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      tokenAmount: transaction.tokenAmount,
      paymentMethod: transaction.paymentMethod || transaction.withdrawalMethod,
      fees: transaction.fees,
      netAmount: transaction.netAmount,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
      expiresAt: transaction.expiresAt,
      providerData: transaction.status === 'pending' ? transaction.providerData : undefined
    };

    res.json({
      success: true,
      transaction: sanitizedTransaction
    });
  } catch (error) {
    logger.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction'
    });
  }
});

/**
 * @route POST /api/payments/webhook/:provider
 * @desc Handle payment provider webhooks
 * @access Public (verified by signature)
 */
router.post('/webhook/:provider', [
  param('provider').isIn(['stripe', 'paypal', 'crypto']).withMessage('Invalid provider')
], async (req, res) => {
  try {
    const { provider } = req.params;
    const signature = req.get('stripe-signature') || 
                     req.get('paypal-auth-signature') ||
                     req.get('x-signature');

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const processed = await paymentGateway.processWebhook(provider, req.body, signature);

    if (processed) {
      res.json({ success: true, processed: true });
    } else {
      res.status(400).json({ success: false, error: 'Failed to process webhook' });
    }
  } catch (error) {
    logger.error(`Error processing ${req.params.provider} webhook:`, error);
    res.status(400).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

/**
 * @route POST /api/payments/admin/approve-withdrawal/:id
 * @desc Approve withdrawal request (admin only)
 * @access Admin
 */
router.post('/admin/approve-withdrawal/:id', authenticate, [
  param('id').matches(/^tx_[0-9]+_[a-f0-9]+$/).withMessage('Invalid transaction ID')
], async (req, res) => {
  try {
    // Check admin permissions
    if (!req.user.permissions?.includes('admin') && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const transaction = await paymentGateway.approveWithdrawal(id);

    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        approvedAt: transaction.approvedAt,
        netAmount: transaction.netAmount
      }
    });
  } catch (error) {
    logger.error('Error approving withdrawal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve withdrawal'
    });
  }
});

/**
 * @route GET /api/payments/admin/stats
 * @desc Get payment statistics (admin only)
 * @access Admin
 */
router.get('/admin/stats', authenticate, async (req, res) => {
  try {
    // Check admin permissions
    if (!req.user.permissions?.includes('admin') && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    if (!paymentGateway) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const stats = paymentGateway.getPaymentStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting payment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment statistics'
    });
  }
});

module.exports = { router, initializeServices };