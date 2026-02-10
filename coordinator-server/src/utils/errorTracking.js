/**
 * Error Tracking Integration with Sentry
 * Provides comprehensive error monitoring and performance tracking
 */

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const logger = require('./logger');

class ErrorTrackingService {
  constructor() {
    this.initialized = false;
    this.sentryDsn = process.env.SENTRY_DSN;
    this.environment = process.env.NODE_ENV || 'development';
    this.release = process.env.npm_package_version || '1.0.0';
  }

  /**
   * Initialize Sentry with enhanced configuration
   */
  initialize() {
    if (!this.sentryDsn) {
      logger.warn('Sentry DSN not configured, error tracking disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: this.sentryDsn,
        environment: this.environment,
        release: `neurogrid@${this.release}`,
        
        // Performance monitoring
        tracesSampleRate: this.environment === 'production' ? 0.1 : 1.0,
        profilesSampleRate: this.environment === 'production' ? 0.1 : 1.0,
        
        // Enhanced integrations
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: null }),
          new Sentry.Integrations.Postgres(),
          new Sentry.Integrations.Redis(),
          new ProfilingIntegration(),
        ],
        
        // Enhanced event processing
        beforeSend: (event, hint) => {
          // Filter out non-critical errors in production
          if (this.environment === 'production') {
            // Skip certain error types
            const error = hint.originalException;
            if (error && error.code === 'ECONNRESET') {
              return null;
            }
          }
          
          // Add additional context
          if (event.request) {
            event.tags = {
              ...event.tags,
              user_agent: event.request.headers?.['user-agent'],
              ip_address: event.request.headers?.['x-forwarded-for'] || event.request.ip
            };
          }
          
          return event;
        },
        
        // Enhanced breadcrumb processing
        beforeBreadcrumb: (breadcrumb) => {
          // Filter sensitive data from breadcrumbs
          if (breadcrumb.category === 'http') {
            const data = breadcrumb.data;
            if (data && data.url) {
              // Remove query parameters that might contain sensitive data
              data.url = data.url.split('?')[0];
            }
          }
          
          return breadcrumb;
        }
      });
      
      this.initialized = true;
      logger.info('Sentry error tracking initialized', {
        environment: this.environment,
        release: this.release
      });
      
    } catch (error) {
      logger.error('Failed to initialize Sentry:', error);
    }
  }

  /**
   * Capture exception with enhanced context
   */
  captureException(error, context = {}) {
    if (!this.initialized) {
      logger.error('Error tracking not initialized:', error);
      return null;
    }
    
    return Sentry.withScope((scope) => {
      // Set user context
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          email: context.user.email,
          role: context.user.role
        });
      }
      
      // Set additional context
      if (context.request) {
        scope.setContext('request', {
          method: context.request.method,
          url: context.request.url,
          headers: this.sanitizeHeaders(context.request.headers)
        });
      }
      
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }
      
      if (context.tags) {
        Object.keys(context.tags).forEach(key => {
          scope.setTag(key, context.tags[key]);
        });
      }
      
      // Set severity level
      scope.setLevel(context.level || 'error');
      
      return Sentry.captureException(error);
    });
  }

  /**
   * Capture custom message
   */
  captureMessage(message, level = 'info', context = {}) {
    if (!this.initialized) {
      logger[level](message, context);
      return null;
    }
    
    return Sentry.withScope((scope) => {
      scope.setLevel(level);
      
      if (context.user) {
        scope.setUser(context.user);
      }
      
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }
      
      return Sentry.captureMessage(message);
    });
  }

  /**
   * Start transaction for performance monitoring
   */
  startTransaction(name, operation = 'http.server') {
    if (!this.initialized) {
      return null;
    }
    
    return Sentry.startTransaction({
      name,
      op: operation
    });
  }

  /**
   * Express middleware for request tracking
   */
  requestHandler() {
    if (!this.initialized) {
      return (req, res, next) => next();
    }
    
    return Sentry.Handlers.requestHandler({
      user: ['id', 'email', 'role'],
      request: ['method', 'url', 'headers'],
      serverName: false
    });
  }

  /**
   * Express error handler
   */
  errorHandler() {
    if (!this.initialized) {
      return (error, req, res, next) => {
        logger.error('Unhandled error:', error);
        next(error);
      };
    }
    
    return Sentry.Handlers.errorHandler({
      shouldHandleError: (error) => {
        // Only handle errors that should be reported to Sentry
        return error.status >= 500 || !error.status;
      }
    });
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message, category = 'custom', level = 'info', data = {}) {
    if (!this.initialized) {
      return;
    }
    
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data: this.sanitizeData(data)
    });
  }

  /**
   * Sanitize data to remove sensitive information
   */
  sanitizeData(data) {
    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'key'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Set user context globally
   */
  setUserContext(user) {
    if (!this.initialized) {
      return;
    }
    
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username
    });
  }

  /**
   * Clear user context
   */
  clearUserContext() {
    if (!this.initialized) {
      return;
    }
    
    Sentry.setUser(null);
  }

  /**
   * Close Sentry and flush remaining events
   */
  async close() {
    if (!this.initialized) {
      return;
    }
    
    try {
      await Sentry.close(2000); // Wait 2 seconds for events to flush
      logger.info('Sentry connection closed');
    } catch (error) {
      logger.error('Error closing Sentry:', error);
    }
  }
}

module.exports = new ErrorTrackingService();