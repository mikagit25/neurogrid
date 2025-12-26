#!/usr/bin/env python3
"""
NeuroGrid Node Simulator
Симулирует GPU ноды для демонстрации системы без реального железа
"""

import asyncio
import aiohttp
import json
import time
import random
from datetime import datetime

class NodeSimulator:
    def __init__(self, node_config):
        self.config = node_config
        self.node_id = node_config['id']
        self.name = node_config['name']
        self.coordinator_url = node_config.get('coordinator_url', 'http://localhost:8080')
        self.session = None
        self.running = False
        
    async def start(self):
        """Запускает симулятор ноды"""
        print(f"🚀 Starting {self.name} (ID: {self.node_id})")
        
        self.session = aiohttp.ClientSession()
        self.running = True
        
        # Регистрируемся в системе
        await self.register_node()
        
        # Начинаем обработку задач
        await self.task_processing_loop()
        
    async def register_node(self):
        """Регистрирует ноду в координаторе"""
        registration_data = {
            'id': self.node_id,
            'name': self.name,
            'gpu': self.config.get('gpu', 'Simulated GPU'),
            'location': self.config.get('location', 'Local'),
            'capabilities': self.config.get('capabilities', ['text-generation']),
            'status': 'online',
            'simulated': True
        }
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/nodes/register",
                json=registration_data,
                headers={'Content-Type': 'application/json'}
            ) as response:
                if response.status == 200:
                    print(f"✅ {self.name} registered successfully")
                else:
                    print(f"⚠️ Registration returned {response.status}")
        except Exception as e:
            print(f"⚠️ Registration failed: {e}")
            
    async def task_processing_loop(self):
        """Основной цикл обработки задач"""
        while self.running:
            try:
                # Получаем доступные задачи
                await self.check_for_tasks()
                
                # Ждем немного перед следующей проверкой
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"❌ Error in processing loop: {e}")
                await asyncio.sleep(5)
                
    async def check_for_tasks(self):
        """Проверяет наличие задач для обработки"""
        try:
            async with self.session.get(f"{self.coordinator_url}/api/tasks") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('success'):
                        tasks = data.get('data', {}).get('tasks', [])
                        
                        # Ищем задачи в состоянии pending или queued
                        available_tasks = [t for t in tasks if t.get('status') in ['pending', 'queued']]
                        
                        if available_tasks:
                            # Берем первую доступную задачу
                            task = random.choice(available_tasks)
                            await self.process_task(task)
                            
        except Exception as e:
            print(f"❌ Error checking tasks: {e}")
            
    async def process_task(self, task):
        """Обрабатывает конкретную задачу"""
        task_id = task.get('id', 'unknown')
        model = task.get('model', 'unknown')
        
        print(f"📋 {self.name} processing task {task_id} with model {model}")
        
        # Симулируем время обработки
        processing_time = random.uniform(1, 5)
        await asyncio.sleep(processing_time)
        
        # Генерируем результат в зависимости от модели
        result = await self.generate_result(task, processing_time)
        
        # Отправляем результат обратно
        await self.submit_result(task_id, result, processing_time)
        
    async def generate_result(self, task, processing_time):
        """Генерирует результат для задачи"""
        model = task.get('model', 'unknown')
        prompt = task.get('input', task.get('prompt', 'No prompt provided'))
        
        if 'llama' in model.lower() or 'text' in model.lower():
            return self.generate_text_result(prompt)
        elif 'stable-diffusion' in model.lower() or 'image' in model.lower():
            return self.generate_image_result(prompt)
        elif 'whisper' in model.lower() or 'speech' in model.lower():
            return self.generate_speech_result(prompt)
        else:
            return self.generate_generic_result(prompt)
            
    def generate_text_result(self, prompt):
        """Генерирует текстовый результат"""
        responses = [
            f"Based on the prompt '{prompt[:50]}...', here's a comprehensive response from {self.name}.",
            f"Processing your request about '{prompt[:30]}...' - This is a simulated AI response demonstrating NeuroGrid's distributed inference capabilities.",
            f"NeuroGrid Node Response: I understand your query '{prompt[:40]}...'. In a production environment, this would be processed by a real AI model.",
            f"Distributed AI Result: Your prompt has been processed successfully. This demonstrates how NeuroGrid routes tasks to available GPU nodes.",
        ]
        return random.choice(responses)
        
    def generate_image_result(self, prompt):
        """Генерирует результат для изображений"""
        return f"[SIMULATED IMAGE] Generated image for prompt: '{prompt}'. In production, this would return actual image data or URL."
        
    def generate_speech_result(self, prompt):
        """Генерирует результат для речи"""
        return f"[SIMULATED AUDIO] Transcription result: '{prompt}' - This would be actual speech-to-text output in production."
        
    def generate_generic_result(self, prompt):
        """Генерирует общий результат"""
        return f"Generic AI processing result for: '{prompt}' - Processed by {self.name} simulation node."
        
    async def submit_result(self, task_id, result, processing_time):
        """Отправляет результат обработки"""
        result_data = {
            'task_id': task_id,
            'node_id': self.node_id,
            'result': result,
            'processing_time': processing_time,
            'status': 'completed',
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/tasks/{task_id}/result",
                json=result_data,
                headers={'Content-Type': 'application/json'}
            ) as response:
                if response.status == 200:
                    print(f"✅ {self.name} completed task {task_id}")
                else:
                    print(f"⚠️ Result submission returned {response.status}")
                    
        except Exception as e:
            print(f"❌ Failed to submit result: {e}")
            
    async def stop(self):
        """Останавливает симулятор"""
        print(f"🛑 Stopping {self.name}")
        self.running = False
        if self.session:
            await self.session.close()

class SimulatorManager:
    def __init__(self):
        self.nodes = []
        
    def add_node(self, node_config):
        """Добавляет ноду в симулятор"""
        node = NodeSimulator(node_config)
        self.nodes.append(node)
        return node
        
    async def start_all(self):
        """Запускает все ноды"""
        print("🌐 Starting NeuroGrid Node Simulator...")
        print(f"📊 Total nodes: {len(self.nodes)}")
        
        # Запускаем все ноды параллельно
        tasks = [node.start() for node in self.nodes]
        await asyncio.gather(*tasks, return_exceptions=True)
        
    async def stop_all(self):
        """Останавливает все ноды"""
        print("🛑 Stopping all nodes...")
        for node in self.nodes:
            await node.stop()

def create_sample_nodes():
    """Создает примеры нод для демонстрации"""
    return [
        {
            'id': 'sim-node-gpu-01',
            'name': 'RTX 4090 Simulator',
            'gpu': 'NVIDIA RTX 4090 (Simulated)',
            'location': 'US-West',
            'capabilities': ['text-generation', 'image-generation', 'code-generation']
        },
        {
            'id': 'sim-node-gpu-02', 
            'name': 'A100 Simulator',
            'gpu': 'NVIDIA A100 (Simulated)',
            'location': 'EU-Central',
            'capabilities': ['text-generation', 'large-models', 'training']
        },
        {
            'id': 'sim-node-gpu-03',
            'name': 'V100 Simulator', 
            'gpu': 'NVIDIA Tesla V100 (Simulated)',
            'location': 'Asia-Pacific',
            'capabilities': ['text-generation', 'speech-processing']
        }
    ]

async def main():
    """Главная функция"""
    print("🎭 NeuroGrid Node Simulator")
    print("=" * 50)
    
    # Создаем менеджер
    manager = SimulatorManager()
    
    # Добавляем ноды
    sample_nodes = create_sample_nodes()
    for node_config in sample_nodes:
        manager.add_node(node_config)
        
    try:
        # Запускаем все ноды
        await manager.start_all()
    except KeyboardInterrupt:
        print("\n⚡ Received shutdown signal")
    finally:
        await manager.stop_all()
        print("👋 Node Simulator stopped")

if __name__ == "__main__":
    asyncio.run(main())