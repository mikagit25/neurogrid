/**
 * Aave V3 API Routes
 * Phase 4 DeFi Integration - Lending Protocol Endpoints
 */

const express = require('express');
const router = express.Router();

// Middleware for API response formatting
const apiResponse = (res, success, data = null, message = '', error = '') => {
    return res.json({
        success,
        data,
        message,
        error,
        timestamp: new Date().toISOString()
    });
};

/**
 * POST /api/v2/defi/aave-v3/supply
 * Supply assets to Aave V3 lending pool
 */
router.post('/supply', async (req, res) => {
    try {
        const { asset, amount, user, onBehalfOf } = req.body;

        if (!asset || !amount || !user) {
            return apiResponse(res, false, null, '', 'Missing required parameters: asset, amount, user');
        }

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const result = await aaveManager.supply({ asset, amount, user, onBehalfOf });
        apiResponse(res, true, result, `Successfully supplied ${amount} ${asset}`);

    } catch (error) {
        console.error('Error supplying to Aave V3:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/aave-v3/withdraw
 * Withdraw assets from Aave V3 lending pool
 */
router.post('/withdraw', async (req, res) => {
    try {
        const { asset, amount, user, to } = req.body;

        if (!asset || !amount || !user) {
            return apiResponse(res, false, null, '', 'Missing required parameters: asset, amount, user');
        }

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const result = await aaveManager.withdraw({ asset, amount, user, to });
        apiResponse(res, true, result, `Successfully withdrew ${amount} ${asset}`);

    } catch (error) {
        console.error('Error withdrawing from Aave V3:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/aave-v3/borrow
 * Borrow assets from Aave V3
 */
router.post('/borrow', async (req, res) => {
    try {
        const { asset, amount, user, interestRateMode = 2, onBehalfOf } = req.body;

        if (!asset || !amount || !user) {
            return apiResponse(res, false, null, '', 'Missing required parameters: asset, amount, user');
        }

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const result = await aaveManager.borrow({ 
            asset, 
            amount, 
            user, 
            interestRateMode, 
            onBehalfOf 
        });
        
        apiResponse(res, true, result, `Successfully borrowed ${amount} ${asset}`);

    } catch (error) {
        console.error('Error borrowing from Aave V3:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/aave-v3/repay
 * Repay borrowed assets to Aave V3
 */
router.post('/repay', async (req, res) => {
    try {
        const { asset, amount, user, rateMode, onBehalfOf } = req.body;

        if (!asset || !amount || !user) {
            return apiResponse(res, false, null, '', 'Missing required parameters: asset, amount, user');
        }

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const result = await aaveManager.repay({ asset, amount, user, rateMode, onBehalfOf });
        apiResponse(res, true, result, `Successfully repaid ${amount} ${asset}`);

    } catch (error) {
        console.error('Error repaying Aave V3 debt:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/aave-v3/health-factor/:user
 * Get user's health factor and risk metrics
 */
router.get('/health-factor/:user', async (req, res) => {
    try {
        const { user } = req.params;

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const healthFactor = await aaveManager.getHealthFactor(user);
        apiResponse(res, true, healthFactor, 'Health factor retrieved');

    } catch (error) {
        console.error('Error getting health factor:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/aave-v3/positions/:user
 * Get user's positions (supplies and borrows)
 */
router.get('/positions/:user', async (req, res) => {
    try {
        const { user } = req.params;

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const positions = aaveManager.getUserPositions(user);
        apiResponse(res, true, positions, 'User positions retrieved');

    } catch (error) {
        console.error('Error getting user positions:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/aave-v3/analytics
 * Get Aave V3 analytics and statistics
 */
router.get('/analytics', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const status = aaveManager.getStatus();
        
        // Enhanced analytics
        const analytics = {
            protocol_overview: {
                name: 'Aave V3',
                total_users: status.total_users,
                total_supply_positions: status.total_supply_positions,
                total_borrow_positions: status.total_borrow_positions,
                active_risk_alerts: status.risk_alerts
            },
            market_metrics: {
                total_supplied_usd: status.analytics.total_supplied * 2800, // Mock USD conversion
                total_borrowed_usd: status.analytics.total_borrowed * 2800,
                utilization_rate: status.analytics.total_borrowed / (status.analytics.total_supplied || 1),
                total_interest_earned: status.analytics.total_earned_interest,
                flash_loans_executed: status.analytics.flash_loans_executed,
                liquidations_prevented: status.analytics.liquidations_prevented
            },
            risk_management: {
                users_at_risk: status.risk_alerts,
                average_health_factor: status.total_users > 0 ? 2.5 : 0, // Mock calculation
                protocol_health: status.analytics.liquidations_prevented > 0 ? 'excellent' : 'good'
            },
            supported_assets: Object.keys(aaveManager.manager.config.supported_assets),
            protocol_config: {
                min_health_factor: status.config.min_health_factor,
                flash_loan_fee: status.config.flash_loan_fee
            }
        };

        apiResponse(res, true, {
            ...status,
            enhanced_analytics: analytics
        }, 'Aave V3 analytics retrieved');

    } catch (error) {
        console.error('Error getting Aave V3 analytics:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/aave-v3/supported-assets
 * Get list of supported assets with their configurations
 */
router.get('/supported-assets', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const supported = aaveManager.manager.config.supported_assets;
        const assets = Object.keys(supported).map(symbol => ({
            symbol,
            name: symbol === 'WBTC' ? 'Wrapped Bitcoin' : 
                  symbol === 'ETH' ? 'Ethereum' :
                  symbol === 'USDC' ? 'USD Coin' :
                  symbol === 'USDT' ? 'Tether USD' : symbol,
            ...supported[symbol],
            current_supply_apy: aaveManager.manager.calculateSupplyAPY(symbol),
            current_borrow_rate: aaveManager.manager.calculateBorrowRate(symbol, 2)
        }));

        apiResponse(res, true, {
            supported_assets: assets,
            total_assets: assets.length
        }, 'Supported assets retrieved');

    } catch (error) {
        console.error('Error getting supported assets:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/aave-v3/rates
 * Get current interest rates for all assets
 */
router.get('/rates', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const rates = {};
        const assets = Object.keys(aaveManager.manager.config.supported_assets);
        
        for (const asset of assets) {
            rates[asset] = {
                supply_apy: aaveManager.manager.calculateSupplyAPY(asset),
                variable_borrow_rate: aaveManager.manager.calculateBorrowRate(asset, 2),
                stable_borrow_rate: aaveManager.manager.calculateBorrowRate(asset, 1),
                current_price_usd: aaveManager.manager.getAssetPrice(asset)
            };
        }

        apiResponse(res, true, {
            rates,
            last_updated: new Date().toISOString(),
            rate_type: 'real_time'
        }, 'Current interest rates retrieved');

    } catch (error) {
        console.error('Error getting interest rates:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/aave-v3/simulate
 * Simulate operations without executing (for UI preview)
 */
router.post('/simulate', async (req, res) => {
    try {
        const { operation, asset, amount, user, interestRateMode } = req.body;

        if (!operation || !asset || !amount || !user) {
            return apiResponse(res, false, null, '', 'Missing required parameters: operation, asset, amount, user');
        }

        const phase4Manager = req.app.get('phase4Manager');
        const aaveManager = phase4Manager?.protocolManagers.get('aave_v3');
        
        if (!aaveManager) {
            return apiResponse(res, false, null, '', 'Aave V3 manager not available');
        }

        const simulation = {
            operation,
            asset,
            amount: parseFloat(amount),
            current_price: aaveManager.getAssetPrice(asset),
            estimated_gas_cost: Math.random() * 50 + 20, // Mock gas cost
        };

        if (operation === 'supply') {
            simulation.estimated_apy = aaveManager.calculateSupplyAPY(asset);
            simulation.yearly_earnings = parseFloat(amount) * simulation.estimated_apy;
        } else if (operation === 'borrow') {
            const currentHealthFactor = await aaveManager.getHealthFactor(user);
            const projectedHealthFactor = await aaveManager.manager.calculateProjectedHealthFactor(user, {
                type: 'borrow',
                asset,
                amount: parseFloat(amount)
            });
            
            simulation.interest_rate = aaveManager.calculateBorrowRate(asset, interestRateMode || 2);
            simulation.yearly_interest_cost = parseFloat(amount) * simulation.interest_rate;
            simulation.current_health_factor = currentHealthFactor.health_factor;
            simulation.projected_health_factor = projectedHealthFactor;
            simulation.health_factor_change = projectedHealthFactor - currentHealthFactor.health_factor;
        }

        apiResponse(res, true, simulation, 'Operation simulated successfully');

    } catch (error) {
        console.error('Error simulating operation:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

module.exports = router;