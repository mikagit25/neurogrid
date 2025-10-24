const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ConfigValidator {
    constructor() {
        this.requiredVariables = new Map();
        this.optionalVariables = new Map();
        this.validationRules = new Map();
        this.secrets = new Set();
        
        this.setupValidationRules();
    }

    setupValidationRules() {
        // Server Configuration
        this.addRequired('NODE_ENV', 'string', ['development', 'production', 'test']);
        this.addRequired('PORT', 'number', null, { min: 1, max: 65535 });
        this.addRequired('LOG_LEVEL', 'string', ['error', 'warn', 'info', 'debug']);

        // Database Configuration
        this.addRequired('DATABASE_URL', 'string');
        this.addOptional('DB_HOST', 'string', 'localhost');
        this.addOptional('DB_PORT', 'number', 5432, { min: 1, max: 65535 });
        this.addOptional('DB_NAME', 'string', 'neurogrid');
        this.addOptional('DB_USER', 'string', 'neurogrid');
        this.addSecret('DB_PASSWORD', 'string');
        this.addOptional('DB_POOL_MAX', 'number', 20, { min: 1, max: 100 });
        this.addOptional('DB_IDLE_TIMEOUT', 'number', 30000, { min: 1000 });
        this.addOptional('DB_CONNECTION_TIMEOUT', 'number', 2000, { min: 1000 });
        this.addOptional('DB_QUERY_TIMEOUT', 'number', 30000, { min: 1000 });
        this.addOptional('DB_ACQUIRE_TIMEOUT', 'number', 60000, { min: 1000 });

        // Development Database
        this.addOptional('DEV_DATABASE_URL', 'string', 'sqlite:./data/neurogrid.db');

        // Redis Configuration
        this.addOptional('REDIS_HOST', 'string', 'redis');
        this.addOptional('REDIS_PORT', 'number', 6379, { min: 1, max: 65535 });
        this.addSecret('REDIS_PASSWORD', 'string');
        this.addOptional('REDIS_DB', 'number', 0, { min: 0, max: 15 });

        // Authentication Configuration
        this.addSecret('JWT_SECRET', 'string', null, { minLength: 32 });
        this.addOptional('JWT_EXPIRES_IN', 'string', '24h');
        this.addOptional('API_KEY_LENGTH', 'number', 32, { min: 16, max: 128 });

        // Rate Limiting Configuration
        this.addOptional('API_RATE_LIMIT', 'number', 1000, { min: 1 });
        this.addOptional('AUTH_RATE_LIMIT', 'number', 10, { min: 1 });
        this.addOptional('GENERAL_RATE_LIMIT', 'number', 100, { min: 1 });

        // CORS Configuration
        this.addOptional('ALLOWED_ORIGINS', 'string', 'http://localhost:3000,http://localhost:8080');

        // WebSocket Configuration
        this.addOptional('WS_HEARTBEAT_INTERVAL', 'number', 30000, { min: 1000 });
        this.addOptional('WS_MAX_CONNECTIONS', 'number', 1000, { min: 1 });

        // Monitoring Configuration
        this.addOptional('METRICS_ENABLED', 'boolean', true);
        this.addOptional('METRICS_INTERVAL', 'number', 60000, { min: 1000 });
        this.addOptional('ALERT_EMAIL_ENABLED', 'boolean', false);
        this.addOptional('ALERT_EMAIL_FROM', 'string', 'alerts@neurogrid.dev');
        this.addOptional('ALERT_EMAIL_TO', 'string', 'admin@neurogrid.dev');

        // File Upload Configuration
        this.addOptional('MAX_FILE_SIZE', 'string', '100MB');
        this.addOptional('UPLOAD_PATH', 'string', './uploads');

        // Security Configuration
        this.addOptional('BCRYPT_ROUNDS', 'number', 12, { min: 10, max: 15 });
        this.addSecret('SESSION_SECRET', 'string', null, { minLength: 32 });

        // Payment Gateway Configuration
        this.addOptional('PAYMENT_GATEWAY_ENABLED', 'boolean', true);

        // Stripe Configuration
        this.addOptional('STRIPE_ENABLED', 'boolean', true);
        this.addOptional('STRIPE_PUBLISHABLE_KEY', 'string');
        this.addSecret('STRIPE_SECRET_KEY', 'string');
        this.addSecret('STRIPE_WEBHOOK_SECRET', 'string');

        // PayPal Configuration
        this.addOptional('PAYPAL_ENABLED', 'boolean', true);
        this.addOptional('PAYPAL_CLIENT_ID', 'string');
        this.addSecret('PAYPAL_CLIENT_SECRET', 'string');
        this.addOptional('PAYPAL_WEBHOOK_ID', 'string');

        // Cryptocurrency Configuration
        this.addOptional('CRYPTO_ENABLED', 'boolean', true);
        this.addOptional('BITCOIN_NETWORK', 'string', 'testnet', ['mainnet', 'testnet']);
        this.addOptional('ETHEREUM_NETWORK', 'string', 'goerli', ['mainnet', 'goerli', 'sepolia']);
        this.addSecret('CRYPTO_API_KEY', 'string');

        // Bank Transfer Configuration
        this.addOptional('BANK_TRANSFER_ENABLED', 'boolean', true);
        this.addOptional('BANK_SWIFT_CODE', 'string', 'NGRIDUS33');
        this.addOptional('BANK_ACCOUNT_NUMBER', 'string', '1234567890');
        this.addOptional('BANK_ROUTING_NUMBER', 'string', '021000021');

        // Exchange Rate Configuration
        this.addSecret('EXCHANGE_RATE_API_KEY', 'string');
        this.addOptional('EXCHANGE_RATE_UPDATE_INTERVAL', 'number', 300000, { min: 60000 });

        // Token Economics
        this.addOptional('INITIAL_USER_BALANCE', 'number', 10.0, { min: 0 });
        this.addOptional('PLATFORM_FEE_PERCENTAGE', 'number', 20.0, { min: 0, max: 100 });
        this.addOptional('MIN_WITHDRAWAL_AMOUNT', 'number', 10.0, { min: 0 });
        this.addOptional('MAX_WITHDRAWAL_AMOUNT', 'number', 10000.0, { min: 0 });

        // Wallet Configuration
        this.addOptional('WALLET_VERIFICATION_REQUIRED', 'boolean', true);
        this.addOptional('AUTO_CONVERT_ENABLED', 'boolean', false);
        this.addOptional('DEFAULT_CURRENCY', 'string', 'USD', ['USD', 'EUR', 'GBP', 'BTC', 'ETH']);

        // External Services
        this.addOptional('SMTP_HOST', 'string', 'smtp.gmail.com');
        this.addOptional('SMTP_PORT', 'number', 587, { min: 1, max: 65535 });
        this.addOptional('SMTP_USER', 'string');
        this.addSecret('SMTP_PASS', 'string');

        // Development Configuration
        this.addOptional('DEBUG', 'string', 'neurogrid:*');
        this.addOptional('ENABLE_SWAGGER', 'boolean', true);
        this.addOptional('ENABLE_PROFILING', 'boolean', false);
        this.addOptional('MOCK_PAYMENTS', 'boolean', true);
        this.addOptional('SKIP_EMAIL_VERIFICATION', 'boolean', false);
    }

    addRequired(name, type, allowedValues = null, constraints = null) {
        this.requiredVariables.set(name, { type, allowedValues, constraints });
        if (constraints) {
            this.validationRules.set(name, constraints);
        }
    }

    addOptional(name, type, defaultValue = null, constraints = null) {
        this.optionalVariables.set(name, { type, defaultValue, constraints });
        if (constraints) {
            this.validationRules.set(name, constraints);
        }
    }

    addSecret(name, type, defaultValue = null, constraints = null) {
        this.addRequired(name, type, null, constraints);
        this.secrets.add(name);
    }

    validate(config = process.env) {
        const errors = [];
        const warnings = [];
        const validatedConfig = {};

        // Check required variables
        for (const [name, rules] of this.requiredVariables) {
            const value = config[name];
            
            if (!value) {
                errors.push(`Required environment variable ${name} is missing`);
                continue;
            }

            const validatedValue = this.validateValue(name, value, rules);
            if (validatedValue.error) {
                errors.push(`Invalid value for ${name}: ${validatedValue.error}`);
            } else {
                validatedConfig[name] = validatedValue.value;
            }
        }

        // Check optional variables and apply defaults
        for (const [name, rules] of this.optionalVariables) {
            const value = config[name];
            
            if (!value) {
                if (rules.defaultValue !== null) {
                    validatedConfig[name] = rules.defaultValue;
                    if (process.env.NODE_ENV !== 'production') {
                        warnings.push(`Using default value for ${name}: ${rules.defaultValue}`);
                    }
                }
                continue;
            }

            const validatedValue = this.validateValue(name, value, rules);
            if (validatedValue.error) {
                errors.push(`Invalid value for ${name}: ${validatedValue.error}`);
            } else {
                validatedConfig[name] = validatedValue.value;
            }
        }

        // Check for environment-specific requirements
        this.validateEnvironmentSpecific(validatedConfig, errors, warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            config: validatedConfig
        };
    }

    validateValue(name, value, rules) {
        try {
            let convertedValue = value;

            // Type conversion
            switch (rules.type) {
                case 'number':
                    convertedValue = Number(value);
                    if (isNaN(convertedValue)) {
                        return { error: `Expected number, got "${value}"` };
                    }
                    break;
                case 'boolean':
                    convertedValue = value.toLowerCase() === 'true';
                    break;
                case 'string':
                    convertedValue = String(value);
                    break;
            }

            // Allowed values validation
            if (rules.allowedValues && !rules.allowedValues.includes(convertedValue)) {
                return { error: `Must be one of: ${rules.allowedValues.join(', ')}` };
            }

            // Constraints validation
            if (rules.constraints) {
                const constraintError = this.validateConstraints(convertedValue, rules.constraints);
                if (constraintError) {
                    return { error: constraintError };
                }
            }

            return { value: convertedValue };
        } catch (error) {
            return { error: error.message };
        }
    }

    validateConstraints(value, constraints) {
        if (constraints.min !== undefined && value < constraints.min) {
            return `Must be at least ${constraints.min}`;
        }
        if (constraints.max !== undefined && value > constraints.max) {
            return `Must be at most ${constraints.max}`;
        }
        if (constraints.minLength !== undefined && value.length < constraints.minLength) {
            return `Must be at least ${constraints.minLength} characters long`;
        }
        if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
            return `Must be at most ${constraints.maxLength} characters long`;
        }
        return null;
    }

    validateEnvironmentSpecific(config, errors, warnings) {
        // Production-specific validations
        if (config.NODE_ENV === 'production') {
            // Check for weak secrets in production
            const weakSecrets = [];
            for (const secret of this.secrets) {
                const value = config[secret];
                if (value && this.isWeakSecret(value)) {
                    weakSecrets.push(secret);
                }
            }
            if (weakSecrets.length > 0) {
                errors.push(`Weak secrets detected in production: ${weakSecrets.join(', ')}`);
            }

            // Ensure HTTPS in production
            if (config.ALLOWED_ORIGINS && config.ALLOWED_ORIGINS.includes('http://')) {
                warnings.push('HTTP origins detected in production. Consider using HTTPS.');
            }

            // Check database configuration
            if (!config.DATABASE_URL || config.DATABASE_URL.includes('sqlite')) {
                warnings.push('SQLite database detected in production. Consider using PostgreSQL.');
            }
        }

        // Development-specific validations
        if (config.NODE_ENV === 'development') {
            if (!config.ENABLE_SWAGGER) {
                warnings.push('Swagger documentation is disabled in development');
            }
        }
    }

    isWeakSecret(value) {
        const weakPatterns = [
            /^(test|dev|development|prod|production)$/i,
            /^(123|password|secret|admin)$/i,
            /^(.)\1{3,}$/, // Repeated characters
        ];

        return weakPatterns.some(pattern => pattern.test(value)) || value.length < 16;
    }

    generateTemplate() {
        const template = [];
        template.push('# NeuroGrid Coordinator Server Environment Configuration');
        template.push('# Generated by ConfigValidator');
        template.push('');

        const sections = {
            'Server Configuration': ['NODE_ENV', 'PORT', 'LOG_LEVEL'],
            'Database Configuration': ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
            'Development Database': ['DEV_DATABASE_URL'],
            'Redis Configuration': ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_DB'],
            'Authentication': ['JWT_SECRET', 'JWT_EXPIRES_IN', 'API_KEY_LENGTH'],
            'Rate Limiting': ['API_RATE_LIMIT', 'AUTH_RATE_LIMIT', 'GENERAL_RATE_LIMIT'],
            'Security': ['BCRYPT_ROUNDS', 'SESSION_SECRET'],
        };

        for (const [section, vars] of Object.entries(sections)) {
            template.push(`# ${section}`);
            for (const varName of vars) {
                const required = this.requiredVariables.get(varName);
                const optional = this.optionalVariables.get(varName);
                const rules = required || optional;
                
                if (rules) {
                    const isSecret = this.secrets.has(varName);
                    const defaultValue = optional?.defaultValue || (isSecret ? 'CHANGE_ME' : '');
                    const comment = isSecret ? ' # CHANGE IN PRODUCTION' : '';
                    template.push(`${varName}=${defaultValue}${comment}`);
                }
            }
            template.push('');
        }

        return template.join('\n');
    }

    logValidationResults(results) {
        if (results.isValid) {
            logger.info('✅ Configuration validation passed');
            if (results.warnings.length > 0) {
                results.warnings.forEach(warning => logger.warn(`⚠️ ${warning}`));
            }
        } else {
            logger.error('❌ Configuration validation failed');
            results.errors.forEach(error => logger.error(`🔴 ${error}`));
            if (results.warnings.length > 0) {
                results.warnings.forEach(warning => logger.warn(`⚠️ ${warning}`));
            }
        }
    }

    validateAndExit() {
        const results = this.validate();
        this.logValidationResults(results);
        
        if (!results.isValid) {
            process.exit(1);
        }
        
        return results.config;
    }
}

module.exports = new ConfigValidator();