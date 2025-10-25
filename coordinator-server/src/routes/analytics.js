const express = require('express');
const router = express.Router();
const AdvancedAnalyticsEngine = require('../analytics/AdvancedAnalyticsEngine');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

// Initialize analytics engine
const analyticsEngine = new AdvancedAnalyticsEngine();

/**
 * @swagger
 * /api/analytics/report:
 *   get:
 *     summary: Get comprehensive analytics report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics report generated successfully
 */
router.get('/report', authenticate, async (req, res) => {
  try {
    const report = await analyticsEngine.generateAnalyticsReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Failed to generate analytics report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics report'
    });
  }
});

/**
 * @swagger
 * /api/analytics/predictions/network:
 *   get:
 *     summary: Get network health predictions
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeHorizon
 *         schema:
 *           type: integer
 *           default: 7200000
 *         description: Prediction time horizon in milliseconds
 *     responses:
 *       200:
 *         description: Network predictions generated successfully
 */
router.get('/predictions/network', authenticate, async (req, res) => {
  try {
    const timeHorizon = parseInt(req.query.timeHorizon) || 7200000;
    const predictions = await analyticsEngine.predictNetworkHealth(timeHorizon);

    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    logger.error('Failed to generate network predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate network predictions'
    });
  }
});

/**
 * @swagger
 * /api/analytics/predictions/node/{nodeId}:
 *   get:
 *     summary: Get node performance predictions
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Node ID to analyze
 *       - in: query
 *         name: timeHorizon
 *         schema:
 *           type: integer
 *           default: 3600000
 *         description: Prediction time horizon in milliseconds
 *     responses:
 *       200:
 *         description: Node predictions generated successfully
 */
router.get('/predictions/node/:nodeId', authenticate, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const timeHorizon = parseInt(req.query.timeHorizon) || 3600000;

    const predictions = await analyticsEngine.predictNodePerformance(nodeId, timeHorizon);

    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    logger.error('Failed to generate node predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate node predictions'
    });
  }
});

/**
 * @swagger
 * /api/analytics/anomalies:
 *   get:
 *     summary: Detect network anomalies
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Anomaly detection completed
 */
router.get('/anomalies', authenticate, async (req, res) => {
  try {
    const anomalies = await analyticsEngine.detectAnomalies();

    res.json({
      success: true,
      data: anomalies
    });
  } catch (error) {
    logger.error('Failed to detect anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect anomalies'
    });
  }
});

/**
 * @swagger
 * /api/analytics/defi/{protocol}:
 *   get:
 *     summary: Get DeFi protocol analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: protocol
 *         required: true
 *         schema:
 *           type: string
 *         description: DeFi protocol name
 *       - in: query
 *         name: timeHorizon
 *         schema:
 *           type: integer
 *           default: 86400000
 *         description: Prediction time horizon in milliseconds
 *     responses:
 *       200:
 *         description: DeFi analytics generated successfully
 */
router.get('/defi/:protocol', authenticate, async (req, res) => {
  try {
    const { protocol } = req.params;
    const timeHorizon = parseInt(req.query.timeHorizon) || 86400000;

    const predictions = await analyticsEngine.predictDeFiYield(protocol, timeHorizon);

    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    logger.error('Failed to generate DeFi analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate DeFi analytics'
    });
  }
});

/**
 * @swagger
 * /api/analytics/metrics/node:
 *   post:
 *     summary: Submit node metrics for analysis
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nodeId
 *               - metrics
 *             properties:
 *               nodeId:
 *                 type: string
 *               metrics:
 *                 type: object
 *                 properties:
 *                   cpuUsage:
 *                     type: number
 *                   memoryUsage:
 *                     type: number
 *                   diskUsage:
 *                     type: number
 *                   networkLatency:
 *                     type: number
 *                   tasksCompleted:
 *                     type: integer
 *                   tasksError:
 *                     type: integer
 *                   uptime:
 *                     type: integer
 *                   computeScore:
 *                     type: number
 *                   reputation:
 *                     type: number
 *                   earnings:
 *                     type: number
 *     responses:
 *       201:
 *         description: Node metrics collected successfully
 */
router.post('/metrics/node', authenticate, async (req, res) => {
  try {
    const { nodeId, metrics } = req.body;

    if (!nodeId || !metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing nodeId or metrics'
      });
    }

    const result = analyticsEngine.collectNodeMetrics(nodeId, metrics);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to collect node metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect node metrics'
    });
  }
});

/**
 * @swagger
 * /api/analytics/metrics/network:
 *   post:
 *     summary: Submit network metrics for analysis
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metrics
 *             properties:
 *               metrics:
 *                 type: object
 *                 properties:
 *                   activeNodes:
 *                     type: integer
 *                   totalNodes:
 *                     type: integer
 *                   networkHashRate:
 *                     type: number
 *                   consensusRate:
 *                     type: number
 *                   transactionThroughput:
 *                     type: number
 *                   averageBlockTime:
 *                     type: number
 *                   networkHealth:
 *                     type: number
 *                   totalStaked:
 *                     type: number
 *                   rewardRate:
 *                     type: number
 *                   slashingEvents:
 *                     type: integer
 *                   crossChainVolume:
 *                     type: number
 *                   defiTvl:
 *                     type: number
 *                   gasPrice:
 *                     type: number
 *                   bridgeUtilization:
 *                     type: number
 *                   validatorCount:
 *                     type: integer
 *     responses:
 *       201:
 *         description: Network metrics collected successfully
 */
router.post('/metrics/network', authenticate, authorize(['admin', 'validator']), async (req, res) => {
  try {
    const { metrics } = req.body;

    if (!metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing metrics'
      });
    }

    const result = analyticsEngine.collectNetworkMetrics(metrics);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to collect network metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect network metrics'
    });
  }
});

/**
 * @swagger
 * /api/analytics/metrics/defi:
 *   post:
 *     summary: Submit DeFi protocol metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - protocol
 *               - metrics
 *             properties:
 *               protocol:
 *                 type: string
 *               metrics:
 *                 type: object
 *                 properties:
 *                   tvl:
 *                     type: number
 *                   apy:
 *                     type: number
 *                   volume24h:
 *                     type: number
 *                   liquidity:
 *                     type: number
 *                   userCount:
 *                     type: integer
 *                   transactionCount:
 *                     type: integer
 *                   fees24h:
 *                     type: number
 *                   impermanentLoss:
 *                     type: number
 *                   slippageAverage:
 *                     type: number
 *                   healthFactor:
 *                     type: number
 *     responses:
 *       201:
 *         description: DeFi metrics collected successfully
 */
router.post('/metrics/defi', authenticate, async (req, res) => {
  try {
    const { protocol, metrics } = req.body;

    if (!protocol || !metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing protocol or metrics'
      });
    }

    const result = analyticsEngine.collectDeFiMetrics(protocol, metrics);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to collect DeFi metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect DeFi metrics'
    });
  }
});

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get analytics dashboard data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const [report, anomalies] = await Promise.all([
      analyticsEngine.generateAnalyticsReport(),
      analyticsEngine.detectAnomalies()
    ]);

    const dashboardData = {
      summary: report.summary,
      networkHealth: report.networkPredictions,
      recentAnomalies: anomalies.anomalies.slice(0, 5),
      topNodes: Object.entries(report.nodeAnalytics)
        .sort(([,a], [,b]) => b.currentPerformance - a.currentPerformance)
        .slice(0, 10),
      defiOverview: report.defiInsights,
      crossChainStats: report.crossChainAnalytics,
      systemAlerts: report.alerts
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

module.exports = router;
