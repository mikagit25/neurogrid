# NeuroGrid Coordinator Server

Central coordination service for the NeuroGrid distributed AI inference platform.

## Features

- **Task Management**: Queue, routing, and execution monitoring
- **Node Management**: Registration, metrics collection, and rating
- **Token Engine**: Reward calculation and distribution
- **Security**: Authentication, encryption, and isolation
- **API**: REST endpoints for clients and WebSocket for real-time communication

## Architecture

```
[API Gateway]
├── [Task Dispatcher] — task queuing, node selection
├── [Node Manager] — node registration, metrics, heartbeat
├── [Verifier] — result verification and quality control
├── [Token Engine] — token calculation and distribution
├── [Model Registry] — model version management
├── [Security Layer] — authentication and encryption
└── [Monitoring & Logs] — system monitoring and audit logs
```

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://localhost:5432/neurogrid

# Security
JWT_SECRET=your-jwt-secret-key
API_RATE_LIMIT=100

# External Services
MODEL_REGISTRY_URL=http://localhost:3002
WEBHOOK_SECRET=your-webhook-secret
```

## API Endpoints

### Task Management
- `POST /api/tasks` - Submit inference task
- `GET /api/tasks/:id` - Get task status
- `GET /api/tasks/:id/result` - Get task result

### Node Management
- `POST /api/nodes/register` - Register new node
- `GET /api/nodes` - List active nodes
- `POST /api/nodes/:id/heartbeat` - Node heartbeat
- `GET /api/nodes/:id/metrics` - Node metrics

### Token System
- `GET /api/tokens/balance/:nodeId` - Check token balance
- `GET /api/tokens/history/:nodeId` - Token transaction history
- `POST /api/tokens/withdraw` - Withdraw tokens

### System
- `GET /api/health` - Health check
- `GET /api/stats` - System statistics

## Development

### Project Structure

```
src/
├── api/
│   ├── routes/
│   │   ├── tasks.js
│   │   ├── nodes.js
│   │   ├── tokens.js
│   │   └── system.js
│   └── middleware/
│       ├── auth.js
│       ├── rateLimit.js
│       └── validation.js
├── services/
│   ├── TaskDispatcher.js
│   ├── NodeManager.js
│   ├── TokenEngine.js
│   ├── Verifier.js
│   └── ModelRegistry.js
├── models/
│   ├── Task.js
│   ├── Node.js
│   ├── Token.js
│   └── User.js
├── utils/
│   ├── logger.js
│   ├── metrics.js
│   └── crypto.js
├── config/
│   ├── database.js
│   ├── redis.js
│   └── models.js
└── app.js
```

### Adding New Features

1. Create service in `src/services/`
2. Add routes in `src/api/routes/`
3. Update tests in `tests/`
4. Document API changes

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

## Deployment

### Docker

```bash
# Build image
docker build -t neurogrid-coordinator .

# Run container
docker run -p 3001:3001 --env-file .env neurogrid-coordinator
```

### Production Setup

1. Set up PostgreSQL and Redis
2. Configure environment variables
3. Run database migrations
4. Start with PM2 or similar process manager

```bash
npm run migrate
pm2 start ecosystem.config.js
```

## Monitoring

- Health checks: `/api/health`
- Metrics: Prometheus format at `/metrics`
- Logs: JSON format to stdout/file
- Alerts: Configurable webhooks

## Security

- JWT authentication for all endpoints
- Rate limiting per IP/user
- Input validation and sanitization
- HTTPS in production
- Database connection encryption
- API key rotation support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE) for details.