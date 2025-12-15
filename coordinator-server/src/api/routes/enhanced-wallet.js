/**
 * Enhanced Crypto Wallet API Routes
 * Advanced wallet with DeFi, NFT, and Multi-Sig support
 */

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Service dependencies
let defiService = null;
let nftService = null;
let multiSigService = null;

// Set dependencies from main app
router.setDependencies = (defi, nft, multiSig) => {
  defiService = defi;
  nftService = nft;
  multiSigService = multiSig;
};

/**
 * @route GET /api/enhanced-wallet/overview
 * @desc Get comprehensive wallet overview
 * @access Private
 */
router.get('/overview', authenticate, async (req, res) => {
  try {
    const userAddress = req.user.walletAddress || req.body.walletAddress;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address required'
      });
    }

    const overview = {
      address: userAddress,
      balances: {},
      defi: {},
      nfts: {},
      multiSig: {}
    };

    // Get DeFi portfolio
    if (defiService) {
      try {
        overview.defi = await defiService.getUserDeFiPortfolio(userAddress);
      } catch (error) {
        logger.error('Failed to get DeFi portfolio', { error: error.message });
        overview.defi = { error: 'DeFi data unavailable' };
      }
    }

    // Get NFT portfolio
    if (nftService) {
      try {
        overview.nfts = await nftService.getUserNFTPortfolio(userAddress);
      } catch (error) {
        logger.error('Failed to get NFT portfolio', { error: error.message });
        overview.nfts = { error: 'NFT data unavailable' };
      }
    }

    // Get Multi-Sig wallets
    if (multiSigService) {
      try {
        overview.multiSig = {
          wallets: Array.from(multiSigService.wallets.values())
            .filter(wallet => wallet.signers.has(userAddress))
            .map(wallet => multiSigService.sanitizeWalletForResponse(wallet))
        };
      } catch (error) {
        logger.error('Failed to get multi-sig wallets', { error: error.message });
        overview.multiSig = { error: 'Multi-sig data unavailable' };
      }
    }

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('Failed to get wallet overview', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet overview'
    });
  }
});

// ==================== DeFi Routes ====================

/**
 * @route GET /api/enhanced-wallet/defi/opportunities
 * @desc Get available DeFi opportunities
 * @access Private
 */
router.get('/defi/opportunities', authenticate, async (req, res) => {
  try {
    if (!defiService) {
      return res.status(503).json({
        success: false,
        error: 'DeFi service not available'
      });
    }

    const userAddress = req.user.walletAddress || req.query.address;
    const tokenAddress = req.query.token;

    const opportunities = await defiService.getDeFiOpportunities(userAddress, tokenAddress);

    res.json({
      success: true,
      data: opportunities
    });

  } catch (error) {
    logger.error('Failed to get DeFi opportunities', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get DeFi opportunities'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/defi/execute
 * @desc Execute DeFi transaction
 * @access Private
 */
router.post('/defi/execute', authenticate, async (req, res) => {
  try {
    if (!defiService) {
      return res.status(503).json({
        success: false,
        error: 'DeFi service not available'
      });
    }

    const { opportunity, amount, privateKey } = req.body;
    const userAddress = req.user.walletAddress;

    if (!opportunity || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Opportunity and amount required'
      });
    }

    const result = await defiService.executeDeFiTransaction(
      userAddress,
      opportunity,
      amount,
      privateKey
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to execute DeFi transaction', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to execute DeFi transaction'
    });
  }
});

/**
 * @route GET /api/enhanced-wallet/defi/portfolio
 * @desc Get user's DeFi portfolio
 * @access Private
 */
router.get('/defi/portfolio', authenticate, async (req, res) => {
  try {
    if (!defiService) {
      return res.status(503).json({
        success: false,
        error: 'DeFi service not available'
      });
    }

    const userAddress = req.user.walletAddress || req.query.address;
    const portfolio = await defiService.getUserDeFiPortfolio(userAddress);

    res.json({
      success: true,
      data: portfolio
    });

  } catch (error) {
    logger.error('Failed to get DeFi portfolio', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get DeFi portfolio'
    });
  }
});

/**
 * @route GET /api/enhanced-wallet/defi/risks/:opportunityId
 * @desc Analyze DeFi risks for specific opportunity
 * @access Private
 */
router.get('/defi/risks/:opportunityId', authenticate, async (req, res) => {
  try {
    if (!defiService) {
      return res.status(503).json({
        success: false,
        error: 'DeFi service not available'
      });
    }

    const { opportunityId } = req.params;
    const opportunity = req.body.opportunity; // Should be passed in request body

    const risks = await defiService.analyzeDeFiRisks(opportunity);

    res.json({
      success: true,
      data: risks
    });

  } catch (error) {
    logger.error('Failed to analyze DeFi risks', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to analyze DeFi risks'
    });
  }
});

// ==================== NFT Routes ====================

/**
 * @route GET /api/enhanced-wallet/nft/portfolio
 * @desc Get user's NFT portfolio
 * @access Private
 */
router.get('/nft/portfolio', authenticate, async (req, res) => {
  try {
    if (!nftService) {
      return res.status(503).json({
        success: false,
        error: 'NFT service not available'
      });
    }

    const userAddress = req.user.walletAddress || req.query.address;
    const portfolio = await nftService.getUserNFTPortfolio(userAddress);

    res.json({
      success: true,
      data: portfolio
    });

  } catch (error) {
    logger.error('Failed to get NFT portfolio', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get NFT portfolio'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/nft/list
 * @desc List NFT for sale
 * @access Private
 */
router.post('/nft/list', authenticate, async (req, res) => {
  try {
    if (!nftService) {
      return res.status(503).json({
        success: false,
        error: 'NFT service not available'
      });
    }

    const { nft, price, duration, marketplace } = req.body;
    const userAddress = req.user.walletAddress;

    if (!nft || !price || !marketplace) {
      return res.status(400).json({
        success: false,
        error: 'NFT, price, and marketplace required'
      });
    }

    const result = await nftService.listNFTForSale(userAddress, nft, {
      price,
      duration: duration || 7, // 7 days default
      marketplace
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to list NFT', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list NFT'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/nft/buy
 * @desc Buy NFT from marketplace
 * @access Private
 */
router.post('/nft/buy', authenticate, async (req, res) => {
  try {
    if (!nftService) {
      return res.status(503).json({
        success: false,
        error: 'NFT service not available'
      });
    }

    const { nftListing, privateKey } = req.body;
    const userAddress = req.user.walletAddress;

    if (!nftListing) {
      return res.status(400).json({
        success: false,
        error: 'NFT listing required'
      });
    }

    const result = await nftService.buyNFT(userAddress, nftListing, privateKey);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to buy NFT', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to buy NFT'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/nft/transfer
 * @desc Transfer NFT to another address
 * @access Private
 */
router.post('/nft/transfer', authenticate, async (req, res) => {
  try {
    if (!nftService) {
      return res.status(503).json({
        success: false,
        error: 'NFT service not available'
      });
    }

    const { toAddress, nft, privateKey } = req.body;
    const fromAddress = req.user.walletAddress;

    if (!toAddress || !nft) {
      return res.status(400).json({
        success: false,
        error: 'Recipient address and NFT required'
      });
    }

    const result = await nftService.transferNFT(fromAddress, toAddress, nft, privateKey);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to transfer NFT', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to transfer NFT'
    });
  }
});

/**
 * @route GET /api/enhanced-wallet/nft/market-trends
 * @desc Get NFT market trends
 * @access Public
 */
router.get('/nft/market-trends', async (req, res) => {
  try {
    if (!nftService) {
      return res.status(503).json({
        success: false,
        error: 'NFT service not available'
      });
    }

    const timeframe = req.query.timeframe || '7d';
    const trends = await nftService.getMarketTrends(timeframe);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    logger.error('Failed to get market trends', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get market trends'
    });
  }
});

// ==================== Multi-Sig Routes ====================

/**
 * @route POST /api/enhanced-wallet/multisig/create
 * @desc Create new multi-sig wallet
 * @access Private
 */
router.post('/multisig/create', authenticate, async (req, res) => {
  try {
    if (!multiSigService) {
      return res.status(503).json({
        success: false,
        error: 'Multi-sig service not available'
      });
    }

    const walletConfig = req.body;
    const creatorAddress = req.user.walletAddress;

    const result = await multiSigService.createMultiSigWallet(creatorAddress, walletConfig);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Failed to create multi-sig wallet', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create multi-sig wallet'
    });
  }
});

/**
 * @route GET /api/enhanced-wallet/multisig/:walletId
 * @desc Get multi-sig wallet details
 * @access Private
 */
router.get('/multisig/:walletId', authenticate, async (req, res) => {
  try {
    if (!multiSigService) {
      return res.status(503).json({
        success: false,
        error: 'Multi-sig service not available'
      });
    }

    const { walletId } = req.params;
    const requestorAddress = req.user.walletAddress;

    const result = multiSigService.getWalletDetails(walletId, requestorAddress);

    res.json(result);

  } catch (error) {
    logger.error('Failed to get wallet details', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet details'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/multisig/:walletId/propose
 * @desc Create transaction proposal
 * @access Private
 */
router.post('/multisig/:walletId/propose', authenticate, async (req, res) => {
  try {
    if (!multiSigService) {
      return res.status(503).json({
        success: false,
        error: 'Multi-sig service not available'
      });
    }

    const { walletId } = req.params;
    const transactionData = req.body;
    const proposerAddress = req.user.walletAddress;

    const result = await multiSigService.createTransactionProposal(
      walletId,
      proposerAddress,
      transactionData
    );

    res.json(result);

  } catch (error) {
    logger.error('Failed to create proposal', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create proposal'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/multisig/proposal/:proposalId/sign
 * @desc Sign transaction proposal
 * @access Private
 */
router.post('/multisig/proposal/:proposalId/sign', authenticate, async (req, res) => {
  try {
    if (!multiSigService) {
      return res.status(503).json({
        success: false,
        error: 'Multi-sig service not available'
      });
    }

    const { proposalId } = req.params;
    const { signature } = req.body;
    const signerAddress = req.user.walletAddress;

    const result = await multiSigService.signTransactionProposal(
      proposalId,
      signerAddress,
      signature
    );

    res.json(result);

  } catch (error) {
    logger.error('Failed to sign proposal', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to sign proposal'
    });
  }
});

/**
 * @route GET /api/enhanced-wallet/multisig/:walletId/pending
 * @desc Get pending transactions
 * @access Private
 */
router.get('/multisig/:walletId/pending', authenticate, async (req, res) => {
  try {
    if (!multiSigService) {
      return res.status(503).json({
        success: false,
        error: 'Multi-sig service not available'
      });
    }

    const { walletId } = req.params;
    const requestorAddress = req.user.walletAddress;

    const result = multiSigService.getPendingTransactions(walletId, requestorAddress);

    res.json(result);

  } catch (error) {
    logger.error('Failed to get pending transactions', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get pending transactions'
    });
  }
});

/**
 * @route POST /api/enhanced-wallet/multisig/:walletId/signers
 * @desc Add new signer to wallet
 * @access Private
 */
router.post('/multisig/:walletId/signers', authenticate, async (req, res) => {
  try {
    if (!multiSigService) {
      return res.status(503).json({
        success: false,
        error: 'Multi-sig service not available'
      });
    }

    const { walletId } = req.params;
    const { signerAddress, role } = req.body;
    const requestorAddress = req.user.walletAddress;

    if (!signerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Signer address required'
      });
    }

    const result = await multiSigService.addSigner(
      walletId,
      requestorAddress,
      signerAddress,
      role
    );

    res.json(result);

  } catch (error) {
    logger.error('Failed to add signer', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add signer'
    });
  }
});

// ==================== Analytics Routes ====================

/**
 * @route GET /api/enhanced-wallet/analytics
 * @desc Get wallet analytics and statistics
 * @access Admin
 */
router.get('/analytics', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const analytics = {
      defi: defiService ? defiService.getAnalytics() : null,
      nft: nftService ? nftService.getAnalytics() : null,
      multiSig: multiSigService ? multiSigService.getAnalytics() : null
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Failed to get wallet analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet analytics'
    });
  }
});

module.exports = router;
