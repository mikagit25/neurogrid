/**
 * Validation Middleware - Input validation and sanitization
 */

const validator = require('validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class ValidationMiddleware {
    constructor() {
        // Rate limiting configurations
        this.rateLimits = {
            auth: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 5, // 5 attempts per window
                message: {
                    success: false,
                    error: 'Too many authentication attempts, please try again later'
                },
                standardHeaders: true,
                legacyHeaders: false
            }),
            
            api: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minute
                max: 100, // 100 requests per minute
                message: {
                    success: false,
                    error: 'Rate limit exceeded, please slow down'
                }
            }),
            
            strict: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minute
                max: 10, // 10 requests per minute for sensitive operations
                message: {
                    success: false,
                    error: 'Rate limit exceeded for sensitive operation'
                }
            })
        };
    }

    // Helmet security headers
    helmet = helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "ws:", "wss:"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false
    });

    // Input validation middleware
    validateInput = (schema) => {
        return (req, res, next) => {
            try {
                const errors = [];

                // Validate request body
                if (schema.body) {
                    const bodyErrors = this.validateObject(req.body, schema.body, 'body');
                    errors.push(...bodyErrors);
                }

                // Validate query parameters
                if (schema.query) {
                    const queryErrors = this.validateObject(req.query, schema.query, 'query');
                    errors.push(...queryErrors);
                }

                // Validate path parameters
                if (schema.params) {
                    const paramsErrors = this.validateObject(req.params, schema.params, 'params');
                    errors.push(...paramsErrors);
                }

                if (errors.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Validation failed',
                        details: errors
                    });
                }

                next();

            } catch (error) {
                console.error('Validation middleware error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Validation service error'
                });
            }
        };
    };

    // Validate object against schema
    validateObject(obj, schema, context) {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = obj[field];

            // Check required fields
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push({
                    field: `${context}.${field}`,
                    message: 'This field is required',
                    code: 'REQUIRED'
                });
                continue;
            }

            // Skip validation if field is not present and not required
            if (value === undefined || value === null) {
                continue;
            }

            // Type validation
            if (rules.type) {
                const typeError = this.validateType(value, rules.type, `${context}.${field}`);
                if (typeError) {
                    errors.push(typeError);
                    continue;
                }
            }

            // Length validation
            if (rules.minLength && value.length < rules.minLength) {
                errors.push({
                    field: `${context}.${field}`,
                    message: `Minimum length is ${rules.minLength}`,
                    code: 'MIN_LENGTH'
                });
            }

            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push({
                    field: `${context}.${field}`,
                    message: `Maximum length is ${rules.maxLength}`,
                    code: 'MAX_LENGTH'
                });
            }

            // Format validation
            if (rules.format) {
                const formatError = this.validateFormat(value, rules.format, `${context}.${field}`);
                if (formatError) {
                    errors.push(formatError);
                }
            }

            // Range validation for numbers
            if (rules.min !== undefined && value < rules.min) {
                errors.push({
                    field: `${context}.${field}`,
                    message: `Minimum value is ${rules.min}`,
                    code: 'MIN_VALUE'
                });
            }

            if (rules.max !== undefined && value > rules.max) {
                errors.push({
                    field: `${context}.${field}`,
                    message: `Maximum value is ${rules.max}`,
                    code: 'MAX_VALUE'
                });
            }

            // Enum validation
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push({
                    field: `${context}.${field}`,
                    message: `Value must be one of: ${rules.enum.join(', ')}`,
                    code: 'ENUM'
                });
            }

            // Custom validation
            if (rules.custom && typeof rules.custom === 'function') {
                const customError = rules.custom(value, obj);
                if (customError) {
                    errors.push({
                        field: `${context}.${field}`,
                        message: customError,
                        code: 'CUSTOM'
                    });
                }
            }
        }

        return errors;
    }

    validateType(value, expectedType, field) {
        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') {
                    return {
                        field,
                        message: 'Must be a string',
                        code: 'TYPE_STRING'
                    };
                }
                break;

            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    return {
                        field,
                        message: 'Must be a number',
                        code: 'TYPE_NUMBER'
                    };
                }
                break;

            case 'integer':
                if (!Number.isInteger(Number(value))) {
                    return {
                        field,
                        message: 'Must be an integer',
                        code: 'TYPE_INTEGER'
                    };
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    return {
                        field,
                        message: 'Must be a boolean',
                        code: 'TYPE_BOOLEAN'
                    };
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    return {
                        field,
                        message: 'Must be an array',
                        code: 'TYPE_ARRAY'
                    };
                }
                break;

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value)) {
                    return {
                        field,
                        message: 'Must be an object',
                        code: 'TYPE_OBJECT'
                    };
                }
                break;
        }

        return null;
    }

    validateFormat(value, format, field) {
        switch (format) {
            case 'email':
                if (!validator.isEmail(value)) {
                    return {
                        field,
                        message: 'Must be a valid email address',
                        code: 'FORMAT_EMAIL'
                    };
                }
                break;

            case 'url':
                if (!validator.isURL(value)) {
                    return {
                        field,
                        message: 'Must be a valid URL',
                        code: 'FORMAT_URL'
                    };
                }
                break;

            case 'uuid':
                if (!validator.isUUID(value)) {
                    return {
                        field,
                        message: 'Must be a valid UUID',
                        code: 'FORMAT_UUID'
                    };
                }
                break;

            case 'alphanumeric':
                if (!validator.isAlphanumeric(value)) {
                    return {
                        field,
                        message: 'Must contain only letters and numbers',
                        code: 'FORMAT_ALPHANUMERIC'
                    };
                }
                break;

            case 'password':
                // Password strength validation
                if (value.length < 8) {
                    return {
                        field,
                        message: 'Password must be at least 8 characters long',
                        code: 'PASSWORD_LENGTH'
                    };
                }
                if (!/(?=.*[a-z])/.test(value)) {
                    return {
                        field,
                        message: 'Password must contain at least one lowercase letter',
                        code: 'PASSWORD_LOWERCASE'
                    };
                }
                if (!/(?=.*[A-Z])/.test(value)) {
                    return {
                        field,
                        message: 'Password must contain at least one uppercase letter',
                        code: 'PASSWORD_UPPERCASE'
                    };
                }
                if (!/(?=.*\d)/.test(value)) {
                    return {
                        field,
                        message: 'Password must contain at least one number',
                        code: 'PASSWORD_NUMBER'
                    };
                }
                break;
        }

        return null;
    }

    // Sanitize input
    sanitizeInput = (req, res, next) => {
        try {
            // Sanitize body
            if (req.body) {
                req.body = this.sanitizeObject(req.body);
            }

            // Sanitize query
            if (req.query) {
                req.query = this.sanitizeObject(req.query);
            }

            next();

        } catch (error) {
            console.error('Sanitization error:', error);
            return res.status(500).json({
                success: false,
                error: 'Input sanitization error'
            });
        }
    };

    sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // HTML escape
                sanitized[key] = validator.escape(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    // Get rate limiting middleware
    getRateLimit(type = 'api') {
        return this.rateLimits[type] || this.rateLimits.api;
    }
}

// Export singleton instance
const validationMiddleware = new ValidationMiddleware();

module.exports = {
    helmet: validationMiddleware.helmet,
    validateInput: validationMiddleware.validateInput,
    sanitizeInput: validationMiddleware.sanitizeInput,
    getRateLimit: validationMiddleware.getRateLimit.bind(validationMiddleware)
};