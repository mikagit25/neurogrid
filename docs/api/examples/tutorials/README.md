# NeuroGrid Tutorials

## Quick Start Tutorials

### 1. Getting Started in 5 Minutes

```javascript
// Install the SDK
npm install @neurogrid/sdk

// Initialize and make your first request
const { NeuroGrid } = require('@neurogrid/sdk');
const client = new NeuroGrid({ apiKey: 'your-api-key' });

async function firstRequest() {
  const result = await client.models.generateText({
    model: 'llama2-7b',
    prompt: 'Hello, NeuroGrid!'
  });
  console.log(result.generatedText);
}

firstRequest();
```

### 2. Building a Chat Bot

```javascript
const express = require('express');
const { NeuroGrid } = require('@neurogrid/sdk');

const app = express();
const client = new NeuroGrid({ apiKey: process.env.NEUROGRID_API_KEY });

app.use(express.json());

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  const result = await client.models.generateText({
    model: 'llama2-7b',
    prompt: `User: ${message}\nBot:`,
    maxTokens: 150
  });
  
  res.json({ response: result.generatedText });
});

app.listen(3000);
```

### 3. Image Generation API

```python
from flask import Flask, request, jsonify
from neurogrid import NeuroGridClient

app = Flask(__name__)
client = NeuroGridClient(api_key='your-api-key')

@app.route('/generate-image', methods=['POST'])
def generate_image():
    prompt = request.json.get('prompt')
    
    result = client.models.generate_image(
        model='stable-diffusion-xl',
        prompt=prompt,
        width=512,
        height=512
    )
    
    return jsonify({'image_url': result.image_url})

if __name__ == '__main__':
    app.run(debug=True)
```

## Advanced Examples

### Batch Processing
### Error Handling
### Real-time Updates
### Cost Optimization

## Common Use Cases

### Content Generation
### Data Analysis
### Image Processing
### Voice Transcription