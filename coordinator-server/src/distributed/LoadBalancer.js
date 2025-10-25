/**
 * Load Balancer - Intelligent load balancing and resource allocation
 * Handles dynamic load distribution across network nodes with adaptive algorithms
 */

const { EventEmitter } = require('events');

class LoadBalancer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.nodeManager = options.nodeManager;
    this.taskScheduler = options.taskScheduler;

    // Configuration
    this.config = {
      algorithm: options.algorithm || 'weighted_round_robin', // 'round_robin', 'least_connections', 'weighted_round_robin', 'adaptive'
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      loadThreshold: options.loadThreshold || 0.8, // 80%
      responseTimeThreshold: options.responseTimeThreshold || 5000, // 5 seconds
      enablePreemption: options.enablePreemption !== false,
      enableMigration: options.enableMigration !== false,
      balancingInterval: options.balancingInterval || 60000 // 1 minute
    };

    // State
    this.nodeStates = new Map();
    this.nodeWeights = new Map();
    this.currentRoundRobinIndex = 0;
    this.lastBalancingTime = 0;

    // Statistics
    this.stats = {
      totalRequestsBalanced: 0,
      nodeFailovers: 0,
      taskMigrations: 0,
      averageResponseTime: 0,
      loadDistribution: new Map()
    };

    // Start monitoring
    this.healthCheckInterval = setInterval(() => this.performHealthChecks(), this.config.healthCheckInterval);
    this.balancingInterval = setInterval(() => this.performLoadBalancing(), this.config.balancingInterval);

    this.isRunning = true;
  }

  async selectNode(task, availableNodes) {
    try {
      if (!availableNodes || availableNodes.length === 0) {
        return null;
      }

      // Update node states
      await this.updateNodeStates(availableNodes);

      // Select node based on algorithm
      let selectedNode;

      switch (this.config.algorithm) {
      case 'round_robin':
        selectedNode = this.selectRoundRobin(availableNodes);
        break;
      case 'least_connections':
        selectedNode = this.selectLeastConnections(availableNodes);
        break;
      case 'weighted_round_robin':
        selectedNode = this.selectWeightedRoundRobin(availableNodes);
        break;
      case 'adaptive':
        selectedNode = this.selectAdaptive(task, availableNodes);
        break;
      default:
        selectedNode = this.selectWeightedRoundRobin(availableNodes);
      }

      if (selectedNode) {
        this.recordSelection(selectedNode);
      }

      return selectedNode;

    } catch (error) {
      console.error('Error in node selection:', error);
      return availableNodes[0]; // Fallback to first available node
    }
  }

  async updateNodeStates(nodes) {
    for (const node of nodes) {
      if (!this.nodeStates.has(node.id)) {
        this.nodeStates.set(node.id, {
          id: node.id,
          consecutiveFailures: 0,
          lastHealthCheck: new Date(),
          averageResponseTime: 0,
          responseTimeHistory: [],
          loadHistory: [],
          utilization: 0,
          isHealthy: true
        });
      }

      const state = this.nodeStates.get(node.id);

      // Update basic metrics
      state.utilization = node.currentLoad / node.maxLoad;
      state.loadHistory.push(state.utilization);

      // Keep history limited
      if (state.loadHistory.length > 20) {
        state.loadHistory.shift();
      }
      if (state.responseTimeHistory.length > 20) {
        state.responseTimeHistory.shift();
      }

      // Calculate weights
      this.calculateNodeWeight(node.id, state);
    }
  }

  calculateNodeWeight(nodeId, state) {
    let weight = 100; // Base weight

    // Adjust based on utilization (lower utilization = higher weight)
    const utilizationFactor = (1 - state.utilization) * 50;
    weight += utilizationFactor;

    // Adjust based on response time
    if (state.averageResponseTime > 0) {
      const responseTimeFactor = Math.max(0, (5000 - state.averageResponseTime) / 100);
      weight += responseTimeFactor;
    }

    // Adjust based on health
    if (!state.isHealthy) {
      weight *= 0.1; // Heavily penalize unhealthy nodes
    }

    // Adjust based on consecutive failures
    weight *= Math.max(0.1, 1 - (state.consecutiveFailures * 0.2));

    this.nodeWeights.set(nodeId, Math.max(1, weight));
  }

  selectRoundRobin(nodes) {
    if (nodes.length === 0) return null;

    const selectedNode = nodes[this.currentRoundRobinIndex % nodes.length];
    this.currentRoundRobinIndex++;

    return selectedNode;
  }

  selectLeastConnections(nodes) {
    if (nodes.length === 0) return null;

    return nodes.reduce((best, current) => {
      const currentConnections = current.currentLoad || 0;
      const bestConnections = best.currentLoad || 0;

      return currentConnections < bestConnections ? current : best;
    });
  }

  selectWeightedRoundRobin(nodes) {
    if (nodes.length === 0) return null;

    // Calculate total weight
    let totalWeight = 0;
    const weights = [];

    for (const node of nodes) {
      const weight = this.nodeWeights.get(node.id) || 50;
      weights.push(weight);
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return this.selectRoundRobin(nodes);
    }

    // Select based on weighted probability
    let randomWeight = Math.random() * totalWeight;

    for (let i = 0; i < nodes.length; i++) {
      randomWeight -= weights[i];
      if (randomWeight <= 0) {
        return nodes[i];
      }
    }

    return nodes[nodes.length - 1]; // Fallback
  }

  selectAdaptive(task, nodes) {
    if (nodes.length === 0) return null;

    // Score nodes based on multiple factors
    const scoredNodes = nodes.map(node => {
      const state = this.nodeStates.get(node.id);
      let score = 0;

      // Base compatibility score from task
      if (task && typeof task.getCompatibilityScore === 'function') {
        score += task.getCompatibilityScore(node);
      } else {
        score += 50; // Default base score
      }

      // Load balancing factor
      const loadFactor = (1 - (node.currentLoad / node.maxLoad)) * 30;
      score += loadFactor;

      // Response time factor
      if (state && state.averageResponseTime > 0) {
        const responseTimeFactor = Math.max(0, (5000 - state.averageResponseTime) / 100);
        score += responseTimeFactor;
      }

      // Health factor
      if (state && !state.isHealthy) {
        score *= 0.5;
      }

      // Failure rate factor
      if (state && state.consecutiveFailures > 0) {
        score *= Math.max(0.3, 1 - (state.consecutiveFailures * 0.15));
      }

      return { node, score };
    });

    // Sort by score and apply some randomization to top candidates
    scoredNodes.sort((a, b) => b.score - a.score);

    // Select from top 3 candidates with weighted randomization
    const topCandidates = scoredNodes.slice(0, Math.min(3, scoredNodes.length));
    const totalScore = topCandidates.reduce((sum, candidate) => sum + candidate.score, 0);

    if (totalScore === 0) {
      return topCandidates[0].node;
    }

    let randomScore = Math.random() * totalScore;
    for (const candidate of topCandidates) {
      randomScore -= candidate.score;
      if (randomScore <= 0) {
        return candidate.node;
      }
    }

    return topCandidates[0].node;
  }

  recordSelection(node) {
    this.stats.totalRequestsBalanced++;

    // Update load distribution stats
    if (!this.stats.loadDistribution.has(node.id)) {
      this.stats.loadDistribution.set(node.id, 0);
    }
    this.stats.loadDistribution.set(node.id, this.stats.loadDistribution.get(node.id) + 1);
  }

  async performHealthChecks() {
    if (!this.nodeManager) return;

    try {
      const allNodes = await this.nodeManager.getAllNodes();

      for (const node of allNodes) {
        const state = this.nodeStates.get(node.id);
        if (!state) continue;

        try {
          // Perform health check (ping or status check)
          const healthResult = await this.checkNodeHealth(node);

          if (healthResult.healthy) {
            state.isHealthy = true;
            state.consecutiveFailures = 0;
            state.lastHealthCheck = new Date();

            // Update response time
            if (healthResult.responseTime) {
              state.responseTimeHistory.push(healthResult.responseTime);
              if (state.responseTimeHistory.length > 0) {
                state.averageResponseTime = state.responseTimeHistory.reduce((a, b) => a + b) / state.responseTimeHistory.length;
              }
            }
          } else {
            state.consecutiveFailures++;
            if (state.consecutiveFailures >= 3) {
              state.isHealthy = false;
              this.handleUnhealthyNode(node);
            }
          }

        } catch (error) {
          state.consecutiveFailures++;
          if (state.consecutiveFailures >= 3) {
            state.isHealthy = false;
            this.handleUnhealthyNode(node);
          }
        }
      }

    } catch (error) {
      console.error('Error performing health checks:', error);
    }
  }

  async checkNodeHealth(_node) {
    try {
      const startTime = Date.now();

      // Simple ping to node's health endpoint
      // In a real implementation, this would make an actual HTTP request
      const mockHealthy = Math.random() > 0.05; // 95% success rate
      const responseTime = Date.now() - startTime + Math.random() * 100;

      return {
        healthy: mockHealthy,
        responseTime: responseTime
      };

    } catch (error) {
      return {
        healthy: false,
        responseTime: null,
        error: error.message
      };
    }
  }

  handleUnhealthyNode(node) {
    console.warn(`Node ${node.id} marked as unhealthy`);

    this.emit('nodeUnhealthy', node);

    // If migration is enabled, migrate tasks from this node
    if (this.config.enableMigration && this.taskScheduler) {
      this.migrateTasks(node.id);
    }
  }

  async migrateTasks(unhealthyNodeId) {
    try {
      if (!this.taskScheduler) return;

      // Get running tasks on the unhealthy node
      const runningTasks = await this.taskScheduler.getTasks({
        status: 'running',
        nodeId: unhealthyNodeId
      });

      for (const taskData of runningTasks) {
        // Cancel the task on the unhealthy node
        await this.taskScheduler.cancelTask(taskData.id);

        // Create a new task (retry)
        const newTaskData = {
          ...taskData,
          id: undefined, // Let system generate new ID
          priority: Math.min(taskData.priority + 1, 10) // Increase priority
        };

        await this.taskScheduler.createTask(newTaskData);
        this.stats.taskMigrations++;
      }

      console.log(`Migrated ${runningTasks.length} tasks from unhealthy node ${unhealthyNodeId}`);

    } catch (error) {
      console.error(`Error migrating tasks from node ${unhealthyNodeId}:`, error);
    }
  }

  async performLoadBalancing() {
    if (!this.nodeManager) return;

    try {
      const now = Date.now();
      if (now - this.lastBalancingTime < this.config.balancingInterval) {
        return;
      }

      const activeNodes = await this.nodeManager.getActiveNodes();
      if (activeNodes.length < 2) return;

      // Calculate load imbalance
      const loadInfo = this.calculateLoadImbalance(activeNodes);

      if (loadInfo.imbalanceRatio > 0.3) { // 30% imbalance threshold
        console.log(`Load imbalance detected: ${(loadInfo.imbalanceRatio * 100).toFixed(1)}%`);

        // Attempt to rebalance
        await this.rebalanceLoad(loadInfo.overloadedNodes, loadInfo.underloadedNodes);
      }

      this.lastBalancingTime = now;

    } catch (error) {
      console.error('Error performing load balancing:', error);
    }
  }

  calculateLoadImbalance(nodes) {
    const loadValues = nodes.map(node => node.currentLoad / node.maxLoad);
    const avgLoad = loadValues.reduce((a, b) => a + b) / loadValues.length;
    const maxLoad = Math.max(...loadValues);
    const minLoad = Math.min(...loadValues);

    const imbalanceRatio = maxLoad - minLoad;

    const overloadedNodes = nodes.filter(node =>
      (node.currentLoad / node.maxLoad) > (avgLoad + 0.2)
    );

    const underloadedNodes = nodes.filter(node =>
      (node.currentLoad / node.maxLoad) < (avgLoad - 0.2)
    );

    return {
      avgLoad,
      maxLoad,
      minLoad,
      imbalanceRatio,
      overloadedNodes,
      underloadedNodes
    };
  }

  async rebalanceLoad(overloadedNodes, underloadedNodes) {
    if (!this.config.enableMigration || !this.taskScheduler) {
      return;
    }

    for (const overloadedNode of overloadedNodes) {
      // Get preemptible tasks (lower priority tasks)
      const tasks = await this.taskScheduler.getTasks({
        status: 'running',
        nodeId: overloadedNode.id
      });

      // Sort by priority (lowest first) and take only preemptible tasks
      const preemptibleTasks = tasks
        .filter(task => task.priority <= 7) // Only preempt lower priority tasks
        .sort((a, b) => a.priority - b.priority)
        .slice(0, Math.min(2, underloadedNodes.length)); // Limit migrations

      for (let i = 0; i < preemptibleTasks.length && i < underloadedNodes.length; i++) {
        const task = preemptibleTasks[i];
        const targetNode = underloadedNodes[i];

        try {
          // Cancel task on overloaded node
          await this.taskScheduler.cancelTask(task.id);

          // Create new task with higher priority
          const newTaskData = {
            ...task,
            id: undefined,
            priority: Math.min(task.priority + 1, 10),
            metadata: {
              ...task.metadata,
              migrated: true,
              originalNode: overloadedNode.id,
              targetNode: targetNode.id
            }
          };

          await this.taskScheduler.createTask(newTaskData);
          this.stats.taskMigrations++;

          console.log(`Migrated task ${task.id} from ${overloadedNode.id} to ${targetNode.id}`);

        } catch (error) {
          console.error(`Error migrating task ${task.id}:`, error);
        }
      }
    }
  }

  // API Methods

  getLoadDistribution() {
    const distribution = {};
    for (const [nodeId, count] of this.stats.loadDistribution.entries()) {
      distribution[nodeId] = {
        requestCount: count,
        percentage: (count / this.stats.totalRequestsBalanced) * 100
      };
    }
    return distribution;
  }

  getNodeStates() {
    const states = {};
    for (const [nodeId, state] of this.nodeStates.entries()) {
      states[nodeId] = {
        ...state,
        weight: this.nodeWeights.get(nodeId) || 0,
        responseTimeHistory: state.responseTimeHistory.slice(-10) // Last 10 entries
      };
    }
    return states;
  }

  getBalancerStats() {
    return {
      ...this.stats,
      algorithm: this.config.algorithm,
      activeNodes: this.nodeStates.size,
      healthyNodes: Array.from(this.nodeStates.values()).filter(s => s.isHealthy).length,
      loadDistribution: this.getLoadDistribution()
    };
  }

  setAlgorithm(algorithm) {
    const validAlgorithms = ['round_robin', 'least_connections', 'weighted_round_robin', 'adaptive'];
    if (validAlgorithms.includes(algorithm)) {
      this.config.algorithm = algorithm;
      console.log(`Load balancing algorithm changed to: ${algorithm}`);
      return true;
    }
    return false;
  }

  async shutdown() {
    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.balancingInterval) {
      clearInterval(this.balancingInterval);
    }

    this.removeAllListeners();
  }
}

module.exports = { LoadBalancer };
