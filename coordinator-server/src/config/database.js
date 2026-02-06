const { Pool } = require('pg');
// Removed unused imports: sqlite3, path
const SQLiteInitializer = require('../database/sqlite-init');
const logger = require('../utils/logger');

/**
 * Database Configuration and Connection Pool Management
 * Provides database connection, transaction management, and query optimization
 */
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.db = null; // SQLite database instance
    this.isConnected = false;
    this.useSQLite = process.env.NODE_ENV === 'development' || process.env.USE_SQLITE === 'true';
    this.connectionConfig = this.getConnectionConfig();
  }

  /**
   * Get database connection configuration
   */
  getConnectionConfig() {
    return {
      user: process.env.DB_USER || 'neurogrid',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'neurogrid',
      password: process.env.DB_PASSWORD || 'neurogrid_password',
      port: parseInt(process.env.DB_PORT) || 5432,

      // Connection pool settings
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,

      // SSL configuration
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

      // Query timeout
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,

      // Connection retry settings
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000
    };
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      if (this.useSQLite) {
        logger.info('Initializing SQLite database for development...');
        const sqliteInit = new SQLiteInitializer();
        this.db = await sqliteInit.initialize();
        await sqliteInit.insertTestData();
        this.isConnected = true;
        logger.info('SQLite database initialized successfully');
        return;
      }

      // PostgreSQL initialization
      this.pool = new Pool(this.connectionConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;

      // Setup event listeners
      this.setupEventListeners();

      logger.info('Database connection pool initialized successfully', {
        host: this.connectionConfig.host,
        database: this.connectionConfig.database,
        maxConnections: this.connectionConfig.max
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize database connection pool', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup event listeners for connection pool
   */
  setupEventListeners() {
    this.pool.on('connect', (client) => {
      logger.debug('New database client connected', {
        processId: client.processID,
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      });
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Database client acquired from pool', {
        processId: client.processID
      });
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database pool error', {
        error: err.message,
        processId: client?.processID
      });
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed from pool', {
        processId: client.processID
      });
    });
  }

  /**
   * Execute a query with connection from pool or SQLite
   */
  async query(text, params = []) {
    const start = Date.now();

    try {
      if (this.useSQLite) {
        return await this.querySQLite(text, params);
      }

      // PostgreSQL query
      let client;
      try {
        client = await this.pool.connect();
        const result = await client.query(text, params);
        const duration = Date.now() - start;

        logger.debug('Database query executed', {
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration,
          rowCount: result.rowCount
        });

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error('Database query failed', {
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          error: error.message,
          duration
        });
        throw error;
      } finally {
        if (client) {
          client.release();
        }
      }
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        error: error.message,
        duration
      });
      throw error;
    }
  }

  /**
   * Execute SQLite query
   */
  async querySQLite(text, params = []) {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      // Convert PostgreSQL style queries to SQLite
      const sqliteQuery = this.convertToSQLite(text);

      if (sqliteQuery.startsWith('SELECT') || sqliteQuery.startsWith('PRAGMA')) {
        this.db.all(sqliteQuery, params, (err, rows) => {
          const duration = Date.now() - start;
          if (err) {
            logger.error('SQLite query failed', {
              query: sqliteQuery.substring(0, 100) + (sqliteQuery.length > 100 ? '...' : ''),
              error: err.message,
              duration
            });
            reject(err);
          } else {
            logger.debug('SQLite query executed', {
              query: sqliteQuery.substring(0, 100) + (sqliteQuery.length > 100 ? '...' : ''),
              duration,
              rowCount: rows.length
            });
            resolve({ rows, rowCount: rows.length });
          }
        });
      } else {
        this.db.run(sqliteQuery, params, function(err) {
          const duration = Date.now() - start;
          if (err) {
            logger.error('SQLite query failed', {
              query: sqliteQuery.substring(0, 100) + (sqliteQuery.length > 100 ? '...' : ''),
              error: err.message,
              duration
            });
            reject(err);
          } else {
            logger.debug('SQLite query executed', {
              query: sqliteQuery.substring(0, 100) + (sqliteQuery.length > 100 ? '...' : ''),
              duration,
              rowCount: this.changes
            });
            resolve({
              rows: [],
              rowCount: this.changes,
              insertId: this.lastID
            });
          }
        });
      }
    });
  }

  /**
   * Convert PostgreSQL queries to SQLite compatible format
   */
  convertToSQLite(query) {
    return query
      .replace(/NOW\(\)/gi, "datetime('now')")
      .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
      .replace(/SERIAL/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/BIGSERIAL/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/BOOLEAN/gi, 'INTEGER')
      .replace(/TRUE/gi, '1')
      .replace(/FALSE/gi, '0');
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];
      for (const { text, params } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }

      await client.query('COMMIT');

      logger.info('Database transaction completed successfully', {
        queryCount: queries.length
      });

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction failed, rolled back', {
        error: error.message,
        queryCount: queries.length
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check, NOW() as timestamp');
      const stats = this.getPoolStats();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connectionPool: stats,
        latency: Date.now() - new Date(result.rows[0].timestamp).getTime()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.connectionConfig.max,
      isConnected: this.isConnected
    };
  }

  /**
   * Close all database connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Utility method for building WHERE clauses with dynamic conditions
   */
  buildWhereClause(conditions = {}) {
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(',');
          whereClauses.push(`${key} IN (${placeholders})`);
          params.push(...value);
        } else if (typeof value === 'object' && value.operator) {
          whereClauses.push(`${key} ${value.operator} $${paramIndex++}`);
          params.push(value.value);
        } else {
          whereClauses.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    return {
      whereClause: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Utility method for pagination
   */
  buildPaginationClause(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Legacy compatibility functions
const initializeDatabase = async () => {
  return await databaseManager.initialize();
};

const closeDatabase = async () => {
  return await databaseManager.close();
};

module.exports = {
  DatabaseManager,
  db: databaseManager,
  initializeDatabase,
  closeDatabase
};
