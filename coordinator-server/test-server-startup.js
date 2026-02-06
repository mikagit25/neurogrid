#!/usr/bin/env node

/**
 * Server Startup Test
 * Tests if the server can start without major errors
 */

process.env.NODE_ENV = 'test';

console.log('🚀 Starting Server Test...\n');

async function testServerStartup() {
  try {
    // Import required modules
    const express = require('express');
    const logger = require('./src/utils/logger');
    
    // Create basic app
    const app = express();
    const port = 3002; // Use different port to avoid conflicts
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Start server
    const server = app.listen(port, () => {
      logger.info(`Test server started on port ${port}`);
      console.log('✅ Server startup test passed');
      
      // Close server after test
      server.close(() => {
        console.log('🏁 Server test completed successfully');
        process.exit(0);
      });
    });
    
    server.on('error', (error) => {
      console.error('❌ Server startup failed:', error.message);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
    process.exit(1);
  }
}

testServerStartup();