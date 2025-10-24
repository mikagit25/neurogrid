# NeuroGrid API Documentation

## Overview

NeuroGrid is a distributed AI computing platform that enables secure and efficient deployment of AI models across a decentralized network. This documentation provides comprehensive information about the NeuroGrid API, including authentication, endpoints, examples, and integration guides.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [SDKs & Libraries](#sdks--libraries)
- [Examples](#examples)
- [Integration Guides](#integration-guides)

## Quick Start

### Base URL
```
Production: https://api.neurogrid.io
Development: http://localhost:3000
```

### Authentication
All API requests require authentication using JWT tokens:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.neurogrid.io/api/v1/nodes
```

### Basic Example
```javascript
const response = await fetch('https://api.neurogrid.io/api/v1/models/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'llama2-7b',
    prompt: 'Explain quantum computing',
    max_tokens: 100
  })
});

const result = await response.json();
console.log(result.generated_text);
```

## Rate Limiting

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour
- **Enterprise**: Custom limits

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side error |

## Next Steps

- [Authentication Guide](./auth.md)
- [API Endpoints Reference](./endpoints.md)
- [WebSocket Events](./websocket.md)
- [Integration Examples](./examples/)
- [SDKs & Libraries](./sdks.md)