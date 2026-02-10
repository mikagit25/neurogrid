#!/usr/bin/env node

/**
 * NeuroGrid - Unified Application Entry Point
 * 
 * Единая точка входа для запуска NeuroGrid платформы
 * Поддерживает различные режимы работы и конфигурации
 * 
 * @version 2.0.0-unified
 * @author NeuroGrid Development Team
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'smart-router';

console.log('🚀 NeuroGrid Unified Launcher v2.0.0');
console.log(`📍 Starting in mode: ${mode}`);

// Validate mode and launch appropriate server
switch (mode.toLowerCase()) {
    case 'smart-router':
    case 'production':
    case 'enhanced':
        console.log('🧠 Launching Enhanced Smart Router Server...');
        require('./enhanced-server.js');
        break;
        
    case 'coordinator':
        console.log('🎯 Launching Coordinator Server...');
        if (fs.existsSync('./coordinator-server/src/app.js')) {
            require('./coordinator-server/src/app.js');
        } else {
            console.error('❌ Coordinator server not found');
            process.exit(1);
        }
        break;
        
    case 'node-client':
        console.log('💻 Launching GPU Node Client...');
        const { spawn } = require('child_process');
        const pythonProcess = spawn('python', ['./node-client/main.py'], {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        pythonProcess.on('error', (error) => {
            console.error('❌ Failed to start GPU node client:', error);
            process.exit(1);
        });
        break;
        
    case 'help':
    case '--help':
    case '-h':
        displayHelp();
        break;
        
    default:
        console.error(`❌ Unknown mode: ${mode}`);
        console.log('💡 Use "node index.js help" to see available options');
        process.exit(1);
}

function displayHelp() {
    console.log(`
📚 NeuroGrid Unified Launcher - Available Modes:

🧠 smart-router (default)
   Launches the Enhanced Smart Router Server
   Usage: node index.js smart-router
   Port: 3001
   Features: AI Processing, WebSocket, DeFi Integration

🎯 coordinator  
   Launches the Coordinator Server
   Usage: node index.js coordinator
   Port: 3001 (configurable)
   Features: Node Management, Task Orchestration

💻 node-client
   Launches the GPU Node Client (Python)
   Usage: node index.js node-client
   Features: GPU Processing, Model Loading

Environment Variables:
   NODE_ENV=production|development|staging
   PORT=3001 (default)
   DATABASE_URL=postgresql://...

Configuration Files:
   .env - Main environment configuration
   .env.production - Production specific settings
   config/environments/ - Environment-specific configs

Quick Start:
   npm start              # Launches smart-router mode
   node index.js help     # Shows this help
   node index.js coordinator  # Coordinator mode
   
For more information, see DOCS_INDEX.md
    `);
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\\n🛑 Gracefully shutting down NeuroGrid...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Log startup completion
process.nextTick(() => {
    console.log('✅ NeuroGrid startup completed');
    console.log('📊 Health check: http://localhost:3001/health');
    console.log('🌐 Web interface: http://localhost:3001/');
    console.log('📖 Documentation: See DOCS_INDEX.md');
});