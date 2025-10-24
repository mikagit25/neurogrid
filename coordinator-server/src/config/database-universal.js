/**
 * Universal Database Adapter
 * Supports both SQLite (development) and PostgreSQL (production)
 */

const logger = require('../utils/logger');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class UniversalDatabase {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'sqlite';
    this.pool = null;
    this.sqlite = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      if (this.dbType === 'sqlite') {
        await this.initializeSQLite();
      } else {
        await this.initializePostgreSQL();
      }
      
      this.isConnected = true;
      logger.info(`Database initialized (${this.dbType})`, {
        type: this.dbType
      });
      
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize SQLite connection
   */
  async initializeSQLite() {
    const dbPath = process.env.DB_PATH || './data/neurogrid.db';
    const dbDir = path.dirname(dbPath);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      this.sqlite = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Enable foreign keys
          this.sqlite.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  /**
   * Initialize PostgreSQL connection
   */
  async initializePostgreSQL() {
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'neurogrid',
      user: process.env.DB_USER || 'neurogrid',
      password: process.env.DB_PASSWORD || 'neurogrid_password',
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    };

    this.pool = new Pool(poolConfig);
    
    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  /**
   * Execute a query
   */
  async query(text, params = []) {
    if (!this.isConnected) {
      await this.initialize();
    }

    const start = Date.now();
    
    try {
      let result;
      
      if (this.dbType === 'sqlite') {
        result = await this.querySQLite(text, params);
      } else {
        result = await this.queryPostgreSQL(text, params);
      }
      
      const duration = Date.now() - start;
      logger.debug('Database query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        rowCount: result.rows ? result.rows.length : result.changes
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
    }
  }

  /**
   * Execute SQLite query
   */
  async querySQLite(text, params = []) {
    return new Promise((resolve, reject) => {
      // Convert PostgreSQL-style parameters ($1, $2) to SQLite-style (?)
      const sqliteQuery = text.replace(/\$(\d+)/g, '?');
      
      if (text.trim().toUpperCase().startsWith('SELECT')) {
        this.sqlite.all(sqliteQuery, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows, rowCount: rows.length });
          }
        });
      } else {
        this.sqlite.run(sqliteQuery, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              rows: [], 
              rowCount: this.changes,
              lastID: this.lastID 
            });
          }
        });
      }
    });
  }

  /**
   * Execute PostgreSQL query
   */
  async queryPostgreSQL(text, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client for transactions
   */
  async getClient() {
    if (!this.isConnected) {
      await this.initialize();
    }

    if (this.dbType === 'sqlite') {
      // SQLite doesn't support connection pooling, return wrapper
      return {
        query: this.querySQLite.bind(this),
        release: () => {}, // No-op for SQLite
        db: this.sqlite
      };
    } else {
      return await this.pool.connect();
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized() {
    return this.isConnected;
  }

  /**
   * Get database type
   */
  getType() {
    return this.dbType;
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.dbType === 'sqlite' && this.sqlite) {
      return new Promise((resolve) => {
        this.sqlite.close((err) => {
          if (err) {
            logger.error('Error closing SQLite database:', err);
          }
          resolve();
        });
      });
    } else if (this.pool) {
      await this.pool.end();
    }
    
    this.isConnected = false;
    logger.info('Database connection closed');
  }

  /**
   * Get database health status
   */
  async getHealth() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected' };
      }

      const start = Date.now();
      await this.query('SELECT 1 as health_check');
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        type: this.dbType,
        responseTime,
        connected: true
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        type: this.dbType,
        error: error.message,
        connected: false
      };
    }
  }

  /**
   * Build WHERE clause from conditions object
   */
  buildWhereClause(conditions) {
    const keys = Object.keys(conditions);
    if (keys.length === 0) {
      return { whereClause: '', params: [] };
    }

    const clauses = keys.map((key, index) => `${key} = $${index + 1}`);
    const whereClause = `WHERE ${clauses.join(' AND ')}`;
    const params = Object.values(conditions);

    return { whereClause, params };
  }

  /**
   * Build pagination clause
   */
  buildPaginationClause(page, limit) {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }
}

// Create singleton instance
const db = new UniversalDatabase();

module.exports = { db };