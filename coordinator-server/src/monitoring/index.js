/**
 * Monitoring Infrastructure Index - Central export for all monitoring components
 * Comprehensive monitoring, analytics, and alerting system
 */

const { MetricsCollector, MetricsCollectorSingleton } = require('./MetricsCollector');
const { PerformanceMonitor, PerformanceMonitorSingleton } = require('./PerformanceMonitor');
const { SystemAnalytics, SystemAnalyticsSingleton } = require('./SystemAnalytics');
const { AlertingSystem, AlertingSystemSingleton } = require('./AlertingSystem');
const { DashboardController, DashboardControllerSingleton } = require('./DashboardController');

const monitoringRoutes = require('./routes/monitoring');

/**
 * Initialize complete monitoring infrastructure
 * @param {Object} options - Configuration options
 * @returns {Object} Initialized monitoring services
 */
function initializeMonitoring(options = {}) {
    console.log('Initializing monitoring infrastructure...');
    
    // Initialize all monitoring services
    const metricsCollector = MetricsCollectorSingleton.getInstance(options.metrics);
    const performanceMonitor = PerformanceMonitorSingleton.getInstance(options.performance);
    const systemAnalytics = SystemAnalyticsSingleton.getInstance(options.analytics);
    const alertingSystem = AlertingSystemSingleton.getInstance(options.alerting);
    const dashboardController = DashboardControllerSingleton.getInstance(options.dashboard);
    
    console.log('Monitoring infrastructure initialized successfully');
    
    return {
        metricsCollector,
        performanceMonitor,
        systemAnalytics,
        alertingSystem,
        dashboardController
    };
}

/**
 * Get monitoring middleware for Express.js
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function getMonitoringMiddleware(options = {}) {
    const performanceMonitor = PerformanceMonitorSingleton.getInstance();
    return performanceMonitor.getMiddleware();
}

/**
 * Shutdown all monitoring services
 */
async function shutdownMonitoring() {
    console.log('Shutting down monitoring infrastructure...');
    
    const services = [
        MetricsCollectorSingleton.getInstance(),
        PerformanceMonitorSingleton.getInstance(),
        SystemAnalyticsSingleton.getInstance(),
        AlertingSystemSingleton.getInstance(),
        DashboardControllerSingleton.getInstance()
    ];
    
    await Promise.all(services.map(service => service.shutdown()));
    
    console.log('Monitoring infrastructure shutdown complete');
}

module.exports = {
    // Core classes
    MetricsCollector,
    PerformanceMonitor,
    SystemAnalytics,
    AlertingSystem,
    DashboardController,
    
    // Singletons
    MetricsCollectorSingleton,
    PerformanceMonitorSingleton,
    SystemAnalyticsSingleton,
    AlertingSystemSingleton,
    DashboardControllerSingleton,
    
    // Routes
    monitoringRoutes,
    
    // Utilities
    initializeMonitoring,
    getMonitoringMiddleware,
    shutdownMonitoring
};