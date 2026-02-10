/**
 * Social Manager - Community and social features
 * Manages public AI chats, image gallery, user profiles, and social interactions
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SocialManager {
    constructor() {
        this.chatsFile = path.join(__dirname, '../data/social-chats.json');
        this.galleryFile = path.join(__dirname, '../data/image-gallery.json');
        this.profilesFile = path.join(__dirname, '../data/user-profiles.json');
        this.communitiesFile = path.join(__dirname, '../data/communities.json');
        
        // In-memory storage
        this.publicChats = new Map(); // chatId -> chat data
        this.imageGallery = []; // Array of shared images
        this.userProfiles = new Map(); // userId -> profile data
        this.communities = new Map(); // communityId -> community data
        this.chatParticipants = new Map(); // chatId -> Set of userIds
        
        console.log('👥 Social Manager initialized');
        this.ensureDirectories();
        this.loadSocialData();
        
        // Start periodic cleanup
        this.cleanupInterval = setInterval(() => this.cleanupOldData(), 300000); // Every 5 minutes
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [path.dirname(this.chatsFile)];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    /**
     * Load social data from storage
     */
    loadSocialData() {
        try {
            // Load public chats
            if (fs.existsSync(this.chatsFile)) {
                const chatData = JSON.parse(fs.readFileSync(this.chatsFile, 'utf8'));
                chatData.forEach(chat => {
                    this.publicChats.set(chat.id, chat);
                });
                console.log(`💬 Loaded ${this.publicChats.size} public chats`);
            } else {
                this.initializeDefaultChats();
            }

            // Load image gallery
            if (fs.existsSync(this.galleryFile)) {
                this.imageGallery = JSON.parse(fs.readFileSync(this.galleryFile, 'utf8'));
                console.log(`🖼️ Loaded ${this.imageGallery.length} gallery images`);
            } else {
                this.initializeDefaultGallery();
            }

            // Load user profiles
            if (fs.existsSync(this.profilesFile)) {
                const profileData = JSON.parse(fs.readFileSync(this.profilesFile, 'utf8'));
                profileData.forEach(profile => {
                    this.userProfiles.set(profile.user_id, profile);
                });
                console.log(`👤 Loaded ${this.userProfiles.size} user profiles`);
            }

            // Load communities
            if (fs.existsSync(this.communitiesFile)) {
                const communityData = JSON.parse(fs.readFileSync(this.communitiesFile, 'utf8'));
                communityData.forEach(community => {
                    this.communities.set(community.id, community);
                });
                console.log(`🏘️ Loaded ${this.communities.size} communities`);
            } else {
                this.initializeDefaultCommunities();
            }

        } catch (error) {
            console.error('❌ Error loading social data:', error);
            this.initializeDefaultChats();
            this.initializeDefaultGallery();
            this.initializeDefaultCommunities();
        }
    }

    /**
     * Initialize default public chats
     */
    initializeDefaultChats() {
        const defaultChats = [
            {
                id: 'chat_ai_showcase',
                title: 'AI Model Showcase',
                description: 'Share interesting AI model conversations',
                creator: 'system',
                model: 'community-llama2-finetuned',
                created_at: new Date('2026-01-15').toISOString(),
                is_public: true,
                messages: [
                    {
                        id: 'msg_1',
                        user_id: 'system',
                        username: 'NeuroGrid',
                        message: 'Welcome to the AI Model Showcase! Share your most interesting AI conversations here.',
                        model: 'community-llama2-finetuned',
                        timestamp: new Date('2026-01-15').toISOString(),
                        likes: 15,
                        is_ai_response: false
                    },
                    {
                        id: 'msg_2',
                        user_id: 'user_alice',
                        username: 'AIExplorer',
                        message: 'What are the ethical implications of AGI development?',
                        model: 'community-llama2-finetuned',
                        timestamp: new Date('2026-01-16').toISOString(),
                        likes: 8,
                        is_ai_response: false
                    },
                    {
                        id: 'msg_3',
                        user_id: 'ai_assistant',
                        username: 'Community LLaMA-2',
                        message: 'AGI development raises several critical ethical considerations: ensuring alignment with human values, preventing misuse, addressing job displacement, maintaining human agency, and ensuring equitable access. The key is developing robust governance frameworks early in the development process.',
                        model: 'community-llama2-finetuned',
                        timestamp: new Date('2026-01-16').toISOString(),
                        likes: 23,
                        is_ai_response: true
                    }
                ],
                participants: 12,
                tags: ['ai', 'philosophy', 'ethics']
            },
            {
                id: 'chat_creative_ai',
                title: 'Creative AI Projects',
                description: 'Show off your creative AI-generated content',
                creator: 'user_creative',
                model: 'sdxl-turbo',
                created_at: new Date('2026-01-18').toISOString(),
                is_public: true,
                messages: [
                    {
                        id: 'msg_4',
                        user_id: 'user_creative',
                        username: 'PixelMaster',
                        message: 'Check out this AI-generated cyberpunk cityscape!',
                        model: 'sdxl-turbo',
                        timestamp: new Date('2026-01-18').toISOString(),
                        likes: 31,
                        is_ai_response: false,
                        attachments: [
                            {
                                type: 'image',
                                url: '/api/images/cyberpunk_city_001.png',
                                description: 'Cyberpunk cityscape with neon lights'
                            }
                        ]
                    }
                ],
                participants: 8,
                tags: ['creative', 'art', 'images']
            }
        ];

        defaultChats.forEach(chat => {
            this.publicChats.set(chat.id, chat);
        });

        this.saveSocialData();
        console.log('💬 Initialized default public chats');
    }

    /**
     * Initialize default image gallery
     */
    initializeDefaultGallery() {
        this.imageGallery = [
            {
                id: 'img_001',
                title: 'Futuristic AI City',
                description: 'A stunning vision of AI-powered urban future',
                creator: 'PixelMaster',
                user_id: 'user_creative',
                model: 'sdxl-turbo',
                prompt: 'futuristic AI-powered city, neon lights, cyberpunk style, 4k resolution',
                image_url: '/api/images/ai_city_001.png',
                created_at: new Date('2026-01-20').toISOString(),
                likes: 47,
                views: 234,
                tags: ['futuristic', 'city', 'ai', 'cyberpunk'],
                is_featured: true,
                comments: [
                    {
                        id: 'comment_1',
                        user_id: 'user_alice',
                        username: 'AIExplorer',
                        comment: 'Amazing detail in this image! The lighting effects are incredible.',
                        timestamp: new Date('2026-01-20').toISOString(),
                        likes: 5
                    }
                ]
            },
            {
                id: 'img_002',
                title: 'Abstract AI Art',
                description: 'Neural network-inspired abstract composition',
                creator: 'ArtBot',
                user_id: 'user_artist',
                model: 'stable-diffusion-xl',
                prompt: 'abstract neural network visualization, colorful, flowing data streams',
                image_url: '/api/images/neural_art_002.png',
                created_at: new Date('2026-01-22').toISOString(),
                likes: 28,
                views: 156,
                tags: ['abstract', 'neural', 'art', 'colorful'],
                is_featured: false,
                comments: []
            }
        ];

        this.saveSocialData();
        console.log('🖼️ Initialized default image gallery');
    }

    /**
     * Initialize default communities
     */
    initializeDefaultCommunities() {
        const defaultCommunities = [
            {
                id: 'community_ai_researchers',
                name: 'AI Researchers',
                description: 'A community for discussing cutting-edge AI research and developments',
                creator: 'system',
                created_at: new Date('2026-01-10').toISOString(),
                members: 156,
                is_public: true,
                avatar_url: '/images/communities/ai_researchers.png',
                tags: ['research', 'ai', 'machine-learning'],
                stats: {
                    posts: 47,
                    active_members: 89,
                    weekly_growth: 12
                }
            },
            {
                id: 'community_creative_ai',
                name: 'Creative AI Artists',
                description: 'Share and discuss AI-generated art, music, and creative content',
                creator: 'user_creative',
                created_at: new Date('2026-01-12').toISOString(),
                members: 203,
                is_public: true,
                avatar_url: '/images/communities/creative_ai.png',
                tags: ['creative', 'art', 'music', 'generation'],
                stats: {
                    posts: 78,
                    active_members: 134,
                    weekly_growth: 18
                }
            }
        ];

        defaultCommunities.forEach(community => {
            this.communities.set(community.id, community);
        });

        this.saveSocialData();
        console.log('🏘️ Initialized default communities');
    }

    /**
     * Create new public chat
     */
    createPublicChat(data) {
        const chatId = 'chat_' + crypto.randomBytes(8).toString('hex');
        
        const chat = {
            id: chatId,
            title: data.title || 'Untitled Chat',
            description: data.description || '',
            creator: data.creator || 'anonymous',
            model: data.model || 'auto',
            created_at: new Date().toISOString(),
            is_public: true,
            messages: [],
            participants: 1,
            tags: data.tags || []
        };

        this.publicChats.set(chatId, chat);
        this.saveSocialData();

        console.log(`💬 Created public chat: ${chat.title} (${chatId})`);
        
        return {
            success: true,
            chat_id: chatId,
            chat: chat
        };
    }

    /**
     * Add message to public chat
     */
    addChatMessage(chatId, messageData) {
        const chat = this.publicChats.get(chatId);
        if (!chat) {
            return {
                success: false,
                error: 'Chat not found'
            };
        }

        const messageId = 'msg_' + crypto.randomBytes(8).toString('hex');
        
        const message = {
            id: messageId,
            user_id: messageData.user_id || 'anonymous',
            username: messageData.username || 'User',
            message: messageData.message,
            model: messageData.model || chat.model,
            timestamp: new Date().toISOString(),
            likes: 0,
            is_ai_response: messageData.is_ai_response || false,
            attachments: messageData.attachments || []
        };

        chat.messages.push(message);
        
        // Update participant count (rough estimate)
        if (!this.chatParticipants.has(chatId)) {
            this.chatParticipants.set(chatId, new Set());
        }
        this.chatParticipants.get(chatId).add(messageData.user_id);
        chat.participants = this.chatParticipants.get(chatId).size;

        this.saveSocialData();

        console.log(`💬 Added message to chat ${chatId}: ${message.message.substring(0, 50)}...`);

        return {
            success: true,
            message_id: messageId,
            message: message
        };
    }

    /**
     * Get public chats with filtering
     */
    getPublicChats(options = {}) {
        const { limit = 10, offset = 0, tag, creator, sortBy = 'created_at' } = options;
        
        let chats = Array.from(this.publicChats.values()).filter(chat => chat.is_public);

        // Apply filters
        if (tag) {
            chats = chats.filter(chat => chat.tags.includes(tag));
        }
        
        if (creator) {
            chats = chats.filter(chat => chat.creator === creator);
        }

        // Sort
        chats.sort((a, b) => {
            if (sortBy === 'participants') {
                return b.participants - a.participants;
            }
            if (sortBy === 'messages') {
                return b.messages.length - a.messages.length;
            }
            return new Date(b[sortBy]) - new Date(a[sortBy]); // Default to date sorting
        });

        // Apply pagination
        const total = chats.length;
        chats = chats.slice(offset, offset + limit);

        return {
            chats: chats,
            total: total,
            limit: limit,
            offset: offset
        };
    }

    /**
     * Get specific chat with messages
     */
    getChat(chatId) {
        return this.publicChats.get(chatId) || null;
    }

    /**
     * Add image to gallery
     */
    addToGallery(imageData) {
        const imageId = 'img_' + crypto.randomBytes(8).toString('hex');
        
        const image = {
            id: imageId,
            title: imageData.title || 'Untitled',
            description: imageData.description || '',
            creator: imageData.creator || 'Anonymous',
            user_id: imageData.user_id || 'anonymous',
            model: imageData.model || 'unknown',
            prompt: imageData.prompt || '',
            image_url: imageData.image_url,
            created_at: new Date().toISOString(),
            likes: 0,
            views: 0,
            tags: imageData.tags || [],
            is_featured: false,
            comments: []
        };

        this.imageGallery.push(image);
        this.saveSocialData();

        console.log(`🖼️ Added image to gallery: ${image.title} (${imageId})`);

        return {
            success: true,
            image_id: imageId,
            image: image
        };
    }

    /**
     * Get image gallery with filtering
     */
    getImageGallery(options = {}) {
        const { limit = 20, offset = 0, tag, featured, sortBy = 'created_at' } = options;
        
        let images = [...this.imageGallery];

        // Apply filters
        if (tag) {
            images = images.filter(img => img.tags.includes(tag));
        }
        
        if (featured !== undefined) {
            images = images.filter(img => img.is_featured === featured);
        }

        // Sort
        images.sort((a, b) => {
            if (sortBy === 'likes') {
                return b.likes - a.likes;
            }
            if (sortBy === 'views') {
                return b.views - a.views;
            }
            return new Date(b[sortBy]) - new Date(a[sortBy]);
        });

        // Apply pagination
        const total = images.length;
        images = images.slice(offset, offset + limit);

        return {
            images: images,
            total: total,
            limit: limit,
            offset: offset
        };
    }

    /**
     * Like a chat message
     */
    likeChatMessage(chatId, messageId) {
        const chat = this.publicChats.get(chatId);
        if (!chat) return { success: false, error: 'Chat not found' };

        const message = chat.messages.find(msg => msg.id === messageId);
        if (!message) return { success: false, error: 'Message not found' };

        message.likes = (message.likes || 0) + 1;
        this.saveSocialData();

        return {
            success: true,
            new_likes: message.likes
        };
    }

    /**
     * Like a gallery image
     */
    likeGalleryImage(imageId) {
        const image = this.imageGallery.find(img => img.id === imageId);
        if (!image) return { success: false, error: 'Image not found' };

        image.likes = (image.likes || 0) + 1;
        this.saveSocialData();

        return {
            success: true,
            new_likes: image.likes
        };
    }

    /**
     * Get user profile
     */
    getUserProfile(userId) {
        return this.userProfiles.get(userId) || null;
    }

    /**
     * Update user profile
     */
    updateUserProfile(userId, profileData) {
        const existingProfile = this.userProfiles.get(userId) || {};
        
        const profile = {
            ...existingProfile,
            user_id: userId,
            username: profileData.username || existingProfile.username || `User_${userId.substring(0, 8)}`,
            display_name: profileData.display_name || existingProfile.display_name,
            bio: profileData.bio || existingProfile.bio || '',
            avatar_url: profileData.avatar_url || existingProfile.avatar_url,
            joined_at: existingProfile.joined_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            stats: {
                chats_created: existingProfile.stats?.chats_created || 0,
                messages_posted: existingProfile.stats?.messages_posted || 0,
                images_shared: existingProfile.stats?.images_shared || 0,
                total_likes: existingProfile.stats?.total_likes || 0
            }
        };

        this.userProfiles.set(userId, profile);
        this.saveSocialData();

        return {
            success: true,
            profile: profile
        };
    }

    /**
     * Get social statistics
     */
    getSocialStats() {
        const totalMessages = Array.from(this.publicChats.values())
            .reduce((sum, chat) => sum + chat.messages.length, 0);
        
        const totalLikes = this.imageGallery.reduce((sum, img) => sum + img.likes, 0) +
            Array.from(this.publicChats.values())
                .reduce((sum, chat) => sum + chat.messages.reduce((msgSum, msg) => msgSum + (msg.likes || 0), 0), 0);

        return {
            public_chats: this.publicChats.size,
            total_messages: totalMessages,
            gallery_images: this.imageGallery.length,
            total_likes: totalLikes,
            user_profiles: this.userProfiles.size,
            communities: this.communities.size,
            active_users: this.userProfiles.size, // Approximation
            featured_images: this.imageGallery.filter(img => img.is_featured).length
        };
    }

    /**
     * Cleanup old data
     */
    cleanupOldData() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let cleaned = 0;

        // Clean old chats with no recent activity
        for (const [chatId, chat] of this.publicChats.entries()) {
            if (chat.messages.length === 0 && new Date(chat.created_at) < thirtyDaysAgo) {
                this.publicChats.delete(chatId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old social items`);
            this.saveSocialData();
        }
    }

    /**
     * Save social data to storage
     */
    saveSocialData() {
        try {
            // Save chats
            const chatsArray = Array.from(this.publicChats.values());
            fs.writeFileSync(this.chatsFile, JSON.stringify(chatsArray, null, 2));

            // Save gallery
            fs.writeFileSync(this.galleryFile, JSON.stringify(this.imageGallery, null, 2));

            // Save profiles
            const profilesArray = Array.from(this.userProfiles.values());
            fs.writeFileSync(this.profilesFile, JSON.stringify(profilesArray, null, 2));

            // Save communities
            const communitiesArray = Array.from(this.communities.values());
            fs.writeFileSync(this.communitiesFile, JSON.stringify(communitiesArray, null, 2));

            console.log('💾 Saved social data');
        } catch (error) {
            console.error('❌ Error saving social data:', error);
        }
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.saveSocialData();
        console.log('👥 Social Manager destroyed');
    }
}

module.exports = SocialManager;