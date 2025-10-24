/**
 * SQLite Database Configuration
 * Альтернатива PostgreSQL для разработки и тестирования
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

class SQLiteManager {
  constructor() {
    this.db = null;
    this.isConnected = false;
    this.dbPath = path.join(__dirname, '../../data/neurogrid.db');
  }

  async initialize() {
    try {
      // Создаем директорию для базы данных
      const fs = require('fs').promises;
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      this.db = new sqlite3.Database(this.dbPath);
      
      // Включаем поддержку foreign keys
      await this.query('PRAGMA foreign_keys = ON');
      
      // Создаем таблицы
      await this.createTables();
      
      this.isConnected = true;
      
      logger.info('SQLite database initialized successfully', {
        path: this.dbPath
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize SQLite database', { error: error.message });
      throw error;
    }
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows, rowCount: rows.length });
          }
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              rows: [{ id: this.lastID }], 
              rowCount: this.changes,
              lastID: this.lastID 
            });
          }
        });
      }
    });
  }

  async transaction(queries) {
    try {
      await this.query('BEGIN TRANSACTION');
      
      const results = [];
      for (const query of queries) {
        const result = await this.query(query.text, query.params);
        results.push(result);
      }
      
      await this.query('COMMIT');
      return results;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'node_owner')),
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        profile TEXT DEFAULT '{}',
        settings TEXT DEFAULT '{}'
      )`,

      // User balances table
      `CREATE TABLE IF NOT EXISTS user_balances (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(10,2) DEFAULT 0,
        escrow_balance DECIMAL(10,2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Transactions table
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'escrow', 'refund')),
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
        description TEXT,
        payment_method TEXT,
        external_transaction_id TEXT,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
      )`,

      // Nodes table
      `CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'maintenance', 'error')),
        node_type TEXT DEFAULT 'compute',
        capabilities TEXT DEFAULT '{}',
        hardware_info TEXT DEFAULT '{}',
        network_info TEXT DEFAULT '{}',
        location TEXT DEFAULT '{}',
        pricing TEXT DEFAULT '{}',
        availability_schedule TEXT DEFAULT '{}',
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_jobs_completed INTEGER DEFAULT 0,
        total_compute_hours DECIMAL(10,2) DEFAULT 0,
        reputation_score DECIMAL(3,2) DEFAULT 5.0,
        is_verified BOOLEAN DEFAULT 0
      )`,

      // Jobs table
      `CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        node_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
        priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
        requirements TEXT NOT NULL DEFAULT '{}',
        parameters TEXT DEFAULT '{}',
        input_data TEXT DEFAULT '{}',
        output_data TEXT DEFAULT '{}',
        logs TEXT,
        error_message TEXT,
        progress DECIMAL(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        estimated_duration INTEGER,
        actual_duration INTEGER,
        cost_estimate DECIMAL(10,2),
        actual_cost DECIMAL(10,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        expires_at DATETIME
      )`,

      // Job queue table
      `CREATE TABLE IF NOT EXISTS job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        priority INTEGER NOT NULL DEFAULT 5,
        scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_at DATETIME,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        next_retry_at DATETIME,
        queue_name TEXT DEFAULT 'default'
      )`
    ];

    for (const table of tables) {
      await this.query(table);
    }

    // Создаем индексы
    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON nodes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)'
    ];

    for (const index of indices) {
      await this.query(index);
    }

    // Создаем администратора по умолчанию
    await this.createDefaultAdmin();
  }

  async createDefaultAdmin() {
    try {
      const bcrypt = require('bcryptjs');
      const adminPasswordHash = await bcrypt.hash('admin123', 12);

      await this.query(`
        INSERT OR IGNORE INTO users (username, email, password_hash, role, is_active, email_verified)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['admin', 'admin@neurogrid.dev', adminPasswordHash, 'admin', 1, 1]);

      // Создаем баланс для админа
      await this.query(`
        INSERT OR IGNORE INTO user_balances (user_id, balance)
        SELECT id, 1000.00 FROM users WHERE username = 'admin'
      `);

      logger.info('Default admin user created');
    } catch (error) {
      logger.debug('Default admin creation skipped (likely already exists)');
    }
  }

  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check, datetime("now") as timestamp');
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'sqlite',
        path: this.dbPath,
        isConnected: this.isConnected
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing SQLite database', { error: err.message });
          } else {
            logger.info('SQLite database connection closed');
          }
          this.isConnected = false;
          resolve();
        });
      });
    }
  }

  // Совместимость с PostgreSQL API
  get pool() {
    return {
      connect: () => Promise.resolve({
        query: this.query.bind(this),
        release: () => {}
      }),
      end: () => this.close()
    };
  }
}

// Создаем singleton экземпляр
const sqliteManager = new SQLiteManager();

module.exports = {
  db: sqliteManager,
  initializeDatabase: () => sqliteManager.initialize(),
  closeDatabase: () => sqliteManager.close()
};