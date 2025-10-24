# Python Integration Guide

## Quick Start

This guide will help you integrate NeuroGrid into your Python application quickly and efficiently.

### Prerequisites

- Python 3.8+
- pip or conda
- NeuroGrid API key

### Installation

```bash
pip install neurogrid-sdk
# or
conda install -c conda-forge neurogrid-sdk
```

### Basic Setup

```python
from neurogrid import NeuroGridClient
import os

# Initialize client
client = NeuroGridClient(
    api_key=os.getenv('NEUROGRID_API_KEY'),
    base_url='https://api.neurogrid.io'
)

# Test connection
def test_connection():
    try:
        models = client.models.list()
        print('✅ Connected to NeuroGrid!')
        print(f'Available models: {len(models.models)}')
    except Exception as error:
        print(f'❌ Connection failed: {error}')

test_connection()
```

## Environment Configuration

Create a `.env` file:

```env
NEUROGRID_API_KEY=your_api_key_here
NEUROGRID_BASE_URL=https://api.neurogrid.io
```

Load environment variables:

```python
from dotenv import load_dotenv
import os

load_dotenv()

client = NeuroGridClient(
    api_key=os.getenv('NEUROGRID_API_KEY')
)
```

## Flask Integration

### Simple Flask App

```python
from flask import Flask, request, jsonify
from neurogrid import NeuroGridClient
import os

app = Flask(__name__)
client = NeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

@app.route('/api/generate', methods=['POST'])
def generate_text():
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        model = data.get('model', 'llama2-7b')
        
        result = client.models.generate_text(
            model=model,
            prompt=prompt,
            max_tokens=150
        )
        
        return jsonify({
            'success': True,
            'text': result.generated_text,
            'cost': result.cost
        })
    except Exception as error:
        return jsonify({
            'success': False,
            'error': str(error)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
```

### Complete Flask Application

```python
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from neurogrid import NeuroGridClient
import os
import logging
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Rate limiting
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)

# Initialize NeuroGrid client
client = NeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/api/chat', methods=['POST'])
@limiter.limit("10 per minute")
def chat():
    try:
        data = request.get_json()
        message = data.get('message')
        conversation_id = data.get('conversation_id')
        
        result = client.models.generate_text(
            model='llama2-7b',
            prompt=f"User: {message}\nAssistant:",
            max_tokens=200,
            temperature=0.7
        )
        
        logger.info(f"Chat request processed, cost: {result.cost}")
        
        return jsonify({
            'response': result.generated_text,
            'conversation_id': conversation_id,
            'cost': result.cost
        })
    except Exception as error:
        logger.error(f"Chat error: {error}")
        return jsonify({'error': str(error)}), 500

@app.route('/api/image', methods=['POST'])
@limiter.limit("5 per minute")
def generate_image():
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        style = data.get('style', 'realistic')
        
        result = client.models.generate_image(
            model='stable-diffusion-xl',
            prompt=f"{prompt}, {style} style",
            width=512,
            height=512
        )
        
        return jsonify({
            'image_url': result.image_url,
            'cost': result.cost
        })
    except Exception as error:
        return jsonify({'error': str(error)}), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        result = client.models.transcribe(
            file=file,
            model='whisper-large',
            language='en'
        )
        
        return jsonify({
            'transcription': result.transcription,
            'confidence': result.confidence,
            'cost': result.cost
        })
    except Exception as error:
        return jsonify({'error': str(error)}), 500

if __name__ == '__main__':
    app.run(debug=True)
```

## FastAPI Integration

```python
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neurogrid import NeuroGridClient
import os
import asyncio

app = FastAPI(title="NeuroGrid API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize async client
from neurogrid import AsyncNeuroGridClient
client = AsyncNeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "llama2-7b"
    max_tokens: int = 150

class ChatRequest(BaseModel):
    message: str
    conversation_id: str = None

@app.post("/api/generate")
async def generate_text(request: GenerateRequest):
    try:
        result = await client.models.generate_text(
            model=request.model,
            prompt=request.prompt,
            max_tokens=request.max_tokens
        )
        
        return {
            "success": True,
            "text": result.generated_text,
            "cost": result.cost
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        result = await client.models.generate_text(
            model="llama2-7b",
            prompt=f"User: {request.message}\nAssistant:",
            max_tokens=200
        )
        
        return {
            "response": result.generated_text,
            "conversation_id": request.conversation_id,
            "cost": result.cost
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        result = await client.models.transcribe(
            file=file.file,
            model="whisper-large"
        )
        
        return {
            "transcription": result.transcription,
            "confidence": result.confidence,
            "cost": result.cost
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Django Integration

### Django Views

```python
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from neurogrid import NeuroGridClient
import json
import os

client = NeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

@csrf_exempt
@require_http_methods(["POST"])
def generate_text(request):
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt')
        model = data.get('model', 'llama2-7b')
        
        result = client.models.generate_text(
            model=model,
            prompt=prompt,
            max_tokens=150
        )
        
        return JsonResponse({
            'success': True,
            'text': result.generated_text,
            'cost': result.cost
        })
    except Exception as error:
        return JsonResponse({
            'success': False,
            'error': str(error)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    try:
        data = json.loads(request.body)
        message = data.get('message')
        
        result = client.models.generate_text(
            model='llama2-7b',
            prompt=f"User: {message}\nAssistant:",
            max_tokens=200
        )
        
        return JsonResponse({
            'response': result.generated_text,
            'cost': result.cost
        })
    except Exception as error:
        return JsonResponse({'error': str(error)}, status=500)
```

## Data Science Integration

### Pandas Integration

```python
import pandas as pd
from neurogrid import NeuroGridClient

client = NeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

def analyze_dataframe(df):
    """Analyze a DataFrame using AI"""
    summary = df.describe().to_string()
    
    prompt = f"""
    Analyze this dataset and provide insights:
    
    {summary}
    
    Please provide:
    1. Key findings
    2. Trends and patterns
    3. Recommendations
    """
    
    result = client.models.generate_text(
        model='llama2-7b',
        prompt=prompt,
        max_tokens=500
    )
    
    return result.generated_text

# Example usage
df = pd.read_csv('sales_data.csv')
insights = analyze_dataframe(df)
print(insights)
```

### Jupyter Notebook Integration

```python
from IPython.display import Image, display, Markdown
import requests
from neurogrid import NeuroGridClient

client = NeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

def generate_and_display_image(prompt):
    """Generate and display image in Jupyter"""
    result = client.models.generate_image(
        model='stable-diffusion-xl',
        prompt=prompt,
        width=512,
        height=512
    )
    
    # Download and display
    response = requests.get(result.image_url)
    with open('generated_image.png', 'wb') as f:
        f.write(response.content)
    
    display(Image('generated_image.png'))
    display(Markdown(f"**Cost:** ${result.cost}"))
    
    return result

# Usage in Jupyter
generate_and_display_image("A beautiful sunset over mountains")
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
import logging

logger = logging.getLogger(__name__)

def robust_generate_text(prompt, max_retries=3):
    """Generate text with robust error handling"""
    for attempt in range(max_retries):
        try:
            return client.models.generate_text(
                model='llama2-7b',
                prompt=prompt
            )
        except AuthenticationError:
            logger.error('Authentication failed - check API key')
            raise
        except RateLimitError as e:
            logger.warning(f'Rate limited - waiting {e.retry_after}s')
            time.sleep(e.retry_after)
            continue
        except ModelNotFoundError:
            logger.error('Model not found - using fallback')
            # Try with different model
            return client.models.generate_text(
                model='gpt-3.5-turbo',
                prompt=prompt
            )
        except NeuroGridError as e:
            logger.error(f'API Error: {e.code} - {e.message}')
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
        except Exception as e:
            logger.error(f'Unexpected error: {e}')
            if attempt == max_retries - 1:
                raise
            time.sleep(1)
    
    raise Exception('Max retries exceeded')
```

## Async Operations

```python
import asyncio
from neurogrid import AsyncNeuroGridClient

client = AsyncNeuroGridClient(api_key=os.getenv('NEUROGRID_API_KEY'))

async def batch_generate(prompts):
    """Generate text for multiple prompts concurrently"""
    tasks = [
        client.models.generate_text(
            model='llama2-7b',
            prompt=prompt,
            max_tokens=100
        )
        for prompt in prompts
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful = [r for r in results if not isinstance(r, Exception)]
    failed = [r for r in results if isinstance(r, Exception)]
    
    print(f"Successful: {len(successful)}, Failed: {len(failed)}")
    return successful

# Usage
if __name__ == "__main__":
    prompts = [
        "Explain machine learning",
        "What is blockchain?", 
        "Describe quantum computing"
    ]
    
    results = asyncio.run(batch_generate(prompts))
    for result in results:
        print(result.generated_text[:100])
```

## Testing

```python
import unittest
from unittest.mock import patch, Mock
from neurogrid import NeuroGridClient
from neurogrid.exceptions import ModelNotFoundError

class TestNeuroGridIntegration(unittest.TestCase):
    def setUp(self):
        self.client = NeuroGridClient(
            api_key='test-key',
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
        # Mock error response
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
    
    def test_batch_processing(self):
        prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3']
        results = []
        
        for prompt in prompts:
            result = self.client.models.generate_text(
                model='llama2-7b',
                prompt=prompt,
                max_tokens=10
            )
            results.append(result)
        
        self.assertEqual(len(results), len(prompts))
        for result in results:
            self.assertIsInstance(result.generated_text, str)

if __name__ == '__main__':
    unittest.main()
```

## Production Configuration

```python
import os
from neurogrid import NeuroGridClient, Config
import logging

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('neurogrid.log'),
        logging.StreamHandler()
    ]
)

# Environment-specific configuration
config = {
    'development': {
        'base_url': 'https://api-dev.neurogrid.io',
        'timeout': 30,
        'retries': 3,
        'debug': True
    },
    'production': {
        'base_url': 'https://api.neurogrid.io',
        'timeout': 60,
        'retries': 5,
        'debug': False
    }
}

env = os.getenv('ENVIRONMENT', 'development')
env_config = config[env]

client = NeuroGridClient(
    api_key=os.getenv('NEUROGRID_API_KEY'),
    **env_config
)
```

## Next Steps

1. Read the [API Reference](../endpoints.md)
2. Explore [WebSocket Events](../websocket.md) 
3. Check out [React Integration](./react.md)
4. Learn about [Authentication](../auth.md)