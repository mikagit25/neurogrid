# JavaScript SDK Examples

## Installation

```bash
npm install @neurogrid/sdk
# or
yarn add @neurogrid/sdk
```

## Quick Start

```javascript
const NeuroGrid = require('@neurogrid/sdk');

// Initialize client
const client = new NeuroGrid({
  apiKey: process.env.NEUROGRID_API_KEY,
  baseUrl: 'https://api.neurogrid.io'
});

// Basic text generation
async function generateText() {
  try {
    const result = await client.models.generateText({
      model: 'llama2-7b',
      prompt: 'Write a short story about AI',
      maxTokens: 200
    });
    
    console.log(result.generatedText);
    console.log(`Cost: $${result.cost}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generateText();
```

## Authentication Examples

### Using JWT Tokens

```javascript
const client = new NeuroGrid();

// Login with credentials
const auth = await client.auth.login({
  email: 'user@example.com',
  password: 'securepassword'
});

// Token is automatically stored and used for subsequent requests
const nodes = await client.nodes.list();
```

### Using API Keys

```javascript
const client = new NeuroGrid({
  apiKey: 'your-api-key-here'
});

// All requests will use the API key
const models = await client.models.list();
```

## Advanced Examples

### Batch Text Generation

```javascript
async function batchGeneration() {
  const prompts = [
    'Explain machine learning',
    'What is blockchain?',
    'Describe quantum computing'
  ];

  const results = await Promise.all(
    prompts.map(prompt => 
      client.models.generateText({
        model: 'llama2-7b',
        prompt,
        maxTokens: 100
      })
    )
  );

  results.forEach((result, index) => {
    console.log(`Prompt ${index + 1}:`, result.generatedText);
  });
}
```

### Image Generation with Progress Tracking

```javascript
async function generateImageWithProgress() {
  const task = await client.models.generateImage({
    model: 'stable-diffusion-xl',
    prompt: 'A beautiful landscape with mountains and lakes',
    width: 1024,
    height: 1024
  });

  // Subscribe to progress updates
  client.tasks.subscribe(task.id, (update) => {
    console.log(`Progress: ${update.progress}%`);
    
    if (update.status === 'completed') {
      console.log('Image URL:', update.imageUrl);
    }
  });
}
```

### Audio Transcription

```javascript
const fs = require('fs');

async function transcribeAudio() {
  const audioFile = fs.createReadStream('./audio.mp3');
  
  const result = await client.models.transcribe({
    file: audioFile,
    model: 'whisper-large',
    language: 'en'
  });

  console.log('Transcription:', result.transcription);
  console.log('Confidence:', result.confidence);
  
  // Get detailed segments
  result.segments.forEach(segment => {
    console.log(`${segment.start}s - ${segment.end}s: ${segment.text}`);
  });
}
```

## Error Handling

```javascript
const { NeuroGridError, AuthenticationError, RateLimitError } = require('@neurogrid/sdk');

async function handleErrors() {
  try {
    const result = await client.models.generateText({
      model: 'invalid-model',
      prompt: 'Test prompt'
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log('Authentication failed, please login again');
      // Redirect to login
    } else if (error instanceof RateLimitError) {
      console.log('Rate limit exceeded, waiting...');
      await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
      // Retry request
    } else if (error instanceof NeuroGridError) {
      console.log('API Error:', error.message);
      console.log('Error Code:', error.code);
    } else {
      console.log('Unexpected error:', error);
    }
  }
}
```

## WebSocket Real-time Updates

```javascript
const client = new NeuroGrid({ apiKey: 'your-api-key' });

// Connect to WebSocket for real-time updates
const ws = client.connect();

ws.on('connected', () => {
  console.log('Connected to NeuroGrid WebSocket');
});

ws.on('task.started', (event) => {
  console.log(`Task ${event.taskId} started on node ${event.nodeId}`);
});

ws.on('task.progress', (event) => {
  console.log(`Task ${event.taskId}: ${event.progress}% complete`);
});

ws.on('task.completed', (event) => {
  console.log(`Task ${event.taskId} completed!`);
  console.log('Result:', event.result);
});

ws.on('node.status', (event) => {
  console.log(`Node ${event.nodeId} is now ${event.status}`);
});
```

## Configuration Options

```javascript
const client = new NeuroGrid({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.neurogrid.io',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  defaultRegion: 'us-west-1',
  debug: false
});

// Override settings per request
const result = await client.models.generateText({
  model: 'llama2-7b',
  prompt: 'Test',
  timeout: 60000, // 1 minute for this request
  nodePreferences: {
    region: 'eu-west-1',
    minPerformanceScore: 95
  }
});
```

## Testing Examples

```javascript
const { NeuroGrid } = require('@neurogrid/sdk');
const { expect } = require('chai');

describe('NeuroGrid SDK', () => {
  let client;

  beforeEach(() => {
    client = new NeuroGrid({
      apiKey: process.env.TEST_API_KEY,
      baseUrl: 'https://api-test.neurogrid.io'
    });
  });

  it('should generate text successfully', async () => {
    const result = await client.models.generateText({
      model: 'llama2-7b',
      prompt: 'Hello world',
      maxTokens: 10
    });

    expect(result).to.have.property('generatedText');
    expect(result.generatedText).to.be.a('string');
    expect(result.generatedText.length).to.be.greaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    try {
      await client.models.generateText({
        model: 'non-existent-model',
        prompt: 'Test'
      });
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.be.instanceOf(NeuroGridError);
      expect(error.code).to.equal('MODEL_NOT_FOUND');
    }
  });
});
```