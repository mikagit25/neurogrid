/**
 * Mock Database Service для демонстрации
 * Имитирует работу с PostgreSQL для тестирования без настоящей БД
 */

const logger = require('./logger');

class MockDatabase {
  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.nodes = new Map();
    this.jobs = new Map();
    this.nextId = 1;
  }

  generateId() {
    return (this.nextId++).toString();
  }

  async query(text, params = []) {
    logger.debug('Mock DB Query:', { text: text.substring(0, 100), params });

    // Имитируем разные типы запросов
    if (text.includes('SELECT NOW()')) {
      return {
        rows: [{
          timestamp: new Date(),
          database: 'mock_neurogrid'
        }]
      };
    }

    if (text.includes('information_schema.tables')) {
      // Имитируем проверку существования таблиц
      const tableName = params[0];
      const existingTables = ['users', 'user_balances', 'transactions', 'nodes', 'jobs'];
      return {
        rows: [{ exists: existingTables.includes(tableName) }]
      };
    }

    if (text.includes('INSERT INTO users')) {
      // Имитируем создание пользователя
      const id = this.generateId();
      const user = {
        id,
        username: params[0],
        email: params[1],
        password_hash: params[2],
        role: params[3],
        is_active: true,
        email_verified: false,
        created_at: new Date()
      };
      this.users.set(id, user);
      return { rows: [user] };
    }

    if (text.includes('INSERT INTO user_balances')) {
      // Имитируем создание баланса пользователя
      return { rows: [], rowCount: 1 };
    }

    if (text.includes('SELECT u.*, ub.balance') && text.includes('WHERE u.email')) {
      // Имитируем поиск пользователя по email
      const email = params[0];
      for (const user of this.users.values()) {
        if (user.email === email) {
          return { rows: [{ ...user, balance: 10.0, escrow_balance: 0.0 }] };
        }
      }
      return { rows: [] };
    }

    if (text.includes('INSERT INTO transactions')) {
      // Имитируем создание транзакции
      const id = this.generateId();
      const transaction = {
        id,
        user_id: params[0],
        transaction_type: params[1],
        amount: params[2],
        description: params[3],
        status: params[4],
        created_at: new Date()
      };
      this.transactions.set(id, transaction);
      return { rows: [transaction] };
    }

    // Имитируем успешное выполнение для других запросов
    return { rows: [], rowCount: 0 };
  }

  async transaction(queries) {
    const results = [];
    for (const query of queries) {
      const result = await this.query(query.text, query.params);
      results.push(result);
    }
    return results;
  }

  // Имитируем подключение к пулу
  get pool() {
    return {
      connect: () => Promise.resolve({
        query: this.query.bind(this),
        release: () => {}
      }),
      end: () => Promise.resolve()
    };
  }
}

const mockDb = new MockDatabase();

module.exports = {
  db: mockDb,
  initializeDatabase: () => {
    logger.info('Mock database initialized');
    return Promise.resolve(true);
  },
  closeDatabase: () => {
    logger.info('Mock database closed');
    return Promise.resolve();
  }
};