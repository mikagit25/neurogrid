const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../../middleware/security');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');

// Service instances (injected from main app)
let walletModel = null;
let tokenEngine = null;

// Rate limiting for wallet operations
const walletLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 wallet operations per minute per IP
  message: { error: 'Too many wallet requests, please try again later' }
});

// Initialize services
const initializeServices = (services) => {
  walletModel = services.walletModel;
  tokenEngine = services.tokenEngine;
};

/**
 * @route GET /api/wallets
 * @desc Get user's wallets
 * @access Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const wallets = walletModel.getUserWallets(userId);

    // Sanitize sensitive data
    const sanitizedWallets = {
      internal: wallets.internal ? {
        id: wallets.internal.id,
        type: wallets.internal.type,
        status: wallets.internal.status,
        balances: wallets.internal.balances,
        settings: wallets.internal.settings,
        createdAt: wallets.internal.createdAt
      } : null,
      external: wallets.external.map(wallet => ({
        id: wallet.id,
        type: wallet.type,
        currency: wallet.currency,
        label: wallet.label,
        isDefault: wallet.isDefault,
        isVerified: wallet.isVerified,
        status: wallet.status,
        addedAt: wallet.addedAt,
        lastUsed: wallet.lastUsed,
        address: wallet.type === 'crypto' ? this.maskAddress(wallet.address) : wallet.address
      })),
      total: wallets.total
    };

    res.json({
      success: true,
      wallets: sanitizedWallets
    });
  } catch (error) {
    logger.error('Error getting user wallets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallets'
    });
  }
});

/**
 * @route POST /api/wallets
 * @desc Create internal wallet for user
 * @access Private
 */
router.post('/', authenticate, walletLimit, [
  body('settings').optional().isObject().withMessage('Settings must be object'),
  body('settings.defaultCurrency').optional().isIn(['USD', 'EUR', 'RUB', 'GBP']).withMessage('Invalid default currency'),
  body('security').optional().isObject().withMessage('Security settings must be object')
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
    const { settings, security } = req.body;

    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const wallet = await walletModel.createWallet(userId, { settings, security });

    const sanitizedWallet = {
      id: wallet.id,
      type: wallet.type,
      status: wallet.status,
      balances: wallet.balances,
      settings: wallet.settings,
      createdAt: wallet.createdAt
    };

    res.status(201).json({
      success: true,
      wallet: sanitizedWallet
    });
  } catch (error) {
    logger.error('Error creating wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create wallet'
    });
  }
});

/**
 * @route POST /api/wallets/external
 * @desc Add external wallet (crypto, PayPal, bank)
 * @access Private
 */
router.post('/external', authenticate, walletLimit, [
  body('type').isIn(['crypto', 'paypal', 'bank']).withMessage('Invalid wallet type'),
  body('currency').notEmpty().withMessage('Currency is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('label').optional().isString().withMessage('Label must be string'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be boolean')
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
    const { type, currency, address, label, isDefault } = req.body;

    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const wallet = await walletModel.addExternalWallet(userId, {
      type,
      currency,
      address,
      label,
      isDefault
    });

    const sanitizedWallet = {
      id: wallet.id,
      type: wallet.type,
      currency: wallet.currency,
      label: wallet.label,
      isDefault: wallet.isDefault,
      isVerified: wallet.isVerified,
      status: wallet.status,
      verificationCode: wallet.verificationCode,
      addedAt: wallet.addedAt
    };

    res.status(201).json({
      success: true,
      wallet: sanitizedWallet,
      message: 'External wallet added. Please verify using the provided code.'
    });
  } catch (error) {
    logger.error('Error adding external wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add external wallet'
    });
  }
});

/**
 * @route POST /api/wallets/external/:id/verify
 * @desc Verify external wallet
 * @access Private
 */
router.post('/external/:id/verify', authenticate, [
  param('id').matches(/^wallet_[0-9]+_[a-z0-9]+$/).withMessage('Invalid wallet ID'),
  body('verificationCode').isLength({ min: 6, max: 10 }).withMessage('Invalid verification code')
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
    const { id } = req.params;
    const { verificationCode } = req.body;

    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const wallet = await walletModel.verifyExternalWallet(userId, id, verificationCode);

    const sanitizedWallet = {
      id: wallet.id,
      type: wallet.type,
      currency: wallet.currency,
      label: wallet.label,
      isVerified: wallet.isVerified,
      status: wallet.status,
      verifiedAt: wallet.verifiedAt
    };

    res.json({
      success: true,
      wallet: sanitizedWallet,
      message: 'Wallet verified successfully'
    });
  } catch (error) {
    logger.error('Error verifying external wallet:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to verify wallet'
    });
  }
});

/**
 * @route PUT /api/wallets/external/:id/default
 * @desc Set external wallet as default
 * @access Private
 */
router.put('/external/:id/default', authenticate, [
  param('id').matches(/^wallet_[0-9]+_[a-z0-9]+$/).withMessage('Invalid wallet ID')
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
    const { id } = req.params;

    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const wallet = await walletModel.setDefaultWallet(userId, id);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const sanitizedWallet = {
      id: wallet.id,
      type: wallet.type,
      currency: wallet.currency,
      label: wallet.label,
      isDefault: wallet.isDefault
    };

    res.json({
      success: true,
      wallet: sanitizedWallet,
      message: 'Default wallet updated'
    });
  } catch (error) {
    logger.error('Error setting default wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set default wallet'
    });
  }
});

/**
 * @route DELETE /api/wallets/external/:id
 * @desc Remove external wallet
 * @access Private
 */
router.delete('/external/:id', authenticate, [
  param('id').matches(/^wallet_[0-9]+_[a-z0-9]+$/).withMessage('Invalid wallet ID')
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
    const { id } = req.params;

    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const removed = await walletModel.removeExternalWallet(userId, id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    res.json({
      success: true,
      message: 'External wallet removed'
    });
  } catch (error) {
    logger.error('Error removing external wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove wallet'
    });
  }
});

/**
 * @route GET /api/wallets/currencies
 * @desc Get supported currencies for withdrawal
 * @access Public
 */
router.get('/currencies', async (req, res) => {
  try {
    if (!walletModel) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const currencies = walletModel.getSupportedWithdrawalCurrencies();

    res.json({
      success: true,
      currencies
    });
  } catch (error) {
    logger.error('Error getting supported currencies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported currencies'
    });
  }
});

/**
 * @route GET /api/wallets/stats
 * @desc Get user's wallet statistics
 * @access Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!walletModel || !tokenEngine) {
      return res.status(503).json({
        success: false,
        error: 'Wallet service not available'
      });
    }

    const withdrawalStats = walletModel.getWithdrawalStats(userId);
    const tokenAccount = tokenEngine.getAccount(userId);

    const stats = {
      tokenBalance: tokenAccount?.balance || 0,
      totalEarned: tokenAccount?.totalEarned || 0,
      totalSpent: tokenAccount?.totalSpent || 0,
      withdrawalStats,
      transactionCount: tokenAccount?.transactionCount || 0
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting wallet stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet statistics'
    });
  }
});

/**
 * Helper function to mask crypto addresses
 */
function maskAddress(address) {
  if (!address || address.length < 8) return address;
  const start = address.substring(0, 6);
  const end = address.substring(address.length - 4);
  return `${start}...${end}`;
}

// Add the function to router context
router.maskAddress = maskAddress;

module.exports = { router, initializeServices };
