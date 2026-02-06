/**
 * Multi-Provider AI Manager for NeuroGrid
 * Manages multiple AI providers (Hugging Face, Google Gemini, etc.)
 */

const HuggingFaceClient = require('./huggingface-client');
const GoogleGeminiClient = require('./google-gemini-client');

class MultiProviderAIManager {
  constructor() {
    // Initialize all AI providers
    this.providers = {
      'huggingface': new HuggingFaceClient(),
      'google-gemini': new GoogleGeminiClient()
    };
    
    // Provider priority (fallback order)
    this.providerPriority = ['google-gemini', 'huggingface'];
    
    console.log('🤖 Multi-Provider AI Manager initialized');
    console.log(`📊 Available providers: ${Object.keys(this.providers).join(', ')}`);
    console.log(`🔑 Configured providers: ${this.getConfiguredProviders().join(', ') || 'none (using mocks)'}`);
  }

  /**
   * Generate text using specified provider and model
   */
  async generateText(provider, modelId, prompt, options = {}, onProgress = null) {
    try {
      if (!this.providers[provider]) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const result = await this.providers[provider].generateText(modelId, prompt, options, onProgress);
      
      // Add provider info to result
      result.provider_used = provider;
      result.provider_configured = this.providers[provider].isConfigured ? this.providers[provider].isConfigured() : !!this.providers[provider].apiKey;
      
      return result;
    } catch (error) {
      console.error(`Provider ${provider} failed:`, error.message);
      
      // Try fallback provider
      return this.generateTextWithFallback(provider, modelId, prompt, options, onProgress);
    }
  }

  /**
   * Generate text with automatic fallback to other providers
   */
  async generateTextWithFallback(originalProvider, modelId, prompt, options = {}, onProgress = null) {
    // Try other providers as fallback
    for (const fallbackProvider of this.providerPriority) {
      if (fallbackProvider === originalProvider) continue; // Skip the original failed provider
      
      try {
        console.log(`🔄 Trying fallback provider: ${fallbackProvider}`);
        
        // Map model to equivalent in fallback provider
        const mappedModel = this.mapModelToProvider(modelId, originalProvider, fallbackProvider);
        
        if (mappedModel) {
          const result = await this.providers[fallbackProvider].generateText(mappedModel, prompt, options, onProgress);
          result.provider_used = fallbackProvider;
          result.fallback_used = true;
          result.original_provider = originalProvider;
          return result;
        }
      } catch (error) {
        console.error(`Fallback provider ${fallbackProvider} also failed:`, error.message);
        continue;
      }
    }
    
    // If all providers fail, return error
    return {
      success: false,
      error: 'All AI providers are currently unavailable',
      provider_used: 'none',
      fallback_attempts: this.providerPriority.length
    };
  }

  /**
   * Generate image using specified provider and model
   */
  async generateImage(provider, modelId, prompt, options = {}, onProgress = null) {
    try {
      if (!this.providers[provider]) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const result = await this.providers[provider].generateImage(modelId, prompt, options, onProgress);
      
      // Add provider info to result
      result.provider_used = provider;
      result.provider_configured = this.providers[provider].isConfigured ? this.providers[provider].isConfigured() : !!this.providers[provider].apiKey;
      
      return result;
    } catch (error) {
      console.error(`Image generation failed for provider ${provider}:`, error.message);
      
      // For images, try Hugging Face as fallback (since it has image models)
      if (provider !== 'huggingface') {
        console.log(`🔄 Trying Hugging Face for image generation fallback`);
        return this.generateImage('huggingface', 'stable-diffusion-xl', prompt, options, onProgress);
      }
      
      return {
        success: false,
        error: 'Image generation is currently unavailable',
        provider_used: provider
      };
    }
  }

  /**
   * Map model ID from one provider to equivalent in another provider
   */
  mapModelToProvider(modelId, fromProvider, toProvider) {
    const modelMappings = {
      // HuggingFace to Gemini mappings
      'llama2-7b': { 'google-gemini': 'gemini-pro' },
      'llama2-13b': { 'google-gemini': 'gemini-pro' },
      'codellama-7b': { 'google-gemini': 'gemini-pro' },
      'mistral-7b': { 'google-gemini': 'gemini-pro' },
      
      // Gemini to HuggingFace mappings
      'gemini-pro': { 'huggingface': 'llama2-7b' },
      'gemini-pro-vision': { 'huggingface': 'llama2-7b' }
    };

    return modelMappings[modelId]?.[toProvider] || null;
  }

  /**
   * Get all available models from all providers
   */
  getAllAvailableModels() {
    const allModels = {
      text_models: [],
      image_models: [],
      providers: {}
    };

    for (const [providerName, provider] of Object.entries(this.providers)) {
      try {
        const models = provider.getAvailableModels ? provider.getAvailableModels() : this.extractModelsFromProvider(provider, providerName);
        
        // Add provider prefix to model IDs to avoid conflicts
        const textModels = models.text?.map(model => ({
          ...model,
          provider: providerName,
          full_id: `${providerName}:${model.id}`,
          configured: provider.isConfigured ? provider.isConfigured() : !!provider.apiKey
        })) || [];

        const imageModels = models.image?.map(model => ({
          ...model,
          provider: providerName,
          full_id: `${providerName}:${model.id}`,
          configured: provider.isConfigured ? provider.isConfigured() : !!provider.apiKey
        })) || [];

        allModels.text_models.push(...textModels);
        allModels.image_models.push(...imageModels);
        
        allModels.providers[providerName] = {
          configured: provider.isConfigured ? provider.isConfigured() : !!provider.apiKey,
          text_models_count: textModels.length,
          image_models_count: imageModels.length
        };
      } catch (error) {
        console.error(`Error getting models from ${providerName}:`, error.message);
      }
    }

    return allModels;
  }

  /**
   * Extract models from provider (fallback method)
   */
  extractModelsFromProvider(provider, providerName) {
    const models = { text: [], image: [] };
    
    if (provider.models) {
      // Extract text models
      if (provider.models.text) {
        models.text = Object.keys(provider.models.text).map(key => ({
          id: key,
          name: provider.models.text[key].hfModel || provider.models.text[key].name || key,
          cost_per_token: provider.models.text[key].costPerToken,
          max_tokens: provider.models.text[key].maxTokens
        }));
      }
      
      // Extract image models
      if (provider.models.image) {
        models.image = Object.keys(provider.models.image).map(key => ({
          id: key,
          name: provider.models.image[key].hfModel || provider.models.image[key].name || key,
          cost_per_image: provider.models.image[key].costPerImage
        }));
      }
    }
    
    return models;
  }

  /**
   * Get list of configured providers
   */
  getConfiguredProviders() {
    return Object.entries(this.providers)
      .filter(([name, provider]) => {
        return provider.isConfigured ? provider.isConfigured() : !!provider.apiKey;
      })
      .map(([name]) => name);
  }

  /**
   * Get provider statistics
   */
  getProviderStats() {
    const stats = {};
    
    for (const [name, provider] of Object.entries(this.providers)) {
      stats[name] = {
        configured: provider.isConfigured ? provider.isConfigured() : !!provider.apiKey,
        api_key_length: provider.apiKey ? provider.apiKey.length : 0,
        has_text_models: !!(provider.models?.text && Object.keys(provider.models.text).length > 0),
        has_image_models: !!(provider.models?.image && Object.keys(provider.models.image).length > 0)
      };
    }
    
    return stats;
  }

  /**
   * Smart provider selection based on model type and availability
   */
  selectBestProvider(modelId, taskType = 'text') {
    const configuredProviders = this.getConfiguredProviders();
    
    // If no providers configured, use first available (mocks will be used)
    if (configuredProviders.length === 0) {
      return this.providerPriority[0];
    }
    
    // For text generation, prefer Gemini (faster and cheaper)
    if (taskType === 'text') {
      if (configuredProviders.includes('google-gemini')) {
        return 'google-gemini';
      }
      if (configuredProviders.includes('huggingface')) {
        return 'huggingface';
      }
    }
    
    // For image generation, use HuggingFace
    if (taskType === 'image') {
      if (configuredProviders.includes('huggingface')) {
        return 'huggingface';
      }
    }
    
    // Fallback to first configured provider
    return configuredProviders[0];
  }
}

module.exports = MultiProviderAIManager;