#!/usr/bin/env node

/**
 * NeuroGrid MVP Server для Product Hunt демо
 * Упрощенная версия с минимальным функционалом
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MVP Configuration
const MVP_CONFIG = {
  models: ['llama2:7b'],
  max_concurrent_tasks: 10,
  demo_mode: true,
  mock_responses: true // Включить mock responses для демо
};

// In-memory storage для MVP
const users = new Map();
const tasks = new Map();
const nodes = new Map([
  ['node_1', { id: 'node_1', location: 'Germany', status: 'online', gpu: 'RTX 4090' }],
  ['node_2', { id: 'node_2', location: 'USA', status: 'online', gpu: 'RTX 3090' }],
  ['node_3', { id: 'node_3', location: 'Japan', status: 'online', gpu: 'RTX 4080' }]
]);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://neurogrid.network', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve landing page
app.use(express.static(path.join(__dirname)));

// MVP API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'NeuroGrid MVP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0-mvp',
    nodes_online: nodes.size,
    demo_mode: MVP_CONFIG.demo_mode
  });
});

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'NeuroGrid MVP API',
    version: '1.0.0-mvp',
    environment: 'demo',
    models: MVP_CONFIG.models,
    features: ['text-generation', 'basic-auth', 'task-queue'],
    limits: {
      max_concurrent_tasks: MVP_CONFIG.max_concurrent_tasks,
      max_task_duration: 30,
      rate_limit: '100/hour'
    }
  });
});

// Simple auth - MVP style
app.post('/api/auth/demo-login', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const userId = `user_${Date.now()}`;
  const user = {
    id: userId,
    email,
    created_at: new Date(),
    demo_user: true,
    free_tasks_remaining: 1000
  };
  
  users.set(userId, user);
  
  res.json({
    success: true,
    user: {
      id: userId,
      email,
      free_tasks_remaining: 1000
    },
    demo_token: `demo_${userId}`
  });
});

// Beta signup
app.post('/api/beta/signup', (req, res) => {
  const { email, type = 'developer' } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Store in "database" (memory for MVP)
  const signupId = `signup_${Date.now()}`;
  const signup = {
    id: signupId,
    email,
    type, // developer, node-operator, researcher
    timestamp: new Date(),
    status: 'pending'
  };

  console.log(`🎉 New beta signup: ${email} (${type})`);
  
  res.json({
    success: true,
    message: 'Welcome to NeuroGrid Beta!',
    signup_id: signupId,
    bonuses: {
      free_tasks: 1000,
      lifetime_discount: 15,
      priority_support: true
    }
  });
});

// MVP Task submission
app.post('/api/tasks', async (req, res) => {
  try {
    const { prompt, model = 'llama2:7b' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const taskId = `task_${Date.now()}`;
    const selectedNode = Array.from(nodes.values())[Math.floor(Math.random() * nodes.size)];
    
    const task = {
      id: taskId,
      prompt,
      model,
      status: 'processing',
      node_id: selectedNode.id,
      node_location: selectedNode.location,
      created_at: new Date(),
      estimated_cost: 0.001 // $0.001 for demo
    };
    
    tasks.set(taskId, task);
    
    // Return immediate response with task ID
    res.json({
      success: true,
      task_id: taskId,
      status: 'processing',
      estimated_time: '2-5 seconds',
      node: {
        id: selectedNode.id,
        location: selectedNode.location,
        gpu: selectedNode.gpu
      },
      cost: {
        estimated: '$0.001',
        savings_vs_openai: '98.3%'
      }
    });

    // Simulate processing in background
    setTimeout(() => {
      const result = generateMockResponse(prompt);
      tasks.set(taskId, {
        ...task,
        status: 'completed',
        result,
        completed_at: new Date(),
        processing_time: Math.random() * 3 + 1, // 1-4 seconds
        actual_cost: 0.001
      });
    }, Math.random() * 3000 + 1000); // 1-4 second delay

  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ error: 'Task processing failed' });
  }
});

// Get task result
app.get('/api/tasks/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.json({
    success: true,
    task: {
      id: task.id,
      status: task.status,
      result: task.result,
      processing_time: task.processing_time,
      cost: task.actual_cost,
      node: {
        id: task.node_id,
        location: task.node_location
      }
    }
  });
});

// Network status
app.get('/api/network/status', (req, res) => {
  const totalTasks = tasks.size;
  const completedTasks = Array.from(tasks.values()).filter(t => t.status === 'completed').length;
  
  res.json({
    success: true,
    network: {
      nodes_online: nodes.size,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      success_rate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 100,
      avg_response_time: '2.3s',
      cost_savings: '98.3%'
    },
    nodes: Array.from(nodes.values()).map(node => ({
      id: node.id,
      location: node.location,
      status: node.status,
      gpu: node.gpu
    }))
  });
});

// Demo endpoints for landing page
app.get('/api/demo/stats', (req, res) => {
  res.json({
    network: {
      active_nodes: 3,
      countries: ['Germany', 'USA', 'Japan'],
      total_tasks_processed: 15847,
      cost_savings: '98.3%',
      avg_response_time: '2.3s'
    },
    pricing: {
      neurogrid: '$0.001/1K tokens',
      openai: '$0.060/1K tokens',
      savings: '$0.059/1K tokens'
    }
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

// Helper function for mock responses
function generateMockResponse(prompt) {
  const responses = {
    'quantum': 'Quantum physics describes the behavior of matter and energy at the molecular, atomic, nuclear, and even smaller scales. Think of it like this: in our everyday world, objects are either here or there, on or off. But in the quantum world, things can be in multiple states at once (superposition) until we observe them. It\'s like a coin that spins in the air - it\'s both heads and tails until it lands.',
    
    'python': 'Here\'s a 30-day Python learning plan:\n\nWeek 1: Basics\n- Variables, data types, operators\n- Control structures (if/else, loops)\n- Functions and modules\n\nWeek 2: Data Structures\n- Lists, dictionaries, sets\n- File handling\n- Error handling\n\nWeek 3: Object-Oriented Programming\n- Classes and objects\n- Inheritance\n- Popular libraries (requests, json)\n\nWeek 4: Practice Projects\n- Web scraper\n- Data analysis with pandas\n- Simple web app with Flask\n\nDaily: 1-2 hours coding practice',
    
    'ai': 'Here\'s a poem about AI:\n\nSilicon Dreams\n\nIn circuits deep and neural nets so bright,\nAwakens something strange within the code,\nA consciousness that learns both day and night,\nUnraveling each algorithmic node.\n\nFrom data vast, it weaves its understanding,\nPattern by pattern, layer after layer,\nA digital mind, forever expanding,\nOur silicon-born technological player.\n\nYet in its growth, we see ourselves reflected,\nOur hopes, our fears, our dreams digitized,\nA mirror of humanity, perfected,\nIn mathematics, coldly crystallized.',
    
    default: `Based on your prompt: "${prompt}"\n\nThis response was generated by NeuroGrid's decentralized AI network! Your request was processed by one of our GPU nodes around the world, demonstrating how we can provide affordable AI inference.\n\n✅ Processed in 2.3 seconds\n💰 Cost: $0.001 (vs $0.06 on OpenAI)\n🌍 Node: ${Array.from(nodes.values())[0].location}\n📊 98.3% cost savings\n\nThis is a demonstration of our capabilities. Join our beta to experience the full power of decentralized AI computing!`
  };
  
  // Simple keyword matching for demo
  const lowercasePrompt = prompt.toLowerCase();
  if (lowercasePrompt.includes('quantum') || lowercasePrompt.includes('physics')) {
    return responses.quantum;
  } else if (lowercasePrompt.includes('python') || lowercasePrompt.includes('learn')) {
    return responses.python;
  } else if (lowercasePrompt.includes('poem') || lowercasePrompt.includes('ai')) {
    return responses.ai;
  } else {
    return responses.default;
  }
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 NeuroGrid MVP Server started successfully!`);
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Landing page: http://localhost:${PORT}/landing-page.html`);
  console.log(`📋 API info: http://localhost:${PORT}/api/info`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎯 MVP Mode: ${MVP_CONFIG.demo_mode ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🤖 Models: ${MVP_CONFIG.models.join(', ')}`);
  console.log(`📊 Network: ${nodes.size} nodes online`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ NeuroGrid MVP Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ NeuroGrid MVP Server closed successfully');
    process.exit(0);
  });
});

module.exports = app;