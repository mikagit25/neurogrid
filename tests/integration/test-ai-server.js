const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import AI Providers
const MultiProviderAIManager = require('./src/ai/multi-provider-manager');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize Multi-Provider AI Manager
const aiManager = new MultiProviderAIManager();

console.log(`🤖 NeuroGrid AI Test Server`);
console.log(`🔑 Provider Status:`);
console.log(`   - Google Gemini: ${aiManager.providers['google-gemini'].apiKey ? 'Configured ✅' : 'Missing (using mocks) ❌'}`);
console.log(`   - HuggingFace: ${aiManager.providers['huggingface'].apiKey ? 'Configured ✅' : 'Missing (using mocks) ❌'}`);

// Test Route
app.get('/', (req, res) => {
  const stats = aiManager.getProviderStats();
  res.send(`
    <h1>🚀 NeuroGrid AI Test Server</h1>
    <h3>🔑 AI Providers Status:</h3>
    <p>Google Gemini: ${stats['google-gemini'].configured ? '✅ Configured' : '❌ Missing (using mocks)'}</p>
    <p>HuggingFace: ${stats['huggingface'].configured ? '✅ Configured' : '❌ Missing (using mocks)'}</p>
    <p>Configured Providers: ${aiManager.getConfiguredProviders().join(', ') || 'none (using mocks)'}</p>
    <h3>🔗 Test Links:</h3>
    <p><a href="/ai-chat.html">🤖 Test AI Chat with Templates</a></p>
    <p><a href="/templates-demo.html">⭐ Templates Demo & Documentation</a></p>
    <p><a href="/test-api">🔧 Test API Endpoint</a></p>
    <p><a href="/models">📋 Available Models</a></p>
  `);
});

// AI Chat API
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, model, provider, options = {} } = req.body;
    
    if (!message || !model) {
      return res.status(400).json({
        success: false,
        error: 'Message and model are required'
      });
    }

    let selectedProvider = provider;
    let selectedModel = model;
    
    // Handle auto model selection
    if (model === 'auto' || model === 'auto-text') {
      const autoSelection = aiManager.selectBestModel('text', provider);
      selectedProvider = autoSelection.provider;
      selectedModel = autoSelection.model;
      console.log(`🎯 Auto-selected: ${selectedProvider}:${selectedModel}`);
    } else {
      // Determine provider (auto-select if not specified)
      selectedProvider = provider || aiManager.selectBestProvider(model, 'text');
    }
    
    console.log(`🤖 Processing: ${selectedProvider}:${selectedModel} - "${message.substring(0, 50)}..."`);    
    
    const result = await aiManager.generateText(selectedProvider, selectedModel, message, options);
    
    // Ensure the correct model name is returned
    result.model = selectedModel;
    
    console.log(`✅ Response: provider=${result.provider_used}, model=${result.model}, tokens=${result.tokens_used}, time=${result.processing_time}ms`);
    
    res.json(result);
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process AI request',
      details: error.message
    });
  }
});

// AI Image API
app.post('/api/ai/image', async (req, res) => {
  try {
    const { prompt, model, provider, options = {} } = req.body;
    
    if (!prompt || !model) {
      return res.status(400).json({
        success: false,
        error: 'Prompt and model are required'
      });
    }

    // Use HuggingFace for image generation (Gemini doesn't support it yet)
    const selectedProvider = provider || 'huggingface';
    
    console.log(`🎨 Processing image: ${selectedProvider}:${model} - "${prompt.substring(0, 50)}..."`);    
    
    const result = await aiManager.generateImage(selectedProvider, model, prompt, options);
    
    console.log(`✅ Image generated: provider=${result.provider_used}, time=${result.processing_time}ms`);
    
    res.json(result);
  } catch (error) {
    console.error('AI Image Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process AI image request',
      details: error.message
    });
  }
});

// Models endpoint
app.get('/api/ai/models', (req, res) => {
  const allModels = aiManager.getAllAvailableModels();
  res.json({
    success: true,
    data: allModels
  });
});

// Detailed models endpoint
app.get('/models', (req, res) => {
  const allModels = aiManager.getAllAvailableModels();
  const stats = aiManager.getProviderStats();
  
  res.send(`
    <h1>📋 Available AI Models</h1>
    <h2>🤖 Text Generation Models:</h2>
    <ul>
    ${allModels.text_models.map(model => 
      `<li><strong>${model.full_id}</strong> - ${model.name} 
       (${model.cost_per_token}/token) ${model.configured ? '✅' : '❌'}</li>`
    ).join('')}
    </ul>
    <h2>🎨 Image Generation Models:</h2>
    <ul>
    ${allModels.image_models.map(model => 
      `<li><strong>${model.full_id}</strong> - ${model.name} 
       (${model.cost_per_image || model.cost_per_token}/request) ${model.configured ? '✅' : '❌'}</li>`
    ).join('')}
    </ul>
    <h2>📊 Provider Statistics:</h2>
    <pre>${JSON.stringify(stats, null, 2)}</pre>
    <p><a href="/">← Back to Home</a></p>
  `);
});

// Test API endpoint
app.get('/test-api', async (req, res) => {
  try {
    // Test both providers
    const geminiResult = await aiManager.generateText('google-gemini', 'gemini-pro', 'Hello, explain AI in 30 words', { maxTokens: 40 });
    const hfResult = await aiManager.generateText('huggingface', 'llama2-7b', 'Hello, explain AI in 30 words', { maxTokens: 40 });
    
    res.json({
      success: true,
      test_results: {
        provider_stats: aiManager.getProviderStats(),
        configured_providers: aiManager.getConfiguredProviders(),
        gemini_test: geminiResult,
        huggingface_test: hfResult,
        server_status: 'operational'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve AI Chat page
app.get('/ai-chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-interface', 'ai-chat.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`🤖 AI Chat: http://localhost:${PORT}/ai-chat.html`);
  console.log(`🔧 API Test: http://localhost:${PORT}/test-api`);
  
  // Display provider status
  const configuredProviders = aiManager.getConfiguredProviders();
  if (configuredProviders.length > 0) {
    console.log(`🌐 Ready for real AI inference with: ${configuredProviders.join(', ')}`);
  } else {
    console.log(`🔄 Using mock responses (add API keys to .env for real AI)`);
  }
  console.log(`📋 Total models available: ${aiManager.getAllAvailableModels().text_models.length} text, ${aiManager.getAllAvailableModels().image_models.length} image`);
});