# NeuroGrid Node Client

Python client application for participating nodes in the NeuroGrid distributed AI inference network.

## Features

- **Task Execution**: Receive and execute AI inference tasks
- **Container Isolation**: Secure task execution using Docker containers
- **Resource Monitoring**: Real-time GPU, CPU, and network metrics
- **Model Management**: Automatic model downloading and caching
- **Secure Communication**: Encrypted communication with coordinator
- **Token Rewards**: Automatic token earning for completed tasks

## Architecture

```
[Core Agent]
├── [Task Manager] — task reception and execution
├── [Model Loader] — model downloading and loading
├── [Container Engine] — Docker integration for isolation
├── [Metrics Collector] — resource monitoring
├── [Result Sender] — result transmission
├── [Security Module] — encryption and access control
└── [Local UI (optional)] — monitoring interface
```

## Requirements

### Minimum System Requirements
- **OS**: Windows 10/11, Ubuntu 18+, macOS 10.15+
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB free space for models
- **Network**: Stable broadband connection (10+ Mbps)

### GPU Requirements (Recommended)
- **NVIDIA**: RTX 3060 (8GB VRAM) or better
- **AMD**: RX 6600 XT (8GB VRAM) or better
- **CUDA**: Version 11.0+ for NVIDIA cards
- **Drivers**: Latest stable GPU drivers

## Quick Start

### 1. Installation

```bash
# Clone repository
git clone https://github.com/neurogrid/neurogrid.git
cd neurogrid/node-client

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Install Docker (if not already installed)
# Follow Docker installation guide for your OS
```

### 2. Configuration

```bash
# Copy example configuration
cp config/config.example.json config/config.json

# Edit configuration file
nano config/config.json
```

Example configuration:
```json
{
  "coordinator_url": "http://localhost:3001",
  "node_id": "auto-generate",
  "node_token": "your-node-token",
  "max_vram_gb": 8,
  "max_cpu_cores": 4,
  "supported_models": ["text", "image"],
  "data_dir": "./data",
  "log_level": "INFO",
  "heartbeat_interval": 30,
  "task_timeout": 300,
  "enable_docker": true,
  "docker_network": "neurogrid",
  "metrics_port": 8080
}
```

### 3. Running the Client

```bash
# Start node client
python main.py

# Or with specific config
python main.py --config config/production.json

# Run in background (Linux/Mac)
nohup python main.py > logs/node.log 2>&1 &

# Windows service (run as administrator)
python main.py --install-service
```

## Usage

### Command Line Interface

```bash
# Show help
python main.py --help

# Run with debug logging
python main.py --log-level DEBUG

# Test node configuration
python main.py --test-config

# Check system requirements
python main.py --check-requirements

# Show node status
python main.py --status

# Stop running node
python main.py --stop
```

### Node Registration

The client automatically registers with the coordinator on first run:

1. Generates unique node ID
2. Collects system metrics
3. Tests network connectivity
4. Registers with coordinator
5. Begins task execution loop

### Monitoring

#### Web Interface (Optional)
Access local monitoring at `http://localhost:8080`:
- Real-time metrics
- Task history
- Token earnings
- System status

#### Command Line Monitoring
```bash
# Show current status
curl http://localhost:8080/status

# Show metrics
curl http://localhost:8080/metrics

# Show logs
tail -f logs/node.log
```

## Configuration Reference

### Core Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `coordinator_url` | Coordinator server URL | `http://localhost:3001` |
| `node_token` | Authentication token | Required |
| `max_vram_gb` | Maximum VRAM to allocate | `8` |
| `max_cpu_cores` | Maximum CPU cores to use | `4` |
| `task_timeout` | Task execution timeout (seconds) | `300` |

### Model Configuration

| Setting | Description | Options |
|---------|-------------|---------|
| `supported_models` | Model categories to support | `["text", "image", "audio"]` |
| `model_cache_size_gb` | Model cache size limit | `20` |
| `auto_download_models` | Auto-download required models | `true` |
| `preferred_models` | Prioritize specific models | `[]` |

### Security Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `enable_docker` | Use Docker isolation | `true` |
| `encrypt_data` | Encrypt task data | `true` |
| `allow_custom_models` | Allow non-approved models | `false` |
| `sandbox_mode` | Enhanced isolation | `true` |

## Supported Models

### Text Generation
- **LLaMA 2** (7B, 13B, 70B)
- **Mistral 7B**
- **GPT-J 6B**
- **GPT-NeoX 20B**

### Image Generation  
- **Stable Diffusion 1.5**
- **Stable Diffusion XL**
- **Kandinsky 2.1**

### Audio Processing
- **Whisper** (base, small, medium, large)
- **Silero TTS**

### Multimodal
- **CLIP**
- **BLIP-2**

## Troubleshooting

### Common Issues

#### 1. GPU Not Detected
```bash
# Check GPU status
nvidia-smi  # NVIDIA
rocm-smi    # AMD

# Verify CUDA installation
python -c "import torch; print(torch.cuda.is_available())"
```

#### 2. Docker Issues
```bash
# Check Docker status
docker --version
docker run hello-world

# Fix permissions (Linux)
sudo usermod -aG docker $USER
```

#### 3. Network Connectivity
```bash
# Test coordinator connection
curl http://localhost:3001/health

# Check firewall settings
# Ensure ports 8080 and coordinator port are accessible
```

#### 4. Model Download Failures
```bash
# Clear model cache
rm -rf data/models/*

# Manual model download
python -c "from src.models.loader import ModelLoader; ModelLoader().download_model('llama2-7b')"
```

### Log Analysis

```bash
# Show recent errors
grep ERROR logs/node.log | tail -20

# Monitor real-time logs
tail -f logs/node.log | grep -E "(ERROR|WARN)"

# Performance metrics
grep "METRICS" logs/node.log | tail -10
```

## Development

### Project Structure

```
src/
├── core/
│   ├── agent.py          # Main agent logic
│   ├── task_manager.py   # Task execution
│   └── config.py         # Configuration management
├── models/
│   ├── loader.py         # Model loading and caching
│   ├── text.py           # Text model handlers
│   ├── image.py          # Image model handlers
│   └── audio.py          # Audio model handlers
├── container/
│   ├── docker_engine.py  # Docker integration
│   ├── isolation.py      # Security isolation
│   └── resource_limits.py # Resource management
├── metrics/
│   ├── collector.py      # System metrics
│   ├── gpu.py            # GPU monitoring
│   └── network.py        # Network monitoring
└── utils/
    ├── crypto.py         # Encryption utilities
    ├── logger.py         # Logging setup
    └── api_client.py     # Coordinator API client
```

### Running Tests

```bash
# Install test dependencies
pip install -r requirements-dev.txt

# Run all tests
python -m pytest

# Run specific test category
python -m pytest tests/unit/
python -m pytest tests/integration/

# Run with coverage
python -m pytest --cov=src --cov-report=html
```

### Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## Security

### Data Protection
- All task data is encrypted in transit and at rest
- Local data is automatically cleaned after task completion
- No access to host system outside designated directories

### Network Security
- TLS 1.3 for all communications
- Certificate pinning for coordinator connection
- No incoming network connections accepted

### Process Isolation
- Docker containers limit resource access
- Separate user contexts for task execution
- File system isolation prevents data leakage

## Performance Optimization

### GPU Optimization
```bash
# Monitor GPU usage
watch -n 1 nvidia-smi

# Optimize memory usage
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

### CPU Optimization
```bash
# Set CPU affinity
taskset -c 0-3 python main.py

# Adjust process priority
nice -n -10 python main.py
```

### Network Optimization
```bash
# Increase buffer sizes
echo 'net.core.rmem_max = 268435456' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 268435456' >> /etc/sysctl.conf
```

## License

MIT License - see [LICENSE](../LICENSE) for details.