#!/usr/bin/env node

/**
 * Минимальный сервер NeurogGrid для тестирования
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'NeurogGrid Coordinator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'NeurogGrid Coordinator Server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      'GET /health - Health check',
      'GET /api/info - API information',
      'GET /api/status - System status'
    ]
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    server: 'online',
    database: 'testing mode',
    redis: 'testing mode',
    blockchain: 'testing mode',
    services: {
      auth: 'available',
      tasks: 'available',
      monitoring: 'available'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 NeurogGrid Minimal Server started successfully!`);
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api/info`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

module.exports = app;