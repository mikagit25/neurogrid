const logger = require('../utils/logger');

class CacheService {
  constructor(redisConfig) {
    this.redis = redisConfig;
    this.defaultTTL = 3600; // 1 hour
    this.enabled = true;

    // Cache key prefixes for different data types
    this.prefixes = {
      session: 'session:',
      user: 'user:',
      node: 'node:',
      task: 'task:',
      metrics: 'metrics:',
      auth: 'auth:',
      rate_limit: 'rl:',
      api_response: 'api:',
      db_query: 'db:',
      file: 'file:'
    };
  }

  // Generate cache key with prefix
  key(prefix, ...parts) {
    return `${this.prefixes[prefix] || prefix}${parts.join(':')}`;
  }

  // Session caching
  async getSession(sessionId) {
    const key = this.key('session', sessionId);
    return await this.redis.get(key);
  }

  async setSession(sessionId, sessionData, ttl = 86400) { // 24 hours
    const key = this.key('session', sessionId);
    return await this.redis.set(key, sessionData, ttl);
  }

  async deleteSession(sessionId) {
    const key = this.key('session', sessionId);
    return await this.redis.del(key);
  }

  // User data caching
  async getUser(userId) {
    const key = this.key('user', userId);
    return await this.redis.get(key);
  }

  async setUser(userId, userData, ttl = 1800) { // 30 minutes
    const key = this.key('user', userId);
    return await this.redis.set(key, userData, ttl);
  }

  async invalidateUser(userId) {
    const patterns = [
      this.key('user', userId),
      this.key('auth', userId, '*'),
      this.key('api', 'user', userId, '*')
    ];

    let invalidated = 0;
    for (const pattern of patterns) {
      invalidated += await this.redis.invalidatePattern(pattern);
    }

    logger.info('Invalidated user cache', { userId, count: invalidated });
    return invalidated;
  }

  // Node data caching
  async getNode(nodeId) {
    const key = this.key('node', nodeId);
    return await this.redis.get(key);
  }

  async setNode(nodeId, nodeData, ttl = 300) { // 5 minutes
    const key = this.key('node', nodeId);
    return await this.redis.set(key, nodeData, ttl);
  }

  async getNodeList(filters = {}) {
    const cacheKey = this.key('node', 'list', JSON.stringify(filters));
    return await this.redis.get(cacheKey);
  }

  async setNodeList(filters, nodeList, ttl = 60) { // 1 minute
    const cacheKey = this.key('node', 'list', JSON.stringify(filters));
    return await this.redis.set(cacheKey, nodeList, ttl);
  }

  async invalidateNode(nodeId) {
    const patterns = [
      this.key('node', nodeId),
      this.key('node', 'list', '*'),
      this.key('metrics', 'node', nodeId, '*'),
      this.key('api', 'node', '*')
    ];

    let invalidated = 0;
    for (const pattern of patterns) {
      invalidated += await this.redis.invalidatePattern(pattern);
    }

    logger.info('Invalidated node cache', { nodeId, count: invalidated });
    return invalidated;
  }

  // Task data caching
  async getTask(taskId) {
    const key = this.key('task', taskId);
    return await this.redis.get(key);
  }

  async setTask(taskId, taskData, ttl = 600) { // 10 minutes
    const key = this.key('task', taskId);
    return await this.redis.set(key, taskData, ttl);
  }

  async getTaskList(userId, filters = {}) {
    const cacheKey = this.key('task', 'list', userId, JSON.stringify(filters));
    return await this.redis.get(cacheKey);
  }

  async setTaskList(userId, filters, taskList, ttl = 60) { // 1 minute
    const cacheKey = this.key('task', 'list', userId, JSON.stringify(filters));
    return await this.redis.set(cacheKey, taskList, ttl);
  }

  async invalidateTask(taskId, userId = null) {
    const patterns = [
      this.key('task', taskId),
      this.key('api', 'task', '*')
    ];

    if (userId) {
      patterns.push(this.key('task', 'list', userId, '*'));
    }

    let invalidated = 0;
    for (const pattern of patterns) {
      invalidated += await this.redis.invalidatePattern(pattern);
    }

    logger.info('Invalidated task cache', { taskId, userId, count: invalidated });
    return invalidated;
  }

  // Metrics caching
  async getMetrics(type, identifier, period) {
    const key = this.key('metrics', type, identifier, period);
    return await this.redis.get(key);
  }

  async setMetrics(type, identifier, period, metricsData, ttl = 300) { // 5 minutes
    const key = this.key('metrics', type, identifier, period);
    return await this.redis.set(key, metricsData, ttl);
  }

  async invalidateMetrics(type, identifier = '*') {
    const pattern = this.key('metrics', type, identifier, '*');
    const invalidated = await this.redis.invalidatePattern(pattern);

    logger.info('Invalidated metrics cache', { type, identifier, count: invalidated });
    return invalidated;
  }

  // API response caching
  async cacheApiResponse(method, path, query, responseData, ttl = 300) {
    const queryString = JSON.stringify(query);
    const key = this.key('api_response', method, path, queryString);
    return await this.redis.set(key, responseData, ttl);
  }

  async getCachedApiResponse(method, path, query) {
    const queryString = JSON.stringify(query);
    const key = this.key('api_response', method, path, queryString);
    return await this.redis.get(key);
  }

  // Database query caching
  async cacheDbQuery(query, params, result, ttl = 600) {
    const key = this.key('db_query', query, JSON.stringify(params));
    return await this.redis.set(key, result, ttl);
  }

  async getCachedDbQuery(query, params) {
    const key = this.key('db_query', query, JSON.stringify(params));
    return await this.redis.get(key);
  }

  async invalidateDbQuery(tablePattern) {
    const pattern = this.key('db_query', `*${tablePattern}*`);
    const invalidated = await this.redis.invalidatePattern(pattern);

    logger.info('Invalidated DB query cache', { pattern: tablePattern, count: invalidated });
    return invalidated;
  }

  // Rate limiting
  async getRateLimit(identifier, window) {
    const key = this.key('rate_limit', identifier, window);
    return await this.redis.get(key, 0);
  }

  async incrementRateLimit(identifier, window, ttl) {
    const key = this.key('rate_limit', identifier, window);

    try {
      if (!this.redis.isConnected) {
        // Fallback for when Redis is not available
        return { count: 1, ttl: ttl };
      }

      const client = this.redis.getClient();
      const multi = client.multi();
      multi.incr(key);
      multi.expire(key, ttl);

      const results = await multi.exec();
      const count = results[0];

      return { count, ttl };
    } catch (error) {
      logger.error('Rate limit increment error', { identifier, error: error.message });
      return { count: 1, ttl: ttl };
    }
  }

  // Authentication caching
  async cacheAuthToken(tokenHash, userData, ttl = 3600) {
    const key = this.key('auth', 'token', tokenHash);
    return await this.redis.set(key, userData, ttl);
  }

  async getCachedAuthToken(tokenHash) {
    const key = this.key('auth', 'token', tokenHash);
    return await this.redis.get(key);
  }

  async invalidateAuthToken(tokenHash) {
    const key = this.key('auth', 'token', tokenHash);
    return await this.redis.del(key);
  }

  async cacheUserPermissions(userId, permissions, ttl = 1800) {
    const key = this.key('auth', 'permissions', userId);
    return await this.redis.set(key, permissions, ttl);
  }

  async getCachedUserPermissions(userId) {
    const key = this.key('auth', 'permissions', userId);
    return await this.redis.get(key);
  }

  // File metadata caching
  async cacheFileMetadata(fileId, metadata, ttl = 3600) {
    const key = this.key('file', 'meta', fileId);
    return await this.redis.set(key, metadata, ttl);
  }

  async getCachedFileMetadata(fileId) {
    const key = this.key('file', 'meta', fileId);
    return await this.redis.get(key);
  }

  // Generic cache operations with tags
  async setWithTags(key, value, ttl, tags = []) {
    const result = await this.redis.set(key, value, ttl);

    if (result && tags.length > 0) {
      // Store reverse mapping from tags to keys
      for (const tag of tags) {
        const tagKey = this.key('tag', tag, key);
        await this.redis.set(tagKey, 1, ttl);
      }
    }

    return result;
  }

  async invalidateByTags(tags) {
    let totalInvalidated = 0;

    for (const tag of tags) {
      const pattern = this.key('tag', tag, '*');
      const tagKeys = await this.redis.getClient().keys(pattern);

      for (const tagKey of tagKeys) {
        // Extract original key from tag key
        const originalKey = tagKey.split(':').slice(2).join(':');
        await this.redis.del(originalKey);
        await this.redis.del(tagKey);
        totalInvalidated++;
      }
    }

    logger.info('Invalidated cache by tags', { tags, count: totalInvalidated });
    return totalInvalidated;
  }

  // Cache warming
  async warmCache(type, fetcher, keys, ttl = 3600) {
    logger.info('Starting cache warming', { type, count: keys.length });

    const warmed = [];
    const failed = [];

    for (const keyData of keys) {
      try {
        const { key, ...params } = keyData;
        const data = await fetcher(params);

        if (data !== null && data !== undefined) {
          await this.redis.set(key, data, ttl);
          warmed.push(key);
        }
      } catch (error) {
        logger.error('Cache warming failed for key', { key: keyData.key, error: error.message });
        failed.push(keyData.key);
      }
    }

    logger.info('Cache warming completed', {
      type,
      warmed: warmed.length,
      failed: failed.length
    });

    return { warmed, failed };
  }

  // Cache statistics
  async getStats() {
    try {
      if (!this.redis.isConnected) {
        return {
          status: 'disconnected',
          keys: 0
        };
      }

      const client = this.redis.getClient();
      const info = await client.info('memory');
      const keyspace = await client.info('keyspace');

      // Parse info strings
      const memoryInfo = {};
      const keyspaceInfo = {};

      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) memoryInfo[key] = value;
      });

      keyspace.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) keyspaceInfo[key] = value;
      });

      return {
        status: 'connected',
        memory_used: memoryInfo.used_memory_human,
        keys: keyspaceInfo.db0 ? keyspaceInfo.db0.split(',')[0].split('=')[1] : 0,
        keyspace_hits: memoryInfo.keyspace_hits,
        keyspace_misses: memoryInfo.keyspace_misses
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error: error.message });
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  // Health check
  async healthCheck() {
    return await this.redis.healthCheck();
  }
}

module.exports = CacheService;
