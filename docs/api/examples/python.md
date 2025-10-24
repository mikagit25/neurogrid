# Python SDK Examples

## Installation

```bash
pip install neurogrid-sdk
# or
conda install -c conda-forge neurogrid-sdk
```

## Quick Start

```python
from neurogrid import NeuroGridClient
import os

# Initialize client
client = NeuroGridClient(
    api_key=os.getenv('NEUROGRID_API_KEY'),
    base_url='https://api.neurogrid.io'
)

# Basic text generation
def generate_text():
    try:
        result = client.models.generate_text(
            model='llama2-7b',
            prompt='Write a short story about AI',
            max_tokens=200
        )
        
        print(result.generated_text)
        print(f"Cost: ${result.cost}")
    except Exception as error:
        print(f"Error: {error}")

generate_text()
```

## Authentication Examples

### Using JWT Tokens

```python
client = NeuroGridClient()

# Login with credentials
auth = client.auth.login(
    email='user@example.com',
    password='securepassword'
)

# Token is automatically stored and used
nodes = client.nodes.list()
```

### Using API Keys

```python
client = NeuroGridClient(api_key='your-api-key-here')

# All requests will use the API key
models = client.models.list()
```

## Advanced Examples

### Batch Text Generation

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

def batch_generation():
    prompts = [
        'Explain machine learning',
        'What is blockchain?',
        'Describe quantum computing'
    ]

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(
            lambda prompt: client.models.generate_text(
                model='llama2-7b',
                prompt=prompt,
                max_tokens=100
            ),
            prompts
        ))

    for i, result in enumerate(results):
        print(f"Prompt {i + 1}: {result.generated_text}")

batch_generation()
```

### Async Text Generation

```python
import asyncio
from neurogrid import AsyncNeuroGridClient

async def async_generation():
    async_client = AsyncNeuroGridClient(
        api_key=os.getenv('NEUROGRID_API_KEY')
    )
    
    prompts = [
        'Explain machine learning',
        'What is blockchain?',
        'Describe quantum computing'
    ]
    
    tasks = [
        async_client.models.generate_text(
            model='llama2-7b',
            prompt=prompt,
            max_tokens=100
        )
        for prompt in prompts
    ]
    
    results = await asyncio.gather(*tasks)
    
    for i, result in enumerate(results):
        print(f"Prompt {i + 1}: {result.generated_text}")
    
    await async_client.close()

asyncio.run(async_generation())
```

### Image Generation with Progress Tracking

```python
import time

def generate_image_with_progress():
    task = client.models.generate_image(
        model='stable-diffusion-xl',
        prompt='A beautiful landscape with mountains and lakes',
        width=1024,
        height=1024
    )
    
    print(f"Task started: {task.id}")
    
    # Poll for progress
    while True:
        status = client.tasks.get(task.id)
        print(f"Progress: {status.progress}%")
        
        if status.status == 'completed':
            print(f"Image URL: {status.image_url}")
            break
        elif status.status == 'failed':
            print(f"Task failed: {status.error}")
            break
        
        time.sleep(2)

generate_image_with_progress()
```

### Audio Transcription

```python
def transcribe_audio():
    with open('audio.mp3', 'rb') as audio_file:
        result = client.models.transcribe(
            file=audio_file,
            model='whisper-large',
            language='en'
        )
    
    print(f"Transcription: {result.transcription}")
    print(f"Confidence: {result.confidence}")
    
    # Get detailed segments
    for segment in result.segments:
        print(f"{segment.start}s - {segment.end}s: {segment.text}")

transcribe_audio()
```

## Error Handling

```python
from neurogrid.exceptions import (
    NeuroGridError,
    AuthenticationError,
    RateLimitError,
    ModelNotFoundError
)
import time

def handle_errors():
    try:
        result = client.models.generate_text(
            model='invalid-model',
            prompt='Test prompt'
        )
    except AuthenticationError:
        print('Authentication failed, please login again')
        # Redirect to login
    except RateLimitError as e:
        print(f'Rate limit exceeded, waiting {e.retry_after} seconds...')
        time.sleep(e.retry_after)
        # Retry request
    except ModelNotFoundError:
        print('Model not found, please check available models')
    except NeuroGridError as e:
        print(f'API Error: {e.message}')
        print(f'Error Code: {e.code}')
    except Exception as e:
        print(f'Unexpected error: {e}')

handle_errors()
```

## WebSocket Real-time Updates

```python
import websocket
import json
import threading

class NeuroGridWebSocket:
    def __init__(self, api_key):
        self.api_key = api_key
        self.ws = None
    
    def on_message(self, ws, message):
        event = json.loads(message)
        event_type = event.get('type')
        
        if event_type == 'task.started':
            print(f"Task {event['taskId']} started on node {event['nodeId']}")
        elif event_type == 'task.progress':
            print(f"Task {event['taskId']}: {event['progress']}% complete")
        elif event_type == 'task.completed':
            print(f"Task {event['taskId']} completed!")
            print(f"Result: {event['result']}")
        elif event_type == 'node.status':
            print(f"Node {event['nodeId']} is now {event['status']}")
    
    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket connection closed")
    
    def on_open(self, ws):
        print("Connected to NeuroGrid WebSocket")
        # Authenticate
        auth_message = {
            'type': 'auth',
            'token': self.api_key
        }
        ws.send(json.dumps(auth_message))
    
    def connect(self):
        websocket.enableTrace(True)
        self.ws = websocket.WebSocketApp(
            "wss://api.neurogrid.io/ws",
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.ws.run_forever()

# Usage
ws_client = NeuroGridWebSocket(api_key='your-api-key')
ws_client.connect()
```

## Configuration and Settings

```python
from neurogrid import NeuroGridClient, Config

# Custom configuration
config = Config(
    timeout=30,  # 30 seconds
    retries=3,
    retry_delay=1.0,  # 1 second
    default_region='us-west-1',
    debug=False
)

client = NeuroGridClient(
    api_key='your-api-key',
    base_url='https://api.neurogrid.io',
    config=config
)

# Override settings per request
result = client.models.generate_text(
    model='llama2-7b',
    prompt='Test',
    timeout=60,  # 1 minute for this request
    node_preferences={
        'region': 'eu-west-1',
        'min_performance_score': 95
    }
)
```

## Data Science Integration

### Pandas Integration

```python
import pandas as pd

def analyze_with_ai(df):
    # Convert DataFrame to prompt
    data_summary = df.describe().to_string()
    prompt = f"""Analyze this dataset and provide insights:
    
{data_summary}

Provide key findings and recommendations."""
    
    result = client.models.generate_text(
        model='llama2-7b',
        prompt=prompt,
        max_tokens=500
    )
    
    return result.generated_text

# Usage
df = pd.read_csv('sales_data.csv')
insights = analyze_with_ai(df)
print(insights)
```

### Jupyter Notebook Integration

```python
from IPython.display import Image, display
import requests

def generate_and_display_image(prompt):
    result = client.models.generate_image(
        model='stable-diffusion-xl',
        prompt=prompt,
        width=512,
        height=512
    )
    
    # Download and display image
    response = requests.get(result.image_url)
    with open('generated_image.png', 'wb') as f:
        f.write(response.content)
    
    display(Image('generated_image.png'))
    return result

# Usage in Jupyter
generate_and_display_image('A beautiful sunset over the ocean')
```

## Testing Examples

```python
import unittest
from unittest.mock import patch, Mock
from neurogrid import NeuroGridClient

class TestNeuroGridSDK(unittest.TestCase):
    def setUp(self):
        self.client = NeuroGridClient(
            api_key='test-api-key',
            base_url='https://api-test.neurogrid.io'
        )
    
    def test_generate_text_success(self):
        result = self.client.models.generate_text(
            model='llama2-7b',
            prompt='Hello world',
            max_tokens=10
        )
        
        self.assertIsInstance(result.generated_text, str)
        self.assertGreater(len(result.generated_text), 0)
        self.assertIsInstance(result.cost, float)
    
    @patch('neurogrid.client.requests.post')
    def test_api_error_handling(self, mock_post):
        # Mock API error response
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.json.return_value = {
            'success': False,
            'error': {
                'code': 'MODEL_NOT_FOUND',
                'message': 'Model not found'
            }
        }
        mock_post.return_value = mock_response
        
        with self.assertRaises(ModelNotFoundError):
            self.client.models.generate_text(
                model='non-existent-model',
                prompt='Test'
            )

if __name__ == '__main__':
    unittest.main()
```

## Performance Optimization

```python
from neurogrid import NeuroGridClient
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

class OptimizedNeuroGrid:
    def __init__(self, api_key, max_workers=5):
        self.client = NeuroGridClient(api_key=api_key)
        self.max_workers = max_workers
    
    def batch_generate_text(self, prompts, model='llama2-7b', **kwargs):
        results = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_prompt = {
                executor.submit(
                    self.client.models.generate_text,
                    model=model,
                    prompt=prompt,
                    **kwargs
                ): prompt
                for prompt in prompts
            }
            
            for future in as_completed(future_to_prompt):
                prompt = future_to_prompt[future]
                try:
                    result = future.result()
                    results.append({
                        'prompt': prompt,
                        'result': result,
                        'success': True
                    })
                except Exception as exc:
                    results.append({
                        'prompt': prompt,
                        'error': str(exc),
                        'success': False
                    })
        
        return results

# Usage
optimized_client = OptimizedNeuroGrid('your-api-key')
prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3']
results = optimized_client.batch_generate_text(prompts)
```