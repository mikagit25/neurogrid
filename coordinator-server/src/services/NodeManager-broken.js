const logger = require('../utils/logger');
const { db } = require('../config/database-universal');
const Node = require('../models/Node');

/**
 * Node Manager Service
 * Manages node registration, health monitoring, and resource tracking
 */
class NodeManager {
  constructor() {
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
      // Prepare node data for database
      const nodeDbData = {
        user_id: nodeData.user_id || nodeData.userId,
        name: nodeData.name || `Node-${nodeData.id?.slice(0, 8)}`,
        description: nodeData.description,
        node_type: nodeData.node_type || 'compute',
        capabilities: {
          max_vram_gb: nodeData.max_vram_gb || 0,
          max_cpu_cores: nodeData.max_cpu_cores || 0,
          supported_models: nodeData.supported_models || [],
          endpoint: nodeData.endpoint,
          publicKey: nodeData.publicKey,
          version: nodeData.version || '0.1.0'
        },
        hardware_info: {
          max_vram_gb: nodeData.max_vram_gb || 0,
          max_cpu_cores: nodeData.max_cpu_cores || 0,
          available_vram_gb: nodeData.max_vram_gb || 0,
          available_cpu_cores: nodeData.max_cpu_cores || 0
        },
        network_info: {
          endpoint: nodeData.endpoint,
          region: nodeData.region || 'unknown'
        },
        location: {
          region: nodeData.region || 'unknown'
        },
        pricing: nodeData.pricing || {}
      };

      const node = await Node.create(nodeDbData);
      await this.initializeNodeMetrics(node.id);

      logger.info(`Node ${node.id} registered successfully`, {
        nodeId: node.id,
        endpoint: nodeData.endpoint,
        vram: nodeData.max_vram_gb,
        cpuCores: nodeData.max_cpu_cores,
        models: nodeData.supported_models
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
    try {
      const node = await Node.findById(nodeId);
      if (!node) {
        logger.warn(`Heartbeat from unregistered node: ${nodeId}`);
        return false;
      }

      // Determine new status
      const newStatus = heartbeatData.status === 'busy' ? 'busy' : 'online';

      // Update hardware info with current availability
      const updatedHardwareInfo = { ...node.hardware_info };
      if (heartbeatData.resources) {
        updatedHardwareInfo.available_vram_gb = heartbeatData.resources.available_vram_gb;
        updatedHardwareInfo.available_cpu_cores = heartbeatData.resources.available_cpu_cores;
        updatedHardwareInfo.current_tasks = heartbeatData.resources.current_tasks || 0;
      }

      // Update node status and last seen
      await Node.updateStatus(nodeId, newStatus);

      // Update hardware info
      await db.query(
        'UPDATE nodes SET hardware_info = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify(updatedHardwareInfo), new Date(), nodeId]
      );

      // Save performance metrics if provided
      if (heartbeatData.metrics) {
        await Node.saveMetrics(nodeId, heartbeatData.metrics);
      }

      logger.debug(`Heartbeat processed for node ${nodeId}`, {
        nodeId,
        status: newStatus,
        availableVram: updatedHardwareInfo.available_vram_gb,
        currentTasks: updatedHardwareInfo.current_tasks
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
  async getAvailableNodes(requirements = {}) {
    try {
      // Build requirements for database query
      const dbRequirements = {};

      if (requirements.minVram) {
        dbRequirements.minVramGB = requirements.minVram;
      }
      if (requirements.minCpuCores) {
        dbRequirements.minCpuCores = requirements.minCpuCores;
      }
      if (requirements.region) {
        dbRequirements.region = requirements.region;
      }
      if (requirements.nodeType) {
        dbRequirements.nodeType = requirements.nodeType;
      }

      // Get available nodes from database
      let availableNodes = await Node.getAvailableNodes(dbRequirements);

      // Additional filtering for model requirements
      if (requirements.models && requirements.models.length > 0) {
        availableNodes = availableNodes.filter(node => {
          const supportedModels = node.capabilities?.supported_models || [];
          return requirements.models.some(model => supportedModels.includes(model));
        });
      }

      // Filter out nodes that haven't sent heartbeat recently
      const now = Date.now();
      availableNodes = availableNodes.filter(node => {
        if (!node.last_seen) return false;
        const timeSinceHeartbeat = now - new Date(node.last_seen).getTime();
        return timeSinceHeartbeat <= this.nodeTimeout;
      });

      return availableNodes;
    } catch (error) {
      logger.error('Error getting available nodes:', error);
      return [];
    }
  }

  /**
   * Update node rating based on performance
   */
  async updateNodeRating(nodeId, taskOutcome) {
    try {
      const node = await Node.findById(nodeId);
      if (!node) return false;

      // Calculate new rating based on task outcome
      let rating = taskOutcome.success ? 1 : 0;
      if (taskOutcome.responseTime) {
        // Better response times get higher ratings
        const responseTimeScore = Math.max(0, 1 - (taskOutcome.responseTime / 30000)); // 30s max
        rating = (rating + responseTimeScore) / 2;
      }

      // Update node reputation in database
      await Node.updateReputation(nodeId, rating);

      logger.debug(`Updated rating for node ${nodeId}`, {
        nodeId,
        taskOutcome,
        newRating: rating
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
    try {
      const node = await Node.findById(nodeId);
      if (!node) return false;

      // Deactivate node in database
      await Node.deactivate(nodeId);

      logger.info(`Node ${nodeId} removed from network`, {
        nodeId,
        reason,
        totalJobs: node.total_jobs_completed || 0
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
  async getNetworkStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_nodes,
          COUNT(CASE WHEN status = 'online' THEN 1 END) as active_nodes,
          COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_nodes,
          COUNT(CASE WHEN status = 'busy' THEN 1 END) as busy_nodes,
          AVG(reputation_score) as avg_reputation,
          SUM(total_jobs_completed) as network_jobs_completed
        FROM nodes
      `);

      return {
        total_nodes: parseInt(result.rows[0].total_nodes),
        active_nodes: parseInt(result.rows[0].active_nodes),
        offline_nodes: parseInt(result.rows[0].offline_nodes),
        busy_nodes: parseInt(result.rows[0].busy_nodes),
        avg_reputation: parseFloat(result.rows[0].avg_reputation) || 0,
        network_jobs_completed: parseInt(result.rows[0].network_jobs_completed) || 0
      };
    } catch (error) {
      logger.error('Error getting network stats:', error);
      return {
        total_nodes: 0,
        active_nodes: 0,
        offline_nodes: 0,
        busy_nodes: 0,
        avg_reputation: 0,
        network_jobs_completed: 0
      };
    }
  }

  /**
   * Initialize metrics tracking for a node
   */
  async initializeNodeMetrics(nodeId) {
    try {
      // Metrics are now stored in the database via Node.saveMetrics
      logger.debug(`Initialized metrics tracking for node ${nodeId}`);
    } catch (error) {
      logger.error(`Error initializing metrics for node ${nodeId}:`, error);
    }
  }

  /**
   * Get specific node information
   */
  async getNode(nodeId) {
    try {
      return await Node.findById(nodeId);
    } catch (error) {
      logger.error(`Error getting node ${nodeId}:`, error);
      return null;
    }
  }

  /**
   * Get all nodes with optional filtering
   */
  async getAllNodes(filter = {}) {
    try {
      // Build database query conditions
      const conditions = {};
      if (filter.status) {
        conditions.status = filter.status;
      }

      // Get nodes from database
      let nodes = await db.query(
        'SELECT * FROM nodes WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC',
        [filter.status || null]
      );

      nodes = nodes.rows;

      // Additional filtering
      if (filter.region) {
        nodes = nodes.filter(n => n.location?.region === filter.region);
      }

      if (filter.minRating) {
        nodes = nodes.filter(n => (n.reputation_score || 0) >= filter.minRating);
      }

      return nodes;
    } catch (error) {
      logger.error('Error getting all nodes:', error);
      return [];
    }
  }

  /**
   * Start cleanup timer for inactive nodes
   */
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveNodes();
    }, 60000); // Run every minute
  }

  /**
   * Clean up inactive nodes
   */
  async cleanupInactiveNodes() {
    try {
      const cutoffTime = new Date(Date.now() - this.nodeTimeout);

      // Mark nodes as offline if they haven't sent heartbeat recently
      await db.query(
        "UPDATE nodes SET status = 'offline' WHERE last_seen < $1 AND status != 'offline'",
        [cutoffTime]
      );

      logger.debug('Cleaned up inactive nodes');
    } catch (error) {
      logger.error('Error cleaning up inactive nodes:', error);
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
   * Initialize the service
   */
  async initialize() {
    logger.info('NodeManager initialized');
  }
}

module.exports = NodeManager;
