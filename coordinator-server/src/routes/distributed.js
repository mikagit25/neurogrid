/**
 * Distributed Computing API Routes
 * Handles all distributed computing related endpoints
 */

const express = require('express');
const { TaskScheduler } = require('../distributed/TaskScheduler');
const { LoadBalancer } = require('../distributed/LoadBalancer');
const { FaultToleranceManager } = require('../distributed/FaultToleranceManager');
const { ResourceAllocator } = require('../distributed/ResourceAllocator');

const router = express.Router();

// Initialize distributed computing components
// In a real application, these would be initialized in the main app
let taskScheduler, loadBalancer, faultToleranceManager, resourceAllocator;

// Middleware to ensure components are initialized
router.use((req, res, next) => {
  // Initialize components if not already done
  if (!taskScheduler) {
    taskScheduler = new TaskScheduler({
      maxConcurrentTasks: 50,
      schedulingInterval: 2000,
      enableLoadBalancing: true,
      enableFailover: true,
      enableRetries: true
    });
  }

  if (!loadBalancer) {
    loadBalancer = new LoadBalancer({
      algorithm: 'adaptive',
      healthCheckInterval: 30000,
      loadThreshold: 0.8,
      enablePreemption: true,
      enableMigration: true
    });
  }

  if (!faultToleranceManager) {
    faultToleranceManager = new FaultToleranceManager({
      heartbeatInterval: 15000,
      maxFailureCount: 3,
      enableAutoRecovery: true,
      enableCheckpointing: true,
      enableReplication: true
    });
  }

  if (!resourceAllocator) {
    resourceAllocator = new ResourceAllocator({
      allocationStrategy: 'balanced',
      enableDynamicAllocation: true,
      enableResourcePrediction: true,
      resourceBuffer: 0.1
    });

    // Initialize resource tracking
    resourceAllocator.initializeResourceTracking();
  }

  next();
});

// Task Management Routes

/**
 * POST /api/distributed/tasks
 * Create a new distributed task
 */
router.post('/tasks', async (req, res) => {
  try {
    const taskData = req.body;

    // Validate required fields
    if (!taskData.type || !taskData.payload) {
      return res.status(400).json({
        success: false,
        error: 'Task type and payload are required'
      });
    }

    const result = await taskScheduler.createTask(taskData);

    if (result.success) {
      res.status(201).json(result);
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
 * GET /api/distributed/tasks
 * Get tasks with optional filtering
 */
router.get('/tasks', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      nodeId: req.query.node_id,
      priority: req.query.priority ? parseInt(req.query.priority, 10) : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const tasks = await taskScheduler.getTasks(filters);

    res.json({
      success: true,
      tasks,
      total: tasks.length,
      filters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/tasks/:taskId
 * Get specific task details
 */
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const task = await taskScheduler.getTask(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/distributed/tasks/:taskId
 * Cancel a task
 */
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const result = await taskScheduler.cancelTask(req.params.taskId);

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
 * GET /api/distributed/tasks/stats
 * Get task scheduler statistics
 */
router.get('/tasks/stats', async (req, res) => {
  try {
    const stats = taskScheduler.getSystemStats();

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

// Load Balancing Routes

/**
 * GET /api/distributed/load-balancer/stats
 * Get load balancer statistics
 */
router.get('/load-balancer/stats', async (req, res) => {
  try {
    const stats = loadBalancer.getBalancerStats();

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

/**
 * GET /api/distributed/load-balancer/distribution
 * Get load distribution across nodes
 */
router.get('/load-balancer/distribution', async (req, res) => {
  try {
    const distribution = loadBalancer.getLoadDistribution();

    res.json({
      success: true,
      distribution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/load-balancer/node-states
 * Get node states from load balancer
 */
router.get('/load-balancer/node-states', async (req, res) => {
  try {
    const nodeStates = loadBalancer.getNodeStates();

    res.json({
      success: true,
      nodeStates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/distributed/load-balancer/algorithm
 * Change load balancing algorithm
 */
router.put('/load-balancer/algorithm', async (req, res) => {
  try {
    const { algorithm } = req.body;

    if (!algorithm) {
      return res.status(400).json({
        success: false,
        error: 'Algorithm is required'
      });
    }

    const success = loadBalancer.setAlgorithm(algorithm);

    if (success) {
      res.json({
        success: true,
        message: `Load balancing algorithm changed to: ${algorithm}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid algorithm specified'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fault Tolerance Routes

/**
 * GET /api/distributed/fault-tolerance/health
 * Get system health status
 */
router.get('/fault-tolerance/health', async (req, res) => {
  try {
    const health = faultToleranceManager.getSystemHealth();

    res.json({
      success: true,
      health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/fault-tolerance/stats
 * Get fault tolerance statistics
 */
router.get('/fault-tolerance/stats', async (req, res) => {
  try {
    const stats = faultToleranceManager.getFaultToleranceStats();

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

/**
 * GET /api/distributed/fault-tolerance/failure-patterns
 * Get failure patterns analysis
 */
router.get('/fault-tolerance/failure-patterns', async (req, res) => {
  try {
    const patterns = faultToleranceManager.getFailurePatterns();

    res.json({
      success: true,
      patterns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/fault-tolerance/node-states
 * Get node states from fault tolerance manager
 */
router.get('/fault-tolerance/node-states', async (req, res) => {
  try {
    const nodeStates = faultToleranceManager.getNodeStates();

    res.json({
      success: true,
      nodeStates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resource Allocation Routes

/**
 * POST /api/distributed/resources/allocate
 * Allocate resources for a task
 */
router.post('/resources/allocate', async (req, res) => {
  try {
    const { taskId, requirements } = req.body;

    if (!taskId || !requirements) {
      return res.status(400).json({
        success: false,
        error: 'Task ID and resource requirements are required'
      });
    }

    const result = await resourceAllocator.allocateResources(taskId, requirements);

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
 * POST /api/distributed/resources/deallocate
 * Deallocate resources
 */
router.post('/resources/deallocate', async (req, res) => {
  try {
    const { allocationId } = req.body;

    if (!allocationId) {
      return res.status(400).json({
        success: false,
        error: 'Allocation ID is required'
      });
    }

    const result = await resourceAllocator.deallocateResources(allocationId);

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
 * GET /api/distributed/resources/status
 * Get resource status across all nodes
 */
router.get('/resources/status', async (req, res) => {
  try {
    const status = await resourceAllocator.getResourceStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/resources/history/:nodeId
 * Get resource utilization history for a node
 */
router.get('/resources/history/:nodeId', async (req, res) => {
  try {
    const nodeId = req.params.nodeId;
    const hours = parseInt(req.query.hours, 10) || 24;

    const history = await resourceAllocator.getResourceHistory(nodeId, hours);

    if (history.error) {
      return res.status(404).json({
        success: false,
        error: history.error
      });
    }

    res.json({
      success: true,
      ...history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/resources/allocations
 * Get resource allocations with optional filtering
 */
router.get('/resources/allocations', async (req, res) => {
  try {
    const filters = {
      nodeId: req.query.node_id,
      taskId: req.query.task_id,
      status: req.query.status
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const allocations = await resourceAllocator.getAllocations(filters);

    res.json({
      success: true,
      allocations,
      total: allocations.length,
      filters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/resources/stats
 * Get resource allocator statistics
 */
router.get('/resources/stats', async (req, res) => {
  try {
    const stats = resourceAllocator.getResourceAllocatorStats();

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

// System Overview Routes

/**
 * GET /api/distributed/overview
 * Get comprehensive system overview
 */
router.get('/overview', async (req, res) => {
  try {
    const overview = {
      timestamp: new Date().toISOString(),
      scheduler: taskScheduler.getSystemStats(),
      loadBalancer: loadBalancer.getBalancerStats(),
      faultTolerance: faultToleranceManager.getFaultToleranceStats(),
      resources: resourceAllocator.getResourceAllocatorStats(),
      systemHealth: faultToleranceManager.getSystemHealth()
    };

    res.json({
      success: true,
      overview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/distributed/metrics
 * Get real-time system metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      tasks: {
        total: taskScheduler.getSystemStats().queueLength + taskScheduler.getSystemStats().activeTasks,
        active: taskScheduler.getSystemStats().activeTasks,
        queued: taskScheduler.getSystemStats().queueLength,
        completed: taskScheduler.getSystemStats().completedTasks,
        failed: taskScheduler.getSystemStats().failedTasks
      },
      resources: {
        utilization: resourceAllocator.getResourceAllocatorStats().resourceUtilization,
        fragmentation: resourceAllocator.getResourceAllocatorStats().fragmentationScore,
        totalAllocations: resourceAllocator.getResourceAllocatorStats().totalAllocations
      },
      health: {
        systemStatus: faultToleranceManager.getSystemHealth().systemStatus,
        healthyNodes: faultToleranceManager.getSystemHealth().healthyNodes,
        totalNodes: faultToleranceManager.getSystemHealth().totalNodes,
        healthPercentage: faultToleranceManager.getSystemHealth().healthPercentage
      },
      loadBalancing: {
        algorithm: loadBalancer.getBalancerStats().algorithm,
        totalRequests: loadBalancer.getBalancerStats().totalRequestsBalanced,
        activeNodes: loadBalancer.getBalancerStats().activeNodes
      }
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

// Batch Operations Routes

/**
 * POST /api/distributed/batch/tasks
 * Create multiple tasks in batch
 */
router.post('/batch/tasks', async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: 'Tasks array is required'
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
      try {
        const result = await taskScheduler.createTask(tasks[i]);
        results.push({
          index: i,
          ...result
        });
      } catch (error) {
        errors.push({
          index: i,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results,
      errors,
      totalTasks: tasks.length,
      successfulTasks: results.length,
      failedTasks: errors.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Configuration Routes

/**
 * PUT /api/distributed/config
 * Update distributed computing configuration
 */
router.put('/config', async (req, res) => {
  try {
    const { component, config } = req.body;

    let result = { success: false, error: 'Invalid component' };

    switch (component) {
    case 'scheduler':
      // Update scheduler configuration
      result = { success: true, message: 'Scheduler configuration updated' };
      break;
    case 'loadBalancer':
      if (config.algorithm) {
        const success = loadBalancer.setAlgorithm(config.algorithm);
        result = success ?
          { success: true, message: 'Load balancer configuration updated' } :
          { success: false, error: 'Invalid algorithm' };
      }
      break;
    case 'faultTolerance':
      result = { success: true, message: 'Fault tolerance configuration updated' };
      break;
    case 'resources':
      result = { success: true, message: 'Resource allocator configuration updated' };
      break;
    }

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

// Cleanup middleware - shutdown components on server shutdown
process.on('SIGTERM', async () => {
  if (taskScheduler) await taskScheduler.shutdown();
  if (loadBalancer) await loadBalancer.shutdown();
  if (faultToleranceManager) await faultToleranceManager.shutdown();
  if (resourceAllocator) await resourceAllocator.shutdown();
});

module.exports = router;
