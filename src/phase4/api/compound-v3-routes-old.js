/**
 * Compound V3 API Routes
 * Phase 4 DeFi Integration - Money Market Protocol
 */

const express = require('express');
const router = express.Router();

// Supply assets to Compound V3
router.post('/supply', async (req, res) => {
    try {
        const { market, amount, user } = req.body;
        
        if (!market || !amount || !user) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: market, amount, user'
            });
        }

        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3')?.manager;
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const result = await compoundManager.supply({
            market,
            amount,
            user
        });

        res.json({
            success: true,
            data: result,
            message: `Successfully supplied ${amount} ${market} to Compound V3`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 supply error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to supply to Compound V3',
            error: error.message
        });
    }
});

// Withdraw assets from Compound V3
router.post('/withdraw', async (req, res) => {
    try {
        const { market, amount, user } = req.body;
        
        if (!market || !amount || !user) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: market, amount, user'
            });
        }

        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3');
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const result = await compoundManager.withdraw({
            market,
            amount,
            user
        });

        res.json({
            success: true,
            data: result,
            message: `Successfully withdrew ${result.amount_withdrawn} ${market} from Compound V3`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 withdraw error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to withdraw from Compound V3',
            error: error.message
        });
    }
});

// Claim COMP rewards
router.post('/claim-rewards/:user', async (req, res) => {
    try {
        const { user } = req.params;
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User parameter is required'
            });
        }

        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3');
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const result = await compoundManager.claimRewards(user);

        res.json({
            success: true,
            data: result,
            message: result.comp_rewards_claimed > 0 
                ? `Successfully claimed ${result.comp_rewards_claimed} COMP rewards`
                : 'No rewards available to claim',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 claim rewards error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to claim COMP rewards',
            error: error.message
        });
    }
});

// Get user positions
router.get('/positions/:user', async (req, res) => {
    try {
        const { user } = req.params;
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User parameter is required'
            });
        }

        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3');
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const positions = compoundManager.getUserPositions(user);

        res.json({
            success: true,
            data: positions,
            message: `Retrieved ${positions.supplies.length} Compound V3 positions for ${user}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 positions error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get user positions',
            error: error.message
        });
    }
});

// Get available markets
router.get('/markets', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3');
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const status = compoundManager.getStatus();
        
        const markets = {};
        for (const [market, config] of Object.entries(compoundManager.config.supported_markets)) {
            markets[market] = {
                market,
                base_token: config.base_token,
                decimals: config.decimals,
                supply_apy: config.supply_apy,
                utilization_target: config.utilization_target,
                collateral_factors: config.collateral_factors,
                current_supply_apy: compoundManager.calculateSupplyAPY(market),
                comp_reward_apy: compoundManager.calculateCOMPRewardAPY(market)
            };
        }

        res.json({
            success: true,
            data: {
                markets: markets,
                comp_price: compoundManager.getCOMPPrice(),
                total_markets: Object.keys(markets).length,
                analytics: status.analytics
            },
            message: 'Available Compound V3 markets',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 markets error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get markets',
            error: error.message
        });
    }
});

// Get analytics
router.get('/analytics', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3');
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const status = compoundManager.getStatus();
        
        res.json({
            success: true,
            data: {
                protocol: 'Compound V3',
                manager_id: status.managerId,
                analytics: status.analytics,
                config: status.config,
                comp_price: status.comp_price,
                total_users: status.total_users,
                total_positions: status.total_supply_positions,
                supported_markets: status.supported_markets
            },
            message: 'Compound V3 analytics and status',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get analytics',
            error: error.message
        });
    }
});

// Simulate supply operation
router.get('/simulate-supply', async (req, res) => {
    try {
        const { market, amount } = req.query;
        
        if (!market || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: market, amount'
            });
        }

        const phase4Manager = req.app.get('phase4Manager');
        const compoundManager = phase4Manager?.protocolManagers.get('compound_v3');
        
        if (!compoundManager) {
            return res.status(503).json({
                success: false,
                message: 'Compound V3 manager not available'
            });
        }

        const supplyAPY = compoundManager.calculateSupplyAPY(market);
        const compRewardAPY = compoundManager.calculateCOMPRewardAPY(market);
        const totalAPY = supplyAPY + compRewardAPY;
        
        const supplyAmount = parseFloat(amount);
        const assetPrice = compoundManager.getAssetPrice(market);
        const compPrice = compoundManager.getCOMPPrice();
        
        const projections = {
            '30_days': {
                interest_earned: supplyAmount * supplyAPY * (30/365),
                comp_rewards: (supplyAmount * compRewardAPY * (30/365)),
                total_earned: supplyAmount * totalAPY * (30/365),
                total_value: supplyAmount + (supplyAmount * totalAPY * (30/365))
            },
            '90_days': {
                interest_earned: supplyAmount * supplyAPY * (90/365),
                comp_rewards: (supplyAmount * compRewardAPY * (90/365)),
                total_earned: supplyAmount * totalAPY * (90/365),
                total_value: supplyAmount + (supplyAmount * totalAPY * (90/365))
            },
            '365_days': {
                interest_earned: supplyAmount * supplyAPY,
                comp_rewards: supplyAmount * compRewardAPY,
                total_earned: supplyAmount * totalAPY,
                total_value: supplyAmount + (supplyAmount * totalAPY)
            }
        };

        res.json({
            success: true,
            data: {
                market,
                supply_amount: supplyAmount,
                asset_price_usd: assetPrice,
                comp_price_usd: compPrice,
                apys: {
                    base_supply_apy: supplyAPY,
                    comp_reward_apy: compRewardAPY,
                    total_apy: totalAPY
                },
                projections,
                market_info: compoundManager.config.supported_markets[market]
            },
            message: `Supply simulation for ${amount} ${market}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compound V3 simulation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to simulate supply',
            error: error.message
        });
    }
});

module.exports = router;