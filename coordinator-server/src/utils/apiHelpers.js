// API Response standardization utilities
const logger = require('./logger');

class ApiResponse {
    constructor(success, data = null, message = null, meta = {}) {
        this.success = success;
        this.timestamp = new Date().toISOString();
        
        if (data !== null) {
            this.data = data;
        }
        
        if (message) {
            this.message = message;
        }
        
        // Add metadata like pagination, request info, etc.
        if (Object.keys(meta).length > 0) {
            Object.assign(this, meta);
        }
    }

    static success(data = null, message = null, meta = {}) {
        return new ApiResponse(true, data, message, meta);
    }

    static error(error, code = null, details = null) {
        const response = new ApiResponse(false);
        response.error = typeof error === 'string' ? error : error.message;
        
        if (code) {
            response.code = code;
        }
        
        if (details) {
            response.details = details;
        }
        
        return response;
    }

    static paginated(data, pagination, message = null) {
        return new ApiResponse(true, data, message, { pagination });
    }

    static created(data, message = 'Resource created successfully') {
        return new ApiResponse(true, data, message);
    }

    static updated(data, message = 'Resource updated successfully') {
        return new ApiResponse(true, data, message);
    }

    static deleted(message = 'Resource deleted successfully') {
        return new ApiResponse(true, null, message);
    }
}

// HTTP Status codes
const StatusCodes = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

// Error codes
const ErrorCodes = {
    // Authentication & Authorization
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    
    // Resources
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    
    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    
    // System
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

// Response middleware
const responseHandler = (req, res, next) => {
    // Success response helper
    res.success = (data = null, message = null, statusCode = StatusCodes.OK) => {
        const response = ApiResponse.success(data, message);
        return res.status(statusCode).json(response);
    };

    // Error response helper
    res.error = (error, statusCode = StatusCodes.INTERNAL_SERVER_ERROR, code = null, details = null) => {
        const response = ApiResponse.error(error, code, details);
        
        // Log error
        logger.error('API Error Response', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode,
            error: response.error,
            code: response.code,
            userId: req.user?.id
        });
        
        return res.status(statusCode).json(response);
    };

    // Paginated response helper
    res.paginated = (data, pagination, message = null, statusCode = StatusCodes.OK) => {
        const response = ApiResponse.paginated(data, pagination, message);
        return res.status(statusCode).json(response);
    };

    // Created response helper
    res.created = (data, message = null) => {
        const response = ApiResponse.created(data, message);
        return res.status(StatusCodes.CREATED).json(response);
    };

    // Updated response helper
    res.updated = (data, message = null) => {
        const response = ApiResponse.updated(data, message);
        return res.status(StatusCodes.OK).json(response);
    };

    // Deleted response helper
    res.deleted = (message = null) => {
        const response = ApiResponse.deleted(message);
        return res.status(StatusCodes.OK).json(response);
    };

    // No content response helper
    res.noContent = () => {
        return res.status(StatusCodes.NO_CONTENT).send();
    };

    next();
};

// Async error handler wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Validation error formatter
const formatValidationError = (errors) => {
    return errors.map(error => ({
        field: error.param || error.path,
        message: error.msg || error.message,
        value: error.value,
        location: error.location
    }));
};

// Pagination helper
const getPagination = (req, defaultLimit = 20, maxLimit = 100) => {
    const limit = Math.min(
        parseInt(req.query.limit) || defaultLimit,
        maxLimit
    );
    const offset = parseInt(req.query.offset) || 0;
    const page = Math.floor(offset / limit) + 1;

    return {
        limit,
        offset,
        page
    };
};

const buildPaginationMeta = (total, limit, offset) => {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasNext = offset + limit < total;
    const hasPrev = offset > 0;

    return {
        total,
        limit,
        offset,
        page: currentPage,
        totalPages,
        hasNext,
        hasPrev,
        nextOffset: hasNext ? offset + limit : null,
        prevOffset: hasPrev ? Math.max(0, offset - limit) : null
    };
};

// Query helper
const parseQuery = (req) => {
    const {
        sort,
        order = 'asc',
        search,
        filter,
        fields,
        ...pagination
    } = req.query;

    return {
        sort: sort || 'createdAt',
        order: ['asc', 'desc'].includes(order?.toLowerCase()) ? order.toLowerCase() : 'asc',
        search: search?.trim(),
        filter: filter ? JSON.parse(filter) : {},
        fields: fields ? fields.split(',').map(f => f.trim()) : null,
        pagination: getPagination({ query: pagination })
    };
};

// Health check helper
const healthCheck = {
    status: 'healthy',
    timestamp: null,
    services: {},
    
    setServiceStatus(serviceName, status, details = {}) {
        this.services[serviceName] = {
            status,
            lastCheck: new Date().toISOString(),
            ...details
        };
        
        // Update overall status
        const hasUnhealthy = Object.values(this.services).some(
            service => service.status === 'unhealthy'
        );
        this.status = hasUnhealthy ? 'unhealthy' : 'healthy';
        this.timestamp = new Date().toISOString();
    },
    
    getStatus() {
        return {
            status: this.status,
            timestamp: this.timestamp,
            services: this.services,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0'
        };
    }
};

// Request context helper
const requestContext = (req, res, next) => {
    // Add useful context to request
    req.context = {
        requestId: req.requestId,
        userId: req.user?.id,
        userRole: req.user?.role,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };

    next();
};

// Performance monitoring
const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.json to capture response time
    const originalJson = res.json;
    res.json = function(data) {
        const duration = Date.now() - startTime;
        
        // Add performance headers
        res.set('X-Response-Time', `${duration}ms`);
        
        // Log slow requests
        if (duration > 1000) {
            logger.warn('Slow request detected', {
                requestId: req.requestId,
                method: req.method,
                path: req.path,
                duration,
                userId: req.user?.id
            });
        }
        
        return originalJson.call(this, data);
    };

    next();
};

// Content-Type validator
const validateContentType = (expectedTypes = ['application/json']) => {
    return (req, res, next) => {
        if (!req.is(expectedTypes)) {
            return res.status(StatusCodes.BAD_REQUEST).json(
                ApiResponse.error(
                    `Content-Type must be one of: ${expectedTypes.join(', ')}`,
                    ErrorCodes.INVALID_FORMAT
                )
            );
        }
        next();
    };
};

// API versioning helper
const apiVersion = (version) => {
    return (req, res, next) => {
        req.apiVersion = version;
        res.set('API-Version', version);
        next();
    };
};

// Cache control helper
const cacheControl = (maxAge = 0, options = {}) => {
    return (req, res, next) => {
        const {
            public: isPublic = false,
            private: isPrivate = true,
            noCache = false,
            noStore = false,
            mustRevalidate = false
        } = options;

        let cacheHeader = [];
        
        if (noCache) cacheHeader.push('no-cache');
        if (noStore) cacheHeader.push('no-store');
        if (mustRevalidate) cacheHeader.push('must-revalidate');
        if (isPublic) cacheHeader.push('public');
        if (isPrivate) cacheHeader.push('private');
        if (maxAge > 0) cacheHeader.push(`max-age=${maxAge}`);

        res.set('Cache-Control', cacheHeader.join(', '));
        next();
    };
};

module.exports = {
    ApiResponse,
    StatusCodes,
    ErrorCodes,
    responseHandler,
    asyncHandler,
    formatValidationError,
    getPagination,
    buildPaginationMeta,
    parseQuery,
    healthCheck,
    requestContext,
    performanceMonitor,
    validateContentType,
    apiVersion,
    cacheControl
};