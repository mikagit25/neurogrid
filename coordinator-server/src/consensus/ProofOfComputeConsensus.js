const crypto = require('crypto');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * Proof-of-Compute Consensus Engine for NeuroGrid MainNet
 * Implements Byzantine fault tolerant consensus based on computational work verification
 */
class ProofOfComputeConsensus extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      blockTime: config.blockTime || 30000, // 30 seconds
      validatorCount: config.validatorCount || 21,
      minStake: config.minStake || 10000, // Minimum stake to become validator
      slashingPenalty: config.slashingPenalty || 0.1, // 10% slash for misbehavior
      epochLength: config.epochLength || 100, // Blocks per epoch
      challengeProbability: config.challengeProbability || 0.1, // 10% chance of challenge
      rewardRate: config.rewardRate || 0.05, // 5% annual reward
      byzantineThreshold: config.byzantineThreshold || 0.33, // Max 33% byzantine nodes
      ...config
    };
    
    // Consensus state
    this.validators = new Map(); // validatorId -> validator data
    this.blocks = new Map(); // blockHeight -> block data
    this.pendingTransactions = new Map(); // txId -> transaction
    this.challenges = new Map(); // challengeId -> challenge data
    this.votingRounds = new Map(); // roundId -> voting data
    
    // Current state
    this.currentHeight = 0;
    this.currentEpoch = 0;
    this.isValidating = false;
    this.currentValidator = null;
    this.lastBlockTime = Date.now();
    
    // Performance tracking
    this.computeScores = new Map(); // validatorId -> score history
    this.slashingEvents = [];
    this.consensusMetrics = {
      blocksProduced: 0,
      challengesIssued: 0,
      challengesResolved: 0,
      slashingEvents: 0,
      validatorRotations: 0
    };
    
    logger.info('Proof-of-Compute Consensus Engine initialized');
  }

  /**
   * Register a new validator
   */
  async registerValidator(validatorData) {
    try {
      const {
        validatorId,
        publicKey,
        stakeAmount,
        computeCapacity,
        nodeEndpoint,
        metadata = {}
      } = validatorData;

      // Validation checks
      if (!validatorId || !publicKey || !stakeAmount) {
        throw new Error('Missing required validator data');
      }

      if (stakeAmount < this.config.minStake) {
        throw new Error(`Minimum stake of ${this.config.minStake} required`);
      }

      if (this.validators.has(validatorId)) {
        throw new Error('Validator already registered');
      }

      if (this.validators.size >= this.config.validatorCount) {
        throw new Error('Maximum validator count reached');
      }

      // Create validator record
      const validator = {
        validatorId,
        publicKey,
        stakeAmount,
        computeCapacity: computeCapacity || {},
        nodeEndpoint,
        metadata,
        joinedEpoch: this.currentEpoch,
        active: true,
        reputation: 1.0,
        blocksProduced: 0,
        challengesCompleted: 0,
        slashingHistory: [],
        lastActivity: new Date(),
        performanceScore: 100,
        computeVerifications: []
      };

      this.validators.set(validatorId, validator);
      this.computeScores.set(validatorId, []);

      this.emit('validatorRegistered', {
        validatorId,
        stakeAmount,
        totalValidators: this.validators.size
      });

      logger.info(`Validator registered: ${validatorId} with stake ${stakeAmount}`);

      return {
        success: true,
        validatorId,
        validatorIndex: this.validators.size - 1,
        nextEpochStart: this.getNextEpochTime()
      };

    } catch (error) {
      logger.error(`Failed to register validator ${validatorData.validatorId}:`, error);
      throw error;
    }
  }

  /**
   * Submit computational work for validation
   */
  async submitComputeWork(workData) {
    try {
      const {
        validatorId,
        taskId,
        inputHash,
        outputHash,
        computeProof,
        executionTime,
        resourceUsage,
        timestamp = Date.now()
      } = workData;

      const validator = this.validators.get(validatorId);
      if (!validator || !validator.active) {
        throw new Error('Invalid or inactive validator');
      }

      // Create work submission
      const workId = this.generateWorkId();
      const work = {
        workId,
        validatorId,
        taskId,
        inputHash,
        outputHash,
        computeProof,
        executionTime,
        resourceUsage,
        timestamp,
        verified: false,
        challengeIssued: false,
        verificationScore: 0
      };

      // Verify computational proof
      const isValid = await this.verifyComputeProof(work);
      if (!isValid) {
        throw new Error('Invalid computational proof');
      }

      work.verified = true;
      work.verificationScore = this.calculateVerificationScore(work);

      // Maybe issue a challenge
      if (Math.random() < this.config.challengeProbability) {
        await this.issueComputeChallenge(work);
      }

      // Update validator performance
      await this.updateValidatorPerformance(validatorId, work);

      // Add to pending transactions if validated
      this.pendingTransactions.set(workId, work);

      this.emit('computeWorkSubmitted', {
        workId,
        validatorId,
        taskId,
        verificationScore: work.verificationScore
      });

      logger.info(`Compute work submitted: ${workId} by ${validatorId}`);

      return {
        success: true,
        workId,
        verificationScore: work.verificationScore,
        challengeIssued: work.challengeIssued
      };

    } catch (error) {
      logger.error('Failed to submit compute work:', error);
      throw error;
    }
  }

  /**
   * Produce a new block (called by current validator)
   */
  async produceBlock(validatorId) {
    try {
      if (!this.isCurrentValidator(validatorId)) {
        throw new Error('Not the current block producer');
      }

      const validator = this.validators.get(validatorId);
      if (!validator || !validator.active) {
        throw new Error('Invalid validator');
      }

      // Collect pending transactions
      const transactions = Array.from(this.pendingTransactions.values());
      const selectedTransactions = this.selectTransactionsForBlock(transactions);

      // Create block
      const block = {
        height: this.currentHeight + 1,
        timestamp: Date.now(),
        producer: validatorId,
        previousHash: this.getPreviousBlockHash(),
        transactionRoot: this.calculateMerkleRoot(selectedTransactions),
        transactions: selectedTransactions,
        validatorSignature: null,
        consensusData: {
          epoch: this.currentEpoch,
          validatorRotation: this.getValidatorRotation(),
          challengeResults: this.getRecentChallengeResults()
        }
      };

      // Sign the block
      block.hash = this.calculateBlockHash(block);
      block.validatorSignature = await this.signBlock(block, validatorId);

      // Start consensus voting
      const consensusResult = await this.startBlockConsensus(block);
      
      if (consensusResult.accepted) {
        await this.finalizeBlock(block);
        
        // Update metrics
        this.consensusMetrics.blocksProduced++;
        validator.blocksProduced++;
        
        this.emit('blockProduced', {
          height: block.height,
          producer: validatorId,
          transactionCount: selectedTransactions.length,
          consensusVotes: consensusResult.votes
        });

        logger.info(`Block ${block.height} produced by ${validatorId}`);
      }

      return {
        success: consensusResult.accepted,
        block: consensusResult.accepted ? block : null,
        consensusResult
      };

    } catch (error) {
      logger.error(`Failed to produce block by ${validatorId}:`, error);
      throw error;
    }
  }

  /**
   * Vote on a proposed block
   */
  async voteOnBlock(blockHash, validatorId, vote) {
    try {
      const validator = this.validators.get(validatorId);
      if (!validator || !validator.active) {
        throw new Error('Invalid validator');
      }

      const votingRound = this.votingRounds.get(blockHash);
      if (!votingRound) {
        throw new Error('No active voting round for this block');
      }

      if (votingRound.votes.has(validatorId)) {
        throw new Error('Validator already voted');
      }

      // Record vote
      const voteData = {
        validatorId,
        vote, // 'accept' or 'reject'
        timestamp: Date.now(),
        stake: validator.stakeAmount
      };

      votingRound.votes.set(validatorId, voteData);
      
      // Update vote tallies
      if (vote === 'accept') {
        votingRound.acceptVotes += validator.stakeAmount;
      } else {
        votingRound.rejectVotes += validator.stakeAmount;
      }

      votingRound.totalVotes += validator.stakeAmount;

      this.emit('blockVoteCast', {
        blockHash,
        validatorId,
        vote,
        totalVotes: votingRound.totalVotes,
        acceptVotes: votingRound.acceptVotes
      });

      // Check if consensus reached
      await this.checkConsensusReached(blockHash);

      return {
        success: true,
        voteRecorded: true,
        consensusProgress: {
          totalVotes: votingRound.totalVotes,
          acceptVotes: votingRound.acceptVotes,
          rejectVotes: votingRound.rejectVotes
        }
      };

    } catch (error) {
      logger.error('Failed to vote on block:', error);
      throw error;
    }
  }

  /**
   * Issue a computational challenge
   */
  async issueComputeChallenge(work) {
    try {
      const challengeId = this.generateChallengeId();
      
      const challenge = {
        challengeId,
        workId: work.workId,
        challengedValidator: work.validatorId,
        challengeType: 'compute_verification',
        inputData: work.inputHash,
        expectedOutput: work.outputHash,
        deadline: Date.now() + 300000, // 5 minutes
        status: 'pending',
        challengers: [],
        responses: new Map(),
        resolution: null
      };

      this.challenges.set(challengeId, challenge);
      work.challengeIssued = true;

      // Select random validators to verify
      const challengeValidators = this.selectChallengeValidators(work.validatorId);
      
      for (const validatorId of challengeValidators) {
        challenge.challengers.push(validatorId);
        
        this.emit('challengeIssued', {
          challengeId,
          challengedValidator: work.validatorId,
          challengeValidator: validatorId,
          deadline: challenge.deadline
        });
      }

      this.consensusMetrics.challengesIssued++;

      logger.info(`Compute challenge issued: ${challengeId} for work ${work.workId}`);

      return {
        success: true,
        challengeId,
        challengers: challengeValidators,
        deadline: challenge.deadline
      };

    } catch (error) {
      logger.error('Failed to issue compute challenge:', error);
      throw error;
    }
  }

  /**
   * Respond to a computational challenge
   */
  async respondToChallenge(challengeId, validatorId, response) {
    try {
      const challenge = this.challenges.get(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      if (challenge.status !== 'pending') {
        throw new Error('Challenge is not pending');
      }

      if (!challenge.challengers.includes(validatorId)) {
        throw new Error('Not authorized to respond to this challenge');
      }

      if (Date.now() > challenge.deadline) {
        throw new Error('Challenge deadline passed');
      }

      // Record response
      const challengeResponse = {
        validatorId,
        response,
        timestamp: Date.now(),
        computeProof: response.computeProof,
        outputHash: response.outputHash
      };

      challenge.responses.set(validatorId, challengeResponse);

      this.emit('challengeResponse', {
        challengeId,
        respondingValidator: validatorId,
        responsesReceived: challenge.responses.size,
        totalChallengers: challenge.challengers.length
      });

      // Check if all responses received
      if (challenge.responses.size === challenge.challengers.length) {
        await this.resolveChallenge(challengeId);
      }

      return {
        success: true,
        challengeId,
        responsesReceived: challenge.responses.size,
        totalExpected: challenge.challengers.length
      };

    } catch (error) {
      logger.error('Failed to respond to challenge:', error);
      throw error;
    }
  }

  /**
   * Resolve a computational challenge
   */
  async resolveChallenge(challengeId) {
    try {
      const challenge = this.challenges.get(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      const responses = Array.from(challenge.responses.values());
      
      // Analyze responses to determine correctness
      const outputCounts = new Map();
      responses.forEach(response => {
        const output = response.outputHash;
        outputCounts.set(output, (outputCounts.get(output) || 0) + 1);
      });

      // Majority consensus determines correct output
      let correctOutput = null;
      let maxCount = 0;
      
      for (const [output, count] of outputCounts) {
        if (count > maxCount) {
          maxCount = count;
          correctOutput = output;
        }
      }

      const consensusThreshold = Math.ceil(responses.length * (1 - this.config.byzantineThreshold));
      const challengeSuccessful = maxCount >= consensusThreshold;

      // Apply consequences
      if (challengeSuccessful) {
        const work = this.findWorkByChallenge(challengeId);
        const isOriginalCorrect = work && work.outputHash === correctOutput;

        if (!isOriginalCorrect) {
          // Original validator was wrong - apply slashing
          await this.applySlashing(challenge.challengedValidator, challengeId, 'incorrect_computation');
        }

        // Reward correct challengers
        responses.forEach(response => {
          if (response.outputHash === correctOutput) {
            this.rewardValidator(response.validatorId, 'successful_challenge');
          }
        });
      }

      challenge.status = 'resolved';
      challenge.resolution = {
        successful: challengeSuccessful,
        correctOutput,
        consensusCount: maxCount,
        resolvedAt: Date.now()
      };

      this.consensusMetrics.challengesResolved++;

      this.emit('challengeResolved', {
        challengeId,
        successful: challengeSuccessful,
        challengedValidator: challenge.challengedValidator,
        correctOutput
      });

      logger.info(`Challenge resolved: ${challengeId}, successful: ${challengeSuccessful}`);

      return {
        success: true,
        challengeSuccessful,
        correctOutput,
        consensusCount: maxCount
      };

    } catch (error) {
      logger.error('Failed to resolve challenge:', error);
      throw error;
    }
  }

  /**
   * Apply slashing penalty to a validator
   */
  async applySlashing(validatorId, reason, evidence) {
    try {
      const validator = this.validators.get(validatorId);
      if (!validator) {
        throw new Error('Validator not found');
      }

      const slashAmount = Math.floor(validator.stakeAmount * this.config.slashingPenalty);
      const slashingEvent = {
        validatorId,
        reason,
        evidence,
        slashAmount,
        originalStake: validator.stakeAmount,
        timestamp: Date.now(),
        epoch: this.currentEpoch
      };

      // Apply penalty
      validator.stakeAmount -= slashAmount;
      validator.reputation *= 0.9; // Reduce reputation
      validator.slashingHistory.push(slashingEvent);

      // Check if validator should be removed
      if (validator.stakeAmount < this.config.minStake || validator.reputation < 0.5) {
        validator.active = false;
        
        this.emit('validatorRemoved', {
          validatorId,
          reason: 'slashing_threshold_exceeded',
          finalStake: validator.stakeAmount,
          reputation: validator.reputation
        });
      }

      this.slashingEvents.push(slashingEvent);
      this.consensusMetrics.slashingEvents++;

      this.emit('validatorSlashed', {
        validatorId,
        reason,
        slashAmount,
        newStake: validator.stakeAmount,
        reputation: validator.reputation
      });

      logger.warn(`Validator slashed: ${validatorId}, amount: ${slashAmount}, reason: ${reason}`);

      return {
        success: true,
        slashAmount,
        newStake: validator.stakeAmount,
        validatorRemoved: !validator.active
      };

    } catch (error) {
      logger.error('Failed to apply slashing:', error);
      throw error;
    }
  }

  /**
   * Get consensus status
   */
  getConsensusStatus() {
    const activeValidators = Array.from(this.validators.values()).filter(v => v.active);
    const totalStake = activeValidators.reduce((sum, v) => sum + v.stakeAmount, 0);
    
    return {
      currentHeight: this.currentHeight,
      currentEpoch: this.currentEpoch,
      activeValidators: activeValidators.length,
      totalStake,
      isValidating: this.isValidating,
      currentValidator: this.currentValidator,
      lastBlockTime: this.lastBlockTime,
      pendingTransactions: this.pendingTransactions.size,
      activeChallenges: Array.from(this.challenges.values()).filter(c => c.status === 'pending').length,
      consensusMetrics: this.consensusMetrics,
      slashingEvents: this.slashingEvents.length
    };
  }

  // Helper methods
  generateWorkId() {
    return `work_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  generateChallengeId() {
    return `challenge_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async verifyComputeProof(work) {
    // Simplified verification - in production this would be more sophisticated
    const expectedHash = crypto.createHash('sha256')
      .update(work.inputHash + work.outputHash + work.executionTime)
      .digest('hex');
    
    return work.computeProof === expectedHash;
  }

  calculateVerificationScore(work) {
    // Score based on execution time, resource efficiency, etc.
    const baseScore = 100;
    const efficiencyBonus = Math.max(0, 20 - work.executionTime / 1000); // Bonus for faster execution
    return Math.min(150, baseScore + efficiencyBonus);
  }

  async updateValidatorPerformance(validatorId, work) {
    const validator = this.validators.get(validatorId);
    if (!validator) return;

    const scores = this.computeScores.get(validatorId) || [];
    scores.push({
      timestamp: Date.now(),
      score: work.verificationScore,
      taskType: work.taskId.split('_')[0] // Extract task type
    });

    // Keep only recent scores
    const recentScores = scores.slice(-100);
    this.computeScores.set(validatorId, recentScores);

    // Update validator performance score
    const avgScore = recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length;
    validator.performanceScore = Math.round(avgScore);
    validator.lastActivity = new Date();

    validator.computeVerifications.push({
      workId: work.workId,
      score: work.verificationScore,
      timestamp: Date.now()
    });
  }

  isCurrentValidator(validatorId) {
    // Simplified - in production would use proper rotation algorithm
    return this.currentValidator === validatorId;
  }

  selectTransactionsForBlock(transactions) {
    // Select up to 1000 highest scoring transactions
    return transactions
      .sort((a, b) => b.verificationScore - a.verificationScore)
      .slice(0, 1000);
  }

  getPreviousBlockHash() {
    if (this.currentHeight === 0) return '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    const previousBlock = this.blocks.get(this.currentHeight);
    return previousBlock ? previousBlock.hash : null;
  }

  calculateMerkleRoot(transactions) {
    if (transactions.length === 0) return '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    const txHashes = transactions.map(tx => crypto.createHash('sha256').update(JSON.stringify(tx)).digest('hex'));
    
    // Simplified Merkle root calculation
    let level = txHashes;
    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        const combined = crypto.createHash('sha256').update(left + right).digest('hex');
        nextLevel.push(combined);
      }
      level = nextLevel;
    }
    
    return level[0];
  }

  calculateBlockHash(block) {
    const blockString = JSON.stringify({
      height: block.height,
      timestamp: block.timestamp,
      producer: block.producer,
      previousHash: block.previousHash,
      transactionRoot: block.transactionRoot
    });
    
    return crypto.createHash('sha256').update(blockString).digest('hex');
  }

  async signBlock(block, validatorId) {
    // Simplified signature - in production would use validator's private key
    const signature = crypto.createHash('sha256')
      .update(block.hash + validatorId + Date.now())
      .digest('hex');
    
    return signature;
  }

  async startBlockConsensus(block) {
    const roundId = `round_${block.height}_${Date.now()}`;
    
    const votingRound = {
      blockHash: block.hash,
      block,
      roundId,
      startTime: Date.now(),
      votes: new Map(),
      acceptVotes: 0,
      rejectVotes: 0,
      totalVotes: 0,
      completed: false
    };

    this.votingRounds.set(block.hash, votingRound);

    // Simulate consensus - in production would wait for actual votes
    const activeValidators = Array.from(this.validators.values()).filter(v => v.active);
    const requiredVotes = Math.ceil(activeValidators.length * 0.67); // 67% threshold

    // Auto-vote for demo (in production, validators vote independently)
    setTimeout(() => {
      let acceptCount = 0;
      activeValidators.forEach(validator => {
        if (acceptCount < requiredVotes) {
          this.voteOnBlock(block.hash, validator.validatorId, 'accept');
          acceptCount++;
        }
      });
    }, 1000);

    return new Promise((resolve) => {
      const checkConsensus = () => {
        const voting = this.votingRounds.get(block.hash);
        if (voting && voting.completed) {
          resolve({
            accepted: voting.acceptVotes > voting.rejectVotes,
            votes: voting.acceptVotes,
            totalValidators: activeValidators.length
          });
        } else {
          setTimeout(checkConsensus, 100);
        }
      };
      checkConsensus();
    });
  }

  async checkConsensusReached(blockHash) {
    const votingRound = this.votingRounds.get(blockHash);
    if (!votingRound || votingRound.completed) return;

    const activeValidators = Array.from(this.validators.values()).filter(v => v.active);
    const totalStake = activeValidators.reduce((sum, v) => sum + v.stakeAmount, 0);
    const requiredStake = Math.ceil(totalStake * 0.67); // 67% of stake

    if (votingRound.acceptVotes >= requiredStake || votingRound.rejectVotes >= requiredStake) {
      votingRound.completed = true;
      votingRound.endTime = Date.now();
      
      this.emit('consensusReached', {
        blockHash,
        accepted: votingRound.acceptVotes >= requiredStake,
        acceptVotes: votingRound.acceptVotes,
        totalStake
      });
    }
  }

  async finalizeBlock(block) {
    this.blocks.set(block.height, block);
    this.currentHeight = block.height;
    this.lastBlockTime = block.timestamp;

    // Clear processed transactions
    block.transactions.forEach(tx => {
      this.pendingTransactions.delete(tx.workId);
    });

    // Update epoch if needed
    if (block.height % this.config.epochLength === 0) {
      this.currentEpoch++;
      this.consensusMetrics.validatorRotations++;
      this.emit('epochChanged', {
        newEpoch: this.currentEpoch,
        blockHeight: block.height
      });
    }
  }

  selectChallengeValidators(excludeValidator, count = 3) {
    const activeValidators = Array.from(this.validators.keys())
      .filter(id => id !== excludeValidator && this.validators.get(id).active);
    
    // Randomly select validators
    const selected = [];
    const available = [...activeValidators];
    
    for (let i = 0; i < Math.min(count, available.length); i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available.splice(randomIndex, 1)[0]);
    }
    
    return selected;
  }

  findWorkByChallenge(challengeId) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return null;
    
    return Array.from(this.pendingTransactions.values())
      .find(work => work.workId === challenge.workId);
  }

  rewardValidator(validatorId, reason) {
    const validator = this.validators.get(validatorId);
    if (!validator) return;

    // Simplified reward system
    const rewardAmount = 10; // Base reward
    validator.stakeAmount += rewardAmount;
    validator.reputation = Math.min(2.0, validator.reputation + 0.01);

    this.emit('validatorRewarded', {
      validatorId,
      reason,
      rewardAmount,
      newStake: validator.stakeAmount
    });
  }

  getValidatorRotation() {
    // Simplified rotation logic
    const activeValidators = Array.from(this.validators.keys()).filter(id => 
      this.validators.get(id).active
    );
    
    const rotationIndex = this.currentHeight % activeValidators.length;
    this.currentValidator = activeValidators[rotationIndex];
    
    return {
      currentValidator: this.currentValidator,
      nextValidator: activeValidators[(rotationIndex + 1) % activeValidators.length],
      rotationIndex
    };
  }

  getRecentChallengeResults() {
    return Array.from(this.challenges.values())
      .filter(c => c.status === 'resolved')
      .slice(-10)
      .map(c => ({
        challengeId: c.challengeId,
        successful: c.resolution.successful,
        challengedValidator: c.challengedValidator
      }));
  }

  getNextEpochTime() {
    const blocksUntilEpoch = this.config.epochLength - (this.currentHeight % this.config.epochLength);
    return Date.now() + (blocksUntilEpoch * this.config.blockTime);
  }

  // Additional methods for integration tests

  /**
   * Get all validators
   */
  getAllValidators() {
    return Array.from(this.validators.values());
  }

  /**
   * Get specific validator by ID
   */
  getValidator(validatorId) {
    return this.validators.get(validatorId);
  }

  /**
   * Get network metrics
   */
  getNetworkMetrics() {
    const validators = this.getAllValidators();
    const activeValidators = validators.filter(v => v.active);
    const totalStaked = validators.reduce((sum, v) => sum + v.stakeAmount, 0);
    const avgReputation = validators.length > 0 
      ? validators.reduce((sum, v) => sum + v.reputation, 0) / validators.length 
      : 0;

    return {
      networkHealth: Math.min(100, (activeValidators.length / this.config.validatorCount) * 100),
      consensusRate: this.consensusMetrics.blocksProduced > 0 
        ? (this.consensusMetrics.blocksProduced / (this.currentHeight + 1)) * 100 
        : 0,
      averageBlockTime: this.config.blockTime,
      totalStaked,
      networkHashrate: this.calculateNetworkHashRate(),
      byzantineFaultTolerance: Math.max(0, 100 - (this.consensusMetrics.slashingEvents / validators.length) * 100),
      lastBlockHeight: this.currentHeight,
      activeValidatorCount: activeValidators.length,
      avgReputation
    };
  }

  /**
   * Get latest blocks
   */
  getLatestBlocks(limit = 10) {
    const blocks = Array.from(this.blocks.values())
      .sort((a, b) => b.height - a.height)
      .slice(0, limit);
    
    return blocks;
  }

  /**
   * Get block height
   */
  getBlockHeight() {
    return this.currentHeight;
  }

  /**
   * Get pending challenges for validator
   */
  getPendingChallenges(validatorId) {
    return Array.from(this.challenges.values())
      .filter(c => c.challengedValidator === validatorId && c.status === 'pending');
  }

  /**
   * Increase validator stake
   */
  increaseStake(validatorId, amount) {
    const validator = this.validators.get(validatorId);
    if (!validator) {
      throw new Error('Validator not found');
    }
    
    if (amount <= 0) {
      throw new Error('Stake increase amount must be positive');
    }

    validator.stakeAmount += amount;
    validator.lastActivity = new Date();
    
    logger.info(`Increased stake for validator ${validatorId} by ${amount}`);
    
    return validator.stakeAmount;
  }

  /**
   * Decrease validator stake
   */
  decreaseStake(validatorId, amount) {
    const validator = this.validators.get(validatorId);
    if (!validator) {
      throw new Error('Validator not found');
    }
    
    if (amount <= 0) {
      throw new Error('Stake decrease amount must be positive');
    }

    if (validator.stakeAmount - amount < this.config.minStake) {
      throw new Error(`Cannot reduce stake below minimum of ${this.config.minStake}`);
    }

    validator.stakeAmount -= amount;
    validator.lastActivity = new Date();
    
    logger.info(`Decreased stake for validator ${validatorId} by ${amount}`);
    
    return validator.stakeAmount;
  }

  /**
   * Slash validator for malicious behavior
   */
  slashValidator(validatorId, slashPercentage, reason, evidence) {
    const validator = this.validators.get(validatorId);
    if (!validator) {
      throw new Error('Validator not found');
    }

    const slashedAmount = Math.floor(validator.stakeAmount * slashPercentage / 100);
    validator.stakeAmount -= slashedAmount;
    validator.reputation = Math.max(0.1, validator.reputation - 0.5);
    validator.active = false;
    validator.status = 'slashed';
    
    // Record slashing event
    const slashingEvent = {
      validatorId,
      slashedAmount,
      reason,
      evidence,
      timestamp: new Date(),
      originalStake: validator.stakeAmount + slashedAmount
    };
    
    validator.slashingHistory.push(slashingEvent);
    this.slashingEvents.push(slashingEvent);
    this.consensusMetrics.slashingEvents++;
    
    logger.warn(`Validator ${validatorId} slashed: ${slashPercentage}% (${slashedAmount} tokens) for ${reason}`);
    
    this.emit('validatorSlashed', slashingEvent);
    
    return {
      slashedAmount,
      remainingStake: validator.stakeAmount,
      newStatus: validator.status
    };
  }

  /**
   * Calculate network hash rate
   */
  calculateNetworkHashRate() {
    const activeValidators = this.getAllValidators().filter(v => v.active);
    if (activeValidators.length === 0) return 0;
    
    // Simplified calculation based on validator compute capacity
    return activeValidators.reduce((sum, v) => {
      const capacity = v.computeCapacity.hashRate || v.computeCapacity.gflops || 1;
      return sum + capacity;
    }, 0);
  }
}

module.exports = ProofOfComputeConsensus;