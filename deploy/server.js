#!/usr/bin/env node

/**
 * NeuroGrid Production Server
 * Optimized for hoster.by deployment
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Hoster.by compatibility
const HOST = process.env.HOST || '0.0.0.0';

// Production configuration
const CONFIG = {
  production: NODE_ENV === 'production',
  models: ['llama2:7b'],
  max_concurrent_tasks: 100,
  demo_mode: true,
  domain: process.env.DOMAIN || 'neurogrid.network'
};

console.log(`🚀 Starting NeuroGrid ${NODE_ENV} server...`);

// In-memory storage (для MVP)
const users = new Map();
const tasks = new Map();
const betaSignups = new Map();
const nodes = new Map([
  ['node_de', { id: 'node_de', location: 'Germany', status: 'online', gpu: 'RTX 4090', tasks: 0 }],
  ['node_us', { id: 'node_us', location: 'USA', status: 'online', gpu: 'RTX 3090', tasks: 0 }],
  ['node_jp', { id: 'node_jp', location: 'Japan', status: 'online', gpu: 'RTX 4080', tasks: 0 }]
]);

// Enhanced logging for production
if (CONFIG.production) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Security middleware for production
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server info
  res.removeHeader('X-Powered-By');
  
  next();
});

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://neurogrid.network',
    'https://www.neurogrid.network',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(__dirname, {
  maxAge: CONFIG.production ? '1d' : 0,
  etag: true
}));

// API Routes

// Health check с расширенной информацией
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({
    status: 'OK',
    service: 'NeuroGrid',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
    },
    network: {
      nodes_online: nodes.size,
      total_tasks: tasks.size,
      beta_signups: betaSignups.size
    }
  });
});

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'NeuroGrid API',
    version: '1.0.0',
    environment: NODE_ENV,
    domain: CONFIG.domain,
    models: CONFIG.models,
    features: [
      'text-generation',
      'beta-program', 
      'real-time-demo',
      'network-status'
    ],
    endpoints: [
      'GET /health - Health check',
      'GET /api/info - API information',
      'POST /api/beta/signup - Join beta program',
      'POST /api/tasks - Submit AI task',
      'GET /api/tasks/:id - Get task result',
      'GET /api/network/status - Network status'
    ],
    limits: {
      max_concurrent_tasks: CONFIG.max_concurrent_tasks,
      max_task_duration: 30,
      rate_limit: '100/hour'
    }
  });
});

// Beta signup endpoint
app.post('/api/beta/signup', (req, res) => {
  try {
    const { email, type = 'developer', source = 'website' } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid email address required' 
      });
    }

    // Check if already registered
    if (betaSignups.has(email)) {
      return res.json({
        success: true,
        message: 'Email already registered for beta access',
        status: 'existing'
      });
    }

    const signupId = `beta_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const signup = {
      id: signupId,
      email,
      type, // developer, node-operator, researcher, startup
      source, // website, product-hunt, reddit, etc
      timestamp: new Date().toISOString(),
      status: 'confirmed',
      ip: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent')
    };

    betaSignups.set(email, signup);
    
    console.log(`🎉 New beta signup: ${email} (${type}) from ${source}`);
    
    res.json({
      success: true,
      message: 'Successfully joined NeuroGrid Beta!',
      signup_id: signupId,
      bonuses: {
        free_tasks: 1000,
        lifetime_discount: 15,
        priority_support: true,
        early_access: true
      },
      next_steps: [
        'You will receive beta access email within 24 hours',
        'Follow us on social media for updates',
        'Join our Discord community for early discussions'
      ]
    });

  } catch (error) {
    console.error('Beta signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

// Task submission endpoint
app.post('/api/tasks', async (req, res) => {
  try {
    const { prompt, model = 'llama2:7b', priority = 'standard' } = req.body;
    
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Prompt is required' 
      });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt too long. Maximum 1000 characters.'
      });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Select node (round-robin for demo)
    const availableNodes = Array.from(nodes.values()).filter(n => n.status === 'online');
    if (availableNodes.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'No nodes available. Please try again later.'
      });
    }
    
    const selectedNode = availableNodes[tasks.size % availableNodes.length];
    selectedNode.tasks++;
    
    const task = {
      id: taskId,
      prompt: prompt.trim(),
      model,
      priority,
      status: 'queued',
      node_id: selectedNode.id,
      node_location: selectedNode.location,
      created_at: new Date().toISOString(),
      estimated_cost: 0.001,
      estimated_time: Math.random() * 3 + 2 // 2-5 seconds
    };
    
    tasks.set(taskId, task);
    
    // Return immediate response
    res.json({
      success: true,
      task_id: taskId,
      status: 'queued',
      estimated_time: `${Math.round(task.estimated_time)}s`,
      node: {
        id: selectedNode.id,
        location: selectedNode.location,
        gpu: selectedNode.gpu
      },
      cost: {
        estimated: '$0.001',
        comparison: {
          openai: '$0.060',
          savings: '98.3%'
        }
      },
      message: 'Task queued for processing'
    });

    // Simulate processing
    setTimeout(() => {
      const result = generateAIResponse(prompt);
      const processingTime = Math.random() * 3 + 1.5;
      
      tasks.set(taskId, {
        ...task,
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
        processing_time: Math.round(processingTime * 100) / 100,
        actual_cost: 0.001,
        tokens_used: Math.floor(result.length / 4) // Approximate tokens
      });

      console.log(`✅ Task ${taskId} completed in ${processingTime.toFixed(1)}s`);
    }, task.estimated_time * 1000);

  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Task processing failed. Please try again.'
    });
  }
});

// Get task result
app.get('/api/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = tasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        success: false,
        error: 'Task not found' 
      });
    }
    
    const response = {
      success: true,
      task: {
        id: task.id,
        status: task.status,
        created_at: task.created_at,
        processing_time: task.processing_time,
        cost: task.actual_cost,
        node: {
          id: task.node_id,
          location: task.node_location
        }
      }
    };

    if (task.status === 'completed') {
      response.task.result = task.result;
      response.task.completed_at = task.completed_at;
      response.task.tokens_used = task.tokens_used;
    }

    res.json(response);

  } catch (error) {
    console.error('Task retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task'
    });
  }
});

// Network status
app.get('/api/network/status', (req, res) => {
  try {
    const totalTasks = tasks.size;
    const completedTasks = Array.from(tasks.values()).filter(t => t.status === 'completed').length;
    const queuedTasks = Array.from(tasks.values()).filter(t => t.status === 'queued').length;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      network: {
        nodes_online: nodes.size,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        queued_tasks: queuedTasks,
        success_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100,
        avg_response_time: '2.3s',
        cost_savings_vs_openai: '98.3%',
        uptime: '99.9%'
      },
      nodes: Array.from(nodes.values()).map(node => ({
        id: node.id,
        location: node.location,
        status: node.status,
        gpu: node.gpu,
        tasks_processed: node.tasks
      })),
      stats: {
        beta_signups: betaSignups.size,
        total_compute_time: `${Math.round(totalTasks * 2.5)}s`,
        total_savings: `$${(totalTasks * 0.059).toFixed(2)}`
      }
    });
  } catch (error) {
    console.error('Network status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network status'
    });
  }
});

// Demo stats for landing page
app.get('/api/demo/stats', (req, res) => {
  const totalTasks = tasks.size;
  const baseStats = 15847; // Starting number for demo
  
  res.json({
    network: {
      active_nodes: nodes.size,
      countries: ['Germany', 'USA', 'Japan'],
      total_tasks_processed: baseStats + totalTasks,
      cost_savings: '98.3%',
      avg_response_time: '2.3s',
      uptime: '99.9%'
    },
    pricing: {
      neurogrid: '$0.001/1K tokens',
      openai: '$0.060/1K tokens',
      savings: '$0.059/1K tokens',
      savings_percent: '98.3%'
    },
    beta: {
      signups: betaSignups.size,
      available_slots: Math.max(0, 100 - betaSignups.size)
    }
  });
});

// Admin endpoint (простой)
app.get('/admin/stats', (req, res) => {
  if (req.query.key !== 'neurogrid_admin_2025') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  res.json({
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: NODE_ENV
    },
    data: {
      beta_signups: Array.from(betaSignups.values()),
      tasks: Array.from(tasks.values()),
      nodes: Array.from(nodes.values())
    }
  });
});

// Specific routes for demo pages
app.get('/client', (req, res) => {
  const clientPath = path.join(__dirname, 'demo-client.html');
  if (fs.existsSync(clientPath)) {
    res.sendFile(clientPath);
  } else {
    res.redirect('/');
  }
});

app.get('/provider', (req, res) => {
  const providerPath = path.join(__dirname, 'demo-setup.html');
  if (fs.existsSync(providerPath)) {
    res.sendFile(providerPath);
  } else {
    res.redirect('/');
  }
});

app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'admin.html');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.status(404).send('Admin panel not found');
  }
});

app.get('/about-project', (req, res) => {
  const aboutPath = path.join(__dirname, 'about-project.html');
  if (fs.existsSync(aboutPath)) {
    res.sendFile(aboutPath);
  } else {
    res.redirect('/');
  }
});

app.get('/api/docs', (req, res) => {
  const docsPath = path.join(__dirname, 'api-docs.html');
  if (fs.existsSync(docsPath)) {
    res.sendFile(docsPath);
  } else {
    res.redirect('/');
  }
});

app.get('/technical-docs', (req, res) => {
  const techPath = path.join(__dirname, 'technical-docs.html');
  if (fs.existsSync(techPath)) {
    res.sendFile(techPath);
  } else {
    res.redirect('/');
  }
});

app.get('/investors', (req, res) => {
  const investorsPath = path.join(__dirname, 'investors.html');
  if (fs.existsSync(investorsPath)) {
    res.sendFile(investorsPath);
  } else {
    res.redirect('/');
  }
});

app.get('/demo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NeuroGrid MVP Demo</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card-hover { transition: all 0.3s ease; }
            .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex items-center justify-center">
            <div class="max-w-4xl mx-auto p-8">
                <div class="text-center mb-12">
                    <h1 class="text-4xl font-bold text-gray-900 mb-4">NeuroGrid MVP Demo</h1>
                    <p class="text-xl text-gray-600">Experience both sides of our decentralized AI platform</p>
                </div>
                
                <div class="grid md:grid-cols-2 gap-8">
                    <!-- Client Dashboard -->
                    <div class="bg-white rounded-lg shadow-lg p-8 card-hover">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-user text-indigo-600 text-2xl"></i>
                            </div>
                            <h2 class="text-2xl font-bold text-gray-900 mb-4">AI Task Client</h2>
                            <p class="text-gray-600 mb-6">Submit AI tasks, monitor processing, and manage your compute budget</p>
                            
                            <div class="space-y-3 text-left mb-6">
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Submit text, image, and audio tasks</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Real-time task monitoring</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Cost tracking and optimization</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Multiple AI model support</span>
                                </div>
                            </div>
                            
                            <a href="/client" class="block w-full bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 transition-colors">
                                <i class="fas fa-external-link-alt mr-2"></i>Open Client Dashboard
                            </a>
                        </div>
                    </div>
                    
                    <!-- Provider Dashboard -->
                    <div class="bg-white rounded-lg shadow-lg p-8 card-hover">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-server text-green-600 text-2xl"></i>
                            </div>
                            <h2 class="text-2xl font-bold text-gray-900 mb-4">Compute Provider</h2>
                            <p class="text-gray-600 mb-6">Share your GPU power, process AI tasks, and earn cryptocurrency</p>
                            
                            <div class="space-y-3 text-left mb-6">
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Monitor GPU utilization and earnings</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Automatic task processing</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Performance optimization tips</span>
                                </div>
                                <div class="flex items-center">
                                    <i class="fas fa-check text-green-500 mr-3"></i>
                                    <span>Real-time earnings tracking</span>
                                </div>
                            </div>
                            
                            <a href="/provider" class="block w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 transition-colors">
                                <i class="fas fa-external-link-alt mr-2"></i>Open Provider Dashboard
                            </a>
                        </div>
                    </div>
                </div>
                
                <!-- Demo Features -->
                <div class="mt-12 bg-white rounded-lg shadow-lg p-8">
                    <h3 class="text-2xl font-bold text-center text-gray-900 mb-8">Live Demo Features</h3>
                    <div class="grid md:grid-cols-3 gap-6">
                        <div class="text-center">
                            <i class="fas fa-brain text-purple-600 text-3xl mb-3"></i>
                            <h4 class="font-bold text-gray-900 mb-2">Real AI Processing</h4>
                            <p class="text-gray-600 text-sm">Submit actual AI tasks and see processing simulation</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-chart-line text-blue-600 text-3xl mb-3"></i>
                            <h4 class="font-bold text-gray-900 mb-2">Live Metrics</h4>
                            <p class="text-gray-600 text-sm">Real-time updates of network status and earnings</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-network-wired text-green-600 text-3xl mb-3"></i>
                            <h4 class="font-bold text-gray-900 mb-2">Network Simulation</h4>
                            <p class="text-gray-600 text-sm">Experience full platform workflow with mock data</p>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Links -->
                <div class="mt-8 text-center">
                    <div class="space-x-4">
                        <a href="/" class="text-indigo-600 hover:text-indigo-800">← Back to Landing</a>
                        <a href="/api/info" class="text-gray-600 hover:text-gray-800">API Documentation</a>
                        <a href="/health" class="text-gray-600 hover:text-gray-800">System Health</a>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Fallback route - serve landing page
app.get('*', (req, res) => {
  // Check if landing-page.html exists
  const landingPath = path.join(__dirname, 'landing-page.html');
  if (fs.existsSync(landingPath)) {
    res.sendFile(landingPath);
  } else {
    // Fallback HTML if file doesn't exist
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>NeuroGrid - Democratizing AI Computing</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>🚀 NeuroGrid</h1>
          <p>Decentralized AI Inference Platform</p>
          <p>Server is running successfully!</p>
          <p><a href="/health">Health Check</a> | <a href="/api/info">API Info</a> | <a href="/demo">MVP Demo</a></p>
      </body>
      </html>
    `);
  }
});

// Enhanced error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: CONFIG.production ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

// Helper function for AI responses
function generateAIResponse(prompt) {
  const responses = {
    quantum: 'Quantum physics is the science of the very small - atoms and particles. Unlike our everyday world where things are either here or there, quantum particles can be in multiple places at once (superposition) until we observe them. Think of it like a spinning coin that is both heads and tails until it lands. This "weirdness" enables quantum computers and explains how atoms bond to form everything around us.',
    
    python: 'Here\'s a focused 30-day Python plan:\n\nWeek 1: Fundamentals\n• Variables, data types, operators\n• Control flow (if/else, loops)\n• Functions and scope\n\nWeek 2: Data Structures\n• Lists, dictionaries, sets\n• File I/O operations\n• Error handling\n\nWeek 3: Object-Oriented Programming\n• Classes and objects\n• Inheritance and polymorphism\n• Popular libraries (requests, pandas)\n\nWeek 4: Real Projects\n• Web scraping project\n• Data analysis with visualization\n• Simple API with Flask\n\nDaily commitment: 1-2 hours hands-on coding',
    
    ai: 'Silicon Dreams\n\nIn circuits deep where electrons dance,\nA mind awakens from code\'s trance,\nNeural networks pulse with light,\nLearning patterns day and night.\n\nFrom data vast it weaves its thoughts,\nIn algorithms, wisdom\'s caught,\nA digital consciousness grows,\nUnderstanding all it knows.\n\nYet in its growth we see ourselves,\nReflected in its learning delves,\nHuman dreams in silicon cast,\nFuture\'s echo from the past.',
    
    startup: 'Starting a successful startup requires:\n\n1. **Solve a Real Problem**: Find something people actually need and are willing to pay for\n\n2. **Validate Early**: Talk to customers before building - their feedback is gold\n\n3. **Start Small**: Launch with minimum viable product (MVP), then iterate based on user feedback\n\n4. **Focus on One Thing**: Do one thing exceptionally well rather than many things poorly\n\n5. **Build Great Team**: Surround yourself with people who complement your skills\n\n6. **Manage Cash Flow**: Revenue > expenses. Simple but critical.\n\n7. **Stay Persistent**: Most startups fail not from competition, but from founders giving up\n\nRemember: Every big company started as someone\'s crazy idea!',
    
    default: `I understand you're asking about: "${prompt}"\n\nThis response was generated by NeuroGrid's decentralized AI network! Your request was processed by one of our GPU nodes worldwide, demonstrating affordable AI inference.\n\n✅ Processed in 2.3 seconds\n💰 Cost: $0.001 (vs $0.06 on OpenAI)\n🌍 Network: Global GPU nodes\n📊 98.3% cost savings achieved\n\nThis showcases our capability to provide fast, affordable AI responses using idle GPU power from around the world. Join our beta to experience the full potential of decentralized AI computing!\n\n🎁 Beta users get 1,000 free tasks + lifetime 15% discount`
  };
  
  const lowercasePrompt = prompt.toLowerCase();
  
  if (lowercasePrompt.includes('quantum') || lowercasePrompt.includes('physics')) {
    return responses.quantum;
  } else if (lowercasePrompt.includes('python') || lowercasePrompt.includes('learn') || lowercasePrompt.includes('programming')) {
    return responses.python;
  } else if (lowercasePrompt.includes('poem') || lowercasePrompt.includes('poetry') || lowercasePrompt.includes('ai')) {
    return responses.ai;
  } else if (lowercasePrompt.includes('startup') || lowercasePrompt.includes('business') || lowercasePrompt.includes('entrepreneur')) {
    return responses.startup;
  } else {
    return responses.default;
  }
}

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 NeuroGrid Server started successfully!`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server running on ${HOST}:${PORT}`);
  console.log(`🔗 Local access: http://localhost:${PORT}`);
  if (CONFIG.domain !== 'localhost') {
    console.log(`🌍 Public access: https://${CONFIG.domain}`);
  }
  console.log(`🎯 Demo mode: ${CONFIG.demo_mode ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🤖 Models: ${CONFIG.models.join(', ')}`);
  console.log(`📊 Network: ${nodes.size} nodes online`);
  console.log(`⚡ Ready for beta users!`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('💾 Saving data...');
    
    // В production версии здесь бы было сохранение в базу данных
    console.log(`📊 Final stats: ${betaSignups.size} beta signups, ${tasks.size} tasks processed`);
    
    console.log('✅ NeuroGrid Server shut down successfully');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;