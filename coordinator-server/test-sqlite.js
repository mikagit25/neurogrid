#!/usr/bin/env node

/**
 * SQLite Test Script for New Database Models
 * Тестирование новых компонентов с SQLite
 */

require('dotenv').config();
const UserServiceSQLite = require('./src/services/UserServiceSQLite');
const { db, initializeDatabase } = require('./src/config/sqlite');
const logger = require('./src/utils/logger');

// Цвета для консоли
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class SQLiteTestSuite {
  constructor() {
    this.name = 'SQLiteTestSuite';
  }

  async initializeDatabase() {
    try {
      await initializeDatabase();
      colorLog('✅ SQLite database initialized', 'green');
      return true;
    } catch (error) {
      colorLog(`❌ Database initialization failed: ${error.message}`, 'red');
      return false;
    }
  }

  async testDatabaseConnection() {
    try {
      const result = await UserServiceSQLite.testConnection();
      
      if (result.success) {
        colorLog('✅ Database connection successful', 'green');
        console.log(`   Database: ${result.database}`);
        console.log(`   Timestamp: ${result.timestamp}`);
        return true;
      } else {
        colorLog(`❌ Database connection failed: ${result.error}`, 'red');
        return false;
      }
    } catch (error) {
      colorLog(`❌ Connection test error: ${error.message}`, 'red');
      return false;
    }
  }

  async checkRequiredTables() {
    try {
      const requiredTables = [
        'users',
        'user_balances',
        'transactions',
        'nodes',
        'jobs'
      ];

      const results = {};

      for (const table of requiredTables) {
        const result = await db.query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `, [table]);
        
        results[table] = result.rows.length > 0;
      }

      colorLog('📋 Table existence check:', 'blue');
      Object.entries(results).forEach(([table, exists]) => {
        console.log(`   ${table}: ${exists ? '✅' : '❌'}`);
      });

      return results;

    } catch (error) {
      colorLog(`❌ Error checking tables: ${error.message}`, 'red');
      return null;
    }
  }

  async createTestUser() {
    try {
      const testEmail = 'test@neurogrid.local';
      
      // Проверяем, существует ли уже тестовый пользователь
      const existing = await UserServiceSQLite.findByEmail(testEmail);
      if (existing) {
        colorLog('⚠️  Test user already exists, using existing', 'yellow');
        return existing;
      }

      // Создаем тестового пользователя
      const testUser = await UserServiceSQLite.create({
        username: 'testuser',
        email: testEmail,
        password: 'TestPassword123',
        role: 'user'
      });

      colorLog('✅ Test user created successfully', 'green');
      console.log(`   User ID: ${testUser.id}`);
      console.log(`   Email: ${testUser.email}`);

      return testUser;

    } catch (error) {
      colorLog(`❌ Error creating test user: ${error.message}`, 'red');
      throw error;
    }
  }

  async testUserAuthentication() {
    try {
      const testEmail = 'test@neurogrid.local';
      const testPassword = 'TestPassword123';

      const result = await UserServiceSQLite.verifyPassword(testEmail, testPassword);
      
      if (result.success) {
        colorLog('✅ User authentication successful', 'green');
        return true;
      } else {
        colorLog(`❌ Authentication failed: ${result.error}`, 'red');
        return false;
      }

    } catch (error) {
      colorLog(`❌ Authentication test error: ${error.message}`, 'red');
      return false;
    }
  }

  async testTransactionCreation() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserServiceSQLite.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      // Создаем тестовую транзакцию
      const result = await db.query(`
        INSERT INTO transactions (user_id, transaction_type, amount, description, status)
        VALUES (?, ?, ?, ?, ?)
      `, [user.id, 'credit', 100.00, 'Test deposit transaction', 'completed']);

      colorLog('✅ Test transaction created successfully', 'green');
      console.log(`   Transaction ID: ${result.lastID}`);
      console.log(`   Amount: $100.00`);

      return { id: result.lastID, amount: 100.00 };

    } catch (error) {
      colorLog(`❌ Transaction creation failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async testProfileUpdate() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserServiceSQLite.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      const updatedUser = await UserServiceSQLite.updateProfile(user.id, {
        profile: {
          displayName: 'Test User',
          bio: 'This is a test user profile'
        }
      });

      colorLog('✅ Profile update successful', 'green');
      console.log(`   Profile updated for: ${updatedUser.username}`);

      return updatedUser;

    } catch (error) {
      colorLog(`❌ Profile update failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async testUserStats() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserServiceSQLite.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      const stats = await UserServiceSQLite.getStats(user.id);

      colorLog('✅ User stats retrieved successfully', 'green');
      console.log(`   Total jobs: ${stats.total_jobs}`);
      console.log(`   Balance: $${stats.balance}`);
      console.log(`   Total earned: $${stats.total_earned}`);

      return stats;

    } catch (error) {
      colorLog(`❌ Stats retrieval failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async runFullTest() {
    try {
      colorLog('\n=== SQLite Database Models Test ===', 'bold');
      colorLog('Starting comprehensive test with SQLite...', 'blue');

      // 1. Инициализация базы данных
      const initOk = await this.initializeDatabase();
      if (!initOk) {
        throw new Error('Database initialization failed');
      }

      // 2. Проверка подключения
      const connectionOk = await this.testDatabaseConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed');
      }

      // 3. Проверка таблиц
      const tables = await this.checkRequiredTables();
      if (!tables) {
        throw new Error('Failed to check required tables');
      }

      // 4. Создание тестового пользователя
      const testUser = await this.createTestUser();

      // 5. Тестирование аутентификации
      const authOk = await this.testUserAuthentication();
      if (!authOk) {
        throw new Error('Authentication test failed');
      }

      // 6. Тестирование транзакций
      const testTransaction = await this.testTransactionCreation();

      // 7. Тестирование обновления профиля
      const profileUpdate = await this.testProfileUpdate();

      // 8. Тестирование статистики
      const userStats = await this.testUserStats();

      colorLog('\n🎉 All tests passed successfully!', 'green');

      return {
        success: true,
        results: {
          initialization: initOk,
          connection: connectionOk,
          tables,
          user: testUser,
          authentication: authOk,
          transaction: testTransaction,
          profileUpdate,
          userStats
        }
      };

    } catch (error) {
      colorLog(`\n💥 Test suite failed: ${error.message}`, 'red');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanupTestData() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserServiceSQLite.findByEmail(testEmail);
      
      if (!user) {
        colorLog('⚠️  No test user found to cleanup', 'yellow');
        return;
      }

      // Удаляем связанные данные (SQLite удалит через CASCADE)
      await db.query('DELETE FROM users WHERE email = ?', [testEmail]);
      
      colorLog('✅ Test data cleaned up successfully', 'green');

    } catch (error) {
      colorLog(`❌ Cleanup failed: ${error.message}`, 'red');
      throw error;
    }
  }
}

async function runTest() {
  const suite = new SQLiteTestSuite();
  const result = await suite.runFullTest();

  if (result.success) {
    console.log('\n📊 Test Summary:');
    console.log('- Database Initialization:', result.results.initialization ? '✅' : '❌');
    console.log('- Connection Test:', result.results.connection ? '✅' : '❌');
    console.log('- User Creation:', result.results.user ? '✅' : '❌');
    console.log('- Authentication:', result.results.authentication ? '✅' : '❌');
    console.log('- Transaction Creation:', result.results.transaction ? '✅' : '❌');
    console.log('- Profile Update:', result.results.profileUpdate ? '✅' : '❌');
    console.log('- User Stats:', result.results.userStats ? '✅' : '❌');

    colorLog('\n🚀 Next Steps:', 'blue');
    console.log('1. Run "node test-sqlite.js cleanup" to clean test data');
    console.log('2. Integrate SQLite service into your main application');
    console.log('3. When ready, migrate to PostgreSQL for production');
  } else {
    process.exit(1);
  }
}

async function runCleanup() {
  const suite = new SQLiteTestSuite();
  await suite.initializeDatabase();
  await suite.cleanupTestData();
}

async function showInfo() {
  colorLog('\n=== SQLite Database Implementation ===', 'bold');
  
  colorLog('\n💡 About this implementation:', 'blue');
  console.log('- Uses SQLite3 for local development');
  console.log('- Compatible with existing PostgreSQL schema');
  console.log('- Includes all NeuroGrid user management features');
  console.log('- Easy migration path to PostgreSQL');
  
  colorLog('\n📁 Database location:', 'blue');
  console.log('- File: coordinator-server/data/neurogrid.db');
  console.log('- Auto-created on first run');
  
  colorLog('\n🔧 Available features:', 'blue');
  console.log('✅ User registration and authentication');
  console.log('✅ Password hashing with bcrypt');
  console.log('✅ User profiles and settings');
  console.log('✅ Transaction tracking');
  console.log('✅ Node management (tables ready)');
  console.log('✅ Job management (tables ready)');
  
  colorLog('\n⚡ Performance notes:', 'blue');
  console.log('- SQLite is single-threaded but very fast for dev');
  console.log('- Perfect for testing and small deployments');
  console.log('- Easy backup (just copy the .db file)');
}

function showHelp() {
  colorLog('\n=== SQLite Database Test Script ===', 'bold');
  console.log('\nAvailable commands:');
  console.log('  test       - Run full test suite');
  console.log('  cleanup    - Clean up test data');
  console.log('  info       - Show implementation info');
  console.log('  help       - Show this help message');
  console.log('\nExamples:');
  console.log('  node test-sqlite.js test');
  console.log('  node test-sqlite.js cleanup');
}

async function main() {
  const command = process.argv[2] || 'test';

  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

  switch (command) {
    case 'test':
      await runTest();
      break;
    
    case 'cleanup':
      await runCleanup();
      break;
    
    case 'info':
      await showInfo();
      break;
    
    case 'help':
      showHelp();
      break;
    
    default:
      colorLog(`❌ Unknown command: ${command}`, 'red');
      showHelp();
      process.exit(1);
  }

  // Закрываем соединение с базой данных
  try {
    await db.close();
  } catch (error) {
    // Игнорируем ошибки при закрытии
  }

  colorLog('\nTest completed! 🎉', 'green');
}

process.on('unhandledRejection', (reason, promise) => {
  colorLog(`\n💥 Unhandled Rejection: ${reason}`, 'red');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  colorLog(`\n💥 Uncaught Exception: ${error.message}`, 'red');
  process.exit(1);
});

main().catch((error) => {
  colorLog(`\n💥 Script failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});