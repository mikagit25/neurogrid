const express = require('express');
const cors = require('cors');
const path = require('path');

// Импортируем наш новый crypto API
const cryptoRoutes = require('./routes/crypto');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/crypto', cryptoRoutes);

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

// Serve enhanced wallet
app.get('/enhanced-wallet', (req, res) => {
    res.sendFile(path.join(__dirname, '../web-interface/public/enhanced-wallet.html'));
});

// Default route
app.get('/', (req, res) => {
    res.json({
        message: 'NeuroGrid Crypto API Server',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            crypto: '/api/crypto/*',
            wallet: '/enhanced-wallet'
        },
        features: [
            'Multi-Agent AI Portfolio Analysis',
            'Real-time Crypto Tracking',
            'Automated Recommendations',
            'Risk Assessment'
        ]
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            '/health',
            '/api/crypto/portfolio/:userId',
            '/api/crypto/ai-recommendations/:userId',
            '/api/crypto/prices',
            '/api/crypto/swap',
            '/enhanced-wallet'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 NeuroGrid Crypto API Server запущен на порту ${PORT}`);
    console.log(`📊 Enhanced Wallet доступен на: http://localhost:${PORT}/enhanced-wallet`);
    console.log(`🔗 API Documentation: http://localhost:${PORT}/`);
    console.log('🤖 Multi-Agent система готова к работе!');
});

module.exports = app;