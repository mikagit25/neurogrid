const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Advanced Rate Limiting Service for NeuroGrid
 *
 * Features:
 * - Multiple rate limiting algorithms (Token Bucket, Sliding Window, Fixed Window)
 * - Redis-based distributed rate limiting
 * - User-based and IP-based limits
 * - Dynamic rate adjustment based on load
 * - Tiered rate limits by subscription plan
 * - Burst handling and penalty systems
 * - Analytics and monitoring
 * - Whitelist/blacklist support
 */
class AdvancedRateLimiter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.redisClient = options.redisClient || null;
    this.algorithms = {
      TOKEN_BUCKET: 'token_bucket',
      SLIDING_WINDOW: 'sliding_window',
      FIXED_WINDOW: 'fixed_window'
    };

    // Default configurations for different limit types
    this.defaultConfigs = {
      api: {
        algorithm: this.algorithms.SLIDING_WINDOW,
        windowMs: 60 * 1000, // 1 minute
        max: 100,
        keyGenerator: (req) => `api:${req.ip}`,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        enablePenalty: true,
        penaltyMultiplier: 2
      },

      auth: {
        algorithm: this.algorithms.TOKEN_BUCKET,
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        keyGenerator: (req) => `auth:${req.ip}`,
        skipSuccessfulRequests: true,
        enablePenalty: true,
        penaltyMultiplier: 3,
        penaltyDuration: 60 * 60 * 1000 // 1 hour penalty
      },

      bruteForce: {
        algorithm: this.algorithms.FIXED_WINDOW,
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3,
        keyGenerator: (req) => `brute:${req.body?.email || req.ip}`,
        skipSuccessfulRequests: true,
        enablePenalty: true,
        penaltyMultiplier: 5,
        penaltyDuration: 24 * 60 * 60 * 1000 // 24 hour penalty
      },

      upload: {
        algorithm: this.algorithms.TOKEN_BUCKET,
        windowMs: 60 * 1000, // 1 minute
        max: 10,
        keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
        skipSuccessfulRequests: false,
        burstAllowance: 5
      },

      premium: {
        algorithm: this.algorithms.SLIDING_WINDOW,
        windowMs: 60 * 1000,
        max: 1000, // 10x higher limit for premium users
        keyGenerator: (req) => `premium:${req.user?.id}`,
        skipSuccessfulRequests: false
      }
    };

    // User tier configurations
    this.tierLimits = {
      free: {
        api: 100,
        upload: 5,
        compute: 10
      },
      starter: {
        api: 500,
        upload: 20,
        compute: 50
      },
      professional: {
        api: 2000,
        upload: 100,
        compute: 200
      },
      enterprise: {
        api: 10000,
        upload: 500,
        compute: 1000
      }
    };

    // Whitelist and blacklist
    this.whitelist = new Set();
    this.blacklist = new Set();

    // Statistics
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      penalizedRequests: 0,
      whitelistHits: 0,
      blacklistHits: 0,
      algorithmStats: {
        [this.algorithms.TOKEN_BUCKET]: { requests: 0, blocks: 0 },
        [this.algorithms.SLIDING_WINDOW]: { requests: 0, blocks: 0 },
        [this.algorithms.FIXED_WINDOW]: { requests: 0, blocks: 0 }
      },
      startTime: new Date()
    };

    // Dynamic adjustment settings
    this.dynamicAdjustment = {
      enabled: options.enableDynamicAdjustment || false,
      loadThreshold: 0.8, // Reduce limits when load > 80%
      recoveryThreshold: 0.5, // Restore limits when load < 50%
      adjustmentFactor: 0.7, // Reduce limits to 70% during high load
      checkInterval: 30 * 1000 // Check every 30 seconds
    };

    if (this.dynamicAdjustment.enabled) {
      this.startDynamicAdjustment();
    }

    logger.info('Advanced Rate Limiter initialized', {
      redis: !!this.redisClient,
      dynamicAdjustment: this.dynamicAdjustment.enabled,
      algorithms: Object.keys(this.algorithms).length
    });
  }

  /**
   * Create rate limiter middleware
   */
  createLimiter(type = 'api', customConfig = {}) {
    const config = { ...this.defaultConfigs[type], ...customConfig };

    return async (req, res, next) => {
      try {
        this.stats.totalRequests++;
        this.stats.algorithmStats[config.algorithm].requests++;

        // Check blacklist first
        const clientId = this.getClientId(req);
        if (this.blacklist.has(clientId)) {
          this.stats.blacklistHits++;
          return this.sendRateLimitResponse(res, {
            blocked: true,
            reason: 'blacklisted',
            retryAfter: null
          });
        }

        // Check whitelist
        if (this.whitelist.has(clientId)) {
          this.stats.whitelistHits++;
          return next();
        }

        // Generate rate limit key
        const key = config.keyGenerator(req);

        // Get user tier limits if user is authenticated
        const userTier = req.user?.subscription?.tier || 'free';
        const tierMultiplier = this.getTierMultiplier(userTier, type);
        const adjustedMax = Math.floor(config.max * tierMultiplier);

        // Apply dynamic adjustment if enabled
        const finalMax = this.applyDynamicAdjustment(adjustedMax);

        // Check rate limit based on algorithm
        const result = await this.checkRateLimit(key, {
          ...config,
          max: finalMax
        });

        if (result.blocked) {
          this.stats.blockedRequests++;
          this.stats.algorithmStats[config.algorithm].blocks++;

          // Apply penalty if enabled
          if (config.enablePenalty) {
            await this.applyPenalty(key, config);
          }

          this.emit('rateLimited', {
            key,
            config,
            result,
            req: {
              ip: req.ip,
              method: req.method,
              url: req.originalUrl,
              userAgent: req.get('User-Agent')
            }
          });

          return this.sendRateLimitResponse(res, result);
        }

        // Add rate limit headers
        this.addRateLimitHeaders(res, result);

        // Continue to next middleware
        next();

      } catch (error) {
        logger.error('Rate limiter error', {
          error: error.message,
          type,
          ip: req.ip
        });

        // Fail open - allow request if there's an error
        next();
      }
    };
  }

  /**
   * Check rate limit using specified algorithm
   */
  async checkRateLimit(key, config) {
    switch (config.algorithm) {
    case this.algorithms.TOKEN_BUCKET:
      return await this.tokenBucketCheck(key, config);
    case this.algorithms.SLIDING_WINDOW:
      return await this.slidingWindowCheck(key, config);
    case this.algorithms.FIXED_WINDOW:
      return await this.fixedWindowCheck(key, config);
    default:
      throw new Error(`Unknown algorithm: ${config.algorithm}`);
    }
  }

  /**
   * Token Bucket Algorithm
   */
  async tokenBucketCheck(key, config) {
    const now = Date.now();
    const bucketKey = `bucket:${key}`;

    if (this.redisClient) {
      // Redis-based implementation
      const lua = `
        local bucket_key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local refill_period = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        local burst_allowance = tonumber(ARGV[5]) or 0
        
        local bucket = redis.call('HMGET', bucket_key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or capacity
        local last_refill = tonumber(bucket[2]) or now
        
        -- Calculate tokens to add
        local time_passed = now - last_refill
        local tokens_to_add = math.floor(time_passed / refill_period) * refill_rate
        tokens = math.min(capacity + burst_allowance, tokens + tokens_to_add)
        
        local result = {}
        if tokens >= 1 then
          tokens = tokens - 1
          result.blocked = false
          result.tokens = tokens
        else
          result.blocked = true
          result.tokens = tokens
        end
        
        -- Update bucket
        redis.call('HMSET', bucket_key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', bucket_key, math.ceil(refill_period * capacity / 1000))
        
        result.capacity = capacity
        result.reset_time = now + refill_period
        
        return cjson.encode(result)
      `;

      const refillRate = 1;
      const refillPeriod = config.windowMs / config.max;
      const burstAllowance = config.burstAllowance || 0;

      const resultStr = await this.redisClient.eval(lua, 1, bucketKey,
        config.max, refillRate, refillPeriod, now, burstAllowance);

      return JSON.parse(resultStr);

    } else {
      // In-memory fallback (not recommended for production)
      if (!this.buckets) this.buckets = new Map();

      const bucket = this.buckets.get(key) || {
        tokens: config.max,
        lastRefill: now
      };

      // Refill tokens
      const timePassed = now - bucket.lastRefill;
      const refillPeriod = config.windowMs / config.max;
      const tokensToAdd = Math.floor(timePassed / refillPeriod);

      bucket.tokens = Math.min(config.max, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;

      let blocked = false;
      if (bucket.tokens >= 1) {
        bucket.tokens--;
      } else {
        blocked = true;
      }

      this.buckets.set(key, bucket);

      return {
        blocked,
        tokens: bucket.tokens,
        capacity: config.max,
        resetTime: now + refillPeriod
      };
    }
  }

  /**
   * Sliding Window Algorithm
   */
  async slidingWindowCheck(key, config) {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const windowKey = `sliding:${key}`;

    if (this.redisClient) {
      const lua = `
        local window_key = KEYS[1]
        local window_start = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        local max_requests = tonumber(ARGV[3])
        local window_ms = tonumber(ARGV[4])
        
        -- Remove old entries
        redis.call('ZREMRANGEBYSCORE', window_key, 0, window_start)
        
        -- Count current requests
        local current_count = redis.call('ZCARD', window_key)
        
        local result = {}
        if current_count < max_requests then
          -- Add current request
          redis.call('ZADD', window_key, now, now .. ':' .. math.random())
          redis.call('EXPIRE', window_key, math.ceil(window_ms / 1000))
          result.blocked = false
          result.count = current_count + 1
        else
          result.blocked = true
          result.count = current_count
        end
        
        result.limit = max_requests
        result.reset_time = now + window_ms
        result.retry_after = math.ceil(window_ms / 1000)
        
        return cjson.encode(result)
      `;

      const resultStr = await this.redisClient.eval(lua, 1, windowKey,
        windowStart, now, config.max, config.windowMs);

      return JSON.parse(resultStr);

    } else {
      // In-memory fallback
      if (!this.windows) this.windows = new Map();

      let window = this.windows.get(key) || [];

      // Remove old entries
      window = window.filter(timestamp => timestamp > windowStart);

      const blocked = window.length >= config.max;

      if (!blocked) {
        window.push(now);
      }

      this.windows.set(key, window);

      return {
        blocked,
        count: window.length,
        limit: config.max,
        resetTime: now + config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000)
      };
    }
  }

  /**
   * Fixed Window Algorithm
   */
  async fixedWindowCheck(key, config) {
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const windowKey = `fixed:${key}:${windowStart}`;

    if (this.redisClient) {
      const lua = `
        local window_key = KEYS[1]
        local max_requests = tonumber(ARGV[1])
        local window_ms = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local window_start = tonumber(ARGV[4])
        
        local current_count = tonumber(redis.call('GET', window_key)) or 0
        
        local result = {}
        if current_count < max_requests then
          redis.call('INCR', window_key)
          redis.call('EXPIRE', window_key, math.ceil(window_ms / 1000))
          result.blocked = false
          result.count = current_count + 1
        else
          result.blocked = true
          result.count = current_count
        end
        
        result.limit = max_requests
        result.reset_time = window_start + window_ms
        result.retry_after = math.ceil((window_start + window_ms - now) / 1000)
        
        return cjson.encode(result)
      `;

      const resultStr = await this.redisClient.eval(lua, 1, windowKey,
        config.max, config.windowMs, now, windowStart);

      return JSON.parse(resultStr);

    } else {
      // In-memory fallback
      if (!this.fixedWindows) this.fixedWindows = new Map();

      const count = this.fixedWindows.get(windowKey) || 0;
      const blocked = count >= config.max;

      if (!blocked) {
        this.fixedWindows.set(windowKey, count + 1);
      }

      return {
        blocked,
        count: blocked ? count : count + 1,
        limit: config.max,
        resetTime: windowStart + config.windowMs,
        retryAfter: Math.ceil((windowStart + config.windowMs - now) / 1000)
      };
    }
  }

  /**
   * Apply penalty for rate limit violations
   */
  async applyPenalty(key, config) {
    if (!config.enablePenalty) return;

    const penaltyKey = `penalty:${key}`;
    const penaltyDuration = config.penaltyDuration || config.windowMs * config.penaltyMultiplier;

    if (this.redisClient) {
      await this.redisClient.setex(penaltyKey, Math.ceil(penaltyDuration / 1000), '1');
    } else {
      if (!this.penalties) this.penalties = new Map();
      this.penalties.set(penaltyKey, Date.now() + penaltyDuration);
    }

    this.stats.penalizedRequests++;

    logger.warn('Rate limit penalty applied', {
      key,
      duration: penaltyDuration,
      multiplier: config.penaltyMultiplier
    });
  }

  /**
   * Get user tier multiplier
   */
  getTierMultiplier(tier, limitType) {
    const tierLimits = this.tierLimits[tier];
    if (!tierLimits) return 1;

    const baseLimits = this.tierLimits.free;
    const tierLimit = tierLimits[limitType] || tierLimits.api;
    const baseLimit = baseLimits[limitType] || baseLimits.api;

    return tierLimit / baseLimit;
  }

  /**
   * Apply dynamic adjustment based on system load
   */
  applyDynamicAdjustment(limit) {
    if (!this.dynamicAdjustment.enabled) return limit;

    // This would typically get real system load metrics
    const currentLoad = this.getCurrentSystemLoad();

    if (currentLoad > this.dynamicAdjustment.loadThreshold) {
      return Math.floor(limit * this.dynamicAdjustment.adjustmentFactor);
    }

    return limit;
  }

  /**
   * Get current system load (mock implementation)
   */
  getCurrentSystemLoad() {
    // In production, this would check actual system metrics
    const recentBlocks = this.stats.blockedRequests;
    const recentTotal = this.stats.totalRequests;

    if (recentTotal === 0) return 0;
    return recentBlocks / recentTotal;
  }

  /**
   * Start dynamic adjustment monitoring
   */
  startDynamicAdjustment() {
    setInterval(() => {
      const load = this.getCurrentSystemLoad();

      this.emit('loadCheck', {
        load,
        threshold: this.dynamicAdjustment.loadThreshold,
        adjustmentActive: load > this.dynamicAdjustment.loadThreshold
      });

      if (load > this.dynamicAdjustment.loadThreshold) {
        logger.info('High load detected, reducing rate limits', { load });
      }
    }, this.dynamicAdjustment.checkInterval);
  }

  /**
   * Get client ID for identification
   */
  getClientId(req) {
    return req.user?.id || req.ip || 'unknown';
  }

  /**
   * Add rate limit headers to response
   */
  addRateLimitHeaders(res, result) {
    res.set({
      'X-RateLimit-Limit': result.limit || result.capacity,
      'X-RateLimit-Remaining': result.tokens || (result.limit - result.count),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });
  }

  /**
   * Send rate limit exceeded response
   */
  sendRateLimitResponse(res, result) {
    const status = 429;

    res.status(status).json({
      success: false,
      error: 'Rate limit exceeded',
      message: result.reason === 'blacklisted'
        ? 'Your IP has been blacklisted'
        : 'Too many requests, please try again later',
      details: {
        limit: result.limit,
        remaining: 0,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      }
    });
  }

  /**
   * Add IP to whitelist
   */
  addToWhitelist(identifier) {
    this.whitelist.add(identifier);
    logger.info('Added to whitelist', { identifier });
  }

  /**
   * Remove from whitelist
   */
  removeFromWhitelist(identifier) {
    this.whitelist.delete(identifier);
    logger.info('Removed from whitelist', { identifier });
  }

  /**
   * Add IP to blacklist
   */
  addToBlacklist(identifier, reason = 'Manual') {
    this.blacklist.add(identifier);
    logger.warn('Added to blacklist', { identifier, reason });

    this.emit('blacklisted', { identifier, reason });
  }

  /**
   * Remove from blacklist
   */
  removeFromBlacklist(identifier) {
    this.blacklist.delete(identifier);
    logger.info('Removed from blacklist', { identifier });
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const requestRate = this.stats.totalRequests / (uptime / 1000);
    const blockRate = this.stats.blockedRequests / (uptime / 1000);

    return {
      ...this.stats,
      uptime,
      requestRate: Math.round(requestRate * 100) / 100,
      blockRate: Math.round(blockRate * 100) / 100,
      blockPercentage: this.stats.totalRequests > 0
        ? Math.round((this.stats.blockedRequests / this.stats.totalRequests) * 10000) / 100
        : 0,
      whitelistSize: this.whitelist.size,
      blacklistSize: this.blacklist.size,
      dynamicAdjustmentEnabled: this.dynamicAdjustment.enabled,
      currentLoad: this.getCurrentSystemLoad()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      penalizedRequests: 0,
      whitelistHits: 0,
      blacklistHits: 0,
      algorithmStats: {
        [this.algorithms.TOKEN_BUCKET]: { requests: 0, blocks: 0 },
        [this.algorithms.SLIDING_WINDOW]: { requests: 0, blocks: 0 },
        [this.algorithms.FIXED_WINDOW]: { requests: 0, blocks: 0 }
      },
      startTime: new Date()
    };

    logger.info('Rate limiter statistics reset');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Advanced Rate Limiter...');

    // Clear any intervals
    if (this.dynamicAdjustmentInterval) {
      clearInterval(this.dynamicAdjustmentInterval);
    }

    // Close Redis connection if we own it
    if (this.redisClient && this.redisClient.disconnect) {
      await this.redisClient.disconnect();
    }

    logger.info('Advanced Rate Limiter shutdown complete');
  }
}

module.exports = AdvancedRateLimiter;
