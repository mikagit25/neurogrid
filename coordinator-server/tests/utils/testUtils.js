/**
 * Test utilities for unit and integration tests
 */

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

  static async cleanupTestUser(_userId) {
    // Cleanup test user - implementation depends on your User model
    try {
      // You can implement actual cleanup here if needed
      // Return after try/catch, not inside try
    } catch (error) {
      console.error('Cleanup failed:', error);
      return false;
    }
    return true;
  }

  static async cleanup() {
    // General cleanup function
    return true;
  }
}

module.exports = TestUtils;
