const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Payment Gateway Service
 * Handles integration with various payment providers (Stripe, PayPal, Crypto)
 */
class PaymentGateway {
  constructor() {
    this.providers = new Map();
    this.supportedCurrencies = {
      fiat: ['USD', 'EUR', 'RUB', 'GBP', 'JPY'],
      crypto: ['BTC', 'ETH', 'USDT', 'USDC']
    };
    this.exchangeRates = new Map();
    this.pendingTransactions = new Map();
    this.completedTransactions = new Map();

    // Initialize payment providers
    this.initializeProviders();

    // Start exchange rate updates
    this.startExchangeRateUpdates();
  }

  /**
   * Initialize payment provider integrations
   */
  initializeProviders() {
    // Stripe integration (for cards)
    this.providers.set('stripe', {
      name: 'Stripe',
      type: 'card',
      currencies: ['USD', 'EUR', 'GBP'],
      fees: {
        percentage: 2.9,
        fixed: 0.30 // USD
      },
      enabled: process.env.STRIPE_ENABLED === 'true',
      apiKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    });

    // PayPal integration
    this.providers.set('paypal', {
      name: 'PayPal',
      type: 'wallet',
      currencies: ['USD', 'EUR', 'GBP', 'RUB'],
      fees: {
        percentage: 3.4,
        fixed: 0.35
      },
      enabled: process.env.PAYPAL_ENABLED === 'true',
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      sandbox: process.env.NODE_ENV !== 'production'
    });

    // Cryptocurrency integration
    this.providers.set('crypto', {
      name: 'Crypto Gateway',
      type: 'crypto',
      currencies: ['BTC', 'ETH', 'USDT', 'USDC'],
      fees: {
        percentage: 1.0,
        fixed: 0
      },
      enabled: process.env.CRYPTO_ENABLED === 'true',
      networks: {
        bitcoin: process.env.BITCOIN_NETWORK || 'testnet',
        ethereum: process.env.ETHEREUM_NETWORK || 'goerli'
      }
    });

    // Bank transfer integration (for large amounts)
    this.providers.set('bank', {
      name: 'Bank Transfer',
      type: 'bank',
      currencies: ['USD', 'EUR', 'RUB'],
      fees: {
        percentage: 0.5,
        fixed: 5.0
      },
      enabled: process.env.BANK_TRANSFER_ENABLED === 'true',
      minAmount: 100.0
    });

    logger.info('Payment providers initialized', {
      enabledProviders: Array.from(this.providers.entries())
        .filter(([_, provider]) => provider.enabled)
        .map(([name, _]) => name)
    });
  }

  /**
   * Create payment intent for deposit
   */
  async createDepositIntent(userId, amount, currency, paymentMethod, metadata = {}) {
    try {
      const provider = this.providers.get(paymentMethod);
      if (!provider || !provider.enabled) {
        throw new Error(`Payment method ${paymentMethod} not available`);
      }

      if (!provider.currencies.includes(currency)) {
        throw new Error(`Currency ${currency} not supported by ${paymentMethod}`);
      }

      const transactionId = this.generateTransactionId();
      const tokenAmount = await this.convertToTokens(amount, currency);
      const fees = this.calculateFees(amount, provider);

      const paymentIntent = {
        id: transactionId,
        userId,
        type: 'deposit',
        status: 'pending',
        amount,
        currency,
        tokenAmount,
        paymentMethod,
        provider: provider.name,
        fees,
        netAmount: amount - fees.total,
        metadata,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        webhookSecret: crypto.randomBytes(32).toString('hex')
      };

      // Create provider-specific payment intent
      switch (paymentMethod) {
      case 'stripe':
        paymentIntent.providerData = await this.createStripeIntent(paymentIntent);
        break;
      case 'paypal':
        paymentIntent.providerData = await this.createPayPalOrder(paymentIntent);
        break;
      case 'crypto':
        paymentIntent.providerData = await this.createCryptoAddress(paymentIntent);
        break;
      case 'bank':
        paymentIntent.providerData = await this.createBankTransferInfo(paymentIntent);
        break;
      }

      this.pendingTransactions.set(transactionId, paymentIntent);

      logger.info('Created deposit intent', {
        transactionId,
        userId,
        amount,
        currency,
        paymentMethod
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Error creating deposit intent:', error);
      throw error;
    }
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawalRequest(userId, tokenAmount, currency, withdrawalMethod, destination, metadata = {}) {
    try {
      const provider = this.providers.get(withdrawalMethod);
      if (!provider || !provider.enabled) {
        throw new Error(`Withdrawal method ${withdrawalMethod} not available`);
      }

      const fiatAmount = await this.convertFromTokens(tokenAmount, currency);
      const fees = this.calculateFees(fiatAmount, provider);
      const transactionId = this.generateTransactionId();

      const withdrawalRequest = {
        id: transactionId,
        userId,
        type: 'withdrawal',
        status: 'pending_approval',
        tokenAmount,
        fiatAmount,
        currency,
        withdrawalMethod,
        provider: provider.name,
        destination,
        fees,
        netAmount: fiatAmount - fees.total,
        metadata,
        createdAt: new Date(),
        approvedAt: null,
        processedAt: null
      };

      this.pendingTransactions.set(transactionId, withdrawalRequest);

      logger.info('Created withdrawal request', {
        transactionId,
        userId,
        tokenAmount,
        fiatAmount,
        currency,
        withdrawalMethod
      });

      // Auto-approve small amounts for trusted users
      if (fiatAmount <= 100 && metadata.userTrusted) {
        await this.approveWithdrawal(transactionId);
      }

      return withdrawalRequest;
    } catch (error) {
      logger.error('Error creating withdrawal request:', error);
      throw error;
    }
  }

  /**
   * Stripe payment intent creation
   */
  async createStripeIntent(paymentIntent) {
    // Mock Stripe integration - in production use actual Stripe SDK
    return {
      stripe_payment_intent_id: `pi_${crypto.randomBytes(16).toString('hex')}`,
      client_secret: `pi_${crypto.randomBytes(16).toString('hex')}_secret_${crypto.randomBytes(8).toString('hex')}`,
      amount_cents: Math.round(paymentIntent.amount * 100),
      currency: paymentIntent.currency.toLowerCase(),
      payment_methods: ['card'],
      setup_future_usage: 'off_session'
    };
  }

  /**
   * PayPal order creation
   */
  async createPayPalOrder(paymentIntent) {
    // Mock PayPal integration - in production use PayPal SDK
    return {
      paypal_order_id: crypto.randomBytes(16).toString('hex').toUpperCase(),
      approval_url: `https://www.${paymentIntent.provider === 'sandbox' ? 'sandbox.' : ''}paypal.com/checkoutnow?token=${crypto.randomBytes(16).toString('hex')}`,
      amount: paymentIntent.amount.toString(),
      currency: paymentIntent.currency
    };
  }

  /**
   * Generate crypto payment address
   */
  async createCryptoAddress(paymentIntent) {
    // Mock crypto address generation - in production use actual blockchain APIs
    const addresses = {
      BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      ETH: '0x742d35Cc6C5C1F9F4B7B3E2b7A6a5B9F8A9E3D2C',
      USDT: '0x742d35Cc6C5C1F9F4B7B3E2b7A6a5B9F8A9E3D2C',
      USDC: '0x742d35Cc6C5C1F9F4B7B3E2b7A6a5B9F8A9E3D2C'
    };

    return {
      address: addresses[paymentIntent.currency] || addresses.ETH,
      amount: paymentIntent.amount.toString(),
      currency: paymentIntent.currency,
      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      network: paymentIntent.currency === 'BTC' ? 'bitcoin' : 'ethereum',
      confirmations_required: paymentIntent.currency === 'BTC' ? 3 : 12
    };
  }

  /**
   * Create bank transfer information
   */
  async createBankTransferInfo(paymentIntent) {
    return {
      bank_name: 'NeuroGrid Bank',
      account_number: '1234567890',
      routing_number: '021000021',
      swift_code: 'NGRIDUS33',
      iban: 'US64021000021234567890',
      reference: `NGRID-${paymentIntent.id}`,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      processing_time: '1-3 business days'
    };
  }

  /**
   * Process webhook from payment provider
   */
  async processWebhook(provider, payload, signature) {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(provider, payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      let transactionId, status, providerTransactionId;

      switch (provider) {
      case 'stripe':
        ({ transactionId, status, providerTransactionId } = this.parseStripeWebhook(payload));
        break;
      case 'paypal':
        ({ transactionId, status, providerTransactionId } = this.parsePayPalWebhook(payload));
        break;
      case 'crypto':
        ({ transactionId, status, providerTransactionId } = this.parseCryptoWebhook(payload));
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
      }

      const transaction = this.pendingTransactions.get(transactionId);
      if (!transaction) {
        logger.warn(`Transaction not found: ${transactionId}`);
        return false;
      }

      // Update transaction status
      transaction.status = status;
      transaction.providerTransactionId = providerTransactionId;
      transaction.completedAt = new Date();

      if (status === 'completed') {
        await this.completeTransaction(transaction);
      } else if (status === 'failed') {
        await this.failTransaction(transaction);
      }

      logger.info(`Processed ${provider} webhook`, {
        transactionId,
        status,
        providerTransactionId
      });

      return true;
    } catch (error) {
      logger.error(`Error processing ${provider} webhook:`, error);
      throw error;
    }
  }

  /**
   * Complete successful transaction
   */
  async completeTransaction(transaction) {
    try {
      this.pendingTransactions.delete(transaction.id);
      this.completedTransactions.set(transaction.id, transaction);

      if (transaction.type === 'deposit') {
        // Credit tokens to user account
        const tokenEngine = require('./TokenEngine');
        await tokenEngine.creditTokens(
          transaction.userId,
          transaction.tokenAmount,
          transaction.id,
          `Deposit via ${transaction.provider}`
        );

        logger.info('Deposit completed', {
          transactionId: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          tokenAmount: transaction.tokenAmount
        });
      } else if (transaction.type === 'withdrawal') {
        // Process actual withdrawal to user's destination
        await this.processWithdrawalPayout(transaction);
      }

      // Notify user about completion
      await this.notifyUser(transaction, 'completed');

    } catch (error) {
      logger.error(`Error completing transaction ${transaction.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate payment fees
   */
  calculateFees(amount, provider) {
    const percentageFee = (amount * provider.fees.percentage) / 100;
    const fixedFee = provider.fees.fixed;
    const total = percentageFee + fixedFee;

    return {
      percentage: percentageFee,
      fixed: fixedFee,
      total,
      rate: provider.fees.percentage
    };
  }

  /**
   * Convert fiat amount to tokens
   */
  async convertToTokens(amount, currency) {
    const rate = this.exchangeRates.get(`${currency}/NGRID`) || 1.0;
    return +(amount * rate).toFixed(4);
  }

  /**
   * Convert tokens to fiat amount
   */
  async convertFromTokens(tokenAmount, currency) {
    const rate = this.exchangeRates.get(`NGRID/${currency}`) || 1.0;
    return +(tokenAmount * rate).toFixed(2);
  }

  /**
   * Update exchange rates
   */
  async updateExchangeRates() {
    try {
      // Mock exchange rates - in production use real API
      const rates = {
        'USD/NGRID': 10.0,  // 1 USD = 10 NGRID tokens
        'EUR/NGRID': 9.2,   // 1 EUR = 9.2 NGRID tokens
        'RUB/NGRID': 150.0, // 1 RUB = 150 NGRID tokens
        'GBP/NGRID': 8.5,   // 1 GBP = 8.5 NGRID tokens
        'BTC/NGRID': 300000.0, // 1 BTC = 300,000 NGRID tokens
        'ETH/NGRID': 20000.0  // 1 ETH = 20,000 NGRID tokens
      };

      // Calculate reverse rates
      Object.entries(rates).forEach(([pair, rate]) => {
        const [from, to] = pair.split('/');
        const reversePair = `${to}/${from}`;
        const reverseRate = 1 / rate;
        rates[reversePair] = reverseRate;
      });

      Object.entries(rates).forEach(([pair, rate]) => {
        this.exchangeRates.set(pair, rate);
      });

      logger.debug('Exchange rates updated', { ratesCount: Object.keys(rates).length });
    } catch (error) {
      logger.error('Error updating exchange rates:', error);
    }
  }

  /**
   * Start periodic exchange rate updates
   */
  startExchangeRateUpdates() {
    // Update rates immediately
    this.updateExchangeRates();

    // Update every 5 minutes
    setInterval(() => {
      this.updateExchangeRates();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(provider, payload, signature) {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig?.webhookSecret) return false;

    // Mock signature verification - implement actual verification per provider
    return signature && signature.length > 10;
  }

  /**
   * Parse Stripe webhook
   */
  parseStripeWebhook(payload) {
    // Mock Stripe webhook parsing
    return {
      transactionId: payload.metadata?.transaction_id,
      status: payload.status === 'succeeded' ? 'completed' : 'failed',
      providerTransactionId: payload.id
    };
  }

  /**
   * Parse PayPal webhook
   */
  parsePayPalWebhook(payload) {
    // Mock PayPal webhook parsing
    return {
      transactionId: payload.resource?.custom,
      status: payload.event_type === 'PAYMENT.CAPTURE.COMPLETED' ? 'completed' : 'failed',
      providerTransactionId: payload.resource?.id
    };
  }

  /**
   * Parse crypto webhook
   */
  parseCryptoWebhook(payload) {
    // Mock crypto webhook parsing
    return {
      transactionId: payload.reference,
      status: payload.confirmations >= payload.required_confirmations ? 'completed' : 'pending',
      providerTransactionId: payload.tx_hash
    };
  }

  /**
   * Process withdrawal payout
   */
  async processWithdrawalPayout(transaction) {
    // Mock withdrawal processing - implement actual payout logic
    logger.info('Processing withdrawal payout', {
      transactionId: transaction.id,
      amount: transaction.netAmount,
      destination: transaction.destination
    });
  }

  /**
   * Notify user about transaction status
   */
  async notifyUser(transaction, status) {
    // Integration with notification system
    logger.info(`Notifying user about transaction ${status}`, {
      userId: transaction.userId,
      transactionId: transaction.id,
      status
    });
  }

  /**
   * Get supported payment methods for user
   */
  getSupportedMethods(currency, amount) {
    const methods = [];

    this.providers.forEach((provider, key) => {
      if (!provider.enabled) return;
      if (!provider.currencies.includes(currency)) return;
      if (provider.minAmount && amount < provider.minAmount) return;

      methods.push({
        id: key,
        name: provider.name,
        type: provider.type,
        fees: this.calculateFees(amount, provider),
        processingTime: this.getProcessingTime(key),
        limits: this.getMethodLimits(key)
      });
    });

    return methods.sort((a, b) => a.fees.total - b.fees.total);
  }

  /**
   * Get processing time for payment method
   */
  getProcessingTime(method) {
    const times = {
      stripe: 'Instant',
      paypal: '1-2 minutes',
      crypto: '10-60 minutes',
      bank: '1-3 business days'
    };
    return times[method] || 'Unknown';
  }

  /**
   * Get limits for payment method
   */
  getMethodLimits(method) {
    const limits = {
      stripe: { min: 1, max: 10000, daily: 50000 },
      paypal: { min: 5, max: 5000, daily: 25000 },
      crypto: { min: 10, max: 100000, daily: 500000 },
      bank: { min: 100, max: 1000000, daily: 1000000 }
    };
    return limits[method] || { min: 0, max: 0, daily: 0 };
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(userId, filters = {}) {
    const allTransactions = [
      ...Array.from(this.pendingTransactions.values()),
      ...Array.from(this.completedTransactions.values())
    ];

    return allTransactions
      .filter(tx => tx.userId === userId)
      .filter(tx => !filters.type || tx.type === filters.type)
      .filter(tx => !filters.status || tx.status === filters.status)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, filters.limit || 50);
  }

  /**
   * Get payment statistics
   */
  getPaymentStats() {
    const completed = Array.from(this.completedTransactions.values());
    const pending = Array.from(this.pendingTransactions.values());

    const stats = {
      totalVolume: completed.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      totalFees: completed.reduce((sum, tx) => sum + (tx.fees?.total || 0), 0),
      transactionCount: completed.length,
      pendingCount: pending.length,
      byMethod: {}
    };

    // Group by payment method
    completed.forEach(tx => {
      if (!stats.byMethod[tx.paymentMethod]) {
        stats.byMethod[tx.paymentMethod] = {
          count: 0,
          volume: 0,
          fees: 0
        };
      }
      stats.byMethod[tx.paymentMethod].count++;
      stats.byMethod[tx.paymentMethod].volume += tx.amount || 0;
      stats.byMethod[tx.paymentMethod].fees += tx.fees?.total || 0;
    });

    return stats;
  }

  /**
   * Approve withdrawal request (admin function)
   */
  async approveWithdrawal(transactionId) {
    const transaction = this.pendingTransactions.get(transactionId);
    if (!transaction || transaction.type !== 'withdrawal') {
      throw new Error('Withdrawal request not found');
    }

    transaction.status = 'approved';
    transaction.approvedAt = new Date();

    logger.info('Withdrawal approved', {
      transactionId,
      userId: transaction.userId,
      amount: transaction.netAmount
    });

    // Process the withdrawal
    await this.processWithdrawalPayout(transaction);
    await this.completeTransaction(transaction);

    return transaction;
  }

  /**
   * Initialize the payment gateway
   */
  async initialize() {
    logger.info('Payment Gateway initialized', {
      supportedCurrencies: this.supportedCurrencies,
      enabledProviders: Array.from(this.providers.entries())
        .filter(([_, provider]) => provider.enabled)
        .map(([name, _]) => name)
    });

    return true;
  }
}

module.exports = PaymentGateway;
