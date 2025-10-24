const crypto = require('crypto');
const { SecurityManagerSingleton } = require('./AdvancedSecurityManager');
const logger = require('../utils/logger');

/**
 * Multi-Signature Wallet System for NeuroGrid MainNet
 * Implements enterprise-grade multi-signature wallets with configurable thresholds
 */
class MultiSignatureWallet {
  constructor(config = {}) {
    this.config = {
      defaultThreshold: config.defaultThreshold || 2,
      maxSigners: config.maxSigners || 10,
      minSigners: config.minSigners || 2,
      signatureTimeout: config.signatureTimeout || 3600000, // 1 hour
      ...config
    };
    
    this.wallets = new Map(); // walletId -> wallet data
    this.pendingTransactions = new Map(); // txId -> transaction data
    this.signatures = new Map(); // txId -> signatures
    this.securityManager = SecurityManagerSingleton.getInstance();
  }

  /**
   * Create a new multi-signature wallet
   */
  async createMultiSigWallet(walletConfig) {
    try {
      const {
        walletId,
        signers,
        threshold,
        metadata = {},
        requireAllForAdmin = false
      } = walletConfig;

      // Validation
      if (!walletId || !signers || !Array.isArray(signers)) {
        throw new Error('Invalid wallet configuration');
      }

      if (signers.length < this.config.minSigners || signers.length > this.config.maxSigners) {
        throw new Error(`Number of signers must be between ${this.config.minSigners} and ${this.config.maxSigners}`);
      }

      if (threshold > signers.length || threshold < 1) {
        throw new Error('Invalid threshold value');
      }

      if (this.wallets.has(walletId)) {
        throw new Error('Wallet already exists');
      }

      // Generate wallet keys
      const walletKeyId = `multisig_wallet_${walletId}`;
      await this.securityManager.generateMasterKey(walletKeyId, crypto.randomBytes(32).toString('hex'));

      // Create signer key pairs
      const signerData = await Promise.all(
        signers.map(async (signer, index) => {
          const signerKeyId = `${walletId}_signer_${index}`;
          const keyPair = await this.generateSignerKeyPair(signerKeyId);
          
          return {
            signerId: signer.id || `signer_${index}`,
            signerKeyId,
            publicKey: keyPair.publicKey,
            role: signer.role || 'signer',
            permissions: signer.permissions || ['sign_transactions'],
            metadata: signer.metadata || {}
          };
        })
      );

      // Create wallet structure
      const wallet = {
        walletId,
        walletKeyId,
        signers: signerData,
        threshold: threshold || this.config.defaultThreshold,
        requireAllForAdmin,
        balance: 0,
        nonce: 0,
        created: new Date().toISOString(),
        status: 'active',
        metadata,
        transactionHistory: [],
        adminOperations: []
      };

      this.wallets.set(walletId, wallet);

      await this.securityManager.auditLog('MULTISIG_WALLET_CREATED', {
        walletId,
        signerCount: signers.length,
        threshold,
        requireAllForAdmin
      });

      logger.info(`Multi-signature wallet created: ${walletId}`);

      return {
        success: true,
        walletId,
        signers: signerData.map(s => ({
          signerId: s.signerId,
          publicKey: s.publicKey,
          role: s.role
        })),
        threshold,
        walletAddress: this.generateWalletAddress(walletId)
      };

    } catch (error) {
      logger.error(`Failed to create multi-signature wallet ${walletConfig.walletId}:`, error);
      throw error;
    }
  }

  /**
   * Initiate a multi-signature transaction
   */
  async initiateTransaction(transactionData) {
    try {
      const {
        walletId,
        initiatorId,
        type, // 'transfer', 'admin', 'stake', 'unstake'
        amount,
        recipient,
        metadata = {},
        adminAction = null
      } = transactionData;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.status !== 'active') {
        throw new Error('Wallet is not active');
      }

      // Verify initiator is a valid signer
      const initiator = wallet.signers.find(s => s.signerId === initiatorId);
      if (!initiator) {
        throw new Error('Initiator is not a valid signer');
      }

      // Validate transaction
      if (type === 'transfer' && (!amount || amount <= 0)) {
        throw new Error('Invalid transfer amount');
      }

      if (type === 'transfer' && wallet.balance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      // Generate transaction ID
      const txId = this.generateTransactionId();
      
      // Determine required threshold
      let requiredSignatures;
      if (type === 'admin' && wallet.requireAllForAdmin) {
        requiredSignatures = wallet.signers.length;
      } else {
        requiredSignatures = wallet.threshold;
      }

      // Create pending transaction
      const pendingTx = {
        txId,
        walletId,
        initiatorId,
        type,
        amount: amount || 0,
        recipient,
        adminAction,
        metadata,
        requiredSignatures,
        currentSignatures: 0,
        signers: [],
        created: new Date().toISOString(),
        expires: new Date(Date.now() + this.config.signatureTimeout).toISOString(),
        status: 'pending',
        nonce: wallet.nonce + 1
      };

      this.pendingTransactions.set(txId, pendingTx);
      this.signatures.set(txId, new Map());

      await this.securityManager.auditLog('MULTISIG_TX_INITIATED', {
        txId,
        walletId,
        initiatorId,
        type,
        amount,
        requiredSignatures
      });

      logger.info(`Multi-signature transaction initiated: ${txId}`);

      return {
        success: true,
        txId,
        requiredSignatures,
        expires: pendingTx.expires,
        signingUrl: this.generateSigningUrl(txId)
      };

    } catch (error) {
      logger.error('Failed to initiate multi-signature transaction:', error);
      throw error;
    }
  }

  /**
   * Sign a pending transaction
   */
  async signTransaction(txId, signerId, signature = null) {
    try {
      const pendingTx = this.pendingTransactions.get(txId);
      if (!pendingTx) {
        throw new Error('Transaction not found');
      }

      if (pendingTx.status !== 'pending') {
        throw new Error('Transaction is not pending');
      }

      if (new Date() > new Date(pendingTx.expires)) {
        throw new Error('Transaction has expired');
      }

      const wallet = this.wallets.get(pendingTx.walletId);
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      // Verify signer
      const signer = wallet.signers.find(s => s.signerId === signerId);
      if (!signer) {
        throw new Error('Invalid signer');
      }

      // Check if already signed
      const txSignatures = this.signatures.get(txId);
      if (txSignatures.has(signerId)) {
        throw new Error('Already signed by this signer');
      }

      // Generate or verify signature
      const txData = this.serializeTransactionForSigning(pendingTx);
      let finalSignature;

      if (signature) {
        // Verify provided signature
        const isValid = await this.verifySignature(signer.signerKeyId, txData, signature);
        if (!isValid) {
          throw new Error('Invalid signature');
        }
        finalSignature = signature;
      } else {
        // Generate signature
        const sigResult = await this.securityManager.generateSignature(signer.signerKeyId, txData);
        finalSignature = sigResult.signature;
      }

      // Record signature
      txSignatures.set(signerId, {
        signature: finalSignature,
        signerId,
        timestamp: new Date().toISOString(),
        signerKeyId: signer.signerKeyId
      });

      // Update pending transaction
      pendingTx.currentSignatures = txSignatures.size;
      pendingTx.signers.push(signerId);

      await this.securityManager.auditLog('MULTISIG_TX_SIGNED', {
        txId,
        signerId,
        currentSignatures: pendingTx.currentSignatures,
        requiredSignatures: pendingTx.requiredSignatures
      });

      // Check if we have enough signatures
      if (pendingTx.currentSignatures >= pendingTx.requiredSignatures) {
        await this.executeTransaction(txId);
      }

      logger.info(`Transaction signed: ${txId} by ${signerId} (${pendingTx.currentSignatures}/${pendingTx.requiredSignatures})`);

      return {
        success: true,
        txId,
        currentSignatures: pendingTx.currentSignatures,
        requiredSignatures: pendingTx.requiredSignatures,
        executed: pendingTx.currentSignatures >= pendingTx.requiredSignatures
      };

    } catch (error) {
      await this.securityManager.auditLog('MULTISIG_TX_SIGN_FAILED', {
        txId,
        signerId,
        error: error.message
      });
      logger.error(`Failed to sign transaction ${txId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a fully signed transaction
   */
  async executeTransaction(txId) {
    try {
      const pendingTx = this.pendingTransactions.get(txId);
      if (!pendingTx) {
        throw new Error('Transaction not found');
      }

      if (pendingTx.currentSignatures < pendingTx.requiredSignatures) {
        throw new Error('Insufficient signatures');
      }

      const wallet = this.wallets.get(pendingTx.walletId);
      if (!wallet) {
        throw new Error('Associated wallet not found');
      }

      // Execute based on transaction type
      let executionResult;
      
      switch (pendingTx.type) {
        case 'transfer':
          executionResult = await this.executeTransfer(wallet, pendingTx);
          break;
        case 'admin':
          executionResult = await this.executeAdminAction(wallet, pendingTx);
          break;
        case 'stake':
          executionResult = await this.executeStaking(wallet, pendingTx);
          break;
        case 'unstake':
          executionResult = await this.executeUnstaking(wallet, pendingTx);
          break;
        default:
          throw new Error(`Unknown transaction type: ${pendingTx.type}`);
      }

      // Update wallet nonce
      wallet.nonce = pendingTx.nonce;

      // Record transaction in wallet history
      const txRecord = {
        txId,
        type: pendingTx.type,
        amount: pendingTx.amount,
        recipient: pendingTx.recipient,
        signers: pendingTx.signers,
        executed: new Date().toISOString(),
        result: executionResult
      };

      wallet.transactionHistory.push(txRecord);

      // Update transaction status
      pendingTx.status = 'executed';
      pendingTx.executedAt = new Date().toISOString();
      pendingTx.result = executionResult;

      await this.securityManager.auditLog('MULTISIG_TX_EXECUTED', {
        txId,
        walletId: wallet.walletId,
        type: pendingTx.type,
        amount: pendingTx.amount,
        result: executionResult
      });

      logger.info(`Multi-signature transaction executed: ${txId}`);

      return {
        success: true,
        txId,
        executionResult,
        newWalletBalance: wallet.balance
      };

    } catch (error) {
      // Mark transaction as failed
      if (this.pendingTransactions.has(txId)) {
        this.pendingTransactions.get(txId).status = 'failed';
        this.pendingTransactions.get(txId).error = error.message;
      }

      await this.securityManager.auditLog('MULTISIG_TX_EXECUTION_FAILED', {
        txId,
        error: error.message
      });

      logger.error(`Failed to execute multi-signature transaction ${txId}:`, error);
      throw error;
    }
  }

  /**
   * Get wallet information
   */
  getWalletInfo(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return {
      walletId: wallet.walletId,
      signers: wallet.signers.map(s => ({
        signerId: s.signerId,
        role: s.role,
        permissions: s.permissions
      })),
      threshold: wallet.threshold,
      balance: wallet.balance,
      nonce: wallet.nonce,
      status: wallet.status,
      created: wallet.created,
      walletAddress: this.generateWalletAddress(walletId),
      recentTransactions: wallet.transactionHistory.slice(-10)
    };
  }

  /**
   * Get pending transactions for a wallet
   */
  getPendingTransactions(walletId) {
    const pending = [];
    
    for (const [txId, tx] of this.pendingTransactions) {
      if (tx.walletId === walletId && tx.status === 'pending') {
        // Check if expired
        if (new Date() > new Date(tx.expires)) {
          tx.status = 'expired';
          continue;
        }
        
        pending.push({
          txId,
          type: tx.type,
          amount: tx.amount,
          recipient: tx.recipient,
          initiator: tx.initiatorId,
          currentSignatures: tx.currentSignatures,
          requiredSignatures: tx.requiredSignatures,
          signers: tx.signers,
          created: tx.created,
          expires: tx.expires
        });
      }
    }

    return pending;
  }

  // Helper methods
  async generateSignerKeyPair(signerKeyId) {
    await this.securityManager.generateMasterKey(signerKeyId, crypto.randomBytes(32).toString('hex'));
    
    // Generate public key representation
    const publicKey = crypto.createHash('sha256')
      .update(signerKeyId)
      .digest('hex');

    return {
      signerKeyId,
      publicKey
    };
  }

  generateTransactionId() {
    return `multisig_tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateWalletAddress(walletId) {
    const hash = crypto.createHash('sha256')
      .update(`neurogrid_multisig_${walletId}`)
      .digest('hex');
    return `0xMS${hash.substring(0, 38)}`;
  }

  generateSigningUrl(txId) {
    return `/api/multisig/sign/${txId}`;
  }

  serializeTransactionForSigning(tx) {
    const signingData = {
      txId: tx.txId,
      walletId: tx.walletId,
      type: tx.type,
      amount: tx.amount,
      recipient: tx.recipient,
      nonce: tx.nonce,
      expires: tx.expires
    };

    return Buffer.from(JSON.stringify(signingData, Object.keys(signingData).sort()));
  }

  async verifySignature(signerKeyId, data, signature) {
    const result = await this.securityManager.verifySignature(signerKeyId, data, signature);
    return result.isValid;
  }

  async executeTransfer(wallet, tx) {
    // Simulate token transfer
    if (wallet.balance < tx.amount) {
      throw new Error('Insufficient balance');
    }

    wallet.balance -= tx.amount;

    return {
      type: 'transfer',
      amount: tx.amount,
      recipient: tx.recipient,
      newBalance: wallet.balance,
      transferId: `transfer_${Date.now()}`
    };
  }

  async executeAdminAction(wallet, tx) {
    // Execute administrative actions
    const action = tx.adminAction;
    
    switch (action.type) {
      case 'add_signer':
        return await this.addSigner(wallet, action.data);
      case 'remove_signer':
        return await this.removeSigner(wallet, action.data);
      case 'change_threshold':
        return await this.changeThreshold(wallet, action.data);
      default:
        throw new Error(`Unknown admin action: ${action.type}`);
    }
  }

  async executeStaking(wallet, tx) {
    // Implement staking logic
    return {
      type: 'stake',
      amount: tx.amount,
      stakingPeriod: tx.metadata.stakingPeriod || 30,
      stakeId: `stake_${Date.now()}`
    };
  }

  async executeUnstaking(wallet, tx) {
    // Implement unstaking logic
    return {
      type: 'unstake',
      amount: tx.amount,
      unstakeId: `unstake_${Date.now()}`
    };
  }

  async addSigner(wallet, signerData) {
    if (wallet.signers.length >= this.config.maxSigners) {
      throw new Error('Maximum number of signers reached');
    }

    const newSignerKeyId = `${wallet.walletId}_signer_${wallet.signers.length}`;
    const keyPair = await this.generateSignerKeyPair(newSignerKeyId);

    const newSigner = {
      signerId: signerData.signerId,
      signerKeyId: newSignerKeyId,
      publicKey: keyPair.publicKey,
      role: signerData.role || 'signer',
      permissions: signerData.permissions || ['sign_transactions'],
      metadata: signerData.metadata || {},
      addedAt: new Date().toISOString()
    };

    wallet.signers.push(newSigner);

    return {
      action: 'add_signer',
      newSigner: {
        signerId: newSigner.signerId,
        publicKey: newSigner.publicKey,
        role: newSigner.role
      },
      totalSigners: wallet.signers.length
    };
  }

  async removeSigner(wallet, signerData) {
    const signerIndex = wallet.signers.findIndex(s => s.signerId === signerData.signerId);
    
    if (signerIndex === -1) {
      throw new Error('Signer not found');
    }

    if (wallet.signers.length <= this.config.minSigners) {
      throw new Error('Cannot remove signer: minimum signers required');
    }

    if (wallet.signers.length - 1 < wallet.threshold) {
      throw new Error('Cannot remove signer: would fall below threshold');
    }

    const removedSigner = wallet.signers.splice(signerIndex, 1)[0];

    return {
      action: 'remove_signer',
      removedSigner: removedSigner.signerId,
      totalSigners: wallet.signers.length
    };
  }

  async changeThreshold(wallet, thresholdData) {
    const newThreshold = thresholdData.threshold;

    if (newThreshold < 1 || newThreshold > wallet.signers.length) {
      throw new Error('Invalid threshold value');
    }

    const oldThreshold = wallet.threshold;
    wallet.threshold = newThreshold;

    return {
      action: 'change_threshold',
      oldThreshold,
      newThreshold,
      signerCount: wallet.signers.length
    };
  }
}

module.exports = MultiSignatureWallet;