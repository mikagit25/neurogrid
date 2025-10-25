const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/security');
const logger = require('../../utils/logger');

// Service instances (injected from main app)
let tokenEngine = null;
let nodeManager = null;
let authManager = null;

// Initialize services
const initializeServices = (services) => {
  tokenEngine = services.tokenEngine;
  nodeManager = services.nodeManager;
  authManager = services.authManager;
};

/**
 * @route GET /api/profile
 * @desc Get comprehensive user profile data
 * @access Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get basic user data
    const user = authManager.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get token balance and statistics
    let tokenData = { balance: 0, totalEarned: 0, totalSpent: 0, transactionCount: 0 };
    if (tokenEngine) {
      const account = tokenEngine.getAccount(userId);
      if (account) {
        tokenData = {
          balance: account.balance,
          totalEarned: account.totalEarned,
          totalSpent: account.totalSpent,
          transactionCount: account.transactionCount
        };
      }
    }

    // Get node statistics
    let nodeData = null;
    if (nodeManager) {
      const nodes = nodeManager.getUserNodes(userId);
      if (nodes && nodes.length > 0) {
        const node = nodes[0]; // Get first node
        nodeData = {
          nodeId: node.id,
          status: node.status,
          uptime: node.uptime || 0,
          tasksCompleted: node.tasksCompleted || 0,
          rating: node.rating || 0.0,
          earnings: node.totalEarnings || 0
        };
      }
    }

    // Calculate user level and XP (mock implementation)
    const xp = Math.floor(tokenData.totalEarned * 10 + (tokenData.transactionCount * 50));
    const level = Math.floor(xp / 1000) + 1;
    const rating = nodeData ? nodeData.rating : (4.0 + Math.random());

    // Compile profile data
    const profileData = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        status: user.status || 'active',
        role: user.role || 'user'
      },
      stats: {
        level,
        xp,
        rating: Number(rating.toFixed(1)),
        tasksCompleted: (nodeData?.tasksCompleted || 0) + Math.floor(tokenData.transactionCount / 2),
        successRate: 95 + Math.floor(Math.random() * 5), // Mock success rate
        totalEarned: tokenData.totalEarned,
        totalSpent: tokenData.totalSpent,
        balance: tokenData.balance,
        transactionCount: tokenData.transactionCount
      },
      node: nodeData,
      achievements: generateAchievements(tokenData, nodeData, level),
      preferences: {
        timezone: user.timezone || 'Europe/Moscow',
        notifications: {
          email: user.emailNotifications !== false,
          tasks: user.taskNotifications !== false,
          payments: user.paymentNotifications !== false
        }
      }
    };

    res.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile data'
    });
  }
});

/**
 * @route PUT /api/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Validate allowed updates
    const allowedUpdates = ['displayName', 'timezone', 'emailNotifications', 'taskNotifications', 'paymentNotifications'];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    // Update user
    const updatedUser = authManager.updateUser(userId, filteredUpdates);

    res.json({
      success: true,
      data: {
        user: authManager.sanitizeUser(updatedUser)
      },
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * @route GET /api/profile/activity
 * @desc Get user activity history
 * @access Private
 */
router.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, type } = req.query;

    let activities = [];

    // Get transaction history
    if (tokenEngine) {
      const transactions = tokenEngine.getTransactionHistory(userId, limit);
      activities = activities.concat(transactions.map(tx => ({
        id: tx.id,
        type: 'transaction',
        subtype: tx.type,
        description: tx.description,
        amount: tx.amount,
        timestamp: tx.timestamp,
        metadata: {
          currency: tx.currency || 'NGRID',
          status: tx.status || 'completed'
        }
      })));
    }

    // Get node activities (mock)
    if (nodeManager) {
      const nodeActivities = [
        {
          id: 'node_001',
          type: 'node',
          subtype: 'connected',
          description: 'Узел подключен к сети',
          timestamp: new Date(Date.now() - 86400000),
          metadata: { status: 'completed' }
        },
        {
          id: 'node_002',
          type: 'node',
          subtype: 'task_completed',
          description: 'Выполнена задача на узле',
          timestamp: new Date(Date.now() - 3600000),
          metadata: { status: 'completed', reward: 5.75 }
        }
      ];
      activities = activities.concat(nodeActivities);
    }

    // Filter by type if specified
    if (type && type !== 'all') {
      activities = activities.filter(activity => activity.type === type);
    }

    // Sort by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    activities = activities.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length
      }
    });

  } catch (error) {
    logger.error('Error getting user activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity history'
    });
  }
});

/**
 * @route GET /api/profile/stats
 * @desc Get detailed user statistics
 * @access Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
    }

    // Get token statistics
    let tokenStats = {
      balance: 0,
      earned: 0,
      spent: 0,
      transactions: 0
    };

    if (tokenEngine) {
      const account = tokenEngine.getAccount(userId);
      if (account) {
        tokenStats = {
          balance: account.balance,
          earned: account.totalEarned,
          spent: account.totalSpent,
          transactions: account.transactionCount
        };
      }
    }

    // Generate daily activity data (mock)
    const dailyData = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dailyData.push({
        date: new Date(d).toISOString().split('T')[0],
        tasks: Math.floor(Math.random() * 5),
        earned: Math.random() * 10,
        spent: Math.random() * 5
      });
    }

    // Calculate period statistics
    const periodStats = {
      totalTasks: dailyData.reduce((sum, day) => sum + day.tasks, 0),
      totalEarned: dailyData.reduce((sum, day) => sum + day.earned, 0),
      totalSpent: dailyData.reduce((sum, day) => sum + day.spent, 0),
      avgTasksPerDay: dailyData.reduce((sum, day) => sum + day.tasks, 0) / dailyData.length,
      avgEarningsPerDay: dailyData.reduce((sum, day) => sum + day.earned, 0) / dailyData.length
    };

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        current: tokenStats,
        period: periodStats,
        daily: dailyData
      }
    });

  } catch (error) {
    logger.error('Error getting user statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

/**
 * @route POST /api/profile/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }

    // Verify current password
    const user = authManager.getUserById(userId);
    if (!authManager.verifyPassword(currentPassword, user.password)) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    const hashedNewPassword = authManager.hashPassword(newPassword);
    authManager.updateUser(userId, { password: hashedNewPassword });

    // Invalidate all sessions except current
    authManager.invalidateUserSessions(userId, req.sessionId);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

/**
 * @route POST /api/profile/regenerate-api-key
 * @desc Regenerate user API key
 * @access Private
 */
router.post('/regenerate-api-key', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate new API key
    const newApiKey = authManager.generateApiKey();

    // Update user with new API key
    authManager.updateUser(userId, { apiKey: newApiKey });

    res.json({
      success: true,
      data: {
        apiKey: newApiKey
      },
      message: 'API key regenerated successfully'
    });

  } catch (error) {
    logger.error('Error regenerating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate API key'
    });
  }
});

// Helper function to generate achievements
function generateAchievements(tokenData, nodeData, level) {
  const achievements = [];

  // First task achievement
  if (tokenData.transactionCount > 0) {
    achievements.push({
      id: 'first_task',
      name: 'Первые шаги',
      description: 'Выполните первую задачу',
      icon: 'fa-baby',
      earned: true,
      earnedAt: new Date(Date.now() - 86400000 * 7) // 7 days ago
    });
  }

  // Task master achievement
  if (tokenData.transactionCount >= 10) {
    achievements.push({
      id: 'task_master',
      name: 'Мастер задач',
      description: 'Выполните 10 задач',
      icon: 'fa-tasks',
      earned: true,
      earnedAt: new Date(Date.now() - 86400000 * 3) // 3 days ago
    });
  }

  // Node operator achievement
  if (nodeData) {
    achievements.push({
      id: 'node_operator',
      name: 'Оператор узла',
      description: 'Настройте свой первый узел',
      icon: 'fa-server',
      earned: true,
      earnedAt: new Date(Date.now() - 86400000 * 2) // 2 days ago
    });
  }

  // High rating achievement
  if (nodeData && nodeData.rating >= 4.5) {
    achievements.push({
      id: 'high_rating',
      name: 'Высокий рейтинг',
      description: 'Достигните рейтинга 4.5',
      icon: 'fa-star',
      earned: true,
      earnedAt: new Date(Date.now() - 86400000) // 1 day ago
    });
  } else {
    achievements.push({
      id: 'high_rating',
      name: 'Высокий рейтинг',
      description: 'Достигните рейтинга 4.5',
      icon: 'fa-star',
      earned: false
    });
  }

  // Big earner achievement
  if (tokenData.totalEarned >= 1000) {
    achievements.push({
      id: 'big_earner',
      name: 'Большой заработок',
      description: 'Заработайте 1000 NGRID',
      icon: 'fa-money-bill-wave',
      earned: true,
      earnedAt: new Date(Date.now() - 86400000) // 1 day ago
    });
  } else {
    achievements.push({
      id: 'big_earner',
      name: 'Большой заработок',
      description: 'Заработайте 1000 NGRID',
      icon: 'fa-money-bill-wave',
      earned: false,
      progress: Math.floor((tokenData.totalEarned / 1000) * 100)
    });
  }

  // Level achievements
  if (level >= 5) {
    achievements.push({
      id: 'level_master',
      name: 'Мастер уровня',
      description: 'Достигните 5 уровня',
      icon: 'fa-trophy',
      earned: true,
      earnedAt: new Date(Date.now() - 86400000) // 1 day ago
    });
  }

  return achievements;
}

// Export router and initialization function
module.exports = {
  router,
  initializeServices
};
