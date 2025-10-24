# Authentication & Authorization

## Overview

NeuroGrid uses JWT (JSON Web Tokens) for authentication and role-based access control (RBAC) for authorization. This guide covers all authentication methods and security features.

## Authentication Methods

### 1. JWT Token Authentication

#### Login Endpoint
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "expiresIn": 3600,
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "role": "user",
      "permissions": ["read", "write"]
    }
  }
}
```

#### Using the Token
Include the JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     https://api.neurogrid.io/api/v1/nodes
```

### 2. API Keys

For server-to-server communication, you can use API keys:

```http
GET /api/v1/nodes
X-API-Key: your-api-key-here
```

#### Creating API Keys
```http
POST /api/v1/auth/api-keys
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Production Server Key",
  "permissions": ["read", "write"],
  "expiresIn": "30d"
}
```

### 3. Multi-Factor Authentication (MFA)

#### Enable MFA
```http
POST /api/v1/auth/mfa/enable
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "method": "totp"
}
```

#### Verify MFA
```http
POST /api/v1/auth/mfa/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "mfaCode": "123456"
}
```

## Authorization Roles

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `guest` | Read-only access | view_public_data |
| `user` | Standard user | view_data, create_tasks |
| `developer` | Developer access | view_data, create_tasks, manage_models |
| `admin` | Administrator | all_permissions |
| `super_admin` | Super administrator | all_permissions, manage_users |

### Permission System

Permissions are granular and include:

- `read`: Read access to resources
- `write`: Write access to resources
- `delete`: Delete access to resources
- `manage_nodes`: Manage network nodes
- `manage_models`: Manage AI models
- `manage_users`: Manage user accounts
- `view_analytics`: View monitoring analytics
- `system_admin`: System administration

## Token Refresh

When your JWT token expires, use the refresh token:

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

## Security Headers

All API responses include security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

## Rate Limiting by Role

| Role | Requests/Hour | Concurrent Tasks |
|------|---------------|------------------|
| guest | 100 | 1 |
| user | 1,000 | 5 |
| developer | 5,000 | 20 |
| admin | 10,000 | 50 |

## Error Responses

### Authentication Errors

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "type": "AuthenticationError"
  }
}
```

### Authorization Errors

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this resource",
    "type": "AuthorizationError",
    "required_permission": "manage_models"
  }
}
```

## SDKs & Examples

### JavaScript/Node.js
```javascript
const NeuroGrid = require('@neurogrid/sdk');

const client = new NeuroGrid({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.neurogrid.io'
});

// Login with credentials
const auth = await client.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Use the authenticated client
const nodes = await client.nodes.list();
```

### Python
```python
from neurogrid import NeuroGridClient

client = NeuroGridClient(
    api_key='your-api-key',
    base_url='https://api.neurogrid.io'
)

# Login
auth = client.auth.login(
    email='user@example.com',
    password='password'
)

# Use authenticated client
nodes = client.nodes.list()
```

### cURL Examples
```bash
# Login
curl -X POST https://api.neurogrid.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.neurogrid.io/api/v1/nodes
```