#!/usr/bin/env node

/**
 * Advanced Rate Limiter Demo Script
 * 
 * This script demonstrates the advanced rate limiting functionality
 * with different algorithms and configurations.
 */

const express = require('express');
const AdvancedRateLimiter = require('../src/services/AdvancedRateLimiter');

async function runDemo() {
  console.log('🚦 Starting Advanced Rate Limiter Demo...\n');

  try {
    // Initialize rate limiter
    console.log('🔧 Initializing Rate Limiter...');
    const rateLimiter = new AdvancedRateLimiter({
      enableDynamicAdjustment: true
    });
    
    console.log('✅ Rate limiter initialized\n');

    // Demo 1: Different Algorithms
    console.log('📋 Demo 1: Rate Limiting Algorithms');
    console.log('=' .repeat(50));
    
    // Token Bucket Demo
    console.log('\n🪣 Token Bucket Algorithm:');
    const tokenBucketResult = await rateLimiter.tokenBucketCheck('user:123', {
      algorithm: 'token_bucket',
      max: 10,
      windowMs: 60000,
      burstAllowance: 5
    });
    console.log('  Result:', JSON.stringify(tokenBucketResult, null, 2));
    
    // Sliding Window Demo
    console.log('\n🪟 Sliding Window Algorithm:');
    const slidingWindowResult = await rateLimiter.slidingWindowCheck('user:456', {
      algorithm: 'sliding_window',
      max: 5,
      windowMs: 30000
    });
    console.log('  Result:', JSON.stringify(slidingWindowResult, null, 2));
    
    // Fixed Window Demo
    console.log('\n🕐 Fixed Window Algorithm:');
    const fixedWindowResult = await rateLimiter.fixedWindowCheck('user:789', {
      algorithm: 'fixed_window',
      max: 3,
      windowMs: 60000
    });
    console.log('  Result:', JSON.stringify(fixedWindowResult, null, 2));

    // Demo 2: Express Middleware Integration
    console.log('\n📋 Demo 2: Express Middleware Integration');
    console.log('=' .repeat(50));
    
    const app = express();
    
    // Add different rate limiters
    const apiLimiter = rateLimiter.createLimiter('api', {
      max: 5,
      windowMs: 10000 // 10 seconds for demo
    });
    
    const authLimiter = rateLimiter.createLimiter('auth', {
      max: 2,
      windowMs: 30000 // 30 seconds
    });
    
    // Test endpoints
    app.get('/api/test', apiLimiter, (req, res) => {
      res.json({ message: 'API request successful', timestamp: new Date() });
    });
    
    app.post('/auth/login', authLimiter, (req, res) => {
      res.json({ message: 'Auth request successful', timestamp: new Date() });
    });
    
    console.log('✅ Express middleware configured');

    // Demo 3: Tier-based Limits
    console.log('\n📋 Demo 3: Tier-based Rate Limiting');
    console.log('=' .repeat(50));
    
    const tiers = ['free', 'starter', 'professional', 'enterprise'];
    
    for (const tier of tiers) {
      const multiplier = rateLimiter.getTierMultiplier(tier, 'api');
      const baseLimit = 100;
      const tierLimit = Math.floor(baseLimit * multiplier);
      
      console.log(`  ${tier.toUpperCase().padEnd(12)}: ${tierLimit.toString().padStart(5)} requests/min (${multiplier}x)`);
    }

    // Demo 4: Whitelist/Blacklist
    console.log('\n📋 Demo 4: Whitelist/Blacklist Management');
    console.log('=' .repeat(50));
    
    // Add to whitelist
    rateLimiter.addToWhitelist('192.168.1.100');
    console.log('✅ Added 192.168.1.100 to whitelist');
    
    // Add to blacklist
    rateLimiter.addToBlacklist('10.0.0.1', 'Suspicious activity detected');
    console.log('⛔ Added 10.0.0.1 to blacklist');
    
    console.log(`  Whitelist size: ${rateLimiter.whitelist.size}`);
    console.log(`  Blacklist size: ${rateLimiter.blacklist.size}`);

    // Demo 5: Statistics and Monitoring
    console.log('\n📋 Demo 5: Statistics and Monitoring');
    console.log('=' .repeat(50));
    
    // Simulate some requests
    rateLimiter.stats.totalRequests = 1000;
    rateLimiter.stats.blockedRequests = 50;
    rateLimiter.stats.penalizedRequests = 10;
    rateLimiter.stats.whitelistHits = 25;
    rateLimiter.stats.blacklistHits = 5;
    
    const stats = rateLimiter.getStats();
    
    console.log('📊 Current Statistics:');
    console.log(`  Total Requests: ${stats.totalRequests}`);
    console.log(`  Blocked Requests: ${stats.blockedRequests}`);
    console.log(`  Block Rate: ${stats.blockPercentage}%`);
    console.log(`  Penalized Requests: ${stats.penalizedRequests}`);
    console.log(`  Whitelist Hits: ${stats.whitelistHits}`);
    console.log(`  Blacklist Hits: ${stats.blacklistHits}`);
    console.log(`  Current Load: ${stats.currentLoad}`);
    console.log(`  Uptime: ${Math.round(stats.uptime / 1000)}s`);

    // Demo 6: Load Testing Simulation
    console.log('\n📋 Demo 6: Load Testing Simulation');
    console.log('=' .repeat(50));
    
    console.log('🚀 Simulating high load...');
    
    const testConfig = {
      algorithm: rateLimiter.algorithms.SLIDING_WINDOW,
      max: 5,
      windowMs: 5000 // 5 seconds
    };
    
    // Simulate 20 requests in quick succession
    let allowed = 0;
    let blocked = 0;
    
    for (let i = 0; i < 20; i++) {
      const result = await rateLimiter.slidingWindowCheck(`load-test:${Date.now()}`, testConfig);
      
      if (result.blocked) {
        blocked++;
        process.stdout.write('❌');
      } else {
        allowed++;
        process.stdout.write('✅');
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n\n📈 Load Test Results:`);
    console.log(`  Allowed: ${allowed}/20 (${Math.round(allowed/20*100)}%)`);
    console.log(`  Blocked: ${blocked}/20 (${Math.round(blocked/20*100)}%)`);

    // Demo 7: Dynamic Adjustment
    console.log('\n📋 Demo 7: Dynamic Rate Adjustment');
    console.log('=' .repeat(50));
    
    const baseLimit = 100;
    
    // Simulate different load conditions
    const loadConditions = [
      { load: 0.3, description: 'Low load' },
      { load: 0.7, description: 'Normal load' },
      { load: 0.85, description: 'High load' },
      { load: 0.95, description: 'Critical load' }
    ];
    
    for (const condition of loadConditions) {
      // Mock the system load
      rateLimiter.getCurrentSystemLoad = () => condition.load;
      
      const adjustedLimit = rateLimiter.applyDynamicAdjustment(baseLimit);
      const reduction = Math.round((1 - adjustedLimit / baseLimit) * 100);
      
      console.log(`  ${condition.description.padEnd(12)}: ${adjustedLimit.toString().padStart(3)} requests/min (${reduction}% reduction)`);
    }

    // Demo 8: Event Monitoring
    console.log('\n📋 Demo 8: Event Monitoring');
    console.log('=' .repeat(50));
    
    rateLimiter.on('rateLimited', (data) => {
      console.log('🚨 Rate limit triggered:', {
        key: data.key,
        ip: data.req.ip,
        url: data.req.url
      });
    });
    
    rateLimiter.on('blacklisted', (data) => {
      console.log('⚫ IP blacklisted:', data);
    });
    
    rateLimiter.on('loadCheck', (data) => {
      if (data.adjustmentActive) {
        console.log('⚡ Dynamic adjustment active:', `${Math.round(data.load * 100)}% load`);
      }
    });
    
    console.log('✅ Event listeners registered');

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('  ✓ Multiple rate limiting algorithms');
    console.log('  ✓ Tier-based rate limits');
    console.log('  ✓ Whitelist/blacklist management');
    console.log('  ✓ Real-time statistics and monitoring');
    console.log('  ✓ Dynamic rate adjustment based on load');
    console.log('  ✓ Event-driven monitoring');
    console.log('  ✓ Express middleware integration');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    
    if (error.message.includes('Redis')) {
      console.log('\n💡 Note: Redis is not required for this demo');
      console.log('  The rate limiter falls back to in-memory storage');
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