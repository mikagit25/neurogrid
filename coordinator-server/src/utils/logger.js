const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
    constructor(config) {
        this.config = config;
        this.logDir = path.join(process.cwd(), 'logs');
        
        // Ensure logs directory exists
        this.ensureLogDirectory();
        
        // Create Winston logger instance
        this.logger = this.createLogger();
        
        // Setup log rotation
        this.setupLogRotation();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    createLogger() {
        const logLevel = this.config?.get('LOG_LEVEL') || process.env.LOG_LEVEL || 'info';
        const nodeEnv = this.config?.get('NODE_ENV') || process.env.NODE_ENV || 'development';
        
        // Custom format for structured logging
        const logFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const logEntry = {
                    timestamp,
                    level: level.toUpperCase(),
                    service: 'neurogrid-coordinator',
                    environment: nodeEnv,
                    message,
                    ...this.sanitizeMeta(meta)
                };

                return JSON.stringify(logEntry);
            })
        );

        // Console format for development
        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let logMessage = `${timestamp} [${level}] ${message}`;
                
                if (meta.userId) logMessage += ` [User: ${meta.userId}]`;
                if (meta.ip) logMessage += ` [IP: ${meta.ip}]`;
                if (meta.duration) logMessage += ` [${meta.duration}ms]`;

                const metaKeys = Object.keys(meta).filter(key => 
                    !['userId', 'ip', 'duration', 'level', 'message', 'timestamp'].includes(key)
                );
                
                if (metaKeys.length > 0) {
                    const metaInfo = metaKeys.reduce((acc, key) => {
                        acc[key] = meta[key];
                        return acc;
                    }, {});
                    logMessage += ` ${JSON.stringify(metaInfo)}`;
                }

                return logMessage;
            })
        );

        const transports = [];

        // Console transport
        transports.push(
            new winston.transports.Console({
                level: logLevel,
                format: nodeEnv === 'development' ? consoleFormat : logFormat,
                handleExceptions: true,
                handleRejections: true
            })
        );

        // File transports
        transports.push(
            new winston.transports.File({
                filename: path.join(this.logDir, 'combined.log'),
                level: logLevel,
                format: logFormat,
                maxsize: 50 * 1024 * 1024, // 50MB
                maxFiles: 10,
                tailable: true
            }),
            
            new winston.transports.File({
                filename: path.join(this.logDir, 'error.log'),
                level: 'error',
                format: logFormat,
                maxsize: 50 * 1024 * 1024,
                maxFiles: 5,
                tailable: true
            })
        );

        return winston.createLogger({
            level: logLevel,
            format: logFormat,
            transports,
            exitOnError: false
        });
    }

    setupLogRotation() {
        setInterval(() => {
            this.cleanOldLogs();
        }, 24 * 60 * 60 * 1000); // 24 hours
    }

    cleanOldLogs() {
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();

        try {
            const files = fs.readdirSync(this.logDir);
            
            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    this.info('Old log file cleaned up', { file });
                }
            });
        } catch (error) {
            this.error('Failed to clean old logs', { error: error.message });
        }
    }

    // Sanitize sensitive data from logs
    sanitizeMeta(meta) {
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'auth', 'authorization',
            'cookie', 'session', 'apiKey', 'privateKey', 'publicKey',
            'cardNumber', 'cvv', 'pin', 'ssn', 'bankAccount'
        ];

        const sanitizeValue = (obj) => {
            if (typeof obj !== 'object' || obj === null) {
                return obj;
            }

            if (Array.isArray(obj)) {
                return obj.map(sanitizeValue);
            }

            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                
                if (sensitiveFields.some(field => lowerKey.includes(field))) {
                    result[key] = '[REDACTED]';
                } else if (typeof value === 'object' && value !== null) {
                    result[key] = sanitizeValue(value);
                } else {
                    result[key] = value;
                }
            }
            return result;
        };

        return sanitizeValue(meta);
    }

    // Logging methods
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Specialized logging methods
    security(message, meta = {}) {
        this.logger.warn(message, { ...meta, category: 'security' });
    }

    audit(action, meta = {}) {
        this.logger.info(`Audit: ${action}`, { ...meta, category: 'audit', action });
    }

    performance(operation, duration, meta = {}) {
        this.logger.info(`Performance: ${operation}`, { 
            ...meta, 
            category: 'performance', 
            operation, 
            duration: `${duration}ms` 
        });
    }

    http(method, path, statusCode, duration, meta = {}) {
        const level = statusCode >= 400 ? 'warn' : 'info';
        this.logger[level](`HTTP: ${method} ${path}`, {
            ...meta,
            category: 'http',
            method,
            path,
            statusCode,
            duration: `${duration}ms`
        });
    }

    // Create child logger with context
    child(context) {
        return {
            error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
            warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
            info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
            debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
            security: (message, meta = {}) => this.security(message, { ...context, ...meta }),
            audit: (action, meta = {}) => this.audit(action, { ...context, ...meta }),
            performance: (operation, duration, meta = {}) => this.performance(operation, duration, { ...context, ...meta }),
            http: (method, path, statusCode, duration, meta = {}) => this.http(method, path, statusCode, duration, { ...context, ...meta })
        };
    }
}

// Legacy compatibility - create default logger
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = JSON.stringify(meta, null, 2);
        }
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

// Logger configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'neurogrid-coordinator',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 50 * 1024 * 1024, // 50MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 100 * 1024 * 1024, // 100MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Access log file for HTTP requests
        new winston.transports.File({
            filename: path.join(logsDir, 'access.log'),
            level: 'http',
            maxsize: 50 * 1024 * 1024, // 50MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log')
        })
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log')
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// Stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

module.exports = logger;