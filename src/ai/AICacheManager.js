/**
 * AI Cache Manager - Smart Caching System for AI Requests
 * Reduces costs and improves response times by caching frequent AI requests
 */

const crypto = require('crypto');

class AICacheManager {
    constructor(maxSize = 1000, ttlHours = 24) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
        this.stats = {
            hits: 0,
            misses: 0,
            saves: 0,
            evictions: 0
        };

        console.log(`🧠 AI Cache Manager initialized: maxSize=${maxSize}, TTL=${ttlHours}h`);

        // Cleanup expired entries every hour
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    /**
     * Generate cache key from request parameters
     */
    generateKey(model, input, options = {}) {
        const data = {
            model: model,
            input: input,
            options: {
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 150,
                // For images
                width: options.width || 512,
                height: options.height || 512,
                steps: options.steps || 20,
                guidance: options.guidance || 7.5
            }
        };

        const serialized = JSON.stringify(data);
        return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    }

    /**
     * Check if request result is in cache
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if entry has expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        console.log(`💾 Cache HIT for key: ${key} (age: ${Math.round((Date.now() - entry.timestamp) / 1000 / 60)}min)`);

        return {
            ...entry.data,
            cached: true,
            cache_age: Date.now() - entry.timestamp
        };
    }

    /**
     * Store result in cache
     */
    set(key, data, type = 'text') {
        // Don't cache error responses
        if (!data.success || data.error) {
            return false;
        }

        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        const entry = {
            data: {
                ...data,
                cached: false // Mark as fresh when storing
            },
            timestamp: Date.now(),
            type: type,
            accessCount: 1
        };

        this.cache.set(key, entry);
        this.stats.saves++;

        console.log(`💾 Cached ${type} result for key: ${key} (cache size: ${this.cache.size})`);
        return true;
    }

    /**
     * Check if a request should be cached based on input
     */
    shouldCache(input, type) {
        // Don't cache very short or very long inputs
        if (input.length < 10 || input.length > 2000) {
            return false;
        }

        // Don't cache inputs with time-sensitive queries
        const timeKeywords = ['today', 'now', 'current', 'latest', 'recent', 'this week', 'this month', '2026'];
        const lowerInput = input.toLowerCase();

        if (timeKeywords.some(keyword => lowerInput.includes(keyword))) {
            return false;
        }

        // Don't cache personal or private-sounding requests
        const personalKeywords = ['my', 'i am', 'i have', 'my name', 'personal'];
        if (personalKeywords.some(keyword => lowerInput.includes(keyword))) {
            return false;
        }

        return true;
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
            console.log(`🗑️ Evicted LRU cache entry: ${oldestKey}`);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expired = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                expired.push(key);
            }
        }

        expired.forEach(key => this.cache.delete(key));

        if (expired.length > 0) {
            console.log(`🧹 Cleaned up ${expired.length} expired cache entries`);
        }

        return expired.length;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ...this.stats,
            hitRate: isNaN(hitRate) ? 0 : Math.round(hitRate * 100) / 100,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Estimate memory usage (rough calculation)
     */
    estimateMemoryUsage() {
        let totalSize = 0;

        for (const [key, entry] of this.cache.entries()) {
            // Approximate size calculation
            totalSize += key.length * 2; // UTF-16
            totalSize += JSON.stringify(entry).length * 2;
        }

        return Math.round(totalSize / 1024); // Return in KB
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            saves: 0,
            evictions: 0
        };

        console.log(`🧹 Cache cleared: removed ${size} entries`);
        return size;
    }

    /**
     * Get cached entries for specific model (for debugging)
     */
    getEntriesForModel(model) {
        const entries = [];

        for (const [key, entry] of this.cache.entries()) {
            const age = Math.round((Date.now() - entry.timestamp) / 1000 / 60);
            entries.push({
                key: key,
                type: entry.type,
                age_minutes: age,
                access_count: entry.accessCount,
                size_kb: Math.round(JSON.stringify(entry).length / 1024)
            });
        }

        return entries.sort((a, b) => b.age_minutes - a.age_minutes);
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
        console.log('🧠 AI Cache Manager destroyed');
    }
}

module.exports = AICacheManager;