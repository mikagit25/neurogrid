#!/usr/bin/env python3
"""
NeuroGrid LLM Integration Service
Интегрирует реальные LLM модели через различные API
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMProvider:
    """Базовый класс для провайдеров LLM"""
    
    def __init__(self, name, api_key=None):
        self.name = name
        self.api_key = api_key
        self.session = None
        
    async def initialize(self):
        """Инициализация провайдера"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Очистка ресурсов"""
        if self.session:
            await self.session.close()
            
    async def generate(self, prompt, model=None, **kwargs):
        """Генерирует ответ от модели"""
        raise NotImplementedError("Subclasses must implement generate method")

class OpenAIProvider(LLMProvider):
    """Провайдер для OpenAI API"""
    
    def __init__(self, api_key=None):
        super().__init__("OpenAI", api_key or os.getenv('OPENAI_API_KEY'))
        self.base_url = "https://api.openai.com/v1"
        
    async def generate(self, prompt, model="gpt-3.5-turbo", **kwargs):
        """Генерирует ответ через OpenAI API"""
        if not self.api_key:
            return {"error": "OpenAI API key not provided", "fallback": True}
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": kwargs.get('max_tokens', 1000),
            "temperature": kwargs.get('temperature', 0.7)
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/chat/completions",
                json=data,
                headers=headers
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "result": result["choices"][0]["message"]["content"],
                        "model": model,
                        "provider": "OpenAI",
                        "tokens_used": result.get("usage", {}).get("total_tokens", 0)
                    }
                else:
                    error_text = await response.text()
                    return {"error": f"OpenAI API error: {response.status}", "details": error_text, "fallback": True}
                    
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return {"error": str(e), "fallback": True}

class HuggingFaceProvider(LLMProvider):
    """Провайдер для Hugging Face API"""
    
    def __init__(self, api_key=None):
        super().__init__("HuggingFace", api_key or os.getenv('HUGGINGFACE_API_KEY'))
        self.base_url = "https://api-inference.huggingface.co/models"
        
    async def generate(self, prompt, model="microsoft/DialoGPT-medium", **kwargs):
        """Генерирует ответ через Hugging Face API"""
        if not self.api_key:
            return {"error": "Hugging Face API key not provided", "fallback": True}
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": kwargs.get('max_tokens', 500),
                "temperature": kwargs.get('temperature', 0.7),
                "return_full_text": False
            }
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/{model}",
                json=data,
                headers=headers
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if isinstance(result, list) and len(result) > 0:
                        return {
                            "result": result[0].get("generated_text", "No response generated"),
                            "model": model,
                            "provider": "HuggingFace"
                        }
                    else:
                        return {"error": "Unexpected response format", "fallback": True}
                else:
                    error_text = await response.text()
                    return {"error": f"HuggingFace API error: {response.status}", "details": error_text, "fallback": True}
                    
        except Exception as e:
            logger.error(f"HuggingFace API error: {e}")
            return {"error": str(e), "fallback": True}

class LocalLLMProvider(LLMProvider):
    """Провайдер для локальных моделей (через Ollama или аналогичное)"""
    
    def __init__(self, base_url="http://localhost:11434"):
        super().__init__("Local")
        self.base_url = base_url
        
    async def generate(self, prompt, model="llama2", **kwargs):
        """Генерирует ответ через локальный API"""
        data = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": kwargs.get('temperature', 0.7),
                "num_predict": kwargs.get('max_tokens', 500)
            }
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/generate",
                json=data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "result": result.get("response", "No response generated"),
                        "model": model,
                        "provider": "Local",
                        "context": result.get("context")
                    }
                else:
                    return {"error": f"Local API error: {response.status}", "fallback": True}
                    
        except Exception as e:
            logger.error(f"Local API error: {e}")
            return {"error": str(e), "fallback": True}

class MockLLMProvider(LLMProvider):
    """Мок провайдер для демонстрации"""
    
    def __init__(self):
        super().__init__("Mock")
        
    async def initialize(self):
        """Мок инициализация"""
        pass
        
    async def cleanup(self):
        """Мок очистка"""
        pass
        
    async def generate(self, prompt, model="mock-llm", **kwargs):
        """Генерирует мок ответ"""
        # Симулируем время обработки
        await asyncio.sleep(1)
        
        responses = [
            f"This is a mock response to your prompt: '{prompt[:100]}...' Generated by NeuroGrid's mock LLM provider for demonstration purposes.",
            f"Mock AI Response: I understand you're asking about '{prompt[:50]}...'. In a production setup, this would be processed by a real language model.",
            f"NeuroGrid Mock LLM: Your input '{prompt[:75]}...' has been processed. This demonstrates the system's ability to route requests to available language models.",
            f"Simulated Response: Based on your query '{prompt[:60]}...', here's what a real LLM would provide in a production NeuroGrid deployment."
        ]
        
        import random
        return {
            "result": random.choice(responses),
            "model": model,
            "provider": "Mock",
            "tokens_used": len(prompt.split()) + random.randint(50, 200)
        }

class LLMIntegrationService:
    """Основной сервис интеграции LLM"""
    
    def __init__(self, coordinator_url="http://localhost:8080"):
        self.coordinator_url = coordinator_url
        self.providers = {}
        self.session = None
        self.running = False
        
    async def initialize(self):
        """Инициализация сервиса"""
        logger.info("🤖 Initializing LLM Integration Service...")
        
        self.session = aiohttp.ClientSession()
        
        # Инициализируем провайдеры
        await self.setup_providers()
        
        # Регистрируемся как LLM сервис
        await self.register_service()
        
    async def setup_providers(self):
        """Настройка провайдеров"""
        logger.info("⚙️ Setting up LLM providers...")
        
        # Всегда доступный мок провайдер
        mock_provider = MockLLMProvider()
        await mock_provider.initialize()
        self.providers["mock"] = mock_provider
        logger.info("✅ Mock LLM provider ready")
        
        # OpenAI провайдер (если есть API ключ)
        if os.getenv('OPENAI_API_KEY'):
            openai_provider = OpenAIProvider()
            await openai_provider.initialize()
            self.providers["openai"] = openai_provider
            logger.info("✅ OpenAI provider ready")
        else:
            logger.info("⚠️ OpenAI API key not found - provider not initialized")
            
        # HuggingFace провайдер (если есть API ключ)
        if os.getenv('HUGGINGFACE_API_KEY'):
            hf_provider = HuggingFaceProvider()
            await hf_provider.initialize()
            self.providers["huggingface"] = hf_provider
            logger.info("✅ HuggingFace provider ready")
        else:
            logger.info("⚠️ HuggingFace API key not found - provider not initialized")
            
        # Локальный провайдер (пытаемся подключиться)
        try:
            local_provider = LocalLLMProvider()
            await local_provider.initialize()
            # Тестовый запрос для проверки доступности
            async with local_provider.session.get("http://localhost:11434/api/tags") as response:
                if response.status == 200:
                    self.providers["local"] = local_provider
                    logger.info("✅ Local LLM provider ready (Ollama detected)")
                else:
                    await local_provider.cleanup()
        except:
            logger.info("⚠️ Local LLM provider not available (Ollama not running)")
            
        logger.info(f"📊 Total providers initialized: {len(self.providers)}")
        
    async def register_service(self):
        """Регистрирует сервис в координаторе"""
        registration_data = {
            "service_type": "llm_integration",
            "providers": list(self.providers.keys()),
            "capabilities": ["text-generation", "chat", "completion"],
            "status": "online"
        }
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/services/register",
                json=registration_data
            ) as response:
                if response.status == 200:
                    logger.info("✅ LLM Integration Service registered")
                else:
                    logger.warning(f"⚠️ Registration returned {response.status}")
        except Exception as e:
            logger.error(f"❌ Service registration failed: {e}")
            
    async def process_request(self, prompt, model=None, provider=None, **kwargs):
        """Обрабатывает запрос к LLM"""
        logger.info(f"📝 Processing request: '{prompt[:50]}...'")
        
        # Выбираем провайдера
        if provider and provider in self.providers:
            selected_provider = self.providers[provider]
        else:
            # Автоматический выбор лучшего доступного провайдера
            if "openai" in self.providers:
                selected_provider = self.providers["openai"]
            elif "huggingface" in self.providers:
                selected_provider = self.providers["huggingface"]
            elif "local" in self.providers:
                selected_provider = self.providers["local"]
            else:
                selected_provider = self.providers["mock"]
                
        logger.info(f"🎯 Using provider: {selected_provider.name}")
        
        # Генерируем ответ
        start_time = datetime.now()
        result = await selected_provider.generate(prompt, model, **kwargs)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Если есть ошибка и поддерживается fallback, используем мок
        if result.get("error") and result.get("fallback") and selected_provider.name != "Mock":
            logger.warning(f"⚠️ Fallback to mock provider due to error: {result['error']}")
            result = await self.providers["mock"].generate(prompt, model, **kwargs)
            
        result["processing_time"] = processing_time
        result["timestamp"] = datetime.now().isoformat()
        
        logger.info(f"✅ Request processed in {processing_time:.2f}s")
        return result
        
    async def start_service(self):
        """Запускает сервис"""
        logger.info("🚀 Starting LLM Integration Service...")
        self.running = True
        
        # Здесь можно добавить обработку задач из очереди
        # Пока что сервис готов принимать прямые запросы
        
        try:
            while self.running:
                # Здесь можно добавить проверку очереди задач
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("⚡ Received shutdown signal")
        finally:
            await self.cleanup()
            
    async def cleanup(self):
        """Очистка ресурсов"""
        logger.info("🧹 Cleaning up LLM Integration Service...")
        
        for provider in self.providers.values():
            await provider.cleanup()
            
        if self.session:
            await self.session.close()
            
        logger.info("👋 LLM Integration Service stopped")

# Тестовая функция
async def test_llm_integration():
    """Тестирует интеграцию LLM"""
    print("🧪 Testing LLM Integration Service")
    print("=" * 50)
    
    service = LLMIntegrationService()
    await service.initialize()
    
    # Тестовые запросы
    test_prompts = [
        "What is artificial intelligence?",
        "Explain how decentralized computing works",
        "Write a short poem about technology"
    ]
    
    for prompt in test_prompts:
        print(f"\n📝 Testing prompt: '{prompt}'")
        result = await service.process_request(prompt)
        
        print(f"🤖 Provider: {result.get('provider', 'Unknown')}")
        print(f"⏱️ Processing time: {result.get('processing_time', 0):.2f}s")
        if result.get('error'):
            print(f"❌ Error: {result['error']}")
        else:
            print(f"💬 Result: {result.get('result', 'No result')[:200]}...")
            
    await service.cleanup()
    print("\n✅ LLM Integration test completed")

if __name__ == "__main__":
    # Для тестирования без реальных API ключей
    asyncio.run(test_llm_integration())