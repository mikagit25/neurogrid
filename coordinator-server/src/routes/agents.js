const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const MultiAgentCoordinator = require('../../services/MultiAgentCoordinator');

// Initialize multi-agent coordinator
const agentCoordinator = new MultiAgentCoordinator({
  maxConcurrentAgents: 10,
  taskTimeout: 600000 // 10 minutes
});

/**
 * @route POST /api/agents/swarm-task
 * @desc Execute complex task using agent swarm
 * @access Protected
 */
router.post('/swarm-task', async (req, res) => {
  try {
    const {
      description,
      type,
      requirements = {},
      priority = 3,
      userId
    } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Task description is required'
      });
    }

    const taskData = {
      description,
      type: type || 'general',
      requirements,
      priority,
      userId: userId || req.user?.id,
      complexity: calculateComplexity(description, requirements)
    };

    logger.info(`Starting swarm task for user ${taskData.userId}:`, {
      description: description.substring(0, 100),
      type,
      complexity: taskData.complexity
    });

    const result = await agentCoordinator.processSwarmTask(taskData);

    res.json({
      success: result.success,
      data: result.success ? {
        taskId: result.taskId,
        result: result.result,
        metadata: result.metadata
      } : null,
      error: result.success ? null : result.error
    });

  } catch (error) {
    logger.error('Swarm task execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute swarm task'
    });
  }
});

/**
 * @route GET /api/agents/types
 * @desc Get available agent types and capabilities
 * @access Public
 */
router.get('/types', (req, res) => {
  try {
    const agentTypes = agentCoordinator.agentTypes;
    
    // Format agent types for public consumption
    const publicAgentTypes = Object.entries(agentTypes).map(([key, config]) => ({
      id: key,
      name: config.name,
      specialization: config.specialization,
      capabilities: config.capabilities,
      model: config.model
    }));

    res.json({
      success: true,
      data: {
        agentTypes: publicAgentTypes,
        totalAgents: publicAgentTypes.length
      }
    });

  } catch (error) {
    logger.error('Error fetching agent types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent types'
    });
  }
});

/**
 * @route GET /api/agents/stats
 * @desc Get agent swarm statistics
 * @access Protected
 */
router.get('/stats', (req, res) => {
  try {
    const stats = agentCoordinator.getSwarmStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching swarm stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swarm statistics'
    });
  }
});

/**
 * @route GET /api/agents/task/:taskId
 * @desc Get task result by ID
 * @access Protected
 */
router.get('/task/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const result = agentCoordinator.results.get(taskId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Error fetching task ${req.params.taskId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch task result'
    });
  }
});

/**
 * @route POST /api/agents/test-coordination
 * @desc Test agent coordination with sample task
 * @access Protected (admin only)
 */
router.post('/test-coordination', async (req, res) => {
  try {
    const testTask = {
      description: "Create a comprehensive business plan for an AI startup, including market analysis, technical architecture, and financial projections",
      type: "business_planning",
      requirements: {
        includeCode: true,
        includeAnalytics: true,
        includeVisuals: false
      },
      priority: 4,
      userId: 'test_user'
    };

    const result = await agentCoordinator.processSwarmTask(testTask);

    res.json({
      success: true,
      data: {
        testResult: result,
        message: 'Coordination test completed'
      }
    });

  } catch (error) {
    logger.error('Coordination test error:', error);
    res.status(500).json({
      success: false,
      error: 'Coordination test failed'
    });
  }
});

/**
 * @route GET /api/agents/examples
 * @desc Get example tasks for different agent types
 * @access Public
 */
router.get('/examples', (req, res) => {
  try {
    const examples = {
      textAgent: [
        "Write a technical blog post about machine learning",
        "Summarize this research paper",
        "Translate content to multiple languages",
        "Create marketing copy for a product"
      ],
      codeAgent: [
        "Build a REST API for user management",
        "Debug this Python script",
        "Review code for security issues", 
        "Generate unit tests for existing functions"
      ],
      dataAgent: [
        "Analyze sales data and provide insights",
        "Create statistical summary of dataset",
        "Identify trends in user behavior",
        "Generate data visualization recommendations"
      ],
      imageAgent: [
        "Create logo designs for a tech startup",
        "Generate product mockups",
        "Design marketing banners",
        "Create illustrations for documentation"
      ],
      swarmTasks: [
        "Build a complete web application with documentation",
        "Create a comprehensive research report with visuals",
        "Develop a business strategy with technical implementation plan",
        "Design and analyze a marketing campaign with metrics"
      ]
    };

    res.json({
      success: true,
      data: examples
    });

  } catch (error) {
    logger.error('Error fetching examples:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch examples'
    });
  }
});

/**
 * @route POST /api/agents/cancel-task/:taskId
 * @desc Cancel running task
 * @access Protected
 */
router.post('/cancel-task/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    
    // Cancel task (implementation depends on task state management)
    agentCoordinator.cleanupTask(taskId);
    
    res.json({
      success: true,
      message: `Task ${taskId} cancellation requested`
    });

  } catch (error) {
    logger.error(`Error cancelling task ${req.params.taskId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel task'
    });
  }
});

/**
 * Helper function to calculate task complexity
 */
function calculateComplexity(description, requirements) {
  let complexity = 1; // Base complexity
  
  // Length factor
  if (description.length > 200) complexity += 1;
  if (description.length > 500) complexity += 1;
  
  // Requirements factor
  const reqCount = Object.keys(requirements).length;
  complexity += Math.floor(reqCount / 2);
  
  // Keyword complexity indicators
  const complexKeywords = [
    'analyze', 'comprehensive', 'detailed', 'complete', 'full',
    'advanced', 'complex', 'multiple', 'integration', 'system'
  ];
  
  const hasComplexKeywords = complexKeywords.some(keyword => 
    description.toLowerCase().includes(keyword)
  );
  
  if (hasComplexKeywords) complexity += 1;
  
  return Math.min(5, complexity); // Cap at 5
}

module.exports = router;