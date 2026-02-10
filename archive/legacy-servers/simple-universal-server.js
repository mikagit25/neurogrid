/**
 * NeuroGrid Simplified Universal Server
 * Быстрая версия для тестирования
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');

class SimpleNeuroGridServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8080;
        this.webPort = process.env.WEB_PORT || 3000;
        this.domain = process.env.DOMAIN || 'localhost';
        this.environment = process.env.NODE_ENV || 'development';
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSockets();
    }

    setupMiddleware() {
        // CORS
        this.app.use(cors({
            origin: [
                `http://${this.domain}:${this.port}`,
                `http://${this.domain}:${this.webPort}`,
                'http://localhost:3000',
                'http://localhost:8080'
            ],
            credentials: true
        }));

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Статические файлы
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use('/web-interface', express.static(path.join(__dirname, 'web-interface')));

        // Автоматическая инъекция конфигурации
        this.app.use(this.injectConfig());
    }

    injectConfig() {
        return (req, res, next) => {
            const originalSend = res.send;
            const self = this;
            
            res.send = function(body) {
                const contentType = res.get('Content-Type');
                if (contentType && contentType.includes('text/html') && typeof body === 'string') {
                    const configScript = `
<script type="text/javascript">
// NeuroGrid Auto-injected Configuration
window.NeuroGridConfig = {
    apiUrl: 'http://${req.get('host')}/api',
    wsUrl: 'ws://${req.get('host')}/ws',
    webUrl: 'http://${req.get('host')}',
    domain: '${req.get('host')}',
    environment: '${self.environment}',
    version: '1.0.0'
};
window.API_BASE_URL = window.NeuroGridConfig.apiUrl;
window.WS_URL = window.NeuroGridConfig.wsUrl;
window.WEB_BASE_URL = window.NeuroGridConfig.webUrl;
console.log('🔧 NeuroGrid Config loaded:', window.NeuroGridConfig);
</script>`;
                    
                    if (body.includes('</head>')) {
                        body = body.replace('</head>', `${configScript}\n</head>`);
                    } else if (body.includes('<body')) {
                        body = body.replace('<body', `${configScript}\n<body`);
                    }
                }
                
                return originalSend.call(this, body);
            };
            
            next();
        };
    }

    setupRoutes() {
        // Конфигурационные эндпоинты
        this.app.get('/api/config', (req, res) => {
            res.json({
                success: true,
                data: {
                    apiUrl: `http://${req.get('host')}/api`,
                    wsUrl: `ws://${req.get('host')}/ws`,
                    webUrl: `http://${req.get('host')}`,
                    domain: req.get('host'),
                    environment: this.environment,
                    version: '1.0.0'
                }
            });
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                environment: this.environment,
                version: '1.0.0',
                uptime: process.uptime()
            });
        });

        // API Info
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'NeuroGrid API',
                version: '1.0.0',
                environment: this.environment,
                endpoints: {
                    health: `http://${req.get('host')}/health`,
                    config: `http://${req.get('host')}/api/config`,
                    websocket: `ws://${req.get('host')}/ws`
                }
            });
        });

        // Mock API endpoints
        this.setupMockAPI();

        // Главная страница
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, 'index.html');
            if (require('fs').existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.json({
                    message: 'NeuroGrid API Server',
                    version: '1.0.0',
                    environment: this.environment,
                    config_url: `http://${req.get('host')}/api/config`
                });
            }
        });

        // Веб-интерфейс
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'web-interface/dashboard.html'));
        });

        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, 'web-interface/admin.html'));
        });
    }

    setupMockAPI() {
        this.app.get('/api/models/available', (req, res) => {
            res.json({
                success: true,
                data: {
                    models: [
                        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
                        { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic' },
                        { id: 'llama-2-70b', name: 'LLaMA 2 70B', provider: 'Meta' }
                    ]
                }
            });
        });

        this.app.get('/api/nodes', (req, res) => {
            res.json({
                success: true,
                data: {
                    nodes: [
                        { id: 'node-1', status: 'online', gpu: 'RTX 4090', utilization: 45 },
                        { id: 'node-2', status: 'online', gpu: 'RTX 3080', utilization: 78 }
                    ]
                }
            });
        });

        this.app.post('/api/ai/process', (req, res) => {
            setTimeout(() => {
                res.json({
                    success: true,
                    data: {
                        taskId: `task-${Date.now()}`,
                        result: 'Mock AI response generated successfully',
                        model: req.body.model || 'gpt-3.5-turbo',
                        processingTime: '1.2s',
                        cost: 0.002
                    }
                });
            }, 1200);
        });

        this.app.get('/api/tasks', (req, res) => {
            res.json({
                success: true,
                data: { tasks: [], total: 0 }
            });
        });

        this.app.get('/api/network/status', (req, res) => {
            res.json({
                success: true,
                network: {
                    nodes_online: 2,
                    total_tasks: 156,
                    avg_response_time: '1.2s',
                    cost_savings: '75%'
                },
                nodes: [
                    { id: 'node-1', location: 'US-East', gpu: 'RTX 4090' },
                    { id: 'node-2', location: 'EU-West', gpu: 'RTX 3080' }
                ]
            });
        });
    }

    setupWebSockets() {
        this.server = createServer(this.app);
        
        this.wsServer = new WebSocket.Server({ 
            server: this.server,
            path: '/ws'
        });

        this.wsServer.on('connection', (ws, request) => {
            console.log(`🔌 WebSocket connected`);
            
            // Отправляем конфигурацию
            ws.send(JSON.stringify({
                type: 'config',
                data: {
                    apiUrl: `http://${request.headers.host}/api`,
                    wsUrl: `ws://${request.headers.host}/ws`,
                    environment: this.environment
                }
            }));

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    ws.send(JSON.stringify({
                        type: 'echo',
                        data: data,
                        timestamp: new Date().toISOString()
                    }));
                } catch (error) {
                    console.error('WebSocket parse error:', error);
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket disconnected');
            });
        });
    }

    start() {
        this.server.listen(this.port, '0.0.0.0', () => {
            console.log('\n🎉 NeuroGrid Simple Server Started!');
            console.log('===================================');
            console.log(`🚀 Server: http://${this.domain}:${this.port}`);
            console.log(`📡 API: http://${this.domain}:${this.port}/api`);
            console.log(`⚡ WebSocket: ws://${this.domain}:${this.port}/ws`);
            console.log(`📊 Health: http://${this.domain}:${this.port}/health`);
            console.log(`🔧 Config: http://${this.domain}:${this.port}/api/config`);
            console.log('===================================\n');
        });
    }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
    const server = new SimpleNeuroGridServer();
    server.start();
}

module.exports = SimpleNeuroGridServer;