/**
 * Production Deployment API Routes
 * RESTful endpoints for managing MainNet production deployments
 */
const express = require('express');
const ProductionDeploymentManager = require('../deployment/ProductionDeploymentManager');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize deployment manager
const deploymentManager = new ProductionDeploymentManager({
  environment: 'production',
  regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
  scalingPolicy: {
    minNodes: 5,
    maxNodes: 200,
    targetCPU: 65,
    targetMemory: 75
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     DeploymentStatus:
 *       type: object
 *       properties:
 *         timestamp:
 *           type: number
 *         overallStatus:
 *           type: string
 *           enum: [healthy, warning, critical]
 *         regions:
 *           type: object
 *         globalServices:
 *           type: object
 *         metrics:
 *           type: object
 * 
 *     DeploymentRequest:
 *       type: object
 *       properties:
 *         regions:
 *           type: array
 *           items:
 *             type: string
 *         scalingPolicy:
 *           type: object
 *         enableMonitoring:
 *           type: boolean
 *         enableBackups:
 *           type: boolean
 */

/**
 * @swagger
 * /api/deployment/status:
 *   get:
 *     summary: Get current deployment status
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current deployment status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeploymentStatus'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/status', auth, async (req, res) => {
  try {
    const status = deploymentManager.getDeploymentStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Failed to get deployment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve deployment status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/deploy:
 *   post:
 *     summary: Deploy MainNet infrastructure
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeploymentRequest'
 *     responses:
 *       200:
 *         description: Deployment initiated successfully
 *       400:
 *         description: Invalid deployment configuration
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Deployment failed
 */
router.post('/deploy', auth, async (req, res) => {
  try {
    const { regions, scalingPolicy, enableMonitoring = true, enableBackups = true } = req.body;
    
    // Validate deployment request
    if (!regions || !Array.isArray(regions) || regions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid regions configuration',
        details: 'At least one region must be specified'
      });
    }

    // Update deployment manager configuration
    if (scalingPolicy) {
      deploymentManager.config.scalingPolicy = { ...deploymentManager.config.scalingPolicy, ...scalingPolicy };
    }
    
    if (regions) {
      deploymentManager.config.regions = regions;
    }

    logger.info('Starting MainNet infrastructure deployment...');
    
    // Start deployment (this is an async operation)
    const deploymentPromise = deploymentManager.deployMainNetInfrastructure();
    
    // Return immediately with deployment ID
    const deploymentId = `deployment_${Date.now()}`;
    
    res.json({
      success: true,
      deploymentId,
      message: 'MainNet deployment initiated',
      regions,
      estimatedTime: '20-30 minutes',
      timestamp: Date.now()
    });

    // Continue deployment in background
    try {
      const result = await deploymentPromise;
      logger.info('MainNet deployment completed successfully:', result);
    } catch (deploymentError) {
      logger.error('MainNet deployment failed:', deploymentError);
    }
    
  } catch (error) {
    logger.error('Failed to initiate deployment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate deployment',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/regions/{region}/status:
 *   get:
 *     summary: Get status for specific region
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *         description: AWS region identifier
 *     responses:
 *       200:
 *         description: Region deployment status
 *       404:
 *         description: Region not found
 *       500:
 *         description: Internal server error
 */
router.get('/regions/:region/status', auth, async (req, res) => {
  try {
    const { region } = req.params;
    
    if (!deploymentManager.config.regions.includes(region)) {
      return res.status(404).json({
        success: false,
        error: 'Region not found',
        availableRegions: deploymentManager.config.regions
      });
    }

    const deployment = deploymentManager.deployments.get(region);
    const metrics = deploymentManager.scalingMetrics.get(region);
    const healthCheck = deploymentManager.healthChecks.get(region);

    const regionStatus = {
      region,
      deployment: deployment || { status: 'not_deployed' },
      metrics: metrics || { healthy: false, lastCheck: null },
      healthCheckId: healthCheck || null,
      services: await deploymentManager.getRegionServices(region),
      timestamp: Date.now()
    };

    res.json({
      success: true,
      data: regionStatus
    });
    
  } catch (error) {
    logger.error(`Failed to get region status for ${req.params.region}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve region status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/regions/{region}/scale:
 *   post:
 *     summary: Scale region infrastructure
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               desiredCapacity:
 *                 type: number
 *               maxCapacity:
 *                 type: number
 *               minCapacity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Scaling operation initiated
 *       400:
 *         description: Invalid scaling parameters
 *       404:
 *         description: Region not found
 *       500:
 *         description: Scaling failed
 */
router.post('/regions/:region/scale', auth, async (req, res) => {
  try {
    const { region } = req.params;
    const { desiredCapacity, maxCapacity, minCapacity } = req.body;
    
    if (!deploymentManager.config.regions.includes(region)) {
      return res.status(404).json({
        success: false,
        error: 'Region not found',
        availableRegions: deploymentManager.config.regions
      });
    }

    // Validate scaling parameters
    if (desiredCapacity && (desiredCapacity < 1 || desiredCapacity > 1000)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid desired capacity',
        details: 'Desired capacity must be between 1 and 1000'
      });
    }

    if (maxCapacity && maxCapacity < (desiredCapacity || 1)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid max capacity',
        details: 'Max capacity must be greater than or equal to desired capacity'
      });
    }

    if (minCapacity && minCapacity > (desiredCapacity || 1000)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid min capacity',
        details: 'Min capacity must be less than or equal to desired capacity'
      });
    }

    // Perform scaling operation
    const scalingRequest = {
      region,
      desiredCapacity,
      maxCapacity,
      minCapacity,
      timestamp: Date.now()
    };

    // Mock scaling operation (would call actual AWS Auto Scaling API)
    logger.info(`Scaling region ${region}:`, scalingRequest);
    
    res.json({
      success: true,
      message: `Scaling operation initiated for ${region}`,
      request: scalingRequest,
      estimatedTime: '5-10 minutes'
    });
    
  } catch (error) {
    logger.error(`Failed to scale region ${req.params.region}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to scale region',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/health:
 *   get:
 *     summary: Get health status of all regions
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health status for all regions
 *       500:
 *         description: Internal server error
 */
router.get('/health', auth, async (req, res) => {
  try {
    const healthStatus = {
      timestamp: Date.now(),
      overallHealth: 'healthy',
      regions: {},
      globalServices: {
        route53: 'active',
        cloudFront: 'active',
        monitoring: 'active'
      },
      alerts: deploymentManager.alertHistory.slice(-10) // Last 10 alerts
    };

    let healthyRegions = 0;
    
    for (const region of deploymentManager.config.regions) {
      try {
        const regionHealth = await deploymentManager.performHealthCheck(region);
        healthStatus.regions[region] = {
          status: 'healthy',
          responseTime: regionHealth.responseTime || 0,
          lastCheck: Date.now(),
          services: regionHealth.services || {}
        };
        healthyRegions++;
      } catch (error) {
        healthStatus.regions[region] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: Date.now()
        };
      }
    }

    // Determine overall health
    if (healthyRegions === 0) {
      healthStatus.overallHealth = 'critical';
    } else if (healthyRegions < deploymentManager.config.regions.length) {
      healthStatus.overallHealth = 'warning';
    }

    res.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    logger.error('Failed to get health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/alerts:
 *   get:
 *     summary: Get recent deployment alerts
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of alerts to return
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [info, warning, critical]
 *         description: Filter alerts by severity
 *     responses:
 *       200:
 *         description: List of recent alerts
 *       500:
 *         description: Internal server error
 */
router.get('/alerts', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const severity = req.query.severity;
    
    let alerts = deploymentManager.alertHistory.slice(-limit);
    
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    const alertsSummary = {
      total: alerts.length,
      byType: {},
      bySeverity: {},
      byRegion: {}
    };

    // Generate summary statistics
    alerts.forEach(alert => {
      // Count by type
      alertsSummary.byType[alert.type] = (alertsSummary.byType[alert.type] || 0) + 1;
      
      // Count by severity
      alertsSummary.bySeverity[alert.severity] = (alertsSummary.bySeverity[alert.severity] || 0) + 1;
      
      // Count by region
      if (alert.region) {
        alertsSummary.byRegion[alert.region] = (alertsSummary.byRegion[alert.region] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        alerts,
        summary: alertsSummary,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/backup:
 *   post:
 *     summary: Trigger manual backup
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [full, incremental, configuration]
 *               regions:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Backup initiated successfully
 *       400:
 *         description: Invalid backup request
 *       500:
 *         description: Backup failed
 */
router.post('/backup', auth, async (req, res) => {
  try {
    const { type = 'full', regions, description } = req.body;
    
    const validTypes = ['full', 'incremental', 'configuration'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup type',
        validTypes
      });
    }

    const targetRegions = regions || deploymentManager.config.regions;
    
    const backupRequest = {
      id: `backup_${Date.now()}`,
      type,
      regions: targetRegions,
      description: description || `Manual ${type} backup`,
      timestamp: Date.now(),
      status: 'initiated'
    };

    logger.info('Manual backup initiated:', backupRequest);

    // Mock backup operation (would trigger actual backup procedures)
    setTimeout(() => {
      logger.info(`Backup ${backupRequest.id} completed successfully`);
    }, 5000);

    res.json({
      success: true,
      backup: backupRequest,
      estimatedTime: type === 'full' ? '30-60 minutes' : '10-20 minutes'
    });
    
  } catch (error) {
    logger.error('Failed to initiate backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate backup',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/deployment/failover:
 *   post:
 *     summary: Trigger manual failover
 *     tags: [Production Deployment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromRegion:
 *                 type: string
 *               toRegion:
 *                 type: string
 *               reason:
 *                 type: string
 *               force:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Failover initiated successfully
 *       400:
 *         description: Invalid failover request
 *       500:
 *         description: Failover failed
 */
router.post('/failover', auth, async (req, res) => {
  try {
    const { fromRegion, toRegion, reason, force = false } = req.body;
    
    if (!fromRegion || !toRegion) {
      return res.status(400).json({
        success: false,
        error: 'Both fromRegion and toRegion are required'
      });
    }

    if (!deploymentManager.config.regions.includes(fromRegion) || 
        !deploymentManager.config.regions.includes(toRegion)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid region specified',
        availableRegions: deploymentManager.config.regions
      });
    }

    if (fromRegion === toRegion) {
      return res.status(400).json({
        success: false,
        error: 'Source and target regions cannot be the same'
      });
    }

    const failoverRequest = {
      id: `failover_${Date.now()}`,
      fromRegion,
      toRegion,
      reason: reason || 'Manual failover',
      force,
      timestamp: Date.now(),
      status: 'initiated'
    };

    logger.warn('Manual failover initiated:', failoverRequest);

    // Mock failover operation (would trigger actual failover procedures)
    setTimeout(() => {
      logger.info(`Failover ${failoverRequest.id} completed successfully`);
    }, 10000);

    res.json({
      success: true,
      failover: failoverRequest,
      estimatedTime: '5-15 minutes',
      warning: 'Failover operations may cause temporary service interruption'
    });
    
  } catch (error) {
    logger.error('Failed to initiate failover:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate failover',
      details: error.message
    });
  }
});

module.exports = router;