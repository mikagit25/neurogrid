const StripeService = require('../../src/services/StripeService');

// Mock Stripe for testing
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    products: {
      retrieve: jest.fn(),
      create: jest.fn()
    },
    prices: {
      retrieve: jest.fn(),
      create: jest.fn()
    },
    customers: {
      list: jest.fn(),
      create: jest.fn()
    },
    subscriptions: {
      create: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      retrieve: jest.fn()
    },
    subscriptionItems: {
      createUsageRecord: jest.fn()
    },
    paymentIntents: {
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

describe('StripeService', () => {
  let stripeService;
  let mockStripe;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instance with test configuration
    stripeService = new StripeService({
      stripeSecretKey: 'sk_test_fake_key',
      webhookSecret: 'whsec_test_secret',
      environment: 'test'
    });

    // Access the mocked Stripe instance
    mockStripe = stripeService.stripe;

    // Verify mockStripe exists and has required methods
    if (mockStripe && typeof mockStripe === 'object') {
      // Mock methods exist from jest.mock above
      // Just ensure they return sensible defaults
      mockStripe.products.retrieve.mockResolvedValue({ id: 'prod_test', name: 'Test Product' });
      mockStripe.products.create.mockResolvedValue({ id: 'prod_new', name: 'New Product' });
      mockStripe.customers.list.mockResolvedValue({ data: [] });
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_test', email: 'test@example.com' });
    } else {
      // If mockStripe is not properly initialized, set it up manually
      mockStripe = {
        products: {
          retrieve: jest.fn().mockResolvedValue({ id: 'prod_test', name: 'Test Product' }),
          create: jest.fn().mockResolvedValue({ id: 'prod_new', name: 'New Product' })
        },
        prices: {
          retrieve: jest.fn().mockResolvedValue({ id: 'price_test', unit_amount: 2999 }),
          create: jest.fn().mockResolvedValue({ id: 'price_new', unit_amount: 2999 })
        },
        customers: {
          list: jest.fn().mockResolvedValue({ data: [] }),
          create: jest.fn().mockResolvedValue({ id: 'cus_test', email: 'test@example.com' })
        },
        subscriptions: {
          create: jest.fn().mockResolvedValue({ id: 'sub_test', status: 'active' }),
          update: jest.fn().mockResolvedValue({ id: 'sub_test', status: 'active' }),
          cancel: jest.fn().mockResolvedValue({ id: 'sub_test', status: 'canceled' }),
          retrieve: jest.fn().mockResolvedValue({ id: 'sub_test', status: 'active' })
        },
        subscriptionItems: {
          createUsageRecord: jest.fn().mockResolvedValue({ id: 'usage_test' })
        },
        paymentIntents: {
          create: jest.fn().mockResolvedValue({ id: 'pi_test', status: 'succeeded' })
        },
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({ id: 'evt_test', type: 'invoice.payment_succeeded' })
        }
      };
      stripeService.stripe = mockStripe;
    }
    if (!mockStripe.subscriptionItems) {
      mockStripe.subscriptionItems = {
        createUsageRecord: jest.fn()
      };
    }
    if (!mockStripe.paymentIntents) {
      mockStripe.paymentIntents = {
        create: jest.fn()
      };
    }
    if (!mockStripe.webhooks) {
      mockStripe.webhooks = {
        constructEvent: jest.fn()
      };
    }
  });

  describe('Initialization', () => {
    test('should initialize with required configuration', () => {
      expect(stripeService.stripeSecretKey).toBe('sk_test_fake_key');
      expect(stripeService.webhookSecret).toBe('whsec_test_secret');
      expect(stripeService.environment).toBe('test');
    });

    test('should throw error without secret key', () => {
      expect(() => {
        new StripeService({ stripeSecretKey: null });
      }).toThrow('Stripe secret key is required');
    });

    test('should have predefined products and plans', () => {
      expect(stripeService.products).toHaveProperty('GPU_COMPUTE');
      expect(stripeService.plans).toHaveProperty('STARTER');
      expect(stripeService.plans).toHaveProperty('PROFESSIONAL');
      expect(stripeService.plans).toHaveProperty('ENTERPRISE');
    });
  });

  describe('Product Management', () => {
    test('should ensure products exist', async () => {
      // Mock product retrieval failure (product doesn't exist)
      mockStripe.products.retrieve.mockRejectedValue({ code: 'resource_missing' });
      mockStripe.products.create.mockResolvedValue({ id: 'prod_test' });

      await stripeService.ensureProducts();

      expect(mockStripe.products.retrieve).toHaveBeenCalledTimes(4); // 4 products
      expect(mockStripe.products.create).toHaveBeenCalledTimes(4);
    });

    test('should skip creating existing products', async () => {
      // Mock existing products
      mockStripe.products.retrieve.mockResolvedValue({ id: 'prod_existing' });

      await stripeService.ensureProducts();

      expect(mockStripe.products.retrieve).toHaveBeenCalledTimes(4);
      expect(mockStripe.products.create).not.toHaveBeenCalled();
    });
  });

  describe('Customer Management', () => {
    test('should create new customer', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        userId: '123',
        metadata: { role: 'user' }
      };

      // Mock no existing customer
      mockStripe.customers.list.mockResolvedValue({ data: [] });
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User'
      });

      const customer = await stripeService.getOrCreateCustomer(userData);

      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: 'test@example.com',
        limit: 1
      });
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: {
          userId: '123',
          role: 'user'
        }
      });
      expect(customer.id).toBe('cus_test123');
    });

    test('should return existing customer', async () => {
      const userData = {
        email: 'existing@example.com',
        name: 'Existing User',
        userId: '456'
      };

      const existingCustomer = {
        id: 'cus_existing',
        email: 'existing@example.com',
        name: 'Existing User'
      };

      mockStripe.customers.list.mockResolvedValue({
        data: [existingCustomer]
      });

      const customer = await stripeService.getOrCreateCustomer(userData);

      expect(mockStripe.customers.list).toHaveBeenCalled();
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(customer).toEqual(existingCustomer);
    });
  });

  describe('Subscription Management', () => {
    test('should create subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        customer: 'cus_test',
        status: 'active',
        current_period_start: 1234567890,
        current_period_end: 1237246090
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const subscription = await stripeService.createSubscription(
        'cus_test',
        'price_starter',
        {
          paymentMethodId: 'pm_test',
          trialDays: 7,
          metadata: { userId: '123' }
        }
      );

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_test',
        items: [{ price: 'price_starter' }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        default_payment_method: 'pm_test',
        trial_period_days: 7,
        metadata: {
          created_by: 'neurogrid_api',
          userId: '123'
        }
      });

      expect(subscription).toEqual(mockSubscription);
      expect(stripeService.stats.subscriptionsCreated).toBe(1);
    });

    test('should update subscription', async () => {
      const mockUpdatedSubscription = {
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: true
      };

      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription);

      const updates = { cancel_at_period_end: true };
      const subscription = await stripeService.updateSubscription('sub_test123', updates);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', updates);
      expect(subscription).toEqual(mockUpdatedSubscription);
    });

    test('should cancel subscription immediately', async () => {
      const mockCancelledSubscription = {
        id: 'sub_test123',
        status: 'canceled',
        canceled_at: 1234567890
      };

      mockStripe.subscriptions.cancel.mockResolvedValue(mockCancelledSubscription);

      const subscription = await stripeService.cancelSubscription('sub_test123', {
        immediate: true
      });

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123', {
        proration_behavior: 'create_prorations'
      });
      expect(subscription).toEqual(mockCancelledSubscription);
    });

    test('should schedule subscription cancellation', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: true
      };

      mockStripe.subscriptions.update.mockResolvedValue(mockSubscription);

      const subscription = await stripeService.cancelSubscription('sub_test123', {
        immediate: false,
        cancellationDetails: { comment: 'User request' }
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: true,
        cancellation_details: { comment: 'User request' }
      });
      expect(subscription.cancel_at_period_end).toBe(true);
    });
  });

  describe('Payment Intents', () => {
    test('should create payment intent', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2999,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const paymentIntent = await stripeService.createPaymentIntent(2999, 'usd', {
        customerId: 'cus_test',
        description: 'Test payment',
        metadata: { userId: '123' }
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2999,
        currency: 'usd',
        confirmation_method: 'automatic',
        customer: 'cus_test',
        description: 'Test payment',
        metadata: {
          created_by: 'neurogrid_api',
          userId: '123'
        }
      });

      expect(paymentIntent).toEqual(mockPaymentIntent);
      expect(stripeService.stats.paymentsProcessed).toBe(1);
    });

    test('should create payment intent with confirmation', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const paymentIntent = await stripeService.createPaymentIntent(5000, 'usd', {
        customerId: 'cus_test',
        paymentMethodId: 'pm_test',
        confirmationMethod: 'automatic'
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        confirmation_method: 'automatic',
        customer: 'cus_test',
        payment_method: 'pm_test',
        confirm: true,
        metadata: {
          created_by: 'neurogrid_api'
        }
      });

      expect(paymentIntent.status).toBe('succeeded');
    });
  });

  describe('Usage Recording', () => {
    test('should record usage', async () => {
      const mockUsageRecord = {
        id: 'mbur_test123',
        quantity: 10,
        timestamp: 1234567890
      };

      mockStripe.subscriptionItems.createUsageRecord.mockResolvedValue(mockUsageRecord);

      const usageRecord = await stripeService.recordUsage('si_test', 10, 1234567890);

      expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
        'si_test',
        {
          quantity: 10,
          timestamp: 1234567890,
          action: 'increment'
        }
      );

      expect(usageRecord).toEqual(mockUsageRecord);
    });
  });

  describe('Webhook Processing', () => {
    test('should process valid webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active'
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await stripeService.processWebhook('raw_body', 'test_signature');

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'raw_body',
        'test_signature',
        'whsec_test_secret'
      );

      expect(result).toEqual({
        received: true,
        eventId: 'evt_test123'
      });

      expect(stripeService.stats.webhooksProcessed).toBe(1);
    });

    test('should handle webhook signature verification failure', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      await expect(
        stripeService.processWebhook('raw_body', 'invalid_signature')
      ).rejects.toThrow('No signatures found');

      expect(stripeService.stats.errors).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    test('should format currency correctly', () => {
      expect(stripeService.formatCurrency(2999)).toBe('$29.99');
      expect(stripeService.formatCurrency(100, 'eur')).toBe('€1.00');
      expect(stripeService.formatCurrency(50)).toBe('$0.50');
    });

    test('should calculate usage cost', () => {
      const usage = {
        gpu_compute_hour: 5,
        storage_gb_month: 100,
        bandwidth_gb: 50
      };

      const cost = stripeService.calculateUsageCost(usage);

      // 5 * 150 + 100 * 10 + 50 * 5 = 750 + 1000 + 250 = 2000 cents
      expect(cost).toBe(2000);
    });

    test('should get available plans', () => {
      const plans = stripeService.getPlans();

      expect(plans).toHaveLength(3);
      expect(plans[0]).toHaveProperty('key');
      expect(plans[0]).toHaveProperty('name');
      expect(plans[0]).toHaveProperty('priceFormatted');
      expect(plans[0].priceFormatted).toContain('$');
    });

    test('should provide service statistics', () => {
      // Simulate some activity
      stripeService.stats.paymentsProcessed = 10;
      stripeService.stats.totalRevenue = 50000; // $500.00

      const stats = stripeService.getStats();

      expect(stats.paymentsProcessed).toBe(10);
      expect(stats.totalRevenue).toBe(50000);
      expect(stats.revenueFormatted).toBe('$500.00');
      expect(stats).toHaveProperty('uptime');
    });
  });

  describe('Error Handling', () => {
    test('should handle Stripe API errors gracefully', async () => {
      const stripeError = new Error('Your card was declined');
      stripeError.code = 'card_declined';
      stripeError.type = 'card_error';

      mockStripe.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(
        stripeService.createPaymentIntent(2999, 'usd')
      ).rejects.toThrow('Your card was declined');

      expect(stripeService.stats.errors).toBe(1);
    });

    test('should handle missing webhook secret', async () => {
      const serviceWithoutSecret = new StripeService({
        stripeSecretKey: 'sk_test_key',
        webhookSecret: null
      });

      await expect(
        serviceWithoutSecret.processWebhook('body', 'signature')
      ).rejects.toThrow('Webhook secret not configured');
    });
  });
});
