const Redis = require('redis');
const logger = require('../utils/logger');

class RedisConfig {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  async initialize() {
    try {
      logger.info('Initializing Redis connection...');

      const redisConfig = {
        socket: {
          host: this.config.get('REDIS_HOST', 'localhost'),
          port: this.config.get('REDIS_PORT', 6379),
          connectTimeout: 10000,
          commandTimeout: 5000
        },
        password: this.config.get('REDIS_PASSWORD', null),
        database: this.config.get('REDIS_DB', 0)
      };

      // Add URL-based connection if provided
      const redisUrl = this.config.get('REDIS_URL');
      if (redisUrl) {
        logger.info('Using Redis URL connection');
        this.client = Redis.createClient({
          url: redisUrl
        });
      } else {
        logger.info('Using Redis host/port connection', {
          host: redisConfig.socket.host,
          port: redisConfig.socket.port,
          database: redisConfig.database
        });
        this.client = Redis.createClient(redisConfig);
      }

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to Redis
      await this.client.connect();

      // Test connection
      await this.client.ping();
      
      // Create publisher and subscriber clients for pub/sub
      this.publisher = this.client.duplicate();
      this.subscriber = this.client.duplicate();
      
      await this.publisher.connect();
      await this.subscriber.connect();

      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('Redis connection established successfully');

      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Redis connection', {
        error: error.message,
        retryCount: this.retryCount
      });
      
      this.isConnected = false;
      throw error;
    }
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
      this.retryCount = 0;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.warn('Redis client connection ended');
      this.isConnected = false;
    });
  }

  async disconnect() {
    try {
      if (this.client && this.client.isOpen) {
        await this.client.quit();
        logger.info('Redis client disconnected');
      }
      
      if (this.publisher && this.publisher.isOpen) {
        await this.publisher.quit();
        logger.info('Redis publisher disconnected');
      }
      
      if (this.subscriber && this.subscriber.isOpen) {
        await this.subscriber.quit();
        logger.info('Redis subscriber disconnected');
      }
      
      this.isConnected = false;
    } catch (error) {
      logger.error('Error disconnecting from Redis', { error: error.message });
    }
  }

  getClient() {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  // Utility methods for common operations
  async get(key, defaultValue = null) {
    try {
      if (!this.isConnected) return defaultValue;
      
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      logger.error('Redis GET error', { key, error: error.message });
      return defaultValue;
    }
  }

  async set(key, value, ttl = null) {
    try {
      if (!this.isConnected) return false;
      
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error: error.message });
      return false;
    }
  }

  // Hash operations
  async hget(hash, field) {
    try {
      if (!this.isConnected) return null;
      
      const value = await this.client.hGet(hash, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis HGET error', { hash, field, error: error.message });
      return null;
    }
  }

  async hset(hash, field, value) {
    try {
      if (!this.isConnected) return false;
      
      const serialized = JSON.stringify(value);
      const result = await this.client.hSet(hash, field, serialized);
      return result >= 0;
    } catch (error) {
      logger.error('Redis HSET error', { hash, field, error: error.message });
      return false;
    }
  }

  async hgetall(hash) {
    try {
      if (!this.isConnected) return {};
      
      const result = await this.client.hGetAll(hash);
      const parsed = {};
      
      Object.keys(result).forEach(key => {
        try {
          parsed[key] = JSON.parse(result[key]);
        } catch {
          parsed[key] = result[key]; // Keep as string if not JSON
        }
      });
      
      return parsed;
    } catch (error) {
      logger.error('Redis HGETALL error', { hash, error: error.message });
      return {};
    }
  }

  // Pub/Sub methods
  async publish(channel, message) {
    try {
      if (!this.isConnected) return 0;
      
      const serialized = JSON.stringify(message);
      const result = await this.publisher.publish(channel, serialized);
      return result;
    } catch (error) {
      logger.error('Redis PUBLISH error', { channel, error: error.message });
      return 0;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.isConnected) return false;
      
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch {
          callback(message); // Return raw message if not JSON
        }
      });
      return true;
    } catch (error) {
      logger.error('Redis SUBSCRIBE error', { channel, error: error.message });
      return false;
    }
  }

  // Cache with fallback to in-memory if Redis is unavailable
  async cached(key, fetcher, ttl = 3600) {
    try {
      // Try to get from cache first
      let value = await this.get(key);
      
      if (value !== null) {
        logger.debug('Cache hit', { key });
        return value;
      }

      // Cache miss - fetch data
      logger.debug('Cache miss', { key });
      value = await fetcher();

      // Store in cache
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl);
      }

      return value;
    } catch (error) {
      logger.error('Cache operation error', { key, error: error.message });
      // Fallback to direct fetch
      return await fetcher();
    }
  }

  async healthCheck() {
    try {
      if (!this.client || !this.isConnected) {
        return {
          status: 'unavailable',
          message: 'Redis client not connected'
        };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency: `${latency}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern) {
    try {
      if (!this.isConnected) return 0;
      
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info('Invalidated cache pattern', { pattern, count: keys.length });
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Pattern invalidation error', { pattern, error: error.message });
      return 0;
    }
  }
}

module.exports = RedisConfig;