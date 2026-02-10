const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Mock data
const mockCryptoData = {
    'BTC': { price: 43250, change24h: 2.5 },
    'ETH': { price: 2580, change24h: -1.2 },
    'USDT': { price: 1.00, change24h: 0.1 },
    'ADA': { price: 0.485, change24h: 3.8 }
};

// Routes
app.get('/', (req, res) => {
    res.json({
        message: '🚀 NeuroGrid Enhanced Crypto API Server',
        version: '1.0.0',
        endpoints: {
            prices: '/api/crypto/prices',
            portfolio: '/api/crypto/portfolio/user_123',
            aiRecommendations: '/api/crypto/ai-recommendations/user_123'
        },
        features: [
            '🤖 Multi-Agent AI Portfolio Analysis',
            '📈 Real-time Crypto Tracking',
            '🎯 Automated Recommendations'
        ]
    });
});

app.get('/api/crypto/prices', (req, res) => {
    const updatedPrices = {};
    Object.keys(mockCryptoData).forEach(symbol => {
        const data = mockCryptoData[symbol];
        const priceChange = (Math.random() - 0.5) * 0.02;
        updatedPrices[symbol] = {
            price: data.price * (1 + priceChange),
            change24h: data.change24h + (priceChange * 100),
            lastUpdate: new Date().toISOString()
        };
    });

    res.json({
        success: true,
        prices: updatedPrices,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/crypto/portfolio/:userId', (req, res) => {
    const { userId } = req.params;
    
    const portfolio = {
        assets: [
            { symbol: 'BTC', balance: 0.15234, purchasePrice: 41000 },
            { symbol: 'ETH', balance: 2.45612, purchasePrice: 2400 },
            { symbol: 'USDT', balance: 1250.00, purchasePrice: 1.00 },
            { symbol: 'ADA', balance: 1500.00, purchasePrice: 0.45 }
        ]
    };

    const enrichedAssets = portfolio.assets.map(asset => {
        const marketData = mockCryptoData[asset.symbol];
        const currentValue = asset.balance * marketData.price;
        const pnl = currentValue - (asset.balance * asset.purchasePrice);
        const pnlPercent = (pnl / (asset.balance * asset.purchasePrice)) * 100;

        return {
            ...asset,
            currentPrice: marketData.price,
            change24h: marketData.change24h,
            currentValue: currentValue,
            pnl: pnl,
            pnlPercent: pnlPercent
        };
    });

    const totalValue = enrichedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalPnl = enrichedAssets.reduce((sum, asset) => sum + asset.pnl, 0);

    res.json({
        success: true,
        portfolio: {
            assets: enrichedAssets,
            totalValue: totalValue,
            totalPnl: totalPnl,
            totalPnlPercent: (totalPnl / (totalValue - totalPnl)) * 100
        }
    });
});

app.get('/api/crypto/ai-recommendations/:userId', (req, res) => {
    const recommendations = [
        {
            id: 1,
            type: 'portfolio_optimization',
            title: '🤖 AI Оптимизация портфеля',
            description: 'Multi-Agent система рекомендует увеличить долю ETH на 15%',
            confidence: 85,
            priority: 'high',
            created: new Date().toISOString()
        },
        {
            id: 2,
            type: 'risk_management',
            title: '⚖️ Управление рисками',
            description: 'Обнаружена высокая волатильность BTC. Рекомендуется частичная фиксация',
            confidence: 78,
            priority: 'medium',
            created: new Date().toISOString()
        },
        {
            id: 3,
            type: 'opportunity',
            title: '💰 Арбитражная возможность',
            description: 'Multi-Agent система обнаружила выгодный арбитраж USDT/ETH',
            confidence: 92,
            priority: 'urgent',
            created: new Date().toISOString()
        }
    ];

    res.json({
        success: true,
        recommendations: recommendations,
        generated: new Date().toISOString(),
        aiModel: 'NeuroGrid Multi-Agent AI v2.1'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 NeuroGrid Crypto API Server запущен на порту ${PORT}`);
    console.log(`📊 API доступен на: http://localhost:${PORT}/`);
    console.log(`💰 Portfolio: http://localhost:${PORT}/api/crypto/portfolio/user_123`);
    console.log(`🤖 AI Recommendations: http://localhost:${PORT}/api/crypto/ai-recommendations/user_123`);
    console.log('✅ Система готова к работе!');
});