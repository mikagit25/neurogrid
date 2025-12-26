/**
 * NeuroGrid Universal Production Server
 * Адаптируется к любому окружению: development, staging, production
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const WebSocket = require('ws');

// Импортируем нашу конфигурацию
const EnvironmentConfig = require('./src/config/EnvironmentConfig');
const ConfigInjectionMiddleware = require('./src/middleware/ConfigInjectionMiddleware');

class NeuroGridUniversalServer {
    constructor() {
        this.envConfig = EnvironmentConfig.getInstance();
        this.configMiddleware = new ConfigInjectionMiddleware();
        this.app = express();
        this.server = null;
        this.wsServer = null;
        
        this.initialize();
    }

    initialize() {
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSockets();
        this.setupErrorHandling();
        
        // Логируем конфигурацию при старте
        this.envConfig.logConfiguration();
    }

    setupMiddleware() {
        const config = this.envConfig.config;
        
        // Безопасность
        if (config.environment === 'production') {
            this.app.use(helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        scriptSrc: ["'self'", "'unsafe-inline'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        connectSrc: ["'self'", config.websocket.url.replace('ws', 'http')],
                        imgSrc: ["'self'", "data:", "https:"],
                    },
                },
            }));
        }

        // Сжатие
        if (config.performance.compression) {
            this.app.use(compression());
        }

        // CORS
        this.app.use(cors(config.cors));

        // Rate limiting
        const authLimiter = rateLimit(config.security.rateLimiting.auth);
        const apiLimiter = rateLimit(config.security.rateLimiting.api);
        
        this.app.use('/api/auth', authLimiter);
        this.app.use('/api', apiLimiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Статические файлы с кешированием
        const staticOptions = {
            maxAge: config.performance.cache.enabled ? config.performance.cache.maxAge * 1000 : 0,
            etag: true
        };
        
        this.app.use(express.static(path.join(__dirname, 'public'), staticOptions));
        this.app.use('/web-interface', express.static(path.join(__dirname, 'web-interface'), staticOptions));

        // Инжекция конфигурации в HTML
        this.app.use(this.configMiddleware.inject());
    }

    setupRoutes() {
        // Конфигурационные эндпоинты
        this.app.get('/api/config', this.configMiddleware.apiEndpoint());
        this.app.get('/config.js', this.configMiddleware.scriptEndpoint());

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                environment: this.envConfig.environment,
                version: process.env.VERSION || '1.0.0',
                uptime: process.uptime()
            });
        });

        // API Info
        this.app.get('/api/info', (req, res) => {
            const clientConfig = this.envConfig.getClientConfig();
            res.json({
                name: 'NeuroGrid API',
                version: '1.0.0',
                environment: this.envConfig.environment,
                endpoints: {
                    health: `${clientConfig.apiUrl}/health`,
                    config: `${clientConfig.apiUrl}/config`,
                    websocket: clientConfig.wsUrl
                },
                features: {
                    websockets: true,
                    rateLimiting: true,
                    compression: this.envConfig.config.performance.compression,
                    https: this.envConfig.config.security.https
                }
            });
        });

        // Mock API endpoints для тестирования
        this.setupMockAPI();

        // Главная страница - index.html или landing
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, 'index.html');
            const landingPath = path.join(__dirname, 'landing-page.html');
            
            // Проверяем, какой файл существует
            const fs = require('fs');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else if (fs.existsSync(landingPath)) {
                res.sendFile(landingPath);
            } else {
                res.json({
                    message: 'NeuroGrid API Server',
                    version: '1.0.0',
                    environment: this.envConfig.environment,
                    endpoints: ['/health', '/api/info', '/api/config']
                });
            }
        });

        // Веб-интерфейс маршруты
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'web-interface/dashboard.html'));
        });

        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, 'web-interface/admin.html'));
        });

        // Catch-all для SPA
        this.app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
                return res.status(404).json({ error: 'API endpoint not found' });
            }
            
            // Для всех остальных путей возвращаем index
            const indexPath = path.join(__dirname, 'index.html');
            if (require('fs').existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.status(404).json({ error: 'Page not found' });
            }
        });
    }

    setupMockAPI() {
        // Mock endpoints для демонстрации
        this.app.get('/api/models/available', (req, res) => {
            res.json({
                success: true,
                data: {
                    models: [
                        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
                        { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic' },
                        { id: 'llama-2-70b', name: 'LLaMA 2 70B', provider: 'Meta' }
                    ],
                    total: 3
                }
            });
        });

        this.app.get('/api/nodes', (req, res) => {
            res.json({
                success: true,
                data: {
                    nodes: [
                        { 
                            id: 'node-1', 
                            status: 'online', 
                            gpu: 'RTX 4090', 
                            utilization: 45,
                            location: 'US-East'
                        },
                        { 
                            id: 'node-2', 
                            status: 'online', 
                            gpu: 'RTX 3080', 
                            utilization: 78,
                            location: 'EU-West'
                        }
                    ],
                    total: 2,
                    online: 2
                }
            });
        });

        this.app.get('/api/tasks', (req, res) => {
            res.json({
                success: true,
                data: {
                    tasks: [],
                    total: 0,
                    pending: 0,
                    completed: 0
                }
            });
        });

        this.app.post('/api/ai/process', (req, res) => {
            // Имитируем обработку AI запроса
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
    }

    setupWebSockets() {
        this.server = createServer(this.app);
        
        this.wsServer = new WebSocket.Server({ 
            server: this.server,
            path: '/ws'
        });

        this.wsServer.on('connection', (ws, request) => {
            console.log(`🔌 WebSocket client connected from ${request.socket.remoteAddress}`);
            
            // Отправляем конфигурацию при подключении
            ws.send(JSON.stringify({
                type: 'config',
                data: this.envConfig.getClientConfig()
            }));

            // Ping-pong для поддержания соединения
            const heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }, 30000);

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    console.log('📨 WebSocket message:', data);
                    
                    // Echo для тестирования
                    ws.send(JSON.stringify({
                        type: 'echo',
                        data: data,
                        timestamp: new Date().toISOString()
                    }));
                } catch (error) {
                    console.error('❌ WebSocket message parse error:', error);
                }
            });

            ws.on('close', () => {
                clearInterval(heartbeat);
                console.log('🔌 WebSocket client disconnected');
            });

            ws.on('error', (error) => {
                clearInterval(heartbeat);
                console.error('❌ WebSocket error:', error);
            });
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Endpoint ${req.method} ${req.path} not found`
            });
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('❌ Server Error:', error);
            
            const isDevelopment = this.envConfig.environment === 'development';
            
            res.status(error.status || 500).json({
                success: false,
                error: isDevelopment ? error.message : 'Internal Server Error',
                ...(isDevelopment && { stack: error.stack })
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', this.shutdown.bind(this));
        process.on('SIGINT', this.shutdown.bind(this));
    }

    async shutdown() {
        console.log('\n🛑 Shutting down NeuroGrid server...');
        
        if (this.wsServer) {
            this.wsServer.close(() => {
                console.log('✅ WebSocket server closed');
            });
        }
        
        if (this.server) {
            this.server.close(() => {
                console.log('✅ HTTP server closed');
                process.exit(0);
            });
        }
    }

    start() {
        const port = this.envConfig.config.port;
        
        this.server.listen(port, '0.0.0.0', () => {
            console.log('\n🎉 NeuroGrid Universal Server Started!');
            console.log('═══════════════════════════════════════');
            console.log(`🚀 Server: ${this.envConfig.config.api.baseUrl}`);
            console.log(`📡 API: ${this.envConfig.config.api.endpoint}`);
            console.log(`⚡ WebSocket: ${this.envConfig.config.websocket.url}`);
            console.log(`🌐 Web Interface: ${this.envConfig.config.web.baseUrl}`);
            console.log(`📊 Health: ${this.envConfig.config.api.baseUrl}/health`);
            console.log(`🔧 Config: ${this.envConfig.config.api.baseUrl}/api/config`);
            console.log('═══════════════════════════════════════\n');
        });
    }
}

// Запуск сервера если файл вызван напрямую
if (require.main === module) {
    const server = new NeuroGridUniversalServer();
    server.start();
}

module.exports = NeuroGridUniversalServer;