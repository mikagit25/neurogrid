const tf = require('@tensorflow/tfjs-node');
const logger = require('../utils/logger');

/**
 * Advanced Analytics Engine for NeuroGrid MainNet
 * Provides machine learning insights, predictive analytics, and performance optimization
 */
class AdvancedAnalyticsEngine {
  constructor(config = {}) {
    this.config = {
      predictionInterval: config.predictionInterval || 3600000, // 1 hour
      modelRetentionPeriod: config.modelRetentionPeriod || 30, // 30 days
      analysisDepth: config.analysisDepth || 1000, // Number of data points
      alertThresholds: {
        nodePerformance: 0.8,
        networkHealth: 0.9,
        transactionSuccess: 0.95,
        consensusEfficiency: 0.85
      },
      ...config
    };

    // Data storage for analytics
    this.nodeMetrics = new Map(); // nodeId -> metrics history
    this.networkMetrics = [];
    this.transactionData = [];
    this.consensusData = [];
    this.crossChainData = [];
    this.defiMetrics = [];

    // ML Models
    this.models = {
      nodePerformancePredictor: null,
      networkHealthPredictor: null,
      transactionVolumePredictor: null,
      anomalyDetector: null,
      defiYieldPredictor: null
    };

    // Real-time analysis state
    this.isAnalyzing = false;
    this.lastAnalysis = Date.now();
    this.analyticsResults = {};

    this.initializeModels();
    logger.info('Advanced Analytics Engine initialized');
  }

  /**
   * Initialize machine learning models
   */
  async initializeModels() {
    try {
      // Node Performance Prediction Model
      this.models.nodePerformancePredictor = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      this.models.nodePerformancePredictor.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });

      // Network Health Prediction Model
      this.models.networkHealthPredictor = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [15], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'linear' })
        ]
      });

      this.models.networkHealthPredictor.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
      });

      // Anomaly Detection Model (Autoencoder)
      this.models.anomalyDetector = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [20], units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 20, activation: 'linear' })
        ]
      });

      this.models.anomalyDetector.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
      });

      // DeFi Yield Prediction Model
      this.models.defiYieldPredictor = tf.sequential({
        layers: [
          tf.layers.lstm({ inputShape: [30, 8], units: 50, returnSequences: true }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.lstm({ units: 50, returnSequences: false }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 25, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'linear' })
        ]
      });

      this.models.defiYieldPredictor.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
      });

      logger.info('ML models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ML models:', error);
    }
  }

  /**
   * Collect and store node metrics
   */
  collectNodeMetrics(nodeId, metrics) {
    const timestamp = Date.now();
    const nodeMetric = {
      nodeId,
      timestamp,
      cpuUsage: metrics.cpuUsage || 0,
      memoryUsage: metrics.memoryUsage || 0,
      diskUsage: metrics.diskUsage || 0,
      networkLatency: metrics.networkLatency || 0,
      tasksCompleted: metrics.tasksCompleted || 0,
      tasksError: metrics.tasksError || 0,
      uptime: metrics.uptime || 0,
      computeScore: metrics.computeScore || 0,
      reputation: metrics.reputation || 1.0,
      earnings: metrics.earnings || 0
    };

    if (!this.nodeMetrics.has(nodeId)) {
      this.nodeMetrics.set(nodeId, []);
    }

    const nodeHistory = this.nodeMetrics.get(nodeId);
    nodeHistory.push(nodeMetric);

    // Keep only recent data
    if (nodeHistory.length > this.config.analysisDepth) {
      nodeHistory.shift();
    }

    this.nodeMetrics.set(nodeId, nodeHistory);
    return nodeMetric;
  }

  /**
   * Collect network-wide metrics
   */
  collectNetworkMetrics(metrics) {
    const networkMetric = {
      timestamp: Date.now(),
      activeNodes: metrics.activeNodes || 0,
      totalNodes: metrics.totalNodes || 0,
      networkHashRate: metrics.networkHashRate || 0,
      consensusRate: metrics.consensusRate || 0,
      transactionThroughput: metrics.transactionThroughput || 0,
      averageBlockTime: metrics.averageBlockTime || 0,
      networkHealth: metrics.networkHealth || 0,
      totalStaked: metrics.totalStaked || 0,
      rewardRate: metrics.rewardRate || 0,
      slashingEvents: metrics.slashingEvents || 0,
      crossChainVolume: metrics.crossChainVolume || 0,
      defiTvl: metrics.defiTvl || 0,
      gasPrice: metrics.gasPrice || 0,
      bridgeUtilization: metrics.bridgeUtilization || 0,
      validatorCount: metrics.validatorCount || 0
    };

    this.networkMetrics.push(networkMetric);

    // Keep only recent data
    if (this.networkMetrics.length > this.config.analysisDepth) {
      this.networkMetrics.shift();
    }

    return networkMetric;
  }

  /**
   * Collect transaction data for analysis
   */
  collectTransactionData(transaction) {
    const txData = {
      timestamp: transaction.timestamp || Date.now(),
      type: transaction.type || 'transfer',
      amount: transaction.amount || 0,
      fee: transaction.fee || 0,
      blockNumber: transaction.blockNumber || 0,
      gasUsed: transaction.gasUsed || 0,
      success: transaction.success || false,
      confirmationTime: transaction.confirmationTime || 0,
      isMultiSig: transaction.isMultiSig || false,
      isCrossChain: transaction.isCrossChain || false,
      sourceChain: transaction.sourceChain || 'neurogrid',
      targetChain: transaction.targetChain || 'neurogrid',
      complexity: transaction.complexity || 1
    };

    this.transactionData.push(txData);

    // Keep only recent data
    if (this.transactionData.length > this.config.analysisDepth * 2) {
      this.transactionData.shift();
    }

    return txData;
  }

  /**
   * Collect DeFi metrics
   */
  collectDeFiMetrics(protocol, metrics) {
    const defiMetric = {
      timestamp: Date.now(),
      protocol,
      tvl: metrics.tvl || 0,
      apy: metrics.apy || 0,
      volume24h: metrics.volume24h || 0,
      liquidity: metrics.liquidity || 0,
      userCount: metrics.userCount || 0,
      transactionCount: metrics.transactionCount || 0,
      fees24h: metrics.fees24h || 0,
      impermanentLoss: metrics.impermanentLoss || 0,
      slippageAverage: metrics.slippageAverage || 0,
      healthFactor: metrics.healthFactor || 1.0
    };

    this.defiMetrics.push(defiMetric);

    // Keep only recent data
    if (this.defiMetrics.length > this.config.analysisDepth) {
      this.defiMetrics.shift();
    }

    return defiMetric;
  }

  /**
   * Predict node performance using ML
   */
  async predictNodePerformance(nodeId, timeHorizon = 3600000) {
    try {
      const nodeHistory = this.nodeMetrics.get(nodeId);
      if (!nodeHistory || nodeHistory.length < 10) {
        return { prediction: 0.5, confidence: 0.1, warning: 'Insufficient data' };
      }

      // Prepare features
      const recentMetrics = nodeHistory.slice(-10);
      const features = recentMetrics.map(m => [
        m.cpuUsage / 100,
        m.memoryUsage / 100,
        m.diskUsage / 100,
        m.networkLatency / 1000,
        m.tasksCompleted / (m.tasksCompleted + m.tasksError + 1),
        m.uptime / 86400000, // days
        m.computeScore / 100,
        m.reputation,
        m.earnings / 1000,
        (Date.now() - m.timestamp) / 3600000 // hours ago
      ]);

      const inputTensor = tf.tensor2d([features[features.length - 1]]);
      const prediction = await this.models.nodePerformancePredictor.predict(inputTensor);
      const predictionValue = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      const performanceScore = predictionValue[0];
      const confidence = Math.min(1.0, nodeHistory.length / 100);

      return {
        prediction: performanceScore,
        confidence,
        recommendation: this.generateNodeRecommendation(performanceScore, recentMetrics[recentMetrics.length - 1]),
        timeHorizon
      };
    } catch (error) {
      logger.error('Node performance prediction failed:', error);
      return { prediction: 0.5, confidence: 0.1, error: error.message };
    }
  }

  /**
   * Predict network health trends
   */
  async predictNetworkHealth(timeHorizon = 7200000) {
    try {
      if (this.networkMetrics.length < 15) {
        return { prediction: 0.5, confidence: 0.1, warning: 'Insufficient network data' };
      }

      // Prepare features from recent network metrics
      const recentMetrics = this.networkMetrics.slice(-15);
      const features = recentMetrics.map(m => [
        m.activeNodes / m.totalNodes,
        m.networkHashRate / 1000000,
        m.consensusRate / 100,
        m.transactionThroughput / 1000,
        m.averageBlockTime / 30000,
        m.networkHealth / 100,
        m.totalStaked / 1000000,
        m.rewardRate / 100,
        m.slashingEvents,
        m.crossChainVolume / 1000000,
        m.defiTvl / 1000000,
        m.gasPrice / 100,
        m.bridgeUtilization / 100,
        m.validatorCount,
        (Date.now() - m.timestamp) / 3600000
      ]);

      const inputTensor = tf.tensor2d([features[features.length - 1]]);
      const prediction = await this.models.networkHealthPredictor.predict(inputTensor);
      const predictionValue = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      const healthScore = Math.max(0, Math.min(1, predictionValue[0]));
      const confidence = Math.min(1.0, this.networkMetrics.length / 200);

      return {
        prediction: healthScore,
        confidence,
        trends: this.analyzeNetworkTrends(),
        alerts: this.generateNetworkAlerts(healthScore),
        timeHorizon
      };
    } catch (error) {
      logger.error('Network health prediction failed:', error);
      return { prediction: 0.5, confidence: 0.1, error: error.message };
    }
  }

  /**
   * Detect anomalies in network behavior
   */
  async detectAnomalies() {
    try {
      if (this.networkMetrics.length < 20) {
        return { anomalies: [], score: 0, warning: 'Insufficient data for anomaly detection' };
      }

      const recentMetrics = this.networkMetrics.slice(-20);
      const features = recentMetrics.map(m => [
        m.activeNodes / m.totalNodes,
        m.networkHashRate / 1000000,
        m.consensusRate / 100,
        m.transactionThroughput / 1000,
        m.averageBlockTime / 30000,
        m.networkHealth / 100,
        m.totalStaked / 1000000,
        m.rewardRate / 100,
        m.slashingEvents / 10,
        m.crossChainVolume / 1000000,
        m.defiTvl / 1000000,
        m.gasPrice / 100,
        m.bridgeUtilization / 100,
        m.validatorCount / 50,
        Math.sin((m.timestamp % 86400000) / 86400000 * 2 * Math.PI), // Time of day
        Math.sin((m.timestamp % 604800000) / 604800000 * 2 * Math.PI), // Day of week
        Math.random() * 0.1, // Noise
        Math.random() * 0.1, // Noise
        Math.random() * 0.1, // Noise
        Math.random() * 0.1  // Noise
      ]);

      const inputTensor = tf.tensor2d(features);
      const reconstruction = await this.models.anomalyDetector.predict(inputTensor);
      const reconstructionData = await reconstruction.data();

      inputTensor.dispose();
      reconstruction.dispose();

      // Calculate reconstruction error for anomaly detection
      const anomalies = [];
      const threshold = 0.1; // Anomaly threshold

      for (let i = 0; i < features.length; i++) {
        let totalError = 0;
        for (let j = 0; j < features[i].length; j++) {
          const error = Math.pow(features[i][j] - reconstructionData[i * features[i].length + j], 2);
          totalError += error;
        }

        const avgError = totalError / features[i].length;
        if (avgError > threshold) {
          anomalies.push({
            timestamp: recentMetrics[i].timestamp,
            severity: avgError > threshold * 2 ? 'high' : 'medium',
            errorScore: avgError,
            metrics: recentMetrics[i],
            description: this.describeAnomaly(recentMetrics[i], avgError)
          });
        }
      }

      return {
        anomalies,
        totalAnomalies: anomalies.length,
        averageAnomalyScore: anomalies.length > 0
          ? anomalies.reduce((sum, a) => sum + a.errorScore, 0) / anomalies.length
          : 0,
        lastChecked: Date.now()
      };
    } catch (error) {
      logger.error('Anomaly detection failed:', error);
      return { anomalies: [], score: 0, error: error.message };
    }
  }

  /**
   * Predict DeFi yield and performance
   */
  async predictDeFiYield(protocol, timeHorizon = 86400000) {
    try {
      const protocolMetrics = this.defiMetrics.filter(m => m.protocol === protocol);
      if (protocolMetrics.length < 30) {
        return { prediction: 0, confidence: 0.1, warning: 'Insufficient DeFi data' };
      }

      // Prepare time series features
      const recentMetrics = protocolMetrics.slice(-30);
      const sequences = [];

      for (let i = 0; i < recentMetrics.length; i++) {
        sequences.push([
          recentMetrics[i].tvl / 1000000,
          recentMetrics[i].apy / 100,
          recentMetrics[i].volume24h / 1000000,
          recentMetrics[i].liquidity / 1000000,
          recentMetrics[i].userCount / 1000,
          recentMetrics[i].transactionCount / 1000,
          recentMetrics[i].fees24h / 10000,
          recentMetrics[i].healthFactor
        ]);
      }

      const inputTensor = tf.tensor3d([sequences]);
      const prediction = await this.models.defiYieldPredictor.predict(inputTensor);
      const predictionValue = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      const yieldPrediction = predictionValue[0] * 100; // Convert to percentage
      const confidence = Math.min(1.0, protocolMetrics.length / 100);

      return {
        prediction: yieldPrediction,
        confidence,
        currentYield: recentMetrics[recentMetrics.length - 1].apy,
        trend: yieldPrediction > recentMetrics[recentMetrics.length - 1].apy ? 'increasing' : 'decreasing',
        risk: this.assessDeFiRisk(recentMetrics[recentMetrics.length - 1]),
        timeHorizon
      };
    } catch (error) {
      logger.error('DeFi yield prediction failed:', error);
      return { prediction: 0, confidence: 0.1, error: error.message };
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport() {
    try {
      const report = {
        timestamp: Date.now(),
        summary: {
          totalNodes: this.nodeMetrics.size,
          networkHealth: this.getLatestNetworkHealth(),
          totalTransactions: this.transactionData.length,
          activeDeFiProtocols: [...new Set(this.defiMetrics.map(m => m.protocol))].length
        },
        nodeAnalytics: await this.analyzeAllNodes(),
        networkPredictions: await this.predictNetworkHealth(),
        anomalies: await this.detectAnomalies(),
        defiInsights: await this.analyzeDeFiPerformance(),
        crossChainAnalytics: this.analyzeCrossChainActivity(),
        recommendations: this.generateRecommendations(),
        alerts: this.generateSystemAlerts()
      };

      this.analyticsResults = report;
      logger.info('Analytics report generated successfully');
      return report;
    } catch (error) {
      logger.error('Failed to generate analytics report:', error);
      return { error: error.message, timestamp: Date.now() };
    }
  }

  /**
   * Analyze performance of all nodes
   */
  async analyzeAllNodes() {
    const nodeAnalytics = {};

    for (const [nodeId] of this.nodeMetrics) {
      try {
        const prediction = await this.predictNodePerformance(nodeId);
        const metrics = this.nodeMetrics.get(nodeId);
        const latest = metrics[metrics.length - 1];

        nodeAnalytics[nodeId] = {
          currentPerformance: latest.computeScore / 100,
          predictedPerformance: prediction.prediction,
          confidence: prediction.confidence,
          uptime: latest.uptime,
          tasksCompleted: latest.tasksCompleted,
          earnings: latest.earnings,
          reputation: latest.reputation,
          recommendation: prediction.recommendation,
          status: this.getNodeStatus(latest)
        };
      } catch (error) {
        logger.error(`Failed to analyze node ${nodeId}:`, error);
      }
    }

    return nodeAnalytics;
  }

  /**
   * Analyze DeFi protocol performance
   */
  async analyzeDeFiPerformance() {
    const protocols = [...new Set(this.defiMetrics.map(m => m.protocol))];
    const defiAnalytics = {};

    for (const protocol of protocols) {
      try {
        const yieldPrediction = await this.predictDeFiYield(protocol);
        const protocolMetrics = this.defiMetrics.filter(m => m.protocol === protocol);
        const latest = protocolMetrics[protocolMetrics.length - 1];

        defiAnalytics[protocol] = {
          currentAPY: latest?.apy || 0,
          predictedAPY: yieldPrediction.prediction,
          tvl: latest?.tvl || 0,
          volume24h: latest?.volume24h || 0,
          userCount: latest?.userCount || 0,
          riskLevel: yieldPrediction.risk,
          trend: yieldPrediction.trend,
          confidence: yieldPrediction.confidence
        };
      } catch (error) {
        logger.error(`Failed to analyze DeFi protocol ${protocol}:`, error);
      }
    }

    return defiAnalytics;
  }

  /**
   * Helper methods
   */
  generateNodeRecommendation(performanceScore, _metrics) {
    if (performanceScore < 0.3) {
      return 'Critical: Node requires immediate attention. Check hardware and network connectivity.';
    } else if (performanceScore < 0.6) {
      return 'Warning: Node performance below optimal. Consider resource optimization.';
    } else if (performanceScore < 0.8) {
      return 'Good: Node performing well. Minor optimizations possible.';
    } else {
      return 'Excellent: Node operating at peak performance.';
    }
  }

  analyzeNetworkTrends() {
    if (this.networkMetrics.length < 10) return {};

    const recent = this.networkMetrics.slice(-10);
    const older = this.networkMetrics.slice(-20, -10);

    return {
      nodeCountTrend: this.calculateTrend(recent, older, 'activeNodes'),
      healthTrend: this.calculateTrend(recent, older, 'networkHealth'),
      throughputTrend: this.calculateTrend(recent, older, 'transactionThroughput'),
      stakingTrend: this.calculateTrend(recent, older, 'totalStaked')
    };
  }

  calculateTrend(recent, older, metric) {
    const recentAvg = recent.reduce((sum, m) => sum + m[metric], 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m[metric], 0) / older.length;

    if (olderAvg === 0) return 0;
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  generateNetworkAlerts(healthScore) {
    const alerts = [];

    if (healthScore < this.config.alertThresholds.networkHealth) {
      alerts.push({
        type: 'warning',
        message: 'Network health below threshold',
        severity: healthScore < 0.7 ? 'high' : 'medium'
      });
    }

    return alerts;
  }

  describeAnomaly(metrics, _errorScore) {
    if (metrics.consensusRate < 80) {
      return 'Consensus rate significantly below normal';
    } else if (metrics.transactionThroughput < 100) {
      return 'Transaction throughput unusually low';
    } else if (metrics.slashingEvents > 5) {
      return 'High number of slashing events detected';
    } else {
      return 'Unusual network behavior pattern detected';
    }
  }

  assessDeFiRisk(metrics) {
    let riskScore = 0;

    if (metrics.impermanentLoss > 5) riskScore += 30;
    if (metrics.slippageAverage > 2) riskScore += 20;
    if (metrics.healthFactor < 1.5) riskScore += 25;
    if (metrics.apy > 100) riskScore += 25; // Too good to be true

    if (riskScore < 30) return 'low';
    if (riskScore < 60) return 'medium';
    return 'high';
  }

  analyzeCrossChainActivity() {
    const crossChainTxs = this.transactionData.filter(tx => tx.isCrossChain);

    return {
      totalCrossChainTxs: crossChainTxs.length,
      successRate: crossChainTxs.length > 0
        ? (crossChainTxs.filter(tx => tx.success).length / crossChainTxs.length) * 100
        : 0,
      averageConfirmationTime: crossChainTxs.length > 0
        ? crossChainTxs.reduce((sum, tx) => sum + tx.confirmationTime, 0) / crossChainTxs.length
        : 0,
      popularChains: this.getPopularChains(crossChainTxs)
    };
  }

  getPopularChains(crossChainTxs) {
    const chainCounts = {};
    crossChainTxs.forEach(tx => {
      chainCounts[tx.targetChain] = (chainCounts[tx.targetChain] || 0) + 1;
    });

    return Object.entries(chainCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([chain, count]) => ({ chain, count }));
  }

  generateRecommendations() {
    const recommendations = [];

    // Add various recommendations based on analysis
    if (this.getLatestNetworkHealth() < 85) {
      recommendations.push({
        type: 'network',
        priority: 'high',
        message: 'Consider adding more validator nodes to improve network health'
      });
    }

    return recommendations;
  }

  generateSystemAlerts() {
    const alerts = [];
    const latestNetwork = this.networkMetrics[this.networkMetrics.length - 1];

    if (latestNetwork?.networkHealth < 80) {
      alerts.push({
        type: 'critical',
        message: 'Network health critically low',
        timestamp: Date.now()
      });
    }

    return alerts;
  }

  getLatestNetworkHealth() {
    const latest = this.networkMetrics[this.networkMetrics.length - 1];
    return latest?.networkHealth || 0;
  }

  getNodeStatus(metrics) {
    if (metrics.uptime < 86400000) return 'unstable';
    if (metrics.computeScore < 50) return 'underperforming';
    if (metrics.computeScore > 90) return 'excellent';
    return 'good';
  }
}

module.exports = AdvancedAnalyticsEngine;
