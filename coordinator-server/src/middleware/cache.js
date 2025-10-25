const logger = require('../utils/logger');

class CacheMiddleware {
  constructor(cacheService) {
    this.cache = cacheService;
  }

  // API response caching middleware
  cacheResponse(ttl = 300, keyGenerator = null) {
    return async (req, res, next) => {
      // Skip caching for non-GET requests or if disabled
      if (req.method !== 'GET' || !this.cache.enabled) {
        return next();
      }

      try {
        // Generate cache key
        const cacheKey = keyGenerator
          ? keyGenerator(req)
          : this.generateCacheKey(req);

        // Try to get cached response
        const cachedResponse = await this.cache.getCachedApiResponse(
          req.method,
          req.path,
          req.query
        );

        if (cachedResponse) {
          logger.debug('Cache hit for API response', {
            path: req.path,
            key: cacheKey
          });

          // Set cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'Cache-Control': `public, max-age=${ttl}`
          });

          return res.json(cachedResponse);
        }

        // Cache miss - continue to route handler
        logger.debug('Cache miss for API response', {
          path: req.path,
          key: cacheKey
        });

        // Override res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          // Cache successful responses only
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.cache.cacheApiResponse(
              req.method,
              req.path,
              req.query,
              data,
              ttl
            ).catch(error => {
              logger.error('Failed to cache API response', {
                error: error.message,
                path: req.path
              });
            });

            // Set cache headers
            res.set({
              'X-Cache': 'MISS',
              'X-Cache-Key': cacheKey,
              'Cache-Control': `public, max-age=${ttl}`
            });
          }

          return originalJson(data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error', {
          error: error.message,
          path: req.path
        });
        next();
      }
    };
  }

  // Database query caching middleware
  cacheDbQuery(ttl = 600) {
    return (query, params = []) => {
      return async (executor) => {
        try {
          // Try to get cached result
          const cachedResult = await this.cache.getCachedDbQuery(query, params);

          if (cachedResult !== null) {
            logger.debug('Database query cache hit', {
              query: query.substring(0, 50) + '...'
            });
            return cachedResult;
          }

          // Cache miss - execute query
          logger.debug('Database query cache miss', {
            query: query.substring(0, 50) + '...'
          });

          const result = await executor();

          // Cache the result
          if (result !== null && result !== undefined) {
            await this.cache.cacheDbQuery(query, params, result, ttl);
          }

          return result;
        } catch (error) {
          logger.error('Database query cache error', { error: error.message });
          // Fallback to direct execution
          return await executor();
        }
      };
    };
  }

  // Session management middleware
  sessionCache() {
    return async (req, res, next) => {
      // Skip if no session ID
      const sessionId = req.sessionID || req.session?.id;
      if (!sessionId) {
        return next();
      }

      try {
        // Try to get session from cache
        const cachedSession = await this.cache.getSession(sessionId);

        if (cachedSession) {
          req.session = { ...req.session, ...cachedSession };
          logger.debug('Session cache hit', { sessionId });
        }

        // Override session save to update cache
        if (req.session && req.session.save) {
          const originalSave = req.session.save.bind(req.session);
          req.session.save = async (callback) => {
            try {
              await originalSave();
              await this.cache.setSession(sessionId, req.session);
              if (callback) callback();
            } catch (error) {
              if (callback) callback(error);
            }
          };
        }

        next();
      } catch (error) {
        logger.error('Session cache middleware error', {
          error: error.message,
          sessionId
        });
        next();
      }
    };
  }

  // Rate limiting with Redis
  rateLimit(options = {}) {
    const {
      windowMs = 60000,      // 1 minute
      max = 100,             // 100 requests per window
      keyGenerator = null,   // Custom key generator
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return async (req, res, next) => {
      try {
        // Generate rate limit key
        const key = keyGenerator
          ? keyGenerator(req)
          : this.generateRateLimitKey(req);

        const window = Math.floor(Date.now() / windowMs);
        const identifier = `${key}:${window}`;

        // Check current count
        const { count, ttl } = await this.cache.incrementRateLimit(
          identifier,
          window,
          Math.ceil(windowMs / 1000)
        );

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - count),
          'X-RateLimit-Reset': new Date(Date.now() + ttl * 1000).toISOString(),
          'X-RateLimit-Used': count
        });

        // Check if rate limit exceeded
        if (count > max) {
          logger.warn('Rate limit exceeded', {
            key,
            count,
            max,
            ip: req.ip
          });

          return res.status(429).json({
            error: 'rate_limit_exceeded',
            message: 'Too many requests, please try again later',
            retryAfter: ttl
          });
        }

        // Skip counting for certain responses if configured
        const originalSend = res.send.bind(res);
        res.send = (data) => {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Decrement counter
            this.cache.redis.getClient().decr(identifier).catch(() => {});
          }

          return originalSend(data);
        };

        next();
      } catch (error) {
        logger.error('Rate limit middleware error', {
          error: error.message,
          ip: req.ip
        });
        next();
      }
    };
  }

  // Authentication caching middleware
  authCache() {
    return async (req, res, next) => {
      const token = this.extractToken(req);
      if (!token) {
        return next();
      }

      try {
        // Generate token hash for caching
        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Try to get cached auth data
        const cachedAuth = await this.cache.getCachedAuthToken(tokenHash);

        if (cachedAuth) {
          req.user = cachedAuth.user;
          req.auth = cachedAuth;
          logger.debug('Auth cache hit', { userId: cachedAuth.user?.id });
          return next();
        }

        // Cache miss - continue to auth verification
        logger.debug('Auth cache miss', { tokenHash: tokenHash.substring(0, 8) });

        // Override req.login or similar to cache successful auth
        const originalNext = next;
        next = (error) => {
          if (!error && req.user) {
            // Cache successful authentication
            this.cache.cacheAuthToken(tokenHash, {
              user: req.user,
              permissions: req.permissions,
              timestamp: Date.now()
            }, 3600).catch(err => {
              logger.error('Failed to cache auth token', { error: err.message });
            });
          }
          originalNext(error);
        };

        next();
      } catch (error) {
        logger.error('Auth cache middleware error', { error: error.message });
        next();
      }
    };
  }

  // Cache invalidation middleware
  invalidateCache(patterns = []) {
    return async (req, res, next) => {
      // Store patterns for post-response invalidation
      req.cacheInvalidationPatterns = patterns;

      // Override response methods to trigger invalidation after successful operations
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        const result = originalJson(data);

        // Invalidate cache after successful modification operations
        if (res.statusCode >= 200 && res.statusCode < 300 &&
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {

          this.invalidatePatterns(req.cacheInvalidationPatterns, req).catch(error => {
            logger.error('Cache invalidation failed', { error: error.message });
          });
        }

        return result;
      };

      next();
    };
  }

  // Helper methods
  generateCacheKey(req) {
    const keyParts = [
      req.method,
      req.path,
      JSON.stringify(req.query),
      req.user?.id || 'anonymous'
    ];

    return keyParts.join(':');
  }

  generateRateLimitKey(req) {
    return req.ip || 'unknown';
  }

  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check API key header
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      return apiKey;
    }

    // Check session cookie
    if (req.session && req.session.token) {
      return req.session.token;
    }

    return null;
  }

  async invalidatePatterns(patterns, req) {
    if (!patterns || patterns.length === 0) return;

    let totalInvalidated = 0;

    for (const pattern of patterns) {
      try {
        // Replace placeholders in pattern
        const resolvedPattern = this.resolvePattern(pattern, req);
        const count = await this.cache.redis.invalidatePattern(resolvedPattern);
        totalInvalidated += count;

        logger.debug('Invalidated cache pattern', {
          pattern: resolvedPattern,
          count
        });
      } catch (error) {
        logger.error('Pattern invalidation failed', {
          pattern,
          error: error.message
        });
      }
    }

    if (totalInvalidated > 0) {
      logger.info('Cache invalidation completed', {
        patterns: patterns.length,
        invalidated: totalInvalidated
      });
    }
  }

  resolvePattern(pattern, req) {
    return pattern
      .replace('{userId}', req.user?.id || '*')
      .replace('{nodeId}', req.params?.nodeId || req.params?.id || '*')
      .replace('{taskId}', req.params?.taskId || req.params?.id || '*');
  }

  // Utility function to create cache-aware database methods
  wrapDbMethod(dbMethod, ttl = 600) {
    return async (query, params = []) => {
      const cacheWrapper = this.cacheDbQuery(ttl);
      return await cacheWrapper(query, params)(() => dbMethod(query, params));
    };
  }
}

module.exports = CacheMiddleware;
