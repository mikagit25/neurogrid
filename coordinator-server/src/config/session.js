const session = require('express-session');
const RedisStore = require('connect-redis').default;
const logger = require('../utils/logger');

class SessionConfig {
  constructor(config, redisConfig) {
    this.config = config;
    this.redisConfig = redisConfig;
    this.store = null;
  }

  createSessionStore() {
    try {
      if (this.redisConfig && this.redisConfig.isConnected) {
        // Use Redis for session storage
        this.store = new RedisStore({
          client: this.redisConfig.getClient(),
          prefix: 'sess:',
          ttl: 86400, // 24 hours
          disableTouch: false,
          disableTTL: false
        });

        logger.info('Session store configured with Redis');
      } else {
        // Fallback to memory store (development only)
        logger.warn('Using memory store for sessions - not suitable for production');
        this.store = new session.MemoryStore();
      }

      return this.store;
    } catch (error) {
      logger.error('Failed to create session store', { error: error.message });
      // Fallback to memory store
      this.store = new session.MemoryStore();
      return this.store;
    }
  }

  getSessionConfig() {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    
    return {
      store: this.createSessionStore(),
      secret: this.config.get('SESSION_SECRET', 'your-secret-key-change-in-production'),
      name: 'sessionId',
      resave: false,
      saveUninitialized: false,
      rolling: true, // Reset expiry on activity
      cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: isProduction ? 'strict' : 'lax'
      },
      genid: () => {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
      }
    };
  }

  getSessionMiddleware() {
    const sessionConfig = this.getSessionConfig();
    return session(sessionConfig);
  }

  // Session utility methods
  async destroySession(sessionId) {
    return new Promise((resolve, reject) => {
      if (this.store && this.store.destroy) {
        this.store.destroy(sessionId, (err) => {
          if (err) {
            logger.error('Failed to destroy session', { sessionId, error: err.message });
            reject(err);
          } else {
            logger.info('Session destroyed', { sessionId });
            resolve(true);
          }
        });
      } else {
        resolve(true);
      }
    });
  }

  async getSession(sessionId) {
    return new Promise((resolve, reject) => {
      if (this.store && this.store.get) {
        this.store.get(sessionId, (err, session) => {
          if (err) {
            logger.error('Failed to get session', { sessionId, error: err.message });
            reject(err);
          } else {
            resolve(session);
          }
        });
      } else {
        resolve(null);
      }
    });
  }

  async setSession(sessionId, sessionData) {
    return new Promise((resolve, reject) => {
      if (this.store && this.store.set) {
        this.store.set(sessionId, sessionData, (err) => {
          if (err) {
            logger.error('Failed to set session', { sessionId, error: err.message });
            reject(err);
          } else {
            logger.debug('Session saved', { sessionId });
            resolve(true);
          }
        });
      } else {
        resolve(true);
      }
    });
  }

  async getAllSessions() {
    return new Promise((resolve, reject) => {
      if (this.store && this.store.all) {
        this.store.all((err, sessions) => {
          if (err) {
            logger.error('Failed to get all sessions', { error: err.message });
            reject(err);
          } else {
            resolve(sessions || {});
          }
        });
      } else {
        resolve({});
      }
    });
  }

  async getSessionCount() {
    return new Promise((resolve, reject) => {
      if (this.store && this.store.length) {
        this.store.length((err, count) => {
          if (err) {
            logger.error('Failed to get session count', { error: err.message });
            reject(err);
          } else {
            resolve(count || 0);
          }
        });
      } else {
        resolve(0);
      }
    });
  }

  async clearExpiredSessions() {
    return new Promise((resolve, reject) => {
      if (this.store && this.store.clear) {
        this.store.clear((err) => {
          if (err) {
            logger.error('Failed to clear expired sessions', { error: err.message });
            reject(err);
          } else {
            logger.info('Expired sessions cleared');
            resolve(true);
          }
        });
      } else {
        resolve(true);
      }
    });
  }

  // Session analytics
  async getSessionStats() {
    try {
      const totalSessions = await this.getSessionCount();
      const allSessions = await this.getAllSessions();
      
      // Analyze session data
      const sessionsByDuration = {};
      const sessionsByUserAgent = {};
      let activeSessions = 0;
      
      Object.values(allSessions).forEach(session => {
        if (session && session.cookie) {
          const now = Date.now();
          const expires = new Date(session.cookie.expires).getTime();
          
          if (expires > now) {
            activeSessions++;
            
            const duration = Math.floor((now - (session.createdAt || now)) / 1000 / 60); // minutes
            const durationKey = duration < 60 ? '<1h' : duration < 1440 ? '<1d' : '>1d';
            sessionsByDuration[durationKey] = (sessionsByDuration[durationKey] || 0) + 1;
            
            const userAgent = session.userAgent || 'unknown';
            const browser = this.extractBrowser(userAgent);
            sessionsByUserAgent[browser] = (sessionsByUserAgent[browser] || 0) + 1;
          }
        }
      });

      return {
        total: totalSessions,
        active: activeSessions,
        expired: totalSessions - activeSessions,
        byDuration: sessionsByDuration,
        byBrowser: sessionsByUserAgent,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get session stats', { error: error.message });
      return {
        total: 0,
        active: 0,
        expired: 0,
        error: error.message
      };
    }
  }

  extractBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'other';
  }

  // Health check for session store
  async healthCheck() {
    try {
      const count = await this.getSessionCount();
      
      return {
        status: 'healthy',
        store: this.store.constructor.name,
        sessionCount: count,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = SessionConfig;