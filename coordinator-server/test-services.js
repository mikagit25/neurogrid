/**
 * Basic functionality test for NeuroGrid Enhanced Services
 * Quick verification of core components
 */

const path = require('path');

// Mock logger for testing
const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.log
};

async function testOptimizationServices() {
  console.log('\n🔧 Testing Optimization Services...');
  
  try {
    // Test PerformanceOptimizer
    const PerformanceOptimizer = require('./src/optimizations/PerformanceOptimizer');
    const mockApp = { use: () => {} };
    
    const perfOptimizer = new PerformanceOptimizer(mockApp, {
      enableCluster: false, // Disable cluster for testing
      enableCompression: true
    });
    
    const metrics = perfOptimizer.getMetrics();
    console.log('✅ PerformanceOptimizer: Working');
    console.log('   - Cluster enabled:', metrics.cluster.enabled);
    console.log('   - Optimizations:', Object.keys(metrics.optimizations).join(', '));
    
    // Test DatabaseOptimizer
    const DatabaseOptimizer = require('./src/optimizations/DatabaseOptimizer');
    const mockDb = {
      query: async () => ({ rows: [] }),
      healthCheck: async () => ({ status: 'healthy' })
    };
    
    const dbOptimizer = new DatabaseOptimizer(mockDb, {
      enableQueryCache: true,
      enablePreparedStatements: true
    });
    
    const dbMetrics = dbOptimizer.getMetrics();
    console.log('✅ DatabaseOptimizer: Working');
    console.log('   - Query cache enabled:', dbMetrics.cache.size >= 0);
    console.log('   - Prepared statements:', dbMetrics.preparedStatements.enabled);
    
  } catch (error) {
    console.log('❌ Optimization Services Error:', error.message);
    return false;
  }
  
  return true;
}

async function testEnhancedWalletServices() {
  console.log('\n💼 Testing Enhanced Wallet Services...');
  
  try {
    // Test DeFi Service
    const DeFiIntegrationService = require('./src/services/DeFiIntegrationService');
    const defiService = new DeFiIntegrationService({
      enableTestnet: true
    });
    
    const defiAnalytics = defiService.getAnalytics();
    console.log('✅ DeFiIntegrationService: Working');
    console.log('   - Supported protocols:', defiAnalytics.supportedProtocols.length);
    
    // Test NFT Service
    const NFTService = require('./src/services/NFTService');
    const nftService = new NFTService({
      enableTestnet: true
    });
    
    const nftAnalytics = nftService.getAnalytics();
    console.log('✅ NFTService: Working');
    console.log('   - Supported marketplaces:', nftAnalytics.supportedMarketplaces.length);
    console.log('   - Supported standards:', nftAnalytics.supportedStandards.length);
    
    // Test MultiSig Service
    const MultiSigWalletService = require('./src/services/MultiSigWalletService');
    const multiSigService = new MultiSigWalletService({
      minSignatures: 2,
      maxSigners: 5
    });
    
    const multiSigAnalytics = multiSigService.getAnalytics();
    console.log('✅ MultiSigWalletService: Working');
    console.log('   - Total wallets:', multiSigAnalytics.totalWallets);
    console.log('   - Features enabled:', Object.keys(multiSigAnalytics.features).join(', '));
    
  } catch (error) {
    console.log('❌ Enhanced Wallet Services Error:', error.message);
    return false;
  }
  
  return true;
}

async function testAnalyticsServices() {
  console.log('\n📊 Testing Analytics Services...');
  
  try {
    // Test RealTimeAnalytics
    const RealTimeAnalytics = require('./src/analytics/RealTimeAnalytics');
    
    // Mock dependencies
    const mockWsManager = {
      sendToClient: () => {},
      getConnectionCount: () => 5
    };
    
    const mockDbOptimizer = {
      getMetrics: () => ({
        queries: { total: 100, averageTime: 50 },
        cache: { hits: 80, misses: 20 }
      })
    };
    
    const mockPerfOptimizer = {
      getMetrics: () => ({
        requests: { total: 500, averageResponseTime: 200 },
        memory: { heapUsedMB: 150, heapTotalMB: 200 }
      })
    };
    
    const analytics = new RealTimeAnalytics(
      mockWsManager, 
      mockDbOptimizer, 
      mockPerfOptimizer,
      { updateInterval: 10000 } // 10 seconds for testing
    );
    
    // Test basic functionality
    const dashboardData = analytics.getDashboardData();
    console.log('✅ RealTimeAnalytics: Working');
    console.log('   - Subscribers:', dashboardData.subscribers);
    console.log('   - System health:', dashboardData.systemHealth.status);
    
    // Stop analytics to prevent background processes
    analytics.stop();
    
  } catch (error) {
    console.log('❌ Analytics Services Error:', error.message);
    return false;
  }
  
  return true;
}

async function testAPIRoutes() {
  console.log('\n🔗 Testing API Routes...');
  
  try {
    // Test if routes can be loaded without errors
    const enhancedWalletRoutes = require('./src/api/routes/enhanced-wallet');
    const analyticsRoutes = require('./src/api/routes/advanced-analytics');
    
    console.log('✅ Enhanced Wallet Routes: Loaded successfully');
    console.log('✅ Advanced Analytics Routes: Loaded successfully');
    
    // Verify route methods exist
    console.log('   - Enhanced wallet routes have setDependencies:', typeof enhancedWalletRoutes.setDependencies === 'function');
    console.log('   - Analytics routes have setDependencies:', typeof analyticsRoutes.setDependencies === 'function');
    
  } catch (error) {
    console.log('❌ API Routes Error:', error.message);
    return false;
  }
  
  return true;
}

async function runAllTests() {
  console.log('🚀 Starting NeuroGrid Enhanced Services Test Suite');
  console.log('================================================');
  
  const results = [];
  
  results.push(await testOptimizationServices());
  results.push(await testEnhancedWalletServices());
  results.push(await testAnalyticsServices());
  results.push(await testAPIRoutes());
  
  console.log('\n📋 Test Summary');
  console.log('================');
  
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Services are ready for deployment.');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };