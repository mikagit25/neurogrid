const logger = require('../utils/logger');

/**
 * Node Manager Service
 * Manages node registration, health monitoring, and resource tracking
 */
class NodeManager {
  constructor() {
    this.nodes = new Map();
    this.nodeMetrics = new Map();
    this.heartbeatInterval = 30000; // 30 seconds
    this.nodeTimeout = 90000; // 90 seconds
    this.cleanupInterval = null;
    
    this.startCleanupTimer();
  }

  /**
   * Register a new node
   */
  async registerNode(nodeData) {
    try {
      const node = {
        id: nodeData.id,
        endpoint: nodeData.endpoint,
        publicKey: nodeData.publicKey,
        capabilities: nodeData.capabilities || {},
        max_vram_gb: nodeData.max_vram_gb || 0,
        max_cpu_cores: nodeData.max_cpu_cores || 0,
        supported_models: nodeData.supported_models || [],
        region: nodeData.region || 'unknown',
        version: nodeData.version || '0.1.0',
        
        // Status tracking
        status: 'active',
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        lastTaskAssignment: null,
        
        // Performance metrics
        rating: nodeData.rating || 0.5, // Start with neutral rating
        tasks_completed: 0,
        tasks_failed: 0,
        total_uptime: 0,
        avg_response_time: 0,
        
        // Current availability
        available_vram_gb: nodeData.max_vram_gb || 0,
        available_cpu_cores: nodeData.max_cpu_cores || 0,
        current_tasks: 0,
        max_concurrent_tasks: nodeData.max_concurrent_tasks || 1
      };

      this.nodes.set(node.id, node);
      this.initializeNodeMetrics(node.id);

      logger.info(`Node ${node.id} registered successfully`, {
        nodeId: node.id,
        endpoint: node.endpoint,
        vram: node.max_vram_gb,
        cpuCores: node.max_cpu_cores,
        models: node.supported_models
      });

      return node;
    } catch (error) {
      logger.error('Error registering node:', error);
      throw error;
    }
  }

  /**
   * Process heartbeat from node
   */
  async processHeartbeat(nodeId, heartbeatData) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      logger.warn(`Heartbeat from unregistered node: ${nodeId}`);
      return false;
    }

    try {
      // Update node status
      node.lastHeartbeat = new Date();
      node.status = heartbeatData.status || 'active';
      
      // Update resource availability
      if (heartbeatData.resources) {
        node.available_vram_gb = heartbeatData.resources.available_vram_gb || node.available_vram_gb;
        node.available_cpu_cores = heartbeatData.resources.available_cpu_cores || node.available_cpu_cores;
        node.current_tasks = heartbeatData.resources.current_tasks || node.current_tasks;
      }

      // Update performance metrics
      if (heartbeatData.metrics) {
        this.updateNodeMetrics(nodeId, heartbeatData.metrics);
      }

      // Calculate uptime
      const now = Date.now();
      const lastUpdate = node.lastMetricsUpdate || node.registeredAt.getTime();
      node.total_uptime += (now - lastUpdate);
      node.lastMetricsUpdate = now;

      logger.debug(`Heartbeat processed for node ${nodeId}`, {
        nodeId,
        status: node.status,
        availableVram: node.available_vram_gb,
        currentTasks: node.current_tasks
      });

      return true;
    } catch (error) {
      logger.error(`Error processing heartbeat for node ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Get available nodes for task assignment
   */
  getAvailableNodes(requirements = {}) {
    const availableNodes = Array.from(this.nodes.values()).filter(node => {
      // Must be active and healthy
      if (node.status !== 'active') return false;
      
      // Check if node is responding (recent heartbeat)
      const timeSinceHeartbeat = Date.now() - node.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > this.nodeTimeout) return false;
      
      // Must have available task slots
      if (node.current_tasks >= node.max_concurrent_tasks) return false;
      
      // Check minimum requirements if specified
      if (requirements.minVram && node.available_vram_gb < requirements.minVram) return false;
      if (requirements.minCpuCores && node.available_cpu_cores < requirements.minCpuCores) return false;
      if (requirements.models && !requirements.models.some(model => node.supported_models.includes(model))) return false;
      if (requirements.region && node.region !== requirements.region) return false;
      
      return true;
    });

    // Sort by performance rating and availability
    return availableNodes.sort((a, b) => {
      // Primary sort: rating (higher is better)
      if (Math.abs(b.rating - a.rating) > 0.05) {
        return b.rating - a.rating;
      }
      
      // Secondary sort: resource availability
      const aResourceRatio = (a.available_vram_gb / a.max_vram_gb) + (a.available_cpu_cores / a.max_cpu_cores);
      const bResourceRatio = (b.available_vram_gb / b.max_vram_gb) + (b.available_cpu_cores / b.max_cpu_cores);
      
      return bResourceRatio - aResourceRatio;
    });
  }

  /**
   * Update node rating based on performance
   */
  updateNodeRating(nodeId, taskOutcome) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const metrics = this.nodeMetrics.get(nodeId);
    if (!metrics) return false;

    try {
      // Update task counters
      if (taskOutcome.success) {
        node.tasks_completed++;
      } else {
        node.tasks_failed++;
      }

      // Calculate success rate
      const totalTasks = node.tasks_completed + node.tasks_failed;
      const successRate = totalTasks > 0 ? node.tasks_completed / totalTasks : 0.5;

      // Update average response time
      if (taskOutcome.responseTime) {
        const currentAvg = node.avg_response_time;
        const newCount = node.tasks_completed;
        node.avg_response_time = newCount > 1 
          ? ((currentAvg * (newCount - 1)) + taskOutcome.responseTime) / newCount
          : taskOutcome.responseTime;
      }

      // Calculate new rating (weighted average of factors)
      const uptimeScore = Math.min(node.total_uptime / (7 * 24 * 60 * 60 * 1000), 1); // Max score at 1 week
      const responseTimeScore = node.avg_response_time > 0 
        ? Math.max(1 - (node.avg_response_time / 30000), 0) // Penalize response times > 30s
        : 0.5;

      const newRating = (
        successRate * 0.4 +           // 40% success rate
        uptimeScore * 0.3 +           // 30% uptime
        responseTimeScore * 0.2 +     // 20% response time
        (node.rating * 0.1)           // 10% historical rating for stability
      );

      node.rating = Math.max(0, Math.min(1, newRating));

      logger.debug(`Updated rating for node ${nodeId}`, {
        nodeId,
        oldRating: node.rating,
        newRating,
        successRate,
        totalTasks,
        uptimeScore,
        responseTimeScore
      });

      return true;
    } catch (error) {
      logger.error(`Error updating rating for node ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Remove node from network
   */
  async removeNode(nodeId, reason = 'manual') {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    try {
      // Mark as offline first
      node.status = 'offline';
      node.removedAt = new Date();
      node.removalReason = reason;

      // Clean up
      this.nodes.delete(nodeId);
      this.nodeMetrics.delete(nodeId);

      logger.info(`Node ${nodeId} removed from network`, {
        nodeId,
        reason,
        uptime: node.total_uptime,
        tasksCompleted: node.tasks_completed
      });

      return true;
    } catch (error) {
      logger.error(`Error removing node ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    const allNodes = Array.from(this.nodes.values());
    const activeNodes = allNodes.filter(n => n.status === 'active');
    
    const stats = {
      total_nodes: allNodes.length,
      active_nodes: activeNodes.length,
      offline_nodes: allNodes.filter(n => n.status === 'offline').length,
      busy_nodes: activeNodes.filter(n => n.current_tasks > 0).length,
      
      total_vram_gb: allNodes.reduce((sum, n) => sum + n.max_vram_gb, 0),
      available_vram_gb: activeNodes.reduce((sum, n) => sum + n.available_vram_gb, 0),
      
      total_cpu_cores: allNodes.reduce((sum, n) => sum + n.max_cpu_cores, 0),
      available_cpu_cores: activeNodes.reduce((sum, n) => sum + n.available_cpu_cores, 0),
      
      total_tasks: allNodes.reduce((sum, n) => sum + n.tasks_completed, 0),
      current_tasks: activeNodes.reduce((sum, n) => sum + n.current_tasks, 0),
      
      avg_node_rating: activeNodes.length > 0 
        ? activeNodes.reduce((sum, n) => sum + n.rating, 0) / activeNodes.length 
        : 0,
      
      regions: [...new Set(allNodes.map(n => n.region))],
      supported_models: [...new Set(allNodes.flatMap(n => n.supported_models))]
    };

    return stats;
  }

  /**
   * Initialize metrics tracking for a node
   */
  initializeNodeMetrics(nodeId) {
    this.nodeMetrics.set(nodeId, {
      cpuUsage: [],
      memoryUsage: [],
      vramUsage: [],
      taskDurations: [],
      errorCounts: {},
      lastUpdated: new Date()
    });
  }

  /**
   * Update node performance metrics
   */
  updateNodeMetrics(nodeId, metricsData) {
    const metrics = this.nodeMetrics.get(nodeId);
    if (!metrics) return;

    const now = new Date();
    
    // Store historical metrics (keep last 100 data points)
    if (metricsData.cpuUsage !== undefined) {
      metrics.cpuUsage.push({ value: metricsData.cpuUsage, timestamp: now });
      if (metrics.cpuUsage.length > 100) metrics.cpuUsage.shift();
    }
    
    if (metricsData.memoryUsage !== undefined) {
      metrics.memoryUsage.push({ value: metricsData.memoryUsage, timestamp: now });
      if (metrics.memoryUsage.length > 100) metrics.memoryUsage.shift();
    }
    
    if (metricsData.vramUsage !== undefined) {
      metrics.vramUsage.push({ value: metricsData.vramUsage, timestamp: now });
      if (metrics.vramUsage.length > 100) metrics.vramUsage.shift();
    }

    metrics.lastUpdated = now;
  }

  /**
   * Start cleanup timer for inactive nodes
   */
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveNodes();
    }, 60000); // Check every minute
  }

  /**
   * Clean up nodes that haven't sent heartbeats
   */
  cleanupInactiveNodes() {
    const now = Date.now();
    const inactiveNodes = [];

    this.nodes.forEach((node, nodeId) => {
      const timeSinceHeartbeat = now - node.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > this.nodeTimeout && node.status !== 'offline') {
        node.status = 'offline';
        inactiveNodes.push(nodeId);
      }
      
      // Remove completely dead nodes after 24 hours
      if (timeSinceHeartbeat > 24 * 60 * 60 * 1000) {
        this.removeNode(nodeId, 'timeout');
      }
    });

    if (inactiveNodes.length > 0) {
      logger.info(`Marked ${inactiveNodes.length} nodes as offline due to inactivity`);
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get specific node information
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Get all nodes with optional filtering
   */
  getAllNodes(filter = {}) {
    let nodes = Array.from(this.nodes.values());

    if (filter.status) {
      nodes = nodes.filter(n => n.status === filter.status);
    }
    
    if (filter.region) {
      nodes = nodes.filter(n => n.region === filter.region);
    }
    
    if (filter.minRating) {
      nodes = nodes.filter(n => n.rating >= filter.minRating);
    }

    return nodes;
  }

  /**
   * Initialize the node manager
   */
  async initialize() {
    logger.info('Node manager initialized');
    return true;
  }
}

module.exports = NodeManager;