# API Endpoints Reference

## Base URL
```
https://api.neurogrid.io/api/v1
```

## Authentication
All endpoints require authentication unless specified otherwise.

---

## Node Management

### List Nodes
Get a list of all available nodes in the network.

```http
GET /nodes
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by node status (`online`, `offline`, `busy`) |
| `region` | string | Filter by geographical region |
| `limit` | integer | Number of results (default: 50, max: 100) |
| `offset` | integer | Pagination offset |

#### Response
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "node_123",
        "status": "online",
        "region": "us-west-1",
        "capabilities": ["text-generation", "image-generation"],
        "gpu_info": {
          "model": "NVIDIA RTX 4090",
          "memory": "24GB",
          "compute_capability": "8.9"
        },
        "performance_score": 95.5,
        "last_seen": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### Get Node Details
Get detailed information about a specific node.

```http
GET /nodes/{nodeId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "node_123",
    "status": "online",
    "region": "us-west-1",
    "owner": "user_456",
    "capabilities": ["text-generation", "image-generation"],
    "current_load": 0.65,
    "total_tasks_completed": 1250,
    "uptime": "15d 8h 32m",
    "earnings": {
      "total": "145.50",
      "currency": "USD",
      "last_30_days": "32.10"
    }
  }
}
```

---

## AI Model Operations

### List Available Models
Get a list of all available AI models.

```http
GET /models
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Model type (`text`, `image`, `audio`) |
| `category` | string | Model category (`generation`, `classification`, etc.) |

#### Response
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "llama2-7b",
        "name": "LLaMA 2 7B",
        "type": "text",
        "category": "generation",
        "description": "Large language model for text generation",
        "parameters": {
          "size": "7B",
          "context_length": 4096,
          "languages": ["en", "es", "fr", "de"]
        },
        "pricing": {
          "per_token": 0.0001,
          "currency": "USD"
        }
      }
    ]
  }
}
```

### Text Generation
Generate text using language models.

```http
POST /models/generate/text
```

#### Request Body
```json
{
  "model": "llama2-7b",
  "prompt": "Explain quantum computing in simple terms",
  "parameters": {
    "max_tokens": 150,
    "temperature": 0.7,
    "top_p": 0.9,
    "stop_sequences": ["\n\n"]
  },
  "node_preferences": {
    "region": "us-west-1",
    "min_performance_score": 90
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task_789",
    "model": "llama2-7b",
    "generated_text": "Quantum computing is a revolutionary technology...",
    "usage": {
      "prompt_tokens": 12,
      "completion_tokens": 143,
      "total_tokens": 155
    },
    "node_id": "node_123",
    "execution_time": 2.34,
    "cost": 0.0155
  }
}
```

### Image Generation
Generate images using AI models.

```http
POST /models/generate/image
```

#### Request Body
```json
{
  "model": "stable-diffusion-xl",
  "prompt": "A futuristic cityscape at sunset",
  "parameters": {
    "width": 1024,
    "height": 1024,
    "steps": 30,
    "guidance_scale": 7.5,
    "seed": 42
  },
  "negative_prompt": "blurry, low quality"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task_790",
    "model": "stable-diffusion-xl",
    "image_url": "https://cdn.neurogrid.io/images/task_790.png",
    "parameters_used": {
      "width": 1024,
      "height": 1024,
      "steps": 30,
      "seed": 42
    },
    "execution_time": 8.5,
    "cost": 0.05
  }
}
```

### Audio Transcription
Transcribe audio using speech recognition models.

```http
POST /models/transcribe
```

#### Request Body (multipart/form-data)
```
file: audio_file.mp3
model: whisper-large
language: en (optional)
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task_791",
    "model": "whisper-large",
    "transcription": "Hello, this is a test audio file...",
    "language": "en",
    "confidence": 0.95,
    "segments": [
      {
        "start": 0.0,
        "end": 3.2,
        "text": "Hello, this is a test"
      }
    ],
    "execution_time": 1.8,
    "cost": 0.02
  }
}
```

---

## Task Management

### List Tasks
Get a list of your tasks.

```http
GET /tasks
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`pending`, `running`, `completed`, `failed`) |
| `model` | string | Filter by model used |
| `limit` | integer | Number of results |

#### Response
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_789",
        "status": "completed",
        "model": "llama2-7b",
        "type": "text-generation",
        "created_at": "2024-01-15T10:30:00Z",
        "completed_at": "2024-01-15T10:30:15Z",
        "cost": 0.0155,
        "node_id": "node_123"
      }
    ],
    "total": 25
  }
}
```

### Get Task Details
Get detailed information about a specific task.

```http
GET /tasks/{taskId}
```

### Cancel Task
Cancel a running task.

```http
DELETE /tasks/{taskId}
```

---

## Analytics & Monitoring

### System Stats
Get overall system statistics.

```http
GET /analytics/stats
```

#### Response
```json
{
  "success": true,
  "data": {
    "total_nodes": 1250,
    "active_nodes": 892,
    "total_tasks_today": 15420,
    "average_response_time": 3.2,
    "network_uptime": 99.8,
    "total_compute_hours": 125000
  }
}
```

### Performance Metrics
Get performance metrics for the system.

```http
GET /analytics/performance
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `timeframe` | string | Time period (`1h`, `24h`, `7d`, `30d`) |
| `metric` | string | Specific metric to retrieve |

### User Usage
Get your usage statistics.

```http
GET /analytics/usage
```

#### Response
```json
{
  "success": true,
  "data": {
    "current_month": {
      "tasks_completed": 45,
      "total_cost": 12.50,
      "compute_time": "2h 15m",
      "tokens_generated": 25000
    },
    "limits": {
      "monthly_tasks": 1000,
      "monthly_budget": 100.00
    }
  }
}
```

---

## Billing & Payments

### Get Balance
Check your account balance.

```http
GET /billing/balance
```

### Add Credits
Add credits to your account.

```http
POST /billing/credits
```

#### Request Body
```json
{
  "amount": 50.00,
  "payment_method": "card_123"
}
```

### Usage History
Get detailed billing history.

```http
GET /billing/history
```

---

## WebSocket Events

Connect to real-time updates via WebSocket:

```javascript
const ws = new WebSocket('wss://api.neurogrid.io/ws');

ws.on('open', () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event);
});
```

### Event Types
- `task.started` - Task execution started
- `task.progress` - Task progress update
- `task.completed` - Task completed
- `task.failed` - Task failed
- `node.status` - Node status change
- `system.alert` - System alert

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "type": "ErrorType",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

### Common Error Codes
- `INVALID_REQUEST` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Rate limit exceeded
- `INSUFFICIENT_CREDITS` - Not enough credits
- `MODEL_UNAVAILABLE` - Requested model is not available
- `NODE_UNAVAILABLE` - No suitable nodes available