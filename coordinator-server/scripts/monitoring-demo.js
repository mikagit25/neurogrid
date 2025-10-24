#!/usr/bin/env node

/**
 * Monitoring and Metrics Demo Script
 * 
 * Demonstrates comprehensive monitoring capabilities including:
 * - Prometheus metrics collection
 * - System performance monitoring
 * - Health checks and alerting
 * - Dashboard data aggregation
 */

const express = require('express');
const MonitoringService = require('../src/services/MonitoringService');
const PrometheusExporter = require('../src/services/PrometheusExporter');

class MonitoringDemo {
  constructor() {
    this.app = express();
    this.port = 3457;
    this.metricsPort = 9090;
    this.monitoringService = null;
    this.prometheusExporter = null;
    this.server = null;
    this.metricsServer = null;
    this.simulationInterval = null;
  }

  async initialize() {
    console.log('📊 Starting Monitoring and Metrics Demo...\n');

    // Initialize monitoring service
    this.monitoringService = new MonitoringService();
    this.monitoringService.initialize();

    // Initialize Prometheus exporter
    this.prometheusExporter = new PrometheusExporter(this.monitoringService, {
      port: this.metricsPort
    });

    // Setup Express app
    this.app.use(express.json());
    this.app.use(this.prometheusExporter.createMiddleware());

    this.setupRoutes();
    this.setupHealthChecks();
    this.setupAlertRules();

    console.log('✅ Monitoring services initialized\n');
  }

  setupRoutes() {
    // Dashboard endpoint
    this.app.get('/dashboard', (req, res) => {
      const dashboardData = {
        timestamp: new Date().toISOString(),
        systemHealth: this.getSystemHealth(),
        metrics: this.getMetricsSummary(),
        alerts: this.getActiveAlerts(),
        performance: this.getPerformanceData()
      };

      res.json(dashboardData);
    });

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const healthChecks = await this.runHealthChecks();
      const overallHealth = Object.values(healthChecks).every(check => 
        check.status === 'healthy');

      res.status(overallHealth ? 200 : 503).json({
        status: overallHealth ? 'healthy' : 'unhealthy',
        checks: healthChecks,
        timestamp: new Date().toISOString()
      });
    });

    // Metrics endpoint (JSON format)
    this.app.get('/metrics/json', async (req, res) => {
      try {
        const metrics = await this.prometheusExporter.getMetricsJSON();
        res.json({
          timestamp: new Date().toISOString(),
          metrics: metrics
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get metrics',
          message: error.message
        });
      }
    });

    // Simulate different types of requests for demo
    this.app.get('/api/test', (req, res) => {
      // Simulate processing time
      const processingTime = Math.random() * 500 + 100; // 100-600ms
      
      setTimeout(() => {
        if (Math.random() < 0.1) {
          // 10% chance of error for demo
          this.prometheusExporter.recordError('api_error', 'warning');
          res.status(500).json({ error: 'Simulated error' });
        } else {
          res.json({
            message: 'Test API response',
            processingTime: processingTime,
            timestamp: new Date().toISOString()
          });
        }
      }, processingTime);
    });

    // Simulate heavy computation endpoint
    this.app.post('/api/compute', (req, res) => {
      const { hours = 1, nodeType = 'gpu' } = req.body;
      
      // Record compute hours
      this.prometheusExporter.recordComputeHours(hours, nodeType);
      
      // Simulate task completion
      this.prometheusExporter.recordTask('completed', 'compute');
      
      res.json({
        message: 'Compute task submitted',
        hours: hours,
        nodeType: nodeType,
        taskId: `task_${Date.now()}`
      });
    });

    // Load testing endpoint
    this.app.get('/load-test', async (req, res) => {
      const requests = parseInt(req.query.requests) || 100;
      const concurrent = parseInt(req.query.concurrent) || 10;
      
      console.log(`🚀 Starting load test: ${requests} requests, ${concurrent} concurrent`);
      
      const startTime = Date.now();
      const results = await this.runLoadTest(requests, concurrent);
      const duration = Date.now() - startTime;
      
      res.json({
        loadTest: {
          requests: requests,
          concurrent: concurrent,
          duration: duration,
          results: results
        }
      });
    });
  }

  setupHealthChecks() {
    // Database health check (simulated)
    this.addHealthCheck('database', async () => {
      // Simulate database check
      const latency = Math.random() * 100;
      if (latency > 80) {
        throw new Error('Database latency too high');
      }
      return { status: 'healthy', latency };
    });

    // Redis health check (simulated)
    this.addHealthCheck('redis', async () => {
      // Simulate Redis check
      const connected = Math.random() > 0.05; // 95% uptime
      if (!connected) {
        throw new Error('Redis connection failed');
      }
      return { status: 'healthy', connected: true };
    });

    // External API health check (simulated)
    this.addHealthCheck('external_api', async () => {
      // Simulate external API check
      const responseTime = Math.random() * 200;
      if (responseTime > 150) {
        throw new Error('External API slow response');
      }
      return { status: 'healthy', responseTime };
    });
  }

  setupAlertRules() {
    // CPU usage alert
    this.addAlertRule('high_cpu', () => {
      const cpuUsage = this.getSystemHealth().cpu;
      return cpuUsage > 80;
    }, 'warning');

    // Memory usage alert
    this.addAlertRule('high_memory', () => {
      const memoryUsage = this.getSystemHealth().memory;
      return memoryUsage > 85;
    }, 'critical');

    // Error rate alert
    this.addAlertRule('high_error_rate', () => {
      const errorRate = this.getMetricsSummary().errorRate;
      return errorRate > 5; // 5% error rate
    }, 'warning');
  }

  addHealthCheck(name, checkFunction) {
    if (this.monitoringService.addHealthCheck) {
      this.monitoringService.addHealthCheck(name, checkFunction);
    }
  }

  addAlertRule(name, condition, severity) {
    if (this.monitoringService.addAlertRule) {
      this.monitoringService.addAlertRule(name, condition, severity);
    }
  }

  async runHealthChecks() {
    if (this.monitoringService.runHealthChecks) {
      return await this.monitoringService.runHealthChecks();
    }
    
    // Fallback simulated health checks
    return {
      system: { status: 'healthy', timestamp: new Date().toISOString() },
      database: { status: 'healthy', timestamp: new Date().toISOString() },
      cache: { status: 'healthy', timestamp: new Date().toISOString() }
    };
  }

  getSystemHealth() {
    // Simulate system health data
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: {
        latency: Math.random() * 50,
        throughput: Math.random() * 1000
      },
      uptime: process.uptime()
    };
  }

  getMetricsSummary() {
    // Get current metrics summary
    return {
      totalRequests: Math.floor(Math.random() * 10000),
      activeUsers: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 10,
      avgResponseTime: Math.random() * 500 + 100,
      throughput: Math.random() * 100 + 50,
      cacheHitRatio: Math.random() * 0.3 + 0.7 // 70-100%
    };
  }

  getActiveAlerts() {
    // Simulate some active alerts
    const alerts = [];
    
    if (Math.random() < 0.3) {
      alerts.push({
        id: 'alert_001',
        type: 'performance',
        severity: 'warning',
        message: 'High response time detected',
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString()
      });
    }
    
    if (Math.random() < 0.1) {
      alerts.push({
        id: 'alert_002',
        type: 'system',
        severity: 'critical',
        message: 'Memory usage above 90%',
        timestamp: new Date(Date.now() - Math.random() * 1800000).toISOString()
      });
    }
    
    return alerts;
  }

  getPerformanceData() {
    // Generate sample performance data
    const now = Date.now();
    const points = 60; // Last 60 data points
    
    const generateTimeSeries = (baseValue, variance) => {
      const data = [];
      for (let i = points; i >= 0; i--) {
        data.push({
          timestamp: now - (i * 60000), // 1 minute intervals
          value: baseValue + (Math.random() - 0.5) * variance
        });
      }
      return data;
    };
    
    return {
      cpu: generateTimeSeries(45, 30),
      memory: generateTimeSeries(60, 20),
      responseTime: generateTimeSeries(200, 100),
      throughput: generateTimeSeries(100, 50)
    };
  }

  async runLoadTest(totalRequests, concurrent) {
    const results = {
      successful: 0,
      failed: 0,
      totalTime: 0,
      avgResponseTime: 0
    };

    const makeRequest = async () => {
      const start = Date.now();
      try {
        const response = await fetch(`http://localhost:${this.port}/api/test`);
        const duration = Date.now() - start;
        results.totalTime += duration;
        
        if (response.ok) {
          results.successful++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }
    };

    // Run requests in batches
    const batchSize = concurrent;
    const batches = Math.ceil(totalRequests / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchRequests = Math.min(batchSize, totalRequests - (batch * batchSize));
      const promises = Array(batchRequests).fill().map(() => makeRequest());
      await Promise.all(promises);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    results.avgResponseTime = results.totalTime / totalRequests;
    return results;
  }

  startSimulation() {
    // Simulate various metrics updates
    this.simulationInterval = setInterval(() => {
      // Simulate user activity
      const activeUsers = Math.floor(Math.random() * 1000) + 100;
      if (this.monitoringService.updateActiveUsers) {
        this.monitoringService.updateActiveUsers(activeUsers);
      }

      // Simulate cache hit ratio updates
      const cacheHitRatio = Math.random() * 0.3 + 0.7; // 70-100%
      this.prometheusExporter.updateCacheHitRatio(cacheHitRatio);

      // Occasionally simulate rate limiting
      if (Math.random() < 0.1) {
        this.prometheusExporter.recordRateLimitedRequest();
      }

      // Simulate database queries
      const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
      const operation = operations[Math.floor(Math.random() * operations.length)];
      const status = Math.random() > 0.05 ? 'success' : 'error';
      this.prometheusExporter.recordDatabaseQuery(operation, status);

    }, 5000); // Every 5 seconds
  }

  async startServers() {
    // Start main demo server
    this.server = this.app.listen(this.port, () => {
      console.log(`🌐 Demo server running at http://localhost:${this.port}`);
    });

    // Start Prometheus metrics server
    this.metricsServer = this.prometheusExporter.startMetricsServer();

    console.log('\n🎯 Available endpoints:');
    console.log(`  GET  http://localhost:${this.port}/dashboard      - Main dashboard`);
    console.log(`  GET  http://localhost:${this.port}/health        - Health checks`);
    console.log(`  GET  http://localhost:${this.port}/metrics/json  - Metrics (JSON)`);
    console.log(`  GET  http://localhost:${this.port}/api/test      - Test API`);
    console.log(`  POST http://localhost:${this.port}/api/compute   - Compute simulation`);
    console.log(`  GET  http://localhost:${this.port}/load-test     - Load testing`);
    console.log(`  GET  http://localhost:${this.metricsPort}/metrics  - Prometheus metrics`);
    
    console.log('\n💡 Try these commands:');
    console.log(`  curl http://localhost:${this.port}/dashboard`);
    console.log(`  curl http://localhost:${this.port}/health`);
    console.log(`  curl http://localhost:${this.port}/load-test?requests=50&concurrent=5`);
    console.log(`  curl -X POST http://localhost:${this.port}/api/compute -d '{"hours":2,"nodeType":"gpu"}' -H "Content-Type: application/json"`);
    
    console.log('\n📊 Prometheus metrics:');
    console.log(`  curl http://localhost:${this.metricsPort}/metrics`);
    console.log('\n⚡ Simulation running... Press Ctrl+C to stop\n');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    
    if (this.server) {
      this.server.close();
    }
    
    if (this.metricsServer) {
      this.metricsServer.close();
    }
    
    console.log('✅ Cleanup completed');
  }

  async showSummary() {
    console.log('\n📈 Monitoring Demo Summary:');
    console.log('━'.repeat(50));
    
    try {
      const health = this.getSystemHealth();
      const metrics = this.getMetricsSummary();
      const alerts = this.getActiveAlerts();
      
      console.log(`System Health:`);
      console.log(`  CPU: ${health.cpu.toFixed(1)}%`);
      console.log(`  Memory: ${health.memory.toFixed(1)}%`);
      console.log(`  Uptime: ${Math.floor(health.uptime)}s`);
      
      console.log(`\nMetrics:`);
      console.log(`  Total Requests: ${metrics.totalRequests}`);
      console.log(`  Active Users: ${metrics.activeUsers}`);
      console.log(`  Error Rate: ${metrics.errorRate.toFixed(2)}%`);
      console.log(`  Avg Response Time: ${metrics.avgResponseTime.toFixed(0)}ms`);
      console.log(`  Cache Hit Ratio: ${(metrics.cacheHitRatio * 100).toFixed(1)}%`);
      
      console.log(`\nAlerts:`);
      if (alerts.length > 0) {
        alerts.forEach(alert => {
          console.log(`  ${alert.severity.toUpperCase()}: ${alert.message}`);
        });
      } else {
        console.log('  No active alerts');
      }
      
    } catch (error) {
      console.log('  Error getting summary:', error.message);
    }
    
    console.log('');
  }
}

// Main execution
async function runDemo() {
  const demo = new MonitoringDemo();
  
  try {
    await demo.initialize();
    await demo.startServers();
    
    // Start simulation
    demo.startSimulation();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⚡ Shutting down monitoring demo...');
      
      await demo.showSummary();
      await demo.cleanup();
      
      process.exit(0);
    });
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    await demo.cleanup();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDemo();
}

module.exports = { MonitoringDemo };