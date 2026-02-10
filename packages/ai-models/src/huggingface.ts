/**
 * Hugging Face API Integration
 * Real AI model execution via Hugging Face Inference API
 */

import axios, { AxiosInstance } from 'axios';
import { createError } from '@neurogrid/shared';

export interface HuggingFaceConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ModelInfo {
  id: string;
  author: string;
  pipeline_tag: string;
  tags: string[];
  downloads: number;
  likes: number;
  library_name?: string;
  model_index?: any;
}

export interface InferenceOptions {
  wait_for_model?: boolean;
  use_cache?: boolean;
  parameters?: Record<string, any>;
}

export interface TextGenerationParameters {
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  return_full_text?: boolean;
  do_sample?: boolean;
  seed?: number;
}

export interface TextClassificationParameters {
  candidate_labels?: string[];
  multi_label?: boolean;
}

export interface ImageGenerationParameters {
  negative_prompt?: string;
  height?: number;
  width?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
}

export class HuggingFaceClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: HuggingFaceConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api-inference.huggingface.co',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    try {
      const response = await axios.get(`https://huggingface.co/api/models/${modelId}`);
      return response.data;
    } catch (error: any) {
      throw createError(
        'MODEL_INFO_FAILED',
        `Failed to get model info for ${modelId}: ${error.message}`,
        500,
        { modelId, error: error.message }
      );
    }
  }

  /**
   * Text Generation
   */
  async generateText(
    modelId: string,
    prompt: string,
    parameters?: TextGenerationParameters,
    options?: InferenceOptions
  ): Promise<{ generated_text: string; details?: any }> {
    try {
      const payload = {
        inputs: prompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
          ...parameters
        },
        options: {
          wait_for_model: true,
          use_cache: false,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload);
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        return {
          generated_text: response.data[0].generated_text || response.data[0].summary_text,
          details: response.data[0]
        };
      }

      return {
        generated_text: response.data.generated_text || response.data[0]?.generated_text || '',
        details: response.data
      };
    } catch (error: any) {
      if (error.response?.status === 503) {
        throw createError(
          'MODEL_LOADING',
          'Model is currently loading, please try again in a few moments',
          503,
          { modelId, estimatedTime: error.response.data?.estimated_time }
        );
      }

      throw createError(
        'TEXT_GENERATION_FAILED',
        `Text generation failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId, prompt: prompt.substring(0, 100) + '...', error: error.message }
      );
    }
  }

  /**
   * Text Classification
   */
  async classifyText(
    modelId: string,
    text: string,
    candidateLabels?: string[],
    parameters?: TextClassificationParameters,
    options?: InferenceOptions
  ): Promise<{ labels: string[]; scores: number[] }> {
    try {
      const payload = {
        inputs: text,
        parameters: {
          candidate_labels: candidateLabels || ['positive', 'negative', 'neutral'],
          ...parameters
        },
        options: {
          wait_for_model: true,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload);
      
      return {
        labels: response.data.labels || [],
        scores: response.data.scores || []
      };
    } catch (error: any) {
      throw createError(
        'TEXT_CLASSIFICATION_FAILED',
        `Text classification failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId, text: text.substring(0, 100) + '...' }
      );
    }
  }

  /**
   * Image Generation
   */
  async generateImage(
    modelId: string,
    prompt: string,
    parameters?: ImageGenerationParameters,
    options?: InferenceOptions
  ): Promise<Buffer> {
    try {
      const payload = {
        inputs: prompt,
        parameters: {
          height: 512,
          width: 512,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          ...parameters
        },
        options: {
          wait_for_model: true,
          use_cache: false,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png'
        }
      });

      if (response.data instanceof ArrayBuffer) {
        return Buffer.from(response.data);
      }

      return response.data;
    } catch (error: any) {
      throw createError(
        'IMAGE_GENERATION_FAILED',
        `Image generation failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId, prompt: prompt.substring(0, 100) + '...' }
      );
    }
  }

  /**
   * Feature Extraction / Embeddings
   */
  async extractFeatures(
    modelId: string,
    inputs: string | string[],
    options?: InferenceOptions
  ): Promise<number[][] | number[]> {
    try {
      const payload = {
        inputs: inputs,
        options: {
          wait_for_model: true,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload);
      return response.data;
    } catch (error: any) {
      throw createError(
        'FEATURE_EXTRACTION_FAILED',
        `Feature extraction failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId, inputType: typeof inputs }
      );
    }
  }

  /**
   * Question Answering
   */
  async answerQuestion(
    modelId: string,
    question: string,
    context: string,
    options?: InferenceOptions
  ): Promise<{ answer: string; score: number; start: number; end: number }> {
    try {
      const payload = {
        inputs: {
          question: question,
          context: context
        },
        options: {
          wait_for_model: true,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload);
      return response.data;
    } catch (error: any) {
      throw createError(
        'QUESTION_ANSWERING_FAILED',
        `Question answering failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId, question }
      );
    }
  }

  /**
   * Summarization
   */
  async summarizeText(
    modelId: string,
    text: string,
    parameters?: { min_length?: number; max_length?: number },
    options?: InferenceOptions
  ): Promise<{ summary_text: string }> {
    try {
      const payload = {
        inputs: text,
        parameters: {
          min_length: 50,
          max_length: 200,
          ...parameters
        },
        options: {
          wait_for_model: true,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload);
      
      if (Array.isArray(response.data)) {
        return response.data[0];
      }
      
      return response.data;
    } catch (error: any) {
      throw createError(
        'SUMMARIZATION_FAILED',
        `Text summarization failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId }
      );
    }
  }

  /**
   * Translation
   */
  async translateText(
    modelId: string,
    text: string,
    options?: InferenceOptions
  ): Promise<{ translation_text: string }> {
    try {
      const payload = {
        inputs: text,
        options: {
          wait_for_model: true,
          ...options
        }
      };

      const response = await this.client.post(`/models/${modelId}`, payload);
      
      if (Array.isArray(response.data)) {
        return response.data[0];
      }
      
      return response.data;
    } catch (error: any) {
      throw createError(
        'TRANSLATION_FAILED',
        `Translation failed: ${error.response?.data?.error || error.message}`,
        500,
        { modelId }
      );
    }
  }

  /**
   * Check if model is available
   */
  async checkModelStatus(modelId: string): Promise<{ loaded: boolean; estimatedTime?: number }> {
    try {
      // Send a minimal request to check model status
      await this.client.post(`/models/${modelId}`, {
        inputs: "test",
        options: { wait_for_model: false }
      });
      
      return { loaded: true };
    } catch (error: any) {
      if (error.response?.status === 503) {
        return {
          loaded: false,
          estimatedTime: error.response.data?.estimated_time
        };
      }
      
      throw createError(
        'MODEL_STATUS_CHECK_FAILED',
        `Failed to check model status: ${error.message}`,
        500,
        { modelId }
      );
    }
  }

  /**
   * List available models by task
   */
  async listModelsByTask(task: string, limit: number = 20): Promise<ModelInfo[]> {
    try {
      const response = await axios.get('https://huggingface.co/api/models', {
        params: {
          pipeline_tag: task,
          limit: limit,
          full: 'true'
        }
      });

      return response.data;
    } catch (error: any) {
      throw createError(
        'MODEL_LIST_FAILED',
        `Failed to list models: ${error.message}`,
        500,
        { task, limit }
      );
    }
  }
}

// Default model recommendations for different tasks
export const RECOMMENDED_MODELS = {
  TEXT_GENERATION: [
    'microsoft/DialoGPT-medium',
    'gpt2',
    'distilgpt2',
    'facebook/blenderbot-400M-distill'
  ],
  TEXT_CLASSIFICATION: [
    'cardiffnlp/twitter-roberta-base-sentiment-latest',
    'nlptown/bert-base-multilingual-uncased-sentiment',
    'distilbert-base-uncased-finetuned-sst-2-english'
  ],
  QUESTION_ANSWERING: [
    'distilbert-base-cased-distilled-squad',
    'deepset/roberta-base-squad2',
    'microsoft/DialoGPT-medium'
  ],
  SUMMARIZATION: [
    'facebook/bart-large-cnn',
    'google/pegasus-xsum',
    'sshleifer/distilbart-cnn-12-6'
  ],
  IMAGE_GENERATION: [
    'runwayml/stable-diffusion-v1-5',
    'stabilityai/stable-diffusion-2-1',
    'CompVis/stable-diffusion-v1-4'
  ],
  FEATURE_EXTRACTION: [
    'sentence-transformers/all-MiniLM-L6-v2',
    'sentence-transformers/all-mpnet-base-v2',
    'thenlper/gte-small'
  ],
  TRANSLATION: [
    'Helsinki-NLP/opus-mt-en-de',
    'Helsinki-NLP/opus-mt-en-fr',
    'facebook/m2m100_418M'
  ]
};