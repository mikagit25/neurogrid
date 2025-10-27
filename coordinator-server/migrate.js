/**
 * Database Migration Runner
 * Handles database schema initialization and migrations
 */

const fs = require('fs').promises;
const path = require('path');
const { db } = require('./src/config/database-universal');
const logger = require('./src/utils/logger');

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      logger.info('Starting database migrations...');
      
      // Initialize database connection if not already done
      if (!db.isInitialized()) {
        await db.initialize();
      }
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Get all migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Run pending migrations
      for (const file of migrationFiles) {
        if (!appliedMigrations.includes(file)) {
          await this.runMigration(file);
        }
      }
      
      logger.info('Database migrations completed successfully');
      
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    await db.query(query);
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    try {
      const result = await db.query('SELECT filename FROM migrations ORDER BY id');
      return result.rows.map(row => row.filename);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get sorted list of migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      logger.error('Failed to read migrations directory:', error);
      return [];
    }
  }

  /**
   * Run a single migration
   */
  async runMigration(filename) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      logger.info(`Running migration: ${filename}`);
      
      // Read migration file - use SQLite version if in SQLite mode
      let actualFilename = filename;
      if (process.env.DB_TYPE === 'sqlite' && filename === '001_initial_schema.sql') {
        actualFilename = '001_initial_schema_sqlite.sql';
      }
      
      const filePath = path.join(this.migrationsPath, actualFilename);
      const migrationSQL = await fs.readFile(filePath, 'utf8');
      
      // Execute migration
      await client.query(migrationSQL);
      
      // Record migration as applied
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Migration completed: ${filename}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new migration file
   */
  async createMigration(name, content = '') {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = path.join(this.migrationsPath, filename);
    
    const template = content || `-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString()}

-- Write your migration SQL here
`;
    
    await fs.writeFile(filePath, template, 'utf8');
    logger.info(`Created migration: ${filename}`);
    
    return filename;
  }

  /**
   * Initialize database with initial schema
   */
  async initializeDatabase() {
    try {
      logger.info('Initializing database schema...');
      
      // Initialize database connection
      await db.initialize();
      
      // Check if database is already initialized
      let tablesResult;
      if (process.env.DB_TYPE === 'sqlite' || db.getType() === 'sqlite') {
        tablesResult = await db.query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='users'
        `);
      } else {
        tablesResult = await db.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'users'
        `);
      }
      
      if (tablesResult.rows.length > 0) {
        logger.info('Database already initialized');
        return;
      }
      
      // Run migrations
      await this.runMigrations();
      
      // Create default admin user if none exists
      await this.createDefaultAdmin();
      
      logger.info('Database initialization completed');
      
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create default admin user
   */
  async createDefaultAdmin() {
    try {
      // For SQLite, we need to modify the User model import
      // const User = require('./src/models/User');
      
      // Check if admin exists
      const existingAdmin = await db.query(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
      );
      
      if (existingAdmin.rows.length > 0) {
        logger.info('Admin user already exists');
        return;
      }
      
      // Create default admin directly with SQL
      const bcrypt = require('bcryptjs');
      const crypto = require('crypto');
      
      // Use environment variable for default admin password in production
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'SecureAdmin2024!';
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      const adminId = crypto.randomBytes(16).toString('hex');
      
      await db.query(`
        INSERT INTO users (id, username, email, password_hash, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [adminId, 'admin', 'admin@neurogrid.io', passwordHash, 'admin', true, true]);
      
      logger.info('Default admin user created', {
        userId: adminId,
        email: 'admin@neurogrid.io',
        warning: 'Please change the default password immediately!'
      });
      
    } catch (error) {
      logger.error('Failed to create default admin:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Reset database (DANGER: removes all data)
   */
  async resetDatabase() {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      logger.warn('RESETTING DATABASE - ALL DATA WILL BE LOST!');
      
      // Drop all tables
      const dropTablesQuery = `
        DROP TABLE IF EXISTS migrations CASCADE;
        DROP TABLE IF EXISTS notifications CASCADE;
        DROP TABLE IF EXISTS api_keys CASCADE;
        DROP TABLE IF EXISTS job_queue CASCADE;
        DROP TABLE IF EXISTS node_metrics CASCADE;
        DROP TABLE IF EXISTS transactions CASCADE;
        DROP TABLE IF EXISTS user_balances CASCADE;
        DROP TABLE IF EXISTS jobs CASCADE;
        DROP TABLE IF EXISTS nodes CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
      `;
      
      await client.query(dropTablesQuery);
      
      await client.query('COMMIT');
      
      logger.warn('Database reset completed');
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database reset failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();
  
  async function runCommand() {
    try {
      switch (command) {
        case 'init':
          await migrationRunner.initializeDatabase();
          break;
        case 'migrate':
          await migrationRunner.runMigrations();
          break;
        case 'reset':
          if (process.env.NODE_ENV === 'production') {
            logger.error('Cannot reset database in production environment');
            process.exit(1);
          }
          await migrationRunner.resetDatabase();
          break;
        case 'create':
          const name = process.argv[3];
          if (!name) {
            logger.error('Migration name is required');
            process.exit(1);
          }
          await migrationRunner.createMigration(name);
          break;
        default:
          console.log(`
Usage: node migrate.js <command>

Commands:
  init     - Initialize database with schema
  migrate  - Run pending migrations  
  reset    - Reset database (development only)
  create   - Create new migration file

Examples:
  node migrate.js init
  node migrate.js migrate
  node migrate.js create "add user preferences"
          `);
      }
      
      await db.close();
      process.exit(0);
      
    } catch (error) {
      logger.error('Command failed:', error);
      await db.close();
      process.exit(1);
    }
  }
  
  runCommand();
}

module.exports = MigrationRunner;