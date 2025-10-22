const fs = require('fs').promises;
const path = require('path');
const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Database Migration Manager
 * Handles database schema migrations and versioning
 */
class MigrationManager {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
    this.seedsPath = path.join(__dirname, 'seeds');
  }

  /**
   * Initialize migration system
   */
  async initialize() {
    try {
      // Create migrations table
      await this.createMigrationsTable();
      
      // Ensure directories exist
      await this.ensureDirectories();
      
      logger.info('Migration system initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize migration system', { error: error.message });
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_time INTEGER,
        checksum VARCHAR(64)
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_version ON schema_migrations(version);
    `;
    
    await db.query(query);
  }

  /**
   * Ensure migration directories exist
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.migrationsPath, { recursive: true });
      await fs.mkdir(this.seedsPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    try {
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return { migrated: [], skipped: 0 };
      }

      const migrated = [];
      
      for (const migration of pendingMigrations) {
        logger.info(`Running migration: ${migration.name}`);
        const startTime = Date.now();
        
        try {
          await this.runMigration(migration);
          const executionTime = Date.now() - startTime;
          
          await this.recordMigration(migration, executionTime);
          migrated.push(migration.name);
          
          logger.info(`Migration completed: ${migration.name} (${executionTime}ms)`);
        } catch (error) {
          logger.error(`Migration failed: ${migration.name}`, { error: error.message });
          throw error;
        }
      }

      logger.info(`Successfully ran ${migrated.length} migrations`);
      return { migrated, skipped: 0 };
    } catch (error) {
      logger.error('Migration process failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Rollback last migration
   */
  async rollback() {
    try {
      const lastMigration = await this.getLastMigration();
      
      if (!lastMigration) {
        logger.info('No migrations to rollback');
        return null;
      }

      logger.info(`Rolling back migration: ${lastMigration.name}`);
      
      const migrationFile = await this.loadMigrationFile(lastMigration.version);
      
      if (migrationFile.down) {
        await db.transaction([
          { text: migrationFile.down, params: [] }
        ]);
      }

      await this.removeMigrationRecord(lastMigration.version);
      
      logger.info(`Rollback completed: ${lastMigration.name}`);
      return lastMigration;
    } catch (error) {
      logger.error('Rollback failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = await this.getAvailableMigrations();
      const pendingMigrations = await this.getPendingMigrations();

      return {
        applied: appliedMigrations.length,
        pending: pendingMigrations.length,
        total: availableMigrations.length,
        appliedMigrations: appliedMigrations.map(m => ({
          version: m.version,
          name: m.name,
          executedAt: m.executed_at,
          executionTime: m.execution_time
        })),
        pendingMigrations: pendingMigrations.map(m => ({
          version: m.version,
          name: m.name
        }))
      };
    } catch (error) {
      logger.error('Failed to get migration status', { error: error.message });
      throw error;
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations() {
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();
    
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    return availableMigrations.filter(m => !appliedVersions.has(m.version));
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    const result = await db.query(`
      SELECT version, name, executed_at, execution_time, checksum
      FROM schema_migrations
      ORDER BY version ASC
    `);
    
    return result.rows;
  }

  /**
   * Get available migration files
   */
  async getAvailableMigrations() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.js'))
        .sort();

      const migrations = [];
      
      for (const file of migrationFiles) {
        const version = file.replace('.js', '');
        const migration = await this.loadMigrationFile(version);
        
        migrations.push({
          version,
          name: migration.name || version,
          filename: file
        });
      }

      return migrations;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Load migration file
   */
  async loadMigrationFile(version) {
    const filePath = path.join(this.migrationsPath, `${version}.js`);
    
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(filePath)];
      return require(filePath);
    } catch (error) {
      throw new Error(`Failed to load migration file ${version}: ${error.message}`);
    }
  }

  /**
   * Run a single migration
   */
  async runMigration(migration) {
    const migrationFile = await this.loadMigrationFile(migration.version);
    
    if (!migrationFile.up) {
      throw new Error(`Migration ${migration.version} missing 'up' function`);
    }

    // Execute migration in transaction
    await db.transaction([
      { text: migrationFile.up, params: [] }
    ]);
  }

  /**
   * Record successful migration
   */
  async recordMigration(migration, executionTime) {
    const migrationFile = await this.loadMigrationFile(migration.version);
    const checksum = this.calculateChecksum(migrationFile.up);

    await db.query(`
      INSERT INTO schema_migrations (version, name, execution_time, checksum)
      VALUES ($1, $2, $3, $4)
    `, [migration.version, migration.name, executionTime, checksum]);
  }

  /**
   * Get last applied migration
   */
  async getLastMigration() {
    const result = await db.query(`
      SELECT version, name, executed_at
      FROM schema_migrations
      ORDER BY version DESC
      LIMIT 1
    `);
    
    return result.rows[0] || null;
  }

  /**
   * Remove migration record (for rollback)
   */
  async removeMigrationRecord(version) {
    await db.query(`
      DELETE FROM schema_migrations
      WHERE version = $1
    `, [version]);
  }

  /**
   * Calculate checksum for migration content
   */
  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create new migration file
   */
  async createMigration(name) {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '_').substring(0, 15);
    const version = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `${version}.js`;
    const filePath = path.join(this.migrationsPath, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  name: '${name}',
  
  up: \`
    -- Add your migration SQL here
    -- Example:
    -- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
  \`,
  
  down: \`
    -- Add rollback SQL here
    -- Example:
    -- ALTER TABLE users DROP COLUMN new_field;
  \`
};
`;

    await fs.writeFile(filePath, template);
    
    logger.info(`Created migration file: ${filename}`);
    return { version, filename, path: filePath };
  }

  /**
   * Run initial schema setup
   */
  async setupInitialSchema() {
    try {
      const schemaPath = path.join(__dirname, 'schemas.sql');
      const schemaSQL = await fs.readFile(schemaPath, 'utf-8');
      
      logger.info('Running initial schema setup');
      await db.query(schemaSQL);
      
      // Record as initial migration
      const version = '000000000000000_initial_schema';
      await this.recordMigration({
        version,
        name: 'Initial Schema Setup'
      }, 0);
      
      logger.info('Initial schema setup completed');
      return true;
    } catch (error) {
      logger.error('Initial schema setup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Run database seeds
   */
  async seed() {
    try {
      const seedFiles = await fs.readdir(this.seedsPath);
      const seeds = seedFiles
        .filter(file => file.endsWith('.js'))
        .sort();

      for (const seedFile of seeds) {
        logger.info(`Running seed: ${seedFile}`);
        const seedPath = path.join(this.seedsPath, seedFile);
        
        // Clear require cache
        delete require.cache[require.resolve(seedPath)];
        const seed = require(seedPath);
        
        if (typeof seed.run === 'function') {
          await seed.run(db);
          logger.info(`Seed completed: ${seedFile}`);
        } else {
          logger.warn(`Seed file ${seedFile} missing 'run' function`);
        }
      }

      logger.info('Database seeding completed');
      return true;
    } catch (error) {
      logger.error('Database seeding failed', { error: error.message });
      throw error;
    }
  }
}

// Export singleton
const migrationManager = new MigrationManager();

module.exports = {
  MigrationManager,
  migrations: migrationManager
};