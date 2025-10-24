#!/usr/bin/env node

/**
 * Test Script for New Database Models
 * Скрипт для тестирования новых компонентов базы данных
 * 
 * Использование:
 * node test-models.js [command]
 * 
 * Команды:
 * - test: Полное тестирование всех моделей
 * - cleanup: Очистка тестовых данных
 * - migrate: Миграция из AuthManager (если доступен)
 * - connection: Проверка подключения к БД
 */

require('dotenv').config();
const dbMigration = require('./src/utils/dbMigration');
const logger = require('./src/utils/logger');
const path = require('path');

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

async function runTest() {
  try {
    colorLog('\n=== Testing New Database Models ===', 'bold');
    colorLog('Starting comprehensive test...', 'blue');

    const result = await dbMigration.runFullTest();

    if (result.success) {
      colorLog('\n✅ All tests passed successfully!', 'green');
      
      console.log('\nTest Results:');
      console.log('- Database Connection:', result.results.connection ? '✅' : '❌');
      console.log('- User Creation:', result.results.user ? '✅' : '❌');
      console.log('- Authentication:', result.results.authentication ? '✅' : '❌');
      console.log('- Transaction Creation:', result.results.transaction ? '✅' : '❌');
      console.log('- Node Creation:', result.results.node ? '✅' : '❌');
      console.log('- Job Creation:', result.results.job ? '✅' : '❌');

      colorLog('\nDatabase Tables Status:', 'blue');
      if (result.results.tables) {
        Object.entries(result.results.tables).forEach(([table, exists]) => {
          console.log(`- ${table}: ${exists ? '✅' : '❌'}`);
        });
      }

    } else {
      colorLog(`\n❌ Tests failed: ${result.error}`, 'red');
      process.exit(1);
    }

  } catch (error) {
    colorLog(`\n💥 Test execution failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

async function runCleanup() {
  try {
    colorLog('\n=== Cleaning Up Test Data ===', 'bold');
    colorLog('Removing test data...', 'yellow');

    await dbMigration.cleanupTestData();
    colorLog('✅ Test data cleaned up successfully!', 'green');

  } catch (error) {
    colorLog(`\n❌ Cleanup failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

async function testConnection() {
  try {
    colorLog('\n=== Testing Database Connection ===', 'bold');
    
    const connected = await dbMigration.testDatabaseConnection();
    
    if (connected) {
      colorLog('✅ Database connection successful!', 'green');
    } else {
      colorLog('❌ Database connection failed!', 'red');
      process.exit(1);
    }

  } catch (error) {
    colorLog(`\n💥 Connection test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

async function runMigration() {
  try {
    colorLog('\n=== Migration from AuthManager ===', 'bold');
    colorLog('Looking for existing AuthManager...', 'blue');

    // Попытаемся найти существующий AuthManager
    let authManager = null;
    try {
      const AuthManager = require('./src/auth/AuthManager');
      authManager = AuthManager;
    } catch (error) {
      colorLog('⚠️  AuthManager not found or not accessible', 'yellow');
      colorLog('This is normal if you are starting fresh', 'yellow');
      return;
    }

    const result = await dbMigration.migrateUsersFromAuthManager(authManager);
    
    colorLog(`✅ Migration completed!`, 'green');
    console.log(`- Users migrated: ${result.migrated}`);
    console.log(`- Errors: ${result.errors}`);

  } catch (error) {
    colorLog(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

function showHelp() {
  colorLog('\n=== Database Models Test Script ===', 'bold');
  console.log('\nAvailable commands:');
  console.log('  test       - Run full test suite for all models');
  console.log('  cleanup    - Clean up test data');
  console.log('  connection - Test database connection only');
  console.log('  migrate    - Migrate users from AuthManager');
  console.log('  help       - Show this help message');
  console.log('\nExamples:');
  console.log('  node test-models.js test');
  console.log('  node test-models.js cleanup');
  console.log('  node test-models.js connection');
}

async function main() {
  const command = process.argv[2] || 'help';

  // Настройка логгера для скрипта
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

  switch (command) {
    case 'test':
      await runTest();
      break;
    
    case 'cleanup':
      await runCleanup();
      break;
    
    case 'connection':
      await testConnection();
      break;
    
    case 'migrate':
      await runMigration();
      break;
    
    case 'help':
      showHelp();
      break;
    
    default:
      colorLog(`❌ Unknown command: ${command}`, 'red');
      showHelp();
      process.exit(1);
  }

  // Закрываем подключения к БД
  try {
    const { db } = require('./src/config/database');
    if (db.pool) {
      await db.pool.end();
    }
  } catch (error) {
    // Игнорируем ошибки при закрытии
  }

  colorLog('\nDone! 🎉', 'green');
}

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  colorLog(`\n💥 Unhandled Rejection at: ${promise}`, 'red');
  colorLog(`Reason: ${reason}`, 'red');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  colorLog(`\n💥 Uncaught Exception: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

// Запускаем основную функцию
main().catch((error) => {
  colorLog(`\n💥 Script failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});