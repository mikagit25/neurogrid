/**
 * Database Connection Pool Optimizer
 * Advanced connection pooling and query optimization for better database performance
 */

const logger = require('../utils/logger');

class DatabaseOptimizer {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      maxConnections: config.maxConnections || 50,
      minConnections: config.minConnections || 5,
      acquireTimeout: config.acquireTimeout || 10000,
      idleTimeout: config.idleTimeout || 30000,
      enableQueryCache: config.enableQueryCache !== false,
      enablePreparedStatements: config.enablePreparedStatements !== false,
      enableOptimisticLocking: config.enableOptimisticLocking !== false,
      ...config
    };

    this.queryCache = new Map();
    this.preparedStatements = new Map();
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      slowQueries: [],
      activeConnections: 0
    };

    this.init();
  }

  init() {
    this.optimizeConnectionPool();
    this.setupQueryOptimization();
    this.setupMonitoring();
    
    logger.info('Database optimizer initialized', {
      maxConnections: this.config.maxConnections,
      queryCache: this.config.enableQueryCache,
      preparedStatements: this.config.enablePreparedStatements
    });
  }

  /**
   * Optimize database connection pool
   */
  optimizeConnectionPool() {
    // Enhanced connection pool configuration
    const poolConfig = {
      max: this.config.maxConnections,
      min: this.config.minConnections,
      acquire: this.config.acquireTimeout,
      idle: this.config.idleTimeout,
      evict: this.config.idleTimeout / 2, // Evict idle connections
      handleDisconnects: true,
      
      // Connection validation
      validate: (connection) => {
        return connection && !connection._invalid;
      },

      // Connection creation optimization
      create: (config) => {
        const connection = new Connection(config);
        connection.on('error', (err) => {
          logger.error('Database connection error', err);
          connection._invalid = true;
        });
        return connection;
      },

      // Connection destruction
      destroy: (connection) => {
        if (connection && connection.end) {
          connection.end();
        }
      }
    };

    // Apply pool configuration if database supports it
    if (this.db.setPoolConfig) {
      this.db.setPoolConfig(poolConfig);
    }
  }

  /**
   * Setup query optimization
   */
  setupQueryOptimization() {
    const originalQuery = this.db.query;
    
    this.db.query = async (sql, params = [], options = {}) => {
      const startTime = Date.now();
      const queryHash = this.generateQueryHash(sql, params);
      
      try {
        // Check cache first
        if (this.config.enableQueryCache && options.cache !== false) {
          const cachedResult = this.queryCache.get(queryHash);
          if (cachedResult && !this.isCacheExpired(cachedResult)) {
            this.metrics.cacheHits++;
            return cachedResult.data;
          }
          this.metrics.cacheMisses++;
        }

        // Optimize query if needed
        const optimizedSql = this.optimizeQuery(sql);
        
        // Use prepared statement if enabled
        let result;
        if (this.config.enablePreparedStatements && this.shouldUsePreparedStatement(sql)) {
          result = await this.executePreparedStatement(optimizedSql, params);
        } else {
          result = await originalQuery.call(this.db, optimizedSql, params);
        }

        const queryTime = Date.now() - startTime;
        this.updateMetrics(sql, queryTime, params);

        // Cache result if applicable
        if (this.config.enableQueryCache && options.cache !== false && this.shouldCacheQuery(sql)) {
          this.cacheQuery(queryHash, result, options.cacheTTL || 300000); // 5 minutes default
        }

        return result;

      } catch (error) {
        const queryTime = Date.now() - startTime;
        this.logSlowQuery(sql, params, queryTime, error);
        throw error;
      }
    };
  }

  /**
   * Generate hash for query caching
   */
  generateQueryHash(sql, params) {
    const crypto = require('crypto');
    const content = sql + JSON.stringify(params);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Optimize SQL query
   */
  optimizeQuery(sql) {
    let optimized = sql;

    // Add LIMIT if not present for potentially large result sets
    if (optimized.toLowerCase().includes('select') && 
        !optimized.toLowerCase().includes('limit') && 
        !optimized.toLowerCase().includes('count(')) {
      optimized += ' LIMIT 1000';
    }

    // Ensure proper indexing hints for common patterns
    optimized = optimized.replace(
      /WHERE\s+(\w+)\s*=\s*\?/gi,
      (match, column) => {
        if (['id', 'user_id', 'node_id', 'task_id'].includes(column.toLowerCase())) {
          return `${match} /* USE INDEX (idx_${column}) */`;
        }
        return match;
      }
    );

    return optimized;
  }

  /**
   * Check if query should use prepared statement
   */
  shouldUsePreparedStatement(sql) {
    const normalizedSql = sql.toLowerCase().trim();
    
    // Use prepared statements for common patterns
    return normalizedSql.includes('where') && 
           normalizedSql.includes('?') &&
           (normalizedSql.startsWith('select') || 
            normalizedSql.startsWith('insert') || 
            normalizedSql.startsWith('update') || 
            normalizedSql.startsWith('delete'));
  }

  /**
   * Execute prepared statement
   */
  async executePreparedStatement(sql, params) {
    const stmtHash = require('crypto').createHash('md5').update(sql).digest('hex');
    
    let stmt = this.preparedStatements.get(stmtHash);
    if (!stmt) {
      if (this.db.prepare) {
        stmt = await this.db.prepare(sql);
        this.preparedStatements.set(stmtHash, stmt);
        
        // Limit prepared statements cache size
        if (this.preparedStatements.size > 100) {
          const firstKey = this.preparedStatements.keys().next().value;
          const oldStmt = this.preparedStatements.get(firstKey);
          if (oldStmt && oldStmt.finalize) {
            oldStmt.finalize();
          }
          this.preparedStatements.delete(firstKey);
        }
      } else {
        // Fallback to regular query
        return this.db.query(sql, params);
      }
    }
    
    return stmt.execute ? stmt.execute(params) : stmt.run(params);
  }

  /**
   * Check if query result should be cached
   */
  shouldCacheQuery(sql) {
    const normalizedSql = sql.toLowerCase().trim();
    
    // Cache read-only queries
    if (!normalizedSql.startsWith('select')) {
      return false;
    }
    
    // Don't cache queries with temporal data
    const temporalKeywords = ['now()', 'current_timestamp', 'sysdate', 'getdate()'];
    if (temporalKeywords.some(keyword => normalizedSql.includes(keyword))) {
      return false;
    }
    
    return true;
  }

  /**
   * Cache query result
   */
  cacheQuery(queryHash, result, ttl) {
    this.queryCache.set(queryHash, {
      data: result,
      timestamp: Date.now(),
      ttl: ttl
    });
    
    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  /**
   * Check if cached result is expired
   */
  isCacheExpired(cachedItem) {
    return Date.now() - cachedItem.timestamp > cachedItem.ttl;
  }

  /**
   * Update performance metrics
   */
  updateMetrics(sql, queryTime, params) {
    this.metrics.totalQueries++;
    
    // Update average query time
    this.metrics.averageQueryTime = 
      (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + queryTime) / 
      this.metrics.totalQueries;

    // Track slow queries
    if (queryTime > 1000) { // Queries slower than 1 second
      this.logSlowQuery(sql, params, queryTime);
    }
  }

  /**
   * Log slow query
   */
  logSlowQuery(sql, params, queryTime, error = null) {
    const slowQuery = {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      params: params ? JSON.stringify(params).substring(0, 100) : 'none',
      executionTime: queryTime,
      timestamp: new Date().toISOString(),
      error: error ? error.message : null
    };

    this.metrics.slowQueries.push(slowQuery);
    
    // Keep only last 100 slow queries
    if (this.metrics.slowQueries.length > 100) {
      this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
    }

    logger.warn('Slow database query detected', slowQuery);
  }

  /**
   * Setup database monitoring
   */
  setupMonitoring() {
    // Monitor connection pool status
    setInterval(() => {
      if (this.db.pool && this.db.pool.getStatus) {
        const status = this.db.pool.getStatus();
        this.metrics.activeConnections = status.active || 0;
        
        if (status.active > this.config.maxConnections * 0.8) {
          logger.warn('High database connection usage', {
            active: status.active,
            idle: status.idle,
            total: status.total,
            maxConnections: this.config.maxConnections
          });
        }
      }
    }, 30000);

    // Clean expired cache entries
    setInterval(() => {
      let cleanedCount = 0;
      for (const [key, value] of this.queryCache.entries()) {
        if (this.isCacheExpired(value)) {
          this.queryCache.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.debug('Cleaned expired query cache entries', { count: cleanedCount });
      }
    }, 60000);
  }

  /**
   * Get optimization metrics
   */
  getMetrics() {
    return {
      queries: {
        total: this.metrics.totalQueries,
        averageTime: Math.round(this.metrics.averageQueryTime),
        slowCount: this.metrics.slowQueries.length
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRatio: this.metrics.totalQueries > 0 ? 
          (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2) : 0,
        size: this.queryCache.size
      },
      connections: {
        active: this.metrics.activeConnections,
        max: this.config.maxConnections,
        utilization: ((this.metrics.activeConnections / this.config.maxConnections) * 100).toFixed(2)
      },
      preparedStatements: {
        count: this.preparedStatements.size,
        enabled: this.config.enablePreparedStatements
      }
    };
  }

  /**
   * Clear caches and optimize
   */
  async optimize() {
    logger.info('Running database optimization cycle');
    
    // Clear expired cache entries
    let clearedCache = 0;
    for (const [key, value] of this.queryCache.entries()) {
      if (this.isCacheExpired(value)) {
        this.queryCache.delete(key);
        clearedCache++;
      }
    }
    
    // Analyze slow queries and suggest optimizations
    if (this.metrics.slowQueries.length > 0) {
      const recentSlowQueries = this.metrics.slowQueries.slice(-10);
      logger.info('Recent slow queries analysis', {
        count: recentSlowQueries.length,
        avgTime: recentSlowQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentSlowQueries.length,
        queries: recentSlowQueries.map(q => ({ sql: q.sql, time: q.executionTime }))
      });
    }

    logger.info('Database optimization completed', {
      clearedCacheEntries: clearedCache,
      metrics: this.getMetrics()
    });

    return this.getMetrics();
  }
}

module.exports = DatabaseOptimizer;