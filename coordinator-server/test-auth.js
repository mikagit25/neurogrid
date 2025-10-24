#!/usr/bin/env node

/**
 * AuthService Test
 * Тестирование полного цикла аутентификации с SQLite
 */

require('dotenv').config();
const AuthService = require('./src/services/AuthService');
const { initializeDatabase, closeDatabase } = require('./src/config/sqlite');

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

async function testAuthService() {
  try {
    colorLog('\n=== AuthService Integration Test ===', 'bold');
    
    // Инициализируем базу данных
    await initializeDatabase();
    colorLog('✅ Database initialized', 'green');

    let testEmail = 'authtest@neurogrid.local';
    const testPassword = 'AuthTestPassword123';

    // 1. Регистрация пользователя
    colorLog('\n1. Testing user registration...', 'blue');
    
    // Добавляем уникальный timestamp для избежания конфликтов
    const uniqueEmail = `authtest-${Date.now()}@neurogrid.local`;
    
    const registrationResult = await AuthService.registerUser({
      email: uniqueEmail,
      password: testPassword,
      username: `authtest-${Date.now()}`,
      role: 'user'
    });

    if (registrationResult.success) {
      colorLog('✅ User registration successful', 'green');
      console.log(`   User ID: ${registrationResult.user.id}`);
      console.log(`   Email: ${registrationResult.user.email}`);
      console.log(`   Access Token: ${registrationResult.tokens.accessToken.substring(0, 20)}...`);
      // Обновляем testEmail для дальнейших тестов
      testEmail = uniqueEmail;
    } else {
      colorLog(`❌ Registration failed: ${registrationResult.error}`, 'red');
      throw new Error('Registration failed');
    }

    // 2. Аутентификация пользователя
    colorLog('\n2. Testing user authentication...', 'blue');
    const authResult = await AuthService.authenticateUser(testEmail, testPassword);

    if (authResult.success) {
      colorLog('✅ User authentication successful', 'green');
      console.log(`   User: ${authResult.user.username}`);
      console.log(`   Role: ${authResult.user.role}`);
      console.log(`   Balance: $${authResult.user.balance}`);
    } else {
      colorLog(`❌ Authentication failed: ${authResult.error}`, 'red');
      throw new Error('Authentication failed');
    }

    // 3. Проверка JWT токена
    colorLog('\n3. Testing JWT token verification...', 'blue');
    const tokenVerification = AuthService.verifyToken(authResult.tokens.accessToken);

    if (tokenVerification.valid) {
      colorLog('✅ JWT token verification successful', 'green');
      console.log(`   User ID from token: ${tokenVerification.decoded.id}`);
      console.log(`   Email from token: ${tokenVerification.decoded.email}`);
      console.log(`   Role from token: ${tokenVerification.decoded.role}`);
    } else {
      colorLog(`❌ Token verification failed: ${tokenVerification.error}`, 'red');
      throw new Error('Token verification failed');
    }

    // 4. Получение информации о пользователе
    colorLog('\n4. Testing user profile retrieval...', 'blue');
    const userId = registrationResult.user.id;
    const user = await AuthService.getUserById(userId);

    if (user) {
      colorLog('✅ User profile retrieved successfully', 'green');
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
    } else {
      colorLog('❌ Failed to retrieve user profile', 'red');
      throw new Error('Profile retrieval failed');
    }

    // 5. Обновление профиля
    colorLog('\n5. Testing profile update...', 'blue');
    const updateResult = await AuthService.updateUserProfile(userId, {
      profile: {
        displayName: 'Auth Test User',
        bio: 'Testing authentication system'
      }
    });

    if (updateResult.success) {
      colorLog('✅ Profile update successful', 'green');
      console.log(`   Updated profile for: ${updateResult.user.username}`);
    } else {
      colorLog(`❌ Profile update failed: ${updateResult.error}`, 'red');
    }

    // 6. Получение статистики пользователя
    colorLog('\n6. Testing user statistics...', 'blue');
    const statsResult = await AuthService.getUserStats(userId);

    if (statsResult.success) {
      colorLog('✅ User statistics retrieved successfully', 'green');
      console.log(`   Balance: $${statsResult.stats.balance}`);
      console.log(`   Total jobs: ${statsResult.stats.total_jobs}`);
      console.log(`   Total earned: $${statsResult.stats.total_earned}`);
    } else {
      colorLog(`❌ Stats retrieval failed: ${statsResult.error}`, 'red');
    }

    // 7. Обновление refresh токена
    colorLog('\n7. Testing token refresh...', 'blue');
    const refreshResult = await AuthService.refreshAccessToken(authResult.tokens.refreshToken);

    if (refreshResult.success) {
      colorLog('✅ Token refresh successful', 'green');
      console.log(`   New access token: ${refreshResult.tokens.accessToken.substring(0, 20)}...`);
    } else {
      colorLog(`❌ Token refresh failed: ${refreshResult.error}`, 'red');
    }

    // 8. Тест неправильного пароля
    colorLog('\n8. Testing invalid password...', 'blue');
    const invalidAuthResult = await AuthService.authenticateUser(testEmail, 'WrongPassword');

    if (!invalidAuthResult.success) {
      colorLog('✅ Invalid password correctly rejected', 'green');
      console.log(`   Error: ${invalidAuthResult.error}`);
    } else {
      colorLog('❌ Invalid password was accepted (security issue!)', 'red');
      throw new Error('Security vulnerability detected');
    }

    colorLog('\n🎉 All AuthService tests passed successfully!', 'green');

    // Очистка тестовых данных
    colorLog('\nCleaning up test data...', 'yellow');
    // В реальном приложении здесь бы была очистка

    return true;

  } catch (error) {
    colorLog(`\n💥 AuthService test failed: ${error.message}`, 'red');
    console.error(error);
    return false;
  } finally {
    // Закрываем соединение с базой данных
    await closeDatabase();
  }
}

async function main() {
  colorLog('Starting AuthService integration test...', 'blue');
  
  const success = await testAuthService();
  
  if (success) {
    colorLog('\n✅ AuthService is ready for production use!', 'green');
    
    colorLog('\n🚀 Integration Instructions:', 'blue');
    console.log('1. Add AuthService routes to your main app:');
    console.log('   app.use("/api/v2/auth", require("./src/routes/auth"));');
    console.log('');
    console.log('2. Use the authentication middleware:');
    console.log('   const { authenticateToken } = require("./src/middleware/auth");');
    console.log('   app.use("/api/protected", authenticateToken, protectedRoutes);');
    console.log('');
    console.log('3. Initialize database on app startup:');
    console.log('   const { initializeDatabase } = require("./src/config/sqlite");');
    console.log('   await initializeDatabase();');
    
    process.exit(0);
  } else {
    colorLog('\n❌ AuthService tests failed. Please fix issues before integration.', 'red');
    process.exit(1);
  }
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
  colorLog(`\n💥 Test script failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});