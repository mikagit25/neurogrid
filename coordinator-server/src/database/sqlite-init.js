const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class SQLiteInitializer {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/neurogrid.db');
    this.db = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Connect to SQLite database
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Error opening SQLite database:', err);
          throw err;
        }
        logger.info('Connected to SQLite database:', this.dbPath);
      });

      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON;');

      // Create tables
      await this.createTables();

      logger.info('SQLite database initialized successfully');
      return this.db;
    } catch (error) {
      logger.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Nodes table
      `CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'offline',
        specs JSON,
        location VARCHAR(100),
        is_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Tasks/Jobs table
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        node_id INTEGER,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        task_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        estimated_cost DECIMAL(10,2),
        actual_cost DECIMAL(10,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL
      )`,

      // Transactions table
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER,
        transaction_type VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
      )`,

      // User sessions table
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // API keys table
      `CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON nodes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_node_id ON tasks(node_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    logger.info('Database tables and indexes created successfully');
  }

  async insertTestData() {
    try {
      // Insert test user
      await this.run(`
        INSERT OR IGNORE INTO users (id, username, email, password_hash, role, is_active, email_verified)
        VALUES (1, 'admin', 'admin@neurogrid.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LYDqONh6N8aQ.FQJ.', 'admin', 1, 1)
      `);

      // Insert test node
      await this.run(`
        INSERT OR IGNORE INTO nodes (id, user_id, name, description, status, specs, location, is_verified)
        VALUES (1, 1, 'Development Node', 'Local development GPU node', 'online', '{"gpu": "GTX 1080", "ram": "16GB", "cpu": "Intel i7"}', 'localhost', 1)
      `);

      logger.info('Test data inserted successfully');
    } catch (error) {
      logger.warn('Test data insertion skipped (may already exist):', error.message);
    }
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
        } else {
          logger.info('Database connection closed');
        }
      });
    }
  }
}

module.exports = SQLiteInitializer;
