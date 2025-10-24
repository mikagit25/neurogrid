# WebSocket Events

## Overview

NeuroGrid provides real-time updates through WebSocket connections. This allows you to receive immediate notifications about task progress, node status changes, and system events.

## Connection

### WebSocket Endpoint
```
wss://api.neurogrid.io/ws
```

### Authentication
After connecting, you must authenticate using your JWT token:

```javascript
const ws = new WebSocket('wss://api.neurogrid.io/ws');

ws.onopen = function() {
  // Send authentication message
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
};
```

### Authentication Response
```json
{
  "type": "auth_success",
  "message": "Authentication successful",
  "user_id": "user_123"
}
```

## Event Types

### Task Events

#### task.started
Fired when a task begins execution.

```json
{
  "type": "task.started",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "task_id": "task_789",
    "model": "llama2-7b",
    "node_id": "node_123",
    "estimated_duration": 15
  }
}
```

#### task.progress
Fired during task execution to report progress.

```json
{
  "type": "task.progress",
  "timestamp": "2024-01-15T10:30:05Z",
  "data": {
    "task_id": "task_789",
    "progress": 35,
    "stage": "inference",
    "estimated_remaining": 10
  }
}
```

#### task.completed
Fired when a task completes successfully.

```json
{
  "type": "task.completed",
  "timestamp": "2024-01-15T10:30:15Z",
  "data": {
    "task_id": "task_789",
    "result": {
      "generated_text": "The result of the task...",
      "usage": {
        "prompt_tokens": 12,
        "completion_tokens": 143,
        "total_tokens": 155
      }
    },
    "execution_time": 15.2,
    "cost": 0.0155
  }
}
```

#### task.failed
Fired when a task fails.

```json
{
  "type": "task.failed",
  "timestamp": "2024-01-15T10:30:10Z",
  "data": {
    "task_id": "task_789",
    "error": {
      "code": "MODEL_LOAD_ERROR",
      "message": "Failed to load model on node",
      "details": "GPU memory insufficient"
    },
    "node_id": "node_123"
  }
}
```

### Node Events

#### node.status
Fired when a node changes status.

```json
{
  "type": "node.status",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "node_id": "node_123",
    "old_status": "online",
    "new_status": "busy",
    "current_task": "task_789"
  }
}
```

#### node.joined
Fired when a new node joins the network.

```json
{
  "type": "node.joined",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "node_id": "node_456",
    "region": "us-east-1",
    "capabilities": ["text-generation", "image-generation"],
    "gpu_info": {
      "model": "NVIDIA RTX 4090",
      "memory": "24GB"
    }
  }
}
```

#### node.left
Fired when a node leaves the network.

```json
{
  "type": "node.left",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "node_id": "node_456",
    "reason": "voluntary",
    "uptime": "2d 5h 32m"
  }
}
```

### System Events

#### system.alert
Fired for important system notifications.

```json
{
  "type": "system.alert",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "level": "warning",
    "category": "performance",
    "message": "High network latency detected",
    "affected_regions": ["us-west-1"],
    "action_required": false
  }
}
```

#### system.maintenance
Fired for scheduled maintenance notifications.

```json
{
  "type": "system.maintenance",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "scheduled_start": "2024-01-16T02:00:00Z",
    "estimated_duration": "2h",
    "affected_services": ["text-generation"],
    "description": "Database maintenance and optimization"
  }
}
```

### Billing Events

#### billing.credit_low
Fired when account credits are running low.

```json
{
  "type": "billing.credit_low",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "current_balance": 5.50,
    "threshold": 10.00,
    "estimated_remaining_tasks": 15
  }
}
```

#### billing.payment_processed
Fired when a payment is successfully processed.

```json
{
  "type": "billing.payment_processed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "amount": 50.00,
    "currency": "USD",
    "new_balance": 55.50,
    "payment_method": "card_****1234"
  }
}
```

## Subscription Management

### Subscribe to Specific Events

```json
{
  "type": "subscribe",
  "events": ["task.completed", "task.failed"],
  "filters": {
    "model": "llama2-7b"
  }
}
```

### Subscribe to Task Updates

```json
{
  "type": "subscribe_task",
  "task_id": "task_789"
}
```

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "events": ["task.progress"]
}
```

## Implementation Examples

### JavaScript (Browser)

```javascript
class NeuroGridWebSocket {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.eventHandlers = {};
  }

  connect() {
    this.ws = new WebSocket('wss://api.neurogrid.io/ws');
    
    this.ws.onopen = () => {
      this.authenticate();
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleEvent(data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Implement reconnection logic
      setTimeout(() => this.connect(), 5000);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  authenticate() {
    this.send({
      type: 'auth',
      token: this.token
    });
  }

  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  handleEvent(event) {
    const handlers = this.eventHandlers[event.type];
    if (handlers) {
      handlers.forEach(handler => handler(event.data));
    }
  }

  subscribeToTask(taskId) {
    this.send({
      type: 'subscribe_task',
      task_id: taskId
    });
  }
}

// Usage
const ws = new NeuroGridWebSocket('your-jwt-token');

ws.on('task.started', (data) => {
  console.log(`Task ${data.task_id} started`);
});

ws.on('task.progress', (data) => {
  updateProgressBar(data.task_id, data.progress);
});

ws.on('task.completed', (data) => {
  displayResult(data.task_id, data.result);
});

ws.connect();
```

### Node.js

```javascript
const WebSocket = require('ws');

class NeuroGridWebSocket {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.eventHandlers = {};
  }

  connect() {
    this.ws = new WebSocket('wss://api.neurogrid.io/ws');
    
    this.ws.on('open', () => {
      this.authenticate();
    });
    
    this.ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      this.handleEvent(event);
    });
    
    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
      // Implement reconnection logic
      setTimeout(() => this.connect(), 5000);
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  authenticate() {
    this.send({
      type: 'auth',
      token: this.token
    });
  }

  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  handleEvent(event) {
    const handlers = this.eventHandlers[event.type];
    if (handlers) {
      handlers.forEach(handler => handler(event.data));
    }
  }
}

// Usage
const ws = new NeuroGridWebSocket(process.env.NEUROGRID_TOKEN);

ws.on('task.completed', (data) => {
  console.log(`Task ${data.task_id} completed:`, data.result);
});

ws.on('node.status', (data) => {
  console.log(`Node ${data.node_id} changed from ${data.old_status} to ${data.new_status}`);
});

ws.connect();
```

### Python

```python
import websocket
import json
import threading

class NeuroGridWebSocket:
    def __init__(self, token):
        self.token = token
        self.ws = None
        self.event_handlers = {}
    
    def on_message(self, ws, message):
        event = json.loads(message)
        self.handle_event(event)
    
    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket connection closed")
        # Implement reconnection logic
    
    def on_open(self, ws):
        self.authenticate()
    
    def authenticate(self):
        auth_message = {
            'type': 'auth',
            'token': self.token
        }
        self.ws.send(json.dumps(auth_message))
    
    def connect(self):
        self.ws = websocket.WebSocketApp(
            "wss://api.neurogrid.io/ws",
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.ws.run_forever()
    
    def on(self, event_type, handler):
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    def handle_event(self, event):
        event_type = event.get('type')
        handlers = self.event_handlers.get(event_type, [])
        for handler in handlers:
            handler(event.get('data'))
    
    def subscribe_to_task(self, task_id):
        message = {
            'type': 'subscribe_task',
            'task_id': task_id
        }
        self.ws.send(json.dumps(message))

# Usage
ws = NeuroGridWebSocket('your-jwt-token')

ws.on('task.completed', lambda data: print(f"Task {data['task_id']} completed"))
ws.on('task.progress', lambda data: print(f"Progress: {data['progress']}%"))

ws.connect()
```

## Error Handling

### Connection Errors

```json
{
  "type": "error",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "code": "CONNECTION_ERROR",
    "message": "Failed to establish WebSocket connection",
    "retry_after": 5
  }
}
```

### Authentication Errors

```json
{
  "type": "auth_error",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "code": "INVALID_TOKEN",
    "message": "JWT token is invalid or expired"
  }
}
```

### Rate Limiting

```json
{
  "type": "rate_limit",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "limit": 100,
    "current": 101,
    "reset_time": "2024-01-15T11:00:00Z"
  }
}
```

## Best Practices

1. **Implement Reconnection Logic**: WebSocket connections can drop, so implement automatic reconnection with exponential backoff.

2. **Handle Authentication Expiry**: Monitor for auth errors and refresh tokens as needed.

3. **Filter Events**: Subscribe only to events you need to reduce bandwidth and processing.

4. **Error Handling**: Always handle connection errors gracefully.

5. **Heartbeat**: Implement ping/pong to detect connection issues early.

6. **Message Queuing**: Queue messages when disconnected and send them after reconnection.

7. **Rate Limiting**: Respect rate limits to avoid disconnection.