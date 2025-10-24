# Node.js Integration Guide

## Quick Start

This guide will help you integrate NeuroGrid into your Node.js application in just a few minutes.

### Prerequisites

- Node.js 16+ 
- npm or yarn
- NeuroGrid API key

### Installation

```bash
npm install @neurogrid/sdk
# or
yarn add @neurogrid/sdk
```

### Basic Setup

```javascript
const { NeuroGrid } = require('@neurogrid/sdk');

// Initialize client
const client = new NeuroGrid({
  apiKey: process.env.NEUROGRID_API_KEY,
  baseUrl: 'https://api.neurogrid.io'
});

// Test connection
async function testConnection() {
  try {
    const models = await client.models.list();
    console.log('✅ Connected to NeuroGrid!');
    console.log('Available models:', models.data.models.length);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
```

## Environment Configuration

Create a `.env` file in your project root:

```env
NEUROGRID_API_KEY=your_api_key_here
NEUROGRID_BASE_URL=https://api.neurogrid.io
```

Load environment variables:

```javascript
require('dotenv').config();

const client = new NeuroGrid({
  apiKey: process.env.NEUROGRID_API_KEY
});
```

## Text Generation Example

```javascript
const express = require('express');
const { NeuroGrid } = require('@neurogrid/sdk');

const app = express();
const client = new NeuroGrid({ apiKey: process.env.NEUROGRID_API_KEY });

app.use(express.json());

// Text generation endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model = 'llama2-7b' } = req.body;
    
    const result = await client.models.generateText({
      model,
      prompt,
      maxTokens: 150
    });
    
    res.json({
      success: true,
      text: result.generatedText,
      cost: result.cost
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Express.js Integration

### Complete Express App

```javascript
const express = require('express');
const cors = require('cors');
const { NeuroGrid } = require('@neurogrid/sdk');
const rateLimit = require('express-rate-limit');

const app = express();
const client = new NeuroGrid({ apiKey: process.env.NEUROGRID_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    const result = await client.models.generateText({
      model: 'llama2-7b',
      prompt: `User: ${message}\nAssistant:`,
      maxTokens: 200,
      temperature: 0.7
    });
    
    res.json({
      response: result.generatedText,
      conversationId,
      cost: result.cost
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/image', async (req, res) => {
  try {
    const { prompt, style = 'realistic' } = req.body;
    
    const result = await client.models.generateImage({
      model: 'stable-diffusion-xl',
      prompt: `${prompt}, ${style} style`,
      width: 512,
      height: 512
    });
    
    res.json({
      imageUrl: result.imageUrl,
      cost: result.cost
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## Error Handling

```javascript
const { NeuroGridError, AuthenticationError, RateLimitError } = require('@neurogrid/sdk');

async function handleRequest(prompt) {
  try {
    return await client.models.generateText({
      model: 'llama2-7b',
      prompt
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log('Authentication failed - check API key');
    } else if (error instanceof RateLimitError) {
      console.log(`Rate limited - retry after ${error.retryAfter} seconds`);
    } else if (error instanceof NeuroGridError) {
      console.log(`API Error: ${error.code} - ${error.message}`);
    } else {
      console.log('Unexpected error:', error);
    }
    throw error;
  }
}
```

## Real-time Updates with WebSocket

```javascript
const WebSocket = require('ws');
const { NeuroGrid } = require('@neurogrid/sdk');

const client = new NeuroGrid({ apiKey: process.env.NEUROGRID_API_KEY });

// Connect to NeuroGrid WebSocket
const ws = new WebSocket('wss://api.neurogrid.io/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: process.env.NEUROGRID_API_KEY
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  switch (event.type) {
    case 'task.completed':
      console.log(`Task ${event.data.task_id} completed`);
      break;
    case 'task.failed':
      console.log(`Task ${event.data.task_id} failed:`, event.data.error);
      break;
  }
});

// Generate text with progress tracking
async function generateWithProgress(prompt) {
  const task = await client.models.generateText({
    model: 'llama2-7b',
    prompt,
    stream: true
  });
  
  // Subscribe to task updates
  ws.send(JSON.stringify({
    type: 'subscribe_task',
    task_id: task.id
  }));
  
  return task;
}
```

## Testing

```javascript
const request = require('supertest');
const app = require('./app'); // your express app

describe('NeuroGrid Integration', () => {
  test('should generate text', async () => {
    const response = await request(app)
      .post('/api/generate')
      .send({
        prompt: 'Hello world',
        model: 'llama2-7b'
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.text).toBeDefined();
  });
  
  test('should handle errors gracefully', async () => {
    const response = await request(app)
      .post('/api/generate')
      .send({
        prompt: '', // empty prompt should fail
        model: 'invalid-model'
      })
      .expect(500);
    
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });
});
```

## Production Considerations

### Caching

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  const cacheKey = `generate_${Buffer.from(prompt).toString('base64')}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }
  
  try {
    const result = await client.models.generateText({
      model: 'llama2-7b',
      prompt
    });
    
    // Cache result
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'neurogrid.log' })
  ]
});

const client = new NeuroGrid({
  apiKey: process.env.NEUROGRID_API_KEY,
  onRequest: (request) => {
    logger.info('NeuroGrid Request', { model: request.model });
  },
  onResponse: (response) => {
    logger.info('NeuroGrid Response', { cost: response.cost });
  },
  onError: (error) => {
    logger.error('NeuroGrid Error', { error: error.message });
  }
});
```

### Environment-specific Configuration

```javascript
const config = {
  development: {
    baseUrl: 'https://api-dev.neurogrid.io',
    timeout: 30000,
    retries: 3
  },
  production: {
    baseUrl: 'https://api.neurogrid.io',
    timeout: 60000,
    retries: 5
  }
};

const client = new NeuroGrid({
  apiKey: process.env.NEUROGRID_API_KEY,
  ...config[process.env.NODE_ENV || 'development']
});
```

## Next Steps

1. Read the [API Reference](../endpoints.md)
2. Explore [WebSocket Events](../websocket.md)
3. Check out [Python Integration](./python.md)
4. Learn about [Authentication](../auth.md)