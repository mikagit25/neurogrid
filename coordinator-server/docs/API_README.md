# NeuroGrid API Documentation

Welcome to the NeuroGrid Coordinator API documentation. This comprehensive API enables developers to integrate with the NeuroGrid distributed AI inference network.

## 🚀 Quick Start

### Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://api.neurogrid.ai`

### API Documentation
- **Interactive Docs**: `/api-docs` (Swagger UI)
- **OpenAPI Schema**: `/api-docs.json`

### Authentication

Most endpoints require authentication. NeuroGrid supports multiple authentication methods:

1. **JWT Bearer Token** (Recommended for web applications)
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **API Key** (Recommended for node clients and server-to-server)
   ```
   X-API-Key: nk_1234567890abcdef1234567890abcdef
   ```

3. **Session Cookie** (For web interface)
   ```
   Cookie: session=s%3A1234567890abcdef...
   ```

### Getting Started

1. **Register an Account**
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "developer@example.com",
       "username": "dev_user",
       "password": "SecurePass123!",
       "full_name": "Developer Name"
     }'
   ```

2. **Verify Email** (Check your email for verification link)

3. **Login to Get Token**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "identifier": "developer@example.com",
       "password": "SecurePass123!"
     }'
   ```

4. **Submit Your First Task**
   ```bash
   curl -X POST http://localhost:3001/api/tasks \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -d '{
       "type": "inference",
       "model": "llama-2-7b",
       "input_data": {
         "prompt": "Explain quantum computing in simple terms",
         "max_tokens": 200,
         "temperature": 0.7
       }
     }'
   ```

## 📋 API Categories

### 🔐 Authentication
- User registration and login
- Email verification
- Password reset
- Two-factor authentication (2FA)
- Token refresh and logout

### 👥 User Management
- Profile management
- API key generation
- User statistics
- Account settings

### 🖥️ Node Management
- Node registration and discovery
- Status monitoring and metrics
- Pricing and specifications
- Heartbeat and health checks

### 📋 Task Management
- Task submission and queuing
- Progress monitoring
- Result retrieval
- Batch processing
- Task cancellation

### 💳 Payment System
- Stripe integration
- Wallet management
- Usage tracking
- Billing and invoices

### 📊 Analytics
- System overview
- User statistics
- Performance metrics
- Usage patterns

### 📁 File Management
- File upload and download
- Storage management
- Access control

### ⚙️ System Administration
- Health monitoring
- System metrics
- Administrative functions

## 🔒 Security Features

### Rate Limiting
Different endpoints have specific rate limits:
- **Login**: 5 attempts per 15 minutes
- **Registration**: 3 attempts per hour
- **API Requests**: 100 requests per minute
- **Task Submission**: 10 tasks per minute

### Input Validation
All input is validated and sanitized:
- SQL injection prevention
- XSS protection
- Request size limits
- Type validation

### Security Headers
Comprehensive security headers are applied:
- CORS configuration
- CSP headers
- HSTS enforcement  
- X-Frame-Options
- X-Content-Type-Options

## 📡 WebSocket Integration

Real-time updates are available via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onopen = () => {
  // Authenticate with token
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates
  console.log('Update:', data);
};
```

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "message": "Operation completed successfully",
    "result": {...}
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response
```json
{
  "error": "error_code",
  "message": "Human readable error message",
  "details": {
    "field": "Additional error context"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## 🎯 Common Use Cases

### 1. AI Inference Application
```javascript
// Submit inference task
const task = await fetch('/api/tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'inference',
    model: 'llama-2-7b',
    input_data: {
      prompt: 'Your prompt here',
      max_tokens: 100
    }
  })
});

// Monitor progress
const checkStatus = async (taskId) => {
  const response = await fetch(`/api/tasks/${taskId}`);
  const result = await response.json();
  return result;
};
```

### 2. Node Operator Setup
```javascript
// Register compute node
const node = await fetch('/api/nodes', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My GPU Node',
    specifications: {
      gpu_model: 'NVIDIA RTX 4090',
      gpu_memory: 24,
      cpu_cores: 16,
      ram_gb: 64
    },
    location: {
      region: 'us-west-2',
      country: 'United States'
    },
    supported_models: ['llama-2-7b', 'stable-diffusion-xl'],
    pricing: {
      per_hour: 2.50
    }
  })
});
```

### 3. Batch Processing
```javascript
// Submit multiple tasks
const batch = await fetch('/api/tasks/batch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'inference',
    model: 'llama-2-7b',
    tasks: [
      { input_data: { prompt: 'Task 1 prompt' } },
      { input_data: { prompt: 'Task 2 prompt' } },
      { input_data: { prompt: 'Task 3 prompt' } }
    ]
  })
});
```

## 🛠️ SDKs and Libraries

### Official SDKs
- **JavaScript/Node.js**: `@neurogrid/client-js`
- **Python**: `neurogrid-python`
- **Go**: `neurogrid-go`

### Community SDKs
- **Java**: `neurogrid-java` (community maintained)
- **Rust**: `neurogrid-rs` (community maintained)

## 📞 Support

### Documentation
- **API Reference**: `/api-docs`
- **Developer Guide**: `https://docs.neurogrid.ai`
- **Tutorials**: `https://neurogrid.ai/tutorials`

### Community
- **Discord**: `https://discord.gg/neurogrid`
- **GitHub**: `https://github.com/neurogrid`
- **Stack Overflow**: Tag `neurogrid`

### Support Channels
- **Email**: `support@neurogrid.ai`
- **Issues**: Submit via GitHub repository
- **Feature Requests**: Use GitHub discussions

## 🔄 Versioning

The API follows semantic versioning (SemVer):
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

Current version: `v1.0.0`

### Deprecation Policy
- Deprecated features are marked in documentation
- 6-month notice before removal
- Migration guides provided

## 📋 Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 413 | Payload Too Large |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## 🧪 Testing

Use our test environment for development:
- **Base URL**: `https://staging-api.neurogrid.ai`
- **Test Cards**: Use Stripe test cards for payments
- **Rate Limits**: Relaxed for testing

---

For the latest updates and detailed examples, visit our [interactive API documentation](/api-docs).