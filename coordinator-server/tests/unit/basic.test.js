const logger = require('../../src/utils/logger');

describe('Test Environment', () => {
  test('should have working test setup', () => {
    expect(true).toBe(true);
  });

  test('should have working logger mock', () => {
    logger.info('Test message');
    expect(logger.info).toHaveBeenCalledWith('Test message');
  });

  test('should have jest-extended matchers', () => {
    expect([1, 2, 3]).toEqual(expect.arrayContaining([1, 2]));
  });
});
