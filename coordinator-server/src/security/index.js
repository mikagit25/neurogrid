/**
 * Security Infrastructure Index - Central export for all security components
 */

const { AuthenticationManager, AuthenticationManagerSingleton } = require('./AuthenticationManager');
const { AuthorizationManager, AuthorizationManagerSingleton } = require('./AuthorizationManager');
const { EncryptionManager, EncryptionManagerSingleton } = require('./EncryptionManager');
const { SecureCommunicationManager, SecureCommunicationManagerSingleton } = require('./SecureCommunicationManager');

const middleware = require('./middleware');
const routes = require('./routes');

module.exports = {
    // Managers
    AuthenticationManager,
    AuthenticationManagerSingleton,
    AuthorizationManager,
    AuthorizationManagerSingleton,
    EncryptionManager,
    EncryptionManagerSingleton,
    SecureCommunicationManager,
    SecureCommunicationManagerSingleton,
    
    // Middleware
    middleware,
    
    // Routes
    routes
};