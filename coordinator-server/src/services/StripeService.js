const stripe = require('stripe');
const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Advanced Stripe Payment Service for NeuroGrid
 *
 * Handles:
 * - Subscription management and lifecycle
 * - Usage-based billing for compute resources
 * - One-time payments and credits
 * - Webhook processing and event handling
 * - Customer management and invoicing
 * - Payment method management
 * - Proration and billing cycles
 * - Tax calculation and compliance
 */
class StripeService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.stripeSecretKey = options.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = options.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    this.environment = options.environment || process.env.NODE_ENV || 'development';

    if (!this.stripeSecretKey) {
      throw new Error('Stripe secret key is required');
    }

    // Initialize Stripe client
    this.stripe = stripe(this.stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: false,
      telemetry: false
    });

    // Product configuration
    this.products = {
      GPU_COMPUTE: 'gpu_compute_hours',
      STORAGE: 'storage_gb_month',
      BANDWIDTH: 'bandwidth_gb',
      PREMIUM_SUPPORT: 'premium_support'
    };

    // Subscription plans
    this.plans = {
      STARTER: {
        id: 'starter_monthly',
        name: 'Starter Plan',
        price: 2999, // $29.99
        currency: 'usd',
        interval: 'month',
        features: {
          gpu_hours_included: 10,
          storage_gb_included: 100,
          bandwidth_gb_included: 1000,
          support_level: 'standard'
        }
      },
      PROFESSIONAL: {
        id: 'professional_monthly',
        name: 'Professional Plan',
        price: 9999, // $99.99
        currency: 'usd',
        interval: 'month',
        features: {
          gpu_hours_included: 50,
          storage_gb_included: 500,
          bandwidth_gb_included: 5000,
          support_level: 'priority'
        }
      },
      ENTERPRISE: {
        id: 'enterprise_monthly',
        name: 'Enterprise Plan',
        price: 49999, // $499.99
        currency: 'usd',
        interval: 'month',
        features: {
          gpu_hours_included: 500,
          storage_gb_included: 5000,
          bandwidth_gb_included: 50000,
          support_level: 'premium'
        }
      }
    };

    // Usage pricing (per unit after included amounts)
    this.usagePricing = {
      gpu_compute_hour: 150, // $1.50 per hour
      storage_gb_month: 10,   // $0.10 per GB/month
      bandwidth_gb: 5,        // $0.05 per GB
      priority_support_hour: 5000 // $50.00 per hour
    };

    // Statistics
    this.stats = {
      paymentsProcessed: 0,
      subscriptionsCreated: 0,
      webhooksProcessed: 0,
      totalRevenue: 0,
      errors: 0,
      startTime: new Date()
    };

    logger.info('Stripe service initialized', {
      environment: this.environment,
      apiVersion: '2023-10-16'
    });
  }

  /**
   * Initialize Stripe products and prices
   */
  async initialize() {
    try {
      logger.info('Initializing Stripe products and prices...');

      // Create products if they don't exist
      await this.ensureProducts();

      // Create subscription plans
      await this.ensurePlans();

      // Create usage-based pricing
      await this.ensureUsagePricing();

      logger.info('Stripe initialization completed');

    } catch (error) {
      logger.error('Failed to initialize Stripe service', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure products exist in Stripe
   */
  async ensureProducts() {
    const productsToCreate = [
      {
        id: this.products.GPU_COMPUTE,
        name: 'GPU Compute Hours',
        description: 'High-performance GPU computing time',
        type: 'service'
      },
      {
        id: this.products.STORAGE,
        name: 'Cloud Storage',
        description: 'Secure cloud storage for data and models',
        type: 'service'
      },
      {
        id: this.products.BANDWIDTH,
        name: 'Data Transfer',
        description: 'Network bandwidth for data transfer',
        type: 'service'
      },
      {
        id: this.products.PREMIUM_SUPPORT,
        name: 'Premium Support',
        description: '24/7 priority technical support',
        type: 'service'
      }
    ];

    for (const product of productsToCreate) {
      try {
        await this.stripe.products.retrieve(product.id);
        logger.debug('Product already exists', { productId: product.id });
      } catch (error) {
        if (error.code === 'resource_missing') {
          await this.stripe.products.create(product);
          logger.info('Created product', { productId: product.id });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Ensure subscription plans exist
   */
  async ensurePlans() {
    for (const [planKey, plan] of Object.entries(this.plans)) {
      try {
        await this.stripe.prices.retrieve(plan.id);
        logger.debug('Price already exists', { priceId: plan.id });
      } catch (error) {
        if (error.code === 'resource_missing') {
          const price = await this.stripe.prices.create({
            id: plan.id,
            product_data: {
              name: plan.name,
              metadata: {
                plan_type: 'subscription',
                features: JSON.stringify(plan.features)
              }
            },
            unit_amount: plan.price,
            currency: plan.currency,
            recurring: {
              interval: plan.interval
            },
            billing_scheme: 'per_unit'
          });
          logger.info('Created subscription plan', {
            planKey,
            priceId: price.id
          });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Ensure usage-based pricing exists
   */
  async ensureUsagePricing() {
    for (const [usageType, pricePerUnit] of Object.entries(this.usagePricing)) {
      const priceId = `usage_${usageType}`;

      try {
        await this.stripe.prices.retrieve(priceId);
        logger.debug('Usage price already exists', { priceId });
      } catch (error) {
        if (error.code === 'resource_missing') {
          const price = await this.stripe.prices.create({
            id: priceId,
            product_data: {
              name: `${usageType.replace(/_/g, ' ').toUpperCase()} (Usage)`,
              metadata: {
                pricing_type: 'usage',
                usage_type: usageType
              }
            },
            unit_amount: pricePerUnit,
            currency: 'usd',
            billing_scheme: 'per_unit'
          });
          logger.info('Created usage pricing', {
            usageType,
            priceId: price.id
          });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Create or retrieve customer
   */
  async getOrCreateCustomer(userData) {
    try {
      const { email, name, userId, metadata = {} } = userData;

      // Try to find existing customer by email
      const customers = await this.stripe.customers.list({
        email: email,
        limit: 1
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        logger.debug('Found existing customer', {
          customerId: customer.id,
          email
        });
        return customer;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId: userId.toString(),
          ...metadata
        }
      });

      logger.info('Created new customer', {
        customerId: customer.id,
        email
      });

      return customer;

    } catch (error) {
      logger.error('Error getting/creating customer', {
        email: userData.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(customerId, planId, options = {}) {
    try {
      const {
        paymentMethodId,
        trialDays = 0,
        prorationBehavior = 'create_prorations',
        metadata = {}
      } = options;

      const subscriptionData = {
        customer: customerId,
        items: [{ price: planId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          created_by: 'neurogrid_api',
          ...metadata
        }
      };

      // Add payment method if provided
      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
        subscriptionData.payment_behavior = 'default_incomplete';
      }

      // Add trial period
      if (trialDays > 0) {
        subscriptionData.trial_period_days = trialDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      this.stats.subscriptionsCreated++;

      logger.info('Created subscription', {
        subscriptionId: subscription.id,
        customerId,
        planId,
        status: subscription.status
      });

      this.emit('subscription_created', {
        subscription,
        customerId,
        planId
      });

      return subscription;

    } catch (error) {
      logger.error('Error creating subscription', {
        customerId,
        planId,
        error: error.message
      });
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updates
      );

      logger.info('Updated subscription', {
        subscriptionId,
        updates: Object.keys(updates)
      });

      this.emit('subscription_updated', {
        subscription,
        updates
      });

      return subscription;

    } catch (error) {
      logger.error('Error updating subscription', {
        subscriptionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, options = {}) {
    try {
      const {
        immediate = false,
        prorationBehavior = 'create_prorations',
        cancellationDetails = {}
      } = options;

      let subscription;

      if (immediate) {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
          proration_behavior: prorationBehavior
        });
      } else {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
          cancellation_details: cancellationDetails
        });
      }

      logger.info('Cancelled subscription', {
        subscriptionId,
        immediate,
        status: subscription.status
      });

      this.emit('subscription_cancelled', {
        subscription,
        immediate
      });

      return subscription;

    } catch (error) {
      logger.error('Error cancelling subscription', {
        subscriptionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Record usage for billing
   */
  async recordUsage(subscriptionItemId, quantity, timestamp = null, action = 'increment') {
    try {
      const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
        subscriptionItemId,
        {
          quantity,
          timestamp: timestamp || Math.floor(Date.now() / 1000),
          action
        }
      );

      logger.debug('Recorded usage', {
        subscriptionItemId,
        quantity,
        action
      });

      this.emit('usage_recorded', {
        usageRecord,
        subscriptionItemId,
        quantity
      });

      return usageRecord;

    } catch (error) {
      logger.error('Error recording usage', {
        subscriptionItemId,
        quantity,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create payment intent for one-time payment
   */
  async createPaymentIntent(amount, currency = 'usd', options = {}) {
    try {
      const {
        customerId,
        paymentMethodId,
        description,
        metadata = {},
        confirmationMethod = 'automatic'
      } = options;

      const paymentIntentData = {
        amount,
        currency,
        confirmation_method: confirmationMethod,
        description,
        metadata: {
          created_by: 'neurogrid_api',
          ...metadata
        }
      };

      if (customerId) {
        paymentIntentData.customer = customerId;
      }

      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        if (confirmationMethod === 'automatic') {
          paymentIntentData.confirm = true;
        }
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      this.stats.paymentsProcessed++;

      logger.info('Created payment intent', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status
      });

      this.emit('payment_intent_created', {
        paymentIntent,
        amount,
        currency
      });

      return paymentIntent;

    } catch (error) {
      logger.error('Error creating payment intent', {
        amount,
        currency,
        error: error.message
      });
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Process webhook events
   */
  async processWebhook(rawBody, signature) {
    try {
      if (!this.webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );

      this.stats.webhooksProcessed++;

      logger.info('Processing webhook', {
        eventType: event.type,
        eventId: event.id
      });

      // Handle different event types
      switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object);
        break;

      case 'customer.created':
        await this.handleCustomerCreated(event.data.object);
        break;

      default:
        logger.debug('Unhandled webhook event type', {
          eventType: event.type
        });
      }

      this.emit('webhook_processed', {
        event,
        type: event.type
      });

      return { received: true, eventId: event.id };

    } catch (error) {
      logger.error('Error processing webhook', {
        error: error.message,
        signature: signature ? 'present' : 'missing'
      });
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Handle subscription created webhook
   */
  async handleSubscriptionCreated(subscription) {
    logger.info('Subscription created webhook', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status
    });

    this.emit('subscription_webhook_created', subscription);
  }

  /**
   * Handle subscription updated webhook
   */
  async handleSubscriptionUpdated(subscription) {
    logger.info('Subscription updated webhook', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status
    });

    this.emit('subscription_webhook_updated', subscription);
  }

  /**
   * Handle subscription deleted webhook
   */
  async handleSubscriptionDeleted(subscription) {
    logger.info('Subscription deleted webhook', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    this.emit('subscription_webhook_deleted', subscription);
  }

  /**
   * Handle successful invoice payment
   */
  async handleInvoicePaymentSucceeded(invoice) {
    const amount = invoice.amount_paid;
    this.stats.totalRevenue += amount;

    logger.info('Invoice payment succeeded', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount,
      currency: invoice.currency
    });

    this.emit('invoice_payment_succeeded', invoice);
  }

  /**
   * Handle failed invoice payment
   */
  async handleInvoicePaymentFailed(invoice) {
    logger.warn('Invoice payment failed', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_due,
      attempt: invoice.attempt_count
    });

    this.emit('invoice_payment_failed', invoice);
  }

  /**
   * Handle successful payment intent
   */
  async handlePaymentIntentSucceeded(paymentIntent) {
    const amount = paymentIntent.amount;
    this.stats.totalRevenue += amount;

    logger.info('Payment intent succeeded', {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount,
      currency: paymentIntent.currency
    });

    this.emit('payment_intent_succeeded', paymentIntent);
  }

  /**
   * Handle failed payment intent
   */
  async handlePaymentIntentFailed(paymentIntent) {
    logger.warn('Payment intent failed', {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      lastPaymentError: paymentIntent.last_payment_error
    });

    this.emit('payment_intent_failed', paymentIntent);
  }

  /**
   * Handle customer created
   */
  async handleCustomerCreated(customer) {
    logger.info('Customer created webhook', {
      customerId: customer.id,
      email: customer.email
    });

    this.emit('customer_created', customer);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime(),
      revenueFormatted: this.formatCurrency(this.stats.totalRevenue)
    };
  }

  /**
   * Format currency amount
   */
  formatCurrency(amount, currency = 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  }

  /**
   * Get available plans
   */
  getPlans() {
    return Object.entries(this.plans).map(([key, plan]) => ({
      key,
      ...plan,
      priceFormatted: this.formatCurrency(plan.price, plan.currency)
    }));
  }

  /**
   * Calculate usage costs
   */
  calculateUsageCost(usage) {
    let totalCost = 0;

    for (const [usageType, quantity] of Object.entries(usage)) {
      if (this.usagePricing[usageType]) {
        totalCost += quantity * this.usagePricing[usageType];
      }
    }

    return totalCost;
  }
}

module.exports = StripeService;
