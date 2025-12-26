/**
 * Middleware для автоматической инъекции конфигурации в HTML страницы
 */

const EnvironmentConfig = require('./EnvironmentConfig');

class ConfigInjectionMiddleware {
    constructor() {
        this.envConfig = EnvironmentConfig.getInstance();
    }

    /**
     * Middleware для Express.js - автоматически инжектирует конфигурацию в HTML
     */
    inject() {
        return (req, res, next) => {
            // Сохраняем оригинальный метод send
            const originalSend = res.send;
            
            res.send = function(body) {
                // Проверяем, является ли ответ HTML
                const contentType = res.get('Content-Type');
                if (contentType && contentType.includes('text/html') && typeof body === 'string') {
                    // Инжектируем конфигурацию перед закрывающим тегом head или body
                    const configScript = `
<script type="text/javascript">
// NeuroGrid Auto-injected Configuration
${this.envConfig.generateClientScript()}
</script>`;
                    
                    if (body.includes('</head>')) {
                        body = body.replace('</head>', `${configScript}\n</head>`);
                    } else if (body.includes('<body')) {
                        body = body.replace('<body', `${configScript}\n<body`);
                    } else if (body.includes('<script')) {
                        // Если есть script теги, вставляем в начало первого
                        body = body.replace('<script', `${configScript}\n<script`);
                    }
                }
                
                // Вызываем оригинальный send
                return originalSend.call(this, body);
            }.bind(this);
            
            next();
        };
    }

    /**
     * Endpoint для получения конфигурации через API
     */
    apiEndpoint() {
        return (req, res) => {
            const clientConfig = this.envConfig.getClientConfig();
            res.json({
                success: true,
                data: clientConfig,
                timestamp: new Date().toISOString()
            });
        };
    }

    /**
     * Endpoint для получения JavaScript файла с конфигурацией
     */
    scriptEndpoint() {
        return (req, res) => {
            const script = this.envConfig.generateClientScript();
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 минут кеш
            res.send(script);
        };
    }
}

module.exports = ConfigInjectionMiddleware;