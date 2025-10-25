const path = require('path');
const fs = require('fs');
const configValidator = require('./validator');
const logger = require('../utils/logger');

class ConfigManager {
  constructor() {
    this.config = {};
    this.isLoaded = false;
    this.watchers = new Map();
    this.changeHandlers = [];
  }

  async load(envFile = null) {
    try {
      // Load environment files in order of precedence
      await this.loadEnvironmentFiles(envFile);

      // Validate configuration
      const validation = configValidator.validate();
      configValidator.logValidationResults(validation);

      if (!validation.isValid) {
        throw new Error('Configuration validation failed');
      }

      this.config = validation.config;
      this.isLoaded = true;

      // Set up file watching in development
      if (this.config.NODE_ENV === 'development') {
        this.setupFileWatching();
      }

      logger.info('Configuration loaded successfully');
      return this.config;

    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  async loadEnvironmentFiles(envFile) {
    const envFiles = [
      '.env.defaults',
      '.env',
      `.env.${process.env.NODE_ENV || 'development'}`,
      '.env.local',
      envFile
    ].filter(Boolean);

    for (const file of envFiles) {
      await this.loadEnvFile(file);
    }
  }

  async loadEnvFile(filename) {
    const envPath = path.resolve(process.cwd(), filename);

    if (!fs.existsSync(envPath)) {
      if (filename === '.env') {
        logger.warn(`Environment file ${filename} not found, using process.env only`);
      }
      return;
    }

    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = this.parseEnvContent(envContent);

      // Only set variables that aren't already set (precedence)
      for (const [key, value] of Object.entries(envVars)) {
        if (!process.env.hasOwnProperty(key)) {
          process.env[key] = value;
        }
      }

      logger.debug(`Loaded environment file: ${filename}`);
    } catch (error) {
      logger.error(`Failed to load ${filename}:`, error);
    }
  }

  parseEnvContent(content) {
    const envVars = {};
    const lines = content.split('\n');

    for (let line of lines) {
      line = line.trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) {
        continue;
      }

      const key = line.substring(0, equalIndex).trim();
      let value = line.substring(equalIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Handle multiline values (basic support)
      if (value.includes('\\n')) {
        value = value.replace(/\\n/g, '\n');
      }

      envVars[key] = value;
    }

    return envVars;
  }

  setupFileWatching() {
    const envFiles = ['.env', '.env.development', '.env.local'];

    for (const file of envFiles) {
      const envPath = path.resolve(process.cwd(), file);

      if (fs.existsSync(envPath)) {
        try {
          const watcher = fs.watchFile(envPath, { interval: 1000 }, () => {
            logger.info(`Environment file ${file} changed, reloading...`);
            this.reload();
          });

          this.watchers.set(file, watcher);
        } catch (error) {
          logger.warn(`Failed to watch ${file}:`, error);
        }
      }
    }
  }

  async reload() {
    try {
      const oldConfig = { ...this.config };
      await this.load();

      // Notify change handlers
      for (const handler of this.changeHandlers) {
        try {
          await handler(this.config, oldConfig);
        } catch (error) {
          logger.error('Config change handler failed:', error);
        }
      }

      logger.info('Configuration reloaded successfully');
    } catch (error) {
      logger.error('Failed to reload configuration:', error);
    }
  }

  get(key, defaultValue = undefined) {
    if (!this.isLoaded) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    const value = this.config[key];
    return value !== undefined ? value : defaultValue;
  }

  has(key) {
    return this.isLoaded && this.config.hasOwnProperty(key);
  }

  getAll() {
    if (!this.isLoaded) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return { ...this.config };
  }

  getSecure() {
    if (!this.isLoaded) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    const secureConfig = { ...this.config };
    const secrets = configValidator.secrets;

    // Mask secret values
    for (const secret of secrets) {
      if (secureConfig[secret]) {
        secureConfig[secret] = this.maskSecret(secureConfig[secret]);
      }
    }

    return secureConfig;
  }

  maskSecret(value) {
    if (!value || value.length < 4) {
      return '***';
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  onConfigChange(handler) {
    this.changeHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.changeHandlers.indexOf(handler);
      if (index > -1) {
        this.changeHandlers.splice(index, 1);
      }
    };
  }

  getDatabaseConfig() {
    const config = {
      url: this.get('DATABASE_URL'),
      host: this.get('DB_HOST'),
      port: this.get('DB_PORT'),
      database: this.get('DB_NAME'),
      username: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
      pool: {
        max: this.get('DB_POOL_MAX'),
        min: 0,
        idle: this.get('DB_IDLE_TIMEOUT'),
        acquire: this.get('DB_ACQUIRE_TIMEOUT')
      },
      dialectOptions: {
        connectTimeout: this.get('DB_CONNECTION_TIMEOUT'),
        requestTimeout: this.get('DB_QUERY_TIMEOUT')
      }
    };

    // Use SQLite for development if DATABASE_URL is not PostgreSQL
    if (this.get('NODE_ENV') === 'development' &&
            (!config.url || config.url.includes('sqlite'))) {
      config.url = this.get('DEV_DATABASE_URL', 'sqlite:./data/neurogrid.db');
      config.dialect = 'sqlite';
      config.storage = config.url.replace('sqlite:', '');
    } else {
      config.dialect = 'postgres';
    }

    return config;
  }

  getRedisConfig() {
    return {
      host: this.get('REDIS_HOST'),
      port: this.get('REDIS_PORT'),
      password: this.get('REDIS_PASSWORD'),
      db: this.get('REDIS_DB'),
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    };
  }

  getAuthConfig() {
    return {
      jwtSecret: this.get('JWT_SECRET'),
      jwtExpiresIn: this.get('JWT_EXPIRES_IN'),
      apiKeyLength: this.get('API_KEY_LENGTH'),
      bcryptRounds: this.get('BCRYPT_ROUNDS'),
      sessionSecret: this.get('SESSION_SECRET')
    };
  }

  getRateLimitConfig() {
    return {
      api: this.get('API_RATE_LIMIT'),
      auth: this.get('AUTH_RATE_LIMIT'),
      general: this.get('GENERAL_RATE_LIMIT')
    };
  }

  getCorsConfig() {
    const origins = this.get('ALLOWED_ORIGINS', '');
    return {
      origin: origins.split(',').map(origin => origin.trim()).filter(Boolean),
      credentials: true
    };
  }

  getWebSocketConfig() {
    return {
      heartbeatInterval: this.get('WS_HEARTBEAT_INTERVAL'),
      maxConnections: this.get('WS_MAX_CONNECTIONS')
    };
  }

  getMonitoringConfig() {
    return {
      enabled: this.get('METRICS_ENABLED'),
      interval: this.get('METRICS_INTERVAL'),
      alertEmailEnabled: this.get('ALERT_EMAIL_ENABLED'),
      alertEmailFrom: this.get('ALERT_EMAIL_FROM'),
      alertEmailTo: this.get('ALERT_EMAIL_TO')
    };
  }

  getPaymentConfig() {
    return {
      enabled: this.get('PAYMENT_GATEWAY_ENABLED'),
      stripe: {
        enabled: this.get('STRIPE_ENABLED'),
        publishableKey: this.get('STRIPE_PUBLISHABLE_KEY'),
        secretKey: this.get('STRIPE_SECRET_KEY'),
        webhookSecret: this.get('STRIPE_WEBHOOK_SECRET')
      },
      paypal: {
        enabled: this.get('PAYPAL_ENABLED'),
        clientId: this.get('PAYPAL_CLIENT_ID'),
        clientSecret: this.get('PAYPAL_CLIENT_SECRET'),
        webhookId: this.get('PAYPAL_WEBHOOK_ID')
      },
      crypto: {
        enabled: this.get('CRYPTO_ENABLED'),
        bitcoinNetwork: this.get('BITCOIN_NETWORK'),
        ethereumNetwork: this.get('ETHEREUM_NETWORK'),
        apiKey: this.get('CRYPTO_API_KEY')
      },
      bankTransfer: {
        enabled: this.get('BANK_TRANSFER_ENABLED'),
        swiftCode: this.get('BANK_SWIFT_CODE'),
        accountNumber: this.get('BANK_ACCOUNT_NUMBER'),
        routingNumber: this.get('BANK_ROUTING_NUMBER')
      }
    };
  }

  cleanup() {
    // Stop file watchers
    for (const [file, watcher] of this.watchers) {
      try {
        fs.unwatchFile(path.resolve(process.cwd(), file));
      } catch (error) {
        logger.warn(`Failed to stop watching ${file}:`, error);
      }
    }
    this.watchers.clear();
    this.changeHandlers.length = 0;
  }

  // Static method for quick access
  static async create(envFile = null) {
    const manager = new ConfigManager();
    await manager.load(envFile);
    return manager;
  }
}

module.exports = ConfigManager;
