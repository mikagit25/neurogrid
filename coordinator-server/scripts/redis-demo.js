#!/usr/bin/env node

/**
 * Redis Cache Demo Script
 * 
 * This script demonstrates the Redis caching functionality
 * without requiring the full application server to be running.
 */

const RedisConfig = require('../src/config/redis');
const CacheService = require('../src/services/CacheService');

async function runDemo() {
  console.log('🚀 Starting Redis Cache Demo...\n');

  let redisConfig;
  let cacheService;

  try {
    // Initialize Redis
    console.log('📡 Connecting to Redis...');
    redisConfig = new RedisConfig();
    await redisConfig.initialize();
    console.log('✅ Redis connected successfully!\n');

    // Initialize Cache Service
    cacheService = new CacheService(redisConfig);
    console.log('🔧 Cache service initialized\n');

    // Demo 1: Basic caching
    console.log('📋 Demo 1: Basic Key-Value Caching');
    console.log('=' .repeat(40));
    
    const userData = {
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
      created: new Date().toISOString()
    };

    console.log('Setting user data in cache...');
    await cacheService.set('user:123', userData, 60);
    console.log('✅ Data cached with 60s TTL');

    console.log('Retrieving user data from cache...');
    const cachedUser = await cacheService.get('user:123');
    console.log('✅ Retrieved:', JSON.stringify(cachedUser, null, 2));
    console.log('');

    // Demo 2: Pattern-based operations
    console.log('📋 Demo 2: Pattern-Based Operations');
    console.log('=' .repeat(40));

    // Cache multiple user sessions
    const sessions = [
      { userId: '123', sessionId: 'sess_001', loginTime: new Date() },
      { userId: '123', sessionId: 'sess_002', loginTime: new Date() },
      { userId: '456', sessionId: 'sess_003', loginTime: new Date() }
    ];

    console.log('Caching multiple user sessions...');
    for (const session of sessions) {
      await cacheService.setSession(session.sessionId, session, 3600);
    }
    console.log('✅ 3 sessions cached');

    console.log('Invalidating all sessions for user 123...');
    const invalidated = await cacheService.invalidatePattern('session:sess_00[12]');
    console.log(`✅ Invalidated ${invalidated} sessions`);

    console.log('Checking remaining sessions...');
    const remainingSession = await cacheService.getSession('sess_003');
    console.log('✅ User 456 session still exists:', !!remainingSession);
    console.log('');

    // Demo 3: Cached function wrapper
    console.log('📋 Demo 3: Cached Function Wrapper');
    console.log('=' .repeat(40));

    let callCount = 0;
    const expensiveOperation = async (input) => {
      callCount++;
      console.log(`  🔄 Executing expensive operation #${callCount} with input: ${input}`);
      
      // Simulate expensive computation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        result: `Processed: ${input}`,
        computedAt: new Date().toISOString(),
        callNumber: callCount
      };
    };

    console.log('First call (will execute function):');
    const result1 = await cacheService.cached('expensive:demo', 
      () => expensiveOperation('test data'), 120);
    console.log('✅ Result:', result1.result);

    console.log('Second call (will use cache):');
    const startTime = Date.now();
    const result2 = await cacheService.cached('expensive:demo', 
      () => expensiveOperation('test data'), 120);
    const cacheTime = Date.now() - startTime;
    console.log(`✅ Result: ${result2.result} (retrieved in ${cacheTime}ms)`);
    console.log(`✅ Same call number: ${result2.callNumber} (cached!)\n`);

    // Demo 4: Cache statistics
    console.log('📋 Demo 4: Cache Statistics & Health');
    console.log('=' .repeat(40));

    const health = await cacheService.healthCheck();
    console.log('🏥 Health Check:');
    console.log(`  Status: ${health.status}`);
    console.log(`  Latency: ${health.latency}ms`);
    console.log(`  Memory: ${(health.memory.used_memory / 1024 / 1024).toFixed(2)}MB used`);
    console.log(`  Connections: ${health.connections.connected_clients}`);

    const stats = await cacheService.getStats();
    console.log('\n📊 Cache Statistics:');
    console.log(`  Total Keys: ${stats.keys}`);
    console.log(`  Cache Hits: ${stats.hits}`);
    console.log(`  Cache Misses: ${stats.misses}`);
    console.log(`  Hit Rate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}%`);
    console.log(`  Memory Usage: ${(stats.memory_usage / 1024 / 1024).toFixed(2)}MB`);
    console.log('');

    // Demo 5: Performance test
    console.log('📋 Demo 5: Performance Comparison');
    console.log('=' .repeat(40));

    const performanceData = { data: 'x'.repeat(1000), timestamp: Date.now() };
    const iterations = 100;

    // Test cache write performance
    console.log(`Writing ${iterations} items to cache...`);
    const writeStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await cacheService.set(`perf:${i}`, { ...performanceData, id: i }, 300);
    }
    const writeTime = Date.now() - writeStart;
    console.log(`✅ Wrote ${iterations} items in ${writeTime}ms (${(writeTime/iterations).toFixed(2)}ms per item)`);

    // Test cache read performance
    console.log(`Reading ${iterations} items from cache...`);
    const readStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await cacheService.get(`perf:${i}`);
    }
    const readTime = Date.now() - readStart;
    console.log(`✅ Read ${iterations} items in ${readTime}ms (${(readTime/iterations).toFixed(2)}ms per item)`);
    console.log('');

    console.log('🎉 Demo completed successfully!');
    console.log('\n💡 Key Benefits Demonstrated:');
    console.log('  ✓ Fast key-value storage with TTL');
    console.log('  ✓ Pattern-based cache invalidation');
    console.log('  ✓ Automatic function result caching');
    console.log('  ✓ Real-time health monitoring');
    console.log('  ✓ High-performance read/write operations');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 To fix this issue:');
      console.log('  1. Install Redis: brew install redis (macOS) or apt-get install redis (Ubuntu)');
      console.log('  2. Start Redis: redis-server');
      console.log('  3. Verify Redis is running: redis-cli ping');
    }
  } finally {
    // Cleanup
    if (redisConfig) {
      console.log('\n🧹 Cleaning up demo data...');
      try {
        // Clean up demo keys
        await redisConfig.del('user:123');
        await redisConfig.del('expensive:demo');
        
        // Clean up performance test keys
        for (let i = 0; i < 100; i++) {
          await redisConfig.del(`perf:${i}`);
        }
        
        console.log('✅ Cleanup completed');
        
        await redisConfig.disconnect();
        console.log('✅ Redis disconnected');
      } catch (cleanupError) {
        console.log('⚠️  Cleanup warning:', cleanupError.message);
      }
    }
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n👋 Demo interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the demo
if (require.main === module) {
  runDemo().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { runDemo };