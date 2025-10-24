const express = require('express');
const router = express.Router();
const { SecurityManagerSingleton } = require('../security/AdvancedSecurityManager');
const MultiSignatureWallet = require('../security/MultiSignatureWallet');
const { authenticateToken, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

// Initialize services
const securityManager = SecurityManagerSingleton.getInstance();
const multiSigWallet = new MultiSignatureWallet();

/**
 * @swagger
 * components:
 *   schemas:
 *     SecurityStatus:
 *       type: object
 *       properties:
 *         initialized:
 *           type: boolean
 *         masterKeysCount:
 *           type: integer
 *         derivedKeysCount:
 *           type: integer
 *         recentAuditEvents:
 *           type: array
 *     MultiSigWallet:
 *       type: object
 *       properties:
 *         walletId:
 *           type: string
 *         signers:
 *           type: array
 *         threshold:
 *           type: integer
 *         balance:
 *           type: number
 *         status:
 *           type: string
 */

/**
 * @swagger
 * /api/security/status:
 *   get:
 *     summary: Get security system status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security system status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SecurityStatus'
 */
router.get('/status', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const status = securityManager.getSecurityStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting security status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security status',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/keys/generate:
 *   post:
 *     summary: Generate new master key
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyId
 *               - passphrase
 *             properties:
 *               keyId:
 *                 type: string
 *               passphrase:
 *                 type: string
 *                 format: password
 */
router.post('/keys/generate', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { keyId, passphrase } = req.body;
    
    if (!keyId || !passphrase) {
      return res.status(400).json({
        success: false,
        error: 'KeyId and passphrase are required'
      });
    }

    if (passphrase.length < 12) {
      return res.status(400).json({
        success: false,
        error: 'Passphrase must be at least 12 characters long'
      });
    }
    
    const result = await securityManager.generateMasterKey(keyId, passphrase);
    
    res.json({
      success: true,
      data: {
        keyId: result.keyId,
        keyFingerprint: result.keyFingerprint
      }
    });
  } catch (error) {
    logger.error('Error generating master key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate master key',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/keys/unlock:
 *   post:
 *     summary: Unlock master key
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyId
 *               - passphrase
 *             properties:
 *               keyId:
 *                 type: string
 *               passphrase:
 *                 type: string
 *                 format: password
 */
router.post('/keys/unlock', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { keyId, passphrase } = req.body;
    
    if (!keyId || !passphrase) {
      return res.status(400).json({
        success: false,
        error: 'KeyId and passphrase are required'
      });
    }
    
    const result = await securityManager.unlockMasterKey(keyId, passphrase);
    
    res.json({
      success: true,
      data: {
        keyId: result.keyId,
        keyFingerprint: result.keyFingerprint
      }
    });
  } catch (error) {
    logger.error('Error unlocking master key:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to unlock master key',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/keys/derive:
 *   post:
 *     summary: Derive key from master key
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - masterKeyId
 *               - purpose
 *             properties:
 *               masterKeyId:
 *                 type: string
 *               purpose:
 *                 type: string
 *               context:
 *                 type: string
 */
router.post('/keys/derive', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { masterKeyId, purpose, context = '' } = req.body;
    
    if (!masterKeyId || !purpose) {
      return res.status(400).json({
        success: false,
        error: 'MasterKeyId and purpose are required'
      });
    }
    
    const result = await securityManager.deriveKey(masterKeyId, purpose, context);
    
    res.json({
      success: true,
      data: {
        keyId: result.keyId,
        keyFingerprint: result.keyFingerprint
      }
    });
  } catch (error) {
    logger.error('Error deriving key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to derive key',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/encrypt:
 *   post:
 *     summary: Encrypt data with specified key
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyId
 *               - data
 *             properties:
 *               keyId:
 *                 type: string
 *               data:
 *                 type: string
 *               additionalData:
 *                 type: string
 */
router.post('/encrypt', authenticateToken, authorize(['admin', 'user']), async (req, res) => {
  try {
    const { keyId, data, additionalData = '' } = req.body;
    
    if (!keyId || !data) {
      return res.status(400).json({
        success: false,
        error: 'KeyId and data are required'
      });
    }
    
    const dataBuffer = Buffer.from(data, 'utf8');
    const result = await securityManager.encryptData(keyId, dataBuffer, additionalData);
    
    res.json({
      success: true,
      data: result.encryptedData
    });
  } catch (error) {
    logger.error('Error encrypting data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to encrypt data',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/decrypt:
 *   post:
 *     summary: Decrypt data with specified key
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyId
 *               - encryptedData
 *             properties:
 *               keyId:
 *                 type: string
 *               encryptedData:
 *                 type: object
 */
router.post('/decrypt', authenticateToken, authorize(['admin', 'user']), async (req, res) => {
  try {
    const { keyId, encryptedData } = req.body;
    
    if (!keyId || !encryptedData) {
      return res.status(400).json({
        success: false,
        error: 'KeyId and encryptedData are required'
      });
    }
    
    const result = await securityManager.decryptData(keyId, encryptedData);
    
    res.json({
      success: true,
      data: {
        decryptedData: result.decryptedData.toString('utf8')
      }
    });
  } catch (error) {
    logger.error('Error decrypting data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decrypt data',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/backup:
 *   post:
 *     summary: Create secure backup
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passphrase
 *             properties:
 *               passphrase:
 *                 type: string
 *                 format: password
 */
router.post('/backup', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { passphrase } = req.body;
    
    if (!passphrase || passphrase.length < 12) {
      return res.status(400).json({
        success: false,
        error: 'Strong passphrase (12+ characters) is required'
      });
    }
    
    const result = await securityManager.createSecureBackup(passphrase);
    
    res.json({
      success: true,
      data: {
        backupFileName: result.backupFileName,
        keyCount: result.keyCount,
        created: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      message: error.message
    });
  }
});

// Multi-Signature Wallet Routes

/**
 * @swagger
 * /api/security/multisig/create:
 *   post:
 *     summary: Create multi-signature wallet
 *     tags: [MultiSig]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - signers
 *               - threshold
 *             properties:
 *               walletId:
 *                 type: string
 *               signers:
 *                 type: array
 *               threshold:
 *                 type: integer
 *               requireAllForAdmin:
 *                 type: boolean
 */
router.post('/multisig/create', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const walletConfig = req.body;
    
    if (!walletConfig.walletId || !walletConfig.signers || !walletConfig.threshold) {
      return res.status(400).json({
        success: false,
        error: 'WalletId, signers, and threshold are required'
      });
    }
    
    const result = await multiSigWallet.createMultiSigWallet(walletConfig);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error creating multi-sig wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create multi-signature wallet',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/multisig/{walletId}:
 *   get:
 *     summary: Get multi-signature wallet info
 *     tags: [MultiSig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/multisig/:walletId', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const walletInfo = multiSigWallet.getWalletInfo(walletId);
    
    res.json({
      success: true,
      data: walletInfo
    });
  } catch (error) {
    logger.error('Error getting wallet info:', error);
    res.status(404).json({
      success: false,
      error: 'Wallet not found',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/multisig/{walletId}/initiate:
 *   post:
 *     summary: Initiate multi-signature transaction
 *     tags: [MultiSig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - initiatorId
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [transfer, admin, stake, unstake]
 *               initiatorId:
 *                 type: string
 *               amount:
 *                 type: number
 *               recipient:
 *                 type: string
 *               adminAction:
 *                 type: object
 */
router.post('/multisig/:walletId/initiate', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    const transactionData = {
      walletId,
      ...req.body
    };
    
    const result = await multiSigWallet.initiateTransaction(transactionData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error initiating transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate transaction',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/multisig/sign/{txId}:
 *   post:
 *     summary: Sign multi-signature transaction
 *     tags: [MultiSig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signerId
 *             properties:
 *               signerId:
 *                 type: string
 *               signature:
 *                 type: string
 */
router.post('/multisig/sign/:txId', authenticateToken, async (req, res) => {
  try {
    const { txId } = req.params;
    const { signerId, signature } = req.body;
    
    if (!signerId) {
      return res.status(400).json({
        success: false,
        error: 'SignerId is required'
      });
    }
    
    const result = await multiSigWallet.signTransaction(txId, signerId, signature);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error signing transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sign transaction',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/security/multisig/{walletId}/pending:
 *   get:
 *     summary: Get pending transactions for wallet
 *     tags: [MultiSig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/multisig/:walletId/pending', authenticateToken, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const pendingTx = multiSigWallet.getPendingTransactions(walletId);
    
    res.json({
      success: true,
      data: pendingTx
    });
  } catch (error) {
    logger.error('Error getting pending transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending transactions',
      message: error.message
    });
  }
});

module.exports = router;