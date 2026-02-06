const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth: _auth, adminAuth } = require('../middleware/auth');

// Service instances (injected from main app)
const _nodeManager = null;
const _taskDispatcher = null;
const _tokenEngine = null;

// Getter functions for services (to be injected by main app)
let getNodeManager = () => _nodeManager;
const _getTaskDispatcher = () => _taskDispatcher;
const _getTokenEngine = () => _tokenEngine;

const router = express.Router();

/**
 * @route POST /api/nodes/register
 * @desc Register a new node with the coordinator
 * @access Public
 */
router.post('/register', [
  body('node_id').isString().notEmpty().withMessage('Node ID is required'),
  body('system_info').isObject().withMessage('System info is required'),
  body('supported_models').isArray().withMessage('Supported models must be an array'),
  body('max_vram_gb').isFloat({ min: 0 }).withMessage('Max VRAM must be a positive number'),
  body('max_cpu_cores').isInt({ min: 1 }).withMessage('Max CPU cores must be a positive integer'),
  body('capabilities').optional().isObject().withMessage('Capabilities must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      node_id,
      node_token,
      system_info,
      supported_models,
      max_vram_gb,
      max_cpu_cores,
      version,
      capabilities = {}
    } = req.body;

    // Get client info
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    };

    const nodeManager = getNodeManager();
    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const registrationResult = await nodeManager.registerNode({
      nodeId: node_id,
      token: node_token,
      systemInfo: system_info,
      supportedModels: supported_models,
      maxVramGb: max_vram_gb,
      maxCpuCores: max_cpu_cores,
      version,
      capabilities,
      clientInfo
    });

    if (registrationResult.success) {
      res.status(201).json({
        success: true,
        message: 'Node registered successfully',
        node: {
          id: registrationResult.node.id,
          status: registrationResult.node.status,
          rating: registrationResult.node.rating,
          token: registrationResult.token
        },
        config_updates: registrationResult.configUpdates || {}
      });
    } else {
      res.status(400).json({
        error: registrationResult.error || 'Registration failed'
      });
    }

  } catch (error) {
    console.error('Node registration error:', error);
    res.status(500).json({
      error: 'Failed to register node',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nodes/:id/heartbeat
 * @desc Process node heartbeat
 * @access Public
 */
router.post('/:id/heartbeat', [
  param('id').isString().notEmpty().withMessage('Node ID is required'),
  body('timestamp').isISO8601().withMessage('Valid timestamp is required'),
  body('status').isIn(['active', 'busy', 'maintenance']).withMessage('Invalid status'),
  body('current_task').optional().isString().withMessage('Current task must be a string'),
  body('uptime').isFloat({ min: 0 }).withMessage('Uptime must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const nodeId = req.params.id;
    const {
      timestamp,
      status,
      current_task,
      tasks_completed,
      uptime,
      metrics
    } = req.body;

    const nodeManager = getNodeManager();
    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const result = await nodeManager.processHeartbeat({
      nodeId,
      timestamp,
      status,
      currentTask: current_task,
      tasksCompleted: tasks_completed,
      uptime,
      metrics
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Heartbeat processed',
        commands: result.commands || [],
        config_updates: result.configUpdates || {}
      });
    } else {
      res.status(400).json({
        error: result.error || 'Heartbeat processing failed'
      });
    }

  } catch (error) {
    console.error('Heartbeat processing error:', error);
    res.status(500).json({
      error: 'Failed to process heartbeat',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nodes
 * @desc List active nodes with pagination and filtering
 * @access Public
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'busy', 'offline', 'maintenance']).withMessage('Invalid status'),
  query('model_type').optional().isString().withMessage('Model type must be a string'),
  query('min_rating').optional().isFloat({ min: 0, max: 1 }).withMessage('Min rating must be between 0 and 1')
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
      model_type,
      min_rating
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (model_type) filters.modelType = model_type;
    if (min_rating) filters.minRating = parseFloat(min_rating);

    const nodeManager = getNodeManager();
    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const result = await nodeManager.listNodes({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    res.json({
      success: true,
      nodes: result.nodes.map(node => ({
        id: node.id,
        status: node.status,
        rating: node.rating,
        supported_models: node.supportedModels,
        max_vram_gb: node.maxVramGb,
        max_cpu_cores: node.maxCpuCores,
        current_task: node.currentTask,
        tasks_completed: node.tasksCompleted,
        uptime: node.uptime,
        last_seen: node.lastSeen,
        version: node.version,
        location: node.location
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: result.pages
      }
    });

  } catch (error) {
    console.error('List nodes error:', error);
    res.status(500).json({
      error: 'Failed to list nodes',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nodes/:id
 * @desc Get detailed node information
 * @access Public
 */
router.get('/:id', [
  param('id').isString().notEmpty().withMessage('Node ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid node ID',
        details: errors.array()
      });
    }

    const nodeId = req.params.id;
    const nodeManager = getNodeManager();
    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const node = await nodeManager.getNode(nodeId);

    if (!node) {
      return res.status(404).json({
        error: 'Node not found'
      });
    }

    res.json({
      success: true,
      node: {
        id: node.id,
        status: node.status,
        rating: node.rating,
        system_info: node.systemInfo,
        supported_models: node.supportedModels,
        max_vram_gb: node.maxVramGb,
        max_cpu_cores: node.maxCpuCores,
        capabilities: node.capabilities,
        current_task: node.currentTask,
        tasks_completed: node.tasksCompleted,
        tasks_failed: node.tasksFailed,
        success_rate: node.successRate,
        uptime: node.uptime,
        registered_at: node.registeredAt,
        last_seen: node.lastSeen,
        version: node.version,
        location: node.location,
        performance_metrics: node.performanceMetrics
      }
    });

  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({
      error: 'Failed to get node information',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nodes/:id/metrics
 * @desc Get node performance metrics
 * @access Public
 */
router.get('/:id/metrics', [
  param('id').isString().notEmpty().withMessage('Node ID is required'),
  query('period').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period'),
  query('metric').optional().isString().withMessage('Metric must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: errors.array()
      });
    }

    const nodeId = req.params.id;
    const { period = '24h', metric } = req.query;
    const nodeManager = getNodeManager();

    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const metrics = await nodeManager.getNodeMetrics(nodeId, { period, metric });

    if (!metrics) {
      return res.status(404).json({
        error: 'Node not found or no metrics available'
      });
    }

    res.json({
      success: true,
      node_id: nodeId,
      period,
      metrics: metrics
    });

  } catch (error) {
    console.error('Get node metrics error:', error);
    res.status(500).json({
      error: 'Failed to get node metrics',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nodes/:id/command
 * @desc Send command to a node
 * @access Private (Admin only)
 */
router.post('/:id/command', adminAuth, [
  param('id').isString().notEmpty().withMessage('Node ID is required'),
  body('command').isIn(['restart', 'update_config', 'clear_cache', 'maintenance']).withMessage('Invalid command'),
  body('parameters').optional().isObject().withMessage('Parameters must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const nodeId = req.params.id;
    const { command, parameters = {} } = req.body;
    const nodeManager = getNodeManager();

    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const result = await nodeManager.sendCommand(nodeId, command, parameters);

    if (result.success) {
      res.json({
        success: true,
        message: `Command ${command} sent to node`,
        command_id: result.commandId
      });
    } else {
      res.status(400).json({
        error: result.error || 'Failed to send command'
      });
    }

  } catch (error) {
    console.error('Send command error:', error);
    res.status(500).json({
      error: 'Failed to send command',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/nodes/:id
 * @desc Deregister a node
 * @access Private (Admin or Node itself)
 */
router.delete('/:id', [
  param('id').isString().notEmpty().withMessage('Node ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid node ID',
        details: errors.array()
      });
    }

    const nodeId = req.params.id;

    // TODO: Add authentication check - only admin or the node itself can deregister
    const nodeManager = getNodeManager();

    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const result = await nodeManager.deregisterNode(nodeId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Node deregistered successfully'
      });
    } else {
      res.status(404).json({
        error: result.error || 'Node not found'
      });
    }

  } catch (error) {
    console.error('Deregister node error:', error);
    res.status(500).json({
      error: 'Failed to deregister node',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nodes/stats
 * @desc Get network statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const nodeManager = getNodeManager();
    if (!nodeManager) {
      return res.status(503).json({
        success: false,
        error: 'Node service not available'
      });
    }
    const stats = await nodeManager.getNetworkStats();

    res.json({
      success: true,
      stats: {
        total_nodes: stats.totalNodes,
        active_nodes: stats.activeNodes,
        busy_nodes: stats.busyNodes,
        offline_nodes: stats.offlineNodes,
        total_vram_gb: stats.totalVramGb,
        available_vram_gb: stats.availableVramGb,
        total_cpu_cores: stats.totalCpuCores,
        available_cpu_cores: stats.availableCpuCores,
        average_rating: stats.averageRating,
        geographic_distribution: stats.geographicDistribution,
        model_support: stats.modelSupport,
        network_capacity: stats.networkCapacity
      }
    });

  } catch (error) {
    console.error('Get network stats error:', error);
    res.status(500).json({
      error: 'Failed to get network statistics',
      message: error.message
    });
  }
});

// Initialize services
const initializeServices = (services) => {
  getNodeManager = () => services.nodeManager;
  // _getTaskDispatcher and _getTokenEngine are reserved for future use
};

module.exports = { router, initializeServices };
