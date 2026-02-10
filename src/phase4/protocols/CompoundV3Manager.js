/**
 * Compound V3 Manager  
 * Phase 4 DeFi Integration - Money Market Protocol
 * Handles supply, earning rewards, and protocol governance
 */

const EventEmitter = require('events');

class CompoundV3Manager extends EventEmitter {
    constructor(config = {}) {
        super();

        this.managerId = 'compound_v3_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        // Compound V3 Configuration
        this.config = {
            // Contract Addresses (Ethereum Mainnet)
            comet_usdc: '0xc3d688B66703497DAA19ca5c9b45b73b58d8B9EC',
            comet_eth: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',
            rewards: '0x1B0e765F6224C21223AeA2af16c1C46E38885a40',

            supported_markets: ['USDC', 'ETH'],
            market_configs: {
                USDC: {
                    comet_address: '0xc3d688B66703497DAA19ca5b45b73b58d8B9EC',
                    base_token: 'USDC',
                    decimals: 6,
                    supply_apy: 0.04,
                    utilization_target: 0.8,
                    collateral_factors: {
                        ETH: 0.83,
                        WBTC: 0.70,
                        COMP: 0.60
                    }
                },
                ETH: {
                    comet_address: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',
                    base_token: 'ETH',
                    decimals: 18,
                    supply_apy: 0.025,
                    utilization_target: 0.85,
                    collateral_factors: {
                        USDC: 0.90,
                        USDT: 0.88,
                        WBTC: 0.75
                    }
                }
            },

            // Governance & Rewards
            comp_token: {
                address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
                decimals: 18,
                reward_rate: 0.05 // 5% APY in COMP
            },

            // Protocol Parameters
            liquidation_factor: 0.95,
            close_factor: 0.5,
            reserve_factor: 0.1,

            ...config
        };

        // State Management
        this.userPositions = new Map();
        this.supplyPositions = new Map();
        this.rewardsEarned = new Map();

        // Analytics
        this.analytics = {
            total_supplied_usdc: 0,
            total_supplied_eth: 0,
            total_comp_rewards: 0,
            active_suppliers: 0,
            utilization_rate_usdc: 0,
            utilization_rate_eth: 0
        };

        console.log(`💰 Compound V3 Manager initialized: ${this.managerId}`);
    }

    /**
     * Supply Assets to Compound V3
     */
    async supply(params) {
        const { market, amount, user } = params;

        console.log(`🔄 Supplying ${amount} to ${market} market for user ${user}`);

        try {
            // Validate market
            if (!this.config.market_configs[market]) {
                throw new Error(`Unsupported market: ${market}`);
            }

            const marketConfig = this.config.market_configs[market];

            // Create supply position
            const positionId = `compound_supply_${market}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const supplyAPY = this.calculateSupplyAPY(market);
            const compRewardAPY = this.calculateCOMPRewardAPY(market);

            const position = {
                id: positionId,
                market,
                amount: parseFloat(amount),
                user,
                supply_apy: supplyAPY,
                comp_reward_apy: compRewardAPY,
                total_apy: supplyAPY + compRewardAPY,
                created_at: Date.now(),
                status: 'active',
                accrued_interest: 0,
                comp_rewards_earned: 0
            };

            // Store position
            this.supplyPositions.set(positionId, position);

            // Update user positions
            if (!this.userPositions.has(user)) {
                this.userPositions.set(user, {
                    supplies: new Map(),
                    total_supplied_usd: 0,
                    comp_rewards: 0
                });
            }

            const userPosition = this.userPositions.get(user);
            userPosition.supplies.set(positionId, position);

            // Update analytics
            if (market === 'USDC') {
                this.analytics.total_supplied_usdc += parseFloat(amount);
            } else if (market === 'ETH') {
                this.analytics.total_supplied_eth += parseFloat(amount);
            }

            this.analytics.active_suppliers = this.userPositions.size;

            // Start monitoring for rewards
            this.startRewardTracking(positionId);

            console.log(`✅ Compound supply position created: ${positionId}`);
            console.log(`📊 Base APY: ${(supplyAPY * 100).toFixed(2)}%`);
            console.log(`🏆 COMP Rewards APY: ${(compRewardAPY * 100).toFixed(2)}%`);
            console.log(`💎 Total APY: ${((supplyAPY + compRewardAPY) * 100).toFixed(2)}%`);

            this.emit('supply:created', {
                positionId,
                market,
                amount,
                user,
                total_apy: supplyAPY + compRewardAPY
            });

            return {
                success: true,
                positionId,
                position: this.sanitizePosition(position),
                estimated_apy: {
                    base_apy: supplyAPY,
                    comp_reward_apy: compRewardAPY,
                    total_apy: supplyAPY + compRewardAPY
                }
            };

        } catch (error) {
            console.error('❌ Failed to supply to Compound V3:', error.message);
            throw error;
        }
    }

    /**
     * Withdraw Assets from Compound V3
     */
    async withdraw(params) {
        const { market, amount, user } = params;

        console.log(`🔄 Withdrawing ${amount} ${market} for user ${user}`);

        try {
            const userPosition = this.userPositions.get(user);
            if (!userPosition) {
                throw new Error(`No positions found for user ${user}`);
            }

            let totalAvailable = 0;
            const marketSupplies = [];

            for (const [posId, position] of userPosition.supplies) {
                if (position.market === market) {
                    const availableAmount = position.amount + position.accrued_interest;
                    totalAvailable += availableAmount;
                    marketSupplies.push({ ...position, available_amount: availableAmount });
                }
            }

            const withdrawAmount = amount === 'max' ? totalAvailable : parseFloat(amount);

            if (withdrawAmount > totalAvailable) {
                throw new Error(`Insufficient balance. Available: ${totalAvailable}, Requested: ${withdrawAmount}`);
            }

            // Process withdrawal
            let remainingToWithdraw = withdrawAmount;
            const withdrawnFromPositions = [];
            let totalCompRewards = 0;

            for (const position of marketSupplies) {
                if (remainingToWithdraw <= 0) break;

                const withdrawFromThis = Math.min(remainingToWithdraw, position.available_amount);
                const interestWithdrawn = Math.min(withdrawFromThis, position.accrued_interest);
                const principalWithdrawn = withdrawFromThis - interestWithdrawn;

                position.amount -= principalWithdrawn;
                position.accrued_interest -= interestWithdrawn;
                remainingToWithdraw -= withdrawFromThis;
                totalCompRewards += position.comp_rewards_earned;

                withdrawnFromPositions.push({
                    positionId: position.id,
                    amount: withdrawFromThis,
                    interest_withdrawn: interestWithdrawn,
                    principal_withdrawn: principalWithdrawn,
                    comp_rewards: position.comp_rewards_earned
                });

                // Remove position if fully withdrawn
                if (position.amount <= 0.001 && position.accrued_interest <= 0.001) {
                    this.supplyPositions.delete(position.id);
                    userPosition.supplies.delete(position.id);
                    this.stopRewardTracking(position.id);
                }
            }

            // Update analytics
            if (market === 'USDC') {
                this.analytics.total_supplied_usdc -= (withdrawAmount - totalCompRewards);
            } else if (market === 'ETH') {
                this.analytics.total_supplied_eth -= (withdrawAmount - totalCompRewards);
            }

            console.log(`✅ Withdrawal completed: ${withdrawAmount} ${market}`);
            console.log(`🏆 COMP rewards: ${totalCompRewards}`);

            this.emit('withdraw:completed', {
                market,
                amount: withdrawAmount,
                user,
                comp_rewards: totalCompRewards,
                withdrawnFromPositions
            });

            return {
                success: true,
                market,
                amount_withdrawn: withdrawAmount,
                comp_rewards_earned: totalCompRewards,
                remaining_balance: totalAvailable - withdrawAmount,
                withdrawn_from: withdrawnFromPositions
            };

        } catch (error) {
            console.error('❌ Failed to withdraw from Compound V3:', error.message);
            throw error;
        }
    }

    /**
     * Claim COMP Rewards
     */
    async claimRewards(user) {
        console.log(`🏆 Claiming COMP rewards for user ${user}`);

        try {
            const userPosition = this.userPositions.get(user);
            if (!userPosition) {
                throw new Error(`No positions found for user ${user}`);
            }

            let totalCompRewards = 0;
            const claimedPositions = [];

            for (const [posId, position] of userPosition.supplies) {
                if (position.comp_rewards_earned > 0) {
                    totalCompRewards += position.comp_rewards_earned;
                    claimedPositions.push({
                        positionId: posId,
                        rewards_claimed: position.comp_rewards_earned
                    });

                    // Reset rewards after claiming
                    position.comp_rewards_earned = 0;
                }
            }

            if (totalCompRewards === 0) {
                return {
                    success: true,
                    message: 'No COMP rewards available to claim',
                    comp_rewards_claimed: 0
                };
            }

            // Update user and global analytics
            userPosition.comp_rewards += totalCompRewards;
            this.analytics.total_comp_rewards += totalCompRewards;

            console.log(`✅ COMP rewards claimed: ${totalCompRewards} COMP`);

            this.emit('rewards:claimed', {
                user,
                comp_rewards: totalCompRewards,
                claimedPositions
            });

            return {
                success: true,
                comp_rewards_claimed: totalCompRewards,
                comp_price_usd: this.getCOMPPrice(),
                rewards_value_usd: totalCompRewards * this.getCOMPPrice(),
                claimed_from: claimedPositions
            };

        } catch (error) {
            console.error('❌ Failed to claim COMP rewards:', error.message);
            throw error;
        }
    }

    /**
     * Get User's Compound V3 Positions
     */
    getUserPositions(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) {
            return { supplies: [], total_supplied_usd: 0, comp_rewards: 0 };
        }

        return {
            supplies: Array.from(userPosition.supplies.values()).map(p => this.sanitizePosition(p)),
            total_supplied_usd: this.calculateUserTotalUSD(user),
            total_comp_rewards: userPosition.comp_rewards,
            claimable_rewards: this.calculateClaimableRewards(user)
        };
    }

    // Helper Methods
    calculateSupplyAPY(market) {
        const baseRates = {
            USDC: 0.035 + Math.random() * 0.015, // 3.5-5%
            ETH: 0.02 + Math.random() * 0.01     // 2-3%
        };
        return baseRates[market] || 0.03;
    }

    calculateCOMPRewardAPY(market) {
        // Mock COMP reward calculation
        const rewardMultipliers = {
            USDC: 0.02, // 2% additional APY in COMP
            ETH: 0.015  // 1.5% additional APY in COMP
        };
        return rewardMultipliers[market] || 0.015;
    }

    getCOMPPrice() {
        // Mock COMP price
        return 55 + (Math.random() - 0.5) * 10; // $50-60
    }

    calculateUserTotalUSD(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) return 0;

        let totalUSD = 0;
        for (const [posId, position] of userPosition.supplies) {
            const assetPrice = this.getAssetPrice(position.market);
            totalUSD += (position.amount + position.accrued_interest) * assetPrice;
        }
        return totalUSD;
    }

    calculateClaimableRewards(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) return 0;

        let totalRewards = 0;
        for (const [posId, position] of userPosition.supplies) {
            totalRewards += position.comp_rewards_earned;
        }
        return totalRewards;
    }

    getAssetPrice(asset) {
        // Mock prices
        const prices = {
            USDC: 1,
            ETH: 2800 + (Math.random() - 0.5) * 100,
            COMP: this.getCOMPPrice()
        };
        return prices[asset] || 1;
    }

    startRewardTracking(positionId) {
        // Mock reward accrual - in real implementation would track blocks
        const intervalId = setInterval(() => {
            const position = this.supplyPositions.get(positionId);
            if (!position) {
                clearInterval(intervalId);
                return;
            }

            // Accrue interest and COMP rewards
            const timeElapsed = (Date.now() - position.created_at) / (1000 * 60 * 60 * 24); // Days
            position.accrued_interest = position.amount * position.supply_apy * timeElapsed;
            position.comp_rewards_earned += (position.amount * position.comp_reward_apy * timeElapsed) / 365;

        }, 30000); // Update every 30 seconds

        if (!this.rewardIntervals) {
            this.rewardIntervals = new Map();
        }
        this.rewardIntervals.set(positionId, intervalId);
    }

    stopRewardTracking(positionId) {
        if (this.rewardIntervals && this.rewardIntervals.has(positionId)) {
            clearInterval(this.rewardIntervals.get(positionId));
            this.rewardIntervals.delete(positionId);
        }
    }

    sanitizePosition(position) {
        return {
            id: position.id,
            market: position.market,
            amount: position.amount,
            user: position.user,
            supply_apy: position.supply_apy,
            comp_reward_apy: position.comp_reward_apy,
            total_apy: position.total_apy,
            created_at: position.created_at,
            status: position.status,
            accrued_interest: position.accrued_interest,
            comp_rewards_earned: position.comp_rewards_earned
        };
    }

    /**
     * Get Manager Status
     */
    getStatus() {
        return {
            managerId: this.managerId,
            status: 'active',
            total_users: this.userPositions.size,
            total_supply_positions: this.supplyPositions.size,
            analytics: this.analytics,
            supported_markets: this.config.supported_markets,
            comp_price: this.getCOMPPrice(),
            config: {
                governance_token: 'COMP',
                reward_rate: this.config.comp_token.reward_rate,
                liquidation_factor: this.config.liquidation_factor
            }
        };
    }
}

module.exports = CompoundV3Manager;