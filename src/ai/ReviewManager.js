/**
 * Review Manager - System for managing model reviews and ratings
 * Enables users to rate models and leave detailed reviews
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ReviewManager {
    constructor(modelManager) {
        this.modelManager = modelManager;
        this.reviewsDir = path.join(__dirname, '../data/reviews');
        this.reviewsFile = path.join(__dirname, '../data/reviews.json');
        this.reviews = new Map(); // modelId -> reviews[]
        this.userRatings = new Map(); // userId+modelId -> rating

        console.log('⭐ Review Manager initialized');
        this.ensureDirectories();
        this.loadReviews();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [this.reviewsDir, path.dirname(this.reviewsFile)];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    /**
     * Load reviews from storage
     */
    loadReviews() {
        try {
            if (fs.existsSync(this.reviewsFile)) {
                const data = JSON.parse(fs.readFileSync(this.reviewsFile, 'utf8'));

                // Initialize reviews map
                data.reviews.forEach(review => {
                    if (!this.reviews.has(review.model_id)) {
                        this.reviews.set(review.model_id, []);
                    }
                    this.reviews.get(review.model_id).push(review);
                });

                // Initialize user ratings
                data.user_ratings.forEach(rating => {
                    const key = `${rating.user_id}_${rating.model_id}`;
                    this.userRatings.set(key, rating.rating);
                });

                console.log(`📊 Loaded ${data.reviews.length} reviews for ${this.reviews.size} models`);
            } else {
                this.initializeDefaultReviews();
            }
        } catch (error) {
            console.error('❌ Error loading reviews:', error);
            this.initializeDefaultReviews();
        }
    }

    /**
     * Initialize with default reviews for demo
     */
    initializeDefaultReviews() {
        const defaultReviews = [
            // Reviews for Community Llama 2
            {
                id: this.generateReviewId(),
                model_id: 'community-llama2-finetuned',
                user_id: 'user_alice',
                user_name: 'Alice Developer',
                rating: 5,
                title: 'Excellent performance!',
                comment: 'This fine-tuned model significantly outperforms the base Llama 2. Great for conversational AI applications.',
                created_at: new Date('2026-01-20').toISOString(),
                helpful_count: 24,
                verified_purchase: true,
                tags: ['performance', 'conversation'],
                response_from_author: null
            },
            {
                id: this.generateReviewId(),
                model_id: 'community-llama2-finetuned',
                user_id: 'user_bob',
                user_name: 'Bob AI-Researcher',
                rating: 4,
                title: 'Good but resource-heavy',
                comment: 'Quality is impressive, though it requires substantial GPU memory. Perfect for research projects.',
                created_at: new Date('2026-01-22').toISOString(),
                helpful_count: 15,
                verified_purchase: true,
                tags: ['quality', 'resources'],
                response_from_author: {
                    message: 'Thanks for the feedback! We\'re working on a lighter version.',
                    created_at: new Date('2026-01-23').toISOString()
                }
            },

            // Reviews for Artist's Stable Diffusion
            {
                id: this.generateReviewId(),
                model_id: 'artist-stable-diffusion',
                user_id: 'user_carol',
                user_name: 'Carol Artist',
                rating: 5,
                title: 'Amazing artistic style!',
                comment: 'Creates beautiful artwork with consistent style. The training on artistic data really shows. Highly recommended for creative projects.',
                created_at: new Date('2026-01-25').toISOString(),
                helpful_count: 31,
                verified_purchase: true,
                tags: ['artistic', 'creative', 'quality'],
                response_from_author: {
                    message: 'So glad you\'re enjoying it! Check out our upcoming portrait model.',
                    created_at: new Date('2026-01-26').toISOString()
                }
            },
            {
                id: this.generateReviewId(),
                model_id: 'artist-stable-diffusion',
                user_id: 'user_david',
                user_name: 'David Designer',
                rating: 4,
                title: 'Great for illustrations',
                comment: 'Perfect for commercial illustration work. Sometimes needs multiple generations to get the perfect result.',
                created_at: new Date('2026-01-28').toISOString(),
                helpful_count: 18,
                verified_purchase: false,
                tags: ['illustration', 'commercial'],
                response_from_author: null
            },

            // Reviews for CoderAssist 7B
            {
                id: this.generateReviewId(),
                model_id: 'coder-assist-7b',
                user_id: 'user_eve',
                user_name: 'Eve FullStack',
                rating: 4,
                title: 'Solid coding assistant',
                comment: 'Excellent for Python and JavaScript. Debugging suggestions are particularly helpful. Could use improvement in TypeScript.',
                created_at: new Date('2026-02-01').toISOString(),
                helpful_count: 12,
                verified_purchase: true,
                tags: ['coding', 'python', 'javascript', 'debugging'],
                response_from_author: {
                    message: 'TypeScript support is coming in v1.4! Thanks for the feedback.',
                    created_at: new Date('2026-02-02').toISOString()
                }
            }
        ];

        // Store reviews
        defaultReviews.forEach(review => {
            if (!this.reviews.has(review.model_id)) {
                this.reviews.set(review.model_id, []);
            }
            this.reviews.get(review.model_id).push(review);

            // Store user rating
            const key = `${review.user_id}_${review.model_id}`;
            this.userRatings.set(key, review.rating);
        });

        this.saveReviews();
        this.updateModelRatings();
        console.log(`⭐ Initialized ${defaultReviews.length} default reviews`);
    }

    /**
     * Generate unique review ID
     */
    generateReviewId() {
        return 'review_' + crypto.randomBytes(8).toString('hex');
    }

    /**
     * Add a new review
     */
    async addReview(reviewData, userId, userName) {
        try {
            // Validation
            const errors = this.validateReview(reviewData);
            if (errors.length > 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    details: errors
                };
            }

            // Check if model exists
            const model = this.modelManager.getModel(reviewData.model_id);
            if (!model) {
                return {
                    success: false,
                    error: 'Model not found'
                };
            }

            // Check if user already reviewed this model
            const userKey = `${userId}_${reviewData.model_id}`;
            if (this.userRatings.has(userKey)) {
                return {
                    success: false,
                    error: 'You have already reviewed this model'
                };
            }

            // Create review
            const review = {
                id: this.generateReviewId(),
                model_id: reviewData.model_id,
                user_id: userId,
                user_name: userName,
                rating: reviewData.rating,
                title: reviewData.title,
                comment: reviewData.comment,
                created_at: new Date().toISOString(),
                helpful_count: 0,
                verified_purchase: reviewData.verified_purchase || false,
                tags: reviewData.tags || [],
                response_from_author: null
            };

            // Store review
            if (!this.reviews.has(reviewData.model_id)) {
                this.reviews.set(reviewData.model_id, []);
            }
            this.reviews.get(reviewData.model_id).push(review);

            // Store user rating
            this.userRatings.set(userKey, review.rating);

            // Update model's average rating
            this.updateModelRatings();
            this.saveReviews();

            console.log(`⭐ New review added for model ${reviewData.model_id} by ${userName}`);

            return {
                success: true,
                review_id: review.id,
                message: 'Review added successfully',
                data: review
            };

        } catch (error) {
            console.error('❌ Error adding review:', error);
            return {
                success: false,
                error: 'Internal server error',
                details: error.message
            };
        }
    }

    /**
     * Validate review data
     */
    validateReview(reviewData) {
        const errors = [];

        // Required fields
        const required = ['model_id', 'rating', 'title', 'comment'];
        required.forEach(field => {
            if (!reviewData[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        // Rating validation
        if (reviewData.rating && (reviewData.rating < 1 || reviewData.rating > 5)) {
            errors.push('Rating must be between 1 and 5');
        }

        // Title length
        if (reviewData.title && reviewData.title.length > 200) {
            errors.push('Title too long (max 200 characters)');
        }

        // Comment length
        if (reviewData.comment && reviewData.comment.length > 2000) {
            errors.push('Comment too long (max 2000 characters)');
        }

        return errors;
    }

    /**
     * Get reviews for a model
     */
    getModelReviews(modelId, options = {}) {
        const reviews = this.reviews.get(modelId) || [];

        // Apply sorting
        const sortBy = options.sortBy || 'created_at';
        const order = options.order || 'desc';

        let sorted = [...reviews];
        sorted.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'created_at') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }

            if (order === 'desc') {
                return bVal - aVal;
            } else {
                return aVal - bVal;
            }
        });

        // Apply pagination
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        return {
            reviews: sorted.slice(startIndex, endIndex),
            total: reviews.length,
            page: page,
            limit: limit,
            total_pages: Math.ceil(reviews.length / limit)
        };
    }

    /**
     * Get review statistics for a model
     */
    getModelReviewStats(modelId) {
        const reviews = this.reviews.get(modelId) || [];

        if (reviews.length === 0) {
            return {
                total_reviews: 0,
                average_rating: 0,
                rating_distribution: [0, 0, 0, 0, 0]
            };
        }

        const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        const ratingDistribution = [0, 0, 0, 0, 0];

        reviews.forEach(review => {
            ratingDistribution[review.rating - 1]++;
        });

        return {
            total_reviews: reviews.length,
            average_rating: Math.round(averageRating * 10) / 10,
            rating_distribution: ratingDistribution,
            recent_reviews: reviews
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 3)
        };
    }

    /**
     * Update model ratings in ModelManager
     */
    updateModelRatings() {
        for (const [modelId, reviews] of this.reviews.entries()) {
            if (reviews.length > 0) {
                const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                const model = this.modelManager.getModel(modelId);

                if (model) {
                    model.rating = Math.round(avgRating * 10) / 10;
                    model.reviews_count = reviews.length;
                    this.modelManager.models.set(modelId, model);
                }
            }
        }

        // Save updated model data
        this.modelManager.saveModelsMetadata();
    }

    /**
     * Mark review as helpful
     */
    markHelpful(reviewId, userId) {
        for (const reviews of this.reviews.values()) {
            const review = reviews.find(r => r.id === reviewId);
            if (review) {
                // In a real app, track who marked it helpful to prevent duplicates
                review.helpful_count = (review.helpful_count || 0) + 1;
                this.saveReviews();

                return {
                    success: true,
                    new_helpful_count: review.helpful_count
                };
            }
        }

        return {
            success: false,
            error: 'Review not found'
        };
    }

    /**
     * Author response to review
     */
    async respondToReview(reviewId, authorAddress, response) {
        for (const reviews of this.reviews.values()) {
            const review = reviews.find(r => r.id === reviewId);
            if (review) {
                // Check if author owns the model
                const model = this.modelManager.getModel(review.model_id);
                if (model && model.author_address === authorAddress) {
                    review.response_from_author = {
                        message: response,
                        created_at: new Date().toISOString()
                    };

                    this.saveReviews();

                    return {
                        success: true,
                        message: 'Response added successfully'
                    };
                } else {
                    return {
                        success: false,
                        error: 'Unauthorized: Only model author can respond'
                    };
                }
            }
        }

        return {
            success: false,
            error: 'Review not found'
        };
    }

    /**
     * Save reviews to storage
     */
    saveReviews() {
        try {
            const allReviews = [];
            const userRatingsArray = [];

            // Collect all reviews
            for (const reviews of this.reviews.values()) {
                allReviews.push(...reviews);
            }

            // Collect user ratings
            for (const [key, rating] of this.userRatings.entries()) {
                const [user_id, model_id] = key.split('_');
                userRatingsArray.push({ user_id, model_id, rating });
            }

            const data = {
                reviews: allReviews,
                user_ratings: userRatingsArray,
                last_updated: new Date().toISOString()
            };

            fs.writeFileSync(this.reviewsFile, JSON.stringify(data, null, 2));
            console.log(`💾 Saved ${allReviews.length} reviews`);
        } catch (error) {
            console.error('❌ Error saving reviews:', error);
        }
    }

    /**
     * Get user's review for a model
     */
    getUserReview(userId, modelId) {
        const reviews = this.reviews.get(modelId) || [];
        return reviews.find(r => r.user_id === userId) || null;
    }

    /**
     * Get all reviews by user
     */
    getUserReviews(userId) {
        const userReviews = [];

        for (const reviews of this.reviews.values()) {
            userReviews.push(...reviews.filter(r => r.user_id === userId));
        }

        return userReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    /**
     * Get overall marketplace review statistics
     */
    getMarketplaceReviewStats() {
        let totalReviews = 0;
        let totalRating = 0;
        let modelCount = 0;

        for (const reviews of this.reviews.values()) {
            if (reviews.length > 0) {
                totalReviews += reviews.length;
                totalRating += reviews.reduce((sum, r) => sum + r.rating, 0);
                modelCount++;
            }
        }

        return {
            total_reviews: totalReviews,
            average_rating: totalReviews > 0 ? Math.round(totalRating / totalReviews * 10) / 10 : 0,
            models_with_reviews: modelCount,
            recent_reviews: this.getRecentReviews(5)
        };
    }

    /**
     * Get recent reviews across all models
     */
    getRecentReviews(limit = 10) {
        const allReviews = [];

        for (const reviews of this.reviews.values()) {
            allReviews.push(...reviews);
        }

        return allReviews
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
    }
}

module.exports = ReviewManager;