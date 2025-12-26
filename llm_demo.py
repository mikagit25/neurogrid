#!/usr/bin/env python3
"""
NeuroGrid LLM Demo - тестируем интеграцию LLM моделей
"""

import requests
import json
import time

COORDINATOR_URL = "http://localhost:8080"

def test_llm_generation():
    """Тестирует генерацию через LLM API"""
    print("🤖 Testing NeuroGrid LLM Generation")
    print("=" * 50)
    
    # Тестовые запросы
    test_requests = [
        {
            "prompt": "Explain what is NeuroGrid and how decentralized AI computing works",
            "model": "llama2-7b",
            "max_tokens": 500
        },
        {
            "prompt": "Write a Python function to calculate fibonacci numbers",
            "model": "codellama-7b",
            "provider": "local"
        },
        {
            "prompt": "Create a haiku about artificial intelligence",
            "model": "gpt-3.5-turbo",
            "temperature": 0.9
        }
    ]
    
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'NeuroGrid-LLM-Demo/1.0'
    }
    
    for i, request_data in enumerate(test_requests, 1):
        print(f"\n{i}️⃣ Testing request: '{request_data['prompt'][:50]}...'")
        print(f"   Model: {request_data.get('model', 'auto')}")
        print(f"   Provider: {request_data.get('provider', 'auto')}")
        
        try:
            start_time = time.time()
            response = requests.post(
                f"{COORDINATOR_URL}/api/llm/generate",
                json=request_data,
                headers=headers,
                timeout=30
            )
            total_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    data = result['data']
                    print(f"   ✅ Success!")
                    print(f"   ⏱️  Total time: {total_time:.2f}s")
                    print(f"   🔥 Processing time: {data.get('processing_time', 0):.2f}s") 
                    print(f"   🏷️  Model used: {data.get('model', 'unknown')}")
                    print(f"   🖥️  Node: {data.get('node_id', 'unknown')}")
                    print(f"   💰 Cost: {data.get('cost_neuro', 0)} NEURO (${data.get('cost_usd', 0)})")
                    print(f"   🔤 Tokens: {data.get('tokens_used', 0)}")
                    print(f"   💬 Result: {data.get('result', 'No result')[:150]}...")
                else:
                    print(f"   ❌ API Error: {result.get('error', 'Unknown error')}")
            else:
                print(f"   ❌ HTTP Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except requests.exceptions.Timeout:
            print(f"   ⏰ Request timeout after 30s")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            
    print(f"\n🎉 LLM Demo completed!")

def test_available_models():
    """Тестирует получение доступных моделей"""
    print("\n📋 Testing Available Models API")
    print("-" * 30)
    
    try:
        response = requests.get(f"{COORDINATOR_URL}/api/llm/models")
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                data = result['data']
                print(f"📊 Total models: {data.get('total_models', 0)}")
                
                for category, models in data.get('available_models', {}).items():
                    print(f"\n🏷️  {category.replace('-', ' ').title()}:")
                    for model in models:
                        cost_info = f"${model['cost']}" if model['cost'] > 0 else "Free"
                        print(f"   • {model['name']} ({model['provider']}) - {cost_info}")
            else:
                print(f"❌ API Error: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Главная функция демо"""
    print("🚀 NeuroGrid LLM Integration Demo")
    print("=" * 60)
    
    # Проверяем доступность API
    try:
        response = requests.get(f"{COORDINATOR_URL}/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print(f"✅ NeuroGrid API is healthy")
            print(f"📊 Service: {health.get('service', 'Unknown')}")
            print(f"🕐 Uptime: {health.get('performance', {}).get('uptime', 0)}s")
        else:
            print("❌ NeuroGrid API is not responding properly")
            return
    except:
        print("❌ Cannot connect to NeuroGrid API. Make sure enhanced-server is running.")
        return
    
    # Тестируем функциональность
    test_available_models()
    test_llm_generation()
    
    print("\n" + "=" * 60)
    print("🎯 Next Steps:")
    print("1. Add real API keys to test OpenAI/HuggingFace integration")
    print("2. Install Ollama locally to test local models")
    print("3. Start node simulator to see distributed processing")
    print("4. Check web interface at http://localhost:3000")
    print("\n💡 To start node simulator: python node_simulator.py")

if __name__ == "__main__":
    main()