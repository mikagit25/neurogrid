const logger = require('../utils/logger');
const { db } = require('../config/database-universal');
const Job = require('../models/Job');
const Node = require('../models/Node');

/**
 * Task Dispatcher Service
 * Handles task assignment and load balancing across nodes using database
 */
class TaskDispatcher {
  constructor() {
    this.dispatchInterval = 5000; // 5 seconds
    this.maxRetries = 3;
    this.dispatchTimer = null;
    
    this.startDispatchTimer();
  }

  /**
   * Add task to dispatch queue
   */
  async addTask(taskData) {
    try {
      // Create job in database
      const jobData = {
        user_id: taskData.user_id || taskData.userId,
        title: taskData.title || `${taskData.model} Task`,
        description: taskData.description,
        job_type: taskData.model || 'unknown',
        priority: this.convertPriority(taskData.priority),
        requirements: {
          model: taskData.model,
          minVram: taskData.requirements?.minVram,
          minCpuCores: taskData.requirements?.minCpuCores,
          region: taskData.requirements?.region
        },
        parameters: taskData.parameters || {},
        input_data: taskData.input || {},
        estimated_duration: taskData.estimatedDuration,
        cost_estimate: taskData.costEstimate
      };

      const job = await Job.create(jobData);

      logger.info(`Task added to dispatch queue`, {
        taskId: job.id,
        model: taskData.model,
        priority: taskData.priority,
        userId: taskData.user_id || taskData.userId
      });

      // Try immediate dispatch
      await this.tryDispatchTask(job.id);

      return job;
    } catch (error) {
      logger.error('Error adding task to queue:', error);
      throw error;
    }
  }

  /**
   * Convert priority string to numeric value
   */
  convertPriority(priority) {
    const priorityMap = {
      'low': 1,
      'standard': 5,
      'high': 8,
      'critical': 10
    };
    return priorityMap[priority] || 5;
  }

  /**
   * Try to dispatch a specific task
   */
  async tryDispatchTask(taskId) {
    try {
      const job = await Job.findById(taskId);
      if (!job || job.status !== 'pending') {
        return false; // Job not found or already assigned
      }

      // Get available nodes based on requirements
      const requirements = {
        minVram: job.requirements?.minVram,
        minCpuCores: job.requirements?.minCpuCores,
        region: job.requirements?.region,
        models: job.requirements?.model ? [job.requirements.model] : []
      };

      const availableNodes = await Node.getAvailableNodes(requirements);
      
      if (availableNodes.length === 0) {
        logger.debug(`No available nodes for task ${taskId}`);
        return false;
      }

      // Select best node (highest reputation with capacity)
      const bestNode = this.selectBestNode(availableNodes, job);
      
      if (!bestNode) {
        logger.debug(`No suitable node found for task ${taskId}`);
        return false;
      }

      // Assign task to node
      await Job.assignToNode(taskId, bestNode.id);

      logger.info(`Task ${taskId} assigned to node ${bestNode.id}`, {
        taskId,
        nodeId: bestNode.id,
        nodeName: bestNode.name,
        nodeReputation: bestNode.reputation_score
      });

      return true;
    } catch (error) {
      logger.error(`Error dispatching task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Select the best node for a task
   */
  selectBestNode(availableNodes, job) {
    // Score nodes based on multiple criteria
    const scoredNodes = availableNodes.map(node => {
      let score = 0;
      
      // Reputation score (0-1) * 40%
      score += (node.reputation_score || 0) * 0.4;
      
      // Resource availability (0-1) * 30%
      const hardwareInfo = node.hardware_info || {};
      const vramRatio = hardwareInfo.available_vram_gb / Math.max(hardwareInfo.max_vram_gb, 1);
      const cpuRatio = hardwareInfo.available_cpu_cores / Math.max(hardwareInfo.max_cpu_cores, 1);
      const resourceScore = (vramRatio + cpuRatio) / 2;
      score += resourceScore * 0.3;
      
      // Lower current load (0-1) * 20%
      const currentTasks = hardwareInfo.current_tasks || 0;
      const maxTasks = 5; // Assume max 5 concurrent tasks
      const loadScore = Math.max(0, 1 - (currentTasks / maxTasks));
      score += loadScore * 0.2;
      
      // Recent activity bonus * 10%
      const lastSeen = new Date(node.last_seen || 0);
      const minutesAgo = (Date.now() - lastSeen.getTime()) / (1000 * 60);
      const activityScore = Math.max(0, 1 - (minutesAgo / 60)); // Full score if seen in last hour
      score += activityScore * 0.1;
      
      return { node, score };
    });

    // Sort by score (highest first)
    scoredNodes.sort((a, b) => b.score - a.score);
    
    return scoredNodes.length > 0 ? scoredNodes[0].node : null;
  }

  /**
   * Get pending tasks count
   */
  async getPendingTasksCount() {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM jobs WHERE status = $1',
        ['pending']
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting pending tasks count:', error);
      return 0;
    }
  }

  /**
   * Get running tasks count
   */
  async getRunningTasksCount() {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM jobs WHERE status IN ($1, $2)',
        ['assigned', 'running']
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting running tasks count:', error);
      return 0;
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId) {
    try {
      return await Job.findById(taskId);
    } catch (error) {
      logger.error(`Error getting task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, status, updates = {}) {
    try {
      return await Job.updateStatus(taskId, status, updates);
    } catch (error) {
      logger.error(`Error updating task ${taskId} status:`, error);
      throw error;
    }
  }

  /**
   * Cancel task
   */
  async cancelTask(taskId, reason = 'User cancelled') {
    try {
      const job = await Job.cancel(taskId, reason);
      
      logger.info(`Task ${taskId} cancelled`, {
        taskId,
        reason
      });

      return job;
    } catch (error) {
      logger.error(`Error cancelling task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get tasks for a user
   */
  async getUserTasks(userId, options = {}) {
    try {
      return await Job.findByUserId(userId, options);
    } catch (error) {
      logger.error(`Error getting tasks for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get tasks for a node
   */
  async getNodeTasks(nodeId, status = null) {
    try {
      return await Job.findByNodeId(nodeId, status);
    } catch (error) {
      logger.error(`Error getting tasks for node ${nodeId}:`, error);
      return [];
    }
  }

  /**
   * Retry failed task
   */
  async retryTask(taskId) {
    try {
      const job = await Job.findById(taskId);
      if (!job) {
        throw new Error('Task not found');
      }

      if (job.status !== 'failed') {
        throw new Error('Only failed tasks can be retried');
      }

      // Reset task to pending
      await Job.updateStatus(taskId, 'pending', {
        error_message: null,
        node_id: null
      });

      // Try to dispatch immediately
      await this.tryDispatchTask(taskId);

      logger.info(`Task ${taskId} queued for retry`);
      return await Job.findById(taskId);
    } catch (error) {
      logger.error(`Error retrying task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get dispatch statistics
   */
  async getDispatchStats() {
    try {
      const result = await db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
        FROM jobs 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY status
      `);

      const stats = {
        last24h: {},
        totalPending: 0,
        totalRunning: 0,
        totalCompleted: 0,
        totalFailed: 0
      };

      result.rows.forEach(row => {
        const status = row.status;
        const count = parseInt(row.count);
        
        stats.last24h[status] = {
          count,
          avgDuration: parseFloat(row.avg_duration) || 0
        };

        // Update totals
        if (status === 'pending') stats.totalPending = count;
        else if (status === 'running' || status === 'assigned') stats.totalRunning += count;
        else if (status === 'completed') stats.totalCompleted = count;
        else if (status === 'failed') stats.totalFailed = count;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting dispatch stats:', error);
      return {
        last24h: {},
        totalPending: 0,
        totalRunning: 0,
        totalCompleted: 0,
        totalFailed: 0
      };
    }
  }

  /**
   * Start automatic task dispatch timer
   */
  startDispatchTimer() {
    this.dispatchTimer = setInterval(async () => {
      await this.dispatchPendingTasks();
    }, this.dispatchInterval);
  }

  /**
   * Dispatch all pending tasks
   */
  async dispatchPendingTasks() {
    try {
      const pendingJobs = await Job.getPendingJobs(10); // Process up to 10 at a time
      
      if (pendingJobs.length === 0) {
        return;
      }

      logger.debug(`Dispatching ${pendingJobs.length} pending tasks`);

      for (const job of pendingJobs) {
        try {
          await this.tryDispatchTask(job.id);
        } catch (error) {
          logger.error(`Error dispatching task ${job.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in dispatch timer:', error);
    }
  }

  /**
   * Stop dispatch timer
   */
  stopDispatchTimer() {
    if (this.dispatchTimer) {
      clearInterval(this.dispatchTimer);
      this.dispatchTimer = null;
    }
  }

  /**
   * Initialize the service
   */
  async initialize() {
    logger.info('TaskDispatcher initialized with database integration');
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    this.stopDispatchTimer();
    logger.info('TaskDispatcher shut down');
  }
}

module.exports = TaskDispatcher;