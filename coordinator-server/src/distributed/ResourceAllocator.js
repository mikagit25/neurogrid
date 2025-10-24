/**
 * Resource Allocator - Intelligent resource allocation and optimization
 * Handles CPU, GPU, memory, and network resource allocation across the distributed system
 */

const { EventEmitter } = require('events');

class ResourceAllocator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.nodeManager = options.nodeManager;
        this.taskScheduler = options.taskScheduler;
        this.loadBalancer = options.loadBalancer;
        
        // Configuration
        this.config = {
            allocationStrategy: options.allocationStrategy || 'balanced', // 'greedy', 'balanced', 'performance', 'energy'
            resourceBuffer: options.resourceBuffer || 0.1, // 10% buffer
            allocationInterval: options.allocationInterval || 30000, // 30 seconds
            enableDynamicAllocation: options.enableDynamicAllocation !== false,
            enableResourcePrediction: options.enableResourcePrediction !== false,
            memoryOvercommitRatio: options.memoryOvercommitRatio || 1.2,
            cpuOvercommitRatio: options.cpuOvercommitRatio || 1.5,
            enableResourceSharing: options.enableResourceSharing !== false
        };
        
        // Resource tracking
        this.nodeResources = new Map();
        this.resourceAllocations = new Map();
        this.resourceHistory = new Map();
        this.allocationQueue = [];
        
        // Resource pools
        this.resourcePools = {
            cpu: new Map(),
            memory: new Map(),
            gpu: new Map(),
            network: new Map()
        };
        
        // Statistics
        this.stats = {
            totalAllocations: 0,
            successfulAllocations: 0,
            failedAllocations: 0,
            resourceUtilization: {
                cpu: 0,
                memory: 0,
                gpu: 0,
                network: 0
            },
            allocationLatency: 0,
            totalAllocationTime: 0,
            fragmentationScore: 0,
            wastedResources: {
                cpu: 0,
                memory: 0,
                gpu: 0
            }
        };
        
        // Start resource monitoring
        this.allocationInterval = setInterval(() => this.performResourceAllocation(), this.config.allocationInterval);
        this.monitoringInterval = setInterval(() => this.updateResourceMetrics(), 10000); // Every 10 seconds
        
        this.isRunning = true;
    }

    async initializeResourceTracking() {
        if (!this.nodeManager) return;
        
        try {
            const allNodes = await this.nodeManager.getAllNodes();
            
            for (const node of allNodes) {
                await this.initializeNodeResources(node);
            }
            
        } catch (error) {
            console.error('Error initializing resource tracking:', error);
        }
    }

    async initializeNodeResources(node) {
        const nodeId = node.id;
        
        // Initialize resource state
        const resourceState = {
            nodeId: nodeId,
            totalResources: {
                cpu: node.specs?.cpuCores || 4,
                memory: node.specs?.memoryGB || 8,
                gpu: node.specs?.gpuMemoryGB || 0,
                network: node.specs?.networkBandwidthMbps || 1000,
                storage: node.specs?.storageGB || 100
            },
            allocatedResources: {
                cpu: 0,
                memory: 0,
                gpu: 0,
                network: 0,
                storage: 0
            },
            availableResources: {
                cpu: node.specs?.cpuCores || 4,
                memory: node.specs?.memoryGB || 8,
                gpu: node.specs?.gpuMemoryGB || 0,
                network: node.specs?.networkBandwidthMbps || 1000,
                storage: node.specs?.storageGB || 100
            },
            reservedResources: {
                cpu: 0,
                memory: 0,
                gpu: 0,
                network: 0,
                storage: 0
            },
            utilizationHistory: [],
            allocationHistory: [],
            lastUpdate: Date.now()
        };
        
        this.nodeResources.set(nodeId, resourceState);
        
        // Initialize resource pools
        this.addToResourcePool('cpu', nodeId, resourceState.totalResources.cpu);
        this.addToResourcePool('memory', nodeId, resourceState.totalResources.memory);
        this.addToResourcePool('gpu', nodeId, resourceState.totalResources.gpu);
        this.addToResourcePool('network', nodeId, resourceState.totalResources.network);
    }

    addToResourcePool(resourceType, nodeId, amount) {
        if (!this.resourcePools[resourceType].has(nodeId)) {
            this.resourcePools[resourceType].set(nodeId, {
                total: amount,
                allocated: 0,
                available: amount,
                reservations: []
            });
        }
    }

    async allocateResources(taskId, requirements) {
        try {
            const startTime = Date.now();
            
            // Find suitable nodes
            const suitableNodes = await this.findSuitableNodes(requirements);
            
            if (suitableNodes.length === 0) {
                this.stats.failedAllocations++;
                return {
                    success: false,
                    error: 'No suitable nodes found for resource requirements',
                    requirements
                };
            }
            
            // Select best node based on allocation strategy
            const selectedNode = this.selectBestNode(suitableNodes, requirements);
            
            // Perform allocation
            const allocationResult = await this.performAllocation(taskId, selectedNode.id, requirements);
            
            if (allocationResult.success) {
                this.stats.successfulAllocations++;
                
                // Record allocation
                this.recordAllocation(taskId, selectedNode.id, requirements, allocationResult);
                
                const allocationTime = Date.now() - startTime;
                this.stats.totalAllocationTime += allocationTime;
                this.stats.allocationLatency = this.stats.totalAllocationTime / this.stats.successfulAllocations;
            } else {
                this.stats.failedAllocations++;
            }
            
            this.stats.totalAllocations++;
            
            return allocationResult;
            
        } catch (error) {
            this.stats.failedAllocations++;
            console.error('Error allocating resources:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async findSuitableNodes(requirements) {
        const suitableNodes = [];
        
        for (const [nodeId, resources] of this.nodeResources.entries()) {
            if (this.canAllocateResources(nodeId, requirements)) {
                const suitabilityScore = this.calculateSuitabilityScore(nodeId, requirements);
                suitableNodes.push({
                    id: nodeId,
                    resources,
                    suitabilityScore
                });
            }
        }
        
        return suitableNodes.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    }

    canAllocateResources(nodeId, requirements) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return false;
        
        // Check each resource type
        for (const [resourceType, requiredAmount] of Object.entries(requirements)) {
            if (resourceType === 'nodeType' || resourceType === 'capabilities') continue;
            
            const available = resources.availableResources[resourceType] || 0;
            const buffer = available * this.config.resourceBuffer;
            
            if (requiredAmount > (available - buffer)) {
                return false;
            }
        }
        
        return true;
    }

    calculateSuitabilityScore(nodeId, requirements) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return 0;
        
        let score = 100;
        
        // Calculate resource fit score
        for (const [resourceType, requiredAmount] of Object.entries(requirements)) {
            if (resourceType === 'nodeType' || resourceType === 'capabilities') continue;
            
            const available = resources.availableResources[resourceType] || 0;
            const total = resources.totalResources[resourceType] || 1;
            
            if (requiredAmount > 0) {
                // Prefer nodes with resources that closely match requirements
                const utilizationAfterAllocation = (resources.allocatedResources[resourceType] + requiredAmount) / total;
                
                // Optimal utilization is around 70-80%
                const optimalUtilization = 0.75;
                const utilizationDiff = Math.abs(utilizationAfterAllocation - optimalUtilization);
                score += (1 - utilizationDiff) * 20;
                
                // Bonus for having enough resources without overcommit
                if (requiredAmount <= available) {
                    score += 10;
                }
            }
        }
        
        // Consider fragmentation - prefer less fragmented nodes
        const fragmentationPenalty = this.calculateFragmentation(nodeId) * 10;
        score -= fragmentationPenalty;
        
        // Consider node health and performance history
        const nodeHistory = this.resourceHistory.get(nodeId);
        if (nodeHistory) {
            const avgPerformance = nodeHistory.averagePerformance || 1.0;
            score *= avgPerformance;
        }
        
        return Math.max(score, 1);
    }

    selectBestNode(suitableNodes, requirements) {
        if (suitableNodes.length === 0) return null;
        
        switch (this.config.allocationStrategy) {
            case 'greedy':
                return this.selectGreedy(suitableNodes);
            case 'balanced':
                return this.selectBalanced(suitableNodes);
            case 'performance':
                return this.selectPerformance(suitableNodes);
            case 'energy':
                return this.selectEnergyEfficient(suitableNodes);
            default:
                return this.selectBalanced(suitableNodes);
        }
    }

    selectGreedy(suitableNodes) {
        // Select node with most available resources (first-fit)
        return suitableNodes.reduce((best, current) => {
            const bestTotal = this.getTotalAvailableResources(best.id);
            const currentTotal = this.getTotalAvailableResources(current.id);
            return currentTotal > bestTotal ? current : best;
        });
    }

    selectBalanced(suitableNodes) {
        // Select node that maintains best balance across all resource types
        return suitableNodes.reduce((best, current) => {
            const bestBalance = this.calculateResourceBalance(best.id);
            const currentBalance = this.calculateResourceBalance(current.id);
            return currentBalance > bestBalance ? current : best;
        });
    }

    selectPerformance(suitableNodes) {
        // Select node with best performance history
        return suitableNodes.reduce((best, current) => {
            const bestPerf = this.getNodePerformanceScore(best.id);
            const currentPerf = this.getNodePerformanceScore(current.id);
            return currentPerf > bestPerf ? current : best;
        });
    }

    selectEnergyEfficient(suitableNodes) {
        // Select node with best energy efficiency (simulate based on utilization)
        return suitableNodes.reduce((best, current) => {
            const bestEfficiency = this.calculateEnergyEfficiency(best.id);
            const currentEfficiency = this.calculateEnergyEfficiency(current.id);
            return currentEfficiency > bestEfficiency ? current : best;
        });
    }

    getTotalAvailableResources(nodeId) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return 0;
        
        return resources.availableResources.cpu + 
               resources.availableResources.memory + 
               resources.availableResources.gpu;
    }

    calculateResourceBalance(nodeId) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return 0;
        
        const utilizations = [
            resources.allocatedResources.cpu / resources.totalResources.cpu,
            resources.allocatedResources.memory / resources.totalResources.memory,
            resources.allocatedResources.gpu / Math.max(resources.totalResources.gpu, 1),
            resources.allocatedResources.network / resources.totalResources.network
        ];
        
        const avgUtilization = utilizations.reduce((a, b) => a + b) / utilizations.length;
        const variance = utilizations.reduce((sum, util) => sum + Math.pow(util - avgUtilization, 2), 0) / utilizations.length;
        
        return 1 / (1 + variance); // Lower variance = better balance
    }

    getNodePerformanceScore(nodeId) {
        const history = this.resourceHistory.get(nodeId);
        return history?.averagePerformance || 1.0;
    }

    calculateEnergyEfficiency(nodeId) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return 0;
        
        // Simple energy efficiency model based on utilization
        const totalUtilization = (
            resources.allocatedResources.cpu / resources.totalResources.cpu +
            resources.allocatedResources.memory / resources.totalResources.memory
        ) / 2;
        
        // Energy efficiency peaks around 70-80% utilization
        const optimalUtilization = 0.75;
        return 1 - Math.abs(totalUtilization - optimalUtilization);
    }

    async performAllocation(taskId, nodeId, requirements) {
        try {
            const resources = this.nodeResources.get(nodeId);
            if (!resources) {
                return {
                    success: false,
                    error: 'Node resources not found'
                };
            }
            
            // Check if allocation is still possible (resources might have changed)
            if (!this.canAllocateResources(nodeId, requirements)) {
                return {
                    success: false,
                    error: 'Insufficient resources for allocation'
                };
            }
            
            // Perform the allocation
            for (const [resourceType, amount] of Object.entries(requirements)) {
                if (resourceType === 'nodeType' || resourceType === 'capabilities') continue;
                
                if (amount > 0) {
                    resources.allocatedResources[resourceType] += amount;
                    resources.availableResources[resourceType] -= amount;
                    
                    // Update resource pool
                    const pool = this.resourcePools[resourceType]?.get(nodeId);
                    if (pool) {
                        pool.allocated += amount;
                        pool.available -= amount;
                    }
                }
            }
            
            resources.lastUpdate = Date.now();
            
            return {
                success: true,
                nodeId: nodeId,
                allocatedResources: { ...requirements },
                allocationId: `alloc_${taskId}_${Date.now()}`
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    recordAllocation(taskId, nodeId, requirements, allocationResult) {
        const allocation = {
            taskId,
            nodeId,
            requirements,
            allocationId: allocationResult.allocationId,
            timestamp: Date.now(),
            status: 'active'
        };
        
        this.resourceAllocations.set(allocationResult.allocationId, allocation);
        
        // Add to node's allocation history
        const resources = this.nodeResources.get(nodeId);
        if (resources) {
            resources.allocationHistory.push({
                taskId,
                requirements,
                timestamp: Date.now()
            });
            
            // Keep history limited
            if (resources.allocationHistory.length > 100) {
                resources.allocationHistory.shift();
            }
        }
    }

    async deallocateResources(allocationId) {
        try {
            const allocation = this.resourceAllocations.get(allocationId);
            if (!allocation) {
                return {
                    success: false,
                    error: 'Allocation not found'
                };
            }
            
            const resources = this.nodeResources.get(allocation.nodeId);
            if (!resources) {
                return {
                    success: false,
                    error: 'Node resources not found'
                };
            }
            
            // Free the resources
            for (const [resourceType, amount] of Object.entries(allocation.requirements)) {
                if (resourceType === 'nodeType' || resourceType === 'capabilities') continue;
                
                if (amount > 0 && resources.allocatedResources[resourceType] >= amount) {
                    resources.allocatedResources[resourceType] -= amount;
                    resources.availableResources[resourceType] += amount;
                    
                    // Update resource pool
                    const pool = this.resourcePools[resourceType]?.get(allocation.nodeId);
                    if (pool && pool.allocated >= amount) {
                        pool.allocated -= amount;
                        pool.available += amount;
                    }
                }
            }
            
            resources.lastUpdate = Date.now();
            
            // Mark allocation as completed
            allocation.status = 'completed';
            allocation.completedAt = Date.now();
            
            this.emit('resourcesDeallocated', {
                allocationId,
                nodeId: allocation.nodeId,
                resources: allocation.requirements
            });
            
            return {
                success: true,
                message: 'Resources deallocated successfully'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async performResourceAllocation() {
        try {
            // Process allocation queue
            if (this.allocationQueue.length > 0) {
                const queuedAllocations = this.allocationQueue.splice(0, 10); // Process up to 10 at once
                
                for (const queuedAllocation of queuedAllocations) {
                    const result = await this.allocateResources(
                        queuedAllocation.taskId,
                        queuedAllocation.requirements
                    );
                    
                    if (queuedAllocation.callback) {
                        queuedAllocation.callback(result);
                    }
                }
            }
            
            // Perform resource optimization
            if (this.config.enableDynamicAllocation) {
                await this.optimizeResourceAllocation();
            }
            
        } catch (error) {
            console.error('Error in resource allocation cycle:', error);
        }
    }

    async optimizeResourceAllocation() {
        // Identify fragmented nodes and try to consolidate allocations
        const fragmentedNodes = this.identifyFragmentedNodes();
        
        for (const nodeId of fragmentedNodes) {
            await this.defragmentNode(nodeId);
        }
        
        // Identify underutilized nodes
        const underutilizedNodes = this.identifyUnderutilizedNodes();
        
        // Try to migrate allocations to improve utilization
        for (const nodeId of underutilizedNodes) {
            await this.consolidateAllocations(nodeId);
        }
    }

    identifyFragmentedNodes() {
        const fragmentedNodes = [];
        
        for (const [nodeId, resources] of this.nodeResources.entries()) {
            const fragmentationScore = this.calculateFragmentation(nodeId);
            if (fragmentationScore > 0.3) { // 30% fragmentation threshold
                fragmentedNodes.push(nodeId);
            }
        }
        
        return fragmentedNodes;
    }

    calculateFragmentation(nodeId) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return 0;
        
        // Calculate fragmentation based on unused resources in allocated blocks
        let totalFragmentation = 0;
        let resourceTypes = 0;
        
        for (const [resourceType, total] of Object.entries(resources.totalResources)) {
            const allocated = resources.allocatedResources[resourceType] || 0;
            const available = resources.availableResources[resourceType] || 0;
            
            if (total > 0) {
                // Fragmentation occurs when there are small unused chunks
                const utilizationRatio = allocated / total;
                const availabilityRatio = available / total;
                
                // High utilization with low availability suggests fragmentation
                if (utilizationRatio > 0.5 && availabilityRatio < 0.3 && availabilityRatio > 0) {
                    totalFragmentation += (utilizationRatio - availabilityRatio);
                }
                
                resourceTypes++;
            }
        }
        
        return resourceTypes > 0 ? totalFragmentation / resourceTypes : 0;
    }

    identifyUnderutilizedNodes() {
        const underutilizedNodes = [];
        
        for (const [nodeId, resources] of this.nodeResources.entries()) {
            const totalUtilization = this.calculateTotalUtilization(nodeId);
            if (totalUtilization < 0.3) { // 30% utilization threshold
                underutilizedNodes.push(nodeId);
            }
        }
        
        return underutilizedNodes;
    }

    calculateTotalUtilization(nodeId) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) return 0;
        
        const utilizations = [];
        
        for (const [resourceType, total] of Object.entries(resources.totalResources)) {
            if (total > 0) {
                const allocated = resources.allocatedResources[resourceType] || 0;
                utilizations.push(allocated / total);
            }
        }
        
        return utilizations.length > 0 ? 
            utilizations.reduce((a, b) => a + b) / utilizations.length : 0;
    }

    async defragmentNode(nodeId) {
        // Placeholder for defragmentation logic
        // In a real implementation, this would reorganize allocations
        console.log(`Defragmenting node ${nodeId}`);
    }

    async consolidateAllocations(nodeId) {
        // Placeholder for allocation consolidation logic
        // In a real implementation, this would migrate tasks to better utilize resources
        console.log(`Consolidating allocations for node ${nodeId}`);
    }

    updateResourceMetrics() {
        // Update system-wide resource utilization
        let totalCpu = 0, allocatedCpu = 0;
        let totalMemory = 0, allocatedMemory = 0;
        let totalGpu = 0, allocatedGpu = 0;
        let totalNetwork = 0, allocatedNetwork = 0;
        
        for (const [nodeId, resources] of this.nodeResources.entries()) {
            totalCpu += resources.totalResources.cpu;
            allocatedCpu += resources.allocatedResources.cpu;
            
            totalMemory += resources.totalResources.memory;
            allocatedMemory += resources.allocatedResources.memory;
            
            totalGpu += resources.totalResources.gpu;
            allocatedGpu += resources.allocatedResources.gpu;
            
            totalNetwork += resources.totalResources.network;
            allocatedNetwork += resources.allocatedResources.network;
            
            // Update node utilization history
            const utilization = {
                timestamp: Date.now(),
                cpu: resources.allocatedResources.cpu / resources.totalResources.cpu,
                memory: resources.allocatedResources.memory / resources.totalResources.memory,
                gpu: resources.totalResources.gpu > 0 ? resources.allocatedResources.gpu / resources.totalResources.gpu : 0,
                network: resources.allocatedResources.network / resources.totalResources.network
            };
            
            resources.utilizationHistory.push(utilization);
            
            // Keep history limited
            if (resources.utilizationHistory.length > 100) {
                resources.utilizationHistory.shift();
            }
        }
        
        // Update system stats
        this.stats.resourceUtilization = {
            cpu: totalCpu > 0 ? allocatedCpu / totalCpu : 0,
            memory: totalMemory > 0 ? allocatedMemory / totalMemory : 0,
            gpu: totalGpu > 0 ? allocatedGpu / totalGpu : 0,
            network: totalNetwork > 0 ? allocatedNetwork / totalNetwork : 0
        };
        
        // Calculate system fragmentation
        let totalFragmentation = 0;
        let nodeCount = 0;
        
        for (const nodeId of this.nodeResources.keys()) {
            totalFragmentation += this.calculateFragmentation(nodeId);
            nodeCount++;
        }
        
        this.stats.fragmentationScore = nodeCount > 0 ? totalFragmentation / nodeCount : 0;
    }

    // API Methods

    async getResourceStatus() {
        const nodeStatuses = {};
        
        for (const [nodeId, resources] of this.nodeResources.entries()) {
            nodeStatuses[nodeId] = {
                totalResources: resources.totalResources,
                allocatedResources: resources.allocatedResources,
                availableResources: resources.availableResources,
                utilization: {
                    cpu: resources.allocatedResources.cpu / resources.totalResources.cpu,
                    memory: resources.allocatedResources.memory / resources.totalResources.memory,
                    gpu: resources.totalResources.gpu > 0 ? resources.allocatedResources.gpu / resources.totalResources.gpu : 0,
                    network: resources.allocatedResources.network / resources.totalResources.network
                },
                fragmentationScore: this.calculateFragmentation(nodeId),
                lastUpdate: resources.lastUpdate
            };
        }
        
        return {
            nodeStatuses,
            systemUtilization: this.stats.resourceUtilization,
            systemFragmentation: this.stats.fragmentationScore,
            allocationStats: {
                total: this.stats.totalAllocations,
                successful: this.stats.successfulAllocations,
                failed: this.stats.failedAllocations,
                successRate: this.stats.totalAllocations > 0 ? 
                    (this.stats.successfulAllocations / this.stats.totalAllocations) * 100 : 0,
                averageLatency: this.stats.allocationLatency
            }
        };
    }

    async getResourceHistory(nodeId, hours = 24) {
        const resources = this.nodeResources.get(nodeId);
        if (!resources) {
            return { error: 'Node not found' };
        }
        
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        const recentHistory = resources.utilizationHistory.filter(
            entry => entry.timestamp > cutoffTime
        );
        
        return {
            nodeId,
            history: recentHistory,
            currentUtilization: recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null,
            averageUtilization: this.calculateAverageUtilization(recentHistory)
        };
    }

    calculateAverageUtilization(history) {
        if (history.length === 0) return null;
        
        const totals = { cpu: 0, memory: 0, gpu: 0, network: 0 };
        
        for (const entry of history) {
            totals.cpu += entry.cpu;
            totals.memory += entry.memory;
            totals.gpu += entry.gpu;
            totals.network += entry.network;
        }
        
        return {
            cpu: totals.cpu / history.length,
            memory: totals.memory / history.length,
            gpu: totals.gpu / history.length,
            network: totals.network / history.length
        };
    }

    async getAllocations(filters = {}) {
        let allocations = Array.from(this.resourceAllocations.values());
        
        if (filters.nodeId) {
            allocations = allocations.filter(alloc => alloc.nodeId === filters.nodeId);
        }
        
        if (filters.taskId) {
            allocations = allocations.filter(alloc => alloc.taskId === filters.taskId);
        }
        
        if (filters.status) {
            allocations = allocations.filter(alloc => alloc.status === filters.status);
        }
        
        return allocations;
    }

    getResourceAllocatorStats() {
        return {
            ...this.stats,
            totalNodes: this.nodeResources.size,
            activeAllocations: Array.from(this.resourceAllocations.values())
                .filter(alloc => alloc.status === 'active').length,
            queuedAllocations: this.allocationQueue.length,
            resourcePools: {
                cpu: {
                    totalNodes: this.resourcePools.cpu.size,
                    totalCapacity: Array.from(this.resourcePools.cpu.values())
                        .reduce((sum, pool) => sum + pool.total, 0),
                    totalAllocated: Array.from(this.resourcePools.cpu.values())
                        .reduce((sum, pool) => sum + pool.allocated, 0)
                },
                memory: {
                    totalNodes: this.resourcePools.memory.size,
                    totalCapacity: Array.from(this.resourcePools.memory.values())
                        .reduce((sum, pool) => sum + pool.total, 0),
                    totalAllocated: Array.from(this.resourcePools.memory.values())
                        .reduce((sum, pool) => sum + pool.allocated, 0)
                },
                gpu: {
                    totalNodes: this.resourcePools.gpu.size,
                    totalCapacity: Array.from(this.resourcePools.gpu.values())
                        .reduce((sum, pool) => sum + pool.total, 0),
                    totalAllocated: Array.from(this.resourcePools.gpu.values())
                        .reduce((sum, pool) => sum + pool.allocated, 0)
                }
            }
        };
    }

    async shutdown() {
        this.isRunning = false;
        
        if (this.allocationInterval) {
            clearInterval(this.allocationInterval);
        }
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        this.removeAllListeners();
    }
}

module.exports = { ResourceAllocator };