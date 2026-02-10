const Joi = require('joi');
const validator = require('validator');
const xss = require('xss');
const logger = require('../utils/logger');

class InputValidator {
  constructor() {
    this.schemas = new Map();
    this.setupSchemas();
  }

  setupSchemas() {
    // User schemas
    this.schemas.set('user.register', Joi.object({
      username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
          'string.alphanum': 'Username must only contain alphanumeric characters',
          'string.min': 'Username must be at least 3 characters long',
          'string.max': 'Username must not exceed 30 characters'
        }),
      email: Joi.string()
        .email()
        .required()
        .custom((value, helpers) => {
          if (!validator.isEmail(value)) {
            return helpers.error('any.invalid');
          }
          return value.toLowerCase();
        })
        .messages({
          'string.email': 'Please provide a valid email address',
          'any.invalid': 'Please provide a valid email address'
        }),
      password: Joi.string()
        .min(8)
        .max(128)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
        .required()
        .messages({
          'string.min': 'Password must be at least 8 characters long',
          'string.max': 'Password must not exceed 128 characters',
          'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        }),
      firstName: Joi.string()
        .trim()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/)
        .required()
        .messages({
          'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
        }),
      lastName: Joi.string()
        .trim()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/)
        .required()
        .messages({
          'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
        })
    }));

    this.schemas.set('user.login', Joi.object({
      email: Joi.string()
        .email()
        .required()
        .custom((value) => value.toLowerCase()),
      password: Joi.string()
        .min(1)
        .max(128)
        .required()
    }));

    this.schemas.set('user.profile', Joi.object({
      firstName: Joi.string()
        .trim()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/),
      lastName: Joi.string()
        .trim()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s\-']+$/),
      bio: Joi.string()
        .max(500)
        .allow(''),
      website: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .allow('')
    }));

    // Task schemas
    this.schemas.set('task.create', Joi.object({
      name: Joi.string()
        .trim()
        .min(1)
        .max(200)
        .required(),
      description: Joi.string()
        .max(2000)
        .allow(''),
      type: Joi.string()
        .valid('computation', 'training', 'inference', 'data_processing')
        .required(),
      priority: Joi.string()
        .valid('low', 'normal', 'high', 'critical')
        .default('normal'),
      resources: Joi.object({
        cpu: Joi.number().min(0.1).max(32).default(1),
        memory: Joi.number().min(128).max(32768).default(512), // MB
        gpu: Joi.number().min(0).max(8).default(0),
        storage: Joi.number().min(1).max(1024).default(10) // GB
      }).default(),
      timeout: Joi.number()
        .min(60)
        .max(86400)
        .default(3600), // seconds
      budget: Joi.number()
        .min(0.01)
        .max(1000)
        .precision(2)
        .required(),
      metadata: Joi.object()
        .pattern(Joi.string(), Joi.alternatives().try(
          Joi.string().max(1000),
          Joi.number(),
          Joi.boolean()
        ))
        .max(20) // Max 20 metadata fields
    }));

    this.schemas.set('task.update', Joi.object({
      name: Joi.string()
        .trim()
        .min(1)
        .max(200),
      description: Joi.string()
        .max(2000)
        .allow(''),
      priority: Joi.string()
        .valid('low', 'normal', 'high', 'critical'),
      timeout: Joi.number()
        .min(60)
        .max(86400),
      budget: Joi.number()
        .min(0.01)
        .max(1000)
        .precision(2)
    }));

    // Node schemas
    this.schemas.set('node.register', Joi.object({
      name: Joi.string()
        .trim()
        .min(1)
        .max(100)
        .required(),
      type: Joi.string()
        .valid('cpu', 'gpu', 'hybrid')
        .required(),
      capabilities: Joi.object({
        cpu_cores: Joi.number().min(1).max(128).required(),
        memory_gb: Joi.number().min(1).max(1024).required(),
        gpu_count: Joi.number().min(0).max(16).default(0),
        gpu_memory_gb: Joi.number().min(0).max(512).default(0),
        storage_gb: Joi.number().min(10).max(10240).required(),
        network_speed: Joi.number().min(1).max(10000).default(100) // Mbps
      }).required(),
      location: Joi.object({
        country: Joi.string().length(2).uppercase(), // ISO country code
        region: Joi.string().max(100),
        city: Joi.string().max(100),
        timezone: Joi.string().max(50)
      }),
      pricing: Joi.object({
        cpu_per_hour: Joi.number().min(0.001).max(10).precision(4).required(),
        memory_per_gb_hour: Joi.number().min(0.0001).max(1).precision(4).required(),
        gpu_per_hour: Joi.number().min(0).max(50).precision(4).default(0),
        storage_per_gb_hour: Joi.number().min(0.00001).max(0.1).precision(6).required()
      }).required()
    }));

    // Payment schemas
    this.schemas.set('payment.create', Joi.object({
      amount: Joi.number()
        .min(0.01)
        .max(10000)
        .precision(2)
        .required(),
      currency: Joi.string()
        .valid('USD', 'EUR', 'GBP', 'BTC', 'ETH')
        .default('USD'),
      method: Joi.string()
        .valid('stripe', 'paypal', 'crypto', 'bank_transfer')
        .required(),
      metadata: Joi.object()
        .pattern(Joi.string(), Joi.alternatives().try(
          Joi.string().max(500),
          Joi.number(),
          Joi.boolean()
        ))
        .max(10)
    }));

    // Wallet schemas
    this.schemas.set('wallet.withdraw', Joi.object({
      amount: Joi.number()
        .min(0.01)
        .max(10000)
        .precision(2)
        .required(),
      currency: Joi.string()
        .valid('USD', 'EUR', 'GBP', 'BTC', 'ETH')
        .required(),
      destination: Joi.alternatives().try(
        Joi.string().email(), // For PayPal
        Joi.string().pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/), // Bitcoin address
        Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/), // Ethereum address
        Joi.string().min(10).max(34) // Bank account/IBAN
      ).required(),
      method: Joi.string()
        .valid('paypal', 'bitcoin', 'ethereum', 'bank_transfer')
        .required()
    }));

    // Query parameter schemas
    this.schemas.set('query.pagination', Joi.object({
      page: Joi.number().integer().min(1).max(1000).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().max(50).default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }));

    this.schemas.set('query.search', Joi.object({
      q: Joi.string().max(200).allow(''),
      category: Joi.string().max(50),
      status: Joi.string().max(50),
      dateFrom: Joi.date().iso(),
      dateTo: Joi.date().iso().min(Joi.ref('dateFrom'))
    }));

    // File upload schemas
    this.schemas.set('file.upload', Joi.object({
      name: Joi.string()
        .trim()
        .min(1)
        .max(255)
        .pattern(/^[a-zA-Z0-9\s\-_\.]+$/)
        .required(),
      size: Joi.number()
        .min(1)
        .max(100 * 1024 * 1024) // 100MB
        .required(),
      type: Joi.string()
        .valid(
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'text/plain', 'text/csv',
          'application/json', 'application/zip',
          'application/x-python-code', 'text/x-python'
        )
        .required()
    }));
  }

  validate(schemaName, data, options = {}) {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const defaultOptions = {
      abortEarly: false,
      stripUnknown: true,
      errors: {
        wrap: {
          label: false
        }
      }
    };

    const validationOptions = { ...defaultOptions, ...options };
    const result = schema.validate(data, validationOptions);

    if (result.error) {
      const errors = result.error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Input validation failed', {
        schema: schemaName,
        errors,
        data: this.sanitizeDataForLogging(data)
      });

      return {
        isValid: false,
        errors,
        data: null
      };
    }

    return {
      isValid: true,
      errors: [],
      data: result.value
    };
  }

  sanitize(data, options = {}) {
    if (typeof data === 'string') {
      return this.sanitizeString(data, options);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item, options));
    }

    if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[this.sanitizeString(key)] = this.sanitize(value, options);
      }
      return sanitized;
    }

    return data;
  }

  sanitizeString(str, options = {}) {
    if (typeof str !== 'string') {
      return str;
    }

    let sanitized = str;

    // XSS protection
    if (options.xss !== false) {
      sanitized = xss(sanitized, {
        whiteList: options.allowedTags || {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      });
    }

    // HTML entity encoding
    if (options.htmlEncode) {
      sanitized = validator.escape(sanitized);
    }

    // SQL injection basic protection (additional to parameterized queries)
    if (options.sql !== false) {
      sanitized = sanitized.replace(/[';\\-]/g, '');
    }

    // Trim whitespace
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Normalize unicode
    if (options.normalize) {
      sanitized = sanitized.normalize('NFC');
    }

    return sanitized;
  }

  sanitizeDataForLogging(data) {
    const sensitive = ['password', 'token', 'secret', 'key', 'auth'];

    if (typeof data === 'string') {
      return '[REDACTED]';
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeDataForLogging(item));
    }

    if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        const isSensitive = sensitive.some(s =>
          key.toLowerCase().includes(s.toLowerCase())
        );

        sanitized[key] = isSensitive ? '[REDACTED]' : this.sanitizeDataForLogging(value);
      }
      return sanitized;
    }

    return data;
  }

  validateEmail(email) {
    return validator.isEmail(email) && email.length <= 254;
  }

  validatePassword(password) {
    return password.length >= 8 &&
               password.length <= 128 &&
               /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/.test(password);
  }

  validateUrl(url) {
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false
    });
  }

  validateIPAddress(ip) {
    return validator.isIP(ip, 4) || validator.isIP(ip, 6);
  }

  validateJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  // Middleware factory
  createValidationMiddleware(schemaName, source = 'body') {
    return (req, res, next) => {
      const data = source === 'query' ? req.query :
        source === 'params' ? req.params : req.body;

      const result = this.validate(schemaName, data);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      // Replace original data with validated/sanitized data
      if (source === 'query') {
        req.query = result.data;
      } else if (source === 'params') {
        req.params = result.data;
      } else {
        req.body = result.data;
      }

      next();
    };
  }

  // File validation middleware
  validateFileUpload(allowedTypes = [], maxSize = 10 * 1024 * 1024) {
    return (req, res, next) => {
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files || [req.file];

      for (const file of files) {
        // Check file size
        if (file.size > maxSize) {
          return res.status(400).json({
            success: false,
            error: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`
          });
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: `File type ${file.mimetype} is not allowed`
          });
        }

        // Validate filename
        if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(file.originalname)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filename format'
          });
        }
      }

      next();
    };
  }
}

/**
 * Express middleware for validating required request fields
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Function} Express middleware function
 */
function validateRequest(requiredFields) {
  return (req, res, next) => {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!req.body[field] && req.body[field] !== 0 && req.body[field] !== false) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }
    
    next();
  };
}

const validatorInstance = new InputValidator();

module.exports = {
  validator: validatorInstance,
  validateRequest
};
