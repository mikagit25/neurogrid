# React Integration Guide

## Quick Start

This guide will help you integrate NeuroGrid into your React application with modern hooks and components.

### Prerequisites

- React 16.8+ (for hooks support)
- Node.js 16+
- NeuroGrid API key

### Installation

```bash
npm install @neurogrid/react @neurogrid/sdk
# or
yarn add @neurogrid/react @neurogrid/sdk
```

### Basic Setup

```jsx
import React from 'react';
import { NeuroGridProvider } from '@neurogrid/react';
import App from './App';

function Root() {
  return (
    <NeuroGridProvider apiKey={process.env.REACT_APP_NEUROGRID_API_KEY}>
      <App />
    </NeuroGridProvider>
  );
}

export default Root;
```

### Environment Configuration

Create a `.env` file in your project root:

```env
REACT_APP_NEUROGRID_API_KEY=your_api_key_here
REACT_APP_NEUROGRID_BASE_URL=https://api.neurogrid.io
```

## Basic Text Generation Component

```jsx
import React, { useState } from 'react';
import { useTextGeneration } from '@neurogrid/react';

function TextGenerator() {
  const [prompt, setPrompt] = useState('');
  const { generateText, loading, result, error } = useTextGeneration();

  const handleGenerate = async () => {
    await generateText({
      model: 'llama2-7b',
      prompt,
      maxTokens: 150
    });
  };

  return (
    <div className="text-generator">
      <div className="input-section">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={4}
          cols={50}
        />
        <button 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
        >
          {loading ? 'Generating...' : 'Generate Text'}
        </button>
      </div>
      
      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
      
      {result && (
        <div className="result">
          <h3>Generated Text:</h3>
          <p>{result.generatedText}</p>
          <small>Cost: ${result.cost}</small>
        </div>
      )}
    </div>
  );
}

export default TextGenerator;
```

## Chat Interface Component

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNeuroGrid } from '@neurogrid/react';

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { client } = useNeuroGrid();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await client.models.generateText({
        model: 'llama2-7b',
        prompt: `User: ${input}\nAssistant:`,
        maxTokens: 200,
        temperature: 0.7
      });

      const assistantMessage = {
        role: 'assistant',
        content: result.generatedText,
        cost: result.cost
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'error',
        content: `Error: ${error.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="content">{message.content}</div>
            {message.cost && (
              <div className="cost">Cost: ${message.cost}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message assistant loading">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatInterface;
```

## Image Generation Component

```jsx
import React, { useState } from 'react';
import { useImageGeneration } from '@neurogrid/react';

function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const { generateImage, loading, result, error, progress } = useImageGeneration();

  const handleGenerate = async () => {
    await generateImage({
      model: 'stable-diffusion-xl',
      prompt: `${prompt}, ${style} style`,
      width: 512,
      height: 512
    });
  };

  return (
    <div className="image-generator">
      <div className="controls">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
        />
        
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="realistic">Realistic</option>
          <option value="artistic">Artistic</option>
          <option value="cartoon">Cartoon</option>
          <option value="oil painting">Oil Painting</option>
        </select>
        
        <button 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
        >
          {loading ? 'Generating...' : 'Generate Image'}
        </button>
      </div>
      
      {loading && (
        <div className="progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{progress}% complete</div>
        </div>
      )}
      
      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
      
      {result && (
        <div className="result">
          <img src={result.imageUrl} alt="Generated" />
          <div className="details">
            <p><strong>Prompt:</strong> {prompt}</p>
            <p><strong>Style:</strong> {style}</p>
            <p><strong>Cost:</strong> ${result.cost}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageGenerator;
```

## Custom Hooks

### useNeuroGrid Hook

```jsx
import { useContext } from 'react';
import { NeuroGridContext } from '@neurogrid/react';

export function useNeuroGrid() {
  const context = useContext(NeuroGridContext);
  if (!context) {
    throw new Error('useNeuroGrid must be used within a NeuroGridProvider');
  }
  return context;
}
```

### Custom Text Generation Hook

```jsx
import { useState, useCallback } from 'react';
import { useNeuroGrid } from './useNeuroGrid';

export function useTextGeneration() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { client } = useNeuroGrid();

  const generateText = useCallback(async (options) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await client.models.generateText(options);
      setResult(response);
      return response;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const reset = useCallback(() => {
    setLoading(false);
    setResult(null);
    setError(null);
  }, []);

  return {
    generateText,
    loading,
    result,
    error,
    reset
  };
}
```

## Real-time Updates with WebSocket

```jsx
import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@neurogrid/react';

function TaskMonitor() {
  const [tasks, setTasks] = useState([]);
  const { connected, lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage) {
      const event = JSON.parse(lastMessage.data);
      
      switch (event.type) {
        case 'task.started':
          setTasks(prev => [...prev, {
            id: event.data.task_id,
            status: 'running',
            progress: 0,
            model: event.data.model
          }]);
          break;
          
        case 'task.progress':
          setTasks(prev => prev.map(task => 
            task.id === event.data.task_id 
              ? { ...task, progress: event.data.progress }
              : task
          ));
          break;
          
        case 'task.completed':
          setTasks(prev => prev.map(task => 
            task.id === event.data.task_id 
              ? { ...task, status: 'completed', result: event.data.result }
              : task
          ));
          break;
          
        case 'task.failed':
          setTasks(prev => prev.map(task => 
            task.id === event.data.task_id 
              ? { ...task, status: 'failed', error: event.data.error }
              : task
          ));
          break;
      }
    }
  }, [lastMessage]);

  return (
    <div className="task-monitor">
      <div className="status">
        WebSocket: {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      <div className="tasks">
        {tasks.map(task => (
          <div key={task.id} className={`task ${task.status}`}>
            <div className="task-header">
              <span className="task-id">{task.id}</span>
              <span className="task-model">{task.model}</span>
              <span className="task-status">{task.status}</span>
            </div>
            
            {task.status === 'running' && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            )}
            
            {task.result && (
              <div className="task-result">
                <pre>{JSON.stringify(task.result, null, 2)}</pre>
              </div>
            )}
            
            {task.error && (
              <div className="task-error">
                Error: {task.error.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TaskMonitor;
```

## Error Boundary Component

```jsx
import React from 'react';

class NeuroGridErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('NeuroGrid Error:', error, errorInfo);
    
    // You can also log the error to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong with NeuroGrid</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NeuroGridErrorBoundary;
```

## Advanced Usage with Context

```jsx
import React, { createContext, useContext, useReducer } from 'react';
import { NeuroGridClient } from '@neurogrid/sdk';

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_RESULT: 'SET_RESULT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  ADD_TO_HISTORY: 'ADD_TO_HISTORY'
};

// Reducer
function neuroGridReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    case ActionTypes.SET_RESULT:
      return { ...state, result: action.payload, loading: false, error: null };
    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case ActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    case ActionTypes.ADD_TO_HISTORY:
      return { ...state, history: [...state.history, action.payload] };
    default:
      return state;
  }
}

// Context
const NeuroGridContext = createContext();

// Provider
export function NeuroGridProvider({ children, apiKey, ...options }) {
  const [state, dispatch] = useReducer(neuroGridReducer, {
    loading: false,
    result: null,
    error: null,
    history: []
  });

  const client = new NeuroGridClient({ apiKey, ...options });

  const generateText = async (options) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: true });
    dispatch({ type: ActionTypes.CLEAR_ERROR });

    try {
      const result = await client.models.generateText(options);
      dispatch({ type: ActionTypes.SET_RESULT, payload: result });
      dispatch({ 
        type: ActionTypes.ADD_TO_HISTORY, 
        payload: { type: 'text', options, result, timestamp: Date.now() }
      });
      return result;
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error });
      throw error;
    }
  };

  const generateImage = async (options) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: true });
    dispatch({ type: ActionTypes.CLEAR_ERROR });

    try {
      const result = await client.models.generateImage(options);
      dispatch({ type: ActionTypes.SET_RESULT, payload: result });
      dispatch({ 
        type: ActionTypes.ADD_TO_HISTORY, 
        payload: { type: 'image', options, result, timestamp: Date.now() }
      });
      return result;
    } catch (error) {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error });
      throw error;
    }
  };

  const value = {
    ...state,
    client,
    generateText,
    generateImage,
    clearError: () => dispatch({ type: ActionTypes.CLEAR_ERROR })
  };

  return (
    <NeuroGridContext.Provider value={value}>
      {children}
    </NeuroGridContext.Provider>
  );
}

// Hook
export function useNeuroGrid() {
  const context = useContext(NeuroGridContext);
  if (!context) {
    throw new Error('useNeuroGrid must be used within a NeuroGridProvider');
  }
  return context;
}
```

## Styling Examples

### CSS Modules

```css
/* TextGenerator.module.css */
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.inputSection {
  margin-bottom: 20px;
}

.textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-family: inherit;
  resize: vertical;
}

.button {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 10px;
}

.button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.result {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 5px;
  margin-top: 10px;
}
```

### Styled Components

```jsx
import styled from 'styled-components';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-family: inherit;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const Button = styled.button`
  background: ${props => props.disabled ? '#ccc' : '#007bff'};
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  margin-top: 10px;
  transition: background-color 0.2s;
  
  &:hover:not(:disabled) {
    background: #0056b3;
  }
`;

const ResultCard = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;
```

## Testing

```jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NeuroGridProvider } from '@neurogrid/react';
import TextGenerator from './TextGenerator';

// Mock the SDK
jest.mock('@neurogrid/sdk', () => ({
  NeuroGridClient: jest.fn().mockImplementation(() => ({
    models: {
      generateText: jest.fn().mockResolvedValue({
        generatedText: 'Mock generated text',
        cost: 0.01
      })
    }
  }))
}));

const Wrapper = ({ children }) => (
  <NeuroGridProvider apiKey="test-key">
    {children}
  </NeuroGridProvider>
);

describe('TextGenerator', () => {
  test('renders input and button', () => {
    render(<TextGenerator />, { wrapper: Wrapper });
    
    expect(screen.getByPlaceholderText('Enter your prompt...')).toBeInTheDocument();
    expect(screen.getByText('Generate Text')).toBeInTheDocument();
  });
  
  test('generates text on button click', async () => {
    render(<TextGenerator />, { wrapper: Wrapper });
    
    const textarea = screen.getByPlaceholderText('Enter your prompt...');
    const button = screen.getByText('Generate Text');
    
    fireEvent.change(textarea, { target: { value: 'Test prompt' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Mock generated text')).toBeInTheDocument();
    });
  });
  
  test('disables button when loading', async () => {
    render(<TextGenerator />, { wrapper: Wrapper });
    
    const textarea = screen.getByPlaceholderText('Enter your prompt...');
    const button = screen.getByText('Generate Text');
    
    fireEvent.change(textarea, { target: { value: 'Test prompt' } });
    fireEvent.click(button);
    
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});
```

## Next Steps

1. Read the [API Reference](../endpoints.md)
2. Explore [WebSocket Events](../websocket.md)
3. Check out [Node.js Integration](./nodejs.md)
4. Learn about [Authentication](../auth.md)
5. See [Advanced Examples](../examples/)