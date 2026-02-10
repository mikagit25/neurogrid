# NeuroGrid API Examples

Comprehensive examples showing how to integrate with the NeuroGrid platform.

## 🚀 Quick Start

### Authentication

```javascript
// Get API key from https://neurogrid.network/dashboard
const API_KEY = 'your-api-key-here';
const BASE_URL = 'https://api.neurogrid.network/v1';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};
```

## 📋 Table of Contents

- [Text Generation](#text-generation)
- [Image Generation](#image-generation)
- [Audio Processing](#audio-processing)
- [Multi-Agent Analysis](#multi-agent-analysis)
- [Node Management](#node-management)
- [Crypto Portfolio](#crypto-portfolio)
- [Real-time Streaming](#real-time-streaming)

## 💬 Text Generation

### Basic Text Generation

```javascript
async function generateText(prompt) {
  const response = await fetch(`${BASE_URL}/inference/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: prompt,
      model: 'llama-3.1-8b',
      max_tokens: 1000,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.generated_text;
}

// Usage
const result = await generateText('Explain quantum computing in simple terms');
console.log(result);
```

### Streaming Text Generation

```javascript
async function streamText(prompt) {
  const response = await fetch(`${BASE_URL}/inference/text/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: prompt,
      model: 'llama-3.1-8b',
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
          process.stdout.write(data.token);
        }
      }
    }
  }
}
```

## 🎨 Image Generation

### Generate Images with Stable Diffusion

```javascript
async function generateImage(prompt) {
  const response = await fetch(`${BASE_URL}/inference/image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: prompt,
      model: 'stable-diffusion-xl',
      width: 1024,
      height: 1024,
      num_inference_steps: 50,
      guidance_scale: 7.5
    })
  });
  
  const data = await response.json();
  return data.image_url; // Base64 or URL
}

// Usage
const imageUrl = await generateImage('A futuristic cityscape with flying cars');
```

### Image Upscaling

```javascript
async function upscaleImage(imageData) {
  const formData = new FormData();
  formData.append('image', imageData);
  formData.append('scale_factor', '4');
  formData.append('model', 'real-esrgan');

  const response = await fetch(`${BASE_URL}/inference/image/upscale`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    },
    body: formData
  });
  
  return await response.blob();
}
```

## 🔊 Audio Processing

### Speech-to-Text

```javascript
async function transcribeAudio(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'auto');

  const response = await fetch(`${BASE_URL}/inference/audio/transcribe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    },
    body: formData
  });
  
  const data = await response.json();
  return {
    text: data.text,
    segments: data.segments,
    confidence: data.confidence
  };
}
```

### Text-to-Speech

```javascript
async function synthesizeSpeech(text, voice = 'en-US-neural') {
  const response = await fetch(`${BASE_URL}/inference/audio/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text: text,
      voice: voice,
      format: 'wav',
      speed: 1.0
    })
  });
  
  return await response.blob(); // Audio file
}
```

## 🤖 Multi-Agent Analysis

### Portfolio Analysis

```javascript
async function analyzePortfolio(holdings) {
  const response = await fetch(`${BASE_URL}/agents/portfolio/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      holdings: holdings,
      market_conditions: 'current',
      risk_tolerance: 'moderate'
    })
  });
  
  const analysis = await response.json();
  return {
    risk_score: analysis.risk_score,
    recommendations: analysis.recommendations,
    diversification: analysis.diversification_analysis,
    predicted_returns: analysis.predictions
  };
}

// Usage
const portfolio = [
  { symbol: 'BTC', amount: 0.5, value_usd: 25000 },
  { symbol: 'ETH', amount: 10, value_usd: 30000 }
];

const analysis = await analyzePortfolio(portfolio);
console.log('Risk Score:', analysis.risk_score);
```

### Code Review

```javascript
async function reviewCode(codeSnippet, language) {
  const response = await fetch(`${BASE_URL}/agents/code/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: codeSnippet,
      language: language,
      check_security: true,
      check_performance: true
    })
  });
  
  const review = await response.json();
  return {
    security_issues: review.security,
    performance_suggestions: review.performance,
    code_quality: review.quality_score,
    suggestions: review.improvements
  };
}
```

## 🖥️ Node Management

### Get Network Status

```javascript
async function getNetworkStatus() {
  const response = await fetch(`${BASE_URL}/network/status`, {
    headers
  });
  
  const status = await response.json();
  return {
    active_nodes: status.active_nodes,
    total_gpu_capacity: status.total_capacity,
    current_utilization: status.utilization,
    average_response_time: status.avg_response_time
  };
}
```

### Monitor Your Node

```javascript
async function getNodeMetrics(nodeId) {
  const response = await fetch(`${BASE_URL}/nodes/${nodeId}/metrics`, {
    headers
  });
  
  const metrics = await response.json();
  return {
    gpu_utilization: metrics.gpu_usage,
    memory_usage: metrics.memory,
    earnings_today: metrics.earnings_24h,
    tasks_completed: metrics.completed_tasks,
    reputation_score: metrics.reputation
  };
}
```

## 💰 Crypto Portfolio

### Real-time Prices

```javascript
async function getCryptoPrices(symbols) {
  const response = await fetch(`${BASE_URL}/crypto/prices`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      symbols: symbols,
      currency: 'USD'
    })
  });
  
  return await response.json();
}

// Usage
const prices = await getCryptoPrices(['BTC', 'ETH', 'SOL']);
```

### AI Investment Recommendations

```javascript
async function getInvestmentRecommendations(portfolio, riskLevel) {
  const response = await fetch(`${BASE_URL}/crypto/recommendations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      current_portfolio: portfolio,
      risk_level: riskLevel, // 'conservative', 'moderate', 'aggressive'
      investment_horizon: '1y',
      market_analysis: true
    })
  });
  
  const recommendations = await response.json();
  return {
    buy_signals: recommendations.buy,
    sell_signals: recommendations.sell,
    rebalancing: recommendations.rebalance,
    market_outlook: recommendations.market_sentiment
  };
}
```

## ⚡ Real-time Streaming

### WebSocket Connection

```javascript
class NeuroGridStream {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
  }
  
  connect() {
    this.ws = new WebSocket(`wss://api.neurogrid.network/ws?auth=${this.apiKey}`);
    
    this.ws.onopen = () => {
      console.log('Connected to NeuroGrid stream');
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  subscribeToTasks() {
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'task_updates'
    }));
  }
  
  subscribeToMarketData() {
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'crypto_prices'
    }));
  }
  
  handleMessage(data) {
    switch(data.type) {
      case 'task_completed':
        console.log('Task completed:', data.task_id);
        break;
      case 'price_update':
        console.log('Price update:', data.symbol, data.price);
        break;
    }
  }
}

// Usage
const stream = new NeuroGridStream(API_KEY);
stream.connect();
stream.subscribeToTasks();
```

## 🐍 Python Examples

### Using the Python SDK

```bash
pip install neurogrid-sdk
```

```python
from neurogrid import NeuroGridClient

# Initialize client
client = NeuroGridClient(api_key='your-api-key')

# Generate text
response = client.inference.text.generate(
    prompt="Explain machine learning",
    model="llama-3.1-8b",
    max_tokens=500
)
print(response.text)

# Generate image
image = client.inference.image.generate(
    prompt="A serene mountain landscape",
    model="stable-diffusion-xl",
    size="1024x1024"
)
image.save("generated_image.png")

# Analyze portfolio
analysis = client.agents.portfolio.analyze(
    holdings=[
        {"symbol": "BTC", "amount": 1.0},
        {"symbol": "ETH", "amount": 10.0}
    ]
)
print(f"Risk Score: {analysis.risk_score}")
```

## 🔒 Error Handling

```javascript
async function robustApiCall(endpoint, options) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API Error: ${error.message} (Code: ${error.code})`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError;
}
```

## 📊 Rate Limiting

NeuroGrid implements rate limiting to ensure fair usage:

- **Free tier:** 100 requests/hour
- **Pro tier:** 1,000 requests/hour  
- **Enterprise:** Custom limits

Handle rate limits gracefully:

```javascript
async function handleRateLimit(response) {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    
    await new Promise(resolve => 
      setTimeout(resolve, parseInt(retryAfter) * 1000)
    );
    
    // Retry the request
    return true;
  }
  return false;
}
```

## 🔗 Useful Links

- **API Documentation:** [docs.neurogrid.network](https://docs.neurogrid.network)
- **SDKs:** [github.com/neurogrid/sdks](https://github.com/neurogrid/sdks)
- **Community:** [discord.gg/neurogrid](https://discord.gg/neurogrid)
- **Support:** [support@neurogrid.network](mailto:support@neurogrid.network)

---

**Need help?** Join our Discord community or check the [troubleshooting guide](https://docs.neurogrid.network/troubleshooting).