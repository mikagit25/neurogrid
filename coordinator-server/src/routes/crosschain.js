const express = require('express');
const router = express.Router();
const CrossChainBridge = require('../bridges/CrossChainBridge');
const DeFiIntegration = require('../defi/DeFiIntegration');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const logger = require('../utils/logger');

// Initialize cross-chain components
const bridge = new CrossChainBridge({
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    bridgeContract: process.env.ETHEREUM_BRIDGE_CONTRACT,
    privateKey: process.env.ETHEREUM_PRIVATE_KEY
  },
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL,
    bridgeContract: process.env.POLYGON_BRIDGE_CONTRACT,
    privateKey: process.env.POLYGON_PRIVATE_KEY
  },
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL,
    bridgeContract: process.env.BSC_BRIDGE_CONTRACT,
    privateKey: process.env.BSC_PRIVATE_KEY
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    bridgeContract: process.env.ARBITRUM_BRIDGE_CONTRACT,
    privateKey: process.env.ARBITRUM_PRIVATE_KEY
  }
});

const defi = new DeFiIntegration(bridge);

/**
 * @swagger
 * components:
 *   schemas:
 *     CrossChainTransfer:
 *       type: object
 *       properties:
 *         transferId:
 *           type: string
 *           description: Unique transfer identifier
 *         sourceChain:
 *           type: string
 *           enum: [ethereum, polygon, bsc, arbitrum, neurogrid]
 *         targetChain:
 *           type: string
 *           enum: [ethereum, polygon, bsc, arbitrum, neurogrid]
 *         token:
 *           type: string
 *           description: Token contract address
 *         amount:
 *           type: string
 *           description: Transfer amount in wei
 *         targetAddress:
 *           type: string
 *           description: Recipient address on target chain
 *         status:
 *           type: string
 *           enum: [initiated, locked, completed, failed]
 *         fees:
 *           type: object
 *           properties:
 *             bridgeFee:
 *               type: number
 *             relayerReward:
 *               type: number
 *             protocolFee:
 *               type: number
 *             totalFee:
 *               type: number
 *     DeFiPosition:
 *       type: object
 *       properties:
 *         positionId:
 *           type: string
 *         protocol:
 *           type: string
 *           enum: [uniswap-v3, aave, compound, sushiswap, pancakeswap, quickswap]
 *         chain:
 *           type: string
 *         token0:
 *           type: string
 *         token1:
 *           type: string
 *         amount:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, closed]
 */

/**
 * @swagger
 * /api/crosschain/transfer:
 *   post:
 *     summary: Initiate cross-chain token transfer
 *     tags: [Cross-Chain]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceChain
 *               - targetChain
 *               - token
 *               - amount
 *               - targetAddress
 *             properties:
 *               sourceChain:
 *                 type: string
 *                 enum: [ethereum, polygon, bsc, arbitrum, neurogrid]
 *                 description: Source blockchain
 *               targetChain:
 *                 type: string
 *                 enum: [ethereum, polygon, bsc, arbitrum, neurogrid]
 *                 description: Target blockchain
 *               token:
 *                 type: string
 *                 description: Token contract address
 *               amount:
 *                 type: string
 *                 description: Transfer amount in wei
 *               targetAddress:
 *                 type: string
 *                 description: Recipient address on target chain
 *     responses:
 *       201:
 *         description: Transfer initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transferId:
 *                   type: string
 *                 lockTxHash:
 *                   type: string
 *                 estimatedTime:
 *                   type: number
 *                   description: Estimated transfer time in seconds
 *                 fees:
 *                   type: object
 *       400:
 *         description: Invalid transfer parameters
 *       401:
 *         description: Authentication required
 */
router.post('/transfer', authenticate, validateRequest([
  'sourceChain',
  'targetChain',
  'token',
  'amount',
  'targetAddress'
]), async (req, res) => {
  try {
    const { sourceChain, targetChain, token, amount, targetAddress } = req.body;
    const senderAddress = req.user.address || req.user.id;

    const result = await bridge.initiateTransfer({
      sourceChain,
      targetChain,
      token,
      amount: parseInt(amount),
      targetAddress,
      senderAddress
    });

    logger.info(`Cross-chain transfer initiated by user ${req.user.id}`, {
      sourceChain,
      targetChain,
      amount,
      transferId: result.transferId
    });

    res.status(201).json({
      success: true,
      transferId: result.transferId,
      lockTxHash: result.lockTxHash,
      estimatedTime: result.estimatedTime,
      fees: result.fees
    });

  } catch (error) {
    logger.error('Cross-chain transfer failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/crosschain/transfers/{transferId}:
 *   get:
 *     summary: Get transfer status
 *     tags: [Cross-Chain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transfer ID
 *     responses:
 *       200:
 *         description: Transfer details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transfer:
 *                   $ref: '#/components/schemas/CrossChainTransfer'
 *       404:
 *         description: Transfer not found
 */
router.get('/transfers/:transferId', authenticate, async (req, res) => {
  try {
    const { transferId } = req.params;
    const transfer = bridge.bridgeTransactions.get(transferId);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found'
      });
    }

    res.json({
      success: true,
      transfer
    });

  } catch (error) {
    logger.error('Failed to get transfer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transfer status'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/transfers:
 *   get:
 *     summary: Get user's transfer history
 *     tags: [Cross-Chain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of transfers to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of transfers to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, locked, completed, failed]
 *         description: Filter by transfer status
 *     responses:
 *       200:
 *         description: Transfer history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transfers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CrossChainTransfer'
 *                 total:
 *                   type: integer
 *                 pagination:
 *                   type: object
 */
router.get('/transfers', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    const userAddress = req.user.address || req.user.id;

    let transfers = Array.from(bridge.bridgeTransactions.values())
      .filter(transfer => transfer.senderAddress === userAddress);

    if (status) {
      transfers = transfers.filter(transfer => transfer.status === status);
    }

    // Sort by timestamp (newest first)
    transfers.sort((a, b) => b.timestamp - a.timestamp);

    const total = transfers.length;
    const paginatedTransfers = transfers.slice(offset, offset + limit);

    res.json({
      success: true,
      transfers: paginatedTransfers,
      total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    logger.error('Failed to get transfer history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transfer history'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/supported-chains:
 *   get:
 *     summary: Get supported blockchain networks
 *     tags: [Cross-Chain]
 *     responses:
 *       200:
 *         description: List of supported chains
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 chains:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       chainId:
 *                         type: number
 *                       confirmations:
 *                         type: number
 *                       bridgeContract:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [active, paused]
 */
router.get('/supported-chains', async (req, res) => {
  try {
    const chains = [];

    for (const [chainName, config] of Object.entries(bridge.config)) {
      if (chainName !== 'neurogrid' && config.chainId) {
        chains.push({
          name: chainName,
          chainId: config.chainId,
          confirmations: config.confirmations,
          bridgeContract: config.bridgeContract,
          status: bridge.pausedChains.has(chainName) ? 'paused' : 'active'
        });
      }
    }

    res.json({
      success: true,
      chains
    });

  } catch (error) {
    logger.error('Failed to get supported chains:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported chains'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/bridge-status:
 *   get:
 *     summary: Get bridge status and statistics
 *     tags: [Cross-Chain]
 *     responses:
 *       200:
 *         description: Bridge status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: object
 *                   properties:
 *                     totalTransactions:
 *                       type: number
 *                     completedTransactions:
 *                       type: number
 *                     pendingTransactions:
 *                       type: number
 *                     successRate:
 *                       type: number
 *                     totalVolume:
 *                       type: number
 *                     avgTransferTime:
 *                       type: number
 *                     supportedChains:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/bridge-status', async (req, res) => {
  try {
    const status = bridge.getBridgeStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Failed to get bridge status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bridge status'
    });
  }
});

// DeFi Integration Endpoints

/**
 * @swagger
 * /api/crosschain/defi/swap:
 *   post:
 *     summary: Execute token swap on DEX
 *     tags: [DeFi]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenIn
 *               - tokenOut
 *               - amountIn
 *               - chain
 *             properties:
 *               tokenIn:
 *                 type: string
 *                 description: Input token address
 *               tokenOut:
 *                 type: string
 *                 description: Output token address
 *               amountIn:
 *                 type: string
 *                 description: Input amount in wei
 *               chain:
 *                 type: string
 *                 enum: [ethereum, polygon, bsc, arbitrum]
 *               minAmountOut:
 *                 type: string
 *                 description: Minimum output amount (slippage protection)
 *               recipient:
 *                 type: string
 *                 description: Recipient address (optional)
 *     responses:
 *       201:
 *         description: Swap executed successfully
 *       400:
 *         description: Invalid swap parameters
 */
router.post('/defi/swap', authenticate, validateRequest([
  'tokenIn',
  'tokenOut',
  'amountIn',
  'chain'
]), async (req, res) => {
  try {
    const { tokenIn, tokenOut, amountIn, chain, minAmountOut, recipient } = req.body;

    const result = await defi.executeSwap({
      tokenIn,
      tokenOut,
      amountIn: parseInt(amountIn),
      chain,
      minAmountOut: minAmountOut ? parseInt(minAmountOut) : undefined,
      recipient
    });

    logger.info(`DeFi swap executed by user ${req.user.id}`, {
      tokenIn,
      tokenOut,
      amountIn,
      chain,
      swapId: result.swapId
    });

    res.status(201).json({
      success: true,
      swapId: result.swapId,
      txHash: result.txHash,
      swap: result.swap
    });

  } catch (error) {
    logger.error('DeFi swap failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/liquidity:
 *   post:
 *     summary: Create liquidity position
 *     tags: [DeFi]
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
 *               - token0
 *               - token1
 *               - amount0
 *               - amount1
 *               - chain
 *             properties:
 *               protocol:
 *                 type: string
 *                 enum: [uniswap-v3]
 *               token0:
 *                 type: string
 *               token1:
 *                 type: string
 *               amount0:
 *                 type: string
 *               amount1:
 *                 type: string
 *               fee:
 *                 type: number
 *                 description: Fee tier (500, 3000, 10000 for Uniswap V3)
 *               tickLower:
 *                 type: number
 *               tickUpper:
 *                 type: number
 *               chain:
 *                 type: string
 *     responses:
 *       201:
 *         description: Liquidity position created
 */
router.post('/defi/liquidity', authenticate, validateRequest([
  'protocol',
  'token0',
  'token1',
  'amount0',
  'amount1',
  'chain'
]), async (req, res) => {
  try {
    const { protocol, token0, token1, amount0, amount1, fee, tickLower, tickUpper, chain } = req.body;

    let result;
    if (protocol === 'uniswap-v3') {
      result = await defi.createUniswapV3Position({
        token0,
        token1,
        fee: fee || 3000,
        amount0: parseInt(amount0),
        amount1: parseInt(amount1),
        tickLower: tickLower || -60,
        tickUpper: tickUpper || 60,
        chain
      });
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }

    logger.info(`DeFi liquidity position created by user ${req.user.id}`, {
      protocol,
      token0,
      token1,
      positionId: result.positionId
    });

    res.status(201).json({
      success: true,
      positionId: result.positionId,
      txHash: result.txHash,
      position: result.position
    });

  } catch (error) {
    logger.error('DeFi liquidity position creation failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/lending/supply:
 *   post:
 *     summary: Supply tokens to lending protocol
 *     tags: [DeFi]
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
 *               - asset
 *               - amount
 *               - chain
 *             properties:
 *               protocol:
 *                 type: string
 *                 enum: [aave, compound]
 *               asset:
 *                 type: string
 *                 description: Asset token address
 *               amount:
 *                 type: string
 *                 description: Amount to supply in wei
 *               chain:
 *                 type: string
 *               onBehalfOf:
 *                 type: string
 *                 description: Supply on behalf of address (optional)
 *     responses:
 *       201:
 *         description: Supply position created
 */
router.post('/defi/lending/supply', authenticate, validateRequest([
  'protocol',
  'asset',
  'amount',
  'chain'
]), async (req, res) => {
  try {
    const { protocol, asset, amount, chain, onBehalfOf } = req.body;

    let result;
    if (protocol === 'aave') {
      result = await defi.supplyToAave({
        asset,
        amount: parseInt(amount),
        onBehalfOf,
        chain
      });
    } else {
      throw new Error(`Unsupported lending protocol: ${protocol}`);
    }

    logger.info(`DeFi lending supply by user ${req.user.id}`, {
      protocol,
      asset,
      amount,
      positionId: result.positionId
    });

    res.status(201).json({
      success: true,
      positionId: result.positionId,
      txHash: result.txHash,
      position: result.position
    });

  } catch (error) {
    logger.error('DeFi lending supply failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/farming/stake:
 *   post:
 *     summary: Stake tokens in yield farming
 *     tags: [DeFi]
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
 *               - poolId
 *               - amount
 *               - chain
 *             properties:
 *               protocol:
 *                 type: string
 *                 enum: [sushiswap, pancakeswap]
 *               poolId:
 *                 type: number
 *                 description: Farming pool ID
 *               amount:
 *                 type: string
 *                 description: Amount to stake in wei
 *               chain:
 *                 type: string
 *     responses:
 *       201:
 *         description: Farming position created
 */
router.post('/defi/farming/stake', authenticate, validateRequest([
  'protocol',
  'poolId',
  'amount',
  'chain'
]), async (req, res) => {
  try {
    const { protocol, poolId, amount, chain } = req.body;

    const result = await defi.stakeInFarm({
      protocol,
      poolId: parseInt(poolId),
      amount: parseInt(amount),
      chain
    });

    logger.info(`DeFi farming stake by user ${req.user.id}`, {
      protocol,
      poolId,
      amount,
      positionId: result.positionId
    });

    res.status(201).json({
      success: true,
      positionId: result.positionId,
      txHash: result.txHash,
      position: result.position
    });

  } catch (error) {
    logger.error('DeFi farming stake failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/portfolio:
 *   get:
 *     summary: Get user's DeFi portfolio
 *     tags: [DeFi]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 portfolio:
 *                   type: object
 *                   properties:
 *                     totalValue:
 *                       type: number
 *                     totalRewards:
 *                       type: number
 *                     activePositions:
 *                       type: number
 *                     positions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DeFiPosition'
 */
router.get('/defi/portfolio', authenticate, async (req, res) => {
  try {
    const userAddress = req.user.address || req.user.id;
    const portfolio = defi.getPortfolioOverview(userAddress);

    res.json({
      success: true,
      portfolio
    });

  } catch (error) {
    logger.error('Failed to get DeFi portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve portfolio'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/prices:
 *   get:
 *     summary: Get current token prices
 *     tags: [DeFi]
 *     responses:
 *       200:
 *         description: Token prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 prices:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       price:
 *                         type: number
 *                       change24h:
 *                         type: number
 *                       volume24h:
 *                         type: number
 */
router.get('/defi/prices', async (req, res) => {
  try {
    await defi.updateTokenPrices();

    const prices = Object.fromEntries(defi.tokenPrices);

    res.json({
      success: true,
      prices
    });

  } catch (error) {
    logger.error('Failed to get token prices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve token prices'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/apys:
 *   get:
 *     summary: Get current pool APYs
 *     tags: [DeFi]
 *     responses:
 *       200:
 *         description: Pool APYs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 apys:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       apy:
 *                         type: number
 *                       timestamp:
 *                         type: number
 */
router.get('/defi/apys', async (req, res) => {
  try {
    await defi.updatePoolAPYs();

    const apys = Object.fromEntries(defi.poolAPYs);

    res.json({
      success: true,
      apys
    });

  } catch (error) {
    logger.error('Failed to get pool APYs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pool APYs'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/defi/status:
 *   get:
 *     summary: Get DeFi integration status
 *     tags: [DeFi]
 *     responses:
 *       200:
 *         description: DeFi integration status
 */
router.get('/defi/status', async (req, res) => {
  try {
    const status = defi.getIntegrationStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Failed to get DeFi status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve DeFi status'
    });
  }
});

// Admin routes for bridge management

/**
 * @swagger
 * /api/crosschain/admin/pause-chain:
 *   post:
 *     summary: Pause bridge for specific chain (Admin only)
 *     tags: [Cross-Chain Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainName
 *             properties:
 *               chainName:
 *                 type: string
 *                 description: Chain to pause
 *     responses:
 *       200:
 *         description: Chain paused successfully
 *       403:
 *         description: Admin access required
 */
router.post('/admin/pause-chain', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { chainName } = req.body;

    if (!chainName) {
      return res.status(400).json({
        success: false,
        error: 'Chain name is required'
      });
    }

    bridge.pauseChain(chainName);

    logger.warn(`Chain paused by admin ${req.user.id}: ${chainName}`);

    res.json({
      success: true,
      message: `Chain ${chainName} paused successfully`
    });

  } catch (error) {
    logger.error('Failed to pause chain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause chain'
    });
  }
});

/**
 * @swagger
 * /api/crosschain/admin/resume-chain:
 *   post:
 *     summary: Resume bridge for specific chain (Admin only)
 *     tags: [Cross-Chain Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainName
 *             properties:
 *               chainName:
 *                 type: string
 *                 description: Chain to resume
 *     responses:
 *       200:
 *         description: Chain resumed successfully
 */
router.post('/admin/resume-chain', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { chainName } = req.body;

    if (!chainName) {
      return res.status(400).json({
        success: false,
        error: 'Chain name is required'
      });
    }

    bridge.resumeChain(chainName);

    logger.info(`Chain resumed by admin ${req.user.id}: ${chainName}`);

    res.json({
      success: true,
      message: `Chain ${chainName} resumed successfully`
    });

  } catch (error) {
    logger.error('Failed to resume chain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume chain'
    });
  }
});

module.exports = router;
