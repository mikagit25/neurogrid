/**
 * NeuroGrid Environment Configuration
 * Универсальная конфигурация для разных окружений
 */

const EnvironmentConfig = {
    // Автоматическое определение окружения
    getEnvironment() {
        const hostname = typeof window !== 'undefined' 
            ? window.location.hostname 
            : process.env.HOSTNAME || 'localhost';
            
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        
        if (hostname.includes('neurogrid.network')) {
            return 'production';
        }
        
        if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        }
        
        return 'production'; // по умолчанию
    },
    
    // Конфигурация для каждого окружения
    environments: {
        development: {
            apiUrl: 'http://localhost:8080/api',
            wsUrl: 'ws://localhost:8080/ws',
            domain: 'localhost:8080',
            enableDebug: true,
            enableAnalytics: false
        },
        
        staging: {
            apiUrl: 'https://staging.neurogrid.network/api',
            wsUrl: 'wss://staging.neurogrid.network/ws',
            domain: 'staging.neurogrid.network',
            enableDebug: true,
            enableAnalytics: false
        },
        
        production: {
            apiUrl: 'https://neurogrid.network/api',
            wsUrl: 'wss://neurogrid.network/ws',
            domain: 'neurogrid.network',
            enableDebug: false,
            enableAnalytics: true
        }
    },
    
    // Получить конфигурацию для текущего окружения
    getConfig() {
        const env = this.getEnvironment();
        const config = this.environments[env];
        
        // Динамическое определение URL если не задано статически
        if (!config.apiUrl || config.apiUrl.includes('AUTO_DETECT')) {
            const protocol = typeof window !== 'undefined' 
                ? window.location.protocol 
                : 'https:';
            const hostname = typeof window !== 'undefined' 
                ? window.location.hostname 
                : 'neurogrid.network';
                
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                config.apiUrl = `${protocol}//${hostname}:8080/api`;
                config.wsUrl = `ws://${hostname}:8080/ws`;
            } else {
                config.apiUrl = `${protocol}//${hostname}/api`;
                config.wsUrl = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${hostname}/ws`;
            }
        }
        
        return {
            ...config,
            environment: env,
            isDevelopment: env === 'development',
            isStaging: env === 'staging',
            isProduction: env === 'production'
        };
    },
    
    // Логирование конфигурации
    logConfig() {
        const config = this.getConfig();
        if (config.enableDebug) {
            console.log('🔧 NeuroGrid Environment:', config.environment);
            console.log('🌐 API URL:', config.apiUrl);
            console.log('📡 WebSocket URL:', config.wsUrl);
            console.log('🏠 Domain:', config.domain);
        }
    }
};

// Для использования в Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnvironmentConfig;
}

// Для использования в браузере
if (typeof window !== 'undefined') {
    window.NeuroGridConfig = EnvironmentConfig;
}