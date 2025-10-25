const logger = require('../utils/logger');

/**
 * Task Dispatcher Service
 * Handles task assignment and load balancing across nodes
 */
class TaskDispatcher {
  constructor() {
    this.pendingTasks = new Map();
    this.runningTasks = new Map();
    this.taskQueue = [];
    this.nodeAssignments = new Map();
  }

  /**
   * Add task to dispatch queue
   */
  async addTask(taskData) {
    try {
      const task = {
        id: taskData.id,
        model: taskData.model,
        input: taskData.input,
        priority: taskData.priority || 'standard',
        requirements: taskData.requirements || {},
        createdAt: new Date(),
        status: 'pending',
        retries: 0,
        maxRetries: 3
      };

      this.pendingTasks.set(task.id, task);
      this.taskQueue.push(task);

      // Sort by priority
      this.taskQueue.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

      logger.info(`Task ${task.id} added to dispatch queue`, {
        taskId: task.id,
        model: task.model,
        priority: task.priority
      });

      // Attempt immediate dispatch
      await this.processQueue();

      return task;
    } catch (error) {
      logger.error('Error adding task to dispatcher:', error);
      throw error;
    }
  }

  /**
   * Process the task queue and assign to available nodes
   */
  async processQueue() {
    if (this.taskQueue.length === 0) return;

    // Get available nodes (this would come from NodeManager)
    const availableNodes = await this.getAvailableNodes();
    if (availableNodes.length === 0) {
      logger.debug('No available nodes for task assignment');
      return;
    }

    // Process tasks in priority order
    let assignedCount = 0;
    const tasksToRemove = [];

    for (let i = 0; i < this.taskQueue.length && assignedCount < availableNodes.length; i++) {
      const task = this.taskQueue[i];
      const suitableNode = this.findSuitableNode(task, availableNodes);

      if (suitableNode) {
        try {
          await this.assignTaskToNode(task, suitableNode);
          tasksToRemove.push(i);
          assignedCount++;

          // Remove assigned node from available list
          const nodeIndex = availableNodes.findIndex(n => n.id === suitableNode.id);
          if (nodeIndex > -1) {
            availableNodes.splice(nodeIndex, 1);
          }
        } catch (error) {
          logger.error(`Failed to assign task ${task.id} to node ${suitableNode.id}:`, error);
        }
      }
    }

    // Remove assigned tasks from queue
    tasksToRemove.reverse().forEach(index => {
      this.taskQueue.splice(index, 1);
    });

    if (assignedCount > 0) {
      logger.info(`Assigned ${assignedCount} tasks to nodes`);
    }
  }

  /**
   * Find suitable node for task based on requirements
   */
  findSuitableNode(task, availableNodes) {
    // Filter nodes that meet task requirements
    const suitableNodes = availableNodes.filter(node => {
      // Check VRAM requirements
      if (task.requirements.minVram && node.available_vram_gb < task.requirements.minVram) {
        return false;
      }

      // Check CPU requirements
      if (task.requirements.minCpuCores && node.available_cpu_cores < task.requirements.minCpuCores) {
        return false;
      }

      // Check supported models
      if (task.model && !node.supported_models.includes(task.model)) {
        return false;
      }

      return true;
    });

    if (suitableNodes.length === 0) return null;

    // Select best node based on rating and availability
    return suitableNodes.sort((a, b) => {
      // Prioritize by rating first
      const ratingDiff = b.rating - a.rating;
      if (Math.abs(ratingDiff) > 0.1) return ratingDiff;

      // Then by available resources
      const resourceScoreA = (a.available_vram_gb / a.max_vram_gb) + (a.available_cpu_cores / a.max_cpu_cores);
      const resourceScoreB = (b.available_vram_gb / b.max_vram_gb) + (b.available_cpu_cores / b.max_cpu_cores);

      return resourceScoreB - resourceScoreA;
    })[0];
  }

  /**
   * Assign task to specific node
   */
  async assignTaskToNode(task, node) {
    try {
      // Move task from pending to running
      this.pendingTasks.delete(task.id);

      const runningTask = {
        ...task,
        nodeId: node.id,
        assignedAt: new Date(),
        status: 'assigned'
      };

      this.runningTasks.set(task.id, runningTask);

      // Track node assignment
      if (!this.nodeAssignments.has(node.id)) {
        this.nodeAssignments.set(node.id, new Set());
      }
      this.nodeAssignments.get(node.id).add(task.id);

      // Send task to node (would integrate with actual node communication)
      await this.sendTaskToNode(runningTask, node);

      logger.info(`Task ${task.id} assigned to node ${node.id}`, {
        taskId: task.id,
        nodeId: node.id,
        model: task.model
      });

      return runningTask;
    } catch (error) {
      // Revert assignment on failure
      this.runningTasks.delete(task.id);
      this.pendingTasks.set(task.id, task);
      this.taskQueue.unshift(task);
      throw error;
    }
  }

  /**
   * Handle task completion
   */
  async completeTask(taskId, result) {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      logger.warn(`Attempt to complete unknown task: ${taskId}`);
      return false;
    }

    try {
      // Update task status
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      // Remove from running tasks
      this.runningTasks.delete(taskId);

      // Clean up node assignment
      if (this.nodeAssignments.has(task.nodeId)) {
        this.nodeAssignments.get(task.nodeId).delete(taskId);
      }

      logger.info(`Task ${taskId} completed successfully`, {
        taskId,
        nodeId: task.nodeId,
        duration: task.completedAt - task.assignedAt
      });

      return true;
    } catch (error) {
      logger.error(`Error completing task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Handle task failure
   */
  async failTask(taskId, error) {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      logger.warn(`Attempt to fail unknown task: ${taskId}`);
      return false;
    }

    try {
      task.retries++;
      task.lastError = error;

      // Remove from running tasks
      this.runningTasks.delete(taskId);

      // Clean up node assignment
      if (this.nodeAssignments.has(task.nodeId)) {
        this.nodeAssignments.get(task.nodeId).delete(taskId);
      }

      if (task.retries < task.maxRetries) {
        // Retry task
        task.status = 'pending';
        delete task.nodeId;
        delete task.assignedAt;

        this.pendingTasks.set(taskId, task);
        this.taskQueue.push(task);

        logger.warn(`Task ${taskId} failed, retry ${task.retries}/${task.maxRetries}`, {
          taskId,
          error: error.message,
          retries: task.retries
        });

        // Process queue to reassign
        await this.processQueue();
      } else {
        // Mark as permanently failed
        task.status = 'failed';
        task.failedAt = new Date();

        logger.error(`Task ${taskId} permanently failed after ${task.retries} retries`, {
          taskId,
          error: error.message
        });
      }

      return true;
    } catch (err) {
      logger.error(`Error handling task failure for ${taskId}:`, err);
      return false;
    }
  }

  /**
   * Get priority weight for sorting
   */
  getPriorityWeight(priority) {
    const weights = {
      'critical': 100,
      'high': 75,
      'standard': 50,
      'low': 25
    };
    return weights[priority] || weights.standard;
  }

  /**
   * Mock method to get available nodes
   * In real implementation, this would call NodeManager
   */
  async getAvailableNodes() {
    // This would be replaced with actual NodeManager integration
    return [];
  }

  /**
   * Mock method to send task to node
   * In real implementation, this would use WebSocket or HTTP
   */
  async sendTaskToNode(task, node) {
    // This would be replaced with actual node communication
    logger.debug(`Sending task ${task.id} to node ${node.id}`);
    return true;
  }

  /**
   * Get dispatcher statistics
   */
  getStats() {
    return {
      pendingTasks: this.pendingTasks.size,
      runningTasks: this.runningTasks.size,
      queueLength: this.taskQueue.length,
      activeNodes: this.nodeAssignments.size,
      totalAssignments: Array.from(this.nodeAssignments.values())
        .reduce((sum, assignments) => sum + assignments.size, 0)
    };
  }

  /**
   * Clean up completed or failed tasks older than specified time
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    const cleaned = 0;

    // This would typically clean up from persistent storage
    logger.debug(`Task dispatcher cleanup completed, removed ${cleaned} old tasks`);

    return cleaned;
  }

  /**
   * Initialize the task dispatcher
   */
  async initialize() {
    logger.info('Task dispatcher initialized');

    // Start periodic queue processing
    setInterval(() => {
      this.processQueue();
    }, 5000); // Process queue every 5 seconds

    return true;
  }
}

module.exports = TaskDispatcher;
