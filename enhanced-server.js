#!/usr/bin/env node

/**
 * NeuroGrid Enhanced Simple Server
 * Serves static files and handles basic API endpoints
 * Supports multiple environments: development, staging, production
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

// Import Smart Model Router
const SmartModelRouter = require('./src/SmartModelRouter');
const PerformanceMonitor = require('./src/PerformanceMonitor');

const app = express();
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({ server });
const clients = new Set();

// Environment Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 8080;
const DOMAIN = process.env.DOMAIN || 'localhost';

// CORS configuration for different environments
const CORS_ORIGINS = process.env.CORS_ORIGINS || 
  NODE_ENV === 'production' 
    ? 'https://neurogrid.network,https://www.neurogrid.network'
    : 'http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080';

console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`🏠 Domain: ${DOMAIN}`);
console.log(`🔗 CORS Origins: ${CORS_ORIGINS}`);

// Initialize Smart Model Router
const modelRouter = new SmartModelRouter();

// Initialize Performance Monitor
const perfMonitor = new PerformanceMonitor();

console.log('🤖 Smart Model Router initialized');
console.log('📊 Available coordinators:', modelRouter.getCoordinatorStats().length);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = perfMonitor.recordRequestStart();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = perfMonitor.recordRequestEnd(req.startTime, res.statusCode < 400);
    console.log(`📊 ${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`);
    originalEnd.apply(this, args);
  };
  
  next();
});
// Serve static files from specific directories only (not root to avoid conflicts)
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/deploy', express.static(path.join(__dirname, 'deploy')));

// CORS middleware - adaptive for environments
app.use((req, res, next) => {
  const allowedOrigins = CORS_ORIGINS.split(',');
  const origin = req.headers.origin;
  
  // Allow any origin in development
  if (NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Mock data для демонстрации
const mockStats = {
  totalNodes: 156,
  activeNodes: 142,
  totalTasks: 1247,
  completedTasks: 1198,
  totalReward: 47.3,
  networkUtilization: 89.2
};

const mockTasks = [
  {
    id: 'task-001',
    model: 'llama2:7b',
    status: 'completed',
    createdAt: new Date(Date.now() - 300000).toISOString(),
    completedAt: new Date(Date.now() - 60000).toISOString(),
    reward: 0.25
  },
  {
    id: 'task-002', 
    model: 'stable-diffusion',
    status: 'running',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    nodeId: 'node-gpu-001'
  },
  {
    id: 'task-003',
    model: 'whisper-large',
    status: 'pending',
    createdAt: new Date(Date.now() - 120000).toISOString()
  }
];

const mockNodes = [
  {
    id: 'node-gpu-001',
    name: 'RTX-4090-Node',
    status: 'active',
    gpu: 'NVIDIA RTX 4090',
    location: 'US-West',
    uptime: '99.7%',
    tasksCompleted: 247
  },
  {
    id: 'node-gpu-002', 
    name: 'V100-Cluster',
    status: 'busy',
    gpu: 'NVIDIA Tesla V100',
    location: 'EU-Central',
    uptime: '98.9%',
    tasksCompleted: 189
  }
];

// Route handlers - Production Ready Smart Router
app.get('/', (req, res) => {
  // Main Smart Router Dashboard with real-time statistics
  const webInterfacePath = path.join(__dirname, 'web-interface', 'index.html');
  if (fs.existsSync(webInterfacePath)) {
    res.sendFile(webInterfacePath);
  } else {
    res.status(404).send('Smart Router Dashboard not found. Please ensure web-interface/index.html exists.');
  }
});

// MVP Landing Page (legacy/demo)
app.get('/mvp', (req, res) => {
  const landingPath = path.join(__dirname, 'deploy', 'landing-page.html');
  if (fs.existsSync(landingPath)) {
    res.sendFile(landingPath);
  } else {
    res.status(404).send('MVP landing page not found');
  }
});

// Demo page
app.get('/demo', (req, res) => {
  const demoPath = path.join(__dirname, 'demo.html');
  if (fs.existsSync(demoPath)) {
    res.sendFile(demoPath);
  } else {
    res.redirect('/');
  }
});

// Admin panel
app.get('/admin.html', (req, res) => {
  const adminPath = path.join(__dirname, 'web-interface', 'admin.html');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.status(404).send('Admin panel not found');
  }
});

// API Endpoints
app.get('/api/nodes/stats', (req, res) => {
  res.json({
    success: true,
    data: mockStats
  });
});

app.get('/api/tasks', (req, res) => {
  res.json({
    success: true,
    data: {
      tasks: mockTasks,
      total: mockTasks.length
    }
  });
});

app.get('/api/nodes', (req, res) => {
  res.json({
    success: true,
    data: {
      nodes: mockNodes,
      total: mockNodes.length
    }
  });
});

// Auth endpoints (mock)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Простая mock авторизация
  if (email && password) {
    res.json({
      success: true,
      data: {
        accessToken: `mock-token-${Date.now()}`,
        user: {
          email: email,
          displayName: email.split('@')[0]
        }
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Email и пароль обязательны'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  
  if (email && password && password.length >= 8) {
    res.json({
      success: true, 
      data: {
        accessToken: `mock-token-${Date.now()}`,
        user: {
          email: email,
          displayName: email.split('@')[0]
        }
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Email и пароль (минимум 8 символов) обязательны'
    });
  }
});

app.get('/api/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('mock-token-')) {
      res.json({
        success: true,
        data: {
          email: 'user@neurogrid.network',
          displayName: 'user',
          joinedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } else {
    res.status(401).json({
      success: false,
      error: 'Authorization header required'
    });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { model, input, priority, type = 'text-generation' } = req.body;
    
    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'Input is required'
      });
    }

    // If model is "auto" or not specified, use smart router
    if (!model || model === 'auto' || model === 'smart') {
      const task = {
        prompt: input,
        type,
        complexity: 'medium',
        priority: priority || 'normal'
      };

      const result = await modelRouter.processTask(task);
      
      const newTask = {
        id: `task-${Date.now()}`,
        model: result.coordinator,
        input: input,
        priority: priority || 'normal',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: result.result,
        processingTime: result.processingTime,
        cost: result.cost
      };

      mockTasks.unshift(newTask);
      
      return res.json({
        success: true,
        task: newTask
      });
    } else {
      // Traditional processing for specific models
      const newTask = {
        id: `task-${Date.now()}`,
        model: model,
        input: input,
        priority: priority || 'normal',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      mockTasks.unshift(newTask);
      
      return res.json({
        success: true,
        task: newTask
      });
    }
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Smart AI Processing Endpoints
app.get('/api/models/available', (req, res) => {
  res.json({
    success: true,
    data: {
      coordinators: modelRouter.getCoordinatorStats(),
      totalAvailable: modelRouter.getCoordinatorStats().filter(c => c.available).length
    }
  });
});

app.post('/api/ai/process', async (req, res) => {
  try {
    const { prompt, type = 'text-generation', complexity = 'medium', priority = 'normal' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const task = {
      prompt,
      type,
      complexity,
      priority,
      timestamp: Date.now()
    };

    const preferences = {
      preferLocal: true,
      maxCost: 0.01,
      maxLatency: 10000
    };

    const result = await modelRouter.processTask(task, preferences);
    
    // Broadcast real-time stats update
    try {
      broadcastStatsUpdate();
    } catch (error) {
      console.error('❌ Broadcast after task error:', error);
    }
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/models/toggle', (req, res) => {
  const { coordinatorId, enabled, apiKey } = req.body;
  
  try {
    modelRouter.toggleCoordinator(coordinatorId, enabled, apiKey);
    
    res.json({
      success: true,
      data: {
        message: `Coordinator ${coordinatorId} ${enabled ? 'enabled' : 'disabled'}`,
        coordinators: modelRouter.getCoordinatorStats()
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Model Statistics endpoint
app.get('/api/models/stats', (req, res) => {
  const stats = modelRouter.getStatistics();
  res.json({
    success: true,
    data: {
      totalRequests: stats.totalRequests,
      modelUsage: stats.modelUsage,
      averageResponseTime: stats.averageResponseTime,
      totalCost: stats.totalCost,
      successRate: stats.successRate
    }
  });
});

// Model Configuration endpoint
app.post('/api/models/configure', (req, res) => {
  const { modelId, config } = req.body;
  
  if (!modelId || !config) {
    return res.status(400).json({
      success: false,
      error: 'Model ID and config are required'
    });
  }

  res.json({
    success: true,
    data: {
      message: `Model ${modelId} configured successfully`,
      config: config
    }
  });
});

// Export system statistics
app.get('/api/models/export', (req, res) => {
  const stats = modelRouter.getStatistics();
  const coordinators = modelRouter.getCoordinatorStats();
  
  const exportData = {
    timestamp: new Date().toISOString(),
    system: {
      totalRequests: stats.totalRequests,
      successRate: stats.successRate,
      averageResponseTime: stats.averageResponseTime,
      totalCost: stats.totalCost
    },
    modelUsage: stats.modelUsage,
    coordinators: coordinators
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="neurogrid-stats-${Date.now()}.json"`);
  res.json(exportData);
});

// Configure API Keys
app.post('/api/models/configure', (req, res) => {
  const { provider, apiKey } = req.body;
  
  if (!provider || !apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Provider and API key are required'
    });
  }

  try {
    const success = modelRouter.configureAPIKey(provider, apiKey);
    
    if (success) {
      res.json({
        success: true,
        data: {
          message: `${provider.toUpperCase()} API configured successfully`,
          coordinators: modelRouter.getCoordinatorStats()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Invalid provider: ${provider}`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test external APIs
app.post('/api/models/test', async (req, res) => {
  try {
    const results = await modelRouter.testExternalAPIs();
    
    res.json({
      success: true,
      data: {
        results,
        summary: Object.values(results).map(r => r.success).filter(Boolean).length + ' APIs working'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Other pages
app.get('/demo', (req, res) => {
  const demoPath = path.join(__dirname, 'deploy', 'demo-setup.html');
  if (fs.existsSync(demoPath)) {
    res.sendFile(demoPath);
  } else {
    res.redirect('/');
  }
});

app.get('/api/docs', (req, res) => {
  const apiDocsPath = path.join(__dirname, 'deploy', 'api-docs.html');
  if (fs.existsSync(apiDocsPath)) {
    res.sendFile(apiDocsPath);
  } else {
    res.redirect('/');
  }
});

app.get('/technical-docs', (req, res) => {
  const techDocsPath = path.join(__dirname, 'deploy', 'technical-docs.html');
  if (fs.existsSync(techDocsPath)) {
    res.sendFile(techDocsPath);
  } else {
    res.redirect('/');
  }
});

app.get('/investors', (req, res) => {
  const investorsPath = path.join(__dirname, 'deploy', 'investors.html');
  if (fs.existsSync(investorsPath)) {
    res.sendFile(investorsPath);
  } else {
    res.redirect('/');
  }
});

// Health check
app.get('/health', (req, res) => {
  const stats = modelRouter.getStatistics();
  const performance = perfMonitor.getSummary();
  
  res.json({
    status: 'OK',
    service: 'NeuroGrid Smart Model Router',
    timestamp: new Date().toISOString(),
    version: '2.0.0-smart-router',
    features: [
      'Smart AI Model Routing',
      'Real-time Statistics', 
      'External API Integration',
      'Web Dashboard',
      'Admin Panel',
      'Multi-Environment Support',
      'Performance Monitoring',
      'WebSocket Real-time Updates'
    ],
    coordinators: {
      total: 4,
      active: Object.values(stats.modelUsage || {}).filter(usage => usage > 0).length,
      totalRequests: stats.totalRequests || 0,
      successRate: `${stats.successRate || 0}%`
    },
    performance: {
      uptime: performance.uptime,
      requests: performance.requests,
      avgResponseTime: performance.avgResponseTime,
      memoryUsed: performance.memoryUsed,
      webSocketConnections: performance.webSocketConnections
    },
    environment: NODE_ENV,
    domain: DOMAIN
  });
});

// Performance metrics endpoint
app.get('/api/performance', (req, res) => {
  res.json({
    success: true,
    data: perfMonitor.getMetrics()
  });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NeuroGrid Smart Model Router - Production Ready!`);
  console.log(`📍 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`🌐 All interfaces: IPv4 and IPv6`);
  console.log(`🎯 Smart Router Dashboard: http://localhost:${PORT}/`);
  console.log(`🛠️ Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Available routes:`);
  console.log(`   / - Smart Router Dashboard (Production Ready)`);
  console.log(`   /admin.html - Admin Panel & Configuration`);
  console.log(`   /mvp - Legacy MVP Landing Page`);
  console.log(`   /demo - Demo page`);
  console.log(`   /api/docs - API documentation`);
  console.log(`📡 Smart Router API Endpoints:`);
  console.log(`   POST /api/ai/process - Smart AI Task Processing`);
  console.log(`   GET  /api/models/available - Available Coordinators`);
  console.log(`   GET  /api/models/stats - Real-time Statistics`);
  console.log(`   POST /api/models/toggle - Enable/Disable Coordinators`);
  console.log(`   GET  /api/models/export - Export Statistics`);
  console.log(`📊 Platform API Endpoints:`);
  console.log(`   POST /api/auth/login - User login`);
  console.log(`   POST /api/auth/register - User registration`);
  console.log(`   GET  /api/nodes/stats - Network stats`);
  console.log(`   GET  /api/tasks - Task list`);
  console.log(`   POST /api/tasks - Submit task`);
});

// WebSocket Connection Handler
wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket client connected from', req.socket.remoteAddress);
  clients.add(ws);
  perfMonitor.recordWebSocketConnection();
  
  // Send initial stats
  ws.send(JSON.stringify({
    type: 'stats_update',
    data: modelRouter.getStatistics()
  }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      perfMonitor.recordWebSocketMessageReceived();
      const data = JSON.parse(message);
      console.log('📨 WebSocket message:', data);
      
      switch (data.type) {
        case 'request_stats':
          ws.send(JSON.stringify({
            type: 'stats_update',
            data: modelRouter.getStatistics()
          }));
          break;
        case 'request_performance':
          ws.send(JSON.stringify({
            type: 'performance_update',
            data: perfMonitor.getMetrics()
          }));
          break;
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
      perfMonitor.recordWebSocketError();
    }
  });
  
  // Handle disconnect
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    clients.delete(ws);
    perfMonitor.recordWebSocketDisconnection();
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    clients.delete(ws);
    perfMonitor.recordWebSocketError();
    perfMonitor.recordWebSocketDisconnection();
  });
});

// Broadcast function for real-time updates
function broadcastStatsUpdate() {
  try {
    const stats = modelRouter.getStatistics();
    const performance = perfMonitor.getSummary();
    
    const message = JSON.stringify({
      type: 'stats_update',
      data: stats,
      performance: performance,
      timestamp: new Date().toISOString()
    });
    
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          perfMonitor.recordWebSocketMessageSent();
        } catch (error) {
          console.error('❌ WebSocket send error:', error);
          clients.delete(client);
          perfMonitor.recordWebSocketError();
        }
      }
    });
    
    console.log(`📊 Broadcasted stats to ${clients.size} clients (Req: ${performance.requests}, Mem: ${performance.memoryUsed}MB)`);
  } catch (error) {
    console.error('❌ Broadcast error:', error);
  }
}

// Broadcast updates every 5 seconds
setInterval(broadcastStatsUpdate, 5000);

// Log performance stats every 30 seconds
setInterval(() => {
  perfMonitor.logPerformanceStats();
}, 30000);

console.log('🔌 WebSocket server ready for real-time updates');