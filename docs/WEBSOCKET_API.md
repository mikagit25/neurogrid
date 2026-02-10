# NeuroGrid WebSocket API Documentation

This document describes the real-time WebSocket API for the NeuroGrid platform, enabling live updates for task status, node monitoring, and system events.

## Overview

The NeuroGrid WebSocket API provides real-time bidirectional communication between clients and the coordinator server. It supports authentication, room-based broadcasting, and comprehensive event handling.

**WebSocket Endpoints:**
- Development: `ws://localhost:3001/ws`
- Production: `wss://api.neurogrid.ai/ws`

## Connection & Authentication

### 1. Initial Connection
```javascript
const socket = new WebSocket('ws://localhost:3001/ws');

socket.onopen = () => {
    console.log('Connected to NeuroGrid');
    
    // Authenticate immediately after connection
    socket.send(JSON.stringify({
        type: 'authenticate',
        data: {
            token: 'your-jwt-token-here'
        }
    }));
};
```

### 2. Authentication Response
```json
{
    "type": "auth_response",
    "success": true,
    "data": {
        "user_id": "user123",
        "session_id": "session456",
        "permissions": ["task:submit", "node:read", "analytics:read"]
    }
}
```

### 3. Connection Confirmation
```json
{
    "type": "connected",
    "data": {
        "connection_id": "conn789",
        "server_time": "2024-01-15T10:30:00.000Z",
        "api_version": "1.0.0"
    }
}
```

## Room Subscription System

### Join Rooms
```javascript
// Join task updates room
socket.send(JSON.stringify({
    type: 'join_room',
    data: {
        room: 'tasks',
        filters: {
            user_id: 'user123',  // Optional: filter by user
            status: ['pending', 'running']  // Optional: filter by status
        }
    }
}));

// Join node monitoring room
socket.send(JSON.stringify({
    type: 'join_room',
    data: {
        room: 'nodes',
        filters: {
            regions: ['us-east-1', 'eu-west-1']
        }
    }
}));

// Join analytics room (admin only)
socket.send(JSON.stringify({
    type: 'join_room',
    data: {
        room: 'analytics'
    }
}));
```

### Leave Rooms
```javascript
socket.send(JSON.stringify({
    type: 'leave_room',
    data: {
        room: 'tasks'
    }
}));
```

## Event Types

### 1. Task Events

#### Task Status Update
```json
{
    "type": "task_update",
    "room": "tasks",
    "data": {
        "task_id": "task-uuid-123",
        "status": "completed",
        "previous_status": "running",
        "node_id": "node-456",
        "updated_at": "2024-01-15T10:35:00.000Z",
        "result": {
            "output": "Generated text result...",
            "tokens_used": 150,
            "processing_time": 2.34
        },
        "cost": {
            "amount": 0.05,
            "currency": "USD"
        }
    }
}
```

#### Task Progress (for long-running tasks)
```json
{
    "type": "task_progress",
    "room": "tasks",
    "data": {
        "task_id": "task-uuid-123",
        "progress": 65,
        "stage": "model_inference",
        "eta_seconds": 45,
        "message": "Processing tokens 1000/1500"
    }
}
```

#### New Task Assignment
```json
{
    "type": "task_assigned",
    "room": "tasks",
    "data": {
        "task_id": "task-uuid-124",
        "node_id": "node-456",
        "user_id": "user123",
        "model": "gpt-4",
        "priority": 5,
        "estimated_duration": 120,
        "assigned_at": "2024-01-15T10:36:00.000Z"
    }
}
```

### 2. Node Events

#### Node Status Change
```json
{
    "type": "node_status",
    "room": "nodes",
    "data": {
        "node_id": "node-456",
        "status": "busy",
        "previous_status": "online",
        "current_task": "task-uuid-123",
        "updated_at": "2024-01-15T10:35:00.000Z",
        "metrics": {
            "gpu_utilization": 85,
            "memory_usage": 12.5,
            "temperature": 72,
            "power_draw": 280
        }
    }
}
```

#### Node Performance Metrics
```json
{
    "type": "node_metrics",
    "room": "nodes",
    "data": {
        "node_id": "node-456",
        "timestamp": "2024-01-15T10:35:00.000Z",
        "metrics": {
            "cpu_usage": 45.2,
            "ram_usage": 8.9,
            "gpu_usage": 78.5,
            "gpu_memory": 15.2,
            "network_io": {
                "bytes_in": 1024000,
                "bytes_out": 512000
            },
            "disk_io": {
                "read_mb": 150,
                "write_mb": 75
            }
        },
        "health_score": 95
    }
}
```

#### Node Registration
```json
{
    "type": "node_registered",
    "room": "nodes",
    "data": {
        "node_id": "node-789",
        "name": "GPU-Node-NY-01",
        "owner_id": "user456",
        "specifications": {
            "gpu": "RTX 4090",
            "gpu_memory": 24,
            "cpu": "Intel i9-13900K",
            "ram": 64,
            "storage": 2000,
            "network_speed": 1000
        },
        "location": {
            "region": "us-east-1",
            "city": "New York",
            "country": "USA"
        },
        "registered_at": "2024-01-15T10:40:00.000Z"
    }
}
```

### 3. System Events

#### Platform Analytics (Admin only)
```json
{
    "type": "analytics_update",
    "room": "analytics",
    "data": {
        "timestamp": "2024-01-15T10:35:00.000Z",
        "metrics": {
            "active_users": 1250,
            "active_nodes": 45,
            "tasks_per_minute": 25,
            "average_response_time": 2.1,
            "network_utilization": 67
        },
        "alerts": [
            {
                "level": "warning",
                "message": "High network utilization detected",
                "threshold": 70
            }
        ]
    }
}
```

#### System Maintenance Notification
```json
{
    "type": "system_notification",
    "room": "general",
    "data": {
        "level": "info",
        "title": "Scheduled Maintenance",
        "message": "Platform maintenance scheduled for Jan 16, 02:00 UTC",
        "scheduled_time": "2024-01-16T02:00:00.000Z",
        "estimated_duration": 3600,
        "affected_services": ["task_routing", "payment_processing"]
    }
}
```

### 4. User Events

#### Balance Update
```json
{
    "type": "balance_update",
    "room": "user_updates",
    "data": {
        "user_id": "user123",
        "balances": {
            "NEURO": {
                "total": 1000.50,
                "available": 850.25,
                "locked": 150.25
            },
            "USD": {
                "total": 125.00,
                "available": 100.00,
                "locked": 25.00
            }
        },
        "updated_at": "2024-01-15T10:35:00.000Z"
    }
}
```

#### Payment Confirmation
```json
{
    "type": "payment_confirmed",
    "room": "user_updates",
    "data": {
        "transaction_id": "tx-uuid-789",
        "user_id": "user123",
        "amount": 25.50,
        "currency": "NEURO",
        "type": "task_payment",
        "related_task": "task-uuid-123",
        "confirmed_at": "2024-01-15T10:36:00.000Z"
    }
}
```

## Client API

### JavaScript Client Example
```javascript
class NeuroGridWebSocket {
    constructor(url, token) {
        this.url = url;
        this.token = token;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.eventHandlers = new Map();
    }

    connect() {
        try {
            this.socket = new WebSocket(this.url);
            this.setupEventHandlers();
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleReconnect();
        }
    }

    setupEventHandlers() {
        this.socket.onopen = () => {
            console.log('Connected to NeuroGrid');
            this.authenticate();
            this.reconnectAttempts = 0;
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };

        this.socket.onclose = (event) => {
            console.log('Connection closed:', event.code, event.reason);
            if (event.code !== 1000) {  // Not a normal closure
                this.handleReconnect();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    authenticate() {
        this.send({
            type: 'authenticate',
            data: { token: this.token }
        });
    }

    send(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('Socket not ready, queuing message');
        }
    }

    joinRoom(room, filters = {}) {
        this.send({
            type: 'join_room',
            data: { room, filters }
        });
    }

    leaveRoom(room) {
        this.send({
            type: 'leave_room',
            data: { room }
        });
    }

    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }

    off(eventType, handler) {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    handleMessage(message) {
        const { type, data } = message;
        const handlers = this.eventHandlers.get(type) || [];
        handlers.forEach(handler => {
            try {
                handler(data, message);
            } catch (error) {
                console.error(`Error in ${type} handler:`, error);
            }
        });
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
    }
}

// Usage Example
const ws = new NeuroGridWebSocket('ws://localhost:3001/ws', 'your-jwt-token');

// Set up event handlers
ws.on('task_update', (data) => {
    console.log('Task updated:', data.task_id, data.status);
    updateTaskUI(data);
});

ws.on('node_status', (data) => {
    console.log('Node status changed:', data.node_id, data.status);
    updateNodeDashboard(data);
});

ws.on('system_notification', (data) => {
    showNotification(data.level, data.title, data.message);
});

// Connect and join rooms
ws.connect();

// After authentication, join relevant rooms
ws.on('auth_response', (data) => {
    if (data.success) {
        ws.joinRoom('tasks', { user_id: data.user_id });
        ws.joinRoom('nodes');
        
        if (data.permissions.includes('admin')) {
            ws.joinRoom('analytics');
        }
    }
});
```

## Error Handling

### Connection Errors
```json
{
    "type": "error",
    "data": {
        "code": "CONNECTION_FAILED",
        "message": "Failed to establish connection",
        "retry_in": 5000
    }
}
```

### Authentication Errors
```json
{
    "type": "auth_error",
    "data": {
        "code": "INVALID_TOKEN",
        "message": "JWT token is invalid or expired",
        "action": "redirect_to_login"
    }
}
```

### Rate Limiting
```json
{
    "type": "rate_limit_exceeded",
    "data": {
        "code": "TOO_MANY_REQUESTS",
        "message": "Rate limit exceeded",
        "reset_time": "2024-01-15T10:36:00.000Z",
        "limit": 100,
        "remaining": 0
    }
}
```

## Best Practices

1. **Authentication**: Always authenticate immediately after connection
2. **Reconnection**: Implement exponential backoff for reconnection attempts
3. **Error Handling**: Handle all error types gracefully with user feedback
4. **Room Management**: Subscribe only to relevant rooms to minimize bandwidth
5. **Memory Management**: Clean up event handlers and close connections properly
6. **Heartbeat**: Implement ping/pong for connection health monitoring
7. **Message Queuing**: Queue messages when connection is temporarily unavailable

## Rate Limits

- **Connection Rate**: 10 connections per IP per minute
- **Message Rate**: 100 messages per connection per minute
- **Room Subscriptions**: Maximum 10 rooms per connection
- **Broadcast Rate**: Varies by room type and user permission level

## Security Considerations

- All connections require JWT authentication
- Room access is based on user permissions
- Rate limiting prevents abuse
- Message validation prevents injection attacks
- Connection logging for audit purposes
- Automatic disconnect for suspicious activity

For more information, see the [NeuroGrid API Documentation](/api-docs) and [Security Guide](/docs/security).