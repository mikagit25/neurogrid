const logger = require('../utils/logger');

/**
 * Advanced Analytics Service
 * Comprehensive analytics and metrics system with real-time data processing
 */
class AdvancedAnalyticsService {
  constructor() {
    this.metrics = new Map();
    this.timeSeries = new Map();
    this.eventLog = [];
    this.realTimeData = {
      activeConnections: 0,
      currentLoad: 0,
      queueSize: 0,
      processingRate: 0
    };
    
    this.initialize();
  }

  initialize() {
    // Initialize core metrics
    this.metrics.set('system', {
      totalTasks: 15847,
      completedTasks: 15421,
      failedTasks: 426,
      activeTasks: 23,
      queuedTasks: 67,
      totalNodes: 156,
      activeNodes: 142,
      offlineNodes: 14,
      totalUsers: 2847,
      activeUsers: 435,
      totalRevenue: 4567890.45,
      totalTokensEarned: 125000000,
      avgTaskDuration: 145,
      avgResponseTime: 89,
      successRate: 97.3,
      systemUptime: 99.87,
      dataProcessed: 15.7, // TB
      energyEfficiency: 92.4
    });

    this.metrics.set('network', {
      bandwidth: {
        inbound: 127.5, // Mbps
        outbound: 98.3,
        peak: 245.7,
        average: 87.2
      },
      latency: {
        average: 45, // ms
        p95: 89,
        p99: 156,
        min: 12,
        max: 278
      },
      throughput: {
        tasksPerSecond: 3.2,
        requestsPerSecond: 127.5,
        dataPerSecond: 2.1 // MB
      },
      connections: {
        active: 142,
        idle: 67,
        total: 209,
        rejected: 3
      }
    });

    this.metrics.set('business', {
      revenue: {
        today: 4567.89,
        thisWeek: 32145.67,
        thisMonth: 145678.90,
        total: 4567890.45
      },
      costs: {
        infrastructure: 1234.56,
        energy: 678.90,
        maintenance: 234.56,
        total: 2148.02
      },
      profit: {
        today: 2419.87,
        thisWeek: 18997.65,
        thisMonth: 76543.21,
        margin: 52.8
      },
      pricing: {
        averageTaskPrice: 0.45,
        averageHourlyRate: 15.67,
        pricePerGB: 0.23
      }
    });

    // Initialize time series data
    this.initializeTimeSeries();
    
    // Start real-time data updates
    this.startRealTimeUpdates();

    logger.info('Advanced Analytics Service initialized');
  }

  initializeTimeSeries() {
    const now = new Date();
    const timeRanges = {
      '1h': { points: 60, interval: 60000 }, // 1 minute intervals
      '24h': { points: 24, interval: 3600000 }, // 1 hour intervals
      '7d': { points: 168, interval: 3600000 }, // 1 hour intervals
      '30d': { points: 30, interval: 86400000 } // 1 day intervals
    };

    Object.entries(timeRanges).forEach(([range, config]) => {
      const series = [];
      
      for (let i = config.points - 1; i >= 0; i--) {
        const timestamp = new Date(now - i * config.interval);
        const baseValue = Math.random();
        
        series.push({
          timestamp: timestamp.toISOString(),
          tasks: {
            completed: Math.floor(baseValue * 100 + 50),
            failed: Math.floor(baseValue * 10 + 2),
            queued: Math.floor(baseValue * 20 + 5),
            active: Math.floor(baseValue * 15 + 3)
          },
          nodes: {
            active: Math.floor(baseValue * 50 + 100),
            offline: Math.floor(baseValue * 10 + 2),
            joining: Math.floor(baseValue * 3),
            leaving: Math.floor(baseValue * 2)
          },
          performance: {
            avgResponseTime: Math.floor(baseValue * 100 + 50),
            cpuUsage: Math.floor(baseValue * 40 + 20),
            memoryUsage: Math.floor(baseValue * 30 + 40),
            networkUsage: Math.floor(baseValue * 60 + 20)
          },
          business: {
            revenue: baseValue * 1000 + 500,
            costs: baseValue * 400 + 200,
            users: Math.floor(baseValue * 100 + 300),
            transactions: Math.floor(baseValue * 50 + 25)
          }
        });
      }
      
      this.timeSeries.set(range, series);
    });
  }

  startRealTimeUpdates() {
    // Update real-time metrics every 5 seconds
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, 5000);

    // Update time series every minute
    setInterval(() => {
      this.updateTimeSeries();
    }, 60000);
  }

  updateRealTimeMetrics() {
    const systemMetrics = this.metrics.get('system');
    const networkMetrics = this.metrics.get('network');
    
    // Simulate real-time changes
    systemMetrics.activeTasks = Math.max(0, systemMetrics.activeTasks + Math.floor(Math.random() * 6) - 3);
    systemMetrics.activeNodes = Math.max(0, systemMetrics.activeNodes + Math.floor(Math.random() * 4) - 2);
    systemMetrics.avgResponseTime = Math.max(20, systemMetrics.avgResponseTime + Math.floor(Math.random() * 20) - 10);
    
    networkMetrics.bandwidth.inbound = Math.max(0, networkMetrics.bandwidth.inbound + (Math.random() - 0.5) * 20);
    networkMetrics.bandwidth.outbound = Math.max(0, networkMetrics.bandwidth.outbound + (Math.random() - 0.5) * 15);
    networkMetrics.latency.average = Math.max(5, networkMetrics.latency.average + Math.floor(Math.random() * 10) - 5);
    
    this.realTimeData = {
      activeConnections: networkMetrics.connections.active,
      currentLoad: Math.floor(Math.random() * 100),
      queueSize: systemMetrics.queuedTasks,
      processingRate: Math.floor(Math.random() * 10) + 5
    };
  }

  updateTimeSeries() {
    // Add new data point to each time series
    const now = new Date();
    const baseValue = Math.random();
    
    const newDataPoint = {
      timestamp: now.toISOString(),
      tasks: {
        completed: Math.floor(baseValue * 100 + 50),
        failed: Math.floor(baseValue * 10 + 2),
        queued: Math.floor(baseValue * 20 + 5),
        active: Math.floor(baseValue * 15 + 3)
      },
      nodes: {
        active: Math.floor(baseValue * 50 + 100),
        offline: Math.floor(baseValue * 10 + 2),
        joining: Math.floor(baseValue * 3),
        leaving: Math.floor(baseValue * 2)
      },
      performance: {
        avgResponseTime: Math.floor(baseValue * 100 + 50),
        cpuUsage: Math.floor(baseValue * 40 + 20),
        memoryUsage: Math.floor(baseValue * 30 + 40),
        networkUsage: Math.floor(baseValue * 60 + 20)
      },
      business: {
        revenue: baseValue * 1000 + 500,
        costs: baseValue * 400 + 200,
        users: Math.floor(baseValue * 100 + 300),
        transactions: Math.floor(baseValue * 50 + 25)
      }
    };

    // Update hourly series
    const hourlySeries = this.timeSeries.get('1h');
    hourlySeries.push(newDataPoint);
    if (hourlySeries.length > 60) {
      hourlySeries.shift(); // Keep only last 60 points
    }
  }

  // Get dashboard overview
  async getDashboardOverview(timeRange = '24h') {
    const systemMetrics = this.metrics.get('system');
    const networkMetrics = this.metrics.get('network');
    const businessMetrics = this.metrics.get('business');
    const timeSeries = this.timeSeries.get(timeRange) || this.timeSeries.get('24h');

    return {
      summary: {
        totalTasks: systemMetrics.totalTasks,
        activeTasks: systemMetrics.activeTasks,
        successRate: systemMetrics.successRate,
        activeNodes: systemMetrics.activeNodes,
        totalRevenue: businessMetrics.revenue.total,
        avgResponseTime: systemMetrics.avgResponseTime,
        systemUptime: systemMetrics.systemUptime,
        energyEfficiency: systemMetrics.energyEfficiency
      },
      realTime: this.realTimeData,
      charts: {
        taskTrends: timeSeries.map(point => ({
          timestamp: point.timestamp,
          completed: point.tasks.completed,
          failed: point.tasks.failed,
          active: point.tasks.active
        })),
        networkMetrics: timeSeries.map(point => ({
          timestamp: point.timestamp,
          responseTime: point.performance.avgResponseTime,
          throughput: point.tasks.completed / 60, // tasks per minute
          errorRate: (point.tasks.failed / (point.tasks.completed + point.tasks.failed)) * 100
        })),
        resourceUsage: timeSeries.map(point => ({
          timestamp: point.timestamp,
          cpu: point.performance.cpuUsage,
          memory: point.performance.memoryUsage,
          network: point.performance.networkUsage
        })),
        businessMetrics: timeSeries.map(point => ({
          timestamp: point.timestamp,
          revenue: point.business.revenue,
          costs: point.business.costs,
          profit: point.business.revenue - point.business.costs,
          users: point.business.users
        }))
      }
    };
  }

  // Get detailed system metrics
  async getSystemMetrics() {
    const systemMetrics = this.metrics.get('system');
    const networkMetrics = this.metrics.get('network');
    
    return {
      tasks: {
        total: systemMetrics.totalTasks,
        completed: systemMetrics.completedTasks,
        failed: systemMetrics.failedTasks,
        active: systemMetrics.activeTasks,
        queued: systemMetrics.queuedTasks,
        successRate: (systemMetrics.completedTasks / systemMetrics.totalTasks) * 100,
        avgDuration: systemMetrics.avgTaskDuration,
        throughput: systemMetrics.totalTasks / (Date.now() / 1000 / 3600 / 24) // tasks per day
      },
      nodes: {
        total: systemMetrics.totalNodes,
        active: systemMetrics.activeNodes,
        offline: systemMetrics.offlineNodes,
        utilization: (systemMetrics.activeNodes / systemMetrics.totalNodes) * 100,
        avgLoad: Math.floor(Math.random() * 100)
      },
      users: {
        total: systemMetrics.totalUsers,
        active: systemMetrics.activeUsers,
        retention: (systemMetrics.activeUsers / systemMetrics.totalUsers) * 100
      },
      performance: {
        avgResponseTime: systemMetrics.avgResponseTime,
        uptime: systemMetrics.systemUptime,
        dataProcessed: systemMetrics.dataProcessed,
        energyEfficiency: systemMetrics.energyEfficiency
      },
      network: networkMetrics
    };
  }

  // Get node analytics
  async getNodeAnalytics(limit = 20) {
    // Generate mock node data with realistic distributions
    const nodes = [];
    
    for (let i = 1; i <= limit; i++) {
      const performance = 0.5 + Math.random() * 0.5; // 50-100% performance
      const utilization = Math.random();
      
      nodes.push({
        id: `node-${i.toString().padStart(3, '0')}`,
        name: `GPU-Node-${i}`,
        status: Math.random() > 0.1 ? 'online' : 'offline',
        hardware: {
          gpus: Math.floor(Math.random() * 8) + 1,
          memory: Math.floor(Math.random() * 64) + 16,
          cores: Math.floor(Math.random() * 16) + 4
        },
        performance: {
          tasksCompleted: Math.floor(performance * 1000),
          successRate: Math.min(100, 80 + Math.random() * 20),
          avgExecutionTime: Math.floor((1 - performance) * 200 + 50),
          utilization: utilization * 100,
          uptime: Math.min(100, 85 + Math.random() * 15)
        },
        earnings: {
          total: Math.floor(performance * 5000),
          today: Math.floor(performance * 100),
          hourlyRate: Math.floor(performance * 50 + 10)
        },
        location: {
          region: ['US-East', 'US-West', 'EU-Central', 'Asia-Pacific'][Math.floor(Math.random() * 4)],
          country: ['USA', 'Germany', 'Japan', 'Singapore'][Math.floor(Math.random() * 4)]
        },
        lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString()
      });
    }

    // Sort by performance
    nodes.sort((a, b) => b.performance.tasksCompleted - a.performance.tasksCompleted);

    return {
      nodes,
      summary: {
        totalNodes: nodes.length,
        onlineNodes: nodes.filter(n => n.status === 'online').length,
        avgSuccessRate: nodes.reduce((sum, n) => sum + n.performance.successRate, 0) / nodes.length,
        avgUtilization: nodes.reduce((sum, n) => sum + n.performance.utilization, 0) / nodes.length,
        totalEarnings: nodes.reduce((sum, n) => sum + n.earnings.total, 0),
        topPerformer: nodes[0]?.id || null
      }
    };
  }

  // Get user analytics
  async getUserAnalytics(timeRange = '30d') {
    const userMetrics = {
      overview: {
        totalUsers: 2847,
        activeUsers: 435,
        newUsers: 47,
        churnRate: 2.3,
        retentionRate: 87.2,
        avgSessionDuration: 23.5 // minutes
      },
      engagement: {
        dailyActiveUsers: 435,
        weeklyActiveUsers: 1247,
        monthlyActiveUsers: 2847,
        avgTasksPerUser: 5.4,
        avgRevenuePerUser: 156.78
      },
      demographics: {
        regions: [
          { region: 'North America', users: 1142, percentage: 40.1 },
          { region: 'Europe', users: 854, percentage: 30.0 },
          { region: 'Asia Pacific', users: 568, percentage: 20.0 },
          { region: 'Others', users: 283, percentage: 9.9 }
        ],
        userTypes: [
          { type: 'Individual', count: 1708, percentage: 60.0 },
          { type: 'Small Business', count: 852, percentage: 30.0 },
          { type: 'Enterprise', count: 287, percentage: 10.0 }
        ]
      },
      growth: this.generateGrowthData(timeRange)
    };

    return userMetrics;
  }

  generateGrowthData(timeRange) {
    const points = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 24;
    const interval = timeRange === '7d' ? 86400000 : timeRange === '30d' ? 86400000 : 3600000;
    const now = new Date();
    
    return Array.from({ length: points }, (_, i) => {
      const timestamp = new Date(now - (points - 1 - i) * interval);
      const baseGrowth = Math.random() * 0.1 + 0.02; // 2-12% growth
      
      return {
        timestamp: timestamp.toISOString(),
        newUsers: Math.floor(baseGrowth * 100),
        activeUsers: Math.floor(400 + Math.random() * 100),
        churnedUsers: Math.floor(baseGrowth * 20),
        netGrowth: Math.floor(baseGrowth * 80)
      };
    });
  }

  // Get financial analytics
  async getFinancialAnalytics(timeRange = '30d') {
    const businessMetrics = this.metrics.get('business');
    
    return {
      overview: businessMetrics,
      trends: this.generateFinancialTrends(timeRange),
      breakdown: {
        byModel: [
          { model: 'GPT-4', revenue: 156789.45, percentage: 34.3, tasks: 4521 },
          { model: 'Claude-3', revenue: 123456.78, percentage: 27.0, tasks: 3654 },
          { model: 'LLaMA-2', revenue: 98765.43, percentage: 21.6, tasks: 2987 },
          { model: 'Others', revenue: 78543.21, percentage: 17.1, tasks: 2365 }
        ],
        byRegion: [
          { region: 'North America', revenue: 187654.32, percentage: 41.1 },
          { region: 'Europe', revenue: 145632.10, percentage: 31.9 },
          { region: 'Asia Pacific', revenue: 89543.21, percentage: 19.6 },
          { region: 'Others', revenue: 34560.87, percentage: 7.4 }
        ],
        byUserType: [
          { type: 'Enterprise', revenue: 274563.21, percentage: 60.1 },
          { type: 'Small Business', revenue: 137281.60, percentage: 30.1 },
          { type: 'Individual', revenue: 45654.87, percentage: 9.8 }
        ]
      }
    };
  }

  generateFinancialTrends(timeRange) {
    const points = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 24;
    const interval = timeRange === '7d' ? 86400000 : timeRange === '30d' ? 86400000 : 3600000;
    const now = new Date();
    
    return Array.from({ length: points }, (_, i) => {
      const timestamp = new Date(now - (points - 1 - i) * interval);
      const baseRevenue = 1000 + Math.random() * 2000;
      const baseCosts = 400 + Math.random() * 600;
      
      return {
        timestamp: timestamp.toISOString(),
        revenue: baseRevenue,
        costs: baseCosts,
        profit: baseRevenue - baseCosts,
        transactions: Math.floor(Math.random() * 100 + 50),
        averageTransactionValue: baseRevenue / (Math.random() * 100 + 50)
      };
    });
  }

  // Record event for analytics
  recordEvent(eventType, eventData) {
    const event = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString(),
      source: 'system'
    };

    this.eventLog.unshift(event);
    
    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(0, 1000);
    }

    // Update relevant metrics based on event
    this.updateMetricsFromEvent(event);

    logger.debug('Analytics event recorded', { type: eventType, id: event.id });
    return event;
  }

  updateMetricsFromEvent(event) {
    const systemMetrics = this.metrics.get('system');
    
    switch (event.type) {
      case 'task_completed':
        systemMetrics.completedTasks++;
        systemMetrics.totalTasks++;
        break;
      case 'task_failed':
        systemMetrics.failedTasks++;
        systemMetrics.totalTasks++;
        break;
      case 'node_joined':
        systemMetrics.activeNodes++;
        systemMetrics.totalNodes++;
        break;
      case 'node_left':
        systemMetrics.activeNodes = Math.max(0, systemMetrics.activeNodes - 1);
        systemMetrics.offlineNodes++;
        break;
    }
  }

  // Get predictive analytics
  async getPredictiveAnalytics() {
    // Simple trend-based predictions
    const timeSeries = this.timeSeries.get('24h');
    const recentData = timeSeries.slice(-6); // Last 6 hours
    
    // Calculate trends
    const taskTrend = this.calculateTrend(recentData.map(d => d.tasks.completed));
    const nodeTrend = this.calculateTrend(recentData.map(d => d.nodes.active));
    const revenueTrend = this.calculateTrend(recentData.map(d => d.business.revenue));
    
    return {
      predictions: {
        nextHour: {
          tasksCompleted: Math.max(0, Math.floor(recentData[recentData.length - 1].tasks.completed + taskTrend)),
          activeNodes: Math.max(0, Math.floor(recentData[recentData.length - 1].nodes.active + nodeTrend)),
          revenue: Math.max(0, recentData[recentData.length - 1].business.revenue + revenueTrend)
        },
        next24Hours: {
          tasksCompleted: Math.max(0, Math.floor((recentData[recentData.length - 1].tasks.completed + taskTrend) * 24)),
          activeNodes: Math.max(0, Math.floor(recentData[recentData.length - 1].nodes.active + nodeTrend)),
          revenue: Math.max(0, (recentData[recentData.length - 1].business.revenue + revenueTrend) * 24)
        }
      },
      trends: {
        tasks: taskTrend > 0 ? 'increasing' : taskTrend < 0 ? 'decreasing' : 'stable',
        nodes: nodeTrend > 0 ? 'increasing' : nodeTrend < 0 ? 'decreasing' : 'stable',
        revenue: revenueTrend > 0 ? 'increasing' : revenueTrend < 0 ? 'decreasing' : 'stable'
      },
      confidence: {
        tasks: Math.min(95, Math.abs(taskTrend) * 10 + 60),
        nodes: Math.min(95, Math.abs(nodeTrend) * 10 + 60),
        revenue: Math.min(95, Math.abs(revenueTrend) * 10 + 60)
      }
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  // Export analytics data
  async exportData(format = 'json', filters = {}) {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics),
      timeSeries: Object.fromEntries(this.timeSeries),
      events: this.eventLog.slice(0, 100), // Last 100 events
      realTime: this.realTimeData
    };

    if (format === 'csv') {
      // Convert to CSV format (simplified)
      return this.convertToCSV(data);
    }

    return data;
  }

  convertToCSV(data) {
    // Simplified CSV conversion for metrics
    const csvLines = ['Metric,Value,Timestamp'];
    const timestamp = new Date().toISOString();
    
    Object.entries(data.metrics.system || {}).forEach(([key, value]) => {
      csvLines.push(`${key},${value},${timestamp}`);
    });
    
    return csvLines.join('\n');
  }
}

module.exports = AdvancedAnalyticsService;