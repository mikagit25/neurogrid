/**
 * Uniswap V3 Advanced Liquidity Management
 * Phase 4 DeFi Integration Component
 * Handles concentrated liquidity, fee optimization, and position management
 */

const EventEmitter = require('events');
// const { ethers } = require('ethers'); // Removed for now to allow testing

class UniswapV3Manager extends EventEmitter {
    constructor(config = {}) {
        super();

        this.managerId = 'uniswap_v3_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        // Uniswap V3 Configuration
        this.config = {
            // Contract Addresses (Ethereum Mainnet)
            factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',

            // Fee Tiers (in basis points)
            fee_tiers: {
                STABLE: 100,    // 0.01% - стейблкоины
                LOW: 500,       // 0.05% - коррелированные пары
                MEDIUM: 3000,   // 0.30% - стандартные пары
                HIGH: 10000     // 1.00% - экзотические пары
            },

            // Position Management
            tick_spacing: {
                100: 1,
                500: 10,
                3000: 60,
                10000: 200
            },

            // Risk Parameters
            max_price_impact: 0.005,  // 0.5%
            min_liquidity: 10000,     // $10k minimum
            rebalance_threshold: 0.1,  // 10% price move
            fee_collection_threshold: 100, // $100 in fees

            ...config
        };

        // State Management
        this.activePositions = new Map();
        this.priceFeeds = new Map();
        this.feeCollections = new Map();
        this.rebalanceQueue = [];

        // Analytics
        this.analytics = {
            total_positions: 0,
            total_volume_24h: 0,
            total_fees_earned: 0,
            active_liquidity: 0,
            impermanent_loss: 0,
            price_ranges: new Map()
        };

        console.log(`🦄 Uniswap V3 Manager initialized: ${this.managerId}`);
    }

    /**
     * Create Concentrated Liquidity Position
     */
    async createPosition(params) {
        const {
            tokenA,
            tokenB,
            fee,
            amount0,
            amount1,
            tickLower,
            tickUpper,
            slippage = 0.005
        } = params;

        console.log(`🔄 Creating Uniswap V3 position: ${tokenA}/${tokenB} (${fee / 10000}%)`);

        try {
            // Validate parameters
            this.validatePositionParams(params);

            // Calculate optimal tick range
            const { optimizedTickLower, optimizedTickUpper } = await this.calculateOptimalTicks(
                tokenA, tokenB, fee, tickLower, tickUpper
            );

            // Check price impact
            const priceImpact = await this.calculatePriceImpact(tokenA, tokenB, amount0, amount1);
            if (priceImpact > this.config.max_price_impact) {
                throw new Error(`Price impact too high: ${(priceImpact * 100).toFixed(2)}%`);
            }

            // Create position
            const positionId = `uni_v3_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const position = {
                id: positionId,
                tokenA,
                tokenB,
                fee,
                tickLower: optimizedTickLower,
                tickUpper: optimizedTickUpper,
                liquidity: 0,
                amount0: amount0,
                amount1: amount1,
                fees_earned: { token0: 0, token1: 0 },
                created_at: Date.now(),
                status: 'active',
                in_range: true,
                price_at_creation: await this.getCurrentPrice(tokenA, tokenB),
                impermanent_loss: 0
            };

            // Simulate liquidity calculation
            position.liquidity = this.calculateLiquidity(amount0, amount1, optimizedTickLower, optimizedTickUpper);

            // Store position
            this.activePositions.set(positionId, position);
            this.analytics.total_positions++;
            this.analytics.active_liquidity += position.liquidity;

            // Start monitoring
            this.startPositionMonitoring(positionId);

            console.log(`✅ Uniswap V3 position created: ${positionId}`);
            console.log(`🎯 Price range: ${this.tickToPrice(optimizedTickLower)} - ${this.tickToPrice(optimizedTickUpper)}`);

            this.emit('position:created', {
                positionId,
                tokenA,
                tokenB,
                fee,
                tickRange: [optimizedTickLower, optimizedTickUpper],
                liquidity: position.liquidity
            });

            return {
                success: true,
                positionId,
                position: {
                    id: position.id,
                    tokenA: position.tokenA,
                    tokenB: position.tokenB,
                    fee: position.fee,
                    tickLower: position.tickLower,
                    tickUpper: position.tickUpper,
                    liquidity: position.liquidity,
                    amount0: position.amount0,
                    amount1: position.amount1,
                    fees_earned: position.fees_earned,
                    created_at: position.created_at,
                    status: position.status,
                    in_range: position.in_range,
                    price_at_creation: position.price_at_creation,
                    impermanent_loss: position.impermanent_loss
                },
                estimated_fees_apy: await this.estimateFeesAPY(tokenA, tokenB, fee),
                price_range: [this.tickToPrice(optimizedTickLower), this.tickToPrice(optimizedTickUpper)]
            };

        } catch (error) {
            console.error('❌ Failed to create Uniswap V3 position:', error.message);
            throw error;
        }
    }

    /**
     * Remove/Close Position
     */
    async removePosition(positionId) {
        console.log(`🔄 Removing Uniswap V3 position: ${positionId}`);

        const position = this.activePositions.get(positionId);
        if (!position) {
            throw new Error(`Position not found: ${positionId}`);
        }

        try {
            // Calculate final performance
            const performance = await this.calculatePositionPerformance(position);

            // Collect unclaimed fees
            const feesCollected = await this.collectFees(positionId);

            // Remove from active positions
            this.activePositions.delete(positionId);
            this.analytics.active_liquidity -= position.liquidity;

            // Stop monitoring
            this.stopPositionMonitoring(positionId);

            console.log(`✅ Position removed: ${positionId}`);
            console.log(`💰 Total fees collected: $${feesCollected.total_usd}`);
            console.log(`📊 IL: ${(performance.impermanent_loss * 100).toFixed(2)}%`);

            this.emit('position:removed', {
                positionId,
                performance,
                feesCollected,
                duration: Date.now() - position.created_at
            });

            return {
                success: true,
                positionId,
                performance,
                fees_collected: feesCollected,
                final_amounts: performance.final_amounts
            };

        } catch (error) {
            console.error('❌ Failed to remove position:', error.message);
            throw error;
        }
    }

    /**
     * Rebalance Position (Adjust Price Range)
     */
    async rebalancePosition(positionId, newTickRange) {
        console.log(`🔄 Rebalancing position: ${positionId}`);

        const position = this.activePositions.get(positionId);
        if (!position) {
            throw new Error(`Position not found: ${positionId}`);
        }

        try {
            // Remove old position
            const oldPosition = await this.removePosition(positionId);

            // Create new position with adjusted range
            const newPosition = await this.createPosition({
                tokenA: position.tokenA,
                tokenB: position.tokenB,
                fee: position.fee,
                amount0: oldPosition.final_amounts.amount0,
                amount1: oldPosition.final_amounts.amount1,
                tickLower: newTickRange.lower,
                tickUpper: newTickRange.upper
            });

            console.log(`✅ Position rebalanced: ${positionId} -> ${newPosition.positionId}`);

            this.emit('position:rebalanced', {
                oldPositionId: positionId,
                newPositionId: newPosition.positionId,
                newTickRange
            });

            return newPosition;

        } catch (error) {
            console.error('❌ Failed to rebalance position:', error.message);
            throw error;
        }
    }

    /**
     * Collect Fees from Position
     */
    async collectFees(positionId) {
        const position = this.activePositions.get(positionId);
        if (!position) {
            throw new Error(`Position not found: ${positionId}`);
        }

        // Simulate fee collection
        const fees = {
            token0: Math.random() * 0.1, // Random fees
            token1: Math.random() * 100,
            total_usd: Math.random() * 150 + 50
        };

        // Update position
        position.fees_earned.token0 += fees.token0;
        position.fees_earned.token1 += fees.token1;

        // Update analytics
        this.analytics.total_fees_earned += fees.total_usd;

        this.emit('fees:collected', {
            positionId,
            fees,
            total_collected: position.fees_earned
        });

        console.log(`💰 Fees collected from ${positionId}: $${fees.total_usd.toFixed(2)}`);

        return fees;
    }

    /**
     * Get Position Performance
     */
    async getPositionPerformance(positionId) {
        const position = this.activePositions.get(positionId);
        if (!position) {
            throw new Error(`Position not found: ${positionId}`);
        }

        return await this.calculatePositionPerformance(position);
    }

    /**
     * Auto-rebalance Based on Price Movement
     */
    async autoRebalance() {
        console.log('🔄 Running auto-rebalance check...');

        let rebalanced = 0;

        for (const [positionId, position] of this.activePositions) {
            const currentPrice = await this.getCurrentPrice(position.tokenA, position.tokenB);
            const priceChange = Math.abs(currentPrice - position.price_at_creation) / position.price_at_creation;

            // Check if position is out of range or needs rebalancing
            const needsRebalance = priceChange > this.config.rebalance_threshold;
            const isOutOfRange = !this.isPriceInRange(currentPrice, position.tickLower, position.tickUpper);

            if (needsRebalance || isOutOfRange) {
                console.log(`🎯 Auto-rebalancing position ${positionId} (price change: ${(priceChange * 100).toFixed(2)}%)`);

                // Calculate new optimal range
                const newRange = await this.calculateOptimalRebalanceRange(position, currentPrice);

                try {
                    await this.rebalancePosition(positionId, newRange);
                    rebalanced++;
                } catch (error) {
                    console.error(`❌ Failed to auto-rebalance ${positionId}:`, error.message);
                }
            }
        }

        console.log(`✅ Auto-rebalance complete: ${rebalanced} positions rebalanced`);
        return { rebalanced_count: rebalanced };
    }

    /**
     * Calculate Liquidity for Position
     */
    calculateLiquidity(amount0, amount1, tickLower, tickUpper) {
        // Simplified liquidity calculation
        const price0 = this.tickToPrice(tickLower);
        const price1 = this.tickToPrice(tickUpper);

        // Mock calculation - in real implementation would use Uniswap V3 math
        return Math.sqrt(amount0 * amount1) * (price1 - price0) * 1000;
    }

    /**
     * Helper Methods
     */
    tickToPrice(tick) {
        return Math.pow(1.0001, tick);
    }

    priceToTick(price) {
        return Math.floor(Math.log(price) / Math.log(1.0001));
    }

    isPriceInRange(price, tickLower, tickUpper) {
        const priceLower = this.tickToPrice(tickLower);
        const priceUpper = this.tickToPrice(tickUpper);
        return price >= priceLower && price <= priceUpper;
    }

    async getCurrentPrice(tokenA, tokenB) {
        // Mock price - in real implementation would fetch from Uniswap
        return 2800 + (Math.random() - 0.5) * 100; // ETH price simulation
    }

    async calculateOptimalTicks(tokenA, tokenB, fee, tickLower, tickUpper) {
        // Mock optimization - in real implementation would use advanced algorithms
        return {
            optimizedTickLower: tickLower,
            optimizedTickUpper: tickUpper
        };
    }

    async calculateOptimalRebalanceRange(position, currentPrice) {
        const tick = this.priceToTick(currentPrice);
        const spread = 0.1; // 10% range around current price

        return {
            lower: Math.floor(tick * (1 - spread)),
            upper: Math.floor(tick * (1 + spread))
        };
    }

    async calculatePriceImpact(tokenA, tokenB, amount0, amount1) {
        // Mock price impact calculation
        return Math.random() * 0.003; // 0-0.3%
    }

    async calculatePositionPerformance(position) {
        const currentPrice = await this.getCurrentPrice(position.tokenA, position.tokenB);
        const priceChange = (currentPrice - position.price_at_creation) / position.price_at_creation;

        // Simplified IL calculation
        const impermanent_loss = Math.max(0, Math.abs(priceChange) * 0.5);

        return {
            position_id: position.id,
            current_price: currentPrice,
            price_change: priceChange,
            impermanent_loss,
            fees_earned_usd: position.fees_earned.token0 * currentPrice + position.fees_earned.token1,
            net_performance: -impermanent_loss + (position.fees_earned.token0 * currentPrice + position.fees_earned.token1),
            duration_days: (Date.now() - position.created_at) / (1000 * 60 * 60 * 24),
            in_range: this.isPriceInRange(currentPrice, position.tickLower, position.tickUpper),
            final_amounts: {
                amount0: position.amount0,
                amount1: position.amount1
            }
        };
    }

    async estimateFeesAPY(tokenA, tokenB, fee) {
        // Mock APY estimation based on historical data
        const baseFee = fee / 10000; // Convert to decimal
        const volumeMultiplier = Math.random() * 2 + 1; // 1-3x volume multiplier
        return baseFee * volumeMultiplier * 365 * 24; // Annualized
    }

    validatePositionParams(params) {
        const required = ['tokenA', 'tokenB', 'fee', 'amount0', 'amount1', 'tickLower', 'tickUpper'];
        for (const param of required) {
            if (params[param] === undefined) {
                throw new Error(`Missing required parameter: ${param}`);
            }
        }
    }

    startPositionMonitoring(positionId) {
        // Set up real-time monitoring for position
        const intervalId = setInterval(async () => {
            try {
                const position = this.activePositions.get(positionId);
                if (!position) {
                    clearInterval(intervalId);
                    return;
                }

                const performance = await this.calculatePositionPerformance(position);

                // Check if fees should be collected
                if (performance.fees_earned_usd > this.config.fee_collection_threshold) {
                    await this.collectFees(positionId);
                }

                // Update position status
                position.in_range = performance.in_range;
                position.impermanent_loss = performance.impermanent_loss;

            } catch (error) {
                console.error(`❌ Error monitoring position ${positionId}:`, error.message);
            }
        }, 60000); // Check every minute

        // Store interval ID separately to avoid circular references
        if (!this.monitoringIntervals) {
            this.monitoringIntervals = new Map();
        }
        this.monitoringIntervals.set(positionId, intervalId);
    }

    stopPositionMonitoring(positionId) {
        if (this.monitoringIntervals && this.monitoringIntervals.has(positionId)) {
            const intervalId = this.monitoringIntervals.get(positionId);
            clearInterval(intervalId);
            this.monitoringIntervals.delete(positionId);
        }
    }

    /**
     * Get Manager Status
     */
    getStatus() {
        return {
            managerId: this.managerId,
            status: 'active',
            active_positions: this.activePositions.size,
            total_liquidity: this.analytics.active_liquidity,
            total_fees_earned: this.analytics.total_fees_earned,
            analytics: this.analytics,
            config: this.config
        };
    }

    /**
     * Get All Active Positions
     */
    getAllPositions() {
        return Array.from(this.activePositions.entries()).map(([id, position]) => ({
            id,
            ...position
        }));
    }
}

module.exports = UniswapV3Manager;