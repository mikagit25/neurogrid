#!/usr/bin/env node

/**
 * Simple Test Server for NeuroGrid Components
 * Tests core functionality without complex integrations
 */

const express = require('express');
const cors = require('cors');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Test authentication system
app.post('/test/auth', async (req, res) => {
  try {
    const { AuthManager } = require('./src/utils/auth');
    const authManager = new AuthManager();
    
    // Test user creation
    const testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpassword'
    };
    
    const registerResult = await authManager.registerUser(testUser);
    
    if (registerResult.success) {
      // Test login
      const loginResult = await authManager.authenticateUser(
        testUser.email,
        testUser.password
      );
      
      res.json({
        success: true,
        message: 'Authentication system working',
        register: registerResult,
        login: loginResult
      });
    } else {
      res.json({
        success: false,
        message: 'Authentication test failed',
        error: registerResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication test error',
      error: error.message
    });
  }
});

// Test database connection
app.get('/test/database', async (req, res) => {
  try {
    const { db } = require('./src/config/database');
    
    await db.initialize();
    const health = await db.healthCheck();
    
    res.json({
      success: true,
      message: 'Database connection working',
      health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message
    });
  }
});

// Test WebSocket manager
app.get('/test/websocket', (req, res) => {
  try {
    const { WebSocketManager } = require('./src/services/WebSocketManager');
    const wsManager = WebSocketManager.getInstance();
    
    res.json({
      success: true,
      message: 'WebSocket manager initialized',
      connections: wsManager.getConnectionCount()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'WebSocket test failed',
      error: error.message
    });
  }
});

// Test monitoring service
app.get('/test/monitoring', async (req, res) => {
  try {
    const { MonitoringService } = require('./src/services/MonitoringService');
    const monitoring = MonitoringService.getInstance();
    
    await monitoring.initialize();
    const metrics = await monitoring.getMetrics();
    
    res.json({
      success: true,
      message: 'Monitoring service working',
      metrics: Object.keys(metrics)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Monitoring test failed',
      error: error.message
    });
  }
});

// Test all components
app.get('/test/all', async (req, res) => {
  const results = {};
  
  // Test authentication
  try {
    const { AuthManager } = require('./src/utils/auth');
    results.auth = { success: true, message: 'AuthManager loaded' };
  } catch (error) {
    results.auth = { success: false, error: error.message };
  }
  
  // Test database
  try {
    const { db } = require('./src/config/database');
    results.database = { success: true, message: 'Database config loaded' };
  } catch (error) {
    results.database = { success: false, error: error.message };
  }
  
  // Test WebSocket
  try {
    const { WebSocketManager } = require('./src/services/WebSocketManager');
    results.websocket = { success: true, message: 'WebSocketManager loaded' };
  } catch (error) {
    results.websocket = { success: false, error: error.message };
  }
  
  // Test monitoring
  try {
    const { MonitoringService } = require('./src/services/MonitoringService');
    results.monitoring = { success: true, message: 'MonitoringService loaded' };
  } catch (error) {
    results.monitoring = { success: false, error: error.message };
  }
  
  // Test models
  try {
    const { models } = require('./src/models');
    results.models = { success: true, message: 'Models loaded', count: Object.keys(models).length };
  } catch (error) {
    results.models = { success: false, error: error.message };
  }
  
  const successCount = Object.values(results).filter(r => r.success).length;
  const totalCount = Object.keys(results).length;
  
  res.json({
    success: successCount === totalCount,
    message: `${successCount}/${totalCount} components working`,
    results,
    summary: {
      total: totalCount,
      passed: successCount,
      failed: totalCount - successCount
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🧪 NeuroGrid Test Server started on port ${PORT}`);
  logger.info(`📊 Test endpoints available:`);
  logger.info(`  GET  /health - Server health`);
  logger.info(`  POST /test/auth - Authentication system`);
  logger.info(`  GET  /test/database - Database connection`);
  logger.info(`  GET  /test/websocket - WebSocket manager`);
  logger.info(`  GET  /test/monitoring - Monitoring service`);
  logger.info(`  GET  /test/all - All components overview`);
});

module.exports = app;