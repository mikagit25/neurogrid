/**
 * API Response Standardization Middleware
 * Provides consistent response format across all endpoints
 */

const logger = require('../utils/logger');

/**
 * Standard API Response Structure
 */
class APIResponse {
  constructor(success, data = null, error = null, meta = {}) {
    this.success = success;
    this.timestamp = new Date().toISOString();
    this.version = process.env.API_VERSION || '1.0.0';

    if (success) {
      this.data = data;
      if (Object.keys(meta).length > 0) {
        this.meta = meta;
      }
    } else {
      this.error = {
        code: error?.code || 'UNKNOWN_ERROR',
        message: error?.message || 'An unknown error occurred',
        details: error?.details || null,
        ...(error?.validation && { validation: error.validation })
      };
    }
  }
}

/**
 * Standard Error Types
 */
const ErrorTypes = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    message: 'Validation failed'
  },
  AUTHENTICATION_ERROR: {
    code: 'AUTHENTICATION_ERROR',
    status: 401,
    message: 'Authentication required'
  },
  AUTHORIZATION_ERROR: {
    code: 'AUTHORIZATION_ERROR',
    status: 403,
    message: 'Insufficient permissions'
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    message: 'Resource not found'
  },
  CONFLICT: {
    code: 'CONFLICT',
    status: 409,
    message: 'Resource conflict'
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    message: 'Rate limit exceeded'
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: 'Internal server error'
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
    message: 'Service temporarily unavailable'
  }
};

/**
 * Response Helper Functions
 */
class ResponseHelper {

  /**
   * Send successful response
   */
  static success(res, data = null, meta = {}, status = 200) {
    const response = new APIResponse(true, data, null, meta);

    logger.info('API Success Response', {
      service: 'neurogrid-coordinator',
      version: response.version,
      endpoint: res.req.originalUrl,
      method: res.req.method,
      status,
      responseTime: Date.now() - res.req.startTime,
      ...(data && typeof data === 'object' && { dataKeys: Object.keys(data) })
    });

    return res.status(status).json(response);
  }

  /**
   * Send error response
   */
  static error(res, errorType, customMessage = null, details = null, validation = null, status = null) {
    const error = {
      code: errorType.code,
      message: customMessage || errorType.message,
      ...(details && { details }),
      ...(validation && { validation })
    };

    const response = new APIResponse(false, null, error);
    const statusCode = status || errorType.status || 500;

    logger.error('API Error Response', {
      service: 'neurogrid-coordinator',
      version: response.version,
      endpoint: res.req.originalUrl,
      method: res.req.method,
      status: statusCode,
      errorCode: error.code,
      errorMessage: error.message,
      responseTime: Date.now() - res.req.startTime,
      ...(details && { errorDetails: details })
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(res, validationErrors, customMessage = null) {
    return this.error(res, ErrorTypes.VALIDATION_ERROR, customMessage, null, validationErrors);
  }

  /**
   * Send not found response
   */
  static notFound(res, resource = 'Resource', customMessage = null) {
    const message = customMessage || `${resource} not found`;
    return this.error(res, ErrorTypes.NOT_FOUND, message);
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(res, customMessage = null) {
    return this.error(res, ErrorTypes.AUTHENTICATION_ERROR, customMessage);
  }

  /**
   * Send forbidden response
   */
  static forbidden(res, customMessage = null) {
    return this.error(res, ErrorTypes.AUTHORIZATION_ERROR, customMessage);
  }

  /**
   * Send conflict response
   */
  static conflict(res, customMessage = null, details = null) {
    return this.error(res, ErrorTypes.CONFLICT, customMessage, details);
  }

  /**
   * Send rate limit response
   */
  static rateLimitExceeded(res, retryAfter = null) {
    const response = this.error(res, ErrorTypes.RATE_LIMIT_EXCEEDED);
    if (retryAfter) {
      res.set('Retry-After', retryAfter);
    }
    return response;
  }

  /**
   * Send internal server error response
   */
  static internalError(res, customMessage = null, details = null) {
    return this.error(res, ErrorTypes.INTERNAL_ERROR, customMessage, details);
  }

  /**
   * Send service unavailable response
   */
  static serviceUnavailable(res, customMessage = null, retryAfter = null) {
    const response = this.error(res, ErrorTypes.SERVICE_UNAVAILABLE, customMessage);
    if (retryAfter) {
      res.set('Retry-After', retryAfter);
    }
    return response;
  }

  /**
   * Send paginated response
   */
  static paginated(res, data, pagination, status = 200) {
    const meta = {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      }
    };

    return this.success(res, data, meta, status);
  }

  /**
   * Send response with custom meta information
   */
  static withMeta(res, data, meta, status = 200) {
    return this.success(res, data, meta, status);
  }
}

/**
 * Request Timing Middleware
 * Adds request start time for response time calculation
 */
const requestTiming = (req, res, next) => {
  req.startTime = Date.now();
  next();
};

/**
 * Global Error Handler Middleware
 * Catches unhandled errors and formats them consistently
 */
const globalErrorHandler = (err, req, res, next) => {
  // Log the full error for debugging
  logger.error('Unhandled API Error', {
    service: 'neurogrid-coordinator',
    version: process.env.API_VERSION || '1.0.0',
    endpoint: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: err.stack,
    userId: req.user?.id,
    requestId: req.id
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return ResponseHelper.validationError(res, err.errors, err.message);
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return ResponseHelper.unauthorized(res, err.message);
  }

  if (err.name === 'ForbiddenError' || err.status === 403) {
    return ResponseHelper.forbidden(res, err.message);
  }

  if (err.name === 'NotFoundError' || err.status === 404) {
    return ResponseHelper.notFound(res, 'Resource', err.message);
  }

  if (err.name === 'ConflictError' || err.status === 409) {
    return ResponseHelper.conflict(res, err.message);
  }

  if (err.name === 'TooManyRequestsError' || err.status === 429) {
    return ResponseHelper.rateLimitExceeded(res, err.retryAfter);
  }

  // Default to internal server error
  return ResponseHelper.internalError(res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : null
  );
};

/**
 * Response Headers Middleware
 * Adds standard security and API headers
 */
const responseHeaders = (req, res, next) => {
  // Security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  // API headers
  res.set({
    'X-API-Version': process.env.API_VERSION || '1.0.0',
    'X-Service': 'neurogrid-coordinator',
    'X-Request-ID': req.id || 'unknown'
  });

  // CORS headers (if needed)
  if (process.env.CORS_ENABLED === 'true') {
    res.set({
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    });
  }

  next();
};

/**
 * Request Validation Helper
 */
class ValidationHelper {

  /**
   * Validate required fields
   */
  static validateRequired(data, requiredFields, customMessages = {}) {
    const errors = {};

    requiredFields.forEach(field => {
      if (!data || data[field] === undefined || data[field] === null || data[field] === '') {
        errors[field] = customMessages[field] || `${field} is required`;
      }
    });

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Validate field types
   */
  static validateTypes(data, typeValidations) {
    const errors = {};

    Object.entries(typeValidations).forEach(([field, expectedType]) => {
      if (data[field] !== undefined) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          errors[field] = `${field} must be of type ${expectedType}, got ${actualType}`;
        }
      }
    });

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Validate field formats using regex
   */
  static validateFormats(data, formatValidations) {
    const errors = {};

    Object.entries(formatValidations).forEach(([field, { pattern, message }]) => {
      if (data[field] !== undefined && !pattern.test(data[field])) {
        errors[field] = message || `${field} has invalid format`;
      }
    });

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Combine multiple validation results
   */
  static combineValidations(...validationResults) {
    const combinedErrors = {};

    validationResults.forEach(result => {
      if (result) {
        Object.assign(combinedErrors, result);
      }
    });

    return Object.keys(combinedErrors).length > 0 ? combinedErrors : null;
  }
}

/**
 * API Health Check Helper
 */
class HealthCheckHelper {

  /**
   * Standard health check response
   */
  static getHealthStatus() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      service: 'neurogrid-coordinator',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };
  }

  /**
   * Detailed health check with service dependencies
   */
  static async getDetailedHealthStatus(serviceChecks = {}) {
    const baseStatus = this.getHealthStatus();
    const services = {};
    let overallStatus = 'healthy';

    // Check individual services
    for (const [serviceName, checkFunction] of Object.entries(serviceChecks)) {
      try {
        const serviceStatus = await checkFunction();
        services[serviceName] = {
          status: 'healthy',
          ...serviceStatus
        };
      } catch (error) {
        services[serviceName] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        overallStatus = 'degraded';
      }
    }

    return {
      ...baseStatus,
      status: overallStatus,
      services
    };
  }
}

module.exports = {
  APIResponse,
  ErrorTypes,
  ResponseHelper,
  ValidationHelper,
  HealthCheckHelper,
  requestTiming,
  globalErrorHandler,
  responseHeaders
};
