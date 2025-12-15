const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const NodeReputationSystem = require('../../services/NodeReputationSystem');

// Initialize reputation system (in production, this should be singleton)
const reputationSystem = new NodeReputationSystem();

/**
 * @route GET /api/reputation/stats
 * @desc Get overall reputation statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = reputationSystem.getReputationStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching reputation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reputation statistics'
    });
  }
});

/**
 * @route GET /api/reputation/node/:nodeId
 * @desc Get specific node reputation
 * @access Public
 */
router.get('/node/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const nodeReputation = reputationSystem.getNodeReputation(nodeId);

    if (!nodeReputation) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      });
    }

    res.json({
      success: true,
      data: nodeReputation
    });
  } catch (error) {
    logger.error(`Error fetching node reputation for ${req.params.nodeId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node reputation'
    });
  }
});

/**
 * @route GET /api/reputation/top
 * @desc Get top performing nodes
 * @access Public
 */
router.get('/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topNodes = reputationSystem.getTopNodes(limit);

    res.json({
      success: true,
      data: topNodes
    });
  } catch (error) {
    logger.error('Error fetching top nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top nodes'
    });
  }
});

/**
 * @route POST /api/reputation/register
 * @desc Register new node
 * @access Protected (admin only)
 */
router.post('/register', async (req, res) => {
  try {
    const { nodeId, metadata = {} } = req.body;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error: 'Node ID is required'
      });
    }

    const nodeReputation = reputationSystem.registerNode(nodeId, metadata);

    logger.info(`New node registered: ${nodeId}`);

    res.json({
      success: true,
      data: nodeReputation
    });
  } catch (error) {
    logger.error(`Error registering node ${req.body.nodeId}:`, error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/reputation/update
 * @desc Update node reputation based on task performance
 * @access Protected (internal only)
 */
router.post('/update', async (req, res) => {
  try {
    const { nodeId, taskResult } = req.body;

    if (!nodeId || !taskResult) {
      return res.status(400).json({
        success: false,
        error: 'Node ID and task result are required'
      });
    }

    const newReputation = reputationSystem.updateTaskPerformance(nodeId, taskResult);

    res.json({
      success: true,
      data: {
        nodeId,
        newReputation,
        updated: new Date()
      }
    });
  } catch (error) {
    logger.error(`Error updating reputation for node ${req.body.nodeId}:`, error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/reputation/validation-probability/:nodeId
 * @desc Get validation probability for a node
 * @access Internal
 */
router.get('/validation-probability/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const probability = reputationSystem.getValidationProbability(nodeId);

    res.json({
      success: true,
      data: {
        nodeId,
        validationProbability: probability,
        shouldValidate: reputationSystem.shouldValidateTask(nodeId)
      }
    });
  } catch (error) {
    logger.error(`Error fetching validation probability for ${req.params.nodeId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation probability'
    });
  }
});

/**
 * @route POST /api/reputation/decay
 * @desc Apply daily reputation decay (maintenance endpoint)
 * @access Protected (admin only)
 */
router.post('/decay', async (req, res) => {
  try {
    reputationSystem.applyReputationDecay();

    res.json({
      success: true,
      message: 'Reputation decay applied successfully'
    });
  } catch (error) {
    logger.error('Error applying reputation decay:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply reputation decay'
    });
  }
});

/**
 * @route GET /api/reputation/leaderboard
 * @desc Get reputation leaderboard with additional stats
 * @access Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const topNodes = reputationSystem.getTopNodes(limit);
    const stats = reputationSystem.getReputationStats();

    res.json({
      success: true,
      data: {
        leaderboard: topNodes,
        stats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

module.exports = router;
