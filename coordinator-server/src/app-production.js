const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://neurogrid.network'],
  credentials: true
}));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'NeuroGrid Coordinator API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NeuroGrid Coordinator API',
    version: '1.0.0',
    documentation: '/api/info',
    health: '/health'
  });
});

// API information endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'NeuroGrid Coordinator API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      health: 'GET /health - Health check',
      info: 'GET /api/info - API information',
      network: 'GET /api/network/status - Network status',
      tasks: {
        submit: 'POST /api/tasks - Submit AI task',
        list: 'GET /api/tasks - List tasks',
        get: 'GET /api/tasks/:id - Get task by ID'
      },
      nodes: 'GET /api/nodes - List available nodes',
      wallet: {
        balance: 'GET /api/wallet/balance - Get wallet balance',
        transactions: 'GET /api/wallet/transactions - Get transaction history',
        stats: 'GET /api/wallet/stats - Get wallet statistics',
        deposit: 'POST /api/wallet/deposit - Add funds',
        withdraw: 'POST /api/wallet/withdraw - Withdraw funds'
      }
    }
  });
});

// Network status endpoint
app.get('/api/network/status', (req, res) => {
  res.json({
    success: true,
    network: {
      status: 'online',
      total_nodes: 15,
      active_nodes: 12,
      total_tasks_completed: 2847,
      avg_response_time: '1.8s',
      network_utilization: '67%',
      last_updated: new Date().toISOString()
    }
  });
});

// Task submission endpoint
app.post('/api/tasks', (req, res) => {
  try {
    const { prompt, model = 'llama2:7b', max_tokens = 500, temperature = 0.7 } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid prompt is required',
        code: 'INVALID_PROMPT'
      });
    }

    if (prompt.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt too long (max 5000 characters)',
        code: 'PROMPT_TOO_LONG'
      });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const estimatedCost = Math.round((prompt.length * 0.001 + max_tokens * 0.002) * 100) / 100;

    res.json({
      success: true,
      task: {
        id: taskId,
        status: 'queued',
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        model,
        max_tokens,
        temperature,
        estimated_time: '2-8 seconds',
        estimated_cost: estimatedCost,
        position_in_queue: Math.floor(Math.random() * 5) + 1,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit task',
      code: 'SUBMISSION_ERROR'
    });
  }
});

// Get tasks list
app.get('/api/tasks', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  // Mock tasks for development
  const allTasks = [
    {
      id: 'task_demo_1',
      status: 'completed',
      prompt: 'Explain quantum computing',
      model: 'llama2:7b',
      cost: 0.034,
      processing_time: 2.1,
      created_at: new Date(Date.now() - 300000).toISOString(),
      completed_at: new Date(Date.now() - 295000).toISOString()
    },
    {
      id: 'task_demo_2',
      status: 'processing',
      prompt: 'Write a Python function',
      model: 'codellama:13b',
      cost: 0.067,
      created_at: new Date(Date.now() - 30000).toISOString()
    },
    {
      id: 'task_demo_3',
      status: 'queued',
      prompt: 'Translate to Russian',
      model: 'llama2:7b',
      estimated_cost: 0.022,
      created_at: new Date(Date.now() - 10000).toISOString()
    }
  ];

  let filteredTasks = allTasks;
  if (status) {
    filteredTasks = allTasks.filter(task => task.status === status);
  }

  const paginatedTasks = filteredTasks.slice(offset, offset + limit);

  res.json({
    success: true,
    tasks: paginatedTasks,
    pagination: {
      total: filteredTasks.length,
      limit,
      offset,
      has_more: offset + limit < filteredTasks.length
    }
  });
});

// Get task by ID
app.get('/api/tasks/:taskId', (req, res) => {
  const { taskId } = req.params;

  // Mock detailed task data
  const mockTask = {
    id: taskId,
    status: 'completed',
    prompt: 'Explain the concept of machine learning in simple terms suitable for beginners',
    model: 'llama2:7b',
    max_tokens: 500,
    temperature: 0.7,
    result: 'Machine learning is like teaching a computer to recognize patterns and make predictions, similar to how humans learn from experience. Imagine showing a child thousands of pictures of cats and dogs. Eventually, they learn to distinguish between them. Machine learning works similarly - we show computers lots of data, and they learn to identify patterns and make predictions about new, unseen data. The three main types are: 1) Supervised learning (learning with examples), 2) Unsupervised learning (finding hidden patterns), and 3) Reinforcement learning (learning through trial and error with rewards).',
    cost: 0.045,
    processing_time: 3.2,
    created_at: new Date(Date.now() - 300000).toISOString(),
    started_at: new Date(Date.now() - 295000).toISOString(),
    completed_at: new Date(Date.now() - 292000).toISOString(),
    node: {
      id: 'node_gpu_01',
      location: 'Germany',
      gpu: 'RTX 4090'
    }
  };

  res.json({
    success: true,
    task: mockTask
  });
});

// List available nodes
app.get('/api/nodes', (req, res) => {
  const mockNodes = [
    {
      id: 'node_gpu_01',
      location: 'Germany',
      status: 'online',
      gpu: 'RTX 4090',
      cpu: 'AMD Ryzen 9 7950X',
      ram: '64GB',
      models: ['llama2:7b', 'llama2:13b', 'codellama:7b'],
      avg_response_time: '1.2s',
      tasks_completed: 1247,
      uptime: '99.8%'
    },
    {
      id: 'node_gpu_02',
      location: 'USA',
      status: 'online',
      gpu: 'RTX 3090',
      cpu: 'Intel i9-12900K',
      ram: '32GB',
      models: ['llama2:7b', 'vicuna:7b'],
      avg_response_time: '1.5s',
      tasks_completed: 892,
      uptime: '99.2%'
    },
    {
      id: 'node_gpu_03',
      location: 'Singapore',
      status: 'maintenance',
      gpu: 'RTX 4080',
      cpu: 'AMD Ryzen 7 7700X',
      ram: '32GB',
      models: ['llama2:7b'],
      avg_response_time: '1.8s',
      tasks_completed: 634,
      uptime: '97.5%'
    }
  ];

  const onlineNodes = mockNodes.filter(node => node.status === 'online');

  res.json({
    success: true,
    nodes: mockNodes,
    summary: {
      total: mockNodes.length,
      online: onlineNodes.length,
      offline: mockNodes.filter(n => n.status === 'offline').length,
      maintenance: mockNodes.filter(n => n.status === 'maintenance').length
    }
  });
});

// Wallet balance
app.get('/api/wallet/balance', (req, res) => {
  res.json({
    success: true,
    balance: {
      total: 1247.85,
      available: 1097.60,
      locked: 150.25,
      currency: 'NEURO',
      usd_value: 623.93,
      last_updated: new Date().toISOString()
    }
  });
});

// Wallet transactions
app.get('/api/wallet/transactions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const type = req.query.type; // 'earn', 'spend', 'deposit', 'withdraw'

  const mockTransactions = [
    {
      id: 'tx_' + Date.now() + '_1',
      type: 'earn',
      amount: 15.50,
      description: 'Task completion reward',
      task_id: 'task_demo_1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed',
      confirmations: 6
    },
    {
      id: 'tx_' + Date.now() + '_2',
      type: 'spend',
      amount: -5.25,
      description: 'AI task submission',
      task_id: 'task_demo_2',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: 'completed',
      confirmations: 12
    },
    {
      id: 'tx_' + Date.now() + '_3',
      type: 'earn',
      amount: 23.75,
      description: 'Node operation reward',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      status: 'completed',
      confirmations: 144
    },
    {
      id: 'tx_' + Date.now() + '_4',
      type: 'deposit',
      amount: 100.00,
      description: 'Wallet funding',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      status: 'completed',
      confirmations: 288
    }
  ];

  let filteredTransactions = mockTransactions;
  if (type) {
    filteredTransactions = mockTransactions.filter(tx => tx.type === type);
  }

  res.json({
    success: true,
    transactions: filteredTransactions.slice(0, limit),
    summary: {
      total: filteredTransactions.length,
      total_earned: mockTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
      total_spent: Math.abs(mockTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0))
    }
  });
});

// Wallet statistics
app.get('/api/wallet/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      total_earned: 1634.75,
      total_spent: 387.90,
      net_earnings: 1246.85,
      tasks_completed: 67,
      tasks_submitted: 89,
      avg_task_reward: 24.40,
      monthly_earnings: 890.50,
      daily_average: 29.68,
      best_day: 156.30,
      earning_streak: 12,
      rank: 'Gold',
      achievements: ['Early Adopter', 'Task Master', 'Network Supporter']
    }
  });
});

// Deposit funds
app.post('/api/wallet/deposit', (req, res) => {
  try {
    const { amount, method = 'crypto' } = req.body;
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount required',
        code: 'INVALID_AMOUNT'
      });
    }

    if (numAmount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum deposit is 1 NEURO',
        code: 'AMOUNT_TOO_SMALL'
      });
    }

    const depositId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    res.json({
      success: true,
      deposit: {
        id: depositId,
        amount: numAmount,
        method,
        status: 'pending',
        estimated_confirmation: '5-10 minutes',
        new_balance: 1247.85 + numAmount,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process deposit',
      code: 'DEPOSIT_ERROR'
    });
  }
});

// Withdraw funds
app.post('/api/wallet/withdraw', (req, res) => {
  try {
    const { amount, address, method = 'crypto' } = req.body;
    const numAmount = parseFloat(amount);
    const currentBalance = 1097.60; // Available balance

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount required',
        code: 'INVALID_AMOUNT'
      });
    }

    if (numAmount > currentBalance) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        available: currentBalance,
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    if (numAmount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal is 10 NEURO',
        code: 'AMOUNT_TOO_SMALL'
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Withdrawal address required',
        code: 'ADDRESS_REQUIRED'
      });
    }

    const withdrawalId = `wth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const fee = Math.max(numAmount * 0.01, 0.5); // 1% fee, minimum 0.5 NEURO
    const netAmount = numAmount - fee;

    res.json({
      success: true,
      withdrawal: {
        id: withdrawalId,
        amount: numAmount,
        fee,
        net_amount: netAmount,
        address,
        method,
        status: 'pending',
        estimated_processing: '1-2 hours',
        new_balance: currentBalance - numAmount,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal',
      code: 'WITHDRAWAL_ERROR'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 NeuroGrid Coordinator API v1.0.0 started!');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api/info`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log('⚡ Ready to process requests!');
});

module.exports = app;
