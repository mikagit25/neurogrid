#!/usr/bin/env node

/**
 * NeuroGrid Database Migration System
 * 
 * This script manages database schema migrations for NeuroGrid platform.
 * It ensures database structure consistency across environments.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const readline = require('readline');

class MigrationManager {
  constructor(config) {
    this.config = config;
    this.pool = new Pool(config.database);
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  /**
   * Initialize migration system
   */
  async initialize() {
    try {
      // Create migrations table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
        ON schema_migrations(version);
      `);
      
      console.log('✅ Migration system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize migration system:', error.message);
      throw error;
    }
  }

  /**
   * Get list of available migration files
   */
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
      return [];
    }

    return fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file => ({
        version: file.replace('.sql', ''),
        name: file.replace(/^\d{3}_/, '').replace('.sql', '').replace(/_/g, ' '),
        filename: file,
        path: path.join(this.migrationsDir, file)
      }));
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    try {
      const result = await this.pool.query(
        'SELECT version, name, applied_at, checksum FROM schema_migrations ORDER BY version'
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get applied migrations:', error.message);
      throw error;
    }
  }

  /**
   * Generate checksum for migration content
   */
  generateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Run pending migrations
   */
  async migrate() {
    console.log('🚀 Starting database migration...\n');

    const availableMigrations = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    const pendingMigrations = availableMigrations.filter(
      migration => !appliedVersions.has(migration.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Database is up to date. No migrations to apply.\n');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):\n`);
    pendingMigrations.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration.version} - ${migration.name}`);
    });
    console.log();

    // Apply each migration in transaction
    for (const migration of pendingMigrations) {
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        console.log(`⏳ Applying migration: ${migration.version} - ${migration.name}`);
        
        const content = fs.readFileSync(migration.path, 'utf8');
        const checksum = this.generateChecksum(content);
        
        // Execute migration SQL
        await client.query(content);
        
        // Record migration as applied
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, checksum]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Applied migration: ${migration.version}`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply migration ${migration.version}:`, error.message);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(`\n🎉 Successfully applied ${pendingMigrations.length} migration(s)!`);
  }

  /**
   * Show migration status
   */
  async status() {
    console.log('📊 Migration Status:\n');

    const availableMigrations = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    console.log('Applied Migrations:');
    appliedMigrations.forEach(migration => {
      console.log(`✅ ${migration.version} - ${migration.name} (${migration.applied_at.toLocaleDateString()})`);
    });

    const pendingMigrations = availableMigrations.filter(
      migration => !appliedVersions.has(migration.version)
    );

    if (pendingMigrations.length > 0) {
      console.log('\nPending Migrations:');
      pendingMigrations.forEach(migration => {
        console.log(`⏳ ${migration.version} - ${migration.name}`);
      });
    }

    console.log(`\nTotal: ${appliedMigrations.length} applied, ${pendingMigrations.length} pending\n`);
  }

  /**
   * Create new migration file
   */
  async createMigration(name) {
    if (!name) {
      throw new Error('Migration name is required');
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const version = `${timestamp}`;
    const filename = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Version: ${version}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Remember to add appropriate indexes:
-- CREATE INDEX idx_example_table_name ON example_table(name);
`;

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration: ${filename}`);
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const migrationName = args[1];

  // Load configuration
  const config = {
    database: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'neurogrid',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
  };

  const manager = new MigrationManager(config);

  try {
    await manager.initialize();

    switch (command) {
      case 'migrate':
        await manager.migrate();
        break;
        
      case 'status':
        await manager.status();
        break;
        
      case 'create':
        if (!migrationName) {
          console.error('❌ Migration name is required for create command');
          console.log('Usage: npm run migration create "migration name"');
          process.exit(1);
        }
        await manager.createMigration(migrationName);
        break;
        
      default:
        console.log(`
NeuroGrid Migration Manager

Usage:
  npm run migration migrate    - Apply pending migrations
  npm run migration status     - Show migration status  
  npm run migration create "name" - Create new migration

Examples:
  npm run migration create "add user profiles table"
  npm run migration migrate
  npm run migration status
        `);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = MigrationManager;