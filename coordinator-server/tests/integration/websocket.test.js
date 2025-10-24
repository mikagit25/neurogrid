const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');
const WebSocketManager = require('../../src/services/WebSocketManager');

describe('WebSocket Manager', () => {
  let server;
  let wsManager;
  let port;
  let wsUrl;
  let jwtSecret = 'test-secret';

  beforeAll(async () => {
    // Create HTTP server
    server = http.createServer();
    
    // Get available port
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        wsUrl = `ws://localhost:${port}/ws`;
        resolve();
      });
    });

    // Initialize WebSocket manager
    wsManager = new WebSocketManager({
      jwtSecret,
      pingInterval: 1000, // 1 second for testing
      maxConnections: 10
    });
    
    wsManager.initialize(server);
  });

  afterAll(async () => {
    if (wsManager) {
      await wsManager.shutdown();
    }
    if (server) {
      server.close();
    }
  });

  describe('Connection Management', () => {
    test('should accept new connections', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'welcome') {
          expect(message.connectionId).toBeDefined();
          expect(message.serverVersion).toBe('1.0.0');
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should track connection statistics', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        const stats = wsManager.getStats();
        expect(stats.activeConnections).toBeGreaterThan(0);
        expect(stats.totalConnections).toBeGreaterThan(0);
        expect(stats.connectionsByType.anonymous).toBeGreaterThan(0);
        ws.close();
        done();
      });
      
      ws.on('error', done);
    });

    test('should handle connection limits', async () => {
      const connections = [];
      
      // Create maximum connections
      for (let i = 0; i < 10; i++) {
        const ws = new WebSocket(wsUrl);
        connections.push(ws);
        await new Promise(resolve => {
          ws.on('open', resolve);
          ws.on('error', resolve);
        });
      }
      
      // Try to create one more (should be rejected)
      const extraWs = new WebSocket(wsUrl);
      
      await new Promise((resolve) => {
        extraWs.on('error', (error) => {
          expect(error.code).toBe('ECONNRESET');
          resolve();
        });
        
        extraWs.on('open', () => {
          // If it opens, close it and fail the test
          extraWs.close();
          throw new Error('Connection should have been rejected');
        });
      });
      
      // Cleanup
      connections.forEach(ws => ws.close());
    });
  });

  describe('Authentication', () => {
    test('should authenticate users with valid JWT', (done) => {
      const userId = 'user123';
      const token = jwt.sign({ userId, role: 'user' }, jwtSecret);
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token, type: 'user' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'auth_success') {
          expect(message.data.userId).toBe(userId);
          expect(message.data.role).toBe('user');
          expect(message.data.type).toBe('user');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should reject invalid JWT tokens', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token: 'invalid-token', type: 'user' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'error') {
          expect(message.error.code).toBe('INVALID_TOKEN');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should authenticate nodes', (done) => {
      const nodeId = 'node001';
      const token = jwt.sign({ nodeId, role: 'node' }, jwtSecret);
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token, type: 'node' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'auth_success') {
          expect(message.data.type).toBe('node');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should require admin role for admin authentication', (done) => {
      const userId = 'user123';
      const token = jwt.sign({ userId, role: 'user' }, jwtSecret); // Not admin role
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token, type: 'admin' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'error') {
          expect(message.error.code).toBe('INSUFFICIENT_PERMISSIONS');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });
  });

  describe('Topic Subscriptions', () => {
    test('should allow users to subscribe to allowed topics', (done) => {
      const userId = 'user123';
      const token = jwt.sign({ userId, role: 'user' }, jwtSecret);
      
      const ws = new WebSocket(wsUrl);
      let authenticated = false;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token, type: 'user' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'auth_success' && !authenticated) {
          authenticated = true;
          
          // Try to subscribe to allowed topics
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { 
              topics: [
                'system.status',
                'system.announcements',
                `user.${userId}.tasks`,
                `user.${userId}.notifications`
              ]
            }
          }));
        }
        
        if (message.type === 'subscribed') {
          expect(message.data.topics).toHaveLength(4);
          expect(message.data.topics).toContain('system.status');
          expect(message.data.topics).toContain(`user.${userId}.tasks`);
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should deny unauthorized topic subscriptions', (done) => {
      const userId = 'user123';
      const token = jwt.sign({ userId, role: 'user' }, jwtSecret);
      
      const ws = new WebSocket(wsUrl);
      let authenticated = false;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token, type: 'user' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'auth_success' && !authenticated) {
          authenticated = true;
          
          // Try to subscribe to unauthorized topics
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { 
              topics: [
                'system.status', // Allowed
                'admin.alerts',  // Not allowed for users
                'user.456.tasks' // Not allowed (different user)
              ]
            }
          }));
        }
        
        if (message.type === 'subscribed') {
          // Should only get the allowed topic
          expect(message.data.topics).toHaveLength(1);
          expect(message.data.topics).toContain('system.status');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });
  });

  describe('Room Management', () => {
    test('should allow joining public rooms', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'join_room',
          data: { room: 'public.general' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'room_joined') {
          expect(message.data.room).toBe('public.general');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should deny access to private rooms for unauthenticated users', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'join_room',
          data: { room: 'user.123.private' }
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'error') {
          expect(message.error.code).toBe('ROOM_ACCESS_DENIED');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });
  });

  describe('Message Broadcasting', () => {
    test('should broadcast to topic subscribers', async () => {
      const userId = 'user123';
      const token = jwt.sign({ userId, role: 'user' }, jwtSecret);
      
      const ws = new WebSocket(wsUrl);
      let subscribed = false;
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'auth',
            data: { token, type: 'user' }
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          
          if (message.type === 'auth_success' && !subscribed) {
            subscribed = true;
            ws.send(JSON.stringify({
              type: 'subscribe',
              data: { topics: ['system.status'] }
            }));
          }
          
          if (message.type === 'subscribed') {
            resolve();
          }
        });
      });
      
      // Broadcast message to topic
      const broadcastMessage = { alert: 'System maintenance in 5 minutes' };
      const sent = wsManager.broadcastToTopic('system.status', broadcastMessage);
      
      expect(sent).toBe(1);
      
      // Wait for message
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          
          if (message.type === 'topic_message') {
            expect(message.topic).toBe('system.status');
            expect(message.data).toEqual(broadcastMessage);
            resolve();
          }
        });
      });
      
      ws.close();
    });
  });

  describe('Ping/Pong Mechanism', () => {
    test('should respond to ping messages', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'pong') {
          expect(message.timestamp).toBeDefined();
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON messages', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send('invalid json');
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'error') {
          expect(message.error.code).toBe('INVALID_JSON');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });

    test('should handle unknown message types', (done) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'unknown_type' }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'error') {
          expect(message.error.code).toBe('UNKNOWN_MESSAGE_TYPE');
          ws.close();
          done();
        }
      });
      
      ws.on('error', done);
    });
  });
});