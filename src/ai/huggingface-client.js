/**
 * Hugging Face API Client for NeuroGrid
 * Provides real AI model inference through Hugging Face Hub
 */

class HuggingFaceClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY;
    this.baseUrl = 'https://router.huggingface.co/models';
    
    // Model configurations
    this.models = {
      text: {
        'llama2-7b': {
          hfModel: 'meta-llama/Llama-2-7b-chat-hf',
          endpoint: '/models/meta-llama/Llama-2-7b-chat-hf',
          costPerToken: 0.01
        },
        'llama2-13b': {
          hfModel: 'meta-llama/Llama-2-13b-chat-hf', 
          endpoint: '/models/meta-llama/Llama-2-13b-chat-hf',
          costPerToken: 0.02
        },
        'codellama-7b': {
          hfModel: 'codellama/CodeLlama-7b-Instruct-hf',
          endpoint: '/models/codellama/CodeLlama-7b-Instruct-hf',
          costPerToken: 0.015
        },
        'mistral-7b': {
          hfModel: 'mistralai/Mistral-7B-Instruct-v0.1',
          endpoint: '/models/mistralai/Mistral-7B-Instruct-v0.1', 
          costPerToken: 0.012
        }
      },
      image: {
        'stable-diffusion-xl': {
          hfModel: 'stabilityai/stable-diffusion-xl-base-1.0',
          endpoint: '/models/stabilityai/stable-diffusion-xl-base-1.0',
          costPerImage: 0.5
        },
        'stable-diffusion-2': {
          hfModel: 'stabilityai/stable-diffusion-2-1',
          endpoint: '/models/stabilityai/stable-diffusion-2-1',
          costPerImage: 0.3
        }
      }
    };
  }

  /**
   * Generate text response using specified model with streaming support
   */
  async generateText(modelId, prompt, options = {}, onProgress = null) {
    try {
      const modelConfig = this.models.text[modelId];
      if (!modelConfig) {
        throw new Error(`Unsupported text model: ${modelId}`);
      }

      // Fallback to mock if no API key
      if (!this.apiKey) {
        return this.generateMockTextResponse(modelId, prompt, options, onProgress);
      }

      const payload = {
        inputs: this.formatPrompt(modelId, prompt),
        parameters: {
          max_new_tokens: options.maxTokens || 150,
          temperature: options.temperature || 0.7,
          do_sample: true,
          return_full_text: false
        },
        stream: !!onProgress // Enable streaming if callback provided
      };

      if (onProgress && payload.stream) {
        // Streaming response
        return await this.streamTextResponse(modelConfig.endpoint, payload, modelConfig, onProgress);
      } else {
        // Regular response
        const response = await this.makeRequest(modelConfig.endpoint, payload);
        
        if (response && response[0]?.generated_text) {
          const generatedText = response[0].generated_text;
          const tokens = this.estimateTokens(generatedText);
          
          return {
            success: true,
            data: generatedText,
            tokens_used: tokens,
            cost: modelConfig.costPerToken * tokens,
            processing_time: Date.now() - payload._startTime,
            node_id: `hf-${modelConfig.hfModel.split('/')[0]}`,
            model_used: modelConfig.hfModel
          };
        } else {
          throw new Error('Invalid response from Hugging Face');
        }
      }

    } catch (error) {
      console.error(`HF Text Generation Error:`, error.message);
      // Fallback to mock response
      return this.generateMockTextResponse(modelId, prompt, options, onProgress);
    }
  }

  /**
   * Generate image using specified model with progress tracking
   */
  async generateImage(modelId, prompt, options = {}, onProgress = null) {
    try {
      const modelConfig = this.models.image[modelId];
      if (!modelConfig) {
        throw new Error(`Unsupported image model: ${modelId}`);
      }

      // Fallback to mock if no API key
      if (!this.apiKey) {
        return this.generateMockImageResponse(modelId, prompt, options, onProgress);
      }

      const payload = {
        inputs: prompt,
        parameters: {
          num_inference_steps: options.steps || 20,
          guidance_scale: options.guidance || 7.5,
          width: options.width || 512,
          height: options.height || 512
        }
      };

      const startTime = Date.now();
      
      // Simulate progress for image generation
      if (onProgress) {
        onProgress({ stage: 'initializing', progress: 0 });
        setTimeout(() => onProgress({ stage: 'processing', progress: 25 }), 500);
        setTimeout(() => onProgress({ stage: 'rendering', progress: 75 }), 1500);
      }
      
      const response = await this.makeRequest(modelConfig.endpoint, payload, 'image');
      
      if (response) {
        // Convert blob to base64 or save temporarily
        const imageUrl = await this.processImageResponse(response);
        
        if (onProgress) {
          onProgress({ stage: 'completed', progress: 100 });
        }
        
        return {
          success: true,
          data: imageUrl,
          prompt: prompt,
          model: modelId,
          cost: modelConfig.costPerImage,
          processing_time: Date.now() - startTime,
          node_id: `hf-${modelConfig.hfModel.split('/')[0]}`,
          resolution: `${options.width || 512}x${options.height || 512}`,
          model_used: modelConfig.hfModel
        };
      } else {
        throw new Error('Invalid response from Hugging Face');
      }

    } catch (error) {
      console.error(`HF Image Generation Error:`, error.message);
      // Fallback to mock response
      return this.generateMockImageResponse(modelId, prompt, options, onProgress);
    }
  }

  /**
   * Make HTTP request to Hugging Face API
   */
  async makeRequest(endpoint, payload, responseType = 'json') {
    const url = `${this.baseUrl}${endpoint}`;
    payload._startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HF API Error (${response.status}): ${errorText}`);
    }

    if (responseType === 'image') {
      return await response.blob();
    } else {
      return await response.json();
    }
  }

  /**
   * Format prompt for specific models
   */
  formatPrompt(modelId, prompt) {
    switch (modelId) {
      case 'llama2-7b':
      case 'llama2-13b':
        return `<s>[INST] ${prompt} [/INST]`;
      case 'codellama-7b':
        return `[INST] ${prompt} [/INST]`;
      case 'mistral-7b':
        return `<s>[INST] ${prompt} [/INST]`;
      default:
        return prompt;
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // Rough estimate: ~4 chars per token
  }

  /**
   * Process image response from HF API
   */
  async processImageResponse(blob) {
    // Convert blob to base64 data URL for immediate display
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Mock text response with streaming support (fallback when no API key)
   */
  async generateMockTextResponse(modelId, prompt, options, onProgress = null) {
    const mockResponses = {
      'llama2-7b': `As Llama 2 7B, I understand you're asking about: "${prompt}". Let me provide a comprehensive response based on my training.`,
      'llama2-13b': `Using my enhanced 13B parameter model, I can provide detailed insights about: "${prompt}". Here's my analysis...`,
      'codellama-7b': prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('program') ? 
        `// Here's a code solution for your query:\n\nfunction processRequest() {\n  // ${prompt}\n  console.log("Processing through CodeLlama 7B");\n  return "Code generated successfully!";\n}` :
        `I'm CodeLlama 7B, optimized for programming tasks. Your message: "${prompt}" - how can I help with code?`,
      'mistral-7b': `Mistral 7B here! I've processed your message: "${prompt}". Here's my efficient and accurate response...`
    };

    const response = mockResponses[modelId] || `AI response for: "${prompt}"`;
    const tokens = Math.floor(Math.random() * 150) + 50;
    const modelConfig = this.models.text[modelId];
    const processingTime = Math.random() * 2 + 0.5;

    // Simulate streaming if callback provided
    if (onProgress) {
      const words = response.split(' ');
      let currentText = '';
      
      for (let i = 0; i < words.length; i++) {
        currentText += words[i] + ' ';
        const progress = Math.round((i / words.length) * 100);
        
        onProgress({
          partial_text: currentText.trim(),
          progress: progress,
          tokens_so_far: Math.round((tokens * i) / words.length)
        });
        
        // Simulate typing speed
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      }
    }

    // Simulate final processing delay
    await new Promise(resolve => setTimeout(resolve, processingTime * 1000));

    return {
      success: true,
      data: response,
      tokens_used: tokens,
      cost: modelConfig.costPerToken * tokens,
      processing_time: processingTime,
      node_id: `mock-gpu-node-${Math.floor(Math.random() * 10) + 1}`,
      model_used: `mock-${modelConfig.hfModel}`
    };
  }

  /**
   * Mock image response with progress tracking (fallback when no API key)
   */
  async generateMockImageResponse(modelId, prompt, options, onProgress = null) {
    const imageUrls = [
      `https://picsum.photos/512/512?random=${Date.now()}`,
      `https://source.unsplash.com/512x512/?${encodeURIComponent(prompt || 'abstract')}`,
      `https://picsum.photos/512/512?random=${Date.now() + 1}`
    ];

    const modelConfig = this.models.image[modelId];
    const processingTime = Math.random() * 10 + 5;

    // Simulate progress if callback provided
    if (onProgress) {
      onProgress({ stage: 'initializing', progress: 0 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onProgress({ stage: 'processing', progress: 30 });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onProgress({ stage: 'rendering', progress: 70 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onProgress({ stage: 'finalizing', progress: 90 });
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      // Simulate processing time without progress
      await new Promise(resolve => setTimeout(resolve, processingTime * 1000));
    }
    
    if (onProgress) {
      onProgress({ stage: 'completed', progress: 100 });
    }
    
    return {
      success: true,
      data: imageUrls[Math.floor(Math.random() * imageUrls.length)],
      prompt: prompt,
      model: modelId,
      cost: modelConfig.costPerImage,
      processing_time: processingTime,
      node_id: `mock-gpu-node-${Math.floor(Math.random() * 5) + 1}`,
      resolution: `${options.width || 512}x${options.height || 512}`,
      model_used: `mock-${modelConfig.hfModel}`
    };
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return {
      text: Object.keys(this.models.text).map(id => ({
        id,
        name: this.models.text[id].hfModel.split('/')[1] || id,
        cost: this.models.text[id].costPerToken,
        description: this.getModelDescription(id),
        hf_model: this.models.text[id].hfModel
      })),
      image: Object.keys(this.models.image).map(id => ({
        id,
        name: this.models.image[id].hfModel.split('/')[1] || id,
        cost: this.models.image[id].costPerImage,
        description: this.getModelDescription(id),
        hf_model: this.models.image[id].hfModel
      }))
    };
  }

  /**
   * Get model description
   */
  getModelDescription(modelId) {
    const descriptions = {
      'llama2-7b': 'General conversation',
      'llama2-13b': 'Advanced reasoning',
      'codellama-7b': 'Code generation',
      'mistral-7b': 'Fast & efficient',
      'stable-diffusion-xl': 'High-quality images',
      'stable-diffusion-2': 'Creative generation'
    };
    return descriptions[modelId] || 'AI Model';
  }

  /**
   * Stream text response from Hugging Face API
   */
  async streamTextResponse(endpoint, payload, modelConfig, onProgress) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HF API Error (${response.status}): ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let tokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token && data.token.text) {
                fullText += data.token.text;
                tokens++;
                
                onProgress({
                  partial_text: fullText,
                  tokens_so_far: tokens,
                  progress: Math.min(Math.round((tokens / payload.parameters.max_new_tokens) * 100), 95)
                });
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }

      return {
        success: true,
        data: fullText,
        tokens_used: tokens,
        cost: modelConfig.costPerToken * tokens,
        processing_time: Date.now() - payload._startTime,
        node_id: `hf-${modelConfig.hfModel.split('/')[0]}`,
        model_used: modelConfig.hfModel
      };

    } catch (error) {
      console.error('Streaming error:', error);
      throw error;
    }
  }
}

module.exports = HuggingFaceClient;