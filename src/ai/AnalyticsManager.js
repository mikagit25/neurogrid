/**
 * Analytics Manager - Real-time analytics and leaderboards
 * Provides insights, trends, and competitive features
 */

const fs = require('fs');
const path = require('path');

class AnalyticsManager {
    constructor(modelManager, reviewManager, socialManager, neuroEconomy) {
        this.modelManager = modelManager;
        this.reviewManager = reviewManager;
        this.socialManager = socialManager;
        this.neuroEconomy = neuroEconomy;
        
        this.analyticsFile = path.join(__dirname, '../data/analytics.json');
        
        // In-memory analytics cache
        this.trends = new Map(); // trend_name -> data
        this.leaderboards = new Map(); // category -> rankings
        this.insights = new Map(); // insight_type -> data
        
        console.log('📊 Analytics Manager initialized');
        this.initializeAnalytics();
        
        // Update analytics every 5 minutes
        this.analyticsInterval = setInterval(() => this.updateAnalytics(), 300000);
    }

    /**
     * Initialize analytics system
     */
    initializeAnalytics() {
        this.updateAnalytics();
        console.log('📈 Real-time analytics started');
    }

    /**
     * Update all analytics data
     */
    updateAnalytics() {
        try {
            this.generateModelLeaderboard();
            this.analyzeUserTrends();
            this.calculateCommunityInsights();
            this.generatePopularityTrends();
            
            console.log('📊 Analytics updated successfully');
        } catch (error) {
            console.error('❌ Analytics update error:', error);
        }
    }

    /**
     * Generate model leaderboard
     */
    generateModelLeaderboard() {
        console.log('🔍 Debug: Starting generateModelLeaderboard...');
        console.log('🔍 Debug: modelManager type:', typeof this.modelManager);
        
        const modelsData = this.modelManager.getModels({ limit: 100 });
        console.log('🔍 Debug: modelsData type:', typeof modelsData);
        console.log('🔍 Debug: modelsData isArray:', Array.isArray(modelsData));
        console.log('🔍 Debug: modelsData first 200 chars:', JSON.stringify(modelsData).substring(0, 200));
        
        // Check if modelsData is directly the array or has a data property
        const models = Array.isArray(modelsData) ? modelsData : (modelsData && modelsData.data) ? modelsData.data : [];
        console.log('🔍 Debug: models array length:', models.length);
        console.log('🔍 Debug: models isArray:', Array.isArray(models));
        console.log('🔍 Debug: first model:', models[0] ? JSON.stringify(models[0], null, 2).substring(0, 200) : 'none');
        
        if (models.length === 0) {
            console.log('📊 No models found for leaderboard generation');
            return;
        }
        
        // Income leaderboard
        const incomeLeaderboard = models
            .map(model => ({
                id: model.id,
                name: model.name,
                author: model.author,
                total_income: model.earnings || 0,
                downloads: model.downloads,
                rating: model.rating,
                usage_trend: this.calculateUsageTrend(model.id)
            }))
            .sort((a, b) => b.total_income - a.total_income)
            .slice(0, 10);

        this.leaderboards.set('income', {
            title: 'Top Earning Models',
            updated_at: new Date().toISOString(),
            rankings: incomeLeaderboard
        });

        // Popularity leaderboard (downloads + rating)
        const popularityLeaderboard = models
            .map(model => {
                const popularity_score = (model.downloads * 0.7) + (model.rating * model.reviews_count * 100);
                return {
                    id: model.id,
                    name: model.name,
                    author: model.author,
                    popularity_score: Math.round(popularity_score),
                    downloads: model.downloads,
                    rating: model.rating,
                    reviews: model.reviews_count
                };
            })
            .sort((a, b) => b.popularity_score - a.popularity_score)
            .slice(0, 10);

        this.leaderboards.set('popularity', {
            title: 'Most Popular Models',
            updated_at: new Date().toISOString(),
            rankings: popularityLeaderboard
        });

        // Quality leaderboard (rating-focused)
        const qualityLeaderboard = models
            .filter(model => model.reviews_count >= 1) // Only models with reviews
            .map(model => ({
                id: model.id,
                name: model.name,
                author: model.author,
                rating: model.rating,
                reviews_count: model.reviews_count,
                quality_score: model.rating * Math.log(model.reviews_count + 1) // Weighted by review count
            }))
            .sort((a, b) => b.quality_score - a.quality_score)
            .slice(0, 10);

        this.leaderboards.set('quality', {
            title: 'Highest Quality Models',
            updated_at: new Date().toISOString(),
            rankings: qualityLeaderboard
        });
    }

    /**
     * Calculate usage trend for a model
     */
    calculateUsageTrend(modelId) {
        // Mock trend calculation - in real system would use transaction history
        const recentTransactions = this.neuroEconomy.getUserTransactions('system', 100)
            .filter(tx => tx.model_id === modelId && tx.type === 'model_usage');
        
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        
        const todayUsage = recentTransactions.filter(tx => new Date(tx.timestamp) > yesterday).length;
        const yesterdayUsage = recentTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            return txDate > new Date(yesterday.getTime() - 24 * 60 * 60 * 1000) && txDate <= yesterday;
        }).length;

        if (yesterdayUsage === 0) return todayUsage > 0 ? 'up' : 'stable';
        
        const trend = (todayUsage - yesterdayUsage) / yesterdayUsage;
        return trend > 0.1 ? 'up' : trend < -0.1 ? 'down' : 'stable';
    }

    /**
     * Analyze user trends
     */
    analyzeUserTrends() {
        const economyStats = this.neuroEconomy.getEconomyStats();
        const socialStats = this.socialManager.getSocialStats();
        
        const userTrends = {
            total_users: economyStats.total_users,
            active_social_users: socialStats.active_users,
            average_balance: economyStats.average_balance,
            staking_participation: economyStats.staking_participation,
            social_engagement: this.calculateSocialEngagement(),
            growth_metrics: {
                daily_new_users: 2, // Mock data
                weekly_retention: '78%',
                monthly_active_users: economyStats.total_users
            }
        };

        this.trends.set('users', {
            title: 'User Trends',
            updated_at: new Date().toISOString(),
            data: userTrends
        });
    }

    /**
     * Calculate social engagement metrics
     */
    calculateSocialEngagement() {
        const socialStats = this.socialManager.getSocialStats();
        
        return {
            engagement_rate: Math.round((socialStats.total_messages / Math.max(socialStats.active_users, 1)) * 100) / 100,
            average_likes_per_content: Math.round((socialStats.total_likes / Math.max(socialStats.gallery_images + socialStats.total_messages, 1)) * 100) / 100,
            content_creation_rate: Math.round(((socialStats.gallery_images + socialStats.public_chats) / Math.max(socialStats.active_users, 1)) * 100) / 100
        };
    }

    /**
     * Calculate community insights
     */
    calculateCommunityInsights() {
        const chats = this.socialManager.getPublicChats({ limit: 50 });
        const gallery = this.socialManager.getImageGallery({ limit: 100 });
        
        // Trending topics analysis
        const trendingTags = new Map();
        
        // Analyze chat tags
        chats.chats.forEach(chat => {
            chat.tags.forEach(tag => {
                trendingTags.set(tag, (trendingTags.get(tag) || 0) + chat.participants);
            });
        });

        // Analyze gallery tags
        gallery.images.forEach(image => {
            image.tags.forEach(tag => {
                trendingTags.set(tag, (trendingTags.get(tag) || 0) + (image.likes + image.views * 0.1));
            });
        });

        const topTags = Array.from(trendingTags.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, score]) => ({ tag, score: Math.round(score) }));

        // Content insights
        const contentInsights = {
            trending_tags: topTags,
            most_active_chat: chats.chats.reduce((max, chat) => 
                chat.participants > (max.participants || 0) ? chat : max, {}),
            content_diversity: this.calculateContentDiversity(chats.chats, gallery.images),
            community_health: this.calculateCommunityHealth()
        };

        this.insights.set('community', {
            title: 'Community Insights',
            updated_at: new Date().toISOString(),
            data: contentInsights
        });
    }

    /**
     * Calculate content diversity score
     */
    calculateContentDiversity(chats, images) {
        const allTags = new Set();
        
        chats.forEach(chat => chat.tags.forEach(tag => allTags.add(tag)));
        images.forEach(image => image.tags.forEach(tag => allTags.add(tag)));
        
        return {
            unique_tags: allTags.size,
            content_types: chats.length + images.length,
            diversity_score: Math.min(100, Math.round((allTags.size / Math.max(chats.length + images.length, 1)) * 50))
        };
    }

    /**
     * Calculate community health metrics
     */
    calculateCommunityHealth() {
        const socialStats = this.socialManager.getSocialStats();
        const economyStats = this.neuroEconomy.getEconomyStats();
        
        // Health factors (0-100)
        const contentActivity = Math.min(100, socialStats.total_messages * 2); // 50 messages = 100%
        const economicActivity = Math.min(100, economyStats.total_transactions * 5); // 20 transactions = 100%  
        const userEngagement = Math.min(100, socialStats.total_likes * 1.3); // 77 likes ≈ 100%
        const platformUsage = Math.min(100, economyStats.staking_participation.replace('%', '') * 5); // 20% = 100%
        
        const overallHealth = Math.round((contentActivity + economicActivity + userEngagement + parseFloat(platformUsage)) / 4);
        
        return {
            overall_score: overallHealth,
            content_activity: Math.round(contentActivity),
            economic_activity: Math.round(economicActivity),
            user_engagement: Math.round(userEngagement),
            platform_usage: Math.round(parseFloat(platformUsage)),
            status: overallHealth > 80 ? 'excellent' : overallHealth > 60 ? 'good' : overallHealth > 40 ? 'fair' : 'needs_attention'
        };
    }

    /**
     * Generate popularity trends
     */
    generatePopularityTrends() {
        const modelsData = this.modelManager.getModels({ limit: 10 });
        const models = (modelsData && modelsData.data) ? modelsData.data : [];
        const socialStats = this.socialManager.getSocialStats();
        const economyStats = this.neuroEconomy.getEconomyStats();

        const trends = {
            model_trends: {
                total_models: modelsData.total || 0,
                trending_categories: this.getTrendingCategories(models),
                growth_rate: '+12%' // Mock data
            },
            social_trends: {
                chat_growth: `+${socialStats.public_chats - 2}` || '+1', // Compared to initial 2
                gallery_activity: socialStats.gallery_images > 0 ? 'active' : 'starting',
                engagement_trend: 'up'
            },
            economic_trends: {
                token_velocity: Math.round((economyStats.total_transactions / economyStats.total_users) * 100) / 100,
                staking_growth: economyStats.staking_participation,
                platform_revenue: '12.5 NEURO' // Mock data
            }
        };

        this.trends.set('popularity', {
            title: 'Platform Trends',
            updated_at: new Date().toISOString(),
            data: trends
        });
    }

    /**
     * Get trending model categories
     */
    getTrendingCategories(models) {
        const categories = new Map();
        
        models.forEach(model => {
            const category = model.type || 'other';
            categories.set(category, (categories.get(category) || 0) + model.downloads);
        });

        return Array.from(categories.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([category, downloads]) => ({ category, downloads }));
    }

    /**
     * Get comprehensive analytics dashboard
     */
    getAnalyticsDashboard() {
        return {
            leaderboards: Object.fromEntries(this.leaderboards),
            trends: Object.fromEntries(this.trends),
            insights: Object.fromEntries(this.insights),
            generated_at: new Date().toISOString(),
            next_update: new Date(Date.now() + 300000).toISOString() // 5 minutes
        };
    }

    /**
     * Get specific leaderboard
     */
    getLeaderboard(category) {
        return this.leaderboards.get(category) || null;
    }

    /**
     * Get trending data
     */
    getTrends(type) {
        return this.trends.get(type) || null;
    }

    /**
     * Get community insights
     */
    getInsights(type) {
        return this.insights.get(type) || null;
    }

    /**
     * Generate achievements for users based on activity
     */
    generateUserAchievements(userId) {
        const achievements = [];
        
        // Check staking achievements
        const stakingInfo = this.neuroEconomy.getUserStaking(userId);
        if (stakingInfo.total_staked > 50) {
            achievements.push({
                id: 'big_staker',
                title: 'Big Staker',
                description: 'Staked more than 50 NEURO',
                icon: '🎯',
                earned_at: new Date().toISOString()
            });
        }

        // Check transaction achievements  
        const transactions = this.neuroEconomy.getUserTransactions(userId, 50);
        if (transactions.length > 10) {
            achievements.push({
                id: 'active_trader',
                title: 'Active Trader', 
                description: 'Completed more than 10 transactions',
                icon: '💰',
                earned_at: new Date().toISOString()
            });  
        }

        return achievements;
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        if (this.analyticsInterval) {
            clearInterval(this.analyticsInterval);
        }
        console.log('📊 Analytics Manager destroyed');
    }
}

module.exports = AnalyticsManager;