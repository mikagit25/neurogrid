/**
 * Aave V3 Lending Protocol Manager
 * Phase 4 DeFi Integration Component  
 * Handles lending, borrowing, health factor monitoring, and risk management
 */

const EventEmitter = require('events');

class AaveV3Manager extends EventEmitter {
    constructor(config = {}) {
        super();

        this.managerId = 'aave_v3_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        // Aave V3 Configuration
        this.config = {
            // Contract Addresses (Ethereum Mainnet)
            pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
            poolDataProvider: '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3',
            priceOracle: '0x54586bE62E3c3580375aE3723C145253060Ca0C2',

            // Supported Assets
            supported_assets: {
                ETH: {
                    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                    decimals: 18,
                    ltv: 0.8,
                    liquidation_threshold: 0.825,
                    liquidation_bonus: 0.05,
                    stable_rate_enabled: false
                },
                USDC: {
                    address: '0xA0b86a33E6417c3ce7e4b47e8F766b8de0fd5C50',
                    decimals: 6,
                    ltv: 0.85,
                    liquidation_threshold: 0.875,
                    liquidation_bonus: 0.045,
                    stable_rate_enabled: true
                },
                USDT: {
                    address: '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811',
                    decimals: 6,
                    ltv: 0.85,
                    liquidation_threshold: 0.875,
                    liquidation_bonus: 0.045,
                    stable_rate_enabled: true
                },
                WBTC: {
                    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0e',
                    decimals: 8,
                    ltv: 0.75,
                    liquidation_threshold: 0.8,
                    liquidation_bonus: 0.1,
                    stable_rate_enabled: false
                }
            },

            // Risk Parameters
            min_health_factor: 1.5,
            critical_health_factor: 1.2,
            liquidation_threshold: 1.1,
            max_ltv: 0.8,
            flash_loan_fee: 0.0009, // 0.09%

            // Rate Modes
            STABLE_RATE: 1,
            VARIABLE_RATE: 2
        };

        // Apply external config without overriding supported_assets
        if (config && typeof config === 'object') {
            const { supported_assets, ...otherConfig } = config;
            Object.assign(this.config, otherConfig);
        }

        // State Management
        this.userPositions = new Map();
        this.lendingPositions = new Map();
        this.borrowingPositions = new Map();
        this.healthFactors = new Map();
        this.liquidationWarnings = new Map();

        // Analytics
        this.analytics = {
            total_supplied: 0,
            total_borrowed: 0,
            total_earned_interest: 0,
            total_paid_interest: 0,
            active_users: 0,
            liquidations_prevented: 0,
            flash_loans_executed: 0
        };

        console.log(`🏦 Aave V3 Manager initialized: ${this.managerId}`);
    }

    /**
     * Supply/Deposit Assets to Aave
     */
    async supply(params) {
        const { asset, amount, user, onBehalfOf } = params;

        console.log(`🔄 Supplying ${amount} ${asset} to Aave V3 for user ${user}`);

        try {
            // Validate parameters
            this.validateAsset(asset);
            this.validateAmount(amount);

            // Check asset configuration
            const assetConfig = this.config.supported_assets[asset];
            if (!assetConfig) {
                throw new Error(`Asset ${asset} not supported`);
            }

            // Create supply position
            const positionId = `aave_supply_${asset}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const position = {
                id: positionId,
                type: 'supply',
                asset,
                amount: parseFloat(amount),
                user: user || 'default_user',
                onBehalfOf: onBehalfOf || user || 'default_user',
                apy: this.calculateSupplyAPY(asset),
                created_at: Date.now(),
                status: 'active',
                accrued_interest: 0,
                underlying_balance: parseFloat(amount)
            };

            // Store position
            this.lendingPositions.set(positionId, position);

            // Update user positions
            if (!this.userPositions.has(user)) {
                this.userPositions.set(user, {
                    supplies: new Map(),
                    borrows: new Map(),
                    health_factor: 100, // Very safe initially
                    total_collateral_usd: 0,
                    total_debt_usd: 0
                });
            }

            const userPosition = this.userPositions.get(user);
            userPosition.supplies.set(positionId, position);

            // Update analytics
            this.analytics.total_supplied += parseFloat(amount);
            this.analytics.active_users = this.userPositions.size;

            // Calculate updated health factor
            await this.updateHealthFactor(user);

            // Start monitoring
            this.startPositionMonitoring(positionId);

            console.log(`✅ Supply position created: ${positionId}`);
            console.log(`📊 APY: ${(position.apy * 100).toFixed(2)}%`);

            this.emit('supply:created', {
                positionId,
                asset,
                amount,
                user,
                apy: position.apy
            });

            return {
                success: true,
                positionId,
                position: this.sanitizePosition(position),
                estimated_apy: position.apy,
                health_factor: userPosition.health_factor
            };

        } catch (error) {
            console.error('❌ Failed to supply to Aave V3:', error.message);
            throw error;
        }
    }

    /**
     * Withdraw Assets from Aave
     */
    async withdraw(params) {
        const { asset, amount, user, to } = params;

        console.log(`🔄 Withdrawing ${amount} ${asset} from Aave V3 for user ${user}`);

        try {
            // Find user's supply positions for this asset
            const userPosition = this.userPositions.get(user);
            if (!userPosition) {
                throw new Error(`No positions found for user ${user}`);
            }

            let totalAvailable = 0;
            const assetSupplies = [];

            for (const [posId, position] of userPosition.supplies) {
                if (position.asset === asset) {
                    totalAvailable += position.underlying_balance;
                    assetSupplies.push(position);
                }
            }

            const withdrawAmount = amount === 'max' ? totalAvailable : parseFloat(amount);

            if (withdrawAmount > totalAvailable) {
                throw new Error(`Insufficient balance. Available: ${totalAvailable}, Requested: ${withdrawAmount}`);
            }

            // Check if withdrawal would break health factor
            const projectedHealthFactor = await this.calculateProjectedHealthFactor(user, {
                type: 'withdraw',
                asset,
                amount: withdrawAmount
            });

            if (projectedHealthFactor < this.config.min_health_factor) {
                throw new Error(`Withdrawal would drop health factor to ${projectedHealthFactor.toFixed(3)}. Minimum required: ${this.config.min_health_factor}`);
            }

            // Process withdrawal (reduce positions)
            let remainingToWithdraw = withdrawAmount;
            const withdrawnFromPositions = [];

            for (const position of assetSupplies) {
                if (remainingToWithdraw <= 0) break;

                const withdrawFromThis = Math.min(remainingToWithdraw, position.underlying_balance);
                position.underlying_balance -= withdrawFromThis;
                remainingToWithdraw -= withdrawFromThis;

                withdrawnFromPositions.push({
                    positionId: position.id,
                    amount: withdrawFromThis
                });

                // Remove position if fully withdrawn
                if (position.underlying_balance <= 0.001) { // Small threshold for rounding
                    this.lendingPositions.delete(position.id);
                    userPosition.supplies.delete(position.id);
                    this.stopPositionMonitoring(position.id);
                }
            }

            // Update analytics
            this.analytics.total_supplied -= withdrawAmount;

            // Update health factor
            await this.updateHealthFactor(user);

            console.log(`✅ Withdrawal completed: ${withdrawAmount} ${asset}`);

            this.emit('withdraw:completed', {
                asset,
                amount: withdrawAmount,
                user,
                withdrawnFromPositions,
                new_health_factor: userPosition.health_factor
            });

            return {
                success: true,
                asset,
                amount_withdrawn: withdrawAmount,
                remaining_balance: totalAvailable - withdrawAmount,
                health_factor: userPosition.health_factor,
                withdrawn_from: withdrawnFromPositions
            };

        } catch (error) {
            console.error('❌ Failed to withdraw from Aave V3:', error.message);
            throw error;
        }
    }

    /**
     * Borrow Assets from Aave
     */
    async borrow(params) {
        const { asset, amount, user, interestRateMode = 2, onBehalfOf } = params;

        console.log(`🔄 Borrowing ${amount} ${asset} from Aave V3 for user ${user}`);

        try {
            // Validate parameters
            this.validateAsset(asset);
            this.validateAmount(amount);

            const userPosition = this.userPositions.get(user);
            if (!userPosition) {
                throw new Error(`User ${user} has no collateral positions`);
            }

            // Check borrowing capacity
            const borrowingPower = await this.calculateBorrowingPower(user);
            const borrowAmountUSD = parseFloat(amount) * this.getAssetPrice(asset);

            if (borrowAmountUSD > borrowingPower.available_usd) {
                throw new Error(`Insufficient borrowing power. Available: $${borrowingPower.available_usd.toFixed(2)}, Requested: $${borrowAmountUSD.toFixed(2)}`);
            }

            // Calculate projected health factor
            const projectedHealthFactor = await this.calculateProjectedHealthFactor(user, {
                type: 'borrow',
                asset,
                amount: parseFloat(amount)
            });

            if (projectedHealthFactor < this.config.min_health_factor) {
                throw new Error(`Borrow would drop health factor to ${projectedHealthFactor.toFixed(3)}. Minimum required: ${this.config.min_health_factor}`);
            }

            // Create borrow position
            const positionId = `aave_borrow_${asset}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const borrowRate = this.calculateBorrowRate(asset, interestRateMode);

            const position = {
                id: positionId,
                type: 'borrow',
                asset,
                amount: parseFloat(amount),
                user: user,
                onBehalfOf: onBehalfOf || user,
                interest_rate_mode: interestRateMode,
                current_rate: borrowRate,
                created_at: Date.now(),
                status: 'active',
                accrued_interest: 0,
                stable_rate: interestRateMode === 1 ? borrowRate : null
            };

            // Store position
            this.borrowingPositions.set(positionId, position);
            userPosition.borrows.set(positionId, position);

            // Update analytics
            this.analytics.total_borrowed += parseFloat(amount);

            // Update health factor
            await this.updateHealthFactor(user);

            // Start monitoring
            this.startPositionMonitoring(positionId);

            console.log(`✅ Borrow position created: ${positionId}`);
            console.log(`📊 Rate: ${(borrowRate * 100).toFixed(2)}% (${interestRateMode === 1 ? 'Stable' : 'Variable'})`);

            this.emit('borrow:created', {
                positionId,
                asset,
                amount: parseFloat(amount),
                user,
                rate: borrowRate,
                rate_mode: interestRateMode
            });

            return {
                success: true,
                positionId,
                position: this.sanitizePosition(position),
                interest_rate: borrowRate,
                health_factor: userPosition.health_factor,
                borrowing_power_remaining: borrowingPower.available_usd - borrowAmountUSD
            };

        } catch (error) {
            console.error('❌ Failed to borrow from Aave V3:', error.message);
            throw error;
        }
    }

    /**
     * Repay Borrowed Assets
     */
    async repay(params) {
        const { asset, amount, user, rateMode, onBehalfOf } = params;

        console.log(`🔄 Repaying ${amount} ${asset} to Aave V3 for user ${user}`);

        try {
            const userPosition = this.userPositions.get(user);
            if (!userPosition) {
                throw new Error(`No positions found for user ${user}`);
            }

            // Find user's borrow positions for this asset
            let totalOwed = 0;
            const assetBorrows = [];

            for (const [posId, position] of userPosition.borrows) {
                if (position.asset === asset) {
                    const owedAmount = position.amount + position.accrued_interest;
                    totalOwed += owedAmount;
                    assetBorrows.push({ ...position, total_owed: owedAmount });
                }
            }

            if (totalOwed === 0) {
                throw new Error(`No ${asset} debt found for user ${user}`);
            }

            const repayAmount = amount === 'max' ? totalOwed : parseFloat(amount);

            if (repayAmount > totalOwed) {
                console.log(`⚠️ Repay amount ${repayAmount} exceeds debt ${totalOwed}, will repay maximum`);
            }

            // Process repayment
            let remainingToRepay = Math.min(repayAmount, totalOwed);
            const repaidPositions = [];

            for (const position of assetBorrows) {
                if (remainingToRepay <= 0) break;

                const repayFromThis = Math.min(remainingToRepay, position.total_owed);
                const interestPaid = Math.min(repayFromThis, position.accrued_interest);
                const principalPaid = repayFromThis - interestPaid;

                position.accrued_interest -= interestPaid;
                position.amount -= principalPaid;
                remainingToRepay -= repayFromThis;

                repaidPositions.push({
                    positionId: position.id,
                    amount_repaid: repayFromThis,
                    interest_paid: interestPaid,
                    principal_paid: principalPaid
                });

                // Remove position if fully repaid
                if (position.amount <= 0.001 && position.accrued_interest <= 0.001) {
                    this.borrowingPositions.delete(position.id);
                    userPosition.borrows.delete(position.id);
                    this.stopPositionMonitoring(position.id);
                }
            }

            const totalRepaid = Math.min(repayAmount, totalOwed);

            // Update analytics
            this.analytics.total_borrowed -= (totalRepaid - repaidPositions.reduce((sum, p) => sum + p.interest_paid, 0));
            this.analytics.total_paid_interest += repaidPositions.reduce((sum, p) => sum + p.interest_paid, 0);

            // Update health factor
            await this.updateHealthFactor(user);

            console.log(`✅ Repayment completed: ${totalRepaid} ${asset}`);

            this.emit('repay:completed', {
                asset,
                amount_repaid: totalRepaid,
                user,
                repaidPositions,
                new_health_factor: userPosition.health_factor
            });

            return {
                success: true,
                asset,
                amount_repaid: totalRepaid,
                remaining_debt: totalOwed - totalRepaid,
                health_factor: userPosition.health_factor,
                repaid_positions: repaidPositions
            };

        } catch (error) {
            console.error('❌ Failed to repay Aave V3 debt:', error.message);
            throw error;
        }
    }

    /**
     * Get User's Health Factor
     */
    async getHealthFactor(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) {
            return { health_factor: null, message: 'No positions found' };
        }

        await this.updateHealthFactor(user);

        return {
            health_factor: userPosition.health_factor,
            status: this.getHealthFactorStatus(userPosition.health_factor),
            total_collateral_usd: userPosition.total_collateral_usd,
            total_debt_usd: userPosition.total_debt_usd,
            borrowing_power: await this.calculateBorrowingPower(user),
            liquidation_risk: userPosition.health_factor < this.config.critical_health_factor ? 'high' : 'low'
        };
    }

    /**
     * Calculate and Update Health Factor
     */
    async updateHealthFactor(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) return;

        let totalCollateralUSD = 0;
        let totalDebtUSD = 0;

        // Calculate total collateral value
        for (const [posId, position] of userPosition.supplies) {
            const assetPrice = this.getAssetPrice(position.asset);
            const assetConfig = this.config.supported_assets[position.asset];
            const collateralValue = position.underlying_balance * assetPrice * assetConfig.liquidation_threshold;
            totalCollateralUSD += collateralValue;
        }

        // Calculate total debt value 
        for (const [posId, position] of userPosition.borrows) {
            const assetPrice = this.getAssetPrice(position.asset);
            const debtValue = (position.amount + position.accrued_interest) * assetPrice;
            totalDebtUSD += debtValue;
        }

        // Calculate health factor
        const healthFactor = totalDebtUSD > 0 ? totalCollateralUSD / totalDebtUSD : 100;

        // Update positions
        userPosition.health_factor = healthFactor;
        userPosition.total_collateral_usd = totalCollateralUSD;
        userPosition.total_debt_usd = totalDebtUSD;

        this.healthFactors.set(user, healthFactor);

        // Check for liquidation warnings
        if (healthFactor < this.config.critical_health_factor) {
            this.liquidationWarnings.set(user, {
                health_factor: healthFactor,
                warning_time: Date.now(),
                status: 'critical'
            });

            this.emit('liquidation:warning', {
                user,
                health_factor: healthFactor,
                total_collateral_usd: totalCollateralUSD,
                total_debt_usd: totalDebtUSD
            });
        } else if (this.liquidationWarnings.has(user)) {
            this.liquidationWarnings.delete(user);
        }

        return healthFactor;
    }

    /**
     * Calculate Borrowing Power
     */
    async calculateBorrowingPower(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) {
            return { total_usd: 0, used_usd: 0, available_usd: 0 };
        }

        let totalBorrowingPowerUSD = 0;

        // Calculate borrowing power from collateral
        for (const [posId, position] of userPosition.supplies) {
            const assetPrice = this.getAssetPrice(position.asset);
            const assetConfig = this.config.supported_assets[position.asset];
            const borrowingPower = position.underlying_balance * assetPrice * assetConfig.ltv;
            totalBorrowingPowerUSD += borrowingPower;
        }

        const usedBorrowingPowerUSD = userPosition.total_debt_usd || 0;
        const availableBorrowingPowerUSD = Math.max(0, totalBorrowingPowerUSD - usedBorrowingPowerUSD);

        return {
            total_usd: totalBorrowingPowerUSD,
            used_usd: usedBorrowingPowerUSD,
            available_usd: availableBorrowingPowerUSD,
            usage_percentage: totalBorrowingPowerUSD > 0 ? (usedBorrowingPowerUSD / totalBorrowingPowerUSD) * 100 : 0
        };
    }

    // Helper Methods
    validateAsset(asset) {
        if (!this.config.supported_assets[asset]) {
            throw new Error(`Unsupported asset: ${asset}`);
        }
    }

    validateAmount(amount) {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            throw new Error(`Invalid amount: ${amount}`);
        }
    }

    getAssetPrice(asset) {
        // Mock prices - in real implementation would use price oracle
        const prices = {
            ETH: 2800 + (Math.random() - 0.5) * 100,
            USDC: 1,
            USDT: 1,
            WBTC: 65000 + (Math.random() - 0.5) * 1000
        };
        return prices[asset] || 1;
    }

    calculateSupplyAPY(asset) {
        // Mock APY calculation - in real implementation would get from Aave
        const baseRates = {
            ETH: 0.02 + Math.random() * 0.03,  // 2-5%
            USDC: 0.03 + Math.random() * 0.02, // 3-5%
            USDT: 0.03 + Math.random() * 0.02, // 3-5%
            WBTC: 0.01 + Math.random() * 0.02  // 1-3%
        };
        return baseRates[asset] || 0.02;
    }

    calculateBorrowRate(asset, rateMode) {
        // Mock borrow rate calculation
        const supplyRate = this.calculateSupplyAPY(asset);
        const spread = rateMode === 1 ? 0.02 : 0.015; // Stable rate has higher spread
        return supplyRate + spread + (Math.random() * 0.01);
    }

    async calculateProjectedHealthFactor(user, operation) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) return 100;

        let collateralUSD = userPosition.total_collateral_usd;
        let debtUSD = userPosition.total_debt_usd;

        const assetPrice = this.getAssetPrice(operation.asset);
        const assetConfig = this.config.supported_assets[operation.asset];

        if (operation.type === 'withdraw') {
            const collateralReduction = operation.amount * assetPrice * assetConfig.liquidation_threshold;
            collateralUSD -= collateralReduction;
        } else if (operation.type === 'borrow') {
            const debtIncrease = operation.amount * assetPrice;
            debtUSD += debtIncrease;
        }

        return debtUSD > 0 ? collateralUSD / debtUSD : 100;
    }

    getHealthFactorStatus(healthFactor) {
        if (healthFactor < this.config.liquidation_threshold) return 'liquidation_risk';
        if (healthFactor < this.config.critical_health_factor) return 'critical';
        if (healthFactor < this.config.min_health_factor) return 'warning';
        if (healthFactor < 2) return 'moderate';
        return 'safe';
    }

    sanitizePosition(position) {
        // Return position without circular references for JSON serialization
        return {
            id: position.id,
            type: position.type,
            asset: position.asset,
            amount: position.amount,
            user: position.user,
            created_at: position.created_at,
            status: position.status,
            accrued_interest: position.accrued_interest,
            current_rate: position.current_rate || position.apy,
            underlying_balance: position.underlying_balance
        };
    }

    startPositionMonitoring(positionId) {
        // Position monitoring happens at the user level in this implementation
        // Individual position monitoring can be added if needed
    }

    stopPositionMonitoring(positionId) {
        // Cleanup position monitoring if implemented
    }

    /**
     * Get All User Positions 
     */
    getUserPositions(user) {
        const userPosition = this.userPositions.get(user);
        if (!userPosition) {
            return { supplies: [], borrows: [], health_factor: null };
        }

        return {
            supplies: Array.from(userPosition.supplies.values()).map(p => this.sanitizePosition(p)),
            borrows: Array.from(userPosition.borrows.values()).map(p => this.sanitizePosition(p)),
            health_factor: userPosition.health_factor,
            total_collateral_usd: userPosition.total_collateral_usd,
            total_debt_usd: userPosition.total_debt_usd
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
            total_supply_positions: this.lendingPositions.size,
            total_borrow_positions: this.borrowingPositions.size,
            analytics: this.analytics,
            risk_alerts: this.liquidationWarnings.size,
            config: {
                supported_assets: Object.keys(this.config.supported_assets),
                min_health_factor: this.config.min_health_factor,
                flash_loan_fee: this.config.flash_loan_fee
            }
        };
    }
}

module.exports = AaveV3Manager;