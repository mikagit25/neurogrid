/**
 * Multi-Signature Wallet Service
 * Enterprise-grade multi-sig wallet functionality for NeuroGrid
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class MultiSigWalletService {
  constructor(config = {}) {
    this.config = {
      minSignatures: config.minSignatures || 2,
      maxSigners: config.maxSigners || 10,
      defaultThreshold: config.defaultThreshold || 0.6, // 60% approval required
      enableTimelock: config.enableTimelock !== false,
      defaultTimelock: config.defaultTimelock || 24 * 60 * 60 * 1000, // 24 hours
      enableSpendingLimits: config.enableSpendingLimits !== false,
      enableRoleBasedAccess: config.enableRoleBasedAccess !== false,
      ...config
    };

    this.wallets = new Map(); // In production, use database
    this.pendingTransactions = new Map();
    this.signerProfiles = new Map();

    this.roles = {
      OWNER: 'owner',
      ADMIN: 'admin', 
      OPERATOR: 'operator',
      VIEWER: 'viewer'
    };

    this.permissions = {
      CREATE_TRANSACTION: 'create_transaction',
      SIGN_TRANSACTION: 'sign_transaction',
      CANCEL_TRANSACTION: 'cancel_transaction',
      MANAGE_SIGNERS: 'manage_signers',
      VIEW_WALLET: 'view_wallet',
      EMERGENCY_STOP: 'emergency_stop'
    };

    this.init();
  }

  init() {
    this.setupRolePermissions();
    this.setupTransactionMonitoring();
    
    logger.info('Multi-Signature Wallet Service initialized', {
      minSignatures: this.config.minSignatures,
      maxSigners: this.config.maxSigners,
      enableTimelock: this.config.enableTimelock
    });
  }

  /**
   * Create new multi-sig wallet
   */
  async createMultiSigWallet(creatorAddress, walletConfig) {
    try {
      const {
        name,
        description,
        signers,
        threshold,
        spendingLimits,
        timelock,
        roleBasedAccess
      } = walletConfig;

      // Validate configuration
      this.validateWalletConfig(walletConfig);

      const walletId = this.generateWalletId();
      const walletAddress = await this.deployMultiSigContract(walletConfig);

      const wallet = {
        id: walletId,
        address: walletAddress,
        name: name || `MultiSig Wallet ${walletId.substring(0, 8)}`,
        description: description || '',
        creator: creatorAddress,
        createdAt: Date.now(),
        
        // Signer configuration
        signers: new Map(signers.map(signer => [signer.address, {
          address: signer.address,
          role: signer.role || this.roles.OPERATOR,
          addedAt: Date.now(),
          addedBy: creatorAddress,
          permissions: this.getRolePermissions(signer.role || this.roles.OPERATOR)
        }])),
        
        // Security configuration
        threshold: threshold || Math.ceil(signers.length * this.config.defaultThreshold),
        
        // Feature flags
        features: {
          timelock: timelock !== false ? (timelock || this.config.defaultTimelock) : false,
          spendingLimits: spendingLimits !== false,
          roleBasedAccess: roleBasedAccess !== false,
          emergencyStop: true
        },
        
        // Spending limits
        spendingLimits: spendingLimits || {
          daily: { amount: 10, currency: 'ETH' },
          monthly: { amount: 100, currency: 'ETH' }
        },
        
        // State
        status: 'active',
        balance: { ETH: 0, tokens: {} },
        transactionCount: 0,
        lastActivity: Date.now()
      };

      // Add creator as owner
      wallet.signers.set(creatorAddress, {
        address: creatorAddress,
        role: this.roles.OWNER,
        addedAt: Date.now(),
        addedBy: creatorAddress,
        permissions: this.getRolePermissions(this.roles.OWNER)
      });

      this.wallets.set(walletId, wallet);

      logger.info('Multi-sig wallet created', {
        walletId,
        creator: creatorAddress,
        signerCount: wallet.signers.size,
        threshold: wallet.threshold
      });

      return {
        success: true,
        walletId,
        walletAddress,
        wallet: this.sanitizeWalletForResponse(wallet)
      };

    } catch (error) {
      logger.error('Failed to create multi-sig wallet', { error: error.message });
      throw error;
    }
  }

  /**
   * Create transaction proposal
   */
  async createTransactionProposal(walletId, proposerAddress, transactionData) {
    try {
      const wallet = this.getWallet(walletId);
      
      // Verify permissions
      this.verifyPermission(wallet, proposerAddress, this.permissions.CREATE_TRANSACTION);

      // Validate transaction
      await this.validateTransaction(wallet, transactionData);

      const proposalId = this.generateProposalId();
      const proposal = {
        id: proposalId,
        walletId,
        proposer: proposerAddress,
        createdAt: Date.now(),
        
        // Transaction data
        transaction: {
          to: transactionData.to,
          value: transactionData.value,
          data: transactionData.data || '0x',
          gasLimit: transactionData.gasLimit || 21000,
          description: transactionData.description || ''
        },
        
        // Approval tracking
        signatures: new Map(),
        status: 'pending',
        requiredSignatures: wallet.threshold,
        
        // Timelock
        timelockEnd: wallet.features.timelock ? 
          Date.now() + wallet.features.timelock : 
          Date.now(),
        
        // Execution
        executedAt: null,
        executionTxHash: null,
        cancelledAt: null,
        cancelledBy: null
      };

      // Auto-approve by proposer if they're a signer
      if (wallet.signers.has(proposerAddress)) {
        proposal.signatures.set(proposerAddress, {
          address: proposerAddress,
          signature: await this.generateSignature(proposalId, proposerAddress),
          signedAt: Date.now()
        });
      }

      this.pendingTransactions.set(proposalId, proposal);

      // Check if ready for execution
      if (proposal.signatures.size >= wallet.threshold) {
        await this.scheduleExecution(proposalId);
      }

      logger.info('Transaction proposal created', {
        proposalId,
        walletId,
        proposer: proposerAddress,
        to: transactionData.to,
        value: transactionData.value
      });

      return {
        success: true,
        proposalId,
        proposal: this.sanitizeProposalForResponse(proposal)
      };

    } catch (error) {
      logger.error('Failed to create transaction proposal', { error: error.message });
      throw error;
    }
  }

  /**
   * Sign transaction proposal
   */
  async signTransactionProposal(proposalId, signerAddress, signature) {
    try {
      const proposal = this.getProposal(proposalId);
      const wallet = this.getWallet(proposal.walletId);

      // Verify signer
      if (!wallet.signers.has(signerAddress)) {
        throw new Error('Address is not a signer for this wallet');
      }

      // Verify permissions
      this.verifyPermission(wallet, signerAddress, this.permissions.SIGN_TRANSACTION);

      // Check if already signed
      if (proposal.signatures.has(signerAddress)) {
        throw new Error('Address has already signed this proposal');
      }

      // Verify signature
      const isValidSignature = await this.verifySignature(proposalId, signerAddress, signature);
      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Add signature
      proposal.signatures.set(signerAddress, {
        address: signerAddress,
        signature,
        signedAt: Date.now()
      });

      logger.info('Transaction proposal signed', {
        proposalId,
        signer: signerAddress,
        signatureCount: proposal.signatures.size,
        required: proposal.requiredSignatures
      });

      // Check if ready for execution
      if (proposal.signatures.size >= proposal.requiredSignatures) {
        if (proposal.timelockEnd <= Date.now()) {
          await this.executeTransaction(proposalId);
        } else {
          await this.scheduleExecution(proposalId);
        }
      }

      return {
        success: true,
        proposalId,
        signatureCount: proposal.signatures.size,
        requiredSignatures: proposal.requiredSignatures,
        readyForExecution: proposal.signatures.size >= proposal.requiredSignatures,
        timelockEnd: proposal.timelockEnd
      };

    } catch (error) {
      logger.error('Failed to sign transaction proposal', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute approved transaction
   */
  async executeTransaction(proposalId) {
    try {
      const proposal = this.getProposal(proposalId);
      const wallet = this.getWallet(proposal.walletId);

      // Verify execution conditions
      if (proposal.status !== 'pending') {
        throw new Error('Transaction is not in pending status');
      }

      if (proposal.signatures.size < proposal.requiredSignatures) {
        throw new Error('Insufficient signatures');
      }

      if (proposal.timelockEnd > Date.now()) {
        throw new Error('Timelock period not yet expired');
      }

      // Execute transaction on blockchain
      const executionResult = await this.executeOnBlockchain(wallet, proposal.transaction);

      // Update proposal status
      proposal.status = 'executed';
      proposal.executedAt = Date.now();
      proposal.executionTxHash = executionResult.transactionHash;

      // Update wallet state
      wallet.transactionCount += 1;
      wallet.lastActivity = Date.now();

      logger.info('Multi-sig transaction executed', {
        proposalId,
        walletId: proposal.walletId,
        txHash: executionResult.transactionHash,
        signatureCount: proposal.signatures.size
      });

      return {
        success: true,
        proposalId,
        transactionHash: executionResult.transactionHash,
        executedAt: proposal.executedAt
      };

    } catch (error) {
      logger.error('Failed to execute transaction', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel transaction proposal
   */
  async cancelTransactionProposal(proposalId, cancellerAddress) {
    try {
      const proposal = this.getProposal(proposalId);
      const wallet = this.getWallet(proposal.walletId);

      // Verify permissions
      this.verifyPermission(wallet, cancellerAddress, this.permissions.CANCEL_TRANSACTION);

      if (proposal.status !== 'pending') {
        throw new Error('Transaction is not in pending status');
      }

      proposal.status = 'cancelled';
      proposal.cancelledAt = Date.now();
      proposal.cancelledBy = cancellerAddress;

      logger.info('Transaction proposal cancelled', {
        proposalId,
        cancelledBy: cancellerAddress
      });

      return {
        success: true,
        proposalId,
        cancelledAt: proposal.cancelledAt
      };

    } catch (error) {
      logger.error('Failed to cancel transaction proposal', { error: error.message });
      throw error;
    }
  }

  /**
   * Add new signer to wallet
   */
  async addSigner(walletId, requestorAddress, newSignerAddress, role = this.roles.OPERATOR) {
    try {
      const wallet = this.getWallet(walletId);

      // Verify permissions
      this.verifyPermission(wallet, requestorAddress, this.permissions.MANAGE_SIGNERS);

      if (wallet.signers.has(newSignerAddress)) {
        throw new Error('Address is already a signer');
      }

      if (wallet.signers.size >= this.config.maxSigners) {
        throw new Error('Maximum number of signers reached');
      }

      // Add signer
      wallet.signers.set(newSignerAddress, {
        address: newSignerAddress,
        role: role,
        addedAt: Date.now(),
        addedBy: requestorAddress,
        permissions: this.getRolePermissions(role)
      });

      logger.info('Signer added to multi-sig wallet', {
        walletId,
        newSigner: newSignerAddress,
        addedBy: requestorAddress,
        role,
        totalSigners: wallet.signers.size
      });

      return {
        success: true,
        walletId,
        newSigner: newSignerAddress,
        totalSigners: wallet.signers.size
      };

    } catch (error) {
      logger.error('Failed to add signer', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove signer from wallet
   */
  async removeSigner(walletId, requestorAddress, signerToRemove) {
    try {
      const wallet = this.getWallet(walletId);

      // Verify permissions
      this.verifyPermission(wallet, requestorAddress, this.permissions.MANAGE_SIGNERS);

      if (!wallet.signers.has(signerToRemove)) {
        throw new Error('Address is not a signer');
      }

      // Prevent removing the last owner
      const owners = Array.from(wallet.signers.values()).filter(s => s.role === this.roles.OWNER);
      if (owners.length <= 1 && wallet.signers.get(signerToRemove).role === this.roles.OWNER) {
        throw new Error('Cannot remove the last owner');
      }

      // Check if removal would break threshold requirements
      if (wallet.signers.size - 1 < wallet.threshold) {
        throw new Error('Removing signer would make wallet threshold impossible to reach');
      }

      wallet.signers.delete(signerToRemove);

      logger.info('Signer removed from multi-sig wallet', {
        walletId,
        removedSigner: signerToRemove,
        removedBy: requestorAddress,
        remainingSigners: wallet.signers.size
      });

      return {
        success: true,
        walletId,
        removedSigner: signerToRemove,
        remainingSigners: wallet.signers.size
      };

    } catch (error) {
      logger.error('Failed to remove signer', { error: error.message });
      throw error;
    }
  }

  /**
   * Get wallet details
   */
  getWalletDetails(walletId, requestorAddress) {
    try {
      const wallet = this.getWallet(walletId);

      // Verify view permissions
      this.verifyPermission(wallet, requestorAddress, this.permissions.VIEW_WALLET);

      return {
        success: true,
        wallet: this.sanitizeWalletForResponse(wallet)
      };

    } catch (error) {
      logger.error('Failed to get wallet details', { error: error.message });
      throw error;
    }
  }

  /**
   * Get pending transactions for wallet
   */
  getPendingTransactions(walletId, requestorAddress) {
    try {
      const wallet = this.getWallet(walletId);

      // Verify permissions
      this.verifyPermission(wallet, requestorAddress, this.permissions.VIEW_WALLET);

      const pendingTxs = Array.from(this.pendingTransactions.values())
        .filter(tx => tx.walletId === walletId && tx.status === 'pending')
        .map(tx => this.sanitizeProposalForResponse(tx));

      return {
        success: true,
        pendingTransactions: pendingTxs
      };

    } catch (error) {
      logger.error('Failed to get pending transactions', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper methods
   */

  setupRolePermissions() {
    this.rolePermissions = {
      [this.roles.OWNER]: [
        this.permissions.CREATE_TRANSACTION,
        this.permissions.SIGN_TRANSACTION,
        this.permissions.CANCEL_TRANSACTION,
        this.permissions.MANAGE_SIGNERS,
        this.permissions.VIEW_WALLET,
        this.permissions.EMERGENCY_STOP
      ],
      [this.roles.ADMIN]: [
        this.permissions.CREATE_TRANSACTION,
        this.permissions.SIGN_TRANSACTION,
        this.permissions.CANCEL_TRANSACTION,
        this.permissions.VIEW_WALLET
      ],
      [this.roles.OPERATOR]: [
        this.permissions.CREATE_TRANSACTION,
        this.permissions.SIGN_TRANSACTION,
        this.permissions.VIEW_WALLET
      ],
      [this.roles.VIEWER]: [
        this.permissions.VIEW_WALLET
      ]
    };
  }

  setupTransactionMonitoring() {
    // Monitor for timelock expiration
    setInterval(() => {
      this.checkTimelockExpirations();
    }, 60000); // Check every minute
  }

  async checkTimelockExpirations() {
    const now = Date.now();
    
    for (const [proposalId, proposal] of this.pendingTransactions) {
      if (proposal.status === 'pending' && 
          proposal.signatures.size >= proposal.requiredSignatures &&
          proposal.timelockEnd <= now) {
        try {
          await this.executeTransaction(proposalId);
        } catch (error) {
          logger.error('Failed to auto-execute transaction', { 
            error: error.message, 
            proposalId 
          });
        }
      }
    }
  }

  validateWalletConfig(config) {
    if (!config.signers || config.signers.length < this.config.minSignatures) {
      throw new Error(`Minimum ${this.config.minSignatures} signers required`);
    }

    if (config.signers.length > this.config.maxSigners) {
      throw new Error(`Maximum ${this.config.maxSigners} signers allowed`);
    }

    if (config.threshold && (config.threshold < 1 || config.threshold > config.signers.length)) {
      throw new Error('Invalid threshold value');
    }
  }

  getWallet(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    return wallet;
  }

  getProposal(proposalId) {
    const proposal = this.pendingTransactions.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    return proposal;
  }

  verifyPermission(wallet, userAddress, permission) {
    const signer = wallet.signers.get(userAddress);
    if (!signer) {
      throw new Error('Access denied: Not a signer of this wallet');
    }

    if (!signer.permissions.includes(permission)) {
      throw new Error(`Access denied: Missing permission ${permission}`);
    }
  }

  getRolePermissions(role) {
    return this.rolePermissions[role] || [];
  }

  generateWalletId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateProposalId() {
    return crypto.randomBytes(16).toString('hex');
  }

  sanitizeWalletForResponse(wallet) {
    return {
      id: wallet.id,
      address: wallet.address,
      name: wallet.name,
      description: wallet.description,
      createdAt: wallet.createdAt,
      signers: Array.from(wallet.signers.values()).map(s => ({
        address: s.address,
        role: s.role,
        addedAt: s.addedAt
      })),
      threshold: wallet.threshold,
      features: wallet.features,
      status: wallet.status,
      transactionCount: wallet.transactionCount,
      lastActivity: wallet.lastActivity
    };
  }

  sanitizeProposalForResponse(proposal) {
    return {
      id: proposal.id,
      walletId: proposal.walletId,
      proposer: proposal.proposer,
      createdAt: proposal.createdAt,
      transaction: proposal.transaction,
      signatureCount: proposal.signatures.size,
      requiredSignatures: proposal.requiredSignatures,
      status: proposal.status,
      timelockEnd: proposal.timelockEnd,
      signatures: Array.from(proposal.signatures.keys()) // Only addresses, not signatures
    };
  }

  // Mock implementations for blockchain operations
  async deployMultiSigContract(config) {
    return '0x' + crypto.randomBytes(20).toString('hex');
  }

  async validateTransaction(wallet, transactionData) {
    // Validate transaction format, spending limits, etc.
    return true;
  }

  async generateSignature(proposalId, signerAddress) {
    return crypto.randomBytes(65).toString('hex');
  }

  async verifySignature(proposalId, signerAddress, signature) {
    return true; // Mock verification
  }

  async executeOnBlockchain(wallet, transaction) {
    return {
      transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
      blockNumber: Math.floor(Math.random() * 1000000) + 15000000
    };
  }

  async scheduleExecution(proposalId) {
    // Schedule for automatic execution when timelock expires
    logger.info('Transaction scheduled for execution', { proposalId });
  }

  /**
   * Get analytics
   */
  getAnalytics() {
    const totalWallets = this.wallets.size;
    const totalPendingTx = Array.from(this.pendingTransactions.values())
      .filter(tx => tx.status === 'pending').length;
    
    return {
      totalWallets,
      totalPendingTransactions: totalPendingTx,
      averageSigners: Array.from(this.wallets.values())
        .reduce((sum, wallet) => sum + wallet.signers.size, 0) / totalWallets || 0,
      features: {
        timelock: this.config.enableTimelock,
        spendingLimits: this.config.enableSpendingLimits,
        roleBasedAccess: this.config.enableRoleBasedAccess
      }
    };
  }
}

module.exports = MultiSigWalletService;