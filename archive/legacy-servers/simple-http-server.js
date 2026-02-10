// Простой тестовый сервер для проверки
const http = require('http');

const PORT = 3002;

const server = http.createServer((req, res) => {
    // Устанавливаем заголовки только один раз
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const url = new URL(req.url, `http://${req.headers.host}`).pathname;
    const method = req.method;

    console.log(`${method} ${url}`);

    if (url === '/') {
        res.statusCode = 200;
        res.end(JSON.stringify({
            message: '🚀 NeuroGrid Crypto API Server',
            version: '1.0.0',
            status: 'working',
            timestamp: new Date().toISOString(),
            endpoints: [
                'GET /api/crypto/prices',
                'GET /api/crypto/portfolio/user_123',
                'GET /api/crypto/ai-recommendations/user_123'
            ]
        }, null, 2));
    } else if (url === '/api/crypto/prices') {
        res.statusCode = 200;
        res.end(JSON.stringify({
            success: true,
            prices: {
                'BTC': { price: 43250, change24h: 2.5 },
                'ETH': { price: 2580, change24h: -1.2 },
                'USDT': { price: 1.00, change24h: 0.1 }
            },
            timestamp: new Date().toISOString()
        }, null, 2));
    } else if (url === '/api/crypto/portfolio/user_123') {
        res.statusCode = 200;
        res.end(JSON.stringify({
            success: true,
            portfolio: {
                assets: [
                    { symbol: 'BTC', balance: 0.15234, currentPrice: 43250, currentValue: 6583.25 },
                    { symbol: 'ETH', balance: 2.45612, currentPrice: 2580, currentValue: 6340.79 },
                    { symbol: 'USDT', balance: 1250.00, currentPrice: 1.00, currentValue: 1250.00 }
                ],
                totalValue: 14174.04
            }
        }, null, 2));
    } else if (url === '/api/crypto/ai-recommendations/user_123') {
        res.statusCode = 200;
        res.end(JSON.stringify({
            success: true,
            recommendations: [
                {
                    id: 1,
                    type: 'portfolio_optimization',
                    title: '🤖 AI Оптимизация портфеля',
                    description: 'Multi-Agent система рекомендует увеличить долю ETH на 15%',
                    confidence: 85
                },
                {
                    id: 2,
                    type: 'risk_management', 
                    title: '⚖️ Управление рисками',
                    description: 'Рекомендуется частичная фиксация прибыли по BTC',
                    confidence: 78
                }
            ],
            aiModel: 'NeuroGrid Multi-Agent AI v2.1',
            timestamp: new Date().toISOString()
        }, null, 2));
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({
            error: 'Not Found',
            message: 'Endpoint not found',
            availableEndpoints: [
                '/',
                '/api/crypto/prices',
                '/api/crypto/portfolio/user_123',
                '/api/crypto/ai-recommendations/user_123'
            ]
        }, null, 2));
    }
});

server.listen(PORT, () => {
    console.log(`🚀 NeuroGrid Simple Crypto API запущен на порту ${PORT}`);
    console.log(`📊 API доступен на: http://localhost:${PORT}/`);
    console.log(`💰 Portfolio: http://localhost:${PORT}/api/crypto/portfolio/user_123`);
    console.log(`🤖 AI Recommendations: http://localhost:${PORT}/api/crypto/ai-recommendations/user_123`);
    console.log('✅ Система готова к работе!');
});

server.on('error', (err) => {
    console.error('❌ Ошибка сервера:', err.message);
    process.exit(1);
});

// Обработка сигналов для корректного завершения
process.on('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM, завершение сервера...');
    server.close(() => {
        console.log('✅ Сервер завершен');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Получен SIGINT, завершение сервера...');
    server.close(() => {
        console.log('✅ Сервер завершен');
        process.exit(0);
    });
});