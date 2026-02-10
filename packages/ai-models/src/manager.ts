/**
 * AI Model Manager
 * Unified interface for multiple AI providers
 */

import { HuggingFaceClient } from './huggingface';
import { createError, Task, NeuroGridError } from '@neurogrid/shared';

export interface AIProvider {
  name: string;
  type: 'api' | 'local' | 'hybrid';
  capabilities: string[];
  authenticate(credentials: Record<string, any>): Promise<boolean>;
  generateText(model: string, prompt: string, parameters?: any): Promise<{ text: string; metadata?: any }>;
  generateImage?(model: string, prompt: string, parameters?: any): Promise<{ image: Buffer; metadata?: any }>;
  classifyText?(model: string, text: string, parameters?: any): Promise<{ labels: string[]; scores: number[] }>;
  extractFeatures?(model: string, inputs: string | string[]): Promise<number[][] | number[]>;
  listModels?(): Promise<string[]>;
}

export interface ModelCapabilities {
  text_generation: boolean;
  image_generation: boolean;
  text_classification: boolean;
  question_answering: boolean;
  summarization: boolean;
  translation: boolean;
  feature_extraction: boolean;
}

export interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  type: string;
  capabilities: ModelCapabilities;
  requirements: {
    min_gpu_memory: number;
    estimated_vram: number;
    api_key_required: boolean;
  };
  pricing: {
    per_request?: number;
    per_token?: number;
    per_minute?: number;
  };
  performance: {
    avg_latency: number;
    throughput: number;
    success_rate: number;
  };
  description: string;
  tags: string[];
}

export class HuggingFaceProvider implements AIProvider {
  name = 'huggingface';
  type: 'api' = 'api';
  capabilities = ['text_generation', 'image_generation', 'text_classification', 'question_answering', 'summarization', 'translation', 'feature_extraction'];
  
  private client: HuggingFaceClient;
  private authenticated = false;

  constructor() {
    // Client will be initialized when authenticate is called
    this.client = null as any;
  }

  async authenticate(credentials: { api_key: string }): Promise<boolean> {
    try {
      this.client = new HuggingFaceClient({
        apiKey: credentials.api_key
      });
      
      // Test authentication with a simple model info request
      await this.client.getModelInfo('gpt2');
      this.authenticated = true;
      return true;
    } catch (error) {
      this.authenticated = false;
      return false;
    }
  }

  async generateText(model: string, prompt: string, parameters?: any): Promise<{ text: string; metadata?: any }> {
    if (!this.authenticated) {
      throw createError('PROVIDER_NOT_AUTHENTICATED', 'HuggingFace provider not authenticated', 403);
    }

    try {
      const result = await this.client.generateText(model, prompt, parameters);
      return {
        text: result.generated_text,
        metadata: {
          model,
          provider: this.name,
          ...result.details
        }
      };
    } catch (error) {
      throw this.wrapError(error, 'text_generation', model);
    }
  }

  async generateImage(model: string, prompt: string, parameters?: any): Promise<{ image: Buffer; metadata?: any }> {
    if (!this.authenticated) {
      throw createError('PROVIDER_NOT_AUTHENTICATED', 'HuggingFace provider not authenticated', 403);
    }

    try {
      const image = await this.client.generateImage(model, prompt, parameters);
      return {
        image,
        metadata: {
          model,
          provider: this.name,
          prompt,
          parameters
        }
      };
    } catch (error) {
      throw this.wrapError(error, 'image_generation', model);
    }
  }

  async classifyText(model: string, text: string, parameters?: any): Promise<{ labels: string[]; scores: number[] }> {
    if (!this.authenticated) {
      throw createError('PROVIDER_NOT_AUTHENTICATED', 'HuggingFace provider not authenticated', 403);
    }

    try {
      return await this.client.classifyText(model, text, parameters?.candidate_labels, parameters);
    } catch (error) {
      throw this.wrapError(error, 'text_classification', model);
    }
  }

  async extractFeatures(model: string, inputs: string | string[]): Promise<number[][] | number[]> {
    if (!this.authenticated) {
      throw createError('PROVIDER_NOT_AUTHENTICATED', 'HuggingFace provider not authenticated', 403);
    }

    try {
      return await this.client.extractFeatures(model, inputs);
    } catch (error) {
      throw this.wrapError(error, 'feature_extraction', model);
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.authenticated) {
      throw createError('PROVIDER_NOT_AUTHENTICATED', 'HuggingFace provider not authenticated', 403);
    }

    try {
      const models = await this.client.listModelsByTask('text-generation', 50);
      return models.map(m => m.id);
    } catch (error) {
      throw this.wrapError(error, 'list_models', 'all');
    }
  }

  private wrapError(error: any, operation: string, model: string): NeuroGridError {
    if (error instanceof NeuroGridError) {
      return error;
    }

    return createError(
      'HUGGINGFACE_ERROR',
      `HuggingFace ${operation} failed: ${error.message}`,
      500,
      { provider: this.name, operation, model, originalError: error.message }
    );
  }
}

export class AIModelManager {
  private providers: Map<string, AIProvider> = new Map();
  private modelCache: Map<string, ModelMetadata> = new Map();

  constructor() {
    // Register default providers
    this.registerProvider(new HuggingFaceProvider());
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  async authenticateProvider(providerName: string, credentials: Record<string, any>): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw createError('PROVIDER_NOT_FOUND', `Provider ${providerName} not found`, 404);
    }

    return await provider.authenticate(credentials);
  }

  async executeTask(task: Partial<Task>): Promise<{ output: any; metadata: any; cost: number }> {
    if (!task.model || !task.type || !task.input_data) {
      throw createError('INVALID_TASK', 'Task missing required fields: model, type, input_data', 400);
    }

    const { provider: providerName, modelId } = this.parseModelPath(task.model);
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw createError('PROVIDER_NOT_FOUND', `Provider ${providerName} not found`, 404);
    }

    const startTime = Date.now();
    let output: any;
    let tokensUsed = 0;
    let bytesTransferred = 0;

    try {
      switch (task.type) {
        case 'inference':
          if (task.input_data.type === 'text') {
            const result = await provider.generateText(
              modelId,
              task.input_data.prompt,
              task.parameters
            );
            output = { text: result.text };
            tokensUsed = this.estimateTokens(task.input_data.prompt + result.text);
          } else if (task.input_data.type === 'image' && provider.generateImage) {
            const result = await provider.generateImage(
              modelId,
              task.input_data.prompt,
              task.parameters
            );
            output = { image_data: result.image.toString('base64') };
            bytesTransferred = result.image.length;
          } else {
            throw createError('UNSUPPORTED_INPUT_TYPE', `Input type ${task.input_data.type} not supported`, 400);
          }
          break;

        case 'embedding':
          if (provider.extractFeatures) {
            const features = await provider.extractFeatures(modelId, task.input_data.text);
            output = { embeddings: features };
            tokensUsed = this.estimateTokens(task.input_data.text);
          } else {
            throw createError('FEATURE_NOT_SUPPORTED', 'Feature extraction not supported by provider', 400);
          }
          break;

        case 'generation':
          if (task.input_data.modality === 'text') {
            const result = await provider.generateText(
              modelId,
              task.input_data.prompt,
              task.parameters
            );
            output = { generated_text: result.text };
            tokensUsed = this.estimateTokens(task.input_data.prompt + result.text);
          } else if (task.input_data.modality === 'image' && provider.generateImage) {
            const result = await provider.generateImage(
              modelId,
              task.input_data.prompt,
              task.parameters
            );
            output = { generated_image: result.image.toString('base64') };
            bytesTransferred = result.image.length;
          }
          break;

        default:
          throw createError('UNSUPPORTED_TASK_TYPE', `Task type ${task.type} not supported`, 400);
      }

      const executionTime = Date.now() - startTime;
      const cost = this.calculateCost(providerName, modelId, tokensUsed, bytesTransferred, executionTime);

      return {
        output,
        metadata: {
          provider: providerName,
          model: modelId,
          execution_time: executionTime,
          tokens_used: tokensUsed,
          bytes_transferred: bytesTransferred,
          timestamp: new Date().toISOString()
        },
        cost
      };

    } catch (error: any) {
      throw createError(
        'TASK_EXECUTION_FAILED',
        `Task execution failed: ${error.message}`,
        500,
        {
          task_id: task.id,
          provider: providerName,
          model: modelId,
          type: task.type,
          error: error.message
        }
      );
    }
  }

  async getAvailableModels(capability?: string): Promise<ModelMetadata[]> {
    const models: ModelMetadata[] = [];

    for (const [providerName, provider] of this.providers) {
      try {
        if (provider.listModels) {
          const modelIds = await provider.listModels();
          
          for (const modelId of modelIds) {
            const metadata = await this.getModelMetadata(providerName, modelId);
            
            if (!capability || this.hasCapability(metadata, capability)) {
              models.push(metadata);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to list models for provider ${providerName}:`, error);
      }
    }

    return models;
  }

  async getModelMetadata(provider: string, modelId: string): Promise<ModelMetadata> {
    const cacheKey = `${provider}:${modelId}`;
    
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    // Create default metadata - in production, this would fetch from provider APIs
    const metadata: ModelMetadata = {
      id: `${provider}:${modelId}`,
      name: modelId,
      provider,
      type: this.inferModelType(modelId),
      capabilities: this.inferCapabilities(modelId),
      requirements: {
        min_gpu_memory: this.estimateGPUMemory(modelId),
        estimated_vram: this.estimateGPUMemory(modelId),
        api_key_required: provider !== 'local'
      },
      pricing: {
        per_request: 0.01,
        per_token: 0.0001,
        per_minute: 0.05
      },
      performance: {
        avg_latency: 2000,
        throughput: 50,
        success_rate: 95
      },
      description: `AI model ${modelId} from ${provider}`,
      tags: this.inferTags(modelId)
    };

    this.modelCache.set(cacheKey, metadata);
    return metadata;
  }

  private parseModelPath(modelPath: string): { provider: string; modelId: string } {
    if (modelPath.includes(':')) {
      const [provider, ...modelParts] = modelPath.split(':');
      return { provider, modelId: modelParts.join(':') };
    }

    // Default to huggingface if no provider specified
    return { provider: 'huggingface', modelId: modelPath };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private calculateCost(_provider: string, _model: string, tokens: number, bytes: number, timeMs: number): number {
    // Basic cost calculation - in production, this would use real pricing data
    const baseCost = 0.01; // Base cost per request
    const tokenCost = tokens * 0.0001; // $0.0001 per token
    const timeCost = (timeMs / 1000) * 0.001; // $0.001 per second
    const dataCost = (bytes / 1024 / 1024) * 0.001; // $0.001 per MB

    return Math.round((baseCost + tokenCost + timeCost + dataCost) * 100) / 100;
  }

  private inferModelType(modelId: string): string {
    const id = modelId.toLowerCase();
    
    if (id.includes('stable-diffusion') || id.includes('dall-e') || id.includes('imagen')) {
      return 'image-generation';
    }
    if (id.includes('gpt') || id.includes('llama') || id.includes('claude')) {
      return 'text-generation';
    }
    if (id.includes('bert') || id.includes('roberta')) {
      return 'text-classification';
    }
    if (id.includes('t5') || id.includes('bart')) {
      return 'text2text-generation';
    }
    
    return 'text-generation'; // Default
  }

  private inferCapabilities(modelId: string): ModelCapabilities {
    const type = this.inferModelType(modelId);
    
    return {
      text_generation: type.includes('text') || type === 'text-generation',
      image_generation: type === 'image-generation',
      text_classification: type === 'text-classification' || modelId.includes('sentiment'),
      question_answering: modelId.includes('qa') || modelId.includes('squad'),
      summarization: modelId.includes('bart') || modelId.includes('pegasus') || modelId.includes('summary'),
      translation: modelId.includes('translate') || modelId.includes('mt-'),
      feature_extraction: modelId.includes('sentence') || modelId.includes('embed')
    };
  }

  private estimateGPUMemory(modelId: string): number {
    const id = modelId.toLowerCase();
    
    // Rough estimates based on common models
    if (id.includes('xl') || id.includes('large') || id.includes('13b')) return 16;
    if (id.includes('7b')) return 8;
    if (id.includes('3b')) return 4;
    if (id.includes('base') || id.includes('medium')) return 2;
    if (id.includes('small') || id.includes('mini')) return 1;
    
    return 4; // Default
  }

  private inferTags(modelId: string): string[] {
    const tags: string[] = [];
    const id = modelId.toLowerCase();
    
    if (id.includes('gpt')) tags.push('openai', 'generative');
    if (id.includes('bert')) tags.push('google', 'transformer');
    if (id.includes('llama')) tags.push('meta', 'open-source');
    if (id.includes('stable')) tags.push('stability-ai', 'diffusion');
    if (id.includes('huggingface')) tags.push('huggingface');
    
    return tags;
  }

  private hasCapability(metadata: ModelMetadata, capability: string): boolean {
    return (metadata.capabilities as any)[capability] === true;
  }
}

// Export singleton instance
export const aiModelManager = new AIModelManager();