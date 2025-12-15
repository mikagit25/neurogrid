#!/usr/bin/env node

/**
 * NeuroGrid Enhanced Simple Server
 * Serves static files and handles basic API endpoints
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// CORS для разработки
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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

// Route handlers for all MVP pages
app.get('/', (req, res) => {
  const webInterfacePath = path.join(__dirname, 'web-interface', 'index.html');
  if (fs.existsSync(webInterfacePath)) {
    res.sendFile(webInterfacePath);
  } else {
    const landingPath = path.join(__dirname, 'deploy', 'landing-page.html');
    if (fs.existsSync(landingPath)) {
      res.sendFile(landingPath);
    } else {
      res.status(404).send('Landing page not found');
    }
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

app.post('/api/tasks', (req, res) => {
  const { model, input, priority } = req.body;
  
  if (!model || !input) {
    return res.status(400).json({
      success: false,
      error: 'Model и input обязательны'
    });
  }
  
  const newTask = {
    id: `task-${Date.now()}`,
    model: model,
    input: input,
    priority: priority || 'normal',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  mockTasks.unshift(newTask);
  
  res.json({
    success: true,
    task: newTask
  });
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
  res.json({
    status: 'OK',
    service: 'NeuroGrid Enhanced Simple Server',
    timestamp: new Date().toISOString(),
    version: '1.1.0-enhanced',
    features: ['API', 'Auth', 'CORS', 'Static Files']
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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NeuroGrid Enhanced Simple Server started!`);
  console.log(`📍 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`🌐 All interfaces: IPv4 and IPv6`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Available routes:`);
  console.log(`   / - Web Interface`);
  console.log(`   /demo - Demo page`);
  console.log(`   /investors - Investors page`);
  console.log(`   /api/docs - API documentation`);
  console.log(`   /technical-docs - Technical documentation`);
  console.log(`📡 API Endpoints:`);
  console.log(`   POST /api/auth/login - User login`);
  console.log(`   POST /api/auth/register - User registration`);
  console.log(`   GET  /api/auth/profile - User profile`);
  console.log(`   GET  /api/nodes/stats - Network stats`);
  console.log(`   GET  /api/tasks - Task list`);
  console.log(`   POST /api/tasks - Submit task`);
  console.log(`   GET  /api/nodes - Node list`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});