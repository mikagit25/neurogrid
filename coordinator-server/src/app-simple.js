const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware - CORS for development
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'NeuroGrid Coordinator API',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'NeuroGrid Coordinator API',
    version: '0.1.0',
    environment: 'development',
    endpoints: [
      'GET /health - Health check',
      'GET /api/info - API information',
      'POST /api/tasks - Submit AI task',
      'GET /api/tasks - List tasks',
      'GET /api/nodes - List nodes'
    ]
  });
});

// Simple task submission endpoint
app.post('/api/tasks', (req, res) => {
  const { prompt, model = 'llama2:7b' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  res.json({
    success: true,
    task_id: taskId,
    status: 'queued',
    estimated_time: '2-5 seconds',
    model,
    message: 'Task submitted successfully'
  });
});

// List tasks
app.get('/api/tasks', (req, res) => {
  res.json({
    success: true,
    tasks: [
      {
        id: 'task_example_1',
        status: 'completed',
        model: 'llama2:7b',
        created_at: new Date().toISOString()
      }
    ],
    total: 1
  });
});

// List nodes
app.get('/api/nodes', (req, res) => {
  res.json({
    success: true,
    nodes: [
      {
        id: 'node_1',
        location: 'Germany',
        status: 'online',
        gpu: 'RTX 4090'
      },
      {
        id: 'node_2',
        location: 'USA',
        status: 'online',
        gpu: 'RTX 3090'
      }
    ],
    total: 2
  });
});

// Get task by ID
app.get('/api/tasks/:taskId', (req, res) => {
  const { taskId } = req.params;

  // Mock task data for development
  const mockTask = {
    id: taskId,
    status: 'completed',
    prompt: 'Explain quantum computing in simple terms',
    model: 'llama2:7b',
    result: 'Quantum computing is a revolutionary approach to processing information that leverages the strange properties of quantum mechanics. Unlike classical computers that use bits (0 or 1), quantum computers use quantum bits or "qubits" that can exist in multiple states simultaneously through a property called superposition...',
    created_at: new Date(Date.now() - 5000).toISOString(),
    completed_at: new Date().toISOString(),
    processing_time: 2.3,
    cost: 0.001,
    node_id: 'node_1',
    node_location: 'Germany'
  };

  res.json({
    success: true,
    task: mockTask
  });
});

// Wallet/Token endpoints
app.get('/api/tokens/balance', (req, res) => {
  res.json({
    success: true,
    balance: {
      total: 1000.50,
      available: 850.25,
      locked: 150.25,
      currency: 'NEURO'
    }
  });
});

app.get('/api/tokens/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const mockTransactions = [
    {
      id: 'tx_1',
      type: 'earn',
      amount: 15.50,
      description: 'Task completion reward',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed'
    },
    {
      id: 'tx_2',
      type: 'spend',
      amount: -5.25,
      description: 'AI task submission',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: 'completed'
    },
    {
      id: 'tx_3',
      type: 'earn',
      amount: 23.75,
      description: 'Node operation reward',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      status: 'completed'
    }
  ];

  res.json({
    success: true,
    transactions: mockTransactions.slice(0, limit),
    total: mockTransactions.length
  });
});

app.get('/api/tokens/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      total_earned: 1234.75,
      total_spent: 234.25,
      tasks_completed: 45,
      avg_task_reward: 15.30,
      monthly_earnings: 890.50
    }
  });
});

app.post('/api/tokens/add-funds', (req, res) => {
  const { amount } = req.body;
  res.json({
    success: true,
    message: 'Funds added successfully',
    amount: parseFloat(amount),
    new_balance: 1000.50 + parseFloat(amount)
  });
});

app.post('/api/tokens/withdraw', (req, res) => {
  const { amount } = req.body;
  res.json({
    success: true,
    message: 'Withdrawal processed',
    amount: parseFloat(amount),
    new_balance: 1000.50 - parseFloat(amount)
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 NeuroGrid Coordinator API started!');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api/info`);
  console.log('⚡ Environment: development');
});

module.exports = app;
