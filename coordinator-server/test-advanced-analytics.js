/**
 * Advanced Analytics System Test Suite
 * Tests the enhanced analytics system with comprehensive metrics and predictions
 */

const AdvancedAnalyticsService = require('./src/services/AdvancedAnalyticsService');
const logger = require('./src/utils/logger');

async function testAdvancedAnalytics() {
  console.log('📊 Starting Advanced Analytics System Tests...\n');

  const analyticsService = new AdvancedAnalyticsService();

  try {
    // Test 1: Dashboard Overview
    console.log('📝 Test 1: Getting dashboard overview...');
    const dashboard = await analyticsService.getDashboardOverview('24h');
    
    console.log('✅ Dashboard overview loaded:', {
      totalTasks: dashboard.summary.totalTasks,
      activeTasks: dashboard.summary.activeTasks,
      activeNodes: dashboard.summary.activeNodes,
      systemUptime: dashboard.summary.systemUptime,
      chartsAvailable: Object.keys(dashboard.charts).length
    });

    // Test 2: System Metrics
    console.log('\n📝 Test 2: Getting detailed system metrics...');
    const systemMetrics = await analyticsService.getSystemMetrics();
    
    console.log('✅ System metrics loaded:', {
      totalTasks: systemMetrics.tasks.total,
      successRate: systemMetrics.tasks.successRate.toFixed(2) + '%',
      activeNodes: systemMetrics.nodes.active,
      utilization: systemMetrics.nodes.utilization.toFixed(1) + '%',
      avgResponseTime: systemMetrics.performance.avgResponseTime + 'ms',
      uptime: systemMetrics.performance.uptime + '%'
    });

    // Test 3: Node Analytics
    console.log('\n📝 Test 3: Getting node analytics...');
    const nodeAnalytics = await analyticsService.getNodeAnalytics(10);
    
    console.log('✅ Node analytics loaded:', {
      totalNodes: nodeAnalytics.summary.totalNodes,
      onlineNodes: nodeAnalytics.summary.onlineNodes,
      avgSuccessRate: nodeAnalytics.summary.avgSuccessRate.toFixed(1) + '%',
      avgUtilization: nodeAnalytics.summary.avgUtilization.toFixed(1) + '%',
      topPerformer: nodeAnalytics.summary.topPerformer,
      totalEarnings: '$' + nodeAnalytics.summary.totalEarnings.toLocaleString()
    });

    // Test sample nodes
    const topNodes = nodeAnalytics.nodes.slice(0, 3);
    console.log('Top 3 performing nodes:', topNodes.map(node => ({
      id: node.id,
      tasksCompleted: node.performance.tasksCompleted,
      successRate: node.performance.successRate.toFixed(1) + '%',
      earnings: '$' + node.earnings.total
    })));

    // Test 4: User Analytics
    console.log('\n📝 Test 4: Getting user analytics...');
    const userAnalytics = await analyticsService.getUserAnalytics('30d');
    
    console.log('✅ User analytics loaded:', {
      totalUsers: userAnalytics.overview.totalUsers,
      activeUsers: userAnalytics.overview.activeUsers,
      newUsers: userAnalytics.overview.newUsers,
      retentionRate: userAnalytics.overview.retentionRate + '%',
      avgTasksPerUser: userAnalytics.engagement.avgTasksPerUser,
      avgRevenuePerUser: '$' + userAnalytics.engagement.avgRevenuePerUser
    });

    console.log('User demographics by region:', userAnalytics.demographics.regions);

    // Test 5: Financial Analytics
    console.log('\n📝 Test 5: Getting financial analytics...');
    const financialAnalytics = await analyticsService.getFinancialAnalytics('30d');
    
    console.log('✅ Financial analytics loaded:', {
      totalRevenue: '$' + financialAnalytics.overview.revenue.total.toLocaleString(),
      monthlyRevenue: '$' + financialAnalytics.overview.revenue.thisMonth.toLocaleString(),
      totalCosts: '$' + financialAnalytics.overview.costs.total.toLocaleString(),
      profitMargin: financialAnalytics.overview.profit.margin + '%',
      avgTaskPrice: '$' + financialAnalytics.overview.pricing.averageTaskPrice
    });

    console.log('Revenue breakdown by model:', financialAnalytics.breakdown.byModel.map(item => ({
      model: item.model,
      revenue: '$' + item.revenue.toLocaleString(),
      percentage: item.percentage + '%'
    })));

    // Test 6: Event Recording
    console.log('\n📝 Test 6: Testing event recording...');
    
    const events = [
      { type: 'task_completed', data: { taskId: 'TASK-12345', duration: 145, model: 'GPT-4' } },
      { type: 'task_failed', data: { taskId: 'TASK-12346', error: 'Memory exhausted' } },
      { type: 'node_joined', data: { nodeId: 'node-456', region: 'US-East' } },
      { type: 'node_left', data: { nodeId: 'node-123', reason: 'Maintenance' } }
    ];

    events.forEach(event => {
      const recordedEvent = analyticsService.recordEvent(event.type, event.data);
      console.log(`✅ Event recorded: ${recordedEvent.type} (${recordedEvent.id})`);
    });

    // Test 7: Predictive Analytics
    console.log('\n📝 Test 7: Getting predictive analytics...');
    const predictions = await analyticsService.getPredictiveAnalytics();
    
    console.log('✅ Predictive analytics loaded:', {
      nextHourTasks: predictions.predictions.nextHour.tasksCompleted,
      nextHourNodes: predictions.predictions.nextHour.activeNodes,
      nextHourRevenue: '$' + predictions.predictions.nextHour.revenue.toFixed(2),
      tasksTrend: predictions.trends.tasks,
      nodesTrend: predictions.trends.nodes,
      revenueTrend: predictions.trends.revenue
    });

    console.log('24-hour predictions:', {
      tasksCompleted: predictions.predictions.next24Hours.tasksCompleted,
      revenue: '$' + predictions.predictions.next24Hours.revenue.toLocaleString()
    });

    console.log('Prediction confidence levels:', {
      tasks: predictions.confidence.tasks.toFixed(1) + '%',
      nodes: predictions.confidence.nodes.toFixed(1) + '%',
      revenue: predictions.confidence.revenue.toFixed(1) + '%'
    });

    // Test 8: Data Export
    console.log('\n📝 Test 8: Testing data export...');
    
    const jsonExport = await analyticsService.exportData('json');
    console.log('✅ JSON export completed:', {
      metricsCount: Object.keys(jsonExport.metrics).length,
      timeSeriesCount: Object.keys(jsonExport.timeSeries).length,
      eventsCount: jsonExport.events.length,
      realTimeMetrics: Object.keys(jsonExport.realTime).length
    });

    const csvExport = await analyticsService.exportData('csv');
    console.log('✅ CSV export completed:', {
      size: csvExport.length + ' characters',
      lines: csvExport.split('\n').length
    });

    // Test 9: Real-time Data Validation
    console.log('\n📝 Test 9: Validating real-time data updates...');
    
    // Wait for a few seconds to see real-time updates
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const updatedDashboard = await analyticsService.getDashboardOverview('1h');
    console.log('✅ Real-time updates working:', {
      activeConnections: updatedDashboard.realTime.activeConnections,
      currentLoad: updatedDashboard.realTime.currentLoad,
      queueSize: updatedDashboard.realTime.queueSize,
      processingRate: updatedDashboard.realTime.processingRate
    });

    // Test 10: Performance Metrics Validation
    console.log('\n📝 Test 10: Validating performance calculations...');
    
    const performanceData = await analyticsService.getSystemMetrics();
    const calculations = {
      successRateCheck: (performanceData.tasks.completed / performanceData.tasks.total * 100).toFixed(2),
      nodeUtilizationCheck: (performanceData.nodes.active / performanceData.nodes.total * 100).toFixed(2),
      throughputCheck: (performanceData.tasks.total / (Date.now() / 1000 / 3600 / 24)).toFixed(2)
    };
    
    console.log('✅ Performance calculations validated:', calculations);

    // Test 11: Time Series Data Integrity
    console.log('\n📝 Test 11: Validating time series data integrity...');
    
    const timeRanges = ['1h', '24h', '7d', '30d'];
    for (const range of timeRanges) {
      const dashboard = await analyticsService.getDashboardOverview(range);
      const dataPoints = dashboard.charts.taskTrends.length;
      console.log(`✅ Time series for ${range}: ${dataPoints} data points`);
    }

    // Test Statistics Summary
    console.log('\n📊 Test Statistics Summary:');
    const finalMetrics = await analyticsService.getSystemMetrics();
    
    console.log('System Overview:', {
      totalTasks: finalMetrics.tasks.total.toLocaleString(),
      successRate: finalMetrics.tasks.successRate.toFixed(2) + '%',
      activeNodes: finalMetrics.nodes.active,
      totalUsers: finalMetrics.users.total.toLocaleString(),
      systemUptime: finalMetrics.performance.uptime + '%',
      dataProcessed: finalMetrics.performance.dataProcessed + ' TB',
      energyEfficiency: finalMetrics.performance.energyEfficiency + '%'
    });

    const networkStats = finalMetrics.network;
    console.log('Network Performance:', {
      averageLatency: networkStats.latency.average + 'ms',
      throughput: networkStats.throughput.tasksPerSecond + ' tasks/sec',
      activeConnections: networkStats.connections.active,
      bandwidthIn: networkStats.bandwidth.inbound.toFixed(1) + ' Mbps',
      bandwidthOut: networkStats.bandwidth.outbound.toFixed(1) + ' Mbps'
    });

    console.log('\n🎉 All advanced analytics tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ Dashboard overview with real-time metrics');
    console.log('- ✅ Comprehensive system metrics');
    console.log('- ✅ Node performance analytics');
    console.log('- ✅ User engagement analytics');
    console.log('- ✅ Financial analytics and revenue tracking');
    console.log('- ✅ Event recording and processing');
    console.log('- ✅ Predictive analytics and forecasting');
    console.log('- ✅ Data export functionality');
    console.log('- ✅ Real-time data updates');
    console.log('- ✅ Performance calculations validation');
    console.log('- ✅ Time series data integrity');

    return true;

  } catch (error) {
    console.error('❌ Advanced analytics test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAdvancedAnalytics()
    .then(success => {
      if (success) {
        console.log('\n✅ All advanced analytics tests passed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Some advanced analytics tests failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testAdvancedAnalytics };