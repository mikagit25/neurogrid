/**
 * NEURO Economy Manager - Token-based economy system
 * Manages NEURO tokens, payments, rewards, and staking
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class NEUROEconomyManager {
    constructor() {
        this.balancesFile = path.join(__dirname, '../data/neuro-balances.json');
        this.transactionsFile = path.join(__dirname, '../data/neuro-transactions.json');
        this.stakingFile = path.join(__dirname, '../data/neuro-staking.json');
        
        // In-memory storage
        this.balances = new Map(); // userAddress -> balance
        this.transactions = [];
        this.stakingPools = new Map(); // modelId -> staking info
        this.rewards = new Map(); // userAddress -> pending rewards
        
        // Economy settings
        this.settings = {
            initial_balance: 100.0, // New users get 100 NEURO
            staking_min_amount: 10.0, // Minimum 10 NEURO to stake
            staking_reward_rate: 0.05, // 5% annual reward rate
            quality_bonus_multiplier: 1.2, // 20% bonus for high-quality models
            author_revenue_share: 0.7, // Authors get 70% of model usage fees
            platform_fee: 0.1, // 10% platform fee
            referral_bonus: 5.0, // 5 NEURO for successful referrals
            transaction_fee: 0.001 // 0.1% transaction fee
        };

        console.log('💰 NEURO Economy Manager initialized');
        this.ensureDirectories();
        this.loadEconomyData();
        
        // Start periodic reward distribution
        this.rewardInterval = setInterval(() => this.distributeStakingRewards(), 60000); // Every minute
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [path.dirname(this.balancesFile)];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    /**
     * Load economy data from storage
     */
    loadEconomyData() {
        try {
            // Load balances
            if (fs.existsSync(this.balancesFile)) {
                const balanceData = JSON.parse(fs.readFileSync(this.balancesFile, 'utf8'));
                balanceData.forEach(entry => {
                    this.balances.set(entry.address, entry.balance);
                });
                console.log(`💰 Loaded ${this.balances.size} user balances`);
            } else {
                this.initializeDefaultBalances();
            }

            // Load transactions
            if (fs.existsSync(this.transactionsFile)) {
                this.transactions = JSON.parse(fs.readFileSync(this.transactionsFile, 'utf8'));
                console.log(`📋 Loaded ${this.transactions.length} transactions`);
            }

            // Load staking data
            if (fs.existsSync(this.stakingFile)) {
                const stakingData = JSON.parse(fs.readFileSync(this.stakingFile, 'utf8'));
                stakingData.forEach(pool => {
                    // Convert stakers object back to Map
                    const poolWithMap = {
                        ...pool,
                        stakers: new Map(Object.entries(pool.stakers || {}))
                    };
                    this.stakingPools.set(pool.model_id, poolWithMap);
                });
                console.log(`🎯 Loaded ${this.stakingPools.size} staking pools`);
            }

        } catch (error) {
            console.error('❌ Error loading economy data:', error);
            this.initializeDefaultBalances();
        }
    }

    /**
     * Initialize default balances and economy state
     */
    initializeDefaultBalances() {
        const defaultUsers = [
            { address: '0x1234567890123456789012345678901234567890', balance: 250.0, name: 'NeuroGrid Community' },
            { address: '0x9876543210987654321098765432109876543210', balance: 180.5, name: 'AIArtist Pro' },
            { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', balance: 95.7, name: 'DevTools Inc' },
            { address: '0xTestUserAddress123456789', balance: 150.0, name: 'TestUser' }
        ];

        defaultUsers.forEach(user => {
            this.balances.set(user.address, user.balance);
        });

        // Create initial transactions
        this.transactions = [
            {
                id: this.generateTransactionId(),
                from: 'system',
                to: '0x1234567890123456789012345678901234567890',
                amount: 250.0,
                type: 'initial_grant',
                description: 'Initial NEURO grant for community model',
                timestamp: new Date('2026-01-15').toISOString(),
                status: 'completed'
            },
            {
                id: this.generateTransactionId(),
                from: 'user_alice',
                to: '0x1234567890123456789012345678901234567890',
                amount: 0.15,
                type: 'model_usage',
                model_id: 'community-llama2-finetuned',
                description: 'Payment for AI model usage',
                timestamp: new Date('2026-01-20').toISOString(),
                status: 'completed'
            }
        ];

        this.saveEconomyData();
        console.log('💰 Initialized default NEURO economy state');
    }

    /**
     * Generate unique transaction ID
     */
    generateTransactionId() {
        return 'tx_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Get user balance
     */
    getBalance(userAddress) {
        return this.balances.get(userAddress) || 0;
    }

    /**
     * Create new user with initial balance
     */
    createUser(userAddress) {
        if (!this.balances.has(userAddress)) {
            this.balances.set(userAddress, this.settings.initial_balance);
            
            // Record initial grant transaction
            const transaction = {
                id: this.generateTransactionId(),
                from: 'system',
                to: userAddress,
                amount: this.settings.initial_balance,
                type: 'initial_grant',
                description: 'Welcome to NeuroGrid! Initial NEURO balance',
                timestamp: new Date().toISOString(),
                status: 'completed'
            };
            
            this.transactions.push(transaction);
            this.saveEconomyData();
            
            console.log(`💰 Created new user with ${this.settings.initial_balance} NEURO: ${userAddress.substring(0, 10)}...`);
            
            return {
                success: true,
                balance: this.settings.initial_balance,
                transaction_id: transaction.id
            };
        }

        return {
            success: false,
            error: 'User already exists',
            balance: this.getBalance(userAddress)
        };
    }

    /**
     * Process payment for model usage
     */
    async processModelPayment(fromAddress, modelId, tokens, modelData) {
        try {
            const costPerToken = modelData.cost_per_token || 0.01;
            const totalCost = tokens * costPerToken;
            const platformFee = totalCost * this.settings.platform_fee;
            const authorRevenue = totalCost * this.settings.author_revenue_share;

            // Check user balance
            const userBalance = this.getBalance(fromAddress);
            if (userBalance < totalCost) {
                return {
                    success: false,
                    error: 'Insufficient NEURO balance',
                    required: totalCost,
                    available: userBalance
                };
            }

            // Deduct from user
            this.balances.set(fromAddress, userBalance - totalCost);

            // Pay author
            const authorAddress = modelData.author_address;
            const authorBalance = this.getBalance(authorAddress);
            this.balances.set(authorAddress, authorBalance + authorRevenue);

            // Record transaction
            const transaction = {
                id: this.generateTransactionId(),
                from: fromAddress,
                to: authorAddress,
                amount: totalCost,
                author_revenue: authorRevenue,
                platform_fee: platformFee,
                type: 'model_usage',
                model_id: modelId,
                tokens_used: tokens,
                description: `Payment for ${modelData.name} usage (${tokens} tokens)`,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };

            this.transactions.push(transaction);
            this.saveEconomyData();

            // Update model earnings
            this.updateModelEarnings(modelId, authorRevenue);

            console.log(`💰 Model payment processed: ${totalCost} NEURO (${tokens} tokens)`);

            return {
                success: true,
                transaction_id: transaction.id,
                total_cost: totalCost,
                author_revenue: authorRevenue,
                platform_fee: platformFee,
                remaining_balance: this.getBalance(fromAddress)
            };

        } catch (error) {
            console.error('❌ Error processing payment:', error);
            return {
                success: false,
                error: 'Payment processing failed',
                details: error.message
            };
        }
    }

    /**
     * Stake NEURO tokens on a model
     */
    async stakeTokens(userAddress, modelId, amount) {
        try {
            // Validation
            if (amount < this.settings.staking_min_amount) {
                return {
                    success: false,
                    error: `Minimum staking amount is ${this.settings.staking_min_amount} NEURO`
                };
            }

            const userBalance = this.getBalance(userAddress);
            if (userBalance < amount) {
                return {
                    success: false,
                    error: 'Insufficient balance for staking'
                };
            }

            // Create or update staking pool
            if (!this.stakingPools.has(modelId)) {
                this.stakingPools.set(modelId, {
                    model_id: modelId,
                    total_staked: 0,
                    stakers: new Map(),
                    created_at: new Date().toISOString()
                });
            }

            const pool = this.stakingPools.get(modelId);
            const existingStake = pool.stakers.get(userAddress) || 0;

            // Update balances
            this.balances.set(userAddress, userBalance - amount);
            pool.total_staked += amount;
            pool.stakers.set(userAddress, existingStake + amount);
            pool.last_updated = new Date().toISOString();

            // Record transaction
            const transaction = {
                id: this.generateTransactionId(),
                from: userAddress,
                to: `staking_pool_${modelId}`,
                amount: amount,
                type: 'stake',
                model_id: modelId,
                description: `Staked NEURO on model for rewards`,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };

            this.transactions.push(transaction);
            this.saveEconomyData();

            console.log(`🎯 Staked ${amount} NEURO on model ${modelId} by ${userAddress.substring(0, 10)}...`);

            return {
                success: true,
                transaction_id: transaction.id,
                staked_amount: amount,
                total_staked: existingStake + amount,
                pool_total: pool.total_staked,
                remaining_balance: this.getBalance(userAddress)
            };

        } catch (error) {
            console.error('❌ Error staking tokens:', error);
            return {
                success: false,
                error: 'Staking failed',
                details: error.message
            };
        }
    }

    /**
     * Unstake tokens from a model
     */
    async unstakeTokens(userAddress, modelId, amount) {
        try {
            const pool = this.stakingPools.get(modelId);
            if (!pool) {
                return {
                    success: false,
                    error: 'Staking pool not found'
                };
            }

            const userStake = pool.stakers.get(userAddress) || 0;
            if (userStake < amount) {
                return {
                    success: false,
                    error: 'Insufficient staked amount',
                    available: userStake
                };
            }

            // Update balances
            const userBalance = this.getBalance(userAddress);
            this.balances.set(userAddress, userBalance + amount);
            pool.total_staked -= amount;
            pool.stakers.set(userAddress, userStake - amount);
            
            // Remove if 0
            if (pool.stakers.get(userAddress) === 0) {
                pool.stakers.delete(userAddress);
            }

            // Record transaction
            const transaction = {
                id: this.generateTransactionId(),
                from: `staking_pool_${modelId}`,
                to: userAddress,
                amount: amount,
                type: 'unstake',
                model_id: modelId,
                description: `Unstaked NEURO from model`,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };

            this.transactions.push(transaction);
            this.saveEconomyData();

            console.log(`🎯 Unstaked ${amount} NEURO from model ${modelId}`);

            return {
                success: true,
                transaction_id: transaction.id,
                unstaked_amount: amount,
                remaining_staked: userStake - amount,
                new_balance: this.getBalance(userAddress)
            };

        } catch (error) {
            console.error('❌ Error unstaking tokens:', error);
            return {
                success: false,
                error: 'Unstaking failed',
                details: error.message
            };
        }
    }

    /**
     * Distribute staking rewards (called periodically)
     */
    distributeStakingRewards() {
        try {
            let totalRewardsDistributed = 0;

            for (const [modelId, pool] of this.stakingPools.entries()) {
                if (pool.total_staked > 0) {
                    // Calculate rewards based on staked amount and time
                    const annualRate = this.settings.staking_reward_rate;
                    const minuteRate = annualRate / (365 * 24 * 60); // Per minute rate
                    
                    for (const [userAddress, stakedAmount] of pool.stakers.entries()) {
                        const reward = stakedAmount * minuteRate;
                        
                        if (reward > 0) {
                            // Add to pending rewards
                            const pendingRewards = this.rewards.get(userAddress) || 0;
                            this.rewards.set(userAddress, pendingRewards + reward);
                            totalRewardsDistributed += reward;
                        }
                    }
                }
            }

            if (totalRewardsDistributed > 0) {
                console.log(`🎁 Distributed ${totalRewardsDistributed.toFixed(6)} NEURO in staking rewards`);
            }

        } catch (error) {
            console.error('❌ Error distributing rewards:', error);
        }
    }

    /**
     * Claim pending staking rewards
     */
    claimRewards(userAddress) {
        const pendingRewards = this.rewards.get(userAddress) || 0;
        
        if (pendingRewards > 0) {
            // Add to balance
            const currentBalance = this.getBalance(userAddress);
            this.balances.set(userAddress, currentBalance + pendingRewards);
            
            // Clear pending rewards
            this.rewards.set(userAddress, 0);
            
            // Record transaction
            const transaction = {
                id: this.generateTransactionId(),
                from: 'system_rewards',
                to: userAddress,
                amount: pendingRewards,
                type: 'staking_reward',
                description: 'Staking rewards claimed',
                timestamp: new Date().toISOString(),
                status: 'completed'
            };
            
            this.transactions.push(transaction);
            this.saveEconomyData();
            
            console.log(`🎁 Claimed ${pendingRewards.toFixed(4)} NEURO rewards for ${userAddress.substring(0, 10)}...`);
            
            return {
                success: true,
                claimed_amount: pendingRewards,
                new_balance: this.getBalance(userAddress),
                transaction_id: transaction.id
            };
        }
        
        return {
            success: false,
            error: 'No rewards to claim',
            pending_rewards: 0
        };
    }

    /**
     * Get user's staking information
     */
    getUserStaking(userAddress) {
        const stakes = [];
        let totalStaked = 0;
        
        for (const [modelId, pool] of this.stakingPools.entries()) {
            const userStake = pool.stakers.get(userAddress) || 0;
            if (userStake > 0) {
                stakes.push({
                    model_id: modelId,
                    staked_amount: userStake,
                    pool_total: pool.total_staked,
                    share_percentage: ((userStake / pool.total_staked) * 100).toFixed(2)
                });
                totalStaked += userStake;
            }
        }
        
        return {
            total_staked: totalStaked,
            pending_rewards: this.rewards.get(userAddress) || 0,
            stakes: stakes
        };
    }

    /**
     * Get transaction history for user
     */
    getUserTransactions(userAddress, limit = 10) {
        const userTransactions = this.transactions
            .filter(tx => tx.from === userAddress || tx.to === userAddress)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);

        return userTransactions;
    }

    /**
     * Update model earnings statistics
     */
    updateModelEarnings(modelId, amount) {
        // This would integrate with ModelManager to update earnings stats
        // For now, just log it
        console.log(`💰 Model ${modelId} earned ${amount} NEURO`);
    }

    /**
     * Get economy statistics
     */
    getEconomyStats() {
        const totalSupply = Array.from(this.balances.values()).reduce((sum, balance) => sum + balance, 0);
        const totalStaked = Array.from(this.stakingPools.values()).reduce((sum, pool) => sum + pool.total_staked, 0);
        const totalRewards = Array.from(this.rewards.values()).reduce((sum, reward) => sum + reward, 0);
        
        return {
            total_supply: Math.round(totalSupply * 1000) / 1000,
            circulating_supply: Math.round((totalSupply - totalStaked) * 1000) / 1000,
            total_staked: Math.round(totalStaked * 1000) / 1000,
            pending_rewards: Math.round(totalRewards * 1000) / 1000,
            total_users: this.balances.size,
            total_transactions: this.transactions.length,
            active_staking_pools: this.stakingPools.size,
            average_balance: Math.round((totalSupply / this.balances.size) * 100) / 100,
            staking_participation: ((this.stakingPools.size / this.balances.size) * 100).toFixed(1) + '%'
        };
    }

    /**
     * Save economy data to storage
     */
    saveEconomyData() {
        try {
            // Save balances
            const balancesArray = Array.from(this.balances.entries()).map(([address, balance]) => ({
                address,
                balance
            }));
            fs.writeFileSync(this.balancesFile, JSON.stringify(balancesArray, null, 2));

            // Save transactions
            fs.writeFileSync(this.transactionsFile, JSON.stringify(this.transactions, null, 2));

            // Save staking data
            const stakingArray = Array.from(this.stakingPools.entries()).map(([modelId, pool]) => ({
                model_id: modelId,
                total_staked: pool.total_staked,
                stakers: pool.stakers instanceof Map ? Object.fromEntries(pool.stakers) : (pool.stakers || {}),
                created_at: pool.created_at,
                last_updated: pool.last_updated
            }));
            fs.writeFileSync(this.stakingFile, JSON.stringify(stakingArray, null, 2));

            console.log('💾 Saved NEURO economy data');
        } catch (error) {
            console.error('❌ Error saving economy data:', error);
        }
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        if (this.rewardInterval) {
            clearInterval(this.rewardInterval);
        }
        this.saveEconomyData();
        console.log('💰 NEURO Economy Manager destroyed');
    }
}

module.exports = NEUROEconomyManager;