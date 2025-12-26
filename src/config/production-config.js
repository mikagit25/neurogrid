/**
 * NeuroGrid Production Configuration System
 * Централизованная система конфигурации для всех окружений
 */

class NeuroGridConfig {
    constructor() {
        this.environment = this.detectEnvironment();
        this.config = this.getEnvironmentConfig();
    }

    /**
     * Автоматическое определение окружения
     */
    detectEnvironment() {
        // Проверяем переменные окружения сначала
        if (process.env.NODE_ENV === 'production') return 'production';
        if (process.env.NODE_ENV === 'staging') return 'staging';
        if (process.env.NODE_ENV === 'development') return 'development';
        
        // Определяем по hostname
        const hostname = this.getHostname();
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        
        if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        }
        
        // Если есть доменное имя - считаем production
        if (hostname.includes('.')) {
            return 'production';
        }
        
        return 'development';
    }

    /**
     * Получить hostname для текущего окружения
     */
    getHostname() {
        if (typeof window !== 'undefined') {
            return window.location.hostname;
        }
        
        return process.env.DOMAIN || 
               process.env.HOST || 
               process.env.HOSTNAME || 
               'localhost';
    }

    /**
     * Получить порт из переменных окружения
     */
    getPort() {
        return process.env.PORT || 
               process.env.API_PORT || 
               (this.environment === 'development' ? 8080 : 80);
    }

    /**
     * Конфигурация для каждого окружения
     */
    getEnvironmentConfig() {
        const hostname = this.getHostname();
        const port = this.getPort();
        const protocol = this.getProtocol();
        
        const baseConfig = {
            hostname,
            port,
            protocol,
            environment: this.environment
        };

        switch (this.environment) {
            case 'development':
                return {
                    ...baseConfig,
                    apiUrl: `http://localhost:8080/api`,
                    wsUrl: `ws://localhost:8080/ws`,
                    webUrl: `http://localhost:3000`,
                    domain: 'localhost',
                    enableDebug: true,
                    enableAnalytics: false,
                    enableSSL: false,
                    corsOrigins: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:8080']
                };
                
            case 'staging':
                return {
                    ...baseConfig,
                    apiUrl: `https://${hostname}/api`,
                    wsUrl: `wss://${hostname}/ws`,
                    webUrl: `https://${hostname}`,
                    domain: hostname,
                    enableDebug: true,
                    enableAnalytics: false,
                    enableSSL: true,
                    corsOrigins: [`https://${hostname}`, `http://${hostname}`]
                };
                
            case 'production':
            default:
                const productionDomain = hostname === 'localhost' ? 'neurogrid.network' : hostname;
                return {
                    ...baseConfig,
                    hostname: productionDomain,
                    apiUrl: `https://${productionDomain}/api`,
                    wsUrl: `wss://${productionDomain}/ws`,
                    webUrl: `https://${productionDomain}`,
                    domain: productionDomain,
                    enableDebug: false,
                    enableAnalytics: true,
                    enableSSL: true,
                    corsOrigins: [`https://${productionDomain}`, `http://${productionDomain}`]
                };
        }
    }

    /**
     * Получить протокол (http/https)
     */
    getProtocol() {
        if (this.environment === 'development') {
            return 'http';
        }
        
        if (typeof window !== 'undefined') {
            return window.location.protocol.replace(':', '');
        }
        
        return process.env.USE_HTTPS === 'true' || this.environment === 'production' ? 'https' : 'http';
    }

    /**
     * Получить полную URL для API
     */
    getApiUrl(endpoint = '') {
        return `${this.config.apiUrl}${endpoint}`;
    }

    /**
     * Получить WebSocket URL
     */
    getWebSocketUrl(path = '') {
        return `${this.config.wsUrl}${path}`;
    }

    /**
     * Получить URL веб-интерфейса
     */
    getWebUrl(path = '') {
        return `${this.config.webUrl}${path}`;
    }

    /**
     * Проверить, является ли окружение локальным
     */
    isLocal() {
        return this.environment === 'development' || 
               this.config.hostname === 'localhost' ||
               this.config.hostname === '127.0.0.1';
    }

    /**
     * Проверить, является ли окружение production
     */
    isProduction() {
        return this.environment === 'production';
    }

    /**
     * Получить настройки CORS
     */
    getCorsOrigins() {
        return this.config.corsOrigins;
    }

    /**
     * Логирование конфигурации
     */
    logConfig() {
        if (this.config.enableDebug) {
            console.log('\n🔧 NeuroGrid Configuration:');
            console.log(`   Environment: ${this.environment}`);
            console.log(`   Hostname: ${this.config.hostname}`);
            console.log(`   Port: ${this.config.port}`);
            console.log(`   Protocol: ${this.config.protocol}`);
            console.log(`   API URL: ${this.config.apiUrl}`);
            console.log(`   WebSocket URL: ${this.config.wsUrl}`);
            console.log(`   Web URL: ${this.config.webUrl}`);
            console.log(`   SSL Enabled: ${this.config.enableSSL}`);
            console.log('');
        }
    }

    /**
     * Получить конфигурацию для клиентского кода
     */
    getClientConfig() {
        return {
            apiUrl: this.config.apiUrl,
            wsUrl: this.config.wsUrl,
            webUrl: this.config.webUrl,
            domain: this.config.domain,
            environment: this.environment,
            enableDebug: this.config.enableDebug,
            enableAnalytics: this.config.enableAnalytics,
            isLocal: this.isLocal(),
            isProduction: this.isProduction()
        };
    }

    /**
     * Получить конфигурацию для сервера
     */
    getServerConfig() {
        return {
            ...this.config,
            database: {
                host: process.env.POSTGRES_HOST || (this.isLocal() ? 'localhost' : 'db'),
                port: process.env.POSTGRES_PORT || 5432,
                database: process.env.POSTGRES_DB || 'neurogrid',
                username: process.env.POSTGRES_USER || 'neurogrid',
                password: process.env.POSTGRES_PASSWORD || 'neurogrid_password'
            },
            redis: {
                host: process.env.REDIS_HOST || (this.isLocal() ? 'localhost' : 'redis'),
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD
            }
        };
    }

    /**
     * Создать .env файл для окружения
     */
    generateEnvFile() {
        const config = this.getServerConfig();
        const envContent = `# NeuroGrid Environment Configuration
# Generated for ${this.environment} environment

NODE_ENV=${this.environment}
DOMAIN=${config.hostname}
PORT=${config.port}
USE_HTTPS=${config.enableSSL}

# API Configuration
API_URL=${config.apiUrl}
WS_URL=${config.wsUrl}
WEB_URL=${config.webUrl}

# CORS Configuration
ALLOWED_ORIGINS=${config.corsOrigins.join(',')}

# Database Configuration
POSTGRES_HOST=${config.database.host}
POSTGRES_PORT=${config.database.port}
POSTGRES_DB=${config.database.database}
POSTGRES_USER=${config.database.username}
POSTGRES_PASSWORD=${config.database.password}

# Redis Configuration
REDIS_HOST=${config.redis.host}
REDIS_PORT=${config.redis.port}
${config.redis.password ? `REDIS_PASSWORD=${config.redis.password}` : ''}

# Feature Flags
ENABLE_DEBUG=${config.enableDebug}
ENABLE_ANALYTICS=${config.enableAnalytics}
ENABLE_SSL=${config.enableSSL}
`;
        return envContent;
    }
}

// Создаем глобальный экземпляр
const neuroGridConfig = new NeuroGridConfig();

// Для использования в Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = neuroGridConfig;
}

// Для использования в браузере
if (typeof window !== 'undefined') {
    window.NeuroGridConfig = neuroGridConfig;
    // Автоматически логируем конфигурацию в браузере
    neuroGridConfig.logConfig();
}

// Автоматически логируем конфигурацию при загрузке
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    neuroGridConfig.logConfig();
}