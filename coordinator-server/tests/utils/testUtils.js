/**
 * Test utilities for unit and integration tests
 */

const crypto = require('crypto');

class TestUtils {
  static randomUsername() {
    return `user_${Math.random().toString(36).substr(2, 8)}`;
  }

  static randomEmail() {
    return `test_${Math.random().toString(36).substr(2, 8)}@example.com`;
  }

  static randomPassword() {
    return `Test123${Math.random().toString(36).substr(2, 4)}!`;
  }

  static async createTestUser(userData = {}) {
    const defaultUser = {
      username: this.randomUsername(),
      email: this.randomEmail(),
      password: this.randomPassword(),
      firstName: 'Test',
      lastName: 'User'
    };

    return { ...defaultUser, ...userData };
  }

  static async cleanupTestUser(userId) {
    // Cleanup test user - implementation depends on your User model
    try {
      // You can implement actual cleanup here if needed
      return true;
    } catch (error) {
      console.error('Cleanup failed:', error);
      return false;
    }
  }

  static async cleanup() {
    // General cleanup function
    return true;
  }
}

module.exports = TestUtils;
