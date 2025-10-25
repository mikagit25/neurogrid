const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const logger = require('../utils/logger');

/**
 * Advanced Cryptographic Security Manager for NeuroGrid MainNet
 * Implements enterprise-grade encryption, key management, and security protocols
 */
class AdvancedSecurityManager {
  constructor(config = {}) {
    this.config = {
      keyDerivationIterations: config.keyDerivationIterations || 100000,
      encryptionAlgorithm: config.encryptionAlgorithm || 'aes-256-gcm',
      hashAlgorithm: config.hashAlgorithm || 'sha3-256',
      keyLength: config.keyLength || 32,
      ivLength: config.ivLength || 16,
      tagLength: config.tagLength || 16,
      saltLength: config.saltLength || 32,
      keyStorePath: config.keyStorePath || './keystore',
      backupPath: config.backupPath || './keystore/backup',
      auditLogPath: config.auditLogPath || './logs/security-audit.log'
    };

    this.masterKeys = new Map();
    this.derivedKeys = new Map();
    this.auditEvents = [];
    this.initialized = false;
  }

  /**
   * Initialize the security manager
   */
  async initialize() {
    try {
      // Create necessary directories
      await this.ensureDirectories();

      // Initialize master keys
      await this.initializeMasterKeys();

      // Setup audit logging
      await this.initializeAuditLogging();

      this.initialized = true;
      logger.info('Advanced Security Manager initialized successfully');

      return { success: true };
    } catch (error) {
      logger.error('Failed to initialize Advanced Security Manager:', error);
      throw error;
    }
  }

  /**
   * Generate cryptographically secure master key
   */
  async generateMasterKey(keyId, passphrase) {
    try {
      if (!this.initialized) await this.initialize();

      // Generate random salt
      const salt = crypto.randomBytes(this.config.saltLength);

      // Derive key from passphrase using scrypt
      const derivedKey = await scrypt(passphrase, salt, this.config.keyLength, {
        N: 16384, // CPU/memory cost parameter
        r: 8,     // Block size parameter
        p: 1      // Parallelization parameter
      });

      // Generate master key
      const masterKey = crypto.randomBytes(this.config.keyLength);

      // Encrypt master key with derived key
      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, derivedKey);

      let encryptedMasterKey = cipher.update(masterKey);
      encryptedMasterKey = Buffer.concat([encryptedMasterKey, cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Store encrypted master key
      const keyData = {
        keyId,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        encryptedKey: encryptedMasterKey.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.config.encryptionAlgorithm,
        created: new Date().toISOString(),
        version: '2.0'
      };

      await this.storeEncryptedKey(keyId, keyData);

      // Store in memory for active use
      this.masterKeys.set(keyId, masterKey);

      await this.auditLog('MASTER_KEY_GENERATED', { keyId });

      logger.info(`Master key generated for ${keyId}`);
      return {
        success: true,
        keyId,
        keyFingerprint: this.getKeyFingerprint(masterKey)
      };

    } catch (error) {
      logger.error(`Failed to generate master key for ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Unlock master key with passphrase
   */
  async unlockMasterKey(keyId, passphrase) {
    try {
      const keyData = await this.loadEncryptedKey(keyId);
      if (!keyData) {
        throw new Error(`Master key ${keyId} not found`);
      }

      // Recreate derived key
      const salt = Buffer.from(keyData.salt, 'hex');
      const derivedKey = await scrypt(passphrase, salt, this.config.keyLength, {
        N: 16384,
        r: 8,
        p: 1
      });

      // Decrypt master key
      const iv = Buffer.from(keyData.iv, 'hex');
      const encryptedKey = Buffer.from(keyData.encryptedKey, 'hex');
      const authTag = Buffer.from(keyData.authTag, 'hex');

      const decipher = crypto.createDecipher(keyData.algorithm, derivedKey);
      decipher.setAuthTag(authTag);

      let masterKey = decipher.update(encryptedKey);
      masterKey = Buffer.concat([masterKey, decipher.final()]);

      // Store in memory
      this.masterKeys.set(keyId, masterKey);

      await this.auditLog('MASTER_KEY_UNLOCKED', { keyId });

      logger.info(`Master key unlocked for ${keyId}`);
      return {
        success: true,
        keyId,
        keyFingerprint: this.getKeyFingerprint(masterKey)
      };

    } catch (error) {
      await this.auditLog('MASTER_KEY_UNLOCK_FAILED', { keyId, error: error.message });
      logger.error(`Failed to unlock master key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Derive encryption keys from master key
   */
  async deriveKey(masterKeyId, purpose, context = '') {
    try {
      const masterKey = this.masterKeys.get(masterKeyId);
      if (!masterKey) {
        throw new Error(`Master key ${masterKeyId} not unlocked`);
      }

      // Create derivation context
      const derivationData = `${purpose}:${context}:${Date.now()}`;
      const hmac = crypto.createHmac(this.config.hashAlgorithm, masterKey);
      hmac.update(derivationData);
      const derivedKey = hmac.digest();

      const derivedKeyId = `${masterKeyId}:${purpose}:${crypto.randomUUID()}`;
      this.derivedKeys.set(derivedKeyId, {
        key: derivedKey,
        purpose,
        context,
        created: new Date(),
        masterKeyId
      });

      await this.auditLog('KEY_DERIVED', {
        masterKeyId,
        derivedKeyId,
        purpose,
        context
      });

      return {
        success: true,
        keyId: derivedKeyId,
        keyFingerprint: this.getKeyFingerprint(derivedKey)
      };

    } catch (error) {
      logger.error(`Failed to derive key from ${masterKeyId}:`, error);
      throw error;
    }
  }

  /**
   * Encrypt data with specified key
   */
  async encryptData(keyId, data, additionalData = '') {
    try {
      let encryptionKey;

      // Check if it's a master key or derived key
      if (this.masterKeys.has(keyId)) {
        encryptionKey = this.masterKeys.get(keyId);
      } else if (this.derivedKeys.has(keyId)) {
        encryptionKey = this.derivedKeys.get(keyId).key;
      } else {
        throw new Error(`Encryption key ${keyId} not found`);
      }

      // Generate random IV
      const iv = crypto.randomBytes(this.config.ivLength);

      // Create cipher
      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, encryptionKey);

      // Add additional authenticated data if provided
      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData, 'utf8'));
      }

      // Encrypt data
      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();

      const result = {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.config.encryptionAlgorithm,
        additionalData: additionalData || null,
        timestamp: new Date().toISOString()
      };

      await this.auditLog('DATA_ENCRYPTED', {
        keyId,
        dataSize: data.length,
        hasAdditionalData: !!additionalData
      });

      return { success: true, encryptedData: result };

    } catch (error) {
      logger.error(`Failed to encrypt data with key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Decrypt data with specified key
   */
  async decryptData(keyId, encryptedData) {
    try {
      let decryptionKey;

      // Check if it's a master key or derived key
      if (this.masterKeys.has(keyId)) {
        decryptionKey = this.masterKeys.get(keyId);
      } else if (this.derivedKeys.has(keyId)) {
        decryptionKey = this.derivedKeys.get(keyId).key;
      } else {
        throw new Error(`Decryption key ${keyId} not found`);
      }

      // Extract components
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const encrypted = Buffer.from(encryptedData.encryptedData, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      // Create decipher
      const decipher = crypto.createDecipher(encryptedData.algorithm, decryptionKey);
      decipher.setAuthTag(authTag);

      // Add additional authenticated data if present
      if (encryptedData.additionalData) {
        decipher.setAAD(Buffer.from(encryptedData.additionalData, 'utf8'));
      }

      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      await this.auditLog('DATA_DECRYPTED', {
        keyId,
        dataSize: decrypted.length
      });

      return { success: true, decryptedData: decrypted };

    } catch (error) {
      await this.auditLog('DECRYPTION_FAILED', {
        keyId,
        error: error.message
      });
      logger.error(`Failed to decrypt data with key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Generate secure hash of data
   */
  generateSecureHash(data, salt = null) {
    const actualSalt = salt || crypto.randomBytes(this.config.saltLength);
    const hash = crypto.createHash(this.config.hashAlgorithm);
    hash.update(actualSalt);
    hash.update(data);

    return {
      hash: hash.digest('hex'),
      salt: actualSalt.toString('hex'),
      algorithm: this.config.hashAlgorithm
    };
  }

  /**
   * Verify secure hash
   */
  verifySecureHash(data, expectedHash, salt) {
    const saltBuffer = Buffer.from(salt, 'hex');
    const computed = this.generateSecureHash(data, saltBuffer);

    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(computed.hash, 'hex')
    );
  }

  /**
   * Generate digital signature
   */
  async generateSignature(keyId, data) {
    try {
      const signingKey = this.masterKeys.get(keyId);
      if (!signingKey) {
        throw new Error(`Signing key ${keyId} not found`);
      }

      // Create HMAC signature
      const hmac = crypto.createHmac(this.config.hashAlgorithm, signingKey);
      hmac.update(data);
      const signature = hmac.digest('hex');

      await this.auditLog('SIGNATURE_GENERATED', {
        keyId,
        dataSize: data.length
      });

      return {
        success: true,
        signature,
        algorithm: this.config.hashAlgorithm,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to generate signature with key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Verify digital signature
   */
  async verifySignature(keyId, data, signature) {
    try {
      const generated = await this.generateSignature(keyId, data);

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(generated.signature, 'hex')
      );

      await this.auditLog('SIGNATURE_VERIFIED', {
        keyId,
        dataSize: data.length,
        isValid
      });

      return { success: true, isValid };

    } catch (error) {
      await this.auditLog('SIGNATURE_VERIFICATION_FAILED', {
        keyId,
        error: error.message
      });
      logger.error(`Failed to verify signature with key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Secure key rotation
   */
  async rotateKey(oldKeyId, newPassphrase) {
    try {
      const oldKey = this.masterKeys.get(oldKeyId);
      if (!oldKey) {
        throw new Error(`Key ${oldKeyId} not found for rotation`);
      }

      // Generate new key ID
      const newKeyId = `${oldKeyId}_rotated_${Date.now()}`;

      // Generate new master key
      await this.generateMasterKey(newKeyId, newPassphrase);

      // Archive old key
      await this.archiveKey(oldKeyId);

      await this.auditLog('KEY_ROTATED', {
        oldKeyId,
        newKeyId
      });

      logger.info(`Key rotated from ${oldKeyId} to ${newKeyId}`);

      return {
        success: true,
        oldKeyId,
        newKeyId
      };

    } catch (error) {
      logger.error(`Failed to rotate key ${oldKeyId}:`, error);
      throw error;
    }
  }

  /**
   * Create secure backup of keys
   */
  async createSecureBackup(passphrase) {
    try {
      const backupData = {
        version: '2.0',
        created: new Date().toISOString(),
        keyCount: this.masterKeys.size,
        keys: {}
      };

      // Backup all keys
      for (const [keyId] of this.masterKeys) {
        const keyData = await this.loadEncryptedKey(keyId);
        backupData.keys[keyId] = keyData;
      }

      // Encrypt backup
      const backupJson = JSON.stringify(backupData, null, 2);
      const encrypted = await this.encryptData('backup_key', Buffer.from(backupJson));

      // Save to backup location
      const backupFileName = `backup_${Date.now()}.enc`;
      const backupPath = path.join(this.config.backupPath, backupFileName);

      await fs.writeFile(backupPath, JSON.stringify(encrypted.encryptedData));

      await this.auditLog('BACKUP_CREATED', {
        backupFileName,
        keyCount: this.masterKeys.size
      });

      logger.info(`Secure backup created: ${backupFileName}`);

      return {
        success: true,
        backupFileName,
        backupPath,
        keyCount: this.masterKeys.size
      };

    } catch (error) {
      logger.error('Failed to create secure backup:', error);
      throw error;
    }
  }

  /**
   * Get key fingerprint for identification
   */
  getKeyFingerprint(key) {
    const hash = crypto.createHash('sha256');
    hash.update(key);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Security audit log
   */
  async auditLog(event, data = {}) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
      processId: process.pid,
      nodeVersion: process.version
    };

    this.auditEvents.push(auditEntry);

    // Write to audit log file
    const logLine = JSON.stringify(auditEntry) + '\n';
    await fs.appendFile(this.config.auditLogPath, logLine);
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      initialized: this.initialized,
      masterKeysCount: this.masterKeys.size,
      derivedKeysCount: this.derivedKeys.size,
      recentAuditEvents: this.auditEvents.slice(-10),
      configuration: {
        encryptionAlgorithm: this.config.encryptionAlgorithm,
        hashAlgorithm: this.config.hashAlgorithm,
        keyLength: this.config.keyLength
      }
    };
  }

  // Helper methods
  async ensureDirectories() {
    await fs.mkdir(this.config.keyStorePath, { recursive: true });
    await fs.mkdir(this.config.backupPath, { recursive: true });
    await fs.mkdir(path.dirname(this.config.auditLogPath), { recursive: true });
  }

  async initializeMasterKeys() {
    // Load existing keys if any
    try {
      const files = await fs.readdir(this.config.keyStorePath);
      const keyFiles = files.filter(f => f.endsWith('.key'));

      logger.info(`Found ${keyFiles.length} existing key files`);
    } catch (error) {
      logger.info('No existing keys found, starting fresh');
    }
  }

  async initializeAuditLogging() {
    await this.auditLog('SECURITY_MANAGER_INITIALIZED', {
      configuration: this.config
    });
  }

  async storeEncryptedKey(keyId, keyData) {
    const keyPath = path.join(this.config.keyStorePath, `${keyId}.key`);
    await fs.writeFile(keyPath, JSON.stringify(keyData, null, 2));
  }

  async loadEncryptedKey(keyId) {
    try {
      const keyPath = path.join(this.config.keyStorePath, `${keyId}.key`);
      const keyDataJson = await fs.readFile(keyPath, 'utf8');
      return JSON.parse(keyDataJson);
    } catch (error) {
      return null;
    }
  }

  async archiveKey(keyId) {
    const keyPath = path.join(this.config.keyStorePath, `${keyId}.key`);
    const archivePath = path.join(this.config.backupPath, `${keyId}_archived_${Date.now()}.key`);

    try {
      await fs.rename(keyPath, archivePath);
      this.masterKeys.delete(keyId);
    } catch (error) {
      logger.error(`Failed to archive key ${keyId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
let securityManagerInstance = null;

class SecurityManagerSingleton {
  static getInstance(config = {}) {
    if (!securityManagerInstance) {
      securityManagerInstance = new AdvancedSecurityManager(config);
    }
    return securityManagerInstance;
  }
}

module.exports = {
  AdvancedSecurityManager,
  SecurityManagerSingleton
};
