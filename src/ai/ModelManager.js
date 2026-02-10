/**
 * Model Manager - System for managing user-uploaded AI models
 * Handles model metadata, validation, and marketplace integration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ModelManager {
    constructor() {
        this.modelsDir = path.join(__dirname, '../data/models');
        this.metadataFile = path.join(__dirname, '../data/models-metadata.json');
        this.models = new Map();
        this.supportedTypes = ['text', 'image', 'code', 'chat'];
        this.maxModelSize = 50 * 1024 * 1024 * 1024; // 50GB limit

        console.log('🎯 Model Manager initialized');
        this.ensureDirectories();
        this.loadModelsMetadata();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [this.modelsDir, path.dirname(this.metadataFile)];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    /**
     * Load models metadata from storage
     */
    loadModelsMetadata() {
        try {
            if (fs.existsSync(this.metadataFile)) {
                const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
                data.forEach(model => {
                    this.models.set(model.id, model);
                });
                console.log(`📊 Loaded ${this.models.size} model metadata entries`);
            } else {
                // Initialize with some example models
                this.initializeDefaultModels();
            }
        } catch (error) {
            console.error('❌ Error loading models metadata:', error);
            this.initializeDefaultModels();
        }
    }

    /**
     * Initialize with default community models
     */
    initializeDefaultModels() {
        const defaultModels = [
            {
                id: 'community-llama2-finetuned',
                name: 'Community Llama 2 Fine-tuned',
                description: 'Llama 2 model fine-tuned by the community for better conversations',
                type: 'text',
                author: 'NeuroGrid Community',
                author_address: '0x1234567890123456789012345678901234567890',
                version: '1.0.0',
                size_mb: 13568,
                downloads: 1247,
                rating: 4.6,
                reviews_count: 89,
                cost_per_token: 0.008,
                tags: ['conversation', 'general', 'fine-tuned'],
                created_at: new Date('2026-01-15').toISOString(),
                updated_at: new Date('2026-01-15').toISOString(),
                verified: true,
                featured: true,
                huggingface_id: 'neurogrid-community/llama-2-7b-chat-neurogrid',
                performance: {
                    inference_speed: 'fast',
                    quality_score: 4.6,
                    benchmarks: {
                        mmlu: 62.8,
                        hellaswag: 77.2,
                        arc: 53.7
                    }
                },
                requirements: {
                    min_gpu_memory: '8GB',
                    recommended_gpu: 'RTX 3080 or better',
                    cuda_version: '11.8+'
                }
            },
            {
                id: 'artist-stable-diffusion',
                name: 'Artist\'s Stable Diffusion XL',
                description: 'Specially trained on artistic styles and high-quality illustrations',
                type: 'image',
                author: 'AIArtist Pro',
                author_address: '0x9876543210987654321098765432109876543210',
                version: '2.1.0',
                size_mb: 6738,
                downloads: 3421,
                rating: 4.8,
                reviews_count: 203,
                cost_per_image: 0.25,
                tags: ['art', 'illustration', 'creative', 'high-quality'],
                created_at: new Date('2026-01-20').toISOString(),
                updated_at: new Date('2026-02-01').toISOString(),
                verified: true,
                featured: true,
                huggingface_id: 'aiartist-pro/sdxl-artistic-v2',
                performance: {
                    inference_speed: 'medium',
                    quality_score: 4.8,
                    sample_images: [
                        'https://picsum.photos/512/512?random=1',
                        'https://picsum.photos/512/512?random=2'
                    ]
                },
                requirements: {
                    min_gpu_memory: '12GB',
                    recommended_gpu: 'RTX 4080 or better',
                    cuda_version: '11.8+'
                }
            },
            {
                id: 'coder-assist-7b',
                name: 'CoderAssist 7B',
                description: 'Specialized coding model trained on GitHub repositories and documentation',
                type: 'code',
                author: 'DevTools Inc',
                author_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                version: '1.3.2',
                size_mb: 7892,
                downloads: 892,
                rating: 4.4,
                reviews_count: 67,
                cost_per_token: 0.012,
                tags: ['programming', 'python', 'javascript', 'debugging'],
                created_at: new Date('2026-01-10').toISOString(),
                updated_at: new Date('2026-02-03').toISOString(),
                verified: true,
                featured: false,
                huggingface_id: 'devtools/coderassist-7b-v1.3',
                performance: {
                    inference_speed: 'fast',
                    quality_score: 4.4,
                    benchmarks: {
                        humaneval: 71.2,
                        mbpp: 68.5
                    }
                },
                requirements: {
                    min_gpu_memory: '8GB',
                    recommended_gpu: 'RTX 3070 or better',
                    cuda_version: '11.8+'
                }
            }
        ];

        defaultModels.forEach(model => {
            this.models.set(model.id, model);
        });

        this.saveModelsMetadata();
        console.log(`🎯 Initialized ${defaultModels.length} default community models`);
    }

    /**
     * Save models metadata to storage
     */
    saveModelsMetadata() {
        try {
            const modelsArray = Array.from(this.models.values());
            fs.writeFileSync(this.metadataFile, JSON.stringify(modelsArray, null, 2));
            console.log(`💾 Saved ${modelsArray.length} model metadata entries`);
        } catch (error) {
            console.error('❌ Error saving models metadata:', error);
        }
    }

    /**
     * Validate model data before upload
     */
    validateModel(modelData) {
        const errors = [];

        // Required fields validation
        const required = ['name', 'description', 'type', 'author'];
        required.forEach(field => {
            if (!modelData[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        // Type validation
        if (modelData.type && !this.supportedTypes.includes(modelData.type)) {
            errors.push(`Unsupported model type: ${modelData.type}. Supported: ${this.supportedTypes.join(', ')}`);
        }

        // Name length
        if (modelData.name && modelData.name.length > 100) {
            errors.push('Model name too long (max 100 characters)');
        }

        // Description length
        if (modelData.description && modelData.description.length > 1000) {
            errors.push('Description too long (max 1000 characters)');
        }

        // Cost validation
        if (modelData.cost_per_token && (modelData.cost_per_token < 0.001 || modelData.cost_per_token > 1)) {
            errors.push('Cost per token must be between 0.001 and 1 NEURO');
        }

        if (modelData.cost_per_image && (modelData.cost_per_image < 0.01 || modelData.cost_per_image > 10)) {
            errors.push('Cost per image must be between 0.01 and 10 NEURO');
        }

        return errors;
    }

    /**
     * Register a new model
     */
    async registerModel(modelData, authorAddress) {
        try {
            // Validate model data
            const errors = this.validateModel(modelData);
            if (errors.length > 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    details: errors
                };
            }

            // Generate unique model ID
            const modelId = this.generateModelId(modelData.name, authorAddress);

            // Check if model already exists
            if (this.models.has(modelId)) {
                return {
                    success: false,
                    error: 'Model with this name already exists for this author'
                };
            }

            // Create model metadata
            const model = {
                id: modelId,
                name: modelData.name,
                description: modelData.description,
                type: modelData.type,
                author: modelData.author,
                author_address: authorAddress,
                version: modelData.version || '1.0.0',
                size_mb: modelData.size_mb || 0,
                downloads: 0,
                rating: 0,
                reviews_count: 0,
                cost_per_token: modelData.cost_per_token || 0.01,
                cost_per_image: modelData.cost_per_image || 0.5,
                tags: modelData.tags || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                verified: false,
                featured: false,
                huggingface_id: modelData.huggingface_id || null,
                performance: modelData.performance || {
                    inference_speed: 'unknown',
                    quality_score: 0
                },
                requirements: modelData.requirements || {
                    min_gpu_memory: 'Unknown',
                    recommended_gpu: 'Any modern GPU',
                    cuda_version: '11.8+'
                }
            };

            // Store model
            this.models.set(modelId, model);
            this.saveModelsMetadata();

            console.log(`✅ Registered new model: ${model.name} (${modelId})`);

            return {
                success: true,
                model_id: modelId,
                message: 'Model registered successfully',
                data: model
            };

        } catch (error) {
            console.error('❌ Error registering model:', error);
            return {
                success: false,
                error: 'Internal server error',
                details: error.message
            };
        }
    }

    /**
     * Generate unique model ID
     */
    generateModelId(name, authorAddress) {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const authorHash = crypto.createHash('sha256').update(authorAddress).digest('hex').substring(0, 8);
        return `${cleanName}-${authorHash}`;
    }

    /**
     * Get all models with filtering and sorting
     */
    getModels(filters = {}) {
        let models = Array.from(this.models.values());

        // Apply filters
        if (filters.type) {
            models = models.filter(m => m.type === filters.type);
        }

        if (filters.featured) {
            models = models.filter(m => m.featured === true);
        }

        if (filters.verified) {
            models = models.filter(m => m.verified === true);
        }

        if (filters.author) {
            models = models.filter(m => m.author_address === filters.author);
        }

        if (filters.search) {
            const search = filters.search.toLowerCase();
            models = models.filter(m => 
                m.name.toLowerCase().includes(search) ||
                m.description.toLowerCase().includes(search) ||
                m.tags.some(tag => tag.toLowerCase().includes(search))
            );
        }

        // Apply sorting
        const sortBy = filters.sortBy || 'downloads';
        const order = filters.order || 'desc';

        models.sort((a, b) => {
            let aVal = a[sortBy] || 0;
            let bVal = b[sortBy] || 0;

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

        return models;
    }

    /**
     * Get model by ID
     */
    getModel(modelId) {
        return this.models.get(modelId) || null;
    }

    /**
     * Update model data
     */
    async updateModel(modelId, updates, authorAddress) {
        const model = this.models.get(modelId);
        
        if (!model) {
            return {
                success: false,
                error: 'Model not found'
            };
        }

        // Check authorization
        if (model.author_address !== authorAddress) {
            return {
                success: false,
                error: 'Unauthorized: You can only update your own models'
            };
        }

        // Apply updates
        const updatedModel = {
            ...model,
            ...updates,
            updated_at: new Date().toISOString()
        };

        // Validate updated model
        const errors = this.validateModel(updatedModel);
        if (errors.length > 0) {
            return {
                success: false,
                error: 'Validation failed',
                details: errors
            };
        }

        this.models.set(modelId, updatedModel);
        this.saveModelsMetadata();

        console.log(`📝 Updated model: ${modelId}`);

        return {
            success: true,
            model_id: modelId,
            message: 'Model updated successfully',
            data: updatedModel
        };
    }

    /**
     * Delete model
     */
    async deleteModel(modelId, authorAddress) {
        const model = this.models.get(modelId);
        
        if (!model) {
            return {
                success: false,
                error: 'Model not found'
            };
        }

        // Check authorization
        if (model.author_address !== authorAddress) {
            return {
                success: false,
                error: 'Unauthorized: You can only delete your own models'
            };
        }

        this.models.delete(modelId);
        this.saveModelsMetadata();

        console.log(`🗑️ Deleted model: ${modelId}`);

        return {
            success: true,
            message: 'Model deleted successfully'
        };
    }

    /**
     * Record model download
     */
    recordDownload(modelId) {
        const model = this.models.get(modelId);
        if (model) {
            model.downloads = (model.downloads || 0) + 1;
            this.models.set(modelId, model);
            this.saveModelsMetadata();
        }
    }

    /**
     * Get marketplace statistics
     */
    getMarketplaceStats() {
        const models = Array.from(this.models.values());
        
        return {
            total_models: models.length,
            total_downloads: models.reduce((sum, m) => sum + (m.downloads || 0), 0),
            verified_models: models.filter(m => m.verified).length,
            featured_models: models.filter(m => m.featured).length,
            types_distribution: this.supportedTypes.map(type => ({
                type: type,
                count: models.filter(m => m.type === type).length
            })),
            top_authors: this.getTopAuthors(models),
            average_rating: models.reduce((sum, m) => sum + (m.rating || 0), 0) / models.length
        };
    }

    /**
     * Get top authors by model count and downloads
     */
    getTopAuthors(models) {
        const authors = {};
        
        models.forEach(model => {
            const address = model.author_address;
            if (!authors[address]) {
                authors[address] = {
                    address: address,
                    name: model.author,
                    models_count: 0,
                    total_downloads: 0,
                    avg_rating: 0
                };
            }
            
            authors[address].models_count++;
            authors[address].total_downloads += model.downloads || 0;
        });

        return Object.values(authors)
            .sort((a, b) => b.total_downloads - a.total_downloads)
            .slice(0, 10);
    }
}

module.exports = ModelManager;