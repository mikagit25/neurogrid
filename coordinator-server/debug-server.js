// Debug version of server startup
const logger = require('./src/utils/logger');

async function debugServer() {
  try {
    console.log('1. Starting debug server...');
    
    console.log('2. Loading app.js...');
    const { initializeServer } = require('./src/app.js');
    
    console.log('3. Calling initializeServer...');
    const server = await initializeServer();
    
    console.log('4. Server initialized successfully:', !!server);
    
  } catch (error) {
    console.error('DEBUG ERROR:', error.message);
    console.error('STACK TRACE:', error.stack);
    process.exit(1);
  }
}

debugServer();