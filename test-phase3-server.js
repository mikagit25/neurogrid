const express = require('express');
const path = require('path');

// Initialize Phase 3 Manager
const Phase3Manager = require('./src/phase3/Phase3Manager.js');

const app = express();
const port = 3002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Phase 3 Manager
let phase3Manager;

app.listen(port, async () => {
    console.log('\n🚀 NeuroGrid Phase 3 Test Server');
    console.log(`⚡ Starting server on http://localhost:${port}`);
    
    try {
        // Initialize Phase 3
        phase3Manager = new Phase3Manager('http://localhost:' + port);
        await phase3Manager.initialize();
        
        console.log(`✅ Phase 3 Test Server running on http://localhost:${port}`);
        console.log(`🎯 Phase 3 ID: ${phase3Manager.phase3Id}`);
        console.log('📡 Available Phase 3 SDK endpoints:');
        console.log('   GET /api/v3/sdk/models - List models via SDK');
        console.log('   GET /api/v3/sdk/governance/proposals - Get proposals via SDK');
        console.log('   GET /api/v3/sdk/analytics/leaderboard - Get leaderboard via SDK');
        console.log('   GET /api/v3/sdk/examples - Get code examples via SDK');
        console.log('   GET /api/v3/sdk/examples/:language - Get language-specific examples');
        
    } catch (error) {
        console.error('❌ Failed to initialize Phase 3:', error);
    }
});

// Basic status endpoint
app.get('/api/v3/status', (req, res) => {
    if (!phase3Manager) {
        return res.status(503).json({
            success: false,
            error: 'Phase 3 Manager not initialized'
        });
    }
    
    res.json({
        success: true,
        phase3_id: phase3Manager.phase3Id,
        status: 'Phase 3 Test Server - Active',
        timestamp: new Date().toISOString()
    });
});

// List available models via SDK
app.get('/api/v3/sdk/models', async (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const filters = req.query;
        const modelsData = await phase3Manager.developerSDK.listModels(filters);
        
        res.json({
            success: true,
            data: modelsData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Models List Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list models via SDK',
            details: error.message
        });
    }
});

// Get specific model via SDK
app.get('/api/v3/sdk/models/:modelId', async (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { modelId } = req.params;
        const modelData = await phase3Manager.developerSDK.getModel(modelId);
        
        res.json({
            success: true,
            data: modelData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Model Details Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get model details via SDK',
            details: error.message
        });
    }
});

// Governance proposals via SDK
app.get('/api/v3/sdk/governance/proposals', async (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const proposals = await phase3Manager.developerSDK.getProposals();
        
        res.json({
            success: true,
            data: proposals,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Governance Proposals Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get proposals via SDK',
            details: error.message
        });
    }
});

// Analytics leaderboard via SDK
app.get('/api/v3/sdk/analytics/leaderboard', (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const leaderboard = phase3Manager.developerSDK.getAnalyticsLeaderboard('providers');
        
        res.json({
            success: true,
            data: leaderboard,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Analytics Leaderboard Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get leaderboard via SDK',
            details: error.message
        });
    }
});

// Analytics leaderboard by type via SDK
app.get('/api/v3/sdk/analytics/leaderboard/:type', (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { type } = req.params;
        const leaderboard = phase3Manager.developerSDK.getAnalyticsLeaderboard(type);
        
        res.json({
            success: true,
            data: leaderboard,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Analytics Leaderboard Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get leaderboard via SDK',
            details: error.message
        });
    }
});

// Code examples via SDK (default JavaScript)
app.get('/api/v3/sdk/examples', (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const examples = phase3Manager.developerSDK.generateCodeExamples('javascript');
        
        res.json({
            success: true,
            language: 'javascript',
            data: examples,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Code Examples Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get code examples via SDK',
            details: error.message
        });
    }
});

// Code examples via SDK (specific language)
app.get('/api/v3/sdk/examples/:language', (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { language } = req.params;
        const examples = phase3Manager.developerSDK.generateCodeExamples(language);
        
        res.json({
            success: true,
            language: language,
            data: examples,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Code Examples Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get code examples via SDK',
            details: error.message
        });
    }
});

// User analytics via SDK  
app.get('/api/v3/sdk/analytics/users/:userId', (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { userId } = req.params;
        const userStats = phase3Manager.developerSDK.getUserAnalytics(userId);
        
        res.json({
            success: true,
            data: userStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK User Analytics Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user analytics via SDK',
            details: error.message
        });
    }
});

// Enterprise configuration via SDK
app.get('/api/v3/sdk/enterprise/config', (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const enterpriseConfig = phase3Manager.developerSDK.getEnterpriseConfig();
        
        res.json({
            success: true,
            data: enterpriseConfig,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Enterprise Config Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get enterprise config via SDK',
            details: error.message
        });
    }
});

// API key validation via SDK
app.post('/api/v3/sdk/validate-key', async (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { apiKey } = req.body;
        const validation = await phase3Manager.developerSDK.validateApiKey(apiKey);
        
        res.json({
            success: true,
            data: validation,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK API Key Validation Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate API key via SDK',
            details: error.message
        });
    }
});

// Call model for inference via SDK  
app.post('/api/v3/sdk/models/:modelId/call', async (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { modelId } = req.params;
        const { input, options } = req.body;
        
        const result = await phase3Manager.developerSDK.callModel(modelId, input, options);
        
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Model Call Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to call model via SDK',
            details: error.message
        });
    }
});

// Vote on proposal via SDK
app.post('/api/v3/sdk/governance/proposals/:proposalId/vote', async (req, res) => {
    try {
        if (!phase3Manager || !phase3Manager.developerSDK) {
            return res.status(503).json({
                success: false,
                error: 'Developer SDK not available'
            });
        }
        
        const { proposalId } = req.params;
        const { choice } = req.body;
        
        const voteResult = await phase3Manager.developerSDK.vote(proposalId, choice);
        
        res.json({
            success: true,
            data: voteResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SDK Vote Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to vote via SDK',
            details: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        available_endpoints: [
            'GET /api/v3/status',
            'GET /api/v3/sdk/models',
            'GET /api/v3/sdk/models/:modelId',
            'POST /api/v3/sdk/models/:modelId/call',
            'GET /api/v3/sdk/governance/proposals',
            'POST /api/v3/sdk/governance/proposals/:proposalId/vote',
            'GET /api/v3/sdk/analytics/leaderboard',
            'GET /api/v3/sdk/analytics/leaderboard/:type',
            'GET /api/v3/sdk/analytics/users/:userId',
            'GET /api/v3/sdk/examples',
            'GET /api/v3/sdk/examples/:language',
            'GET /api/v3/sdk/enterprise/config',
            'POST /api/v3/sdk/validate-key'
        ]
    });
});