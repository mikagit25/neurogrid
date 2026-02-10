/**
 * Task Scheduler - Core distributed computing task scheduling system
 * Handles task creation, prioritization, distribution, and execution tracking
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const aiIntegrationService = require('../services/AIIntegrationService');

class Task {
  constructor(taskData) {
    this.id = taskData.id || this.generateTaskId();
    this.type = taskData.type; // 'inference', 'training', 'processing', 'custom'
    this.subtype = taskData.subtype; // 'text-generation', 'image-generation', 'audio-transcription', etc.
    this.priority = taskData.priority || 5; // 1-10 scale, 10 = highest
    this.requirements = taskData.requirements || {};
    this.payload = taskData.payload;
    this.metadata = taskData.metadata || {};

    // Execution properties
    this.status = 'pending'; // 'pending', 'queued', 'assigned', 'running', 'completed', 'failed', 'cancelled'
    this.assignedNode = null;
    this.executionHistory = [];
    this.retryCount = 0;
    this.maxRetries = taskData.maxRetries || 3;

    // Timing
    this.createdAt = new Date();
    this.scheduledAt = null;
    this.startedAt = null;
    this.completedAt = null;
    this.estimatedDuration = taskData.estimatedDuration || null;
    this.actualDuration = null;

    // Dependencies
    this.dependencies = taskData.dependencies || [];
    this.dependents = [];

    // Results
    this.result = null;
    this.error = null;

    // Resource usage tracking
    this.resourceUsage = {
      cpu: 0,
      memory: 0,
      gpu: 0,
      network: 0
    };
  }

  generateTaskId() {
    return `task_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  updateStatus(newStatus, metadata = {}) {
    const previousStatus = this.status;
    this.status = newStatus;

    const historyEntry = {
      timestamp: new Date(),
      from: previousStatus,
      to: newStatus,
      metadata
    };

    this.executionHistory.push(historyEntry);

    // Update timing
    switch (newStatus) {
    case 'running':
      this.startedAt = new Date();
      break;
    case 'completed':
    case 'failed':
      this.completedAt = new Date();
      if (this.startedAt) {
        this.actualDuration = this.completedAt - this.startedAt;
      }
      break;
    }
  }

  canExecuteOn(node) {
    // Check basic requirements
    if (this.requirements.minMemoryGB && node.specs.memoryGB < this.requirements.minMemoryGB) {
      return false;
    }

    if (this.requirements.requiresGPU && !node.specs.hasGPU) {
      return false;
    }

    if (this.requirements.minGPUMemoryGB && node.specs.gpuMemoryGB < this.requirements.minGPUMemoryGB) {
      return false;
    }

    if (this.requirements.requiredCapabilities) {
      for (const capability of this.requirements.requiredCapabilities) {
        if (!node.capabilities.includes(capability)) {
          return false;
        }
      }
    }

    // Check availability
    if (node.status !== 'active' || node.currentLoad >= node.maxLoad) {
      return false;
    }

    return true;
  }

  getCompatibilityScore(node) {
    if (!this.canExecuteOn(node)) {
      return 0;
    }

    let score = 100;

    // Performance matching
    if (this.requirements.preferredCPUCores) {
      const cpuRatio = node.specs.cpuCores / this.requirements.preferredCPUCores;
      score += Math.min(cpuRatio * 10, 20);
    }

    if (this.requirements.preferredMemoryGB) {
      const memoryRatio = node.specs.memoryGB / this.requirements.preferredMemoryGB;
      score += Math.min(memoryRatio * 10, 20);
    }

    // Load balancing - prefer less loaded nodes
    const loadPenalty = (node.currentLoad / node.maxLoad) * 30;
    score -= loadPenalty;

    // Geographic proximity (if specified)
    if (this.requirements.preferredRegion && node.region === this.requirements.preferredRegion) {
      score += 15;
    }

    // Specialization bonus
    if (this.requirements.preferredNodeTypes && this.requirements.preferredNodeTypes.includes(node.type)) {
      score += 25;
    }

    return Math.max(score, 1);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      subtype: this.subtype,
      priority: this.priority,
      status: this.status,
      assignedNode: this.assignedNode,
      createdAt: this.createdAt,
      scheduledAt: this.scheduledAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      estimatedDuration: this.estimatedDuration,
      actualDuration: this.actualDuration,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      dependencies: this.dependencies,
      dependents: this.dependents,
      requirements: this.requirements,
      metadata: this.metadata,
      resourceUsage: this.resourceUsage,
      executionHistory: this.executionHistory.slice(-10) // Last 10 entries
    };
  }
}

class TaskScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.tasks = new Map();
    this.taskQueue = [];
    this.nodeManager = options.nodeManager;
    this.modelManager = options.modelManager;

    // Configuration
    this.config = {
      maxConcurrentTasks: options.maxConcurrentTasks || 100,
      schedulingInterval: options.schedulingInterval || 1000, // ms
      taskTimeout: options.taskTimeout || 300000, // 5 minutes
      enableLoadBalancing: options.enableLoadBalancing !== false,
      enableFailover: options.enableFailover !== false,
      enableRetries: options.enableRetries !== false
    };

    // Statistics
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      nodeUtilization: new Map()
    };

    // Start scheduler
    this.schedulerInterval = setInterval(() => this.processQueue(), this.config.schedulingInterval);
    this.timeoutInterval = setInterval(() => this.checkTimeouts(), 30000); // Check every 30 seconds

    this.isRunning = true;
  }

  async createTask(taskData) {
    try {
      const task = new Task(taskData);

      // Validate task
      if (!this.validateTask(task)) {
        throw new Error('Invalid task configuration');
      }

      // Check dependencies
      if (task.dependencies.length > 0) {
        const unmetDependencies = task.dependencies.filter(depId => {
          const depTask = this.tasks.get(depId);
          return !depTask || depTask.status !== 'completed';
        });

        if (unmetDependencies.length > 0) {
          task.status = 'waiting_dependencies';
          task.metadata.unmetDependencies = unmetDependencies;
        }
      }

      // Store task
      this.tasks.set(task.id, task);

      // Add to queue if ready
      if (task.status === 'pending') {
        this.addTaskToQueue(task);
      }

      this.stats.totalTasks++;

      this.emit('taskCreated', task);

      return {
        success: true,
        taskId: task.id,
        status: task.status
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  validateTask(task) {
    // Required fields
    if (!task.type || !task.payload) {
      return false;
    }

    // Valid priority
    if (task.priority < 1 || task.priority > 10) {
      return false;
    }

    // Valid task type
    const validTypes = ['inference', 'training', 'processing', 'custom'];
    if (!validTypes.includes(task.type)) {
      return false;
    }

    return true;
  }

  addTaskToQueue(task) {
    task.updateStatus('queued');

    // Insert task in priority order
    const insertIndex = this.taskQueue.findIndex(queuedTask =>
      queuedTask.priority < task.priority ||
            (queuedTask.priority === task.priority && queuedTask.createdAt > task.createdAt)
    );

    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    this.emit('taskQueued', task);
  }

  async processQueue() {
    if (!this.isRunning || this.taskQueue.length === 0) {
      return;
    }

    try {
      // Get available nodes
      const availableNodes = await this.getAvailableNodes();
      if (availableNodes.length === 0) {
        return;
      }

      // Process tasks
      const tasksToProcess = this.taskQueue.slice(0, Math.min(
        this.taskQueue.length,
        availableNodes.length,
        this.config.maxConcurrentTasks
      ));

      for (const task of tasksToProcess) {
        const suitableNode = this.findBestNode(task, availableNodes);

        if (suitableNode) {
          await this.assignTaskToNode(task, suitableNode);

          // Remove from queue
          const queueIndex = this.taskQueue.indexOf(task);
          if (queueIndex > -1) {
            this.taskQueue.splice(queueIndex, 1);
          }

          // Remove node from available list for this iteration
          const nodeIndex = availableNodes.indexOf(suitableNode);
          if (nodeIndex > -1) {
            availableNodes.splice(nodeIndex, 1);
          }
        }
      }

    } catch (error) {
      console.error('Error processing task queue:', error);
    }
  }

  async getAvailableNodes() {
    if (!this.nodeManager) {
      return [];
    }

    try {
      const allNodes = await this.nodeManager.getActiveNodes();
      return allNodes.filter(node =>
        node.status === 'active' &&
                node.currentLoad < node.maxLoad
      );
    } catch (error) {
      console.error('Error getting available nodes:', error);
      return [];
    }
  }

  findBestNode(task, availableNodes) {
    if (availableNodes.length === 0) {
      return null;
    }

    // Filter compatible nodes
    const compatibleNodes = availableNodes.filter(node => task.canExecuteOn(node));

    if (compatibleNodes.length === 0) {
      return null;
    }

    // Score and rank nodes
    const scoredNodes = compatibleNodes.map(node => ({
      node,
      score: task.getCompatibilityScore(node)
    }));

    // Sort by score (highest first)
    scoredNodes.sort((a, b) => b.score - a.score);

    return scoredNodes[0].node;
  }

  async assignTaskToNode(task, node) {
    try {
      task.assignedNode = node.id;
      task.updateStatus('assigned');
      task.scheduledAt = new Date();

      // Update node load
      if (this.nodeManager) {
        await this.nodeManager.incrementNodeLoad(node.id);
      }

      this.emit('taskAssigned', { task, node });

      // Execute task
      await this.executeTask(task, node);

    } catch (error) {
      console.error(`Error assigning task ${task.id} to node ${node.id}:`, error);
      task.error = error.message;
      task.updateStatus('failed');

      // Return node to available pool
      if (this.nodeManager) {
        await this.nodeManager.decrementNodeLoad(node.id);
      }

      // Retry if possible
      if (this.config.enableRetries && task.retryCount < task.maxRetries) {
        await this.retryTask(task);
      } else {
        this.handleFailedTask(task);
      }
    }
  }

  async executeTask(task, node) {
    try {
      task.updateStatus('running');

      let result;

      // Execute based on task type
      switch (task.type) {
      case 'inference':
        result = await this.executeInferenceTask(task, node);
        break;
      case 'training':
        result = await this.executeTrainingTask(task, node);
        break;
      case 'processing':
        result = await this.executeProcessingTask(task, node);
        break;
      case 'custom':
        result = await this.executeCustomTask(task, node);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
      }

      // Task completed successfully
      task.result = result;
      task.updateStatus('completed');

      this.stats.completedTasks++;
      this.updateExecutionStats(task);

      // Update node statistics
      this.updateNodeUtilization(node.id, task.actualDuration);

      // Return node to available pool
      if (this.nodeManager) {
        await this.nodeManager.decrementNodeLoad(node.id);
      }

      // Check for dependent tasks
      await this.checkDependentTasks(task.id);

      this.emit('taskCompleted', { task, result });

    } catch (error) {
      task.error = error.message;
      task.updateStatus('failed');

      // Return node to available pool
      if (this.nodeManager) {
        await this.nodeManager.decrementNodeLoad(node.id);
      }

      // Retry if possible
      if (this.config.enableRetries && task.retryCount < task.maxRetries) {
        await this.retryTask(task);
      } else {
        this.handleFailedTask(task);
      }
    }
  }

  async executeInferenceTask(task, node) {
    try {
      // Use the AI Integration Service for real AI execution
      const aiTask = {
        id: task.id,
        type: 'inference',
        model: task.payload.model_id || task.payload.model,
        input_data: task.payload.input || task.payload.input_data,
        parameters: task.payload.options || task.payload.parameters || {},
        requirements: task.requirements
      };

      const result = await aiIntegrationService.executeTask(aiTask);

      return {
        success: true,
        result: result.output,
        metadata: result.metadata,
        cost: result.cost,
        execution_time: result.metadata.execution_time,
        provider_type: result.metadata.provider_type
      };

    } catch (error) {
      throw new Error(`AI inference failed: ${error.message}`);
    }
  }

  async executeTrainingTask(task, node) {
    // For now, training tasks still use placeholder logic
    // In the future, this could integrate with training-specific AI services

    const { model_config, training_data, parameters } = task.payload;

    // Simulate training
    await new Promise(resolve => setTimeout(resolve, 5000));

    return {
      success: true,
      message: 'Training completed',
      model_path: `/models/trained_${task.id}`,
      metrics: {
        loss: 0.1,
        accuracy: 0.95,
        epochs: parameters?.epochs || 10
      },
      node_id: node.id
    };
  }

  async executeProcessingTask(task, node) {
    try {
      // Check if this is an AI processing task that can use our AI service
      if (task.subtype && ['generation', 'text-generation', 'image-generation'].includes(task.subtype)) {
        const aiTask = {
          id: task.id,
          type: 'generation',
          model: task.payload.model || 'huggingface:gpt2',
          input_data: task.payload.data || task.payload.input,
          parameters: task.payload.parameters || {}
        };

        const result = await aiIntegrationService.executeTask(aiTask);

        return {
          success: true,
          result: result.output,
          metadata: result.metadata,
          cost: result.cost,
          processed_items: 1,
          node_id: node.id
        };
      }

      // Fallback to original processing logic
      const { operation, data, parameters } = task.payload;

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        operation,
        processed_items: (data && data.length) || 1,
        result: `Processed ${operation} with parameters: ${JSON.stringify(parameters)}`,
        node_id: node.id
      };

    } catch (error) {
      throw new Error(`Processing task failed: ${error.message}`);
    }
  }

  async executeCustomTask(task, _node) {
    // Placeholder for custom task execution
    const { script, parameters } = task.payload;

    // Simulate custom execution
    await new Promise(resolve => setTimeout(resolve, 3000));

    return {
      success: true,
      script,
      output: 'Custom task executed successfully',
      parameters
    };
  }

  async retryTask(task) {
    task.retryCount++;
    task.assignedNode = null;
    task.updateStatus('queued', { reason: 'retry', attempt: task.retryCount });

    // Add back to queue with higher priority
    task.priority = Math.min(task.priority + 1, 10);
    this.addTaskToQueue(task);

    this.emit('taskRetried', task);
  }

  handleFailedTask(task) {
    this.stats.failedTasks++;
    this.emit('taskFailed', task);

    // Handle dependent tasks
    this.markDependentTasksAsFailed(task.id);
  }

  async checkDependentTasks(completedTaskId) {
    for (const [_taskId, task] of this.tasks.entries()) {
      if (task.status === 'waiting_dependencies' && task.dependencies.includes(completedTaskId)) {
        // Check if all dependencies are now met
        const unmetDependencies = task.dependencies.filter(depId => {
          const depTask = this.tasks.get(depId);
          return !depTask || depTask.status !== 'completed';
        });

        if (unmetDependencies.length === 0) {
          // All dependencies met, add to queue
          task.status = 'pending';
          this.addTaskToQueue(task);
        } else {
          // Update unmet dependencies
          task.metadata.unmetDependencies = unmetDependencies;
        }
      }
    }
  }

  markDependentTasksAsFailed(failedTaskId) {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.dependencies.includes(failedTaskId) &&
                ['pending', 'queued', 'waiting_dependencies'].includes(task.status)) {

        task.updateStatus('failed', { reason: 'dependency_failed', failedDependency: failedTaskId });
        this.stats.failedTasks++;

        // Remove from queue if present
        const queueIndex = this.taskQueue.indexOf(task);
        if (queueIndex > -1) {
          this.taskQueue.splice(queueIndex, 1);
        }

        this.emit('taskFailed', task);

        // Recursively mark dependents as failed
        this.markDependentTasksAsFailed(taskId);
      }
    }
  }

  checkTimeouts() {
    const now = new Date();
    const timeoutTasks = [];

    for (const [_taskId, task] of this.tasks.entries()) {
      if (task.status === 'running' && task.startedAt) {
        const executionTime = now - task.startedAt;
        if (executionTime > this.config.taskTimeout) {
          timeoutTasks.push(task);
        }
      }
    }

    // Handle timed out tasks
    for (const task of timeoutTasks) {
      task.error = 'Task execution timeout';
      task.updateStatus('failed', { reason: 'timeout' });

      // Return node to available pool
      if (this.nodeManager && task.assignedNode) {
        this.nodeManager.decrementNodeLoad(task.assignedNode);
      }

      // Retry if possible
      if (this.config.enableRetries && task.retryCount < task.maxRetries) {
        this.retryTask(task);
      } else {
        this.handleFailedTask(task);
      }
    }
  }

  updateExecutionStats(task) {
    if (task.actualDuration) {
      this.stats.totalExecutionTime += task.actualDuration;
      this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.completedTasks;
    }
  }

  updateNodeUtilization(nodeId, duration) {
    if (!this.stats.nodeUtilization.has(nodeId)) {
      this.stats.nodeUtilization.set(nodeId, {
        totalTasks: 0,
        totalTime: 0,
        averageTime: 0
      });
    }

    const nodeStats = this.stats.nodeUtilization.get(nodeId);
    nodeStats.totalTasks++;
    nodeStats.totalTime += duration || 0;
    nodeStats.averageTime = nodeStats.totalTime / nodeStats.totalTasks;
  }

  // Public API methods

  async getTask(taskId) {
    return this.tasks.get(taskId)?.toJSON();
  }

  async getTasks(filters = {}) {
    let tasks = Array.from(this.tasks.values());

    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status);
    }

    if (filters.type) {
      tasks = tasks.filter(task => task.type === filters.type);
    }

    if (filters.nodeId) {
      tasks = tasks.filter(task => task.assignedNode === filters.nodeId);
    }

    if (filters.priority) {
      tasks = tasks.filter(task => task.priority >= filters.priority);
    }

    return tasks.map(task => task.toJSON());
  }

  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return { success: false, error: 'Task cannot be cancelled' };
    }

    // Remove from queue if present
    const queueIndex = this.taskQueue.indexOf(task);
    if (queueIndex > -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    // Return node to available pool if assigned
    if (task.assignedNode && this.nodeManager) {
      await this.nodeManager.decrementNodeLoad(task.assignedNode);
    }

    task.updateStatus('cancelled');
    this.stats.cancelledTasks++;

    this.emit('taskCancelled', task);

    return { success: true, message: 'Task cancelled successfully' };
  }

  getSystemStats() {
    return {
      ...this.stats,
      queueLength: this.taskQueue.length,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.status === 'running').length,
      pendingTasks: Array.from(this.tasks.values()).filter(t => ['pending', 'queued'].includes(t.status)).length,
      nodeUtilization: Object.fromEntries(this.stats.nodeUtilization)
    };
  }

  async shutdown() {
    this.isRunning = false;

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
    }

    // Cancel all pending tasks
    for (const task of this.taskQueue) {
      await this.cancelTask(task.id);
    }

    this.removeAllListeners();
  }
}

module.exports = { Task, TaskScheduler };
