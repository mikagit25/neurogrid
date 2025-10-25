const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Service instances (injected from main app)
let taskDispatcher = null;
let nodeManager = null;
let tokenEngine = null;

const router = express.Router();

// Rate limiting for task submission
const taskSubmissionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 tasks per minute per IP
  message: { error: 'Too many task submissions, please try again later' }
});

// Task submission validation
const validateTaskSubmission = [
  body('model').isString().notEmpty().withMessage('Model is required'),
  body('input').notEmpty().withMessage('Input data is required'),
  body('priority').optional().isIn(['low', 'standard', 'high', 'critical']).withMessage('Invalid priority'),
  body('timeout').optional().isInt({ min: 60, max: 3600 }).withMessage('Timeout must be between 60 and 3600 seconds'),
  body('parameters').optional().isObject().withMessage('Parameters must be an object')
];

/**
 * @route POST /api/tasks
 * @desc Submit a new inference task
 * @access Public (with rate limiting)
 */
router.post('/', taskSubmissionLimit, validateTaskSubmission, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      model,
      input,
      priority = 'standard',
      timeout = 300,
      parameters = {},
      callback_url
    } = req.body;

    // Get client info from request
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id, // If authenticated
      requestId: req.requestId
    };

    // Submit task to dispatcher
    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }

    const task = await taskDispatcher.addTask({
      model,
      input,
      priority,
      timeout,
      parameters,
      callback_url,
      clientInfo
    });

    res.status(201).json({
      success: true,
      task: {
        id: task.id,
        status: task.status,
        model: task.model,
        priority: task.priority,
        estimated_completion: task.estimatedCompletion,
        created_at: task.createdAt
      }
    });

  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({
      error: 'Failed to submit task',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tasks/:id
 * @desc Get task status and details
 * @access Public
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid task ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: errors.array()
      });
    }

    const taskId = req.params.id;
    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }
    const task = await taskDispatcher.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        status: task.status,
        model: task.model,
        priority: task.priority,
        progress: task.progress || 0,
        created_at: task.createdAt,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        node_id: task.nodeId,
        estimated_completion: task.estimatedCompletion,
        error: task.error
      }
    });

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      error: 'Failed to get task status',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tasks/:id/result
 * @desc Get task execution result
 * @access Public
 */
router.get('/:id/result', [
  param('id').isUUID().withMessage('Invalid task ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: errors.array()
      });
    }

    const taskId = req.params.id;
    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }
    const result = await taskDispatcher.getTaskResult(taskId);

    if (!result) {
      return res.status(404).json({
        error: 'Task result not found'
      });
    }

    if (result.status !== 'completed') {
      return res.status(202).json({
        error: 'Task not completed yet',
        status: result.status,
        progress: result.progress || 0
      });
    }

    res.json({
      success: true,
      result: {
        id: result.id,
        status: result.status,
        output: result.output,
        metadata: result.metadata,
        execution_time: result.executionTime,
        completed_at: result.completedAt,
        node_id: result.nodeId
      }
    });

  } catch (error) {
    console.error('Get task result error:', error);
    res.status(500).json({
      error: 'Failed to get task result',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/tasks/:id
 * @desc Cancel a task
 * @access Public
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid task ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: errors.array()
      });
    }

    const taskId = req.params.id;
    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }
    const cancelled = await taskDispatcher.cancelTask(taskId);

    if (!cancelled) {
      return res.status(404).json({
        error: 'Task not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Task cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel task error:', error);
    res.status(500).json({
      error: 'Failed to cancel task',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tasks
 * @desc List tasks with pagination and filtering
 * @access Public
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
  query('model').optional().isString().withMessage('Model must be a string'),
  query('priority').optional().isIn(['low', 'standard', 'high', 'critical']).withMessage('Invalid priority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      model,
      priority,
      user_id
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (model) filters.model = model;
    if (priority) filters.priority = priority;
    if (user_id) filters.userId = user_id;

    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }
    const result = await taskDispatcher.listTasks({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    res.json({
      success: true,
      tasks: result.tasks.map(task => ({
        id: task.id,
        status: task.status,
        model: task.model,
        priority: task.priority,
        progress: task.progress || 0,
        created_at: task.createdAt,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        execution_time: task.executionTime
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: result.pages
      }
    });

  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({
      error: 'Failed to list tasks',
      message: error.message
    });
  }
});

/**
 * @route POST /api/tasks/:id/retry
 * @desc Retry a failed task
 * @access Public
 */
router.post('/:id/retry', [
  param('id').isUUID().withMessage('Invalid task ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: errors.array()
      });
    }

    const taskId = req.params.id;
    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }
    const retried = await taskDispatcher.retryTask(taskId);

    if (!retried) {
      return res.status(404).json({
        error: 'Task not found or cannot be retried'
      });
    }

    res.json({
      success: true,
      message: 'Task queued for retry',
      task: {
        id: retried.id,
        status: retried.status,
        retry_count: retried.retryCount
      }
    });

  } catch (error) {
    console.error('Retry task error:', error);
    res.status(500).json({
      error: 'Failed to retry task',
      message: error.message
    });
  }
});

/**
 * @route GET /api/tasks/stats
 * @desc Get task execution statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    if (!taskDispatcher) {
      return res.status(503).json({
        success: false,
        error: 'Task service not available'
      });
    }
    const stats = taskDispatcher.getStats();

    res.json({
      success: true,
      stats: {
        total_tasks: stats.totalTasks,
        completed_tasks: stats.completedTasks,
        failed_tasks: stats.failedTasks,
        pending_tasks: stats.pendingTasks,
        average_execution_time: stats.averageExecutionTime,
        success_rate: stats.successRate,
        active_nodes: stats.activeNodes,
        queue_length: stats.queueLength,
        models: stats.modelStats
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

// Initialize services
const initializeServices = (services) => {
  taskDispatcher = services.taskDispatcher;
  nodeManager = services.nodeManager;
  tokenEngine = services.tokenEngine;
};

module.exports = { router, initializeServices };
