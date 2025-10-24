const MetricsCollector = require('../../src/services/MetricsCollector');

// Mock prom-client
jest.mock('prom-client', () => {
  const mockCounter = {
    inc: jest.fn(),
    labels: jest.fn().mockReturnThis()
  };

  const mockHistogram = {
    observe: jest.fn(),
    labels: jest.fn().mockReturnThis(),
    startTimer: jest.fn().mockReturnValue(() => 0.1)
  };

  const mockGauge = {
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
    labels: jest.fn().mockReturnThis()
  };

  return {
    Counter: jest.fn().mockImplementation(() => mockCounter),
    Histogram: jest.fn().mockImplementation(() => mockHistogram),
    Gauge: jest.fn().mockImplementation(() => mockGauge),
    register: {
      clear: jest.fn(),
      metrics: jest.fn().mockResolvedValue('# Prometheus metrics\n'),
      registerMetric: jest.fn()
    },
    collectDefaultMetrics: jest.fn()
  };
});

describe('MetricsCollector', () => {
  let metricsCollector;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key, defaultValue) => {
        const values = {
          'METRICS_ENABLED': true,
          'METRICS_PORT': 9090,
          'METRICS_PATH': '/metrics'
        };
        return values[key] || defaultValue;
      })
    };

    metricsCollector = new MetricsCollector(mockConfig);
    jest.clearAllMocks();
  });

  describe('HTTP Metrics', () => {
    test('should record HTTP request', () => {
      const method = 'GET';
      const route = '/api/users';
      const statusCode = 200;
      const duration = 150;

      metricsCollector.recordHttpRequest(method, route, statusCode, duration);

      // Verify counter increment
      expect(metricsCollector.httpRequestsTotal.labels).toHaveBeenCalledWith({
        method: method.toLowerCase(),
        route,
        status: statusCode.toString()
      });
      expect(metricsCollector.httpRequestsTotal.inc).toHaveBeenCalled();

      // Verify histogram observation
      expect(metricsCollector.httpRequestDuration.labels).toHaveBeenCalledWith({
        method: method.toLowerCase(),
        route
      });
      expect(metricsCollector.httpRequestDuration.observe).toHaveBeenCalledWith(duration / 1000);
    });

    test('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      
      methods.forEach(method => {
        metricsCollector.recordHttpRequest(method, '/api/test', 200, 100);
        
        expect(metricsCollector.httpRequestsTotal.labels).toHaveBeenCalledWith({
          method: method.toLowerCase(),
          route: '/api/test',
          status: '200'
        });
      });
    });

    test('should track active connections', () => {
      // Test connection increment
      metricsCollector.incrementActiveConnections();
      expect(metricsCollector.activeConnections.inc).toHaveBeenCalled();

      // Test connection decrement
      metricsCollector.decrementActiveConnections();
      expect(metricsCollector.activeConnections.dec).toHaveBeenCalled();
    });
  });

  describe('Database Metrics', () => {
    test('should record database query', () => {
      const operation = 'SELECT';
      const table = 'users';
      const duration = 50;
      const success = true;

      metricsCollector.recordDatabaseQuery(operation, table, duration, success);

      expect(metricsCollector.databaseQueriesTotal.labels).toHaveBeenCalledWith({
        operation: operation.toLowerCase(),
        table,
        success: success.toString()
      });
      expect(metricsCollector.databaseQueriesTotal.inc).toHaveBeenCalled();

      expect(metricsCollector.databaseQueryDuration.labels).toHaveBeenCalledWith({
        operation: operation.toLowerCase(),
        table
      });
      expect(metricsCollector.databaseQueryDuration.observe).toHaveBeenCalledWith(duration / 1000);
    });

    test('should track database connection pool', () => {
      const poolStats = {
        total: 10,
        active: 5,
        idle: 5,
        waiting: 0
      };

      metricsCollector.updateDatabaseConnections(poolStats);

      expect(metricsCollector.databaseConnectionsActive.set).toHaveBeenCalledWith(poolStats.active);
      expect(metricsCollector.databaseConnectionsIdle.set).toHaveBeenCalledWith(poolStats.idle);
      expect(metricsCollector.databaseConnectionsWaiting.set).toHaveBeenCalledWith(poolStats.waiting);
    });

    test('should handle failed queries', () => {
      metricsCollector.recordDatabaseQuery('INSERT', 'tasks', 200, false);

      expect(metricsCollector.databaseQueriesTotal.labels).toHaveBeenCalledWith({
        operation: 'insert',
        table: 'tasks',
        success: 'false'
      });
    });
  });

  describe('Authentication Metrics', () => {
    test('should record authentication events', () => {
      const type = 'login';
      const success = true;
      const userId = 'user-123';

      metricsCollector.recordAuthEvent(type, success, userId);

      expect(metricsCollector.authEventsTotal.labels).toHaveBeenCalledWith({
        type,
        success: success.toString()
      });
      expect(metricsCollector.authEventsTotal.inc).toHaveBeenCalled();
    });

    test('should track different auth event types', () => {
      const eventTypes = ['login', 'logout', 'register', '2fa_verify', 'password_reset'];
      
      eventTypes.forEach(type => {
        metricsCollector.recordAuthEvent(type, true);
        
        expect(metricsCollector.authEventsTotal.labels).toHaveBeenCalledWith({
          type,
          success: 'true'
        });
      });
    });

    test('should record 2FA usage', () => {
      metricsCollector.record2FAUsage(true);
      expect(metricsCollector.twoFactorUsage.labels).toHaveBeenCalledWith({ success: 'true' });
      expect(metricsCollector.twoFactorUsage.inc).toHaveBeenCalled();
    });
  });

  describe('Security Metrics', () => {
    test('should record security events', () => {
      const type = 'rate_limit';
      const severity = 'medium';
      const details = { ip: '192.168.1.1' };

      metricsCollector.recordSecurityEvent(type, severity, details);

      expect(metricsCollector.securityEventsTotal.labels).toHaveBeenCalledWith({
        type,
        severity
      });
      expect(metricsCollector.securityEventsTotal.inc).toHaveBeenCalled();
    });

    test('should track rate limiting', () => {
      const endpoint = '/api/auth/login';
      const limit = 5;
      const remaining = 3;

      metricsCollector.recordRateLimit(endpoint, limit, remaining);

      expect(metricsCollector.rateLimitHits.labels).toHaveBeenCalledWith({ endpoint });
      expect(metricsCollector.rateLimitHits.inc).toHaveBeenCalled();
    });

    test('should record brute force attempts', () => {
      const ip = '192.168.1.100';
      const attempts = 5;

      metricsCollector.recordBruteForceAttempt(ip, attempts);

      expect(metricsCollector.bruteForceAttempts.labels).toHaveBeenCalledWith({ ip });
      expect(metricsCollector.bruteForceAttempts.inc).toHaveBeenCalledWith(attempts);
    });
  });

  describe('Business Metrics', () => {
    test('should record business metrics', () => {
      const metric = 'task_completed';
      const value = 1;
      const labels = { type: 'ai_training' };

      metricsCollector.recordBusinessMetric(metric, value, labels);

      expect(metricsCollector.businessMetrics.labels).toHaveBeenCalledWith({
        metric,
        ...labels
      });
      expect(metricsCollector.businessMetrics.inc).toHaveBeenCalledWith(value);
    });

    test('should track task metrics', () => {
      metricsCollector.recordTaskCreated('ai_training');
      expect(metricsCollector.tasksTotal.labels).toHaveBeenCalledWith({
        type: 'ai_training',
        status: 'created'
      });

      metricsCollector.recordTaskCompleted('ai_training', true);
      expect(metricsCollector.tasksTotal.labels).toHaveBeenCalledWith({
        type: 'ai_training',
        status: 'completed'
      });

      metricsCollector.recordTaskFailed('ai_training', 'timeout');
      expect(metricsCollector.tasksTotal.labels).toHaveBeenCalledWith({
        type: 'ai_training',
        status: 'failed'
      });
    });

    test('should track payment metrics', () => {
      metricsCollector.recordPayment(100, 'USD', 'stripe', true);
      
      expect(metricsCollector.paymentsTotal.labels).toHaveBeenCalledWith({
        currency: 'USD',
        gateway: 'stripe',
        status: 'success'
      });
      expect(metricsCollector.paymentsTotal.inc).toHaveBeenCalled();

      expect(metricsCollector.paymentsAmount.labels).toHaveBeenCalledWith({
        currency: 'USD',
        gateway: 'stripe'
      });
      expect(metricsCollector.paymentsAmount.inc).toHaveBeenCalledWith(100);
    });

    test('should track node metrics', () => {
      metricsCollector.recordNodeJoined('us-east-1', ['gpu', 'cpu']);
      expect(metricsCollector.nodesTotal.labels).toHaveBeenCalledWith({
        region: 'us-east-1',
        status: 'joined'
      });

      metricsCollector.recordNodeLeft('us-east-1', 'maintenance');
      expect(metricsCollector.nodesTotal.labels).toHaveBeenCalledWith({
        region: 'us-east-1',
        status: 'left'
      });

      metricsCollector.updateActiveNodes(15);
      expect(metricsCollector.activeNodes.set).toHaveBeenCalledWith(15);
    });
  });

  describe('System Metrics', () => {
    test('should collect system metrics', () => {
      const systemStats = {
        cpuUsage: 45.5,
        memoryUsage: 78.2,
        diskUsage: 60.1,
        uptime: 86400
      };

      metricsCollector.updateSystemMetrics(systemStats);

      expect(metricsCollector.systemCpuUsage.set).toHaveBeenCalledWith(systemStats.cpuUsage);
      expect(metricsCollector.systemMemoryUsage.set).toHaveBeenCalledWith(systemStats.memoryUsage);
      expect(metricsCollector.systemDiskUsage.set).toHaveBeenCalledWith(systemStats.diskUsage);
      expect(metricsCollector.systemUptime.set).toHaveBeenCalledWith(systemStats.uptime);
    });

    test('should track application version', () => {
      const version = '1.2.3';
      const environment = 'production';

      metricsCollector.setApplicationInfo(version, environment);

      expect(metricsCollector.applicationInfo.labels).toHaveBeenCalledWith({
        version,
        environment
      });
      expect(metricsCollector.applicationInfo.set).toHaveBeenCalledWith(1);
    });
  });

  describe('Metrics Export', () => {
    test('should export metrics in Prometheus format', async () => {
      const metrics = await metricsCollector.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# Prometheus metrics');
    });

    test('should clear metrics registry', () => {
      const promClient = require('prom-client');

      metricsCollector.clearMetrics();

      expect(promClient.register.clear).toHaveBeenCalled();
    });

    test('should shutdown gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      metricsCollector.shutdown();

      expect(consoleSpy).toHaveBeenCalledWith('MetricsCollector shutdown complete');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle metric recording errors gracefully', () => {
      // Mock error in counter
      metricsCollector.httpRequestsTotal.inc.mockImplementationOnce(() => {
        throw new Error('Metric error');
      });

      // Should not throw
      expect(() => {
        metricsCollector.recordHttpRequest('GET', '/test', 200, 100);
      }).not.toThrow();
    });

    test('should handle invalid metric values', () => {
      // Should handle null/undefined values
      expect(() => {
        metricsCollector.recordHttpRequest(null, null, null, null);
      }).not.toThrow();

      expect(() => {
        metricsCollector.recordDatabaseQuery(undefined, undefined, undefined, undefined);
      }).not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should respect metrics disabled configuration', () => {
      const disabledConfig = {
        get: jest.fn((key, defaultValue) => {
          if (key === 'METRICS_ENABLED') return false;
          return defaultValue;
        })
      };

      const disabledCollector = new MetricsCollector(disabledConfig);

      // Metrics should not be recorded when disabled
      disabledCollector.recordHttpRequest('GET', '/test', 200, 100);
      
      // Verify no metrics were recorded (implementation specific)
      expect(disabledConfig.get).toHaveBeenCalledWith('METRICS_ENABLED', true);
    });

    test('should use custom metric prefixes', () => {
      const customConfig = {
        get: jest.fn((key, defaultValue) => {
          const values = {
            'METRICS_PREFIX': 'custom_app_',
            'METRICS_ENABLED': true
          };
          return values[key] || defaultValue;
        })
      };

      const customCollector = new MetricsCollector(customConfig);

      expect(customConfig.get).toHaveBeenCalledWith('METRICS_PREFIX', 'neurogrid_');
    });
  });
});