/**
 * Security Routes Index - Central export for all security routes
 */

const authRoutes = require('./auth');

module.exports = {
    auth: authRoutes
};