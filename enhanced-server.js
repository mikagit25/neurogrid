#!/usr/bin/env node

/**
 * NeuroGrid Enhanced Simple Server
 * Serves static files and handles basic API endpoints
 * Supports multiple environments: development, staging, production
 */

// Load environment variables
require('dotenv').config({ silent: true });

const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

// Database and Models Integration - TEMPORARILY DISABLED FOR DEBUGGING
// const { DatabaseManager, db } = require('./coordinator-server/src/config/database');
// const User = require('./coordinator-server/src/models/User');
// const Transaction = require('./coordinator-server/src/models/Transaction');
// const Job = require('./coordinator-server/src/models/Job');
// const AuthService = require('./coordinator-server/src/services/AuthService');
// const logger = require('./coordinator-server/src/utils/logger');

// Initialize Database - TEMPORARILY DISABLED
// const dbManager = new DatabaseManager();

// Import production configuration system
const config = require('./src/config/production-config');

// Import Smart Model Router
const SmartModelRouter = require('./src/SmartModelRouter');
const PerformanceMonitor = require('./src/PerformanceMonitor');

// Import Hugging Face AI Client
const HuggingFaceClient = require('./src/ai/huggingface-client');

// Import AI Cache Manager
const AICacheManager = require('./src/ai/AICacheManager');

// Import Model Manager
const ModelManager = require('./src/ai/ModelManager');

// Import Review Manager
const ReviewManager = require('./src/ai/ReviewManager');

// Import NEURO Economy Manager
const NEUROEconomyManager = require('./src/ai/NEUROEconomyManager');

// Import Social Manager
const SocialManager = require('./src/ai/SocialManager');

// Import Analytics Manager
const AnalyticsManager = require('./src/ai/AnalyticsManager');

// Import Phase 3 Manager
const Phase3Manager = require('./src/phase3/Phase3Manager');

// Import Phase 4 DeFi Manager
const Phase4DeFiManager = require('./src/phase4/Phase4DeFiManager');

// Import Advanced Production Components
const { getRateLimiter } = require('./src/middleware/advancedRateLimiter');
const { createWebSocketManager } = require('./src/websocket/taskUpdates');
const { createMonitoringDashboard } = require('./src/monitoring/dashboard');
const { createCacheManager } = require('./src/cache/manager');
const { DatabaseMigrator } = require('./src/database/migrator');

const app = express();
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({ server });
const clients = new Set();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection established');
  clients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to NeuroGrid AI Chat',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 WebSocket message:`, data.type);
      
      if (data.type === 'ai_chat_stream') {
        await handleStreamingAIRequest(ws, data);
      } else if (data.type === 'ai_image_stream') {
        await handleStreamingImageRequest(ws, data);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message',
        details: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Use centralized configuration
const serverConfig = config.getServerConfig();
const PORT = serverConfig.port;
const DOMAIN = serverConfig.hostname;
const CORS_ORIGINS = serverConfig.corsOrigins.join(',');

console.log(`🌍 Environment: ${config.environment}`);
console.log(`🏠 Domain: ${DOMAIN}`);
console.log(`🔗 CORS Origins: ${CORS_ORIGINS}`);

// Initialize Smart Model Router
const modelRouter = new SmartModelRouter();

// Initialize Performance Monitor
const perfMonitor = new PerformanceMonitor();

// Initialize Hugging Face AI Client
const hfClient = new HuggingFaceClient();

// Initialize AI Cache Manager
const aiCache = new AICacheManager(1000, 24); // 1000 entries, 24h TTL

// Initialize Model Manager
const modelManager = new ModelManager();

// Initialize Review Manager
const reviewManager = new ReviewManager(modelManager);

// Initialize NEURO Economy Manager
const neuroEconomy = new NEUROEconomyManager();

// Initialize Social Manager
const socialManager = new SocialManager();

// Initialize Analytics Manager (after all other managers)
const analyticsManager = new AnalyticsManager(modelManager, reviewManager, socialManager, neuroEconomy);

// Initialize Phase 3 Manager
const phase3Manager = new Phase3Manager();

// Initialize Phase 4 DeFi Manager
const phase4Manager = new Phase4DeFiManager();

// Initialize Advanced Production Components
const rateLimiter = getRateLimiter();
const cacheManager = createCacheManager();
const wsManager = createWebSocketManager();
const monitoringDashboard = createMonitoringDashboard();
const dbMigrator = new DatabaseMigrator();

console.log('🛡️ Advanced rate limiter initialized');
console.log('📡 Real-time WebSocket manager initialized'); 
console.log('📊 Monitoring dashboard initialized');
console.log('💾 Cache manager initialized');
console.log('🗄️ Database migrator initialized');

console.log('🤖 Smart Model Router initialized');
console.log('📊 Available coordinators:', modelRouter.getCoordinatorStats().length);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize advanced WebSocket manager
wsManager.initialize(server);

// Advanced rate limiting middleware (before other middleware)
app.use(rateLimiter.middleware);

// Monitoring dashboard routes
app.use('/api/monitoring', monitoringDashboard.getRouter());

// Enhanced performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = perfMonitor.recordRequestStart();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - req.startTime;
    const responseTime = perfMonitor.recordRequestEnd(req.startTime, res.statusCode < 400);
    
    // Record metrics in monitoring dashboard
    monitoringDashboard.recordHttpRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      duration
    );
    
    console.log(`📊 ${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`);
    originalEnd.apply(this, args);
  };

  next();
});
// Serve static files from specific directories only (not root to avoid conflicts)
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/deploy', express.static(path.join(__dirname, 'deploy')));

// Serve production config for all pages
app.use('/src/config', express.static(path.join(__dirname, 'src', 'config')));

// Serve web-interface static files
app.use('/web-interface', express.static(path.join(__dirname, 'web-interface')));

// Serve root-level static files (index.html, demo.html, etc.)
app.use(express.static(path.join(__dirname), { 
  index: false,  // Don't auto-serve index.html from static middleware
  dotfiles: 'ignore'
}));

// CORS middleware - adaptive for environments
app.use((req, res, next) => {
  const allowedOrigins = CORS_ORIGINS.split(',');
  const origin = req.headers.origin;

  // Allow any origin in development
  if (config.environment === 'development') {
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

// Additional web-interface pages
app.get('/analytics.html', (req, res) => {
  const analyticsPath = path.join(__dirname, 'web-interface', 'analytics.html');
  if (fs.existsSync(analyticsPath)) {
    res.sendFile(analyticsPath);
  } else {
    res.status(404).send('Analytics page not found');
  }
});

app.get('/support.html', (req, res) => {
  const supportPath = path.join(__dirname, 'web-interface', 'support.html');
  if (fs.existsSync(supportPath)) {
    res.sendFile(supportPath);
  } else {
    res.status(404).send('Support page not found');
  }
});

app.get('/node-monitoring.html', (req, res) => {
  const nodeMonitoringPath = path.join(__dirname, 'web-interface', 'node-monitoring.html');
  if (fs.existsSync(nodeMonitoringPath)) {
    res.sendFile(nodeMonitoringPath);
  } else {
    res.status(404).send('Node monitoring page not found');
  }
});

app.get('/neuro-economy.html', (req, res) => {
  const economyPath = path.join(__dirname, 'neuro-economy.html');
  if (fs.existsSync(economyPath)) {
    res.sendFile(economyPath);
  } else {
    res.status(404).send('NEURO Economy page not found');
  }
});

app.get('/api-docs.html', (req, res) => {
  const apiDocsPath = path.join(__dirname, 'web-interface', 'api-docs.html');
  if (fs.existsSync(apiDocsPath)) {
    res.sendFile(apiDocsPath);
  } else {
    res.status(404).send('API documentation not found');
  }
});

// AI Chat interface
app.get('/ai-chat.html', (req, res) => {
  const aiChatPath = path.join(__dirname, 'web-interface', 'ai-chat.html');
  if (fs.existsSync(aiChatPath)) {
    res.sendFile(aiChatPath);
  } else {
    res.status(404).send('AI Chat interface not found');
  }
});

// Dashboard
app.get('/dashboard.html', (req, res) => {
  const dashboardPath = path.join(__dirname, 'web-interface', 'dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Dashboard not found');
  }
});

// Marketplace
app.get('/marketplace.html', (req, res) => {
  const marketplacePath = path.join(__dirname, 'web-interface', 'marketplace.html');
  if (fs.existsSync(marketplacePath)) {
    res.sendFile(marketplacePath);
  } else {
    res.status(404).send('Marketplace not found');
  }
});

// Node Setup
app.get('/node-setup.html', (req, res) => {
  const nodeSetupPath = path.join(__dirname, 'web-interface', 'node-setup.html');
  if (fs.existsSync(nodeSetupPath)) {
    res.sendFile(nodeSetupPath);
  } else {
    res.status(404).send('Node setup page not found');
  }
});

// Wallet
app.get('/wallet.html', (req, res) => {
  const walletPath = path.join(__dirname, 'web-interface', 'wallet.html');
  if (fs.existsSync(walletPath)) {
    res.sendFile(walletPath);
  } else {
    res.status(404).send('Wallet page not found');
  }
});

// Profile
app.get('/profile.html', (req, res) => {
  const profilePath = path.join(__dirname, 'web-interface', 'profile.html');
  if (fs.existsSync(profilePath)) {
    res.sendFile(profilePath);
  } else {
    res.status(404).send('Profile page not found');
  }
});

// Notifications
app.get('/notifications.html', (req, res) => {
  const notificationsPath = path.join(__dirname, 'web-interface', 'notifications.html');
  if (fs.existsSync(notificationsPath)) {
    res.sendFile(notificationsPath);
  } else {
    res.status(404).send('Notifications page not found');
  }
});

// System test page
app.get('/system-test.html', (req, res) => {
  const testPath = path.join(__dirname, 'system-test.html');
  if (fs.existsSync(testPath)) {
    res.sendFile(testPath);
  } else {
    res.status(404).send('System test page not found');
  }
});

app.get('/api/network/status', (req, res) => {
  res.json({
    success: true,
    data: {
      network: {
        nodes_online: mockStats.activeNodes,
        total_tasks: mockStats.completedTasks,
        avg_response_time: '2.3s',
        cost_savings: '78%'
      },
      nodes: mockNodes.slice(0, 3)
    }
  });
});

// Additional API endpoints  
app.get('/api/nodes/stats', (req, res) => {
  res.json({
    success: true,
    data: mockStats
  });
});

// Enhanced tasks endpoint with caching and monitoring
app.get('/api/tasks/:taskId?', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (taskId) {
      // Get specific task
      const cacheKey = `task:${taskId}`;
      let task = await cacheManager.get(cacheKey, { tier: 'warm' });
      
      if (!task) {
        // Mock task data (in production, this would come from database)
        task = {
          id: taskId,
          status: 'completed', // or 'pending', 'processing', 'failed'
          result: 'This is a mock task result',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          processingTime: 1500,
          model: 'gpt-3.5-turbo'
        };
        
        // Cache the task for future requests
        await cacheManager.set(cacheKey, task, { tier: 'warm', ttl: 300 });
      }
      
      res.json({
        success: true,
        task
      });
    } else {
      // Get tasks list with caching
      const { status, limit = 20, offset = 0 } = req.query;
      const listCacheKey = `tasks:list:${status || 'all'}:${limit}:${offset}`;
      
      let tasks = await cacheManager.get(listCacheKey, { tier: 'cold' });
      
      if (!tasks) {
        // Mock tasks list (in production, this would come from database)
        tasks = Array.from({ length: parseInt(limit) }, (_, i) => ({
          id: `task-${Date.now() - i * 1000}`,
          status: 'completed',
          type: 'text-generation',
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
          processingTime: Math.floor(Math.random() * 5000) + 500
        }));
        
        // Cache the list
        await cacheManager.set(listCacheKey, tasks, { tier: 'cold', ttl: 120 });
      }
      
      res.json({
        success: true,
        data: {
          tasks,
          total: tasks.length
        }
      });
    }
    
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks'
    });
  }
});

// Real tasks endpoints with authentication - TEMPORARILY DISABLED
/*
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 20, offset = 0, job_type } = req.query;
    
    const tasks = await Job.findByUserId(req.user.id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
      job_type
    });
    
    res.json({
      success: true,
      data: {
        tasks: tasks,
        total: tasks.length
      }
    });
  } catch (error) {
    logger.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks'
    });
  }
});
*/

// AI Chat endpoints
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, model, options = {} } = req.body;
    
    if (!message || !model) {
      return res.status(400).json({
        success: false,
        error: 'Message and model are required'
      });
    }

    console.log(`🤖 Processing text request: ${model} - "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Check cache first if request should be cached
    let result = null;
    let cacheKey = null;
    
    if (aiCache.shouldCache(message, 'text')) {
      cacheKey = aiCache.generateKey(model, message, options);
      result = aiCache.get(cacheKey);
    }
    
    if (result) {
      // Return cached result
      console.log(`💾 Returning cached text result`);
      res.json(result);
    } else {
      // Generate text using Hugging Face or fallback to mock
      result = await hfClient.generateText(model, message, options);
      
      console.log(`✅ Text generated: ${result.tokens_used} tokens, ${result.processing_time}ms`);
      
      // Cache the result if appropriate
      if (cacheKey && result.success) {
        aiCache.set(cacheKey, result, 'text');
      }
      
      res.json(result);
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process AI request',
      details: error.message
    });
  }
});

app.post('/api/ai/image', async (req, res) => {
  try {
    const { prompt, model, options = {} } = req.body;
    
    if (!prompt || !model) {
      return res.status(400).json({
        success: false,
        error: 'Prompt and model are required'
      });
    }

    console.log(`🎨 Processing image request: ${model} - "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    
    // Check cache first if request should be cached
    let result = null;
    let cacheKey = null;
    
    if (aiCache.shouldCache(prompt, 'image')) {
      cacheKey = aiCache.generateKey(model, prompt, options);
      result = aiCache.get(cacheKey);
    }
    
    if (result) {
      // Return cached result
      console.log(`💾 Returning cached image result`);
      res.json(result);
    } else {
      // Generate image using Hugging Face or fallback to mock
      result = await hfClient.generateImage(model, prompt, options);
      
      console.log(`✅ Image generated: ${result.resolution}, ${result.processing_time}ms`);
      
      // Cache the result if appropriate
      if (cacheKey && result.success) {
        aiCache.set(cacheKey, result, 'image');
      }
      
      res.json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('AI Image Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate image',
      details: error.message
    });
  }
});

app.get('/api/ai/models', (req, res) => {
  try {
    const models = hfClient.getAvailableModels();
    
    res.json({
      success: true,
      data: models,
      huggingface_enabled: !!hfClient.apiKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Models API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
      details: error.message
    });
  }
});

// AI Cache Statistics endpoint
app.get('/api/ai/cache/stats', (req, res) => {
  try {
    const stats = aiCache.getStats();
    const detailedStats = {
      ...stats,
      performance: {
        cost_savings: stats.hits * 0.01, // Estimate NEURO saved
        time_savings: stats.hits * 500  // Estimate ms saved
      },
      cache_info: {
        ttl_hours: 24,
        cleanup_interval: '60 minutes',
        status: 'active'
      }
    };

    res.json({
      success: true,
      data: detailedStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache statistics',
      details: error.message
    });
  }
});

// Clear cache endpoint (admin only)
app.delete('/api/ai/cache', (req, res) => {
  try {
    const clearedCount = aiCache.clear();
    
    res.json({
      success: true,
      message: `Cache cleared successfully`,
      cleared_entries: clearedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache Clear Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

// ==================== PAYMENT API ENDPOINTS ====================

// Get exchange rates for fiat to NEURO conversion
app.get('/api/payments/exchange-rates', (req, res) => {
  try {
    const exchangeRates = {
      USD: 10,    // 1 USD = 10 NEURO
      EUR: 11,    // 1 EUR = 11 NEURO  
      RUB: 0.12,  // 1 RUB = 0.12 NEURO
      GBP: 12.5,  // 1 GBP = 12.5 NEURO
      BTC: 650000, // 1 BTC = 650,000 NEURO
      ETH: 25000,  // 1 ETH = 25,000 NEURO
      USDT: 10.05, // 1 USDT = 10.05 NEURO
      USDC: 10.02  // 1 USDC = 10.02 NEURO
    };

    res.json({
      success: true,
      rates: exchangeRates,
      timestamp: new Date().toISOString(),
      base_currency: 'NEURO'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange rates',
      details: error.message
    });
  }
});

// Create deposit payment intent
app.post('/api/payments/deposit', express.json(), async (req, res) => {
  try {
    const { amount, currency, paymentMethod, returnUrl, metadata = {} } = req.body;

    // Validate input
    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum deposit amount is 10'
      });
    }

    if (!currency || !['USD', 'EUR', 'RUB', 'GBP', 'BTC', 'ETH', 'USDT', 'USDC'].includes(currency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid currency'
      });
    }

    if (!paymentMethod || !['card', 'paypal', 'crypto', 'bank'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method'
      });
    }

    // Calculate exchange rates
    const exchangeRates = {
      USD: 10, EUR: 11, RUB: 0.12, GBP: 12.5,
      BTC: 650000, ETH: 25000, USDT: 10.05, USDC: 10.02
    };

    const tokenAmount = amount * exchangeRates[currency];

    // Calculate fees
    const feeRates = {
      card: { percentage: 2.9, fixed: 0.30 },
      paypal: { percentage: 3.4, fixed: 0.35 },
      crypto: { percentage: 1.0, fixed: 0 },
      bank: { percentage: 0.5, fixed: 1.00 }
    };

    const feeConfig = feeRates[paymentMethod];
    const percentageFee = amount * (feeConfig.percentage / 100);
    const totalFee = percentageFee + feeConfig.fixed;

    // Generate payment intent
    const paymentIntent = {
      id: generateTransactionId(),
      type: 'deposit',
      status: 'pending',
      amount,
      currency,
      tokenAmount,
      paymentMethod,
      fees: {
        percentage: percentageFee,
        fixed: feeConfig.fixed,
        total: totalFee
      },
      netAmount: amount - totalFee,
      metadata,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      providerData: generateProviderData(paymentMethod, amount, currency)
    };

    // Log the payment intent creation
    console.log(`💳 Created payment intent: ${paymentIntent.id} for ${amount} ${currency}`);

    res.status(201).json({
      success: true,
      paymentIntent
    });
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create deposit',
      details: error.message
    });
  }
});

// Create withdrawal request
app.post('/api/payments/withdraw', express.json(), async (req, res) => {
  try {
    const { tokenAmount, currency, withdrawalMethod, destination, metadata = {} } = req.body;

    // Validate input
    if (!tokenAmount || tokenAmount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal amount is 10 NEURO'
      });
    }

    if (!currency || !['USD', 'EUR', 'RUB', 'GBP'].includes(currency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal currency'
      });
    }

    if (!withdrawalMethod || !['paypal', 'bank'].includes(withdrawalMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal method'
      });
    }

    if (!destination || (withdrawalMethod === 'paypal' && !destination.email) || 
        (withdrawalMethod === 'bank' && !destination.bankAccount)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid destination'
      });
    }

    // Calculate exchange rates  
    const exchangeRates = {
      USD: 10, EUR: 11, RUB: 0.12, GBP: 12.5
    };

    const fiatAmount = tokenAmount / exchangeRates[currency];
    const fee = fiatAmount * 0.02; // 2% withdrawal fee
    const netAmount = fiatAmount - fee;

    // Generate withdrawal request
    const withdrawalRequest = {
      id: generateTransactionId(),
      type: 'withdrawal',
      status: 'pending',
      tokenAmount,
      currency,
      fiatAmount,
      withdrawalMethod,
      destination,
      fees: {
        percentage: fee,
        rate: 2.0
      },
      netAmount,
      metadata,
      createdAt: new Date().toISOString(),
      estimatedProcessingTime: withdrawalMethod === 'paypal' ? '1-2 business days' : '3-5 business days'
    };

    console.log(`💸 Created withdrawal request: ${withdrawalRequest.id} for ${tokenAmount} NEURO`);

    res.status(201).json({
      success: true,
      withdrawalRequest
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create withdrawal',
      details: error.message
    });
  }
});

// Helper function to generate transaction IDs
function generateTransactionId() {
  return 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

// Helper function to generate provider-specific data
function generateProviderData(paymentMethod, amount, currency) {
  switch (paymentMethod) {
    case 'card':
      return {
        publishableKey: 'pk_test_51234567890abcdef', // Demo Stripe key
        clientSecret: 'pi_' + Math.random().toString(36).substring(2, 15) + '_secret_demo',
        paymentMethodTypes: ['card'],
        currency: currency.toLowerCase()
      };
    
    case 'paypal':
      return {
        checkoutUrl: `https://sandbox.paypal.com/checkoutnow?token=EC${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        orderId: 'PAYPAL-' + Math.random().toString(36).substring(2, 10).toUpperCase()
      };
    
    case 'crypto':
      const cryptoAddresses = {
        BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        ETH: '0x742d35Cc6634C0532925a3b8D121c90dac0A3F6C',
        USDT: '0x742d35Cc6634C0532925a3b8D121c90dac0A3F6C',
        USDC: '0x742d35Cc6634C0532925a3b8D121c90dac0A3F6C'
      };
      
      return {
        address: cryptoAddresses[currency] || cryptoAddresses.BTC,
        amount: amount.toString(),
        network: currency === 'BTC' ? 'bitcoin' : 'ethereum',
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${cryptoAddresses[currency] || cryptoAddresses.BTC}`,
        requiredConfirmations: currency === 'BTC' ? 3 : 6
      };
    
    case 'bank':
      return {
        bankAccount: 'GB33BUKB20201555555555',
        bankName: 'NeuroGrid Bank',
        swift: 'NGRIDGB2L',
        reference: 'NEURO-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      };
    
    default:
      return {};
  }
}

// ==================== MARKETPLACE API ENDPOINTS ====================

// Get all models for marketplace
app.get('/api/marketplace/models', (req, res) => {
  try {
    const marketplaceModels = [
      {
        id: 'llama-2-7b-custom',
        name: 'Llama 2 7B Fine-tuned',
        description: 'Custom fine-tuned Llama 2 model for conversational AI with enhanced creativity and reasoning capabilities.',
        category: 'chat',
        provider: 'community',
        author: 'AIResearcher',
        rating: 4.8,
        reviews: 127,
        downloads: 2341,
        price: 0.015,
        tags: ['conversational', 'fine-tuned', 'creative'],
        featured: true,
        size: '7B',
        license: 'Apache 2.0',
        created_at: '2026-02-01',
        updated_at: '2026-02-05',
        model_url: 'https://huggingface.co/custom/llama-2-7b-custom',
        performance: {
          inference_speed: 'Fast',
          memory_usage: '14GB VRAM',
          supported_tasks: ['chat', 'completion', 'reasoning']
        }
      },
      {
        id: 'stable-diffusion-anime',
        name: 'Stable Diffusion Anime',
        description: 'Specialized Stable Diffusion model trained on anime artwork for high-quality anime-style image generation.',
        category: 'image',
        provider: 'community',
        author: 'AnimeArtist',
        rating: 4.6,
        reviews: 89,
        downloads: 1523,
        price: 0.8,
        tags: ['anime', 'art', 'stylized'],
        featured: true,
        size: '2.1',
        license: 'CreativeML OpenRAIL',
        created_at: '2026-01-28',
        updated_at: '2026-02-03',
        model_url: 'https://huggingface.co/custom/sd-anime-v2',
        performance: {
          inference_speed: 'Medium',
          memory_usage: '8GB VRAM',
          supported_tasks: ['text2img', 'img2img', 'inpainting']
        }
      },
      {
        id: 'codellama-python-expert',
        name: 'CodeLlama Python Expert',
        description: 'Enhanced CodeLlama specifically optimized for Python development, debugging, and code explanation.',
        category: 'code',
        provider: 'custom',
        author: 'PyDeveloper',
        rating: 4.9,
        reviews: 203,
        downloads: 3124,
        price: 0.020,
        tags: ['python', 'coding', 'debugging'],
        featured: false,
        size: '7B',
        license: 'Custom',
        created_at: '2026-01-25',
        updated_at: '2026-02-04',
        model_url: 'https://huggingface.co/custom/codellama-python-expert',
        performance: {
          inference_speed: 'Fast',
          memory_usage: '12GB VRAM',
          supported_tasks: ['code_generation', 'debugging', 'explanation']
        }
      },
      {
        id: 'mistral-7b-medical',
        name: 'Mistral 7B Medical',
        description: 'Medical knowledge-enhanced Mistral model trained on medical literature and clinical data.',
        category: 'text',
        provider: 'community',
        author: 'MedAI',
        rating: 4.7,
        reviews: 156,
        downloads: 892,
        price: 0.025,
        tags: ['medical', 'healthcare', 'specialized'],
        featured: false,
        size: '7B',
        license: 'MIT',
        created_at: '2026-01-30',
        updated_at: '2026-02-02',
        model_url: 'https://huggingface.co/custom/mistral-medical',
        performance: {
          inference_speed: 'Fast',
          memory_usage: '10GB VRAM',
          supported_tasks: ['medical_qa', 'diagnosis_support', 'literature_review']
        }
      },
      {
        id: 'multimodal-vision-chat',
        name: 'Vision Chat Multimodal',
        description: 'Advanced multimodal model that can understand images and have conversations about visual content.',
        category: 'multimodal',
        provider: 'custom',
        author: 'VisionAI',
        rating: 4.5,
        reviews: 78,
        downloads: 671,
        price: 0.035,
        tags: ['multimodal', 'vision', 'chat'],
        featured: true,
        size: '13B',
        license: 'Apache 2.0',
        created_at: '2026-02-02',
        updated_at: '2026-02-06',
        model_url: 'https://huggingface.co/custom/vision-chat-13b',
        performance: {
          inference_speed: 'Medium',
          memory_usage: '20GB VRAM',
          supported_tasks: ['vision_qa', 'image_description', 'visual_reasoning']
        }
      },
      {
        id: 'gemini-pro-enhanced',
        name: 'Gemini Pro Enhanced',
        description: 'Community-enhanced version of Gemini Pro with improved reasoning and multilingual capabilities.',
        category: 'text',
        provider: 'google',
        author: 'GoogleAI',
        rating: 4.4,
        reviews: 234,
        downloads: 4567,
        price: 0.012,
        tags: ['reasoning', 'multilingual', 'general'],
        featured: false,
        size: 'Pro',
        license: 'Custom',
        created_at: '2026-01-20',
        updated_at: '2026-02-01',
        model_url: 'https://ai.google.dev/gemini-api',
        performance: {
          inference_speed: 'Very Fast',
          memory_usage: 'API Service',
          supported_tasks: ['chat', 'reasoning', 'analysis', 'coding']
        }
      }
    ];

    // Apply filters if provided
    const { category, provider, featured, min_rating, search } = req.query;
    let filtered = marketplaceModels;

    if (category && category !== 'all') {
      filtered = filtered.filter(model => model.category === category);
    }
    
    if (provider && provider !== 'all') {
      filtered = filtered.filter(model => model.provider === provider);
    }
    
    if (featured === 'true') {
      filtered = filtered.filter(model => model.featured);
    }
    
    if (min_rating) {
      filtered = filtered.filter(model => model.rating >= parseFloat(min_rating));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(searchLower) ||
        model.description.toLowerCase().includes(searchLower) ||
        model.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        model.author.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: {
        models: filtered,
        total: filtered.length,
        page: 1,
        per_page: filtered.length
      },
      timestamp: new Date().toISOString()
    });
    
    console.log(`📊 Marketplace: Served ${filtered.length} models (filters: ${Object.keys(req.query).length})`);
  } catch (error) {
    console.error('Marketplace Models Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace models',
      details: error.message
    });
  }
});

// Get marketplace statistics
app.get('/api/marketplace/stats', (req, res) => {
  try {
    const stats = {
      total_models: 24,
      total_providers: 8,
      total_downloads: 12847,
      total_users: 1204,
      avg_rating: 4.3,
      categories: {
        text: 8,
        image: 6,
        code: 4,
        chat: 3,
        multimodal: 3
      },
      providers: {
        community: 12,
        huggingface: 6,
        google: 3,
        custom: 3
      },
      featured_models: 6,
      trends: {
        most_downloaded: 'CodeLlama Python Expert',
        highest_rated: 'CodeLlama Python Expert',
        newest: 'Vision Chat Multimodal',
        trending_category: 'multimodal'
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
    
    console.log('📊 Marketplace: Served statistics');
  } catch (error) {
    console.error('Marketplace Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace statistics',
      details: error.message
    });
  }
});

// Upload new model (placeholder for now)
app.post('/api/marketplace/upload', (req, res) => {
  try {
    const { name, category, description, price, tags, license, size } = req.body;
    
    // Validate required fields
    if (!name || !category || !description || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, category, description, price'
      });
    }

    // Mock upload processing
    const newModelId = 'model-' + Date.now();
    console.log(`📤 Marketplace: Processing upload for model "${name}" (${category})`);
    console.log(`   Price: ${price} NEURO, Tags: ${tags || 'none'}`);
    
    // Simulate processing time
    setTimeout(() => {
      console.log(`✅ Marketplace: Model "${name}" uploaded successfully with ID: ${newModelId}`);
    }, 2000);

    res.json({
      success: true,
      data: {
        model_id: newModelId,
        name: name,
        status: 'uploaded',
        message: 'Model uploaded successfully and is being processed'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Marketplace Upload Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload model',
      details: error.message
    });
  }
});

// Rate a model
app.post('/api/marketplace/rate', (req, res) => {
  try {
    const { model_id, rating, review } = req.body;
    
    if (!model_id || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: model_id, rating'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    console.log(`⭐ Marketplace: New rating for ${model_id}: ${rating}/5`);
    if (review) {
      console.log(`   Review: ${review.substring(0, 100)}${review.length > 100 ? '...' : ''}`);
    }

    res.json({
      success: true,
      data: {
        model_id: model_id,
        rating: rating,
        review: review || null,
        status: 'submitted',
        message: 'Rating submitted successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Marketplace Rating Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating',
      details: error.message
    });
  }
});

// Get model details by ID
app.get('/api/marketplace/models/:id', (req, res) => {
  try {
    const modelId = req.params.id;
    
    // Mock detailed model info (in real implementation, fetch from database)
    const modelDetails = {
      id: modelId,
      name: 'Detailed Model Info',
      description: 'Full model description...',
      rating: 4.5,
      reviews: 123,
      downloads: 1000,
      detailed_metrics: {
        latency: '250ms avg',
        throughput: '15 tokens/sec',
        accuracy: '94.2%',
        supported_languages: ['en', 'es', 'fr', 'de'],
        max_context: '4096 tokens'
      },
      usage_examples: [
        {
          title: 'Basic Chat',
          code: 'response = model.generate("Hello, how are you?")'
        }
      ],
      reviews_sample: [
        {
          user: 'TechReviewer',
          rating: 5,
          comment: 'Excellent model for conversational AI',
          date: '2026-02-05'
        }
      ]
    };

    res.json({
      success: true,
      data: modelDetails,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📊 Marketplace: Served details for model ${modelId}`);
  } catch (error) {
    console.error('Marketplace Model Details Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model details',
      details: error.message
    });
  }
});

// ==================== MODEL MANAGEMENT API ENDPOINTS ====================

// Get all models with filtering and sorting
app.get('/api/models', (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      featured: req.query.featured === 'true',
      verified: req.query.verified === 'true',
      author: req.query.author,
      search: req.query.search,
      sortBy: req.query.sortBy || 'downloads',
      order: req.query.order || 'desc'
    };

    const models = modelManager.getModels(filters);
    
    res.json({
      success: true,
      data: models,
      total: models.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Models Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
      details: error.message
    });
  }
});

// Get specific model by ID
app.get('/api/models/:id', (req, res) => {
  try {
    const model = modelManager.getModel(req.params.id);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    res.json({
      success: true,
      data: model,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Model Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model',
      details: error.message
    });
  }
});

// Register new model (requires authentication)
app.post('/api/models', async (req, res) => {
  try {
    // Mock authentication - in real app would verify JWT token
    const authorAddress = req.headers['x-author-address'] || '0x' + Math.random().toString(16).substr(2, 40);
    
    const result = await modelManager.registerModel(req.body, authorAddress);
    
    if (result.success) {
      console.log(`🎯 New model registered: ${result.model_id}`);
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Register Model Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register model',
      details: error.message
    });
  }
});

// Update existing model
app.put('/api/models/:id', async (req, res) => {
  try {
    const authorAddress = req.headers['x-author-address'] || '0x' + Math.random().toString(16).substr(2, 40);
    
    const result = await modelManager.updateModel(req.params.id, req.body, authorAddress);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.error === 'Model not found' ? 404 : 403).json(result);
    }
  } catch (error) {
    console.error('Update Model Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update model',
      details: error.message
    });
  }
});

// Delete model
app.delete('/api/models/:id', async (req, res) => {
  try {
    const authorAddress = req.headers['x-author-address'] || '0x' + Math.random().toString(16).substr(2, 40);
    
    const result = await modelManager.deleteModel(req.params.id, authorAddress);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.error === 'Model not found' ? 404 : 403).json(result);
    }
  } catch (error) {
    console.error('Delete Model Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete model',
      details: error.message
    });
  }
});

// Download model (increments download counter)
app.post('/api/models/:id/download', (req, res) => {
  try {
    const model = modelManager.getModel(req.params.id);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    // Record download
    modelManager.recordDownload(req.params.id);

    res.json({
      success: true,
      message: 'Download recorded',
      model_id: req.params.id,
      new_download_count: model.downloads + 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Download Model Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record download',
      details: error.message
    });
  }
});

// Get marketplace statistics
app.get('/api/models/stats', (req, res) => {
  try {
    const stats = modelManager.getMarketplaceStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Marketplace Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace statistics',
      details: error.message
    });
  }
});

// ==================== REVIEW MANAGEMENT API ENDPOINTS ====================

// Get reviews for a specific model
app.get('/api/models/:id/reviews', (req, res) => {
  try {
    const options = {
      sortBy: req.query.sortBy || 'created_at',
      order: req.query.order || 'desc',
      page: req.query.page,
      limit: req.query.limit
    };

    const result = reviewManager.getModelReviews(req.params.id, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Model Reviews Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews',
      details: error.message
    });
  }
});

// Get review statistics for a model
app.get('/api/models/:id/reviews/stats', (req, res) => {
  try {
    const stats = reviewManager.getModelReviewStats(req.params.id);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Review Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review statistics',
      details: error.message
    });
  }
});

// Add a new review
app.post('/api/models/:id/reviews', async (req, res) => {
  try {
    // Mock authentication - in real app would verify JWT token
    const userId = req.headers['x-user-id'] || 'user_' + Math.random().toString(16).substr(2, 8);
    const userName = req.headers['x-user-name'] || 'Anonymous User';
    
    const reviewData = {
      ...req.body,
      model_id: req.params.id
    };
    
    const result = await reviewManager.addReview(reviewData, userId, userName);
    
    if (result.success) {
      console.log(`⭐ New review added for model: ${req.params.id}`);
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Add Review Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add review',
      details: error.message
    });
  }
});

// Mark review as helpful
app.post('/api/reviews/:reviewId/helpful', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const result = reviewManager.markHelpful(req.params.reviewId, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Mark Helpful Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark review as helpful',
      details: error.message
    });
  }
});

// Author response to review
app.post('/api/reviews/:reviewId/respond', async (req, res) => {
  try {
    const authorAddress = req.headers['x-author-address'];
    const { response } = req.body;
    
    if (!response) {
      return res.status(400).json({
        success: false,
        error: 'Response message is required'
      });
    }
    
    const result = await reviewManager.respondToReview(req.params.reviewId, authorAddress, response);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.error.includes('Unauthorized') ? 403 : 404).json(result);
    }
  } catch (error) {
    console.error('Review Response Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to review',
      details: error.message
    });
  }
});

// Get user's reviews
app.get('/api/users/:userId/reviews', (req, res) => {
  try {
    const reviews = reviewManager.getUserReviews(req.params.userId);
    
    res.json({
      success: true,
      data: reviews,
      total: reviews.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get User Reviews Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user reviews',
      details: error.message
    });
  }
});

// Get marketplace review statistics
app.get('/api/reviews/stats', (req, res) => {
  try {
    const stats = reviewManager.getMarketplaceReviewStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Review Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review statistics',
      details: error.message
    });
  }
});

// =====================================
// NEURO ECONOMY ENDPOINTS
// =====================================

// Get user balance
app.get('/api/neuro/balance/:userAddress', (req, res) => {
  try {
    const balance = neuroEconomy.getBalance(req.params.userAddress);
    const stakingInfo = neuroEconomy.getUserStaking(req.params.userAddress);
    
    res.json({
      success: true,
      data: {
        balance: balance,
        staking: stakingInfo
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Balance Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance',
      details: error.message
    });
  }
});

// Create new user
app.post('/api/neuro/users', async (req, res) => {
  try {
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'User address is required'
      });
    }
    
    const result = neuroEconomy.createUser(userAddress);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        data: result,
        message: `Welcome! You received ${result.balance} NEURO tokens`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: { balance: result.balance }
      });
    }
  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      details: error.message
    });
  }
});

// Process model payment
app.post('/api/neuro/payments/model', async (req, res) => {
  try {
    const { fromAddress, modelId, tokens } = req.body;
    
    if (!fromAddress || !modelId || !tokens) {
      return res.status(400).json({
        success: false,
        error: 'fromAddress, modelId, and tokens are required'
      });
    }
    
    // Get model data
    const model = modelManager.getModel(modelId);
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }
    
    const result = await neuroEconomy.processModelPayment(fromAddress, modelId, tokens, model);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: `Payment processed for ${tokens} tokens`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: {
          required: result.required,
          available: result.available
        }
      });
    }
  } catch (error) {
    console.error('Model Payment Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment',
      details: error.message
    });
  }
});

// Stake tokens on model
app.post('/api/neuro/stake', async (req, res) => {
  try {
    const { userAddress, modelId, amount } = req.body;
    
    if (!userAddress || !modelId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userAddress, modelId, and amount are required'
      });
    }
    
    const result = await neuroEconomy.stakeTokens(userAddress, modelId, amount);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: `Successfully staked ${amount} NEURO on model`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: result.available ? { available: result.available } : null
      });
    }
  } catch (error) {
    console.error('Stake Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stake tokens',
      details: error.message
    });
  }
});

// Unstake tokens from model
app.post('/api/neuro/unstake', async (req, res) => {
  try {
    const { userAddress, modelId, amount } = req.body;
    
    if (!userAddress || !modelId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userAddress, modelId, and amount are required'
      });
    }
    
    const result = await neuroEconomy.unstakeTokens(userAddress, modelId, amount);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: `Successfully unstaked ${amount} NEURO from model`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: result.available ? { available: result.available } : null
      });
    }
  } catch (error) {
    console.error('Unstake Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unstake tokens',
      details: error.message
    });
  }
});

// Claim staking rewards
app.post('/api/neuro/rewards/claim', (req, res) => {
  try {
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'userAddress is required'
      });
    }
    
    const result = neuroEconomy.claimRewards(userAddress);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: `Successfully claimed ${result.claimed_amount.toFixed(4)} NEURO rewards`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: { pending_rewards: result.pending_rewards }
      });
    }
  } catch (error) {
    console.error('Claim Rewards Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim rewards',
      details: error.message
    });
  }
});

// Get user transaction history
app.get('/api/neuro/transactions/:userAddress', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const transactions = neuroEconomy.getUserTransactions(req.params.userAddress, limit);
    
    res.json({
      success: true,
      data: transactions,
      total: transactions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.message
    });
  }
});

// Get economy statistics
app.get('/api/neuro/stats', (req, res) => {
  try {
    const stats = neuroEconomy.getEconomyStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Economy Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch economy statistics',
      details: error.message
    });
  }
});

// =====================================
// SOCIAL FEATURES ENDPOINTS
// =====================================

// Get public chats
app.get('/api/social/chats', (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 10,
      offset: parseInt(req.query.offset) || 0,
      tag: req.query.tag,
      creator: req.query.creator,
      sortBy: req.query.sortBy || 'created_at'
    };
    
    const result = socialManager.getPublicChats(options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Public Chats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public chats',
      details: error.message
    });
  }
});

// Get specific chat
app.get('/api/social/chats/:chatId', (req, res) => {
  try {
    const chat = socialManager.getChat(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }
    
    res.json({
      success: true,
      data: chat,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Chat Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat',
      details: error.message
    });
  }
});

// Create new public chat
app.post('/api/social/chats', async (req, res) => {
  try {
    const { title, description, model, tags, creator } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Chat title is required'
      });
    }
    
    const result = socialManager.createPublicChat({
      title,
      description,
      model,
      tags,
      creator
    });
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Public chat created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create Chat Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat',
      details: error.message
    });
  }
});

// Add message to chat
app.post('/api/social/chats/:chatId/messages', async (req, res) => {
  try {
    const { message, user_id, username, model, is_ai_response, attachments } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }
    
    const result = socialManager.addChatMessage(req.params.chatId, {
      message,
      user_id,
      username,
      model,
      is_ai_response,
      attachments
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Message added successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Add Message Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message',
      details: error.message
    });
  }
});

// Like a chat message
app.post('/api/social/chats/:chatId/messages/:messageId/like', (req, res) => {
  try {
    const result = socialManager.likeChatMessage(req.params.chatId, req.params.messageId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Message liked successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Like Message Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like message',
      details: error.message
    });
  }
});

// Get image gallery
app.get('/api/social/gallery', (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      tag: req.query.tag,
      featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      sortBy: req.query.sortBy || 'created_at'
    };
    
    const result = socialManager.getImageGallery(options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Gallery Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch image gallery',
      details: error.message
    });
  }
});

// Add image to gallery
app.post('/api/social/gallery', async (req, res) => {
  try {
    const { title, description, creator, user_id, model, prompt, image_url, tags } = req.body;
    
    if (!title || !image_url) {
      return res.status(400).json({
        success: false,
        error: 'Title and image URL are required'
      });
    }
    
    const result = socialManager.addToGallery({
      title,
      description,
      creator,
      user_id,
      model,
      prompt,
      image_url,
      tags
    });
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Image added to gallery successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Add Gallery Image Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add image to gallery',
      details: error.message
    });
  }
});

// Like a gallery image
app.post('/api/social/gallery/:imageId/like', (req, res) => {
  try {
    const result = socialManager.likeGalleryImage(req.params.imageId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Image liked successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Like Image Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like image',
      details: error.message
    });
  }
});

// Get user profile
app.get('/api/social/users/:userId/profile', (req, res) => {
  try {
    const profile = socialManager.getUserProfile(req.params.userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }
    
    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      details: error.message
    });
  }
});

// Update user profile
app.put('/api/social/users/:userId/profile', async (req, res) => {
  try {
    const result = socialManager.updateUserProfile(req.params.userId, req.body);
    
    res.json({
      success: true,
      data: result,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

// Get social statistics
app.get('/api/social/stats', (req, res) => {
  try {
    const stats = socialManager.getSocialStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Social Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch social statistics',
      details: error.message
    });
  }
});

// =====================================
// ANALYTICS & LEADERBOARD ENDPOINTS  
// =====================================

// Get complete analytics dashboard
app.get('/api/analytics/dashboard', (req, res) => {
  try {
    const dashboard = analyticsManager.getAnalyticsDashboard();
    
    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics Dashboard Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics dashboard',
      details: error.message
    });
  }
});

// Get specific leaderboard
app.get('/api/analytics/leaderboard/:category', (req, res) => {
  try {
    const category = req.params.category;
    const leaderboard = analyticsManager.getLeaderboard(category);
    
    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        error: `Leaderboard category '${category}' not found`,
        available_categories: ['income', 'popularity', 'quality']
      });
    }
    
    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      details: error.message
    });
  }
});

// Get trends data
app.get('/api/analytics/trends/:type', (req, res) => {
  try {
    const type = req.params.type;
    const trends = analyticsManager.getTrends(type);
    
    if (!trends) {
      return res.status(404).json({
        success: false,
        error: `Trends type '${type}' not found`,
        available_types: ['users', 'popularity']
      });
    }
    
    res.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trends Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
      details: error.message
    });
  }
});

// Get community insights
app.get('/api/analytics/insights/:type', (req, res) => {
  try {
    const type = req.params.type;
    const insights = analyticsManager.getInsights(type);
    
    if (!insights) {
      return res.status(404).json({
        success: false,
        error: `Insights type '${type}' not found`,
        available_types: ['community']
      });
    }
    
    res.json({
      success: true,
      data: insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Insights Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insights',
      details: error.message
    });
  }
});

// Get user achievements  
app.get('/api/analytics/achievements/:userId', (req, res) => {
  try {
    const achievements = analyticsManager.generateUserAchievements(req.params.userId);
    
    res.json({
      success: true,
      data: {
        user_id: req.params.userId,
        achievements: achievements,
        total_achievements: achievements.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Achievements Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch achievements',
      details: error.message
    });
  }
});

// Force analytics update (admin endpoint)
app.post('/api/analytics/update', (req, res) => {
  try {
    analyticsManager.updateAnalytics();
    
    res.json({
      success: true,
      message: 'Analytics updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics Update Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update analytics',
      details: error.message
    });
  }
});

// ===================================
// PHASE 3 API ENDPOINTS
// ===================================

// Get Phase 3 Status and Features
app.get('/api/v3/status', (req, res) => {
  try {
    const status = phase3Manager.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Phase 3 Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Phase 3 status',
      details: error.message
    });
  }
});

// Developer SDK Information
app.get('/api/v3/sdk', (req, res) => {
  try {
    const sdkInfo = phase3Manager.getSDKInfo();
    
    res.json({
      success: true,
      data: sdkInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Info Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SDK information',
      details: error.message
    });
  }
});

// Advanced Governance Configuration
app.get('/api/v3/governance', (req, res) => {
  try {
    const governanceConfig = phase3Manager.getGovernanceConfig();
    
    res.json({
      success: true,
      data: governanceConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Governance Config Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get governance configuration',
      details: error.message
    });
  }
});

// Enterprise API Configuration
app.get('/api/v3/enterprise', (req, res) => {
  try {
    const enterpriseConfig = phase3Manager.getEnterpriseConfig();
    
    res.json({
      success: true,
      data: enterpriseConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Enterprise Config Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enterprise configuration',
      details: error.message
    });
  }
});

// Phase 3 Feature Management
app.post('/api/v3/features/:featureName/enable', (req, res) => {
  try {
    const { featureName } = req.params;
    phase3Manager.enableFeature(featureName);
    
    res.json({
      success: true,
      message: `Phase 3 feature '${featureName}' enabled`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Feature Enable Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable Phase 3 feature',
      details: error.message
    });
  }
});

// Phase 3 Developer Analytics
app.get('/api/v3/analytics/developers', (req, res) => {
  try {
    const developerMetrics = {
      total_developers: phase3Manager.metrics.active_developers || 0,
      api_calls_today: Math.floor(Math.random() * 10000), // Mock data
      popular_endpoints: [
        '/api/v3/models',
        '/api/v3/inference', 
        '/api/v3/governance',
        '/api/v3/analytics'
      ],
      sdk_downloads: {
        javascript: 1247,
        python: 892,
        go: 336,
        rust: 89
      },
      documentation_views: 3421,
      community_examples: 45,
      github_stars: 2847
    };
    
    res.json({
      success: true,
      data: developerMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Developer Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get developer analytics',
      details: error.message
    });
  }
});

// Phase 3 SDK Enhanced Endpoints - Direct SDK Method Access

// List available models via SDK
app.get('/api/v3/sdk/models', async (req, res) => {
  try {
    const filters = req.query;
    const modelsData = await phase3Manager.developerSDK.listModels(filters);
    
    res.json({
      success: true,
      data: modelsData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Models List Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list models via SDK',
      details: error.message
    });
  }
});

// Get specific model via SDK
app.get('/api/v3/sdk/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const modelData = await phase3Manager.developerSDK.getModel(modelId);
    
    res.json({
      success: true,
      data: modelData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Model Details Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model details via SDK',
      details: error.message
    });
  }
});

// Call model for inference via SDK
app.post('/api/v3/sdk/models/:modelId/call', async (req, res) => {
  try {
    const { modelId } = req.params;
    const { input, options } = req.body;
    
    const result = await phase3Manager.developerSDK.callModel(modelId, input, options);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Model Call Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to call model via SDK',
      details: error.message
    });
  }
});

// Governance proposals via SDK
app.get('/api/v3/sdk/governance/proposals', async (req, res) => {
  try {
    const proposals = await phase3Manager.developerSDK.getProposals();
    
    res.json({
      success: true,
      data: proposals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Governance Proposals Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get proposals via SDK',
      details: error.message
    });
  }
});

// Vote on proposal via SDK
app.post('/api/v3/sdk/governance/proposals/:proposalId/vote', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { choice } = req.body;
    
    const voteResult = await phase3Manager.developerSDK.vote(proposalId, choice);
    
    res.json({
      success: true,
      data: voteResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Vote Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to vote via SDK',
      details: error.message
    });
  }
});

// Analytics leaderboard via SDK (default - must be before parameterized route)
app.get('/api/v3/sdk/analytics/leaderboard', (req, res) => {
  try {
    const leaderboard = phase3Manager.developerSDK.getAnalyticsLeaderboard('providers');
    
    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Analytics Leaderboard Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard via SDK',
      details: error.message
    });
  }
});

// Analytics leaderboard via SDK (with type parameter)
app.get('/api/v3/sdk/analytics/leaderboard/:type', (req, res) => {
  try {
    const { type } = req.params;
    const leaderboard = phase3Manager.developerSDK.getAnalyticsLeaderboard(type);
    
    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Analytics Leaderboard Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard via SDK',
      details: error.message
    });
  }
});

// Code examples via SDK (default - must be before parameterized route)
app.get('/api/v3/sdk/examples', (req, res) => {
  try {
    const examples = phase3Manager.developerSDK.generateCodeExamples('javascript');
    
    res.json({
      success: true,
      language: 'javascript',
      data: examples,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Code Examples Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get code examples via SDK',
      details: error.message
    });
  }
});

// Code examples via SDK (with language parameter)
app.get('/api/v3/sdk/examples/:language', (req, res) => {
  try {
    const { language } = req.params;
    const examples = phase3Manager.developerSDK.generateCodeExamples(language);
    
    res.json({
      success: true,
      language: language,
      data: examples,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Code Examples Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get code examples via SDK',
      details: error.message
    });
  }
});

// User analytics via SDK  
app.get('/api/v3/sdk/analytics/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userStats = phase3Manager.developerSDK.getUserAnalytics(userId);
    
    res.json({
      success: true,
      data: userStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK User Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user analytics via SDK',
      details: error.message
    });
  }
});

// Enterprise configuration via SDK
app.get('/api/v3/sdk/enterprise/config', (req, res) => {
  try {
    const enterpriseConfig = phase3Manager.developerSDK.getEnterpriseConfig();
    
    res.json({
      success: true,
      data: enterpriseConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK Enterprise Config Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enterprise config via SDK',
      details: error.message
    });
  }
});

// API key validation via SDK
app.post('/api/v3/sdk/validate-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const validation = await phase3Manager.developerSDK.validateApiKey(apiKey);
    
    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SDK API Key Validation Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate API key via SDK',
      details: error.message
    });
  }
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

// Real Auth endpoints with PostgreSQL - TEMPORARILY DISABLED
/*
app.post('/api/auth/login', async (req, res) => {
  // Auth endpoint temporarily disabled
  res.status(503).json({
    success: false,
    error: 'Authentication temporarily disabled during development'
  });
});

app.post('/api/auth/register', async (req, res) => {
  // Auth endpoint temporarily disabled
  res.status(503).json({
    success: false,
    error: 'Registration temporarily disabled during development'
  });
});
*/

// Mock auth endpoints for testing
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
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
  const { email, password, username } = req.body;
  
  if (email && password && username && password.length >= 8) {
    res.json({
      success: true,
      data: {
        accessToken: `mock-token-${Date.now()}`,
        user: {
          email: email,
          displayName: username
        }
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Email, username и пароль (минимум 8 символов) обязательны'
    });
  }
});

// JWT Authentication Middleware - TEMPORARILY DISABLED
/*
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
    }

    const token = authHeader.slice(7);
    const decoded = await AuthService.verifyToken(token);
    
    if (!decoded.success) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = decoded.user;
    next();
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};
*/

/*
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.username,
        profile: user.profile,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
*/

app.post('/api/tasks', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { model, input, priority = 5, type = 'text-generation', title, metadata } = req.body;

    if (!input) {
      monitoringDashboard.recordTaskMetrics('failed', 'unknown', 0);
      return res.status(400).json({
        success: false,
        error: 'Input is required'
      });
    }

    const taskId = `task-${Date.now()}`;
    
    // Check cache for identical requests
    const inputHash = require('crypto').createHash('sha256').update(input).digest('hex').substring(0, 16);
    const cachedResult = await cacheManager.getCachedModelResult(model || 'auto', inputHash);
    
    if (cachedResult) {
      console.log(`💾 Cache hit for task ${taskId}`);
      
      // Notify via WebSocket (if the user is connected)
      wsManager.notifyTaskUpdate(taskId, {
        status: 'completed',
        result: cachedResult.result,
        cached: true,
        processingTime: 0
      });
      
      monitoringDashboard.recordTaskMetrics('completed', model || 'auto', 0);
      
      return res.json({
        success: true,
        taskId,
        task: {
          id: taskId,
          status: 'completed',
          result: cachedResult.result,
          processingTime: 0,
          cached: true,
          model: model || 'auto',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      });
    }

    // Notify start of processing
    wsManager.notifyTaskUpdate(taskId, {
      status: 'processing',
      model: model || 'auto',
      startedAt: new Date().toISOString()
    });

    // If using smart router, process immediately
    if (!model || model === 'auto' || model === 'smart') {
      try {
        const task = {
          prompt: input,
          type,
          complexity: 'medium',
          priority: priority || 'normal',
          metadata
        };

        const result = await modelRouter.processTask(task);
        const processingTime = Date.now() - startTime;
        
        // Cache the result
        await cacheManager.cacheModelResult(model || 'auto', inputHash, result.result, {
          tier: 'hot',
          ttl: 300 // 5 minutes for AI results
        });
        
        // Notify completion via WebSocket
        wsManager.notifyTaskUpdate(taskId, {
          status: 'completed',
          result: result.result,
          processingTime,
          cost: result.cost,
          model: result.coordinator,
          completedAt: new Date().toISOString()
        });
        
        // Record metrics
        monitoringDashboard.recordTaskMetrics('completed', result.coordinator, processingTime);
        
        return res.json({
          success: true,
          taskId,
          task: {
            id: taskId,
            status: 'completed',
            result: result.result,
            processingTime: processingTime,
            cost: result.cost,
            model: result.coordinator,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            metadata
          }
        });
      } catch (processingError) {
        console.error('Task processing failed:', processingError);
        
        const processingTime = Date.now() - startTime;
        
        // Notify failure via WebSocket
        wsManager.notifyTaskUpdate(taskId, {
          status: 'failed',
          error: processingError.message,
          processingTime,
          failedAt: new Date().toISOString()
        });
        
        // Record failure metrics
        monitoringDashboard.recordTaskMetrics('failed', model || 'auto', processingTime);
        
        return res.status(500).json({
          success: false,
          error: 'Task processing failed',
          taskId: taskId,
          details: processingError.message
        });
      }
    } else {
      // Queue task for processing (mock implementation)
      wsManager.notifyTaskUpdate(taskId, {
        status: 'pending',
        model: model,
        queuedAt: new Date().toISOString()
      });
      
      return res.json({
        success: true,
        taskId,
        task: {
          id: taskId,
          status: 'pending',
          model: model,
          createdAt: new Date().toISOString(),
          metadata
        }
      });
    }

  } catch (error) {
    console.error('Task creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create task'
    });
  }
});

// Smart AI Processing Endpoints
app.get('/api/models/available', (req, res) => {
  res.json({
    success: true,
    data: {
      coordinators: modelRouter.getCoordinatorStats(),
      totalAvailable: modelRouter.getCoordinatorStats().filter(c => c.available).length,
      llm_providers: ['mock', 'openai', 'huggingface', 'local'] // Доступные LLM провайдеры
    }
  });
});

// NEW: LLM Integration Endpoint
app.post('/api/llm/generate', async (req, res) => {
  try {
    const { prompt, model, provider, max_tokens = 1000, temperature = 0.7 } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    // Симулируем вызов LLM интеграции
    // В реальной системе здесь был бы вызов к llm_integration.py
    const mockResponses = [
      `Based on your prompt "${prompt.substring(0, 50)}...", here's a comprehensive response from NeuroGrid's distributed AI network. This demonstrates how the system routes requests to available language models across the decentralized network.`,
      `NeuroGrid LLM Response: I understand your query about "${prompt.substring(0, 40)}...". In our decentralized network, this request would be processed by the most suitable available node with the appropriate model.`,
      `Distributed AI Result: Your input "${prompt.substring(0, 60)}..." has been processed successfully. This showcases NeuroGrid's ability to provide AI inference through our network of GPU providers.`
    ];

    // Симулируем время обработки
    const processingStartTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    const processingTime = (Date.now() - processingStartTime) / 1000;

    const result = {
      success: true,
      data: {
        result: mockResponses[Math.floor(Math.random() * mockResponses.length)],
        model: model || 'auto-selected',
        provider: provider || 'neurogrid-mock',
        processing_time: processingTime,
        tokens_used: Math.floor(prompt.length / 4) + Math.floor(Math.random() * 200) + 50,
        cost_neuro: (processingTime * 0.001).toFixed(6), // Стоимость в NEURO токенах
        cost_usd: (processingTime * 0.01).toFixed(4), // Эквивалент в USD
        timestamp: new Date().toISOString(),
        node_id: `node-llm-${Math.floor(Math.random() * 5) + 1}`
      }
    };

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// LLM Models Management
app.get('/api/llm/models', (req, res) => {
  res.json({
    success: true,
    data: {
      available_models: {
        'text-generation': [
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', cost: 0.002 },
          { id: 'gpt-4', name: 'GPT-4', provider: 'openai', cost: 0.03 },
          { id: 'llama2-7b', name: 'Llama 2 7B', provider: 'local', cost: 0.0001 },
          { id: 'llama2-13b', name: 'Llama 2 13B', provider: 'local', cost: 0.0002 },
          { id: 'mistral-7b', name: 'Mistral 7B', provider: 'huggingface', cost: 0.0001 },
          { id: 'mock-llm', name: 'Mock LLM (Demo)', provider: 'mock', cost: 0.0000 }
        ],
        'code-generation': [
          { id: 'codellama-7b', name: 'Code Llama 7B', provider: 'local', cost: 0.0001 },
          { id: 'starcoder', name: 'StarCoder', provider: 'huggingface', cost: 0.0002 }
        ],
        'image-generation': [
          { id: 'stable-diffusion-xl', name: 'Stable Diffusion XL', provider: 'local', cost: 0.001 },
          { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai', cost: 0.04 }
        ]
      },
      total_models: 8
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
    environment: process.env.NODE_ENV,
    domain: process.env.DOMAIN || 'localhost'
  });
});

// Performance metrics endpoint
app.get('/api/performance', (req, res) => {
  res.json({
    success: true,
    data: perfMonitor.getMetrics()
  });
});

// =====================================
// PHASE 4 DEFI INTEGRATION
// =====================================

// Set Phase 4 manager for routes
app.set('phase4Manager', phase4Manager);

// Import and use Uniswap V3 API routes
const uniswapV3Routes = require('./src/phase4/api/uniswap-v3-routes');
app.use('/api/v2/defi/uniswap-v3', uniswapV3Routes);

// Import and use Aave V3 API routes
const aaveV3Routes = require('./src/phase4/api/aave-v3-routes');
app.use('/api/v2/defi/aave-v3', aaveV3Routes);

// Import and use Compound V3 API routes
const compoundV3Routes = require('./src/phase4/api/compound-v3-routes');
app.use('/api/v2/defi/compound-v3', compoundV3Routes);

// Phase 4 status endpoint
app.get('/api/v2/phase4/status', (req, res) => {
  try {
    const status = phase4Manager.getPhase4Status();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Phase 4 Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Phase 4 status',
      details: error.message
    });
  }
});

// Initialize Phase 4 DeFi Manager
console.log('🚀 Initializing Phase 4 DeFi Integration...');
phase4Manager.initialize()
  .then(result => {
    console.log('✅ Phase 4 DeFi Integration initialized successfully!');
    console.log(`🏛️ Protocols: ${result.protocols} active`);
    console.log(`⚡ Features: ${result.features} enabled`);
  })
  .catch(error => {
    console.error('❌ Failed to initialize Phase 4:', error);
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

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔄 Starting server (database temporarily disabled)...');
    // await dbManager.initialize();
    console.log('✅ Server ready to start!');

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 NeuroGrid Smart Model Router - Production Ready!`);
      console.log(`📍 Server running on: http://0.0.0.0:${PORT}`);
      console.log(`🌐 Domain: ${DOMAIN}`);
      console.log(`🎯 Smart Router Dashboard: ${config.getWebUrl('/')}`);
      console.log(`🛠️ Admin Panel: ${config.getWebUrl('/admin.html')}`);
      console.log(`🔍 Health check: ${config.getWebUrl('/health')}`);
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
      
      if (config.isProduction()) {
        console.log(`\n🎉 PRODUCTION MODE ACTIVE!`);
        console.log(`   Public URL: ${config.getWebUrl('/')}`);
        console.log(`   API URL: ${config.getApiUrl('/')}`);
        console.log(`   WebSocket URL: ${config.getWebSocketUrl('/')}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
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

// Streaming AI request handlers
async function handleStreamingAIRequest(ws, data) {
  const { message, model, options = {}, requestId } = data;
  
  try {
    console.log(`🤖 Streaming text request: ${model} - "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Send initial response
    ws.send(JSON.stringify({
      type: 'ai_response_start',
      requestId,
      model,
      timestamp: new Date().toISOString()
    }));

    // Generate text with streaming
    const result = await hfClient.generateText(model, message, options, (progress) => {
      // Send progress updates
      ws.send(JSON.stringify({
        type: 'ai_response_progress',
        requestId,
        partial_text: progress.partial_text,
        tokens_so_far: progress.tokens_so_far,
        progress: progress.progress,
        timestamp: new Date().toISOString()
      }));
    });

    // Send final result
    ws.send(JSON.stringify({
      type: 'ai_response_complete',
      requestId,
      result,
      timestamp: new Date().toISOString()
    }));

    console.log(`✅ Streaming text completed: ${result.tokens_used} tokens`);

  } catch (error) {
    console.error('Streaming AI error:', error);
    ws.send(JSON.stringify({
      type: 'ai_response_error',
      requestId,
      error: 'Failed to process streaming request',
      details: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

async function handleStreamingImageRequest(ws, data) {
  const { prompt, model, options = {}, requestId } = data;
  
  try {
    console.log(`🎨 Streaming image request: ${model} - "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    
    // Send initial response
    ws.send(JSON.stringify({
      type: 'ai_image_start',
      requestId,
      model,
      timestamp: new Date().toISOString()
    }));

    // Generate image with progress tracking
    const result = await hfClient.generateImage(model, prompt, options, (progress) => {
      // Send progress updates
      ws.send(JSON.stringify({
        type: 'ai_image_progress',
        requestId,
        stage: progress.stage,
        progress: progress.progress,
        timestamp: new Date().toISOString()
      }));
    });

    // Send final result
    ws.send(JSON.stringify({
      type: 'ai_image_complete',
      requestId,
      result,
      timestamp: new Date().toISOString()
    }));

    console.log(`✅ Streaming image completed: ${result.resolution}`);

  } catch (error) {
    console.error('Streaming image error:', error);
    ws.send(JSON.stringify({
      type: 'ai_image_error',
      requestId,
      error: 'Failed to process streaming image request',
      details: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Gracefully shutting down...');
  
  // Save economy data before shutdown
  neuroEconomy.destroy();
  socialManager.destroy();
  analyticsManager.destroy();
  
  // Shutdown advanced components
  if (cacheManager) await cacheManager.shutdown();
  if (wsManager) await wsManager.shutdown();
  if (monitoringDashboard) monitoringDashboard.shutdown();
  if (dbMigrator) await dbMigrator.shutdown();
  
  server.close(() => {
    console.log('💰 Economy data saved. All advanced components shutdown. Server stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Gracefully shutting down...');
  
  // Save economy data before shutdown
  neuroEconomy.destroy();
  socialManager.destroy();
  analyticsManager.destroy();
  
  // Shutdown advanced components
  if (cacheManager) await cacheManager.shutdown();
  if (wsManager) await wsManager.shutdown();
  if (monitoringDashboard) monitoringDashboard.shutdown();
  if (dbMigrator) await dbMigrator.shutdown();
  
  server.close(() => {
    console.log('💰 Economy data saved. Server stopped.');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  neuroEconomy.destroy();
  socialManager.destroy();
  analyticsManager.destroy();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  neuroEconomy.destroy();
  socialManager.destroy();
  analyticsManager.destroy();
  process.exit(1);
});

console.log('💰 NEURO Economy Manager integrated successfully!');
console.log('👥 Social Manager integrated successfully!');
console.log('� Analytics Manager integrated successfully!');
console.log('�🚀 All Phase 2 systems active!');