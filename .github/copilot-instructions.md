# NeuroGrid AI Coding Instructions

NeuroGrid is a **decentralized AI computing platform** that connects GPU providers with AI users through a three-tier architecture. Understanding the service boundaries and data flow is crucial for effective development.

## 🏗️ Core Architecture

**Three-Service Pattern**: 
- **`coordinator-server/`**: Central Node.js orchestrator managing task routing, authentication, and payments
- **`web-interface/`**: Next.js frontend for users and node providers  
- **`node-client/`**: Python GPU workers that execute inference tasks

**Cross-Service Communication**: Services communicate via REST APIs (`/api/v1/`) and WebSockets for real-time updates. The coordinator maintains node registry and load balancing.

## 🔧 Development Workflows

**Local Development Stack**:
```bash
# Full stack with Docker (preferred)
docker-compose up --build
# OR individual services
npm run start:coordinator  # Port 3001
npm run start:web         # Port 3000  
python node-client/main.py # GPU worker
```

**Database Setup**: PostgreSQL with Redis caching. Init scripts in `coordinator-server/sql/init.sql`. Migration system in `coordinator-server/migrations/`.

**Environment Configuration**: Copy `.env.example` → `.env`. Key variables: `POSTGRES_*`, `REDIS_*`, `JWT_SECRET`, `NODE_ENV`.

**Testing Strategy**: Jest with comprehensive test structure:
```bash
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # Coverage report (80%+ required)
```
Tests in `coordinator-server/tests/` follow patterns: mocked unit tests, full DB integration tests, E2E with real services.

## 🛡️ Security Patterns

**Multi-Layer Authentication**:
- JWT tokens via `AuthenticationManager` singleton
- API keys for service-to-service (`X-API-Key` header)  
- Rate limiting per endpoint type (auth: 5/15min, API: 100/min)
- Middleware chain: `authenticate()` → `authorize([permissions])` → route handler

**Security Middleware Location**: `coordinator-server/src/middleware/security.js` and `src/security/middleware/`

**Permission System**: Role-based (`user`, `admin`) + granular permissions (`node:read`, `task:submit`, etc.)

## 📡 API Standards

**Response Format** (standardized via `apiResponse` utility):
```javascript
{
  success: boolean,
  data: object,
  message?: string,
  error?: string,
  code?: string  // Error codes like 'AUTH_REQUIRED', 'RATE_LIMIT_EXCEEDED'
}
```

**Route Organization & API Versioning**: 
- `coordinator-server/src/api/routes/` - Public `/api/v1/` endpoints (current production)
- `coordinator-server/src/routes/` - Internal `/api/v2/` routes (enhanced features) 
- Validation via `express-validator`, security via middleware chain
- **API Strategy**: v1 = stable production, v2 = enhanced features, parallel deployment

## 🚀 Deployment Patterns

**Multi-Environment Support**:
- `docker-compose.yml` - Development
- `docker-compose.production.yml` - Production with proper networking
- `docker-compose.hybrid.yml` - Hybrid cloud deployment

**Build Pipeline**: `build-production.sh` → `deploy.sh` → PM2 cluster with `ecosystem.config.js`

**Monitoring**: Built-in metrics collector at `coordinator-server/src/monitoring/` with Prometheus endpoints.

## 🧪 Testing Approach

**Integration Tests**: Located in `coordinator-server/tests/integration/`. Focus on API endpoint behavior, authentication flows, and service integration.

**Test Pattern**: Mock external services, use in-memory database for unit tests, full PostgreSQL for integration tests.

## 🔍 Key File Patterns

**Configuration**: Centralized in `coordinator-server/src/config/manager.js` with environment-specific overrides

**Database Models**: ORM-style in `coordinator-server/src/models/` with PostgreSQL backing

**Service Layer**: Singletons in `coordinator-server/src/services/` for shared business logic

**Frontend Components**: Next.js pages in `web-interface/pages/` with utility-first styling

## 💡 Project-Specific Conventions

- **Error Handling**: Use `apiResponse.error()` with standardized error codes
- **Logging**: Structured logging via `coordinator-server/src/utils/logger.js`
- **Rate Limiting**: Pre-configured limiters in security middleware - don't create custom ones
- **Database**: Use model layer, not direct SQL. Migrations for schema changes
- **WebSockets**: Real-time features use native WebSocket with room-based broadcasting (`WebSocketManager` singleton)

## 🔬 GPU Node Management

**Python Agent Architecture** (`node-client/src/core/agent.py`):
- **NodeAgent**: Main orchestrator handling registration, task execution, resource monitoring
- **ModelLoader**: AI model management with containerized execution support  
- **MetricsCollector**: Real-time resource monitoring and reporting
- **CoordinatorClient**: WebSocket + HTTP communication with coordinator

**Agent Lifecycle**: Registration → Task polling → Model loading → Inference → Results transmission

**Container Patterns**: Optional Docker isolation for GPU workloads via `DockerEngine` component

## 🌐 WebSocket Patterns

**Real-Time Architecture** (`coordinator-server/src/services/WebSocketManager.js`):
```javascript
// Connection with authentication
wsManager.authenticate(connectionId, jwtToken)
// Room-based broadcasting  
wsManager.broadcastToRoom('tasks', {type: 'task_update', data: taskResult})
// User-specific messaging
wsManager.sendToUser(userId, {type: 'notification', message: 'Task complete'})
```

**Client Connection** (`web-interface` pattern):
```javascript
const ws = new WebSocket(`ws://localhost:3001/ws`)
// Auto-reconnection and message handling built-in
```

**Anti-Patterns to Avoid**:
- Direct database queries outside model layer
- Custom authentication middleware (use existing security system)
- Inconsistent API response formats
- Missing rate limiting on new endpoints
- Socket.IO instead of native WebSocket (project uses native WebSocket)