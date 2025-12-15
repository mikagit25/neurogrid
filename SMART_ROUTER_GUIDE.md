# NeuroGrid Smart Model Router - Quick Start Guide

## 🚀 Overview

The Smart Model Router automatically selects the best AI coordinator for your tasks based on:
- **Cost efficiency** (40% weight)
- **Response speed** (30% weight)
- **Output quality** (30% weight)

**🌐 Multi-Environment Support:**
- **Development**: localhost:8080
- **Production**: neurogrid.network  
- **Staging**: staging.neurogrid.network

## 🎯 Quick Start

### 1. Smart AI Processing (Recommended)
```bash
# For localhost development
curl -X POST http://localhost:8080/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Your task here",
    "type": "code-generation",
    "complexity": "medium",
    "priority": "normal"
  }'

# For production (neurogrid.network)
curl -X POST https://neurogrid.network/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Your task here",
    "type": "code-generation",
    "complexity": "medium",
    "priority": "normal"
  }'
```

### 2. Task Types for Optimal Routing
- `text-generation` → General text content
- `code-generation` → Programming tasks
- `chat` → Conversational interactions
- `data-analysis` → Data processing and insights
- `complex-task` → Multi-step analysis
- `educational` → Learning and explanations

### 3. Available Coordinators
- **🔥 NeuroGrid Multi-Agent**: Best for complex tasks, code generation
- **🏠 Local LLaMA 2 7B**: Fast and free for simple tasks
- **⚡ OpenAI GPT-4**: Premium quality (requires API key)
- **🧠 Anthropic Claude**: Advanced reasoning (requires API key)

## 📊 Real-time Monitoring

### Statistics API
```bash
# Development
curl http://localhost:8080/api/models/stats

# Production  
curl https://neurogrid.network/api/models/stats
```

Returns:
```json
{
  "success": true,
  "data": {
    "totalRequests": 16,
    "modelUsage": {
      "NeuroGrid Multi-Agent": 10,
      "Local LLaMA 2 7B": 3
    },
    "averageResponseTime": 625,
    "totalCost": 0.049,
    "successRate": 100
  }
}
```

### Available Models
```bash
# Development
curl http://localhost:8080/api/models/available

# Production
curl https://neurogrid.network/api/models/available
```

## 🛠️ Administration

### 1. Web Dashboard
- **Development**: http://localhost:8080/ | http://localhost:8080/admin.html
- **Production**: https://neurogrid.network/ | https://neurogrid.network/admin.html

### 2. Configure External APIs
```bash
# Development
curl -X POST http://localhost:8080/api/models/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "coordinatorId": "openai-gpt4",
    "enabled": true,
    "apiKey": "your-openai-api-key"
  }'

# Production
curl -X POST https://neurogrid.network/api/models/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "coordinatorId": "openai-gpt4",
    "enabled": true,
    "apiKey": "your-openai-api-key"
  }'
```

### 3. Export Statistics
```bash
# Development
curl http://localhost:8080/api/models/export > stats.json

# Production  
curl https://neurogrid.network/api/models/export > stats.json
```

## 💡 Examples

### Code Generation
```bash
curl -X POST http://localhost:8080/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Python function for factorial calculation",
    "type": "code-generation",
    "complexity": "low"
  }'
```
**Expected Coordinator**: NeuroGrid Multi-Agent

### Simple Chat
```bash
curl -X POST http://localhost:8080/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, how can you help me?",
    "type": "chat",
    "complexity": "low"
  }'
```
**Expected Coordinator**: Local LLaMA 2 7B

### Data Analysis
```bash
curl -X POST http://localhost:8080/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze this sales data: [100, 150, 200, 175, 300]",
    "type": "data-analysis",
    "complexity": "medium"
  }'
```
**Expected Coordinator**: NeuroGrid Multi-Agent

## 🔥 Key Features

✅ **Automatic Model Selection**: Best coordinator for each task  
✅ **Real-time Statistics**: Performance tracking and monitoring  
✅ **External API Integration**: OpenAI and Anthropic support  
✅ **Cost Optimization**: Intelligent routing based on cost-effectiveness  
✅ **Web Dashboard**: User-friendly interface with live statistics  
✅ **Admin Panel**: Full configuration and monitoring tools  
✅ **Export Capabilities**: Statistics export in JSON format  
✅ **Fallback System**: Graceful degradation when external APIs fail  

## 📈 Performance Metrics

Based on testing session:
- **Total Requests**: 16+
- **Success Rate**: 100%
- **Average Response Time**: ~625ms
- **Cost Efficiency**: $0.049 total
- **Model Distribution**: 67% Multi-Agent, 33% Local LLaMA

## 🔗 Integration

The Smart Model Router integrates seamlessly with:
- NeuroGrid decentralized network
- External AI providers (OpenAI, Anthropic)
- Web interfaces and mobile applications
- Enterprise systems via REST API

---

**🎯 Ready to use!** The system automatically selects the optimal AI coordinator for your specific needs while providing real-time monitoring and cost optimization.