const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const mockCryptoData = {
    'BTC': { price: 43250, change24h: 2.5, marketCap: 850000000000 },
    'ETH': { price: 2580, change24h: -1.2, marketCap: 310000000000 },
    'USDT': { price: 1.00, change24h: 0.1, marketCap: 95000000000 },
    'ADA': { price: 0.485, change24h: 3.8, marketCap: 17000000000 },
    'SOL': { price: 98.5, change24h: 5.2, marketCap: 42000000000 },
    'DOT': { price: 7.2, change24h: -2.1, marketCap: 9000000000 }
};

const userPortfolios = new Map();

// Routes
app.get('/api/crypto/prices', (req, res) => {
    try {
        const updatedPrices = Object.keys(mockCryptoData).reduce((acc, symbol) => {
            const data = mockCryptoData[symbol];
            const priceChange = (Math.random() - 0.5) * 0.02;
            
            acc[symbol] = {
                price: data.price * (1 + priceChange),
                change24h: data.change24h + (priceChange * 100),
                marketCap: data.marketCap,
                lastUpdate: new Date().toISOString()
            };
            
            return acc;
        }, {});

        res.json({
            success: true,
            prices: updatedPrices,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting prices:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/crypto/portfolio/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const portfolio = userPortfolios.get(userId) || {
            assets: [
                { symbol: 'BTC', balance: 0.15234, purchasePrice: 41000 },
                { symbol: 'ETH', balance: 2.45612, purchasePrice: 2400 },
                { symbol: 'USDT', balance: 1250.00, purchasePrice: 1.00 },
                { symbol: 'ADA', balance: 1500.00, purchasePrice: 0.45 }
            ],
            totalValue: 0,
            pnl: 0
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
    } catch (error) {
        console.error('Error getting portfolio:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/crypto/ai-recommendations/:userId', (req, res) => {
    try {
        const recommendations = [
            {
                id: 1,
                type: 'portfolio_optimization',
                title: 'AI Оптимизация портфеля',
                description: 'Multi-Agent система рекомендует увеличить долю ETH на 15%',
                confidence: 85,
                impact: 'medium',
                reasoning: 'Технический анализ показывает сильные паттерны роста',
                suggestedAction: 'Увеличить позицию ETH до 35% от портфеля',
                priority: 'high',
                created: new Date().toISOString()
            },
            {
                id: 2,
                type: 'risk_management',
                title: 'Управление рисками',
                description: 'Обнаружена высокая волатильность BTC. Рекомендуется частичная фиксация',
                confidence: 78,
                impact: 'high',
                reasoning: 'AI анализ показывает приближение к зоне сопротивления',
                suggestedAction: 'Зафиксировать 25% позиции BTC',
                priority: 'medium',
                created: new Date().toISOString()
            },
            {
                id: 3,
                type: 'opportunity',
                title: 'Арбитражная возможность',
                description: 'Multi-Agent система обнаружила выгодный арбитраж USDT/ETH',
                confidence: 92,
                impact: 'medium',
                reasoning: 'Разница курсов между биржами составляет 0.8%',
                suggestedAction: 'Выполнить арбитраж в течение 10 минут',
                priority: 'urgent',
                created: new Date().toISOString()
            }
        ];

        res.json({
            success: true,
            recommendations: recommendations,
            generated: new Date().toISOString(),
            aiModel: 'NeuroGrid Multi-Agent AI v2.1',
            analysisMetrics: {
                portfolioValue: 12450.00,
                riskScore: 0.65,
                diversificationIndex: 0.72,
                sentimentScore: 75
            }
        });
    } catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/crypto/swap', (req, res) => {
    try {
        const { userId, fromAsset, toAsset, amount } = req.body;

        if (!userId || !fromAsset || !toAsset || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required parameters' 
            });
        }

        const fromPrice = mockCryptoData[fromAsset]?.price;
        const toPrice = mockCryptoData[toAsset]?.price;

        if (!fromPrice || !toPrice) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid asset pair' 
            });
        }

        const exchangeRate = fromPrice / toPrice;
        const fee = 0.003;
        const toAmount = (amount * exchangeRate) * (1 - fee);

        const swapResult = {
            transactionId: `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fromAsset,
            toAsset,
            fromAmount: amount,
            toAmount: toAmount,
            exchangeRate: exchangeRate,
            fee: amount * exchangeRate * fee,
            feePercent: fee * 100,
            status: 'completed',
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            swap: swapResult
        });
    } catch (error) {
        console.error('Error executing swap:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/crypto/market-sentiment', (req, res) => {
    try {
        const sentiment = {
            overall: {
                score: 67,
                label: 'Neutral-Bullish',
                description: 'Рынок показывает умеренный оптимизм'
            },
            assets: {
                'BTC': { score: 75, label: 'Bullish', trend: 'up' },
                'ETH': { score: 80, label: 'Very Bullish', trend: 'up' },
                'USDT': { score: 50, label: 'Neutral', trend: 'stable' },
                'ADA': { score: 65, label: 'Neutral-Bullish', trend: 'up' }
            },
            lastUpdate: new Date().toISOString()
        };

        res.json({
            success: true,
            sentiment: sentiment
        });
    } catch (error) {
        console.error('Error getting market sentiment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: [
            'Enhanced Crypto Wallet',
            'Multi-Agent Portfolio Analyzer',
            'Real-time Price Updates',
            'AI Recommendations'
        ]
    });
});

// Default route
app.get('/', (req, res) => {
    res.json({
        message: '🚀 NeuroGrid Enhanced Crypto API Server',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            prices: '/api/crypto/prices',
            portfolio: '/api/crypto/portfolio/:userId',
            aiRecommendations: '/api/crypto/ai-recommendations/:userId',
            swap: '/api/crypto/swap (POST)',
            sentiment: '/api/crypto/market-sentiment'
        },
        features: [
            '🤖 Multi-Agent AI Portfolio Analysis',
            '📈 Real-time Crypto Tracking', 
            '🎯 Automated Recommendations',
            '⚖️ Risk Assessment',
            '🔄 Crypto Swaps',
            '📊 Market Sentiment Analysis'
        ]
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 NeuroGrid Crypto API Server запущен на порту ${PORT}`);
    console.log(`📊 API доступен на: http://localhost:${PORT}/`);
    console.log(`🔗 Документация: http://localhost:${PORT}/`);
    console.log(`💰 Portfolio API: http://localhost:${PORT}/api/crypto/portfolio/user_123`);
    console.log(`🤖 AI Recommendations: http://localhost:${PORT}/api/crypto/ai-recommendations/user_123`);
    console.log('✅ Система готова к работе!');
});

module.exports = app;