/**
 * AI Models API Routes
 * Handles all AI model-related API endpoints for the coordinator server
 */

const express = require('express');
const { ModelRegistryManager } = require('../models/ModelRegistry');
const { ModelManager } = require('../models/ModelManager');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const router = express.Router();
const modelManager = new ModelManager();
const modelRegistry = ModelRegistryManager.getInstance();

// Configure multer for file uploads (audio files)
const upload = multer({
    dest: 'temp/',
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/ogg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    }
});

// Model Registry Routes

/**
 * GET /api/models/registry
 * Get all available models from registry
 */
router.get('/registry', async (req, res) => {
    try {
        const filters = {
            type: req.query.type,
            framework: req.query.framework,
            gpu_required: req.query.gpu_required === 'true' ? true : req.query.gpu_required === 'false' ? false : undefined,
            max_size_gb: req.query.max_size_gb ? parseFloat(req.query.max_size_gb) : undefined,
            max_memory_gb: req.query.max_memory_gb ? parseFloat(req.query.max_memory_gb) : undefined,
            commercial_use: req.query.commercial_use === 'true' ? true : req.query.commercial_use === 'false' ? false : undefined
        };

        // Remove undefined values
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

        const models = modelRegistry.getModels(filters);
        
        res.json({
            success: true,
            models,
            total: models.length,
            filters: filters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/models/registry/:modelId
 * Get specific model from registry
 */
router.get('/registry/:modelId', async (req, res) => {
    try {
        const model = modelRegistry.getModel(req.params.modelId);
        
        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        res.json({
            success: true,
            model
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/models/registry/:modelId/compatible-nodes
 * Get nodes compatible with a specific model
 */
router.get('/registry/:modelId/compatible-nodes', async (req, res) => {
    try {
        const model = modelRegistry.getModel(req.params.modelId);
        
        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        // In a real implementation, this would check actual node capabilities
        const mockNodeCapabilities = [
            {
                node_id: 'node-1',
                total_memory_gb: 32,
                gpu_memory_gb: 16,
                has_gpu: true,
                gpu_compute_capability: '8.6'
            },
            {
                node_id: 'node-2',
                total_memory_gb: 64,
                gpu_memory_gb: 24,
                has_gpu: true,
                gpu_compute_capability: '8.0'
            },
            {
                node_id: 'node-3',
                total_memory_gb: 16,
                gpu_memory_gb: 0,
                has_gpu: false,
                gpu_compute_capability: null
            }
        ];

        const compatibleNodes = mockNodeCapabilities.filter(node => {
            const compatibleModels = modelRegistry.getCompatibleModels(node);
            return compatibleModels.some(m => m.id === req.params.modelId);
        });

        res.json({
            success: true,
            model_id: req.params.modelId,
            compatible_nodes: compatibleNodes,
            total_compatible: compatibleNodes.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/models/registry/stats
 * Get model registry statistics
 */
router.get('/registry/stats', async (req, res) => {
    try {
        const stats = modelRegistry.getRequirementsSummary();
        const popularModels = modelRegistry.getPopularModels(10);

        res.json({
            success: true,
            registry_stats: stats,
            popular_models: popularModels
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/models/registry/search
 * Search models in registry
 */
router.post('/registry/search', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        const results = modelRegistry.searchModels(query);

        res.json({
            success: true,
            query,
            results,
            total: results.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Model Management Routes

/**
 * POST /api/models/load
 * Load a model on a specific node
 */
router.post('/load', async (req, res) => {
    try {
        const { model_id, node_id, options = {} } = req.body;

        if (!model_id || !node_id) {
            return res.status(400).json({
                success: false,
                error: 'model_id and node_id are required'
            });
        }

        const result = await modelManager.loadModel(model_id, node_id, options);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/models/unload
 * Unload a model from a specific node
 */
router.post('/unload', async (req, res) => {
    try {
        const { model_id, node_id } = req.body;

        if (!model_id || !node_id) {
            return res.status(400).json({
                success: false,
                error: 'model_id and node_id are required'
            });
        }

        const result = await modelManager.unloadModel(model_id, node_id);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/models/loaded
 * Get all loaded models
 */
router.get('/loaded', async (req, res) => {
    try {
        const nodeId = req.query.node_id;
        
        let models;
        if (nodeId) {
            models = modelManager.getNodeModels(nodeId);
        } else {
            models = modelManager.getAllLoadedModels();
        }

        res.json({
            success: true,
            models,
            total: models.length,
            node_id: nodeId || 'all'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/models/stats
 * Get model management system statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = modelManager.getSystemStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// AI Inference Routes

/**
 * POST /api/models/inference/text
 * Generate text using LLaMA models
 */
router.post('/inference/text', async (req, res) => {
    try {
        const { 
            model_id, 
            node_id, 
            prompt, 
            max_tokens = 256,
            temperature = 0.7,
            top_p = 0.9,
            stream = false 
        } = req.body;

        if (!model_id || !node_id || !prompt) {
            return res.status(400).json({
                success: false,
                error: 'model_id, node_id, and prompt are required'
            });
        }

        const input = {
            prompt,
            max_tokens,
            temperature,
            top_p
        };

        if (stream) {
            // Set up streaming response
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // Simulate streaming (in real implementation, this would stream from Python model)
            const words = `Generated response for: "${prompt.substring(0, 50)}..."`.split(' ');
            
            for (let i = 0; i < words.length; i++) {
                const chunk = {
                    success: true,
                    chunk: words[i] + ' ',
                    finished: i === words.length - 1
                };
                
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            res.end();
        } else {
            const result = await modelManager.executeInference(model_id, node_id, input);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/models/inference/image
 * Generate images using Stable Diffusion models
 */
router.post('/inference/image', async (req, res) => {
    try {
        const { 
            model_id, 
            node_id, 
            prompt,
            negative_prompt,
            width = 512,
            height = 512,
            num_inference_steps = 20,
            guidance_scale = 7.5,
            seed,
            num_images = 1
        } = req.body;

        if (!model_id || !node_id || !prompt) {
            return res.status(400).json({
                success: false,
                error: 'model_id, node_id, and prompt are required'
            });
        }

        const input = {
            prompt,
            negative_prompt,
            width,
            height,
            num_inference_steps,
            guidance_scale,
            seed,
            num_images
        };

        const result = await modelManager.executeInference(model_id, node_id, input);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/models/inference/audio
 * Transcribe audio using Whisper models
 */
router.post('/inference/audio', upload.single('audio'), async (req, res) => {
    try {
        const { 
            model_id, 
            node_id, 
            language,
            task = 'transcribe',
            return_segments = true,
            return_word_timestamps = false
        } = req.body;

        if (!model_id || !node_id) {
            return res.status(400).json({
                success: false,
                error: 'model_id and node_id are required'
            });
        }

        let audioPath = null;
        if (req.file) {
            audioPath = req.file.path;
        } else if (req.body.audio_base64) {
            audioPath = req.body.audio_base64;
        } else {
            return res.status(400).json({
                success: false,
                error: 'Audio file or base64 data is required'
            });
        }

        const input = {
            audio_path: audioPath,
            language,
            task,
            return_segments: return_segments === 'true',
            return_word_timestamps: return_word_timestamps === 'true'
        };

        try {
            const result = await modelManager.executeInference(model_id, node_id, input);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }
        } finally {
            // Clean up uploaded file
            if (req.file) {
                try {
                    await fs.unlink(req.file.path);
                } catch (cleanupError) {
                    console.warn('Failed to clean up uploaded file:', cleanupError.message);
                }
            }
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/models/inference/batch
 * Execute batch inference requests
 */
router.post('/inference/batch', async (req, res) => {
    try {
        const { requests } = req.body;

        if (!requests || !Array.isArray(requests)) {
            return res.status(400).json({
                success: false,
                error: 'requests array is required'
            });
        }

        const results = [];
        const errors = [];

        // Process requests sequentially (in production, consider parallel processing with limits)
        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            const { model_id, node_id, input, request_id } = request;

            if (!model_id || !node_id || !input) {
                errors.push({
                    request_id: request_id || i,
                    error: 'model_id, node_id, and input are required'
                });
                continue;
            }

            try {
                const result = await modelManager.executeInference(model_id, node_id, input);
                results.push({
                    request_id: request_id || i,
                    ...result
                });
            } catch (error) {
                errors.push({
                    request_id: request_id || i,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            results,
            errors,
            total_requests: requests.length,
            successful_requests: results.length,
            failed_requests: errors.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Model Health and Monitoring Routes

/**
 * GET /api/models/health
 * Get health status of all loaded models
 */
router.get('/health', async (req, res) => {
    try {
        const loadedModels = modelManager.getAllLoadedModels();
        const healthStatus = [];

        for (const model of loadedModels) {
            const health = {
                model_id: model.id,
                node_id: model.node_id,
                status: model.status,
                uptime_ms: model.uptime_ms,
                memory_usage_mb: model.memory_usage_mb,
                request_count: model.request_count,
                error_count: model.error_count,
                error_rate: model.request_count > 0 ? model.error_count / model.request_count : 0,
                average_inference_time: model.average_inference_time,
                active_requests: model.active_requests,
                health_score: model.error_count === 0 && model.status === 'ready' ? 100 : 
                             model.error_count / Math.max(model.request_count, 1) < 0.1 ? 80 : 50
            };

            healthStatus.push(health);
        }

        res.json({
            success: true,
            health_status: healthStatus,
            total_models: healthStatus.length,
            healthy_models: healthStatus.filter(h => h.health_score >= 80).length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/models/metrics
 * Get detailed metrics for loaded models
 */
router.get('/metrics', async (req, res) => {
    try {
        const systemStats = modelManager.getSystemStats();
        const loadedModels = modelManager.getAllLoadedModels();

        const metrics = {
            system: systemStats,
            models: loadedModels.map(model => ({
                id: model.id,
                name: model.name,
                type: model.type,
                node_id: model.node_id,
                status: model.status,
                uptime_ms: model.uptime_ms,
                memory_usage_mb: model.memory_usage_mb,
                gpu_memory_mb: model.gpu_memory_mb,
                request_count: model.request_count,
                error_count: model.error_count,
                average_inference_time: model.average_inference_time,
                active_requests: model.active_requests
            })),
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 100MB.'
            });
        }
    }
    
    console.error('AI Models API Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

module.exports = router;