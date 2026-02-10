/**
 * NeuroGrid Structured Logging System
 * 
 * Provides comprehensive logging with structured output,
 * multiple transports, and performance monitoring.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log levels with colors
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
        return `${info.timestamp} [${info.level}]: ${info.message}`;
    }),
);

// Custom format for file output  
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    
    transports: [
        // Console transport for development
        new winston.transports.Console({
            level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
            format: consoleFormat,
        }),
        
        // File transport for errors
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // Separate file for HTTP requests
        new winston.transports.File({
            filename: path.join(logsDir, 'http.log'),
            level: 'http',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 3,
        }),
    ],
    
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: fileFormat,
        }),
    ],
    
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: fileFormat,
        }),
    ],
});

// HTTP Request logging middleware
const httpLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent') || '',
            ip: req.ip || req.connection.remoteAddress,
            contentLength: res.get('Content-Length') || '0',
        };
        
        logger.http('HTTP Request', logData);
    });
    
    next();
};

// AI Task logging helper
const logAITask = (task, model, duration, status, error = null) => {
    const logData = {
        taskId: task.id || 'unknown',
        taskType: task.type,
        model: model,
        duration: `${duration}ms`,
        status: status,
        inputLength: task.input ? task.input.length : 0,
        timestamp: new Date().toISOString(),
    };
    
    if (error) {
        logData.error = error.message;
        logger.error('AI Task Failed', logData);
    } else {
        logger.info('AI Task Completed', logData);
    }
};

// Performance monitoring logger
const logPerformance = (operation, metadata = {}) => {
    logger.info('Performance Metric', {
        operation,
        timestamp: new Date().toISOString(),
        ...metadata,
    });
};

// WebSocket connection logger
const logWebSocket = (event, connectionId, metadata = {}) => {
    logger.http('WebSocket Event', {
        event,
        connectionId,
        timestamp: new Date().toISOString(),
        ...metadata,
    });
};

module.exports = {
    logger,
    httpLogger,
    logAITask,
    logPerformance,
    logWebSocket,
    
    // Convenience methods
    error: (message, meta = {}) => logger.error(message, meta),
    warn: (message, meta = {}) => logger.warn(message, meta),
    info: (message, meta = {}) => logger.info(message, meta),
    http: (message, meta = {}) => logger.http(message, meta),
    debug: (message, meta = {}) => logger.debug(message, meta),
};