/**
 * External API Integration for NeuroGrid
 * Real working implementation with available public APIs
 */

class ExternalAPIManager {
  constructor() {
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY || null,
      anthropic: process.env.ANTHROPIC_API_KEY || null,
      gemini: process.env.GOOGLE_API_KEY || null, // Google Gemini
      huggingface: process.env.HUGGINGFACE_API_KEY || null
    };

    this.endpoints = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      huggingface: 'https://api-inference.huggingface.co/models'
    };

    this.models = {
      'openai-gpt4': {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        maxTokens: 4096,
        costPer1K: 0.03,
        strengths: ['code-generation', 'analysis', 'reasoning']
      },
      'openai-gpt3.5': {
        provider: 'openai', 
        model: 'gpt-3.5-turbo',
        maxTokens: 4096,
        costPer1K: 0.002,
        strengths: ['text-generation', 'simple-code', 'translation']
      },
      'anthropic-claude': {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20241001',
        maxTokens: 4096,
        costPer1K: 0.015,
        strengths: ['analysis', 'reasoning', 'long-context']
      },
      'google-gemini': {
        provider: 'gemini',
        model: 'gemini-pro',
        maxTokens: 32768,
        costPer1K: 0.0005,
        strengths: ['multimodal', 'large-context', 'fast']
      },
      'huggingface-codellama': {
        provider: 'huggingface',
        model: 'codellama/CodeLlama-34b-Instruct-hf',
        maxTokens: 2048,
        costPer1K: 0.001,
        strengths: ['code-generation', 'open-source']
      }
    };

    // Priority order: cheapest and most reliable first
    this.providerPriority = ['gemini', 'huggingface', 'openai', 'anthropic'];
  }

  /**
   * Проверка доступности API ключей
   */
  getAvailableAPIs() {
    return {
      openai: !!this.apiKeys.openai,
      anthropic: !!this.apiKeys.anthropic,
      gemini: !!this.apiKeys.gemini,
      huggingface: !!this.apiKeys.huggingface
    };
  }

  /**
   * Установка API ключа
   */
  setAPIKey(provider, apiKey) {
    if (provider in this.apiKeys) {
      this.apiKeys[provider] = apiKey;
      console.log(`✅ ${provider.toUpperCase()} API key configured`);
      return true;
    }
    return false;
  }

  /**
   * Выбор лучшего провайдера для задачи
   */
  selectBestProvider(taskType, complexity) {
    const available = Object.entries(this.getAvailableAPIs())
      .filter(([provider, isAvailable]) => isAvailable)
      .map(([provider]) => provider);

    if (available.length === 0) {
      throw new Error('No AI API keys configured');
    }

    // Smart selection based on task type
    if (taskType === 'code-generation') {
      if (available.includes('huggingface')) return 'huggingface'; // CodeLlama
      if (available.includes('openai')) return 'openai';
    }

    if (taskType === 'analysis' || taskType === 'reasoning') {
      if (available.includes('anthropic')) return 'anthropic';
      if (available.includes('openai')) return 'openai';
    }

    // Default: cheapest first
    for (const provider of this.providerPriority) {
      if (available.includes(provider)) {
        return provider;
      }
    }

    return available[0];
  }

  /**
   * Обработка через OpenAI API
   */
  async processOpenAI(prompt, modelConfig = {}) {
    if (!this.apiKeys.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const model = modelConfig.model || 'gpt-3.5-turbo';
    const maxTokens = modelConfig.maxTokens || 2000;
    const temperature = modelConfig.temperature || 0.7;

    try {
      const response = await fetch(this.endpoints.openai, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKeys['github-copilot']}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NeuroGrid-Smart-Router/1.0'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GitHub Copilot API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.choices[0].message.content,
        model: model,
        usage: data.usage,
        cost: this.calculateCost(data.usage, this.models['github-copilot'].costPer1K)
      };

    } catch (error) {
      console.error('GitHub Copilot API Error:', error);
      return {
        success: false,
        error: error.message,
        fallback: 'local'
      };
    }
  }

  /**
   * Обработка через OpenAI API
   */
  async processOpenAI(prompt, modelConfig = {}) {
    if (!this.apiKeys.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const model = modelConfig.model || 'gpt-4-turbo-preview';
    const maxTokens = modelConfig.maxTokens || 2000;
    const temperature = modelConfig.temperature || 0.7;

    try {
      const response = await fetch(this.endpoints.openai, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKeys.openai}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.choices[0].message.content,
        usage: data.usage,
        model: model,
        cost: this.calculateCost('openai', data.usage.total_tokens),
        provider: 'OpenAI'
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Обработка через Anthropic API
   */
  async processAnthropic(prompt, modelConfig = {}) {
    if (!this.apiKeys.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const model = modelConfig.model || 'claude-3-sonnet-20241001';
    const maxTokens = modelConfig.maxTokens || 2000;

    try {
      const response = await fetch(this.endpoints.anthropic, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKeys.anthropic,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API Error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.content[0].text,
        usage: {
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        },
        model: model,
        cost: this.calculateCost('anthropic', data.usage.input_tokens + data.usage.output_tokens),
        provider: 'Anthropic'
      };

    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  /**
   * Универсальный метод обработки через внешний API
   */
  async processExternal(provider, prompt, modelConfig = {}) {
    const startTime = Date.now();

    try {
      let result;

      switch (provider) {
        case 'github-copilot':
          result = await this.processGitHubCopilot(prompt, modelConfig);
          break;
        case 'openai':
          result = await this.processOpenAI(prompt, modelConfig);
          break;
        case 'anthropic':
          result = await this.processAnthropic(prompt, modelConfig);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`External API processing failed: ${error.message}`);
    }
  }

  /**
   * Расчет стоимости
   */
  calculateCost(provider, totalTokens) {
    const rates = {
      'github-copilot': 0.01, // $0.01 per 1K tokens (выгодно с лицензией)
      openai: 0.03,      // $0.03 per 1K tokens for GPT-4
      anthropic: 0.025   // $0.025 per 1K tokens for Claude
    };

    const rate = rates[provider] || 0.01;
    return (totalTokens / 1000) * rate;
  }

  /**
   * Получение статуса API
   */
  getAPIStatus() {
    return {
      'github-copilot': {
        available: !!this.apiKeys['github-copilot'],
        configured: !!this.apiKeys['github-copilot'],
        models: ['gpt-4', 'gpt-3.5-turbo'],
        priority: 1 // высший приоритет
      },
      openai: {
        available: !!this.apiKeys.openai,
        configured: !!this.apiKeys.openai,
        models: ['gpt-4-turbo-preview', 'gpt-3.5-turbo'],
        priority: 2 // fallback
      },
      anthropic: {
        available: !!this.apiKeys.anthropic,
        configured: !!this.apiKeys.anthropic,
        models: ['claude-3-sonnet-20241001', 'claude-3-haiku-20240307'],
        priority: 3 // third choice
      }
    };
  }

  /**
   * Получение доступных API в порядке приоритета
   */
  getAvailableAPIs() {
    return {
      'github-copilot': !!this.apiKeys['github-copilot'],
      anthropic: !!this.apiKeys.anthropic,
      openai: !!this.apiKeys.openai
    };
  }

  /**
   * Тестирование API подключения
   */
  async testAPI(provider) {
    try {
      const testPrompt = "Hello! This is a test message. Please respond with 'API connection successful'.";
      const result = await this.processExternal(provider, testPrompt, { maxTokens: 50 });
      
      console.log(`✅ ${provider.toUpperCase()} API test successful`);
      return {
        success: true,
        provider,
        response: result.content,
        latency: result.processingTime
      };

    } catch (error) {
      console.error(`❌ ${provider.toUpperCase()} API test failed:`, error.message);
      return {
        success: false,
        provider,
        error: error.message
      };
    }
  }

  /**
   * Резервное переключение между API с приоритетом GitHub Copilot
   */
  async processWithFallback(prompt, preferredProvider = 'github-copilot', modelConfig = {}) {
    // Порядок приоритета: GitHub Copilot -> Anthropic -> OpenAI
    const providers = ['github-copilot', 'anthropic', 'openai'].filter(p => !!this.apiKeys[p]);
    
    // Ставим предпочтительного провайдера первым
    if (preferredProvider && providers.includes(preferredProvider)) {
      providers.splice(providers.indexOf(preferredProvider), 1);
      providers.unshift(preferredProvider);
    }

    for (const provider of providers) {
      try {
        console.log(`🔄 Trying ${provider.toUpperCase()} API...`);
        const result = await this.processExternal(provider, prompt, modelConfig);
        console.log(`✅ Successfully processed via ${provider.toUpperCase()}`);
        return result;
        
      } catch (error) {
        console.warn(`⚠️ ${provider.toUpperCase()} failed: ${error.message}`);
        
        // Если это последний провайдер, выбрасываем ошибку
        if (provider === providers[providers.length - 1]) {
          throw new Error(`All external APIs failed. Last error: ${error.message}`);
        }
      }
    }

    throw new Error('No external APIs available');
  }
}

module.exports = ExternalAPIManager;