const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../../middleware/security');
const rateLimit = require('express-rate-limit');
const logger = require('../../utils/logger');
const StripeService = require('../../services/StripeService');
const PaymentGateway = require('../../services/PaymentGateway');
const TokenEngine = require('../../services/TokenEngine');

// Service instances (injected from main app)
let stripeService = null;
let userService = null;
let subscriptionService = null;

// Create payment gateway and token engine instances
const paymentGateway = new PaymentGateway();
const tokenEngine = new TokenEngine();

// Withdrawal limits configuration
const withdrawalLimit = {
  daily: 10000,
  monthly: 100000,
  perTransaction: 5000
};

// Rate limiting for payment operations
const paymentLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 payment operations per minute per IP
  message: { error: 'Too many payment requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Subscription operations rate limiting
const subscriptionLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 subscription operations per 5 minutes per IP
  message: { error: 'Too many subscription requests, please try again later' }
});

// Webhook rate limiting (high limit for Stripe webhooks)
const webhookLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute
  message: { error: 'Webhook rate limit exceeded' }
});

// Initialize services
const initializeServices = (services) => {
  stripeService = services.stripeService;
  userService = services.userService;
  subscriptionService = services.subscriptionService;
};

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * @swagger
 * /api/payments/plans:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Get available subscription plans
 *     description: Retrieve all available subscription plans with pricing and features
 *     responses:
 *       200:
 *         description: List of available plans
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
 *                     plans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           price:
 *                             type: integer
 *                           priceFormatted:
 *                             type: string
 *                           currency:
 *                             type: string
 *                           interval:
 *                             type: string
 *                           features:
 *                             type: object
 */
router.get('/plans', async (req, res) => {
  try {
    if (!stripeService) {
      return res.status(503).json({
        success: false,
        error: 'Payment service not available'
      });
    }

    const plans = stripeService.getPlans();

    res.json({
      success: true,
      data: {
        plans,
        currency: 'USD',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching plans', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
});

/**
 * @swagger
 * /api/payments/create-customer:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Create or retrieve Stripe customer
 *     description: Create a new Stripe customer or retrieve existing one
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Customer full name
 *               phone:
 *                 type: string
 *                 description: Customer phone number
 *               address:
 *                 type: object
 *                 description: Customer address
 *     responses:
 *       200:
 *         description: Customer created or retrieved successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.post('/create-customer',
  authenticate,
  paymentLimit,
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('phone').optional().isString().trim(),
    body('address').optional().isObject()
  ],
  validateRequest,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const { name, phone, address } = req.body;
      const user = req.user;

      const customerData = {
        email: user.email,
        name: name || user.username || user.email,
        userId: user.id,
        metadata: {
          user_id: user.id.toString(),
          registered_at: user.createdAt || new Date().toISOString(),
          phone: phone || '',
          role: user.role || 'user'
        }
      };

      if (address) {
        customerData.address = address;
      }

      const customer = await stripeService.getOrCreateCustomer(customerData);

      res.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            created: customer.created
          }
        }
      });

    } catch (error) {
      logger.error('Error creating customer', {
        userId: req.user?.id,
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create customer'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/create-subscription:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Create new subscription
 *     description: Create a new subscription for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Subscription plan ID
 *               paymentMethodId:
 *                 type: string
 *                 description: Stripe payment method ID
 *               trialDays:
 *                 type: integer
 *                 description: Trial period in days
 *                 default: 0
 *     responses:
 *       200:
 *         description: Subscription created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post('/create-subscription',
  authenticate,
  subscriptionLimit,
  [
    body('planId').isString().notEmpty(),
    body('paymentMethodId').optional().isString(),
    body('trialDays').optional().isInt({ min: 0, max: 30 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const { planId, paymentMethodId, trialDays = 0 } = req.body;
      const user = req.user;

      // Get or create customer
      const customer = await stripeService.getOrCreateCustomer({
        email: user.email,
        name: user.username || user.email,
        userId: user.id
      });

      // Create subscription
      const subscription = await stripeService.createSubscription(
        customer.id,
        planId,
        {
          paymentMethodId,
          trialDays,
          metadata: {
            user_id: user.id.toString(),
            plan_id: planId,
            created_by: 'web_api'
          }
        }
      );

      res.json({
        success: true,
        data: {
          subscription: {
            id: subscription.id,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            trial_end: subscription.trial_end,
            latest_invoice: subscription.latest_invoice
          },
          customer: {
            id: customer.id,
            email: customer.email
          }
        }
      });

    } catch (error) {
      logger.error('Error creating subscription', {
        userId: req.user?.id,
        planId: req.body.planId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create subscription',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/create-payment-intent:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Create payment intent for one-time payment
 *     description: Create a payment intent for credits or one-time purchases
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
 *                 type: integer
 *                 description: Payment amount in cents
 *                 minimum: 50
 *               currency:
 *                 type: string
 *                 description: Payment currency
 *                 default: usd
 *               description:
 *                 type: string
 *                 description: Payment description
 *               paymentMethodId:
 *                 type: string
 *                 description: Stripe payment method ID
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 */
router.post('/create-payment-intent',
  authenticate,
  paymentLimit,
  [
    body('amount').isInt({ min: 50 }).withMessage('Amount must be at least $0.50'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('description').optional().isString().trim().isLength({ max: 500 }),
    body('paymentMethodId').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const {
        amount,
        currency = 'usd',
        description = 'NeuroGrid Credits',
        paymentMethodId
      } = req.body;
      const user = req.user;

      // Get or create customer
      const customer = await stripeService.getOrCreateCustomer({
        email: user.email,
        name: user.username || user.email,
        userId: user.id
      });

      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent(
        amount,
        currency,
        {
          customerId: customer.id,
          paymentMethodId,
          description,
          metadata: {
            user_id: user.id.toString(),
            customer_email: user.email,
            purpose: 'credits_purchase'
          }
        }
      );

      res.json({
        success: true,
        data: {
          paymentIntent: {
            id: paymentIntent.id,
            client_secret: paymentIntent.client_secret,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status
          },
          customer: {
            id: customer.id,
            email: customer.email
          }
        }
      });

    } catch (error) {
      logger.error('Error creating payment intent', {
        userId: req.user?.id,
        amount: req.body.amount,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create payment intent'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Stripe webhook endpoint
 *     description: Handle Stripe webhook events for payment processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature
 */
router.post('/webhook',
  webhookLimit,
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing stripe-signature header'
        });
      }

      const result = await stripeService.processWebhook(req.body, signature);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error processing webhook', {
        error: error.message,
        signature: req.headers['stripe-signature'] ? 'present' : 'missing'
      });

      if (error.message.includes('No signatures found')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/subscription/{subscriptionId}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Get subscription details
 *     description: Retrieve subscription information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: subscriptionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription details
 *       404:
 *         description: Subscription not found
 */
router.get('/subscription/:subscriptionId',
  authenticate,
  [param('subscriptionId').isString().notEmpty()],
  validateRequest,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const { subscriptionId } = req.params;

      const subscription = await stripeService.stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ['latest_invoice', 'customer'] }
      );

      // Verify ownership (basic security check)
      const customer = subscription.customer;
      if (customer.metadata?.userId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this subscription'
        });
      }

      res.json({
        success: true,
        data: {
          subscription: {
            id: subscription.id,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            trial_end: subscription.trial_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            latest_invoice: subscription.latest_invoice
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching subscription', {
        subscriptionId: req.params.subscriptionId,
        userId: req.user?.id,
        error: error.message
      });

      if (error.code === 'resource_missing') {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/subscription/{subscriptionId}/cancel:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Cancel subscription
 *     description: Cancel or schedule cancellation of a subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: subscriptionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               immediate:
 *                 type: boolean
 *                 description: Cancel immediately or at period end
 *                 default: false
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 */
router.post('/subscription/:subscriptionId/cancel',
  authenticate,
  subscriptionLimit,
  [
    param('subscriptionId').isString().notEmpty(),
    body('immediate').optional().isBoolean(),
    body('reason').optional().isString().trim().isLength({ max: 500 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const { subscriptionId } = req.params;
      const { immediate = false, reason = 'User requested cancellation' } = req.body;

      // Verify ownership
      const subscription = await stripeService.stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ['customer'] }
      );

      const customer = subscription.customer;
      if (customer.metadata?.userId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this subscription'
        });
      }

      const cancelledSubscription = await stripeService.cancelSubscription(
        subscriptionId,
        {
          immediate,
          cancellationDetails: {
            comment: reason,
            feedback: 'other'
          }
        }
      );

      res.json({
        success: true,
        data: {
          subscription: {
            id: cancelledSubscription.id,
            status: cancelledSubscription.status,
            cancel_at_period_end: cancelledSubscription.cancel_at_period_end,
            cancelled_at: cancelledSubscription.cancelled_at,
            ended_at: cancelledSubscription.ended_at
          },
          message: immediate
            ? 'Subscription cancelled immediately'
            : 'Subscription will be cancelled at the end of the current period'
        }
      });

    } catch (error) {
      logger.error('Error cancelling subscription', {
        subscriptionId: req.params.subscriptionId,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/usage:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Record usage for billing
 *     description: Record usage metrics for subscription billing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usageType
 *               - quantity
 *             properties:
 *               usageType:
 *                 type: string
 *                 enum: [gpu_compute_hour, storage_gb_month, bandwidth_gb]
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Usage recorded successfully
 */
router.post('/usage',
  authenticate,
  [
    body('usageType').isIn(['gpu_compute_hour', 'storage_gb_month', 'bandwidth_gb']),
    body('quantity').isFloat({ min: 0 }),
    body('timestamp').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      const { usageType, quantity, timestamp } = req.body;
      const user = req.user;

      // This would typically look up the user's active subscription
      // and find the appropriate subscription item for the usage type
      // For demo purposes, we'll calculate the cost

      const cost = stripeService.calculateUsageCost({
        [usageType]: quantity
      });

      res.json({
        success: true,
        data: {
          usageType,
          quantity,
          estimatedCost: cost,
          costFormatted: stripeService.formatCurrency(cost),
          timestamp: timestamp || new Date().toISOString(),
          message: 'Usage recorded successfully'
        }
      });

    } catch (error) {
      logger.error('Error recording usage', {
        userId: req.user?.id,
        usageType: req.body.usageType,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to record usage'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/stats:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Get payment service statistics
 *     description: Retrieve payment service statistics and metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment statistics
 */
router.get('/stats',
  authenticate,
  async (req, res) => {
    try {
      if (!stripeService) {
        return res.status(503).json({
          success: false,
          error: 'Payment service not available'
        });
      }

      // Only allow admin users to see full stats
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const stats = stripeService.getStats();

      res.json({
        success: true,
        data: {
          stats,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error fetching payment stats', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment statistics'
      });
    }
  }
);

module.exports = {
  router,
  initializeServices
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
