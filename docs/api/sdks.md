# SDKs & Libraries

## Official SDKs

NeuroGrid provides official SDKs for popular programming languages to make integration easier and more reliable.

### JavaScript/Node.js SDK

**Installation:**
```bash
npm install @neurogrid/sdk
# or
yarn add @neurogrid/sdk
```

**Features:**
- TypeScript support with full type definitions
- Automatic token refresh
- WebSocket real-time updates
- Retry logic with exponential backoff
- Browser and Node.js compatibility
- Promise-based API with async/await support

**GitHub Repository:** [neurogrid/javascript-sdk](https://github.com/neurogrid/javascript-sdk)

### Python SDK

**Installation:**
```bash
pip install neurogrid-sdk
# or
conda install -c conda-forge neurogrid-sdk
```

**Features:**
- Sync and async client support
- Type hints for better IDE support
- Automatic pagination
- Built-in retry mechanisms
- Integration with popular data science libraries
- Command-line interface

**GitHub Repository:** [neurogrid/python-sdk](https://github.com/neurogrid/python-sdk)

### Go SDK

**Installation:**
```bash
go get github.com/neurogrid/go-sdk
```

**Features:**
- Idiomatic Go interfaces
- Context support for cancellation
- Structured logging integration
- Built-in rate limiting
- Concurrent request handling

**GitHub Repository:** [neurogrid/go-sdk](https://github.com/neurogrid/go-sdk)

### Rust SDK

**Installation:**
```toml
[dependencies]
neurogrid-sdk = "0.1.0"
```

**Features:**
- Memory-safe operations
- Async/await support with tokio
- Type-safe API client
- Zero-copy deserialization
- Cross-platform compatibility

**GitHub Repository:** [neurogrid/rust-sdk](https://github.com/neurogrid/rust-sdk)

## Community SDKs

### PHP SDK

**Installation:**
```bash
composer require neurogrid/php-sdk
```

**Maintained by:** Community
**GitHub:** [neurogrid-community/php-sdk](https://github.com/neurogrid-community/php-sdk)

### Ruby SDK

**Installation:**
```bash
gem install neurogrid-sdk
```

**Maintained by:** Community
**GitHub:** [neurogrid-community/ruby-sdk](https://github.com/neurogrid-community/ruby-sdk)

### Java SDK

**Installation (Maven):**
```xml
<dependency>
    <groupId>io.neurogrid</groupId>
    <artifactId>neurogrid-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

**Maintained by:** Community
**GitHub:** [neurogrid-community/java-sdk](https://github.com/neurogrid-community/java-sdk)

## CLI Tools

### NeuroGrid CLI

**Installation:**
```bash
npm install -g @neurogrid/cli
# or
pip install neurogrid-cli
```

**Usage:**
```bash
# Login
neurogrid auth login

# List available models
neurogrid models list

# Generate text
neurogrid generate text "Explain quantum computing" --model llama2-7b

# Generate image
neurogrid generate image "A beautiful sunset" --model stable-diffusion-xl

# Monitor tasks
neurogrid tasks watch

# Check node status
neurogrid nodes list --region us-west-1
```

## Browser Libraries

### Vanilla JavaScript

```html
<script src="https://cdn.neurogrid.io/sdk/neurogrid.min.js"></script>
<script>
const client = new NeuroGrid({
  apiKey: 'your-api-key'
});

client.models.generateText({
  model: 'llama2-7b',
  prompt: 'Hello world'
}).then(result => {
  console.log(result.generatedText);
});
</script>
```

### React Components

**Installation:**
```bash
npm install @neurogrid/react
```

**Usage:**
```jsx
import { NeuroGridProvider, useTextGeneration } from '@neurogrid/react';

function App() {
  return (
    <NeuroGridProvider apiKey="your-api-key">
      <TextGenerator />
    </NeuroGridProvider>
  );
}

function TextGenerator() {
  const { generateText, loading, result } = useTextGeneration();

  const handleGenerate = () => {
    generateText({
      model: 'llama2-7b',
      prompt: 'Write a short story'
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        Generate Text
      </button>
      {result && <p>{result.generatedText}</p>}
    </div>
  );
}
```

### Vue.js Plugin

**Installation:**
```bash
npm install @neurogrid/vue
```

**Usage:**
```vue
<template>
  <div>
    <button @click="generateText" :disabled="loading">
      Generate Text
    </button>
    <p v-if="result">{{ result.generatedText }}</p>
  </div>
</template>

<script>
import { useNeuroGrid } from '@neurogrid/vue';

export default {
  setup() {
    const { generateText, loading, result } = useNeuroGrid();

    const generate = () => {
      generateText({
        model: 'llama2-7b',
        prompt: 'Explain artificial intelligence'
      });
    };

    return {
      generateText: generate,
      loading,
      result
    };
  }
};
</script>
```

## Mobile SDKs

### React Native

**Installation:**
```bash
npm install @neurogrid/react-native
```

### Flutter

**Installation:**
```yaml
dependencies:
  neurogrid_sdk: ^1.0.0
```

### iOS (Swift)

**Installation (Swift Package Manager):**
```swift
dependencies: [
    .package(url: "https://github.com/neurogrid/ios-sdk.git", from: "1.0.0")
]
```

### Android (Kotlin/Java)

**Installation (Gradle):**
```gradle
implementation 'io.neurogrid:android-sdk:1.0.0'
```

## Integration Libraries

### Jupyter Notebook Extension

**Installation:**
```bash
pip install neurogrid-jupyter
jupyter nbextension enable --py neurogrid_jupyter
```

**Magic Commands:**
```python
# Load extension
%load_ext neurogrid_jupyter

# Generate text
%neurogrid_text llama2-7b "Explain machine learning"

# Generate image
%neurogrid_image stable-diffusion-xl "A beautiful landscape"
```

### VS Code Extension

**Installation:**
Search for "NeuroGrid" in VS Code extensions marketplace or install via command line:
```bash
code --install-extension neurogrid.vscode-extension
```

**Features:**
- Inline text generation
- Code completion with AI
- Image generation in editor
- Task monitoring in sidebar

### Postman Collection

Import our Postman collection for easy API testing:

**Collection URL:**
```
https://api.neurogrid.io/postman/collection.json
```

### Insomnia Plugin

**Installation:**
Install the NeuroGrid plugin from Insomnia's plugin manager.

## Database Integrations

### Supabase

```javascript
import { createClient } from '@supabase/supabase-js';
import { NeuroGrid } from '@neurogrid/sdk';

const supabase = createClient(url, key);
const neurogrid = new NeuroGrid({ apiKey: 'your-api-key' });

// Store and analyze data
async function analyzeUserFeedback() {
  const { data: feedback } = await supabase
    .from('feedback')
    .select('content');

  const analysis = await neurogrid.models.generateText({
    model: 'llama2-7b',
    prompt: `Analyze this user feedback: ${feedback.map(f => f.content).join('\\n')}`
  });

  return analysis.generatedText;
}
```

### Firebase

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { NeuroGrid } from '@neurogrid/sdk';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const neurogrid = new NeuroGrid({ apiKey: 'your-api-key' });

// Generate and store content
async function generateAndStore(prompt) {
  const result = await neurogrid.models.generateText({
    model: 'llama2-7b',
    prompt
  });

  await addDoc(collection(db, 'generated_content'), {
    prompt,
    result: result.generatedText,
    timestamp: new Date(),
    cost: result.cost
  });

  return result;
}
```

## Webhook Integrations

### Zapier

Connect NeuroGrid to thousands of apps through Zapier:

1. Search for "NeuroGrid" in Zapier
2. Connect your NeuroGrid account
3. Create automations (Zaps)

**Example Zap:**
- Trigger: New email in Gmail
- Action: Generate response with NeuroGrid
- Action: Send reply

### IFTTT

Create custom automations with IFTTT:

**Example Recipe:**
- IF: New tweet mentions @yourcompany
- THEN: Generate response with NeuroGrid and post reply

## Monitoring & Analytics

### Datadog Integration

```javascript
const tracer = require('dd-trace').init();
const { NeuroGrid } = require('@neurogrid/sdk');

const client = new NeuroGrid({
  apiKey: 'your-api-key',
  middleware: [
    (request, next) => {
      const span = tracer.startSpan('neurogrid.request');
      return next(request).finally(() => span.finish());
    }
  ]
});
```

### New Relic Integration

```javascript
const newrelic = require('newrelic');
const { NeuroGrid } = require('@neurogrid/sdk');

const client = new NeuroGrid({
  apiKey: 'your-api-key',
  onRequest: (request) => {
    newrelic.addCustomAttribute('neurogrid.model', request.model);
  },
  onResponse: (response) => {
    newrelic.recordMetric('Custom/NeuroGrid/Cost', response.cost);
  }
});
```

## Testing Tools

### SDK Test Utilities

```javascript
import { createMockNeuroGrid } from '@neurogrid/test-utils';

describe('My App', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockNeuroGrid({
      generateText: jest.fn().mockResolvedValue({
        generatedText: 'Mock response',
        cost: 0.01
      })
    });
  });

  it('should generate text', async () => {
    const result = await mockClient.models.generateText({
      model: 'llama2-7b',
      prompt: 'Test prompt'
    });

    expect(result.generatedText).toBe('Mock response');
  });
});
```

## Contributing

We welcome contributions to our SDKs and libraries:

1. **Report Issues:** Use GitHub issues to report bugs or request features
2. **Submit PRs:** Follow our contribution guidelines
3. **Write Documentation:** Help improve our docs
4. **Create Examples:** Share your integration examples

### SDK Development Guidelines

1. **Follow Language Conventions:** Use idiomatic patterns for each language
2. **Comprehensive Testing:** Include unit and integration tests
3. **Documentation:** Provide clear API documentation
4. **Error Handling:** Implement robust error handling
5. **Versioning:** Follow semantic versioning

### Community

- **Discord:** [discord.gg/neurogrid](https://discord.gg/neurogrid)
- **GitHub Discussions:** [github.com/neurogrid/community](https://github.com/neurogrid/community)
- **Stack Overflow:** Tag questions with `neurogrid`
- **Reddit:** [r/NeuroGrid](https://reddit.com/r/NeuroGrid)