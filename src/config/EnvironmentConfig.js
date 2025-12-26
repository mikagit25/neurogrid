/**
 * NeuroGrid - Централизованная конфигурация окружений
 * Поддерживает локальную разработку, staging и production
 */

class EnvironmentConfig {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.hostname = this.getHostname();
        this.port = process.env.PORT || (this.environment === 'production' ? 8080 : 3001);
        this.webPort = process.env.WEB_PORT || 3000;
        this.initializeConfig();
    }

    getHostname() {
        // Определение окружения на основе хостнейма и переменных среды
        if (process.env.DOMAIN) {
            return process.env.DOMAIN;
        }
        
        if (process.env.NODE_ENV === 'production' && process.env.HOST) {
            return process.env.HOST;
        }
        
        // Автоматическое определение для Docker/Kubernetes
        const dockerHost = process.env.DOCKER_HOST || process.env.KUBERNETES_SERVICE_HOST;
        if (dockerHost) {
            return dockerHost;
        }
        
        return process.env.HOSTNAME || 'localhost';
    }

    isLocal() {
        return this.hostname === 'localhost' || 
               this.hostname === '127.0.0.1' || 
               this.hostname.includes('localhost');
    }

    isProduction() {
        return this.environment === 'production' && !this.isLocal();
    }

    initializeConfig() {
        const protocols = this.getProtocols();
        
        this.config = {
            // Основные настройки
            environment: this.environment,
            hostname: this.hostname,
            domain: this.getDomain(),
            
            // Порты
            port: this.port,
            webPort: this.webPort,
            
            // URL конфигурация
            api: {
                baseUrl: `${protocols.http}://${this.hostname}:${this.port}`,
                endpoint: `${protocols.http}://${this.hostname}:${this.port}/api`,
                version: 'v1',
                fullUrl: `${protocols.http}://${this.hostname}:${this.port}/api/v1`
            },
            
            web: {
                baseUrl: `${protocols.http}://${this.hostname}:${this.webPort}`,
                assetsUrl: `${protocols.http}://${this.hostname}:${this.webPort}/assets`
            },
            
            websocket: {
                url: `${protocols.ws}://${this.hostname}:${this.port}/ws`,
                options: {
                    transports: ['websocket']
                }
            },
            
            // CORS настройки
            cors: {
                origins: this.getCorsOrigins(),
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
            },
            
            // Безопасность
            security: {
                jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
                apiKey: process.env.API_KEY || 'dev-api-key',
                rateLimiting: this.getRateLimits(),
                https: protocols.http === 'https'
            },
            
            // База данных
            database: this.getDatabaseConfig(),
            
            // Производительность
            performance: {
                compression: this.environment === 'production',
                cache: {
                    enabled: this.environment !== 'development',
                    maxAge: this.environment === 'production' ? 86400 : 300
                }
            }
        };
    }

    getProtocols() {
        const useHttps = this.isProduction() || process.env.FORCE_HTTPS === 'true';
        return {
            http: useHttps ? 'https' : 'http',
            ws: useHttps ? 'wss' : 'ws'
        };
    }

    getDomain() {
        if (this.isProduction()) {
            return process.env.PRODUCTION_DOMAIN || 'neurogrid.network';
        }
        return this.hostname;
    }

    getCorsOrigins() {
        const protocols = this.getProtocols();
        
        if (this.isProduction()) {
            return [
                `${protocols.http}://${this.getDomain()}`,
                `${protocols.http}://www.${this.getDomain()}`,
                `${protocols.http}://api.${this.getDomain()}`
            ];
        }
        
        // Разработка - разрешить localhost на разных портах
        return [
            `${protocols.http}://localhost:${this.webPort}`,
            `${protocols.http}://localhost:${this.port}`,
            `${protocols.http}://127.0.0.1:${this.webPort}`,
            `${protocols.http}://127.0.0.1:${this.port}`
        ];
    }

    getRateLimits() {
        return {
            auth: {
                windowMs: 15 * 60 * 1000, // 15 минут
                max: this.environment === 'production' ? 5 : 100
            },
            api: {
                windowMs: 60 * 1000, // 1 минута
                max: this.environment === 'production' ? 100 : 1000
            }
        };
    }

    getDatabaseConfig() {
        return {
            host: process.env.DB_HOST || (this.isLocal() ? 'localhost' : 'db'),
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'neurogrid',
            username: process.env.DB_USER || 'neurogrid',
            password: process.env.DB_PASSWORD || 'neurogrid123',
            ssl: this.isProduction() && process.env.DB_SSL !== 'false',
            pool: {
                min: this.environment === 'production' ? 5 : 1,
                max: this.environment === 'production' ? 20 : 5
            }
        };
    }

    // Получение конфигурации для клиентской части
    getClientConfig() {
        return {
            apiUrl: this.config.api.endpoint,
            wsUrl: this.config.websocket.url,
            webUrl: this.config.web.baseUrl,
            domain: this.config.domain,
            environment: this.environment,
            version: process.env.VERSION || '1.0.0'
        };
    }

    // Метод для динамической загрузки конфигурации в браузере
    generateClientScript() {
        const clientConfig = this.getClientConfig();
        return `
window.NeuroGridConfig = ${JSON.stringify(clientConfig, null, 2)};
window.API_BASE_URL = '${clientConfig.apiUrl}';
window.WS_URL = '${clientConfig.wsUrl}';
window.WEB_BASE_URL = '${clientConfig.webUrl}';
console.log('🔧 NeuroGrid Config loaded:', window.NeuroGridConfig);
        `.trim();
    }

    // Проверка конфигурации
    validate() {
        const errors = [];
        
        if (this.isProduction()) {
            if (this.config.security.jwtSecret === 'dev-secret-key-change-in-production') {
                errors.push('JWT_SECRET must be set in production');
            }
            if (!process.env.DB_PASSWORD) {
                errors.push('DB_PASSWORD must be set in production');
            }
            if (!this.config.security.https) {
                console.warn('⚠️  HTTPS not enabled in production environment');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Логирование конфигурации при старте
    logConfiguration() {
        console.log('\n🚀 NeuroGrid Configuration');
        console.log('═══════════════════════════════════════');
        console.log(`📍 Environment: ${this.environment}`);
        console.log(`🌐 Hostname: ${this.hostname}`);
        console.log(`🔧 Domain: ${this.config.domain}`);
        console.log(`🔗 API URL: ${this.config.api.endpoint}`);
        console.log(`💻 Web URL: ${this.config.web.baseUrl}`);
        console.log(`⚡ WebSocket: ${this.config.websocket.url}`);
        console.log(`🔒 HTTPS: ${this.config.security.https ? 'Enabled' : 'Disabled'}`);
        console.log(`💾 Database: ${this.config.database.host}:${this.config.database.port}`);
        console.log('═══════════════════════════════════════\n');
        
        const validation = this.validate();
        if (!validation.valid) {
            console.error('❌ Configuration errors:', validation.errors);
            if (this.isProduction()) {
                throw new Error('Invalid production configuration');
            }
        } else {
            console.log('✅ Configuration validated successfully\n');
        }
    }

    // Статический метод для получения единственного экземпляра
    static getInstance() {
        if (!EnvironmentConfig.instance) {
            EnvironmentConfig.instance = new EnvironmentConfig();
        }
        return EnvironmentConfig.instance;
    }
}

module.exports = EnvironmentConfig;