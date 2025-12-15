const logger = require('../utils/logger');

/**
 * Enhanced Node Reputation System
 * Адаптировано из лучших практик Gonka с фокусом на NeuroGrid
 */
class NodeReputationSystem {
  constructor(config = {}) {
    this.config = {
      initialReputation: 100,
      maxReputation: 1000,
      minReputation: 0,
      reputationDecayRate: 0.99, // Ежедневное снижение на 1%
      bonusMultiplier: config.bonusMultiplier || 1.2,
      penaltyMultiplier: config.penaltyMultiplier || 0.5,
      validationThreshold: config.validationThreshold || 80,
      trustLevels: {
        novice: { min: 0, max: 100, validationRate: 0.8 },
        trusted: { min: 100, max: 500, validationRate: 0.3 },
        expert: { min: 500, max: 1000, validationRate: 0.1 }
      },
      ...config
    };

    // Reputation storage
    this.nodeReputations = new Map();
    this.reputationHistory = new Map();
    this.validationStats = new Map();
    this.lastUpdate = new Date();

    logger.info('Enhanced Node Reputation System initialized');
  }

  /**
   * Register new node with initial reputation
   */
  registerNode(nodeId, metadata = {}) {
    if (this.nodeReputations.has(nodeId)) {
      throw new Error(`Node ${nodeId} already registered`);
    }

    const nodeReputation = {
      nodeId,
      reputation: this.config.initialReputation,
      level: 'novice',
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      resourceEfficiency: 1.0,
      uptime: 1.0,
      lastActive: new Date(),
      joinDate: new Date(),
      penalties: [],
      bonuses: [],
      metadata
    };

    this.nodeReputations.set(nodeId, nodeReputation);
    this.reputationHistory.set(nodeId, []);
    this.validationStats.set(nodeId, {
      validationsRequired: 0,
      validationsCompleted: 0,
      validationSuccess: 0
    });

    logger.info(`Node ${nodeId} registered with reputation ${this.config.initialReputation}`);
    return nodeReputation;
  }

  /**
   * Update reputation based on task performance
   */
  updateTaskPerformance(nodeId, taskResult) {
    const node = this.nodeReputations.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const {
      success,
      executionTime,
      expectedTime,
      resourceUsage,
      qualityScore = 1.0,
      taskComplexity = 1.0
    } = taskResult;

    // Update task counters
    node.totalTasks++;
    node.lastActive = new Date();

    if (success) {
      node.successfulTasks++;

      // Calculate performance bonuses
      const timeBonus = this.calculateTimeBonus(executionTime, expectedTime);
      const qualityBonus = this.calculateQualityBonus(qualityScore);
      const complexityBonus = this.calculateComplexityBonus(taskComplexity);

      const totalBonus = (timeBonus + qualityBonus + complexityBonus) * this.config.bonusMultiplier;

      // Apply bonus
      node.reputation += totalBonus;
      node.bonuses.push({
        amount: totalBonus,
        reason: 'task_success',
        timestamp: new Date(),
        details: { timeBonus, qualityBonus, complexityBonus }
      });

      logger.debug(`Node ${nodeId} earned reputation bonus: ${totalBonus.toFixed(2)}`);

    } else {
      node.failedTasks++;

      // Calculate penalty
      const penalty = this.calculateFailurePenalty(taskComplexity) * this.config.penaltyMultiplier;

      // Apply penalty
      node.reputation -= penalty;
      node.penalties.push({
        amount: penalty,
        reason: 'task_failure',
        timestamp: new Date(),
        details: taskResult.error
      });

      logger.warn(`Node ${nodeId} received reputation penalty: ${penalty.toFixed(2)}`);
    }

    // Update averages
    this.updateNodeAverages(node, taskResult);

    // Apply reputation bounds
    node.reputation = Math.max(this.config.minReputation,
      Math.min(this.config.maxReputation, node.reputation));

    // Update trust level
    this.updateTrustLevel(node);

    // Record in history
    this.recordReputationChange(nodeId, node.reputation, 'task_performance');

    return node.reputation;
  }

  /**
   * Calculate time-based bonus
   */
  calculateTimeBonus(executionTime, expectedTime) {
    if (!expectedTime || executionTime >= expectedTime) return 0;

    const timeRatio = expectedTime / executionTime;
    return Math.min(20, timeRatio * 5); // Max 20 points for exceptional speed
  }

  /**
   * Calculate quality-based bonus
   */
  calculateQualityBonus(qualityScore) {
    if (qualityScore <= 0.8) return 0;
    return (qualityScore - 0.8) * 50; // Up to 10 points for perfect quality
  }

  /**
   * Calculate complexity-based bonus
   */
  calculateComplexityBonus(taskComplexity) {
    return Math.log(1 + taskComplexity) * 5; // Logarithmic scaling
  }

  /**
   * Calculate failure penalty
   */
  calculateFailurePenalty(taskComplexity) {
    return 10 + (taskComplexity * 5); // Base penalty plus complexity factor
  }

  /**
   * Update node averages
   */
  updateNodeAverages(node, taskResult) {
    const { executionTime, resourceUsage } = taskResult;

    // Update execution time average
    if (executionTime) {
      node.averageExecutionTime = (node.averageExecutionTime * (node.totalTasks - 1) + executionTime) / node.totalTasks;
    }

    // Update resource efficiency
    if (resourceUsage && resourceUsage.efficiency) {
      node.resourceEfficiency = (node.resourceEfficiency * (node.totalTasks - 1) + resourceUsage.efficiency) / node.totalTasks;
    }
  }

  /**
   * Update trust level based on reputation
   */
  updateTrustLevel(node) {
    const oldLevel = node.level;

    for (const [level, range] of Object.entries(this.config.trustLevels)) {
      if (node.reputation >= range.min && node.reputation < range.max) {
        node.level = level;
        break;
      }
    }

    if (node.level !== oldLevel) {
      logger.info(`Node ${node.nodeId} trust level changed: ${oldLevel} → ${node.level}`);
    }
  }

  /**
   * Get validation probability for node
   */
  getValidationProbability(nodeId) {
    const node = this.nodeReputations.get(nodeId);
    if (!node) return 1.0; // Unknown nodes get full validation

    const trustLevel = this.config.trustLevels[node.level];
    return trustLevel ? trustLevel.validationRate : 1.0;
  }

  /**
   * Should this task be validated?
   */
  shouldValidateTask(nodeId) {
    const probability = this.getValidationProbability(nodeId);
    return Math.random() < probability;
  }

  /**
   * Record reputation change in history
   */
  recordReputationChange(nodeId, newReputation, reason) {
    const history = this.reputationHistory.get(nodeId) || [];
    history.push({
      reputation: newReputation,
      reason,
      timestamp: new Date()
    });

    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    this.reputationHistory.set(nodeId, history);
  }

  /**
   * Apply daily reputation decay
   */
  applyReputationDecay() {
    const now = new Date();
    const daysSinceLastUpdate = (now - this.lastUpdate) / (1000 * 60 * 60 * 24);

    if (daysSinceLastUpdate >= 1) {
      for (const [nodeId, node] of this.nodeReputations) {
        const decayFactor = Math.pow(this.config.reputationDecayRate, daysSinceLastUpdate);
        const oldReputation = node.reputation;

        node.reputation = Math.max(
          this.config.minReputation,
          node.reputation * decayFactor
        );

        if (node.reputation !== oldReputation) {
          this.recordReputationChange(nodeId, node.reputation, 'daily_decay');
        }

        this.updateTrustLevel(node);
      }

      this.lastUpdate = now;
      logger.info(`Applied reputation decay to ${this.nodeReputations.size} nodes`);
    }
  }

  /**
   * Get node reputation info
   */
  getNodeReputation(nodeId) {
    const node = this.nodeReputations.get(nodeId);
    if (!node) return null;

    return {
      nodeId: node.nodeId,
      reputation: Math.round(node.reputation * 100) / 100,
      level: node.level,
      successRate: node.totalTasks > 0 ? node.successfulTasks / node.totalTasks : 0,
      totalTasks: node.totalTasks,
      averageExecutionTime: node.averageExecutionTime,
      resourceEfficiency: node.resourceEfficiency,
      uptime: node.uptime,
      validationProbability: this.getValidationProbability(nodeId),
      lastActive: node.lastActive,
      joinDate: node.joinDate
    };
  }

  /**
   * Get top performing nodes
   */
  getTopNodes(limit = 10) {
    return Array.from(this.nodeReputations.values())
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, limit)
      .map(node => this.getNodeReputation(node.nodeId));
  }

  /**
   * Get reputation statistics
   */
  getReputationStats() {
    const nodes = Array.from(this.nodeReputations.values());
    const reputations = nodes.map(n => n.reputation);

    return {
      totalNodes: nodes.length,
      averageReputation: reputations.reduce((a, b) => a + b, 0) / reputations.length || 0,
      maxReputation: Math.max(...reputations) || 0,
      minReputation: Math.min(...reputations) || 0,
      trustLevelDistribution: {
        novice: nodes.filter(n => n.level === 'novice').length,
        trusted: nodes.filter(n => n.level === 'trusted').length,
        expert: nodes.filter(n => n.level === 'expert').length
      }
    };
  }
}

module.exports = NodeReputationSystem;
