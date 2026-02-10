/**
 * Advanced Rate Limiting Middleware
 * Implements tier-based rate limiting with Redis store
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

class AdvancedRateLimiter {
    constructor(redisConfig) {
        // Initialize Redis connection with fallback to memory store
        try {
            this.redis = new Redis({
                host: redisConfig?.host || process.env.REDIS_HOST || 'localhost',
                port: redisConfig?.port || process.env.REDIS_PORT || 6379,
                password: redisConfig?.password || process.env.REDIS_PASSWORD,
                db: redisConfig?.db || 0,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true
            });

            this.redis.on('error', (error) => {
                logger.warn('Redis connection error for rate limiter, falling back to memory store', { error });
            });
        } catch (error) {
            logger.warn('Failed to initialize Redis for rate limiting, using memory store', { error });
            this.redis = null;
        }

        this.userTiers = new Map(); // Cache user tier information
        this.initializeLimiters();
    }

    initializeLimiters() {
        // Define rate limits per user tier
        this.tierLimits = {
            free: {
                api: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 min
                tasks: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 AI tasks per 15 min
                auth: { windowMs: 15 * 60 * 1000, max: 5 }    // 5 auth attempts per 15 min
            },
            pro: {
                api: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 min
                tasks: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 AI tasks per 15 min
                auth: { windowMs: 15 * 60 * 1000, max: 20 }    // 20 auth attempts per 15 min
            },
            enterprise: {
                api: { windowMs: 15 * 60 * 1000, max: 10000 }, // 10000 requests per 15 min
                tasks: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 AI tasks per 15 min
                auth: { windowMs: 15 * 60 * 1000, max: 50 }     // 50 auth attempts per 15 min
            }
        };
    }

    /**
     * Get user tier from database or cache
     */
    async getUserTier(userId, email) {
        if (!userId && !email) return 'free';

        // Check cache first
        const cacheKey = userId || email;
        if (this.userTiers.has(cacheKey)) {
            return this.userTiers.get(cacheKey);
        }

        try {
            // In production, this would query your user database
            // For now, return default tier
            const tier = 'free';

            // Cache for 5 minutes
            this.userTiers.set(cacheKey, tier);
            setTimeout(() => this.userTiers.delete(cacheKey), 5 * 60 * 1000);

            return tier;
        } catch (error) {
            logger.error('Failed to get user tier, defaulting to free', { error, userId, email });
            return 'free';
        }
    }

    /**
     * Create rate limiter for specific endpoint type and user tier
     */
    createRateLimiter(type = 'api') {
        const store = this.redis ? new RedisStore({
            client: this.redis,
            prefix: 'rl:',
        }) : undefined;

        return rateLimit({
            store,
            windowMs: 15 * 60 * 1000, // Default 15 minutes
            max: async (req) => {
                // Determine user tier
                const userId = req.user?.id;
                const email = req.user?.email || req.body?.email;
                const userTier = await this.getUserTier(userId, email);

                const limits = this.tierLimits[userTier]?.[type] || this.tierLimits.free[type];
                return limits.max;
            },
            keyGenerator: (req) => {
                // Create unique key per user or IP
                const userId = req.user?.id;
                const ip = req.ip || req.connection.remoteAddress;
                return userId ? `user:${userId}:${type}` : `ip:${ip}:${type}`;
            },
            handler: async (req, res) => {
                const userId = req.user?.id;
                const email = req.user?.email;
                const userTier = await this.getUserTier(userId, email);

                logger.warn('Rate limit exceeded', {
                    userId,
                    email,
                    userTier,
                    type,
                    ip: req.ip,
                    endpoint: req.path
                });

                res.status(429).json({
                    success: false,
                    error: `Rate limit exceeded for ${userTier} tier`,
                    code: 'RATE_LIMIT_EXCEEDED',
                    details: {
                        tier: userTier,
                        type,
                        retryAfter: Math.ceil(this.tierLimits[userTier][type].windowMs / 1000),
                        upgradeInfo: userTier === 'free' ? 'Upgrade to Pro for higher limits' : null
                    }
                });
            },
            standardHeaders: true,
            legacyHeaders: false,
            onLimitReached: (req, res, options) => {
                logger.info('Rate limit warning', {
                    userId: req.user?.id,
                    ip: req.ip,
                    endpoint: req.path,
                    remaining: options.remaining || 0
                });
            }
        });
    }

    /**
     * Middleware for API endpoints (general)
     */
    apiLimiter() {
        return this.createRateLimiter('api');
    }

    /**
     * Middleware for AI task submission
     */
    taskLimiter() {
        return this.createRateLimiter('tasks');
    }

    /**
     * Middleware for authentication endpoints
     */
    authLimiter() {
        return this.createRateLimiter('auth');
    }

    /**
     * Custom limiter with specific configuration
     */
    customLimiter(options) {
        const store = this.redis ? new RedisStore({
            client: this.redis,
            prefix: 'rl:custom:',
        }) : undefined;

        return rateLimit({
            store,
            windowMs: options.windowMs || 15 * 60 * 1000,
            max: options.max || 100,
            keyGenerator: options.keyGenerator || ((req) => req.ip),
            message: options.message || 'Too many requests',
            standardHeaders: true,
            legacyHeaders: false,
            ...options
        });
    }

    /**
     * Get current rate limit status for user
     */
    async getRateLimitStatus(userId, type = 'api') {
        if (!this.redis) {
            return { error: 'Rate limiting not available' };
        }

        try {
            const key = `user:${userId}:${type}`;
            const current = await this.redis.get(`rl:${key}`) || 0;
            const userTier = await this.getUserTier(userId);
            const limit = this.tierLimits[userTier][type].max;

            return {
                current: parseInt(current),
                limit,
                remaining: Math.max(0, limit - current),
                resetTime: Date.now() + this.tierLimits[userTier][type].windowMs
            };
        } catch (error) {
            logger.error('Failed to get rate limit status', { error, userId, type });
            return { error: 'Failed to get rate limit status' };
        }
    }

    /**
     * Reset rate limit for user (admin function)
     */
    async resetRateLimit(userId, type) {
        if (!this.redis) {
            return { error: 'Rate limiting not available' };
        }

        try {
            const key = `rl:user:${userId}:${type}`;
            await this.redis.del(key);

            logger.info('Rate limit reset', { userId, type });
            return { success: true, message: 'Rate limit reset successfully' };
        } catch (error) {
            logger.error('Failed to reset rate limit', { error, userId, type });
            return { error: 'Failed to reset rate limit' };
        }
    }

    /**
     * Get rate limiting statistics
     */
    async getStatistics(timeframe = '1h') {
        if (!this.redis) {
            return { error: 'Statistics not available' };
        }

        try {
            const stats = {
                timeframe,
                totalBlocked: 0,
                byTier: {
                    free: { requests: 0, blocked: 0 },
                    pro: { requests: 0, blocked: 0 },
                    enterprise: { requests: 0, blocked: 0 }
                },
                topBlockedIPs: [],
                topBlockedUsers: []
            };

            // In production, implement actual statistics gathering from Redis
            return stats;
        } catch (error) {
            logger.error('Failed to get rate limiting statistics', { error });
            return { error: 'Failed to get statistics' };
        }
    }

    /**
     * Cleanup expired keys (maintenance function)
     */
    async cleanup() {
        if (this.redis) {
            try {
                const keys = await this.redis.keys('rl:*');
                if (keys.length > 0) {
                    // Redis store should handle expiration automatically
                    logger.debug(`Rate limiter maintenance: ${keys.length} active keys`);
                }
            } catch (error) {
                logger.error('Rate limiter cleanup failed', { error });
            }
        }

        // Clear user tier cache
        this.userTiers.clear();
    }
}

// Export singleton instance
let rateLimiter = null;

function createRateLimiter(redisConfig) {
    if (!rateLimiter) {
        rateLimiter = new AdvancedRateLimiter(redisConfig);
    }
    return rateLimiter;
}

function getRateLimiter() {
    if (!rateLimiter) {
        rateLimiter = new AdvancedRateLimiter();
    }
    return rateLimiter;
}

module.exports = {
    AdvancedRateLimiter,
    createRateLimiter,
    getRateLimiter
};