# NeuroGrid - Decentralized AI Inference Platform

*Harnessing idle compute power to democratize AI*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://docker.com/)

## 🚀 Overview

NeuroGrid is a revolutionary decentralized platform that connects idle computing resources worldwide to create a distributed AI inference network. By allowing users to monetize their GPU resources and providing affordable, scalable AI computing for developers, researchers, and companies, NeuroGrid democratizes access to artificial intelligence.

### Key Features

- **🖥️ Distributed Computing**: Harness idle GPU power from nodes worldwide
- **💰 Token Rewards**: Fair compensation system for resource providers
- **🔒 Secure Execution**: Containerized tasks with encryption and isolation
- **🤖 AI Model Support**: Text, image, audio, and multimodal models
- **📈 Scalable Architecture**: Microservices with horizontal scaling
- **🌐 Global Network**: Geographic distribution for optimal performance

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │  Coordinator    │    │   Node Client   │
│  (Web/API/CLI)  │◄──►│    Server       │◄──►│   (Python)      │
│                 │    │  (Node.js)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Task Queue    │    │  Token Engine   │    │ Container Engine│
│   & Routing     │    │   & Rating      │    │   (Docker)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

- **Node Client** (`node-client/`): Python application that runs on contributor devices
- **Coordinator Server** (`coordinator-server/`): Central management and task distribution
- **Web Interface** (`web-interface/`): React-based dashboard for clients and monitoring
- **Documentation** (`docs/`): Comprehensive guides and API references

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ and pip
- Docker (optional but recommended)
- GPU with 8GB+ VRAM (for node participation)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/neurogrid/neurogrid.git
   cd neurogrid
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Start the development environment**
   ```bash
   npm run dev
   ```

4. **Run a node client (separate terminal)**
   ```bash
   npm run start:node
   ```

### Quick Test

Send a test inference request:

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "input": "Hello, world!",
    "priority": "standard"
  }'
```

## 📊 Market Analysis

### Market Need: **9/10 - Very High**

**Why NeuroGrid is needed:**

1. **🔥 Explosive AI Growth**: Since ChatGPT, thousands of companies want AI integration
2. **💸 High GPU Costs**: AWS/GCP/Azure charge premium prices for GPU access
3. **🏠 Idle Resources**: Millions of powerful gaming GPUs sit unused most of the time
4. **🌍 AI Democratization**: Lower costs enable innovation for SMBs and researchers

### Target Audiences

| Audience | Problem | NeuroGrid Solution |
|----------|---------|---------------------|
| **Startups & SMBs** | High API costs (OpenAI, etc.) | Cheaper open-source model inference |
| **Researchers** | No GPU access for experiments | Distributed GPU power for tokens |
| **Developers** | Peak load handling costs | Buffer for traffic spikes |
| **GPU Owners** | Expensive hardware sits idle | Monetize equipment during downtime |

### Competitive Advantage

- **Narrow Specialization**: Unlike general compute platforms, optimized specifically for AI inference
- **Open Models**: Support for Llama, Mistral, Stable Diffusion vs proprietary APIs
- **Cost Efficiency**: Potentially 50-80% cheaper than major cloud providers
- **Decentralized**: No vendor lock-in, community-owned infrastructure

## �️ Development

### Project Structure

```
neurogrid/
├── coordinator-server/     # Central coordination service
│   ├── src/
│   │   ├── api/           # REST API endpoints
│   │   ├── services/      # Business logic
│   │   ├── models/        # Data models
│   │   └── utils/         # Utilities
│   ├── package.json
│   └── Dockerfile
├── node-client/           # Python node client
│   ├── src/
│   │   ├── core/          # Core agent logic
│   │   ├── models/        # Model loading & execution
│   │   ├── container/     # Docker integration
│   │   └── metrics/       # Resource monitoring
│   ├── requirements.txt
│   └── Dockerfile
├── web-interface/         # React dashboard
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Application pages
│   │   ├── services/      # API integration
│   │   └── utils/         # Utilities
│   ├── package.json
│   └── Dockerfile
├── docs/                  # Documentation
│   ├── api/              # API documentation
│   ├── guides/           # User guides
│   └── architecture/     # Technical specs
└── docker-compose.yml     # Full stack deployment
```

### Running Individual Components

```bash
# Coordinator Server
cd coordinator-server
npm run dev

# Web Interface  
cd web-interface
npm run dev

# Node Client
cd node-client
python main.py --config config/development.json
```

### Testing

```bash
# Run all tests
npm test

# Individual component tests
npm run test:coordinator
npm run test:web
cd node-client && python -m pytest
```

## 🔧 Configuration

### Environment Variables

```bash
# Coordinator Server
PORT=3001
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://localhost:5432/neurogrid
JWT_SECRET=your-secret-key

# Node Client
COORDINATOR_URL=http://localhost:3001
NODE_TOKEN=your-node-token
MAX_VRAM_GB=8
MAX_CPU_CORES=4
```

### Docker Deployment

```bash
# Full stack with Docker Compose
docker-compose up -d

# Individual services
docker-compose up coordinator-server
docker-compose up web-interface
docker-compose up node-client
```

## 🎯 Roadmap

### Phase 1: TestNet (Current)
- [x] Basic architecture setup
- [x] Node client MVP
- [x] Coordinator server core
- [ ] Web interface
- [ ] Basic tokenization
- [ ] 2-3 AI models (Llama, Whisper, Stable Diffusion)

### Phase 2: MainNet
- [ ] Production security audit
- [ ] Real token economics
- [ ] Geographic distribution
- [ ] Enterprise SLA options
- [ ] Advanced model support

### Phase 3: Ecosystem
- [ ] Mobile/edge device support
- [ ] Cloud provider integration
- [ ] DAO governance
- [ ] Third-party integrations

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

### Code Style

- **JavaScript/TypeScript**: ESLint + Prettier
- **Python**: Black + isort + pylint
- **Commits**: Conventional Commits format

## 📚 Learn More

- **[Architecture Overview](docs/architecture/overview.md)**
- **[API Documentation](docs/api/README.md)**
- **[Node Setup Guide](docs/guides/node-setup.md)**
- **[Client Integration](docs/guides/client-integration.md)**
- **[Security Model](docs/architecture/security.md)**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Support

- **Documentation**: [docs.neurogrid.ai](https://docs.neurogrid.ai)
- **Discord**: [Join our community](https://discord.gg/neurogrid)
- **GitHub Issues**: [Report bugs & requests](https://github.com/neurogrid/neurogrid/issues)
- **Email**: [support@neurogrid.ai](mailto:support@neurogrid.ai)

---

**Built with ❤️ by the NeuroGrid team**

*Democratizing AI, one GPU at a time.*