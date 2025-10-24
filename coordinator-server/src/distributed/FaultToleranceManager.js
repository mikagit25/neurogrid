/**
 * Fault Tolerance Manager - Handles fault detection, recovery, and system resilience
 * Implements comprehensive fault tolerance strategies for distributed computing
 */

const { EventEmitter } = require('events');

class FaultToleranceManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.nodeManager = options.nodeManager;
        this.taskScheduler = options.taskScheduler;
        this.loadBalancer = options.loadBalancer;
        
        // Configuration
        this.config = {
            heartbeatInterval: options.heartbeatInterval || 15000, // 15 seconds
            heartbeatTimeout: options.heartbeatTimeout || 45000, // 45 seconds
            maxFailureCount: options.maxFailureCount || 3,
            recoveryTimeout: options.recoveryTimeout || 300000, // 5 minutes
            checkpointInterval: options.checkpointInterval || 120000, // 2 minutes
            enableAutoRecovery: options.enableAutoRecovery !== false,
            enableCheckpointing: options.enableCheckpointing !== false,
            enableReplication: options.enableReplication !== false,
            replicationFactor: options.replicationFactor || 2
        };
        
        // State tracking
        this.nodeStates = new Map();
        this.failurePatterns = new Map();
        this.checkpoints = new Map();
        this.replicationGroups = new Map();
        
        // Statistics
        this.stats = {
            totalFailures: 0,
            nodeFailures: 0,
            taskFailures: 0,
            networkFailures: 0,
            recoveredNodes: 0,
            recoveredTasks: 0,
            checkpointsCreated: 0,
            checkpointsUsed: 0,
            averageRecoveryTime: 0,
            totalRecoveryTime: 0
        };
        
        // Start monitoring
        this.heartbeatInterval = setInterval(() => this.performHeartbeatCheck(), this.config.heartbeatInterval);
        this.checkpointInterval = setInterval(() => this.performCheckpointing(), this.config.checkpointInterval);
        this.recoveryInterval = setInterval(() => this.performRecoveryAttempts(), 30000); // Every 30 seconds
        
        this.isRunning = true;
        
        // Initialize failure detection
        this.initializeFailureDetection();
    }

    initializeFailureDetection() {
        // Listen for various failure events
        if (this.nodeManager) {
            this.nodeManager.on('nodeDisconnected', (node) => this.handleNodeFailure(node, 'disconnection'));
            this.nodeManager.on('nodeTimeout', (node) => this.handleNodeFailure(node, 'timeout'));
            this.nodeManager.on('nodeError', (node, error) => this.handleNodeFailure(node, 'error', error));
        }
        
        if (this.taskScheduler) {
            this.taskScheduler.on('taskFailed', (task) => this.handleTaskFailure(task));
            this.taskScheduler.on('taskTimeout', (task) => this.handleTaskFailure(task, 'timeout'));
        }
        
        if (this.loadBalancer) {
            this.loadBalancer.on('nodeUnhealthy', (node) => this.handleNodeFailure(node, 'health_check'));
        }
    }

    async performHeartbeatCheck() {
        if (!this.nodeManager) return;
        
        try {
            const allNodes = await this.nodeManager.getAllNodes();
            const now = Date.now();
            
            for (const node of allNodes) {
                if (!this.nodeStates.has(node.id)) {
                    this.initializeNodeState(node);
                }
                
                const nodeState = this.nodeStates.get(node.id);
                
                // Check if heartbeat is overdue
                if (node.status === 'active' && nodeState.lastHeartbeat) {
                    const timeSinceLastHeartbeat = now - nodeState.lastHeartbeat;
                    
                    if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
                        console.warn(`Heartbeat timeout for node ${node.id}`);
                        await this.handleNodeFailure(node, 'heartbeat_timeout');
                    }
                }
                
                // Update heartbeat (simulate receiving heartbeat)
                if (node.status === 'active') {
                    nodeState.lastHeartbeat = now;
                }
            }
            
        } catch (error) {
            console.error('Error performing heartbeat check:', error);
        }
    }

    initializeNodeState(node) {
        this.nodeStates.set(node.id, {
            id: node.id,
            status: node.status,
            lastHeartbeat: Date.now(),
            failureCount: 0,
            lastFailure: null,
            recoveryAttempts: 0,
            isQuarantined: false,
            quarantineUntil: null,
            performanceHistory: [],
            taskSuccessRate: 1.0,
            totalTasks: 0,
            successfulTasks: 0
        });
    }

    async handleNodeFailure(node, failureType, error = null) {
        try {
            console.error(`Node failure detected: ${node.id} - Type: ${failureType}`);
            
            const nodeState = this.nodeStates.get(node.id) || this.initializeNodeState(node);
            
            // Update failure tracking
            nodeState.failureCount++;
            nodeState.lastFailure = {
                type: failureType,
                timestamp: new Date(),
                error: error?.message || null
            };
            
            this.stats.totalFailures++;
            this.stats.nodeFailures++;
            
            // Track failure patterns
            this.updateFailurePatterns(node.id, failureType);
            
            // Emit failure event
            this.emit('nodeFailure', {
                node,
                failureType,
                error,
                nodeState
            });
            
            // Handle running tasks on failed node
            await this.handleFailedNodeTasks(node.id);
            
            // Determine recovery strategy
            await this.initiateNodeRecovery(node, nodeState);
            
            // Update replication groups if needed
            if (this.config.enableReplication) {
                await this.updateReplicationGroups(node.id, 'remove');
            }
            
        } catch (recoveryError) {
            console.error(`Error handling node failure for ${node.id}:`, recoveryError);
        }
    }

    updateFailurePatterns(nodeId, failureType) {
        if (!this.failurePatterns.has(nodeId)) {
            this.failurePatterns.set(nodeId, {
                totalFailures: 0,
                failureTypes: {},
                failureTimestamps: [],
                isRepeatingFailure: false,
                dominantFailureType: null
            });
        }
        
        const pattern = this.failurePatterns.get(nodeId);
        pattern.totalFailures++;
        pattern.failureTypes[failureType] = (pattern.failureTypes[failureType] || 0) + 1;
        pattern.failureTimestamps.push(Date.now());
        
        // Keep only recent failures (last hour)
        const oneHourAgo = Date.now() - 3600000;
        pattern.failureTimestamps = pattern.failureTimestamps.filter(ts => ts > oneHourAgo);
        
        // Determine dominant failure type
        const maxFailures = Math.max(...Object.values(pattern.failureTypes));
        pattern.dominantFailureType = Object.keys(pattern.failureTypes)
            .find(type => pattern.failureTypes[type] === maxFailures);
        
        // Check for repeating failures
        pattern.isRepeatingFailure = pattern.failureTimestamps.length >= 3 &&
            pattern.failureTimestamps.slice(-3).every((ts, i, arr) => 
                i === 0 || (ts - arr[i-1]) < 300000 // Within 5 minutes
            );
    }

    async handleFailedNodeTasks(nodeId) {
        if (!this.taskScheduler) return;
        
        try {
            // Get all running tasks on the failed node
            const runningTasks = await this.taskScheduler.getTasks({
                status: 'running',
                nodeId: nodeId
            });
            
            console.log(`Handling ${runningTasks.length} tasks from failed node ${nodeId}`);
            
            for (const taskData of runningTasks) {
                await this.recoverTask(taskData);
            }
            
        } catch (error) {
            console.error(`Error handling tasks from failed node ${nodeId}:`, error);
        }
    }

    async recoverTask(taskData) {
        try {
            // Check if checkpoint exists
            const checkpoint = this.checkpoints.get(taskData.id);
            
            if (checkpoint && this.config.enableCheckpointing) {
                // Restore from checkpoint
                await this.restoreTaskFromCheckpoint(taskData, checkpoint);
                this.stats.checkpointsUsed++;
            } else {
                // Restart task from beginning
                await this.restartTask(taskData);
            }
            
            this.stats.recoveredTasks++;
            
        } catch (error) {
            console.error(`Error recovering task ${taskData.id}:`, error);
            this.stats.taskFailures++;
        }
    }

    async restoreTaskFromCheckpoint(taskData, checkpoint) {
        console.log(`Restoring task ${taskData.id} from checkpoint`);
        
        // Create new task with checkpoint state
        const restoredTaskData = {
            ...taskData,
            id: undefined, // Generate new ID
            payload: {
                ...taskData.payload,
                checkpointData: checkpoint.data,
                resumeFromCheckpoint: true
            },
            priority: Math.min(taskData.priority + 1, 10), // Increase priority
            metadata: {
                ...taskData.metadata,
                restored: true,
                originalTaskId: taskData.id,
                checkpointTimestamp: checkpoint.timestamp
            }
        };
        
        if (this.taskScheduler) {
            await this.taskScheduler.createTask(restoredTaskData);
        }
    }

    async restartTask(taskData) {
        console.log(`Restarting task ${taskData.id} from beginning`);
        
        // Create new task with higher priority
        const restartedTaskData = {
            ...taskData,
            id: undefined, // Generate new ID
            priority: Math.min(taskData.priority + 2, 10), // Higher priority for restarted tasks
            retryCount: (taskData.retryCount || 0) + 1,
            metadata: {
                ...taskData.metadata,
                restarted: true,
                originalTaskId: taskData.id,
                restartReason: 'node_failure'
            }
        };
        
        if (this.taskScheduler) {
            await this.taskScheduler.createTask(restartedTaskData);
        }
    }

    async initiateNodeRecovery(node, nodeState) {
        if (!this.config.enableAutoRecovery) return;
        
        const recoveryStartTime = Date.now();
        
        // Determine recovery strategy based on failure pattern
        const failurePattern = this.failurePatterns.get(node.id);
        let recoveryStrategy = 'immediate';
        
        if (failurePattern?.isRepeatingFailure) {
            recoveryStrategy = 'quarantine';
        } else if (nodeState.failureCount >= this.config.maxFailureCount) {
            recoveryStrategy = 'delayed';
        }
        
        console.log(`Initiating ${recoveryStrategy} recovery for node ${node.id}`);
        
        switch (recoveryStrategy) {
            case 'immediate':
                await this.attemptImmediateRecovery(node, nodeState);
                break;
            case 'delayed':
                await this.scheduleDelayedRecovery(node, nodeState);
                break;
            case 'quarantine':
                await this.quarantineNode(node, nodeState);
                break;
        }
        
        const recoveryTime = Date.now() - recoveryStartTime;
        this.updateRecoveryStats(recoveryTime);
    }

    async attemptImmediateRecovery(node, nodeState) {
        try {
            // Attempt to ping/reconnect to node
            const recoveryResult = await this.pingNode(node);
            
            if (recoveryResult.success) {
                await this.markNodeRecovered(node, nodeState);
            } else {
                // Schedule retry
                setTimeout(() => this.retryNodeRecovery(node, nodeState), 30000);
            }
            
        } catch (error) {
            console.error(`Immediate recovery failed for node ${node.id}:`, error);
        }
    }

    async scheduleDelayedRecovery(node, nodeState) {
        const delayMs = Math.min(60000 * Math.pow(2, nodeState.recoveryAttempts), 300000); // Exponential backoff, max 5 minutes
        
        console.log(`Scheduling delayed recovery for node ${node.id} in ${delayMs}ms`);
        
        setTimeout(async () => {
            await this.retryNodeRecovery(node, nodeState);
        }, delayMs);
    }

    async quarantineNode(node, nodeState) {
        const quarantineDuration = 600000; // 10 minutes
        
        nodeState.isQuarantined = true;
        nodeState.quarantineUntil = Date.now() + quarantineDuration;
        
        console.log(`Node ${node.id} quarantined for ${quarantineDuration}ms due to repeating failures`);
        
        // Schedule quarantine release
        setTimeout(async () => {
            if (nodeState.quarantineUntil && Date.now() >= nodeState.quarantineUntil) {
                nodeState.isQuarantined = false;
                nodeState.quarantineUntil = null;
                await this.retryNodeRecovery(node, nodeState);
            }
        }, quarantineDuration);
        
        this.emit('nodeQuarantined', { node, duration: quarantineDuration });
    }

    async retryNodeRecovery(node, nodeState) {
        if (nodeState.isQuarantined && Date.now() < nodeState.quarantineUntil) {
            return; // Still in quarantine
        }
        
        nodeState.recoveryAttempts++;
        
        try {
            const recoveryResult = await this.pingNode(node);
            
            if (recoveryResult.success) {
                await this.markNodeRecovered(node, nodeState);
            } else if (nodeState.recoveryAttempts < 5) {
                // Schedule another retry
                await this.scheduleDelayedRecovery(node, nodeState);
            } else {
                console.error(`Node ${node.id} recovery failed after ${nodeState.recoveryAttempts} attempts`);
                this.emit('nodeRecoveryFailed', { node, attempts: nodeState.recoveryAttempts });
            }
            
        } catch (error) {
            console.error(`Recovery retry failed for node ${node.id}:`, error);
        }
    }

    async pingNode(node) {
        try {
            // Simulate node ping/health check
            // In real implementation, this would make actual network calls
            const isHealthy = Math.random() > 0.3; // 70% success rate for simulation
            
            return {
                success: isHealthy,
                responseTime: Math.random() * 1000,
                timestamp: Date.now()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    async markNodeRecovered(node, nodeState) {
        console.log(`Node ${node.id} recovered successfully`);
        
        // Reset failure state
        nodeState.failureCount = 0;
        nodeState.recoveryAttempts = 0;
        nodeState.isQuarantined = false;
        nodeState.quarantineUntil = null;
        
        // Update node status
        if (this.nodeManager) {
            await this.nodeManager.updateNodeStatus(node.id, 'active');
        }
        
        // Add back to replication groups
        if (this.config.enableReplication) {
            await this.updateReplicationGroups(node.id, 'add');
        }
        
        this.stats.recoveredNodes++;
        
        this.emit('nodeRecovered', { node, nodeState });
    }

    async handleTaskFailure(task, failureType = 'error') {
        try {
            console.warn(`Task failure detected: ${task.id} - Type: ${failureType}`);
            
            this.stats.taskFailures++;
            
            // Update node task success rate if assigned
            if (task.assignedNode) {
                const nodeState = this.nodeStates.get(task.assignedNode);
                if (nodeState) {
                    nodeState.totalTasks++;
                    nodeState.taskSuccessRate = nodeState.successfulTasks / nodeState.totalTasks;
                }
            }
            
            this.emit('taskFailure', {
                task,
                failureType,
                nodeId: task.assignedNode
            });
            
        } catch (error) {
            console.error(`Error handling task failure for ${task.id}:`, error);
        }
    }

    async performCheckpointing() {
        if (!this.config.enableCheckpointing || !this.taskScheduler) return;
        
        try {
            // Get long-running tasks for checkpointing
            const runningTasks = await this.taskScheduler.getTasks({ status: 'running' });
            const longRunningTasks = runningTasks.filter(task => {
                const runTime = Date.now() - new Date(task.startedAt).getTime();
                return runTime > 60000; // Tasks running for more than 1 minute
            });
            
            for (const task of longRunningTasks.slice(0, 10)) { // Limit checkpoints
                await this.createCheckpoint(task);
            }
            
        } catch (error) {
            console.error('Error performing checkpointing:', error);
        }
    }

    async createCheckpoint(task) {
        try {
            // Create checkpoint data (simplified simulation)
            const checkpointData = {
                taskId: task.id,
                timestamp: Date.now(),
                progress: Math.random() * 0.8 + 0.1, // 10-90% progress
                state: {
                    currentStep: Math.floor(Math.random() * 100),
                    processedItems: Math.floor(Math.random() * 1000),
                    intermediateResults: `checkpoint_data_${task.id}`
                },
                metadata: {
                    nodeId: task.assignedNode,
                    checkpointSize: Math.floor(Math.random() * 1000000) // bytes
                }
            };
            
            this.checkpoints.set(task.id, {
                data: checkpointData,
                timestamp: checkpointData.timestamp
            });
            
            this.stats.checkpointsCreated++;
            
            // Clean up old checkpoints (keep only last 100)
            if (this.checkpoints.size > 100) {
                const sortedCheckpoints = Array.from(this.checkpoints.entries())
                    .sort((a, b) => a[1].timestamp - b[1].timestamp);
                
                for (let i = 0; i < sortedCheckpoints.length - 100; i++) {
                    this.checkpoints.delete(sortedCheckpoints[i][0]);
                }
            }
            
        } catch (error) {
            console.error(`Error creating checkpoint for task ${task.id}:`, error);
        }
    }

    async performRecoveryAttempts() {
        // Check for nodes that need recovery attempts
        for (const [nodeId, nodeState] of this.nodeStates.entries()) {
            if (nodeState.failureCount > 0 && 
                nodeState.recoveryAttempts < 5 && 
                !nodeState.isQuarantined &&
                nodeState.lastFailure) {
                
                const timeSinceLastFailure = Date.now() - nodeState.lastFailure.timestamp;
                
                // Attempt recovery if enough time has passed
                if (timeSinceLastFailure > 120000) { // 2 minutes
                    const node = { id: nodeId }; // Simplified node object
                    await this.retryNodeRecovery(node, nodeState);
                }
            }
        }
    }

    updateRecoveryStats(recoveryTime) {
        this.stats.totalRecoveryTime += recoveryTime;
        
        const recoveredCount = this.stats.recoveredNodes + this.stats.recoveredTasks;
        if (recoveredCount > 0) {
            this.stats.averageRecoveryTime = this.stats.totalRecoveryTime / recoveredCount;
        }
    }

    async updateReplicationGroups(nodeId, action) {
        // Simplified replication group management
        // In a real implementation, this would manage data/task replication
        
        if (action === 'remove') {
            // Remove node from all replication groups
            for (const [groupId, group] of this.replicationGroups.entries()) {
                const nodeIndex = group.nodes.indexOf(nodeId);
                if (nodeIndex > -1) {
                    group.nodes.splice(nodeIndex, 1);
                    
                    // If group is under-replicated, find replacement
                    if (group.nodes.length < this.config.replicationFactor) {
                        await this.findReplacementNode(groupId, group);
                    }
                }
            }
        } else if (action === 'add') {
            // Add node to under-replicated groups
            for (const [groupId, group] of this.replicationGroups.entries()) {
                if (group.nodes.length < this.config.replicationFactor && 
                    !group.nodes.includes(nodeId)) {
                    group.nodes.push(nodeId);
                }
            }
        }
    }

    async findReplacementNode(groupId, group) {
        if (!this.nodeManager) return;
        
        try {
            const availableNodes = await this.nodeManager.getActiveNodes();
            const candidateNodes = availableNodes.filter(node => 
                !group.nodes.includes(node.id) &&
                !this.nodeStates.get(node.id)?.isQuarantined
            );
            
            if (candidateNodes.length > 0) {
                const replacementNode = candidateNodes[0]; // Simple selection
                group.nodes.push(replacementNode.id);
                console.log(`Added replacement node ${replacementNode.id} to replication group ${groupId}`);
            }
            
        } catch (error) {
            console.error(`Error finding replacement node for group ${groupId}:`, error);
        }
    }

    // API Methods

    getSystemHealth() {
        const totalNodes = this.nodeStates.size;
        const healthyNodes = Array.from(this.nodeStates.values())
            .filter(state => state.failureCount === 0 && !state.isQuarantined).length;
        const quarantinedNodes = Array.from(this.nodeStates.values())
            .filter(state => state.isQuarantined).length;
        
        return {
            totalNodes,
            healthyNodes,
            unhealthyNodes: totalNodes - healthyNodes,
            quarantinedNodes,
            healthPercentage: totalNodes > 0 ? (healthyNodes / totalNodes) * 100 : 100,
            systemStatus: healthyNodes > totalNodes * 0.7 ? 'healthy' : 
                         healthyNodes > totalNodes * 0.5 ? 'degraded' : 'critical'
        };
    }

    getFailurePatterns() {
        const patterns = {};
        for (const [nodeId, pattern] of this.failurePatterns.entries()) {
            patterns[nodeId] = {
                ...pattern,
                recentFailures: pattern.failureTimestamps.length
            };
        }
        return patterns;
    }

    getNodeStates() {
        const states = {};
        for (const [nodeId, state] of this.nodeStates.entries()) {
            states[nodeId] = {
                ...state,
                isHealthy: state.failureCount === 0 && !state.isQuarantined
            };
        }
        return states;
    }

    getFaultToleranceStats() {
        return {
            ...this.stats,
            systemHealth: this.getSystemHealth(),
            checkpointEfficiency: this.stats.checkpointsCreated > 0 ? 
                (this.stats.checkpointsUsed / this.stats.checkpointsCreated) * 100 : 0,
            recoverySuccessRate: (this.stats.recoveredNodes + this.stats.recoveredTasks) / 
                Math.max(this.stats.nodeFailures + this.stats.taskFailures, 1) * 100
        };
    }

    async shutdown() {
        this.isRunning = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        if (this.checkpointInterval) {
            clearInterval(this.checkpointInterval);
        }
        
        if (this.recoveryInterval) {
            clearInterval(this.recoveryInterval);
        }
        
        this.removeAllListeners();
    }
}

module.exports = { FaultToleranceManager };