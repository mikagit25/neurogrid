const express = require('express');
const router = express.Router();
const ProofOfComputeConsensus = require('../consensus/ProofOfComputeConsensus');
const { authenticateToken: authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const logger = require('../utils/logger');

// Initialize consensus engine
const consensus = new ProofOfComputeConsensus();

/**
 * @swagger
 * /api/consensus/validators/register:
 *   post:
 *     summary: Register as a validator
 *     tags: [Consensus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stake
 *               - computePower
 *               - publicKey
 *             properties:
 *               stake:
 *                 type: number
 *                 minimum: 1000
 *                 description: Minimum stake amount in tokens
 *               computePower:
 *                 type: number
 *                 minimum: 1.0
 *                 description: Computational power in GFLOPS
 *               publicKey:
 *                 type: string
 *                 description: Validator's public key for verification
 *               metadata:
 *                 type: object
 *                 description: Additional validator metadata
 *     responses:
 *       201:
 *         description: Validator registered successfully
 *       400:
 *         description: Invalid registration data
 *       401:
 *         description: Authentication required
 */
router.post('/validators/register', authenticate, validateRequest([
  'stake',
  'computePower',
  'publicKey'
]), async (req, res) => {
  try {
    const { stake, computePower, publicKey, metadata = {} } = req.body;

    // Validate minimum requirements
    if (stake < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Minimum stake of 1000 tokens required'
      });
    }

    if (computePower < 1.0) {
      return res.status(400).json({
        success: false,
        error: 'Minimum compute power of 1.0 GFLOPS required'
      });
    }

    const validatorId = consensus.registerValidator(
      req.user.id,
      stake,
      computePower,
      publicKey,
      { ...metadata, ipAddress: req.ip }
    );

    logger.info(`Validator registered: ${validatorId} for user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data: {
        validatorId,
        stake,
        computePower,
        status: 'active',
        registrationTime: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Validator registration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register validator'
    });
  }
});

/**
 * @swagger
 * /api/consensus/work/submit:
 *   post:
 *     summary: Submit computational work for verification
 *     tags: [Consensus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - validatorId
 *               - workResult
 *               - proof
 *             properties:
 *               validatorId:
 *                 type: string
 *                 description: Validator ID submitting the work
 *               workResult:
 *                 type: object
 *                 description: Computational work result
 *               proof:
 *                 type: string
 *                 description: Proof of computation
 *               nonce:
 *                 type: number
 *                 description: Nonce used in computation
 *     responses:
 *       200:
 *         description: Work submitted successfully
 *       400:
 *         description: Invalid work submission
 *       401:
 *         description: Authentication required
 */
router.post('/work/submit', authenticate, validateRequest([
  'validatorId',
  'workResult',
  'proof'
]), async (req, res) => {
  try {
    const { validatorId, workResult, proof, nonce = 0 } = req.body;

    // Verify validator ownership
    const validator = consensus.getValidator(validatorId);
    if (!validator || validator.nodeId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized validator access'
      });
    }

    const result = consensus.submitComputeWork(
      validatorId,
      workResult,
      proof,
      nonce
    );

    logger.info(`Compute work submitted by validator ${validatorId}`);

    res.json({
      success: true,
      data: {
        workId: result.workId,
        validatorId,
        timestamp: result.timestamp,
        verificationStatus: result.verified ? 'verified' : 'pending'
      }
    });

  } catch (error) {
    logger.error('Work submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit work'
    });
  }
});

/**
 * @swagger
 * /api/consensus/challenges/{validatorId}:
 *   get:
 *     summary: Get compute challenges for validator
 *     tags: [Consensus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: validatorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Validator ID to get challenges for
 *     responses:
 *       200:
 *         description: Challenges retrieved successfully
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Validator not found
 */
router.get('/challenges/:validatorId', authenticate, async (req, res) => {
  try {
    const { validatorId } = req.params;

    // Verify validator ownership
    const validator = consensus.getValidator(validatorId);
    if (!validator || validator.nodeId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized validator access'
      });
    }

    const challenges = consensus.getPendingChallenges(validatorId);

    res.json({
      success: true,
      data: {
        validatorId,
        pendingChallenges: challenges.length,
        challenges: challenges.map(challenge => ({
          challengeId: challenge.id,
          type: challenge.type,
          difficulty: challenge.difficulty,
          deadline: challenge.deadline,
          parameters: challenge.parameters
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to get challenges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve challenges'
    });
  }
});

/**
 * @swagger
 * /api/consensus/blocks/latest:
 *   get:
 *     summary: Get latest consensus blocks
 *     tags: [Consensus]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of blocks to retrieve
 *     responses:
 *       200:
 *         description: Latest blocks retrieved successfully
 */
router.get('/blocks/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const blocks = consensus.getLatestBlocks(limit);

    res.json({
      success: true,
      data: {
        totalBlocks: consensus.getBlockHeight(),
        blocks: blocks.map(block => ({
          height: block.height,
          hash: block.hash,
          proposer: block.proposer,
          timestamp: block.timestamp,
          transactionCount: block.transactions.length,
          computeWorkCount: block.computeWork.length
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to get latest blocks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blocks'
    });
  }
});

/**
 * @swagger
 * /api/consensus/validators:
 *   get:
 *     summary: Get all active validators
 *     tags: [Consensus]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, slashed]
 *         description: Filter validators by status
 *     responses:
 *       200:
 *         description: Validators retrieved successfully
 */
router.get('/validators', async (req, res) => {
  try {
    const { status } = req.query;
    const validators = consensus.getAllValidators();

    let filteredValidators = validators;
    if (status) {
      filteredValidators = validators.filter(v => v.status === status);
    }

    res.json({
      success: true,
      data: {
        totalValidators: validators.length,
        activeValidators: validators.filter(v => v.status === 'active').length,
        validators: filteredValidators.map(validator => ({
          id: validator.id,
          stake: validator.stake,
          computePower: validator.computePower,
          status: validator.status,
          reputation: validator.reputation,
          blocksProposed: validator.blocksProposed,
          uptime: validator.uptime,
          lastActivity: validator.lastActivity
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to get validators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validators'
    });
  }
});

/**
 * @swagger
 * /api/consensus/metrics:
 *   get:
 *     summary: Get consensus network metrics
 *     tags: [Consensus]
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = consensus.getNetworkMetrics();

    res.json({
      success: true,
      data: {
        networkHealth: metrics.networkHealth,
        consensusRate: metrics.consensusRate,
        averageBlockTime: metrics.averageBlockTime,
        totalStaked: metrics.totalStaked,
        networkHashrate: metrics.networkHashrate,
        byzantineFaultTolerance: metrics.byzantineFaultTolerance,
        lastBlockHeight: metrics.lastBlockHeight,
        activeValidatorCount: metrics.activeValidatorCount
      }
    });

  } catch (error) {
    logger.error('Failed to get consensus metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

/**
 * @swagger
 * /api/consensus/validators/{validatorId}/stake:
 *   post:
 *     summary: Update validator stake
 *     tags: [Consensus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: validatorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Validator ID to update stake for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - operation
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Amount to stake or unstake
 *               operation:
 *                 type: string
 *                 enum: [stake, unstake]
 *                 description: Stake or unstake operation
 *     responses:
 *       200:
 *         description: Stake updated successfully
 *       400:
 *         description: Invalid stake operation
 *       403:
 *         description: Unauthorized access
 */
router.post('/validators/:validatorId/stake', authenticate, validateRequest([
  'amount',
  'operation'
]), async (req, res) => {
  try {
    const { validatorId } = req.params;
    const { amount, operation } = req.body;

    // Verify validator ownership
    const validator = consensus.getValidator(validatorId);
    if (!validator || validator.nodeId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized validator access'
      });
    }

    let newStake;
    if (operation === 'stake') {
      newStake = consensus.increaseStake(validatorId, amount);
    } else if (operation === 'unstake') {
      newStake = consensus.decreaseStake(validatorId, amount);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation. Must be "stake" or "unstake"'
      });
    }

    logger.info(`Stake ${operation} for validator ${validatorId}: ${amount} tokens`);

    res.json({
      success: true,
      data: {
        validatorId,
        operation,
        amount,
        newStake,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Stake operation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update stake'
    });
  }
});

module.exports = router;
