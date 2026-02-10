/**
 * AI Integration Test Routes
 * Test endpoints for real AI functionality
 */

const express = require('express');
const { authenticate } = require('../security/middleware');
const aiIntegrationService = require('../services/AIIntegrationService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/ai/test:
 *   post:
 *     summary: Test AI integration with real models
 *     description: Test the AI integration service with different model types
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: AI model to test
 *                 default: "huggingface:gpt2"
 *               task_type:
 *                 type: string
 *                 enum: [inference, generation, embedding]
 *                 default: "generation"
 *               input:
 *                 type: object
 *                 properties:
 *                   prompt:
 *                     type: string
 *                     default: "Hello, this is a test of the AI system"
 *                   type:
 *                     type: string
 *                     default: "text"
 *               parameters:
 *                 type: object
 *                 properties:
 *                   max_new_tokens:
 *                     type: integer
 *                     default: 50
 *                   temperature:
 *                     type: number
 *                     default: 0.7
 *     responses:
 *       200:
 *         description: AI test completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: object
 *                 metadata:
 *                   type: object
 *                 execution_time:
 *                   type: number
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const {
      model = 'huggingface:gpt2',
      task_type = 'generation',
      input = { prompt: 'Hello, this is a test', type: 'text' },
      parameters = { max_new_tokens: 50, temperature: 0.7 }
    } = req.body;

    const testTask = {
      id: `test-${Date.now()}`,
      type: task_type,
      model: model,
      input_data: input,
      parameters: parameters,
      user_id: req.user.id
    };

    logger.info(`🧪 Testing AI integration with model: ${model}`);

    const result = await aiIntegrationService.executeTask(testTask);

    res.json({
      success: true,
      data: {
        task: testTask,
        result: result.output,
        metadata: result.metadata,
        cost: result.cost,
        execution_time: result.metadata.execution_time,
        provider_type: result.metadata.provider_type
      },
      message: 'AI test completed successfully'
    });

  } catch (error) {
    logger.error('❌ AI test failed:', error);
    res.status(500).json({
      success: false,
      error: 'AI_TEST_FAILED',
      message: error.message,
      details: {
        error_type: error.constructor.name,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @swagger
 * /api/ai/models:
 *   get:
 *     summary: Get available AI models
 *     description: List all available AI models and their capabilities
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available AI models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/models', authenticate, async (req, res) => {
  try {
    const models = aiIntegrationService.getAvailableModels();

    res.json({
      success: true,
      data: {
        models: models,
        count: models.length,
        providers: [...new Set(models.map(m => m.id.split(':')[0]))],
        capabilities: {
          text_generation: models.filter(m => m.capabilities?.text_generation).length,
          image_generation: models.filter(m => m.capabilities?.image_generation).length,
          text_classification: models.filter(m => m.capabilities?.text_classification).length
        }
      },
      message: 'Available AI models retrieved successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to get AI models:', error);
    res.status(500).json({
      success: false,
      error: 'GET_MODELS_FAILED',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/ai/status:
 *   get:
 *     summary: Get AI integration status
 *     description: Get current status and metrics of the AI integration service
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI integration status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const metrics = aiIntegrationService.getMetrics();
    const connectionTest = await aiIntegrationService.testConnection();

    res.json({
      success: true,
      data: {
        status: connectionTest.status,
        connection_message: connectionTest.message,
        metrics: metrics,
        environment: {
          has_huggingface_key: !!process.env.HUGGINGFACE_API_KEY,
          has_openai_key: !!process.env.OPENAI_API_KEY,
          has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
          node_env: process.env.NODE_ENV
        }
      },
      message: 'AI integration status retrieved successfully'
    });

  } catch (error) {
    logger.error('❌ Failed to get AI status:', error);
    res.status(500).json({
      success: false,
      error: 'GET_STATUS_FAILED',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/ai/generation:
 *   post:
 *     summary: Generate content using AI models
 *     description: Generate text or images using available AI models
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: AI model for generation
 *               prompt:
 *                 type: string
 *                 description: Generation prompt
 *               type:
 *                 type: string
 *                 enum: [text, image]
 *               parameters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Content generated successfully
 */
router.post('/generation', authenticate, async (req, res) => {
  try {
    const {
      model = 'huggingface:gpt2',
      prompt,
      type = 'text',
      parameters = {}
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PROMPT',
        message: 'Prompt is required for content generation'
      });
    }

    const generationTask = {
      id: `gen-${Date.now()}`,
      type: 'generation',
      model: model,
      input_data: {
        prompt: prompt,
        type: type,
        modality: type
      },
      parameters: parameters,
      user_id: req.user.id
    };

    logger.info(`🎨 Generating ${type} content with model: ${model}`);

    const result = await aiIntegrationService.executeTask(generationTask);

    res.json({
      success: true,
      data: {
        generated_content: result.output,
        metadata: result.metadata,
        cost: result.cost,
        model_used: model,
        generation_type: type
      },
      message: `${type} generation completed successfully`
    });

  } catch (error) {
    logger.error('❌ Content generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'GENERATION_FAILED',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/ai/embeddings:
 *   post:
 *     summary: Generate text embeddings
 *     description: Generate vector embeddings from text using AI models
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 default: "huggingface:sentence-transformers/all-MiniLM-L6-v2"
 *               text:
 *                 type: string
 *                 description: Text to embed
 *     responses:
 *       200:
 *         description: Embeddings generated successfully
 */
router.post('/embeddings', authenticate, async (req, res) => {
  try {
    const {
      model = 'huggingface:sentence-transformers/all-MiniLM-L6-v2',
      text
    } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TEXT',
        message: 'Text is required for embedding generation'
      });
    }

    const embeddingTask = {
      id: `embed-${Date.now()}`,
      type: 'embedding',
      model: model,
      input_data: { text: text },
      user_id: req.user.id
    };

    logger.info(`📊 Generating embeddings for text with model: ${model}`);

    const result = await aiIntegrationService.executeTask(embeddingTask);

    res.json({
      success: true,
      data: {
        embeddings: result.output.embeddings,
        dimensions: result.output.embeddings ? result.output.embeddings.length : 0,
        input_text: text,
        metadata: result.metadata,
        cost: result.cost
      },
      message: 'Text embeddings generated successfully'
    });

  } catch (error) {
    logger.error('❌ Embedding generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'EMBEDDING_FAILED',
      message: error.message
    });
  }
});

module.exports = router;
