/**
 * NeuroGrid Prompt Templates System
 * Ready-to-use prompts with variables for different AI models
 */

class PromptTemplatesManager {
    constructor() {
        this.templates = {
            // Text Generation Templates
            text: {
                business: [
                    {
                        id: 'business-plan',
                        title: 'Business Plan Generator',
                        description: 'Create comprehensive business plan',
                        preview: 'Professional business plan for [BUSINESS_TYPE] targeting [TARGET_MARKET]',
                        template: 'Create a detailed business plan for a {BUSINESS_TYPE} company targeting {TARGET_MARKET}. Include market analysis, financial projections, marketing strategy, and competitive analysis.',
                        variables: ['BUSINESS_TYPE', 'TARGET_MARKET'],
                        category: 'business',
                        estimatedTokens: 800,
                        recommendedModels: ['gemini-pro', 'llama2-13b'],
                        tags: ['business', 'planning', 'strategy']
                    },
                    {
                        id: 'marketing-copy',
                        title: 'Marketing Copy Writer',
                        description: 'Generate compelling marketing content',
                        preview: 'Persuasive marketing copy for [PRODUCT] highlighting [KEY_BENEFITS]',
                        template: 'Write compelling marketing copy for {PRODUCT}. Highlight these key benefits: {KEY_BENEFITS}. Target audience: {TARGET_AUDIENCE}. Tone: {TONE}.',
                        variables: ['PRODUCT', 'KEY_BENEFITS', 'TARGET_AUDIENCE', 'TONE'],
                        category: 'business',
                        estimatedTokens: 300,
                        recommendedModels: ['gemini-pro', 'mistral-7b'],
                        tags: ['marketing', 'copywriting', 'sales']
                    }
                ],
                creative: [
                    {
                        id: 'story-writer',
                        title: 'Creative Story Generator',
                        description: 'Write engaging stories with your characters',
                        preview: 'Creative story about [CHARACTER] in [SETTING] facing [CONFLICT]',
                        template: 'Write an engaging {GENRE} story about {CHARACTER}, a {CHARACTER_DESCRIPTION}, who lives in {SETTING}. The main conflict involves {CONFLICT}. Make it {TONE} and approximately {LENGTH} words.',
                        variables: ['GENRE', 'CHARACTER', 'CHARACTER_DESCRIPTION', 'SETTING', 'CONFLICT', 'TONE', 'LENGTH'],
                        category: 'creative',
                        estimatedTokens: 600,
                        recommendedModels: ['gemini-pro', 'llama2-7b'],
                        tags: ['creative', 'storytelling', 'fiction']
                    },
                    {
                        id: 'poem-generator',
                        title: 'Poetry Creator',
                        description: 'Generate beautiful poems in various styles',
                        preview: 'Beautiful [STYLE] poem about [THEME] with [MOOD] feeling',
                        template: 'Write a {STYLE} poem about {THEME}. The mood should be {MOOD}. Include imagery related to {IMAGERY}. Make it {LENGTH} lines long.',
                        variables: ['STYLE', 'THEME', 'MOOD', 'IMAGERY', 'LENGTH'],
                        category: 'creative',
                        estimatedTokens: 200,
                        recommendedModels: ['gemini-pro', 'llama2-7b'],
                        tags: ['poetry', 'creative', 'art']
                    }
                ],
                technical: [
                    {
                        id: 'code-explainer',
                        title: 'Code Documentation',
                        description: 'Explain and document code in detail',
                        preview: 'Clear explanation of [LANGUAGE] code functionality',
                        template: 'Explain this {LANGUAGE} code in detail. Describe what it does, how it works, and provide examples of usage: \\n\\n{CODE}\\n\\nTarget audience: {AUDIENCE_LEVEL}',
                        variables: ['LANGUAGE', 'CODE', 'AUDIENCE_LEVEL'],
                        category: 'technical',
                        estimatedTokens: 400,
                        recommendedModels: ['codellama-7b', 'gemini-pro'],
                        tags: ['programming', 'documentation', 'education']
                    },
                    {
                        id: 'architecture-review',
                        title: 'System Architecture Review',
                        description: 'Analyze and improve system architecture',
                        preview: 'Professional review of [SYSTEM_TYPE] architecture',
                        template: 'Review this {SYSTEM_TYPE} architecture and provide recommendations: {ARCHITECTURE_DESCRIPTION}. Focus on {FOCUS_AREAS}. Consider scalability, security, and performance.',
                        variables: ['SYSTEM_TYPE', 'ARCHITECTURE_DESCRIPTION', 'FOCUS_AREAS'],
                        category: 'technical',
                        estimatedTokens: 500,
                        recommendedModels: ['gemini-pro', 'llama2-13b'],
                        tags: ['architecture', 'review', 'optimization']
                    }
                ]
            },

            // Image Generation Templates  
            image: {
                art: [
                    {
                        id: 'portrait-art',
                        title: 'Artistic Portrait',
                        description: 'Create stunning artistic portraits',
                        preview: 'Artistic portrait of [SUBJECT] in [STYLE] with [MOOD]',
                        template: 'Portrait of {SUBJECT}, {DESCRIPTION}, {STYLE} art style, {MOOD} mood, {LIGHTING} lighting, high quality, detailed',
                        variables: ['SUBJECT', 'DESCRIPTION', 'STYLE', 'MOOD', 'LIGHTING'],
                        category: 'art',
                        estimatedCost: 0.3,
                        recommendedModels: ['stable-diffusion-xl', 'stable-diffusion-2'],
                        tags: ['portrait', 'art', 'people']
                    },
                    {
                        id: 'landscape-scene',
                        title: 'Fantasy Landscape',
                        description: 'Generate beautiful fantasy landscapes',
                        preview: 'Magical landscape with [ELEMENTS] under [SKY_CONDITION]',
                        template: 'Fantasy landscape with {ELEMENTS}, {SKY_CONDITION} sky, {TIME_OF_DAY}, {STYLE} art style, magical atmosphere, highly detailed, 4k',
                        variables: ['ELEMENTS', 'SKY_CONDITION', 'TIME_OF_DAY', 'STYLE'],
                        category: 'art', 
                        estimatedCost: 0.3,
                        recommendedModels: ['stable-diffusion-xl'],
                        tags: ['landscape', 'fantasy', 'nature']
                    }
                ],
                commercial: [
                    {
                        id: 'product-photo',
                        title: 'Product Photography',
                        description: 'Professional product photos for marketing',
                        preview: 'Professional photo of [PRODUCT] with [BACKGROUND]',
                        template: 'Professional product photography of {PRODUCT}, {BACKGROUND} background, {LIGHTING} lighting, commercial quality, clean composition, high resolution',
                        variables: ['PRODUCT', 'BACKGROUND', 'LIGHTING'],
                        category: 'commercial',
                        estimatedCost: 0.3,
                        recommendedModels: ['stable-diffusion-xl'],
                        tags: ['product', 'commercial', 'marketing']
                    },
                    {
                        id: 'social-media',
                        title: 'Social Media Post',
                        description: 'Eye-catching social media visuals',
                        preview: 'Engaging [PLATFORM] post about [TOPIC]',
                        template: '{PLATFORM} post design about {TOPIC}, {COLOR_SCHEME} colors, modern design, engaging visual, {STYLE} style, trending',
                        variables: ['PLATFORM', 'TOPIC', 'COLOR_SCHEME', 'STYLE'],
                        category: 'commercial',
                        estimatedCost: 0.3,
                        recommendedModels: ['stable-diffusion-xl'],
                        tags: ['social', 'marketing', 'design']
                    }
                ]
            }
        };
    }

    // Get all templates by type and category
    getTemplatesByType(type) {
        return this.templates[type] || {};
    }

    // Get template by ID
    getTemplate(templateId) {
        for (const type in this.templates) {
            for (const category in this.templates[type]) {
                const template = this.templates[type][category].find(t => t.id === templateId);
                if (template) return template;
            }
        }
        return null;
    }

    // Search templates
    searchTemplates(query, type = null) {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const currentType in this.templates) {
            if (type && currentType !== type) continue;
            
            for (const category in this.templates[currentType]) {
                this.templates[currentType][category].forEach(template => {
                    if (template.title.toLowerCase().includes(searchTerm) ||
                        template.description.toLowerCase().includes(searchTerm) ||
                        template.tags.some(tag => tag.includes(searchTerm))) {
                        results.push({...template, type: currentType, category});
                    }
                });
            }
        }
        return results;
    }

    // Process template with variables
    processTemplate(templateId, variables) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        let processedPrompt = template.template;
        
        // Replace variables in the format {VARIABLE_NAME}
        template.variables.forEach(variable => {
            const value = variables[variable] || `[${variable}]`;
            const regex = new RegExp(`\\{${variable}\\}`, 'g');
            processedPrompt = processedPrompt.replace(regex, value);
        });

        return {
            ...template,
            processedPrompt,
            providedVariables: variables
        };
    }

    // Get recommended model for template
    getRecommendedModel(templateId, availableProviders) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        // Find best available model
        for (const model of template.recommendedModels) {
            for (const provider of availableProviders) {
                if (model.includes(provider) || provider === 'google-gemini' && model.includes('gemini')) {
                    return { provider, model };
                }
            }
        }

        return { provider: availableProviders[0], model: 'auto' };
    }

    // Get templates by category
    getTemplatesByCategory(type, category) {
        return this.templates[type]?.[category] || [];
    }

    // Get all categories for a type
    getCategories(type) {
        return Object.keys(this.templates[type] || {});
    }

    // Get template statistics
    getStats() {
        let totalTemplates = 0;
        const stats = { text: {}, image: {} };

        for (const type in this.templates) {
            stats[type] = {};
            for (const category in this.templates[type]) {
                const count = this.templates[type][category].length;
                stats[type][category] = count;
                totalTemplates += count;
            }
        }

        return { totalTemplates, breakdown: stats };
    }
}

module.exports = PromptTemplatesManager;