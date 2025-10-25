/**
 * System Analytics - Advanced data analysis, trend detection, and predictive insights
 * Analyzes system performance patterns and provides intelligent recommendations
 */

const { EventEmitter } = require('events');
const { MetricsCollectorSingleton } = require('./MetricsCollector');
const { PerformanceMonitorSingleton } = require('./PerformanceMonitor');

class SystemAnalytics extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      analysisInterval: options.analysisInterval || 5 * 60 * 1000, // 5 minutes
      trendWindow: options.trendWindow || 24 * 60 * 60 * 1000, // 24 hours
      anomalyThreshold: options.anomalyThreshold || 2.0, // Standard deviations
      enablePredictions: options.enablePredictions !== false,
      enableRecommendations: options.enableRecommendations !== false,
      minDataPoints: options.minDataPoints || 10
    };

    this.metricsCollector = MetricsCollectorSingleton.getInstance();
    this.performanceMonitor = PerformanceMonitorSingleton.getInstance();

    // Analytics data
    this.trends = new Map();
    this.anomalies = [];
    this.predictions = new Map();
    this.recommendations = [];
    this.insights = [];

    // Statistical models
    this.models = {
      linear: new Map(),
      seasonal: new Map(),
      anomaly: new Map()
    };

    // Analysis history
    this.analysisHistory = [];
    this.maxHistorySize = 1000;

    // Start analytics
    this.startAnalytics();
  }

  startAnalytics() {
    this.analysisTimer = setInterval(() => {
      this.performAnalysis();
    }, this.config.analysisInterval);

    console.log('System analytics started');
    this.emit('analyticsStarted');
  }

  stopAnalytics() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }

    console.log('System analytics stopped');
    this.emit('analyticsStopped');
  }

  async performAnalysis() {
    try {
      const timestamp = new Date();

      // Get recent metrics data
      const metricsData = this.metricsCollector.getMetrics('timeseries', {
        start: new Date(Date.now() - this.config.trendWindow),
        end: timestamp
      });

      const performanceData = this.performanceMonitor.getPerformanceHistory('24h');

      if (!metricsData.timeSeries || performanceData.length < this.config.minDataPoints) {
        return;
      }

      // Perform different types of analysis
      const analysis = {
        timestamp,
        trends: await this.analyzeTrends(metricsData.timeSeries, performanceData),
        anomalies: await this.detectAnomalies(metricsData.timeSeries, performanceData),
        patterns: await this.identifyPatterns(performanceData),
        predictions: await this.generatePredictions(metricsData.timeSeries, performanceData),
        recommendations: await this.generateRecommendations(metricsData.timeSeries, performanceData)
      };

      // Store analysis results
      this.storeAnalysisResults(analysis);

      // Emit analysis complete event
      this.emit('analysisComplete', analysis);

    } catch (error) {
      console.error('System analysis error:', error);
      this.emit('analysisError', { error: error.message });
    }
  }

  async analyzeTrends(metricsData, performanceData) {
    const trends = {};

    // Analyze performance trends
    if (performanceData.length > 0) {
      trends.responseTime = this.calculateTrend(
        performanceData.map(d => ({ x: d.timestamp, y: d.responseTime }))
      );

      trends.errorRate = this.calculateTrend(
        performanceData.map(d => ({ x: d.timestamp, y: d.errorRate }))
      );

      trends.throughput = this.calculateTrend(
        performanceData.map(d => ({ x: d.timestamp, y: d.throughput }))
      );

      trends.memoryUsage = this.calculateTrend(
        performanceData.map(d => ({ x: d.timestamp, y: d.memoryUsage }))
      );

      trends.cpuUsage = this.calculateTrend(
        performanceData.map(d => ({ x: d.timestamp, y: d.cpuUsage }))
      );
    }

    // Analyze system metrics trends
    if (metricsData.system && metricsData.system.length > 0) {
      const systemData = metricsData.system;

      trends.systemMemory = this.calculateTrend(
        systemData.map(d => ({
          x: d.timestamp.getTime(),
          y: d.data.memory ? d.data.memory.usage : 0
        }))
      );

      trends.systemCpu = this.calculateTrend(
        systemData.map(d => ({
          x: d.timestamp.getTime(),
          y: d.data.cpu && d.data.cpu.usage ? d.data.cpu.usage.total : 0
        }))
      );
    }

    // Store trends
    for (const [metric, trend] of Object.entries(trends)) {
      this.trends.set(metric, {
        ...trend,
        timestamp: new Date(),
        metric
      });
    }

    return trends;
  }

  calculateTrend(dataPoints) {
    if (dataPoints.length < 2) {
      return { direction: 'insufficient_data', slope: 0, correlation: 0 };
    }

    // Filter out null/undefined values
    const validPoints = dataPoints.filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));

    if (validPoints.length < 2) {
      return { direction: 'insufficient_data', slope: 0, correlation: 0 };
    }

    // Linear regression
    const n = validPoints.length;
    const sumX = validPoints.reduce((sum, p) => sum + p.x, 0);
    const sumY = validPoints.reduce((sum, p) => sum + p.y, 0);
    const sumXY = validPoints.reduce((sum, p) => sum + (p.x * p.y), 0);
    const sumXX = validPoints.reduce((sum, p) => sum + (p.x * p.x), 0);
    const sumYY = validPoints.reduce((sum, p) => sum + (p.y * p.y), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominatorX = Math.sqrt(n * sumXX - sumX * sumX);
    const denominatorY = Math.sqrt(n * sumYY - sumY * sumY);
    const correlation = denominatorX * denominatorY !== 0 ?
      numerator / (denominatorX * denominatorY) : 0;

    // Determine trend direction
    let direction = 'stable';
    if (Math.abs(slope) > 0.001) { // Threshold for significant change
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      direction,
      slope,
      intercept,
      correlation,
      dataPoints: n,
      strength: Math.abs(correlation)
    };
  }

  async detectAnomalies(metricsData, performanceData) {
    const anomalies = [];

    // Detect performance anomalies
    if (performanceData.length > this.config.minDataPoints) {
      const responseTimeAnomalies = this.detectStatisticalAnomalies(
        performanceData.map(d => d.responseTime),
        'response_time'
      );

      const errorRateAnomalies = this.detectStatisticalAnomalies(
        performanceData.map(d => d.errorRate),
        'error_rate'
      );

      const throughputAnomalies = this.detectStatisticalAnomalies(
        performanceData.map(d => d.throughput),
        'throughput'
      );

      anomalies.push(...responseTimeAnomalies, ...errorRateAnomalies, ...throughputAnomalies);
    }

    // Store anomalies
    anomalies.forEach(anomaly => {
      this.anomalies.push({
        ...anomaly,
        timestamp: new Date(),
        id: this.generateAnomalyId()
      });
    });

    // Limit anomalies history
    if (this.anomalies.length > 100) {
      this.anomalies = this.anomalies.slice(-100);
    }

    return anomalies;
  }

  detectStatisticalAnomalies(values, metric) {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));

    if (validValues.length < this.config.minDataPoints) {
      return [];
    }

    const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length;
    const stdDev = Math.sqrt(variance);

    const anomalies = [];
    const threshold = this.config.anomalyThreshold * stdDev;

    validValues.forEach((value, index) => {
      const deviation = Math.abs(value - mean);

      if (deviation > threshold) {
        anomalies.push({
          metric,
          value,
          expected: mean,
          deviation,
          threshold,
          severity: deviation > (threshold * 1.5) ? 'high' : 'medium',
          index
        });
      }
    });

    return anomalies;
  }

  async identifyPatterns(performanceData) {
    const patterns = {};

    if (performanceData.length < this.config.minDataPoints) {
      return patterns;
    }

    // Identify daily patterns
    patterns.daily = this.identifyDailyPatterns(performanceData);

    // Identify weekly patterns (if enough data)
    if (performanceData.length > 100) {
      patterns.weekly = this.identifyWeeklyPatterns(performanceData);
    }

    // Identify correlation patterns
    patterns.correlations = this.identifyCorrelations(performanceData);

    return patterns;
  }

  identifyDailyPatterns(data) {
    const hourlyData = new Array(24).fill(null).map(() => []);

    data.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      hourlyData[hour].push(point);
    });

    const hourlyAverages = hourlyData.map((hourData, hour) => {
      if (hourData.length === 0) return { hour, avg: 0, count: 0 };

      const avg = hourData.reduce((sum, p) => sum + p.responseTime, 0) / hourData.length;
      return { hour, avg, count: hourData.length };
    });

    // Find peak and low hours
    const validHours = hourlyAverages.filter(h => h.count > 0);
    const peakHour = validHours.reduce((max, h) => h.avg > max.avg ? h : max, validHours[0]);
    const lowHour = validHours.reduce((min, h) => h.avg < min.avg ? h : min, validHours[0]);

    return {
      hourlyAverages,
      peakHour: peakHour ? peakHour.hour : null,
      lowHour: lowHour ? lowHour.hour : null,
      pattern: this.classifyDailyPattern(hourlyAverages)
    };
  }

  classifyDailyPattern(hourlyAverages) {
    const validHours = hourlyAverages.filter(h => h.count > 0);
    if (validHours.length < 12) return 'insufficient_data';

    const businessHours = validHours.filter(h => h.hour >= 9 && h.hour <= 17);
    const offHours = validHours.filter(h => h.hour < 9 || h.hour > 17);

    if (businessHours.length === 0 || offHours.length === 0) return 'unknown';

    const businessAvg = businessHours.reduce((sum, h) => sum + h.avg, 0) / businessHours.length;
    const offAvg = offHours.reduce((sum, h) => sum + h.avg, 0) / offHours.length;

    const ratio = businessAvg / offAvg;

    if (ratio > 1.5) return 'business_hours_peak';
    if (ratio < 0.5) return 'off_hours_peak';
    return 'uniform';
  }

  identifyWeeklyPatterns(data) {
    const weeklyData = new Array(7).fill(null).map(() => []);

    data.forEach(point => {
      const dayOfWeek = new Date(point.timestamp).getDay();
      weeklyData[dayOfWeek].push(point);
    });

    const dailyAverages = weeklyData.map((dayData, day) => {
      if (dayData.length === 0) return { day, avg: 0, count: 0 };

      const avg = dayData.reduce((sum, p) => sum + p.responseTime, 0) / dayData.length;
      return { day, avg, count: dayData.length };
    });

    return {
      dailyAverages,
      pattern: this.classifyWeeklyPattern(dailyAverages)
    };
  }

  classifyWeeklyPattern(dailyAverages) {
    const validDays = dailyAverages.filter(d => d.count > 0);
    if (validDays.length < 5) return 'insufficient_data';

    const weekdays = validDays.filter(d => d.day >= 1 && d.day <= 5);
    const weekends = validDays.filter(d => d.day === 0 || d.day === 6);

    if (weekdays.length === 0 || weekends.length === 0) return 'unknown';

    const weekdayAvg = weekdays.reduce((sum, d) => sum + d.avg, 0) / weekdays.length;
    const weekendAvg = weekends.reduce((sum, d) => sum + d.avg, 0) / weekends.length;

    const ratio = weekdayAvg / weekendAvg;

    if (ratio > 1.3) return 'weekday_heavy';
    if (ratio < 0.7) return 'weekend_heavy';
    return 'uniform';
  }

  identifyCorrelations(data) {
    const correlations = {};

    // Calculate correlation between different metrics
    const metrics = ['responseTime', 'errorRate', 'throughput', 'memoryUsage', 'cpuUsage'];

    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];

        const values1 = data.map(d => d[metric1]).filter(v => v !== null && !isNaN(v));
        const values2 = data.map(d => d[metric2]).filter(v => v !== null && !isNaN(v));

        if (values1.length > this.config.minDataPoints && values2.length > this.config.minDataPoints) {
          const correlation = this.calculateCorrelation(values1, values2);

          if (Math.abs(correlation) > 0.3) { // Significant correlation
            correlations[`${metric1}_${metric2}`] = {
              metric1,
              metric2,
              correlation,
              strength: this.classifyCorrelationStrength(correlation)
            };
          }
        }
      }
    }

    return correlations;
  }

  calculateCorrelation(values1, values2) {
    const n = Math.min(values1.length, values2.length);
    if (n < 2) return 0;

    const mean1 = values1.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
    const mean2 = values2.slice(0, n).reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;

      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  classifyCorrelationStrength(correlation) {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'strong';
    if (abs >= 0.5) return 'moderate';
    if (abs >= 0.3) return 'weak';
    return 'negligible';
  }

  async generatePredictions(metricsData, performanceData) {
    if (!this.config.enablePredictions) return {};

    const predictions = {};

    // Predict response time trend
    if (performanceData.length > this.config.minDataPoints) {
      predictions.responseTime = this.predictLinearTrend(
        performanceData.map((d, i) => ({ x: i, y: d.responseTime }))
      );

      predictions.errorRate = this.predictLinearTrend(
        performanceData.map((d, i) => ({ x: i, y: d.errorRate }))
      );

      predictions.memoryUsage = this.predictLinearTrend(
        performanceData.map((d, i) => ({ x: i, y: d.memoryUsage }))
      );
    }

    // Store predictions
    for (const [metric, prediction] of Object.entries(predictions)) {
      this.predictions.set(metric, {
        ...prediction,
        timestamp: new Date(),
        metric
      });
    }

    return predictions;
  }

  predictLinearTrend(dataPoints) {
    const trend = this.calculateTrend(dataPoints);

    if (trend.direction === 'insufficient_data' || Math.abs(trend.correlation) < 0.3) {
      return {
        available: false,
        reason: 'insufficient_correlation'
      };
    }

    // Predict next few points
    const lastX = dataPoints[dataPoints.length - 1].x;
    const predictions = [];

    for (let i = 1; i <= 5; i++) {
      const x = lastX + i;
      const y = trend.slope * x + trend.intercept;
      predictions.push({ x, y, timestamp: new Date(Date.now() + i * this.config.analysisInterval) });
    }

    return {
      available: true,
      trend: trend.direction,
      confidence: Math.abs(trend.correlation),
      predictions
    };
  }

  async generateRecommendations(metricsData, performanceData) {
    if (!this.config.enableRecommendations) return [];

    const recommendations = [];

    // Analyze current state
    const currentStats = this.performanceMonitor.getPerformanceStats();
    const trends = this.trends;

    // Memory usage recommendations
    if (currentStats.health.memoryUsage > 80) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        title: 'High Memory Usage Detected',
        description: `Memory usage is at ${currentStats.health.memoryUsage.toFixed(1)}%`,
        actions: [
          'Consider increasing memory allocation',
          'Review memory leaks in application code',
          'Implement memory caching strategies',
          'Monitor garbage collection patterns'
        ]
      });
    }

    // Error rate recommendations
    if (currentStats.health.errorRate > 5) {
      recommendations.push({
        type: 'errors',
        priority: 'high',
        title: 'High Error Rate Detected',
        description: `Error rate is at ${currentStats.health.errorRate.toFixed(2)}%`,
        actions: [
          'Review application logs for error patterns',
          'Implement better error handling',
          'Check database connectivity',
          'Review API dependencies'
        ]
      });
    }

    // Response time recommendations
    const responseTimeTrend = trends.get('responseTime');
    if (responseTimeTrend && responseTimeTrend.direction === 'increasing' && responseTimeTrend.strength > 0.5) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Response Time Increasing',
        description: 'Response times are showing an increasing trend',
        actions: [
          'Optimize database queries',
          'Review API endpoints performance',
          'Consider implementing caching',
          'Scale up resources if needed'
        ]
      });
    }

    // Throughput recommendations
    if (currentStats.health.throughput < 10) { // Low throughput
      recommendations.push({
        type: 'throughput',
        priority: 'medium',
        title: 'Low Throughput Detected',
        description: `Current throughput is ${currentStats.health.throughput.toFixed(2)} req/s`,
        actions: [
          'Review application bottlenecks',
          'Optimize request processing',
          'Consider load balancing',
          'Review resource allocation'
        ]
      });
    }

    // Store recommendations
    this.recommendations = recommendations;

    return recommendations;
  }

  storeAnalysisResults(analysis) {
    this.analysisHistory.push(analysis);

    // Limit history size
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory = this.analysisHistory.slice(-this.maxHistorySize);
    }

    // Generate insights
    this.generateInsights(analysis);
  }

  generateInsights(analysis) {
    const insights = [];

    // Trend insights
    Object.entries(analysis.trends).forEach(([metric, trend]) => {
      if (trend.strength > 0.7) {
        insights.push({
          type: 'trend',
          metric,
          title: `Strong ${trend.direction} trend in ${metric}`,
          description: `${metric} shows a ${trend.strength.toFixed(2)} correlation ${trend.direction} trend`,
          impact: trend.strength > 0.8 ? 'high' : 'medium'
        });
      }
    });

    // Anomaly insights
    if (analysis.anomalies.length > 0) {
      const highSeverityAnomalies = analysis.anomalies.filter(a => a.severity === 'high');
      if (highSeverityAnomalies.length > 0) {
        insights.push({
          type: 'anomaly',
          title: `${highSeverityAnomalies.length} high-severity anomalies detected`,
          description: 'System behavior is significantly deviating from normal patterns',
          impact: 'high',
          metrics: highSeverityAnomalies.map(a => a.metric)
        });
      }
    }

    // Pattern insights
    if (analysis.patterns.correlations) {
      const strongCorrelations = Object.values(analysis.patterns.correlations)
        .filter(c => c.strength === 'strong');

      if (strongCorrelations.length > 0) {
        insights.push({
          type: 'correlation',
          title: `${strongCorrelations.length} strong metric correlations found`,
          description: 'Multiple system metrics are strongly correlated',
          impact: 'medium',
          correlations: strongCorrelations
        });
      }
    }

    this.insights = insights;
  }

  // Utility methods
  generateAnomalyId() {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getAnalyticsData() {
    return {
      trends: Object.fromEntries(this.trends),
      anomalies: this.anomalies.slice(-20), // Last 20 anomalies
      predictions: Object.fromEntries(this.predictions),
      recommendations: this.recommendations,
      insights: this.insights,
      analysisHistory: this.analysisHistory.slice(-10) // Last 10 analyses
    };
  }

  getTrends(metric = null) {
    if (metric) {
      return this.trends.get(metric);
    }
    return Object.fromEntries(this.trends);
  }

  getAnomalies(limit = 20) {
    return this.anomalies.slice(-limit);
  }

  getPredictions(metric = null) {
    if (metric) {
      return this.predictions.get(metric);
    }
    return Object.fromEntries(this.predictions);
  }

  getRecommendations(priority = null) {
    if (priority) {
      return this.recommendations.filter(r => r.priority === priority);
    }
    return this.recommendations;
  }

  getInsights(type = null) {
    if (type) {
      return this.insights.filter(i => i.type === type);
    }
    return this.insights;
  }

  async shutdown() {
    this.stopAnalytics();
    this.removeAllListeners();
  }
}

// Singleton instance
let systemAnalyticsInstance = null;

class SystemAnalyticsSingleton {
  static getInstance(options = {}) {
    if (!systemAnalyticsInstance) {
      systemAnalyticsInstance = new SystemAnalytics(options);
    }
    return systemAnalyticsInstance;
  }
}

module.exports = { SystemAnalytics, SystemAnalyticsSingleton };
