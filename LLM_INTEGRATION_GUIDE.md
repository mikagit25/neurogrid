# 🤖 NeuroGrid LLM Integration Guide

## 🚀 Как подключить и использовать LLM модели в NeuroGrid

### 📋 Обзор
NeuroGrid теперь поддерживает интеграцию с различными LLM моделями через нашу систему распределенных вычислений. Вы можете использовать:

- **Mock модели** (для демо и тестирования)
- **OpenAI API** (GPT-3.5, GPT-4)
- **HuggingFace API** (открытые модели)
- **Локальные модели** (через Ollama)

### 🎯 Быстрый старт

#### 1. Убедитесь, что NeuroGrid запущен:
```bash
cd neurogrid
./production-launch.sh
```

#### 2. Проверьте доступные модели:
```bash
curl http://localhost:8080/api/llm/models
```

#### 3. Тест LLM генерации:
```bash
python llm_demo.py
```

### 🔧 Интеграция с реальными API

#### OpenAI Integration
1. Получите API ключ на https://platform.openai.com/
2. Установите переменную окружения:
```bash
export OPENAI_API_KEY="your-key-here"
```
3. Перезапустите систему

#### HuggingFace Integration  
1. Получите токен на https://huggingface.co/settings/tokens
2. Установите переменную окружения:
```bash
export HUGGINGFACE_API_KEY="your-token-here"
```
3. Перезапустите систему

#### Локальные модели (Ollama)
1. Установите Ollama: https://ollama.ai/
2. Запустите локальные модели:
```bash
ollama run llama2
ollama run codellama
```
3. NeuroGrid автоматически обнаружит локальные модели

### 📡 API Endpoints

#### Генерация текста
```bash
curl -X POST http://localhost:8080/api/llm/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing",
    "model": "llama2-7b",
    "max_tokens": 500
  }'
```

#### Доступные модели
```bash
curl http://localhost:8080/api/llm/models
```

#### Статистика сети
```bash
curl http://localhost:8080/api/nodes/stats
```

### 🎭 Симуляция нод для демо

Если у вас нет реального GPU железа, используйте симулятор:

```bash
# Запустить симулятор нод
python node_simulator.py

# В другом терминале - тест интеграции
python llm_demo.py
```

### 🌐 Веб интерфейс

Откройте http://localhost:3000 для доступа к веб-интерфейсу NeuroGrid:

- **Dashboard** - общая статистика сети
- **API Test** - тестирование API endpoints  
- **Tasks** - управление задачами
- **Wallet** - управление токенами NEURO

### 💡 Примеры использования

#### Генерация кода:
```python
import requests

response = requests.post("http://localhost:8080/api/llm/generate", json={
    "prompt": "Write a Python function to sort a list using quicksort",
    "model": "codellama-7b",
    "provider": "local"
})

result = response.json()
print(result['data']['result'])
```

#### Текстовая генерация:
```python
response = requests.post("http://localhost:8080/api/llm/generate", json={
    "prompt": "Explain the benefits of decentralized AI computing",
    "model": "gpt-3.5-turbo", 
    "max_tokens": 1000
})
```

#### Творческие задачи:
```python
response = requests.post("http://localhost:8080/api/llm/generate", json={
    "prompt": "Write a short story about AI and blockchain",
    "model": "mistral-7b",
    "temperature": 0.9
})
```

### 🏗️ Архитектура системы

```
User Request → NeuroGrid API → Smart Router → Available Nodes
                                    ↓
[OpenAI Nodes] [HuggingFace Nodes] [Local Nodes] [Mock Nodes]
                                    ↓
                            Response Processing → User
```

### 🚀 Production Deployment

Для продакшн развертывания:

1. **Настройте API ключи** для внешних провайдеров
2. **Запустите реальные GPU ноды** с моделями
3. **Настройте мониторинг** и логирование
4. **Конфигурируйте балансировку нагрузки**

### 🔍 Мониторинг и отладка

#### Проверить здоровье системы:
```bash
curl http://localhost:8080/health
```

#### Посмотреть логи:
```bash
tail -f logs/enhanced-server.log
```

#### Статистика нод:
```bash
curl http://localhost:8080/api/nodes
```

### 💰 Экономика токенов

NeuroGrid использует токены NEURO для расчетов:
- Локальные модели: ~0.0001 NEURO/запрос
- Внешние API: 0.001-0.03 NEURO/запрос  
- Mock модели: бесплатно

### 🤝 Поддержка

Для вопросов и поддержки:
- GitHub Issues: https://github.com/username/neurogrid
- Discord Community: https://discord.gg/neurogrid
- Documentation: https://docs.neurogrid.network

---

🎉 **Поздравляем! NeuroGrid готов к использованию с LLM моделями!**