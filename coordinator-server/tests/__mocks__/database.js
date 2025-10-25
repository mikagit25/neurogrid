// Mock database for testing
const mockDb = {
  query: jest.fn(),
  transaction: jest.fn(),
  close: jest.fn(),
  connect: jest.fn(),
  raw: jest.fn()
};

// Mock transaction object
const mockTransaction = {
  query: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn()
};

mockDb.transaction.mockImplementation((callback) => {
  return callback(mockTransaction);
});

module.exports = {
  db: mockDb,
  transaction: mockTransaction
};
