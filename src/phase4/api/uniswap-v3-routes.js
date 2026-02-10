/**
 * Uniswap V3 API Routes
 * Phase 4 DeFi Integration - Advanced Liquidity Management Endpoints
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
 * POST /api/v2/defi/uniswap-v3/positions
 * Create new Uniswap V3 liquidity position
 */
router.post('/positions', async (req, res) => {
    try {
        const {
            tokenA,
            tokenB,
            fee,
            amount0,
            amount1,
            tickLower,
            tickUpper,
            slippage
        } = req.body;

        // Validate required parameters
        if (!tokenA || !tokenB || !fee || !amount0 || !amount1) {
            return apiResponse(res, false, null, '', 'Missing required parameters');
        }

        // Get Phase 4 manager
        const phase4Manager = req.app.get('phase4Manager');
        if (!phase4Manager) {
            return apiResponse(res, false, null, '', 'Phase 4 DeFi system not initialized');
        }

        const uniswapManager = phase4Manager.protocolManagers.get('uniswap_v3');
        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        // Create position
        const result = await uniswapManager.createPosition({
            tokenA,
            tokenB,
            fee,
            amount0,
            amount1,
            tickLower,
            tickUpper,
            slippage
        });

        apiResponse(res, true, result, 'Uniswap V3 position created successfully');

    } catch (error) {
        console.error('Error creating Uniswap V3 position:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * DELETE /api/v2/defi/uniswap-v3/positions/:positionId
 * Remove Uniswap V3 liquidity position
 */
router.delete('/positions/:positionId', async (req, res) => {
    try {
        const { positionId } = req.params;

        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const result = await uniswapManager.removePosition(positionId);
        apiResponse(res, true, result, 'Position removed successfully');

    } catch (error) {
        console.error('Error removing Uniswap V3 position:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/uniswap-v3/positions/:positionId/rebalance
 * Rebalance Uniswap V3 position with new price range
 */
router.post('/positions/:positionId/rebalance', async (req, res) => {
    try {
        const { positionId } = req.params;
        const { tickLower, tickUpper } = req.body;

        if (!tickLower || !tickUpper) {
            return apiResponse(res, false, null, '', 'Missing tick range parameters');
        }

        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const result = await uniswapManager.rebalancePosition(positionId, {
            lower: tickLower,
            upper: tickUpper
        });

        apiResponse(res, true, result, 'Position rebalanced successfully');

    } catch (error) {
        console.error('Error rebalancing position:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/uniswap-v3/positions/:positionId/collect-fees
 * Collect fees from Uniswap V3 position
 */
router.post('/positions/:positionId/collect-fees', async (req, res) => {
    try {
        const { positionId } = req.params;

        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const result = await uniswapManager.collectFees(positionId);
        apiResponse(res, true, result, 'Fees collected successfully');

    } catch (error) {
        console.error('Error collecting fees:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/uniswap-v3/positions/:positionId/performance
 * Get position performance analytics
 */
router.get('/positions/:positionId/performance', async (req, res) => {
    try {
        const { positionId } = req.params;

        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const performance = await uniswapManager.getPositionPerformance(positionId);
        apiResponse(res, true, performance, 'Position performance retrieved');

    } catch (error) {
        console.error('Error getting position performance:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/uniswap-v3/positions
 * Get all active Uniswap V3 positions
 */
router.get('/positions', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const positions = uniswapManager.getAllPositions();
        apiResponse(res, true, {
            positions,
            count: positions.length,
            status: uniswapManager.getStatus()
        }, 'Active positions retrieved');

    } catch (error) {
        console.error('Error getting positions:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * POST /api/v2/defi/uniswap-v3/auto-rebalance
 * Trigger auto-rebalancing for all positions
 */
router.post('/auto-rebalance', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const result = await uniswapManager.autoRebalance();
        apiResponse(res, true, result, `Auto-rebalance completed: ${result.rebalanced_count} positions rebalanced`);

    } catch (error) {
        console.error('Error during auto-rebalance:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/uniswap-v3/analytics
 * Get Uniswap V3 analytics and statistics
 */
router.get('/analytics', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const status = uniswapManager.getStatus();
        const positions = uniswapManager.getAllPositions();

        // Calculate additional analytics
        const analytics = {
            overview: {
                total_positions: positions.length,
                total_liquidity: status.total_liquidity,
                total_fees_earned: status.total_fees_earned,
                active_pairs: [...new Set(positions.map(p => `${p.tokenA}/${p.tokenB}`))].length
            },
            performance: {
                positions_in_range: positions.filter(p => p.in_range).length,
                positions_out_of_range: positions.filter(p => !p.in_range).length,
                average_fees_apy: positions.length > 0
                    ? positions.reduce((sum, p) => sum + (p.fees_earned.token0 + p.fees_earned.token1), 0) / positions.length
                    : 0,
                total_impermanent_loss: positions.reduce((sum, p) => sum + (p.impermanent_loss || 0), 0)
            },
            risk: {
                max_position_size: Math.max(...positions.map(p => p.amount0 + p.amount1), 0),
                diversification_ratio: positions.length > 0 ? [...new Set(positions.map(p => `${p.tokenA}/${p.tokenB}`))].length / positions.length : 0,
                out_of_range_percentage: positions.length > 0 ? (positions.filter(p => !p.in_range).length / positions.length) * 100 : 0
            }
        };

        apiResponse(res, true, {
            ...status,
            detailed_analytics: analytics,
            positions_summary: positions.map(p => ({
                id: p.id,
                pair: `${p.tokenA}/${p.tokenB}`,
                fee_tier: `${p.fee / 100}bps`,
                in_range: p.in_range,
                fees_earned_usd: p.fees_earned.token0 + p.fees_earned.token1,
                duration_hours: (Date.now() - p.created_at) / (1000 * 60 * 60)
            }))
        }, 'Uniswap V3 analytics retrieved');

    } catch (error) {
        console.error('Error getting Uniswap V3 analytics:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

/**
 * GET /api/v2/defi/uniswap-v3/fee-tiers
 * Get available fee tiers and their current usage
 */
router.get('/fee-tiers', async (req, res) => {
    try {
        const phase4Manager = req.app.get('phase4Manager');
        const uniswapManager = phase4Manager?.protocolManagers.get('uniswap_v3');

        if (!uniswapManager) {
            return apiResponse(res, false, null, '', 'Uniswap V3 manager not available');
        }

        const positions = uniswapManager.getAllPositions();
        const feeTiers = [
            { fee: 100, percentage: 0.01, description: 'Stable pairs', count: positions.filter(p => p.fee === 100).length },
            { fee: 500, percentage: 0.05, description: 'Low volatility', count: positions.filter(p => p.fee === 500).length },
            { fee: 3000, percentage: 0.30, description: 'Standard pairs', count: positions.filter(p => p.fee === 3000).length },
            { fee: 10000, percentage: 1.00, description: 'Exotic pairs', count: positions.filter(p => p.fee === 10000).length }
        ];

        apiResponse(res, true, {
            fee_tiers: feeTiers,
            most_popular: feeTiers.reduce((max, tier) => tier.count > max.count ? tier : max),
            total_positions: positions.length
        }, 'Fee tiers information retrieved');

    } catch (error) {
        console.error('Error getting fee tiers:', error);
        apiResponse(res, false, null, '', error.message);
    }
});

module.exports = router;