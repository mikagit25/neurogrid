/**
 * Encryption Manager - Handles data encryption, key management, and secure communications
 * Provides AES-256-GCM encryption, RSA key pairs, digital signatures, and secure key derivation
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class EncryptionManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      algorithm: options.algorithm || 'aes-256-gcm',
      keyLength: options.keyLength || 32, // 256 bits
      ivLength: options.ivLength || 16, // 128 bits
      tagLength: options.tagLength || 16, // 128 bits
      rsaKeySize: options.rsaKeySize || 2048,
      keyDerivationIterations: options.keyDerivationIterations || 100000,
      saltLength: options.saltLength || 32,
      enableKeyRotation: options.enableKeyRotation !== false,
      keyRotationInterval: options.keyRotationInterval || 24 * 60 * 60 * 1000, // 24 hours
      keyStorePath: options.keyStorePath || './keystore',
      enableHSM: options.enableHSM || false // Hardware Security Module support
    };

    // In-memory key storage (use HSM or secure key vault in production)
    this.keys = new Map();
    this.rsaKeyPairs = new Map();
    this.certificateStore = new Map();
    this.keyVersions = new Map();

    // Statistics
    this.stats = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      keyGenerations: 0,
      signatureOperations: 0,
      verificationOperations: 0,
      keyRotations: 0,
      errors: 0
    };

    // Initialize key rotation if enabled
    if (this.config.enableKeyRotation) {
      this.keyRotationTimer = setInterval(() => {
        this.rotateKeys();
      }, this.config.keyRotationInterval);
    }

    // Initialize master key
    this.initializeMasterKey();
  }

  async initializeMasterKey() {
    try {
      // Try to load existing master key
      const masterKeyPath = path.join(this.config.keyStorePath, 'master.key');

      try {
        await fs.access(masterKeyPath);
        const masterKeyData = await fs.readFile(masterKeyPath);
        this.masterKey = masterKeyData;
        console.log('Master key loaded from keystore');
      } catch (error) {
        // Generate new master key
        this.masterKey = crypto.randomBytes(this.config.keyLength);

        // Ensure keystore directory exists
        await fs.mkdir(this.config.keyStorePath, { recursive: true });

        // Save master key
        await fs.writeFile(masterKeyPath, this.masterKey, { mode: 0o600 });
        console.log('New master key generated and saved');
      }

      this.emit('masterKeyInitialized');

    } catch (error) {
      console.error('Failed to initialize master key:', error);
      this.emit('error', { type: 'masterKeyInitialization', error });
    }
  }

  // Symmetric encryption/decryption
  async encrypt(plaintext, keyId = 'default', associatedData = null) {
    try {
      this.stats.encryptionOperations++;

      const key = await this.getOrCreateKey(keyId);
      const iv = crypto.randomBytes(this.config.ivLength);

      const cipher = crypto.createCipher(this.config.algorithm, key, { iv });

      if (associatedData) {
        cipher.setAAD(Buffer.from(associatedData));
      }

      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const tag = cipher.getAuthTag();

      const result = {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        keyId,
        algorithm: this.config.algorithm,
        timestamp: new Date().toISOString()
      };

      if (associatedData) {
        result.aad = Buffer.from(associatedData).toString('base64');
      }

      this.emit('dataEncrypted', { keyId, size: plaintext.length });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      this.stats.errors++;
      this.emit('encryptionError', { keyId, error: error.message });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async decrypt(encryptedData, keyId = null) {
    try {
      this.stats.decryptionOperations++;

      const {
        encrypted,
        iv,
        tag,
        keyId: dataKeyId,
        aad
      } = encryptedData;

      const actualKeyId = keyId || dataKeyId;
      const key = await this.getKey(actualKeyId);

      if (!key) {
        throw new Error('Decryption key not found');
      }

      const decipher = crypto.createDecipher(
        this.config.algorithm,
        key,
        { iv: Buffer.from(iv, 'base64') }
      );

      decipher.setAuthTag(Buffer.from(tag, 'base64'));

      if (aad) {
        decipher.setAAD(Buffer.from(aad, 'base64'));
      }

      let decrypted = decipher.update(Buffer.from(encrypted, 'base64'));
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      this.emit('dataDecrypted', { keyId: actualKeyId, size: decrypted.length });

      return {
        success: true,
        data: decrypted.toString('utf8')
      };

    } catch (error) {
      this.stats.errors++;
      this.emit('decryptionError', { keyId, error: error.message });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Key management
  async generateKey(keyId, purpose = 'encryption') {
    try {
      this.stats.keyGenerations++;

      const key = crypto.randomBytes(this.config.keyLength);
      const keyMetadata = {
        id: keyId,
        key,
        purpose,
        createdAt: new Date(),
        version: 1,
        isActive: true,
        algorithm: this.config.algorithm
      };

      this.keys.set(keyId, keyMetadata);
      this.keyVersions.set(keyId, 1);

      // Encrypt and store key if keystore is enabled
      if (this.config.keyStorePath) {
        await this.storeKey(keyId, keyMetadata);
      }

      this.emit('keyGenerated', { keyId, purpose });

      return {
        success: true,
        keyId,
        createdAt: keyMetadata.createdAt
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getOrCreateKey(keyId) {
    let keyData = this.keys.get(keyId);

    if (!keyData) {
      const result = await this.generateKey(keyId);
      if (!result.success) {
        throw new Error(`Failed to generate key: ${result.error}`);
      }
      keyData = this.keys.get(keyId);
    }

    return keyData.key;
  }

  async getKey(keyId) {
    const keyData = this.keys.get(keyId);
    return keyData ? keyData.key : null;
  }

  async rotateKey(keyId) {
    try {
      const oldKeyData = this.keys.get(keyId);
      if (!oldKeyData) {
        throw new Error('Key not found');
      }

      // Create new key version
      const newVersion = oldKeyData.version + 1;
      const newKey = crypto.randomBytes(this.config.keyLength);

      const newKeyData = {
        ...oldKeyData,
        key: newKey,
        version: newVersion,
        createdAt: new Date(),
        previousVersion: oldKeyData.version
      };

      // Keep old key for decryption but mark as inactive
      const oldKeyId = `${keyId}_v${oldKeyData.version}`;
      this.keys.set(oldKeyId, { ...oldKeyData, isActive: false });

      // Update current key
      this.keys.set(keyId, newKeyData);
      this.keyVersions.set(keyId, newVersion);

      this.stats.keyRotations++;
      this.emit('keyRotated', { keyId, oldVersion: oldKeyData.version, newVersion });

      return {
        success: true,
        keyId,
        oldVersion: oldKeyData.version,
        newVersion
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  async rotateKeys() {
    console.log('Starting automatic key rotation...');

    const rotationPromises = [];

    for (const [keyId, keyData] of this.keys.entries()) {
      if (keyData.isActive && keyData.purpose === 'encryption') {
        const ageInMs = new Date() - keyData.createdAt;
        if (ageInMs >= this.config.keyRotationInterval) {
          rotationPromises.push(this.rotateKey(keyId));
        }
      }
    }

    const results = await Promise.allSettled(rotationPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Key rotation completed: ${successful} successful, ${failed} failed`);
    this.emit('keyRotationCompleted', { successful, failed });
  }

  // RSA key pair management
  async generateRSAKeyPair(keyId, keySize = null) {
    try {
      const actualKeySize = keySize || this.config.rsaKeySize;

      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: actualKeySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      const keyPair = {
        id: keyId,
        publicKey,
        privateKey,
        keySize: actualKeySize,
        createdAt: new Date(),
        isActive: true
      };

      this.rsaKeyPairs.set(keyId, keyPair);

      this.emit('rsaKeyPairGenerated', { keyId, keySize: actualKeySize });

      return {
        success: true,
        keyId,
        publicKey,
        keySize: actualKeySize
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  async encryptWithRSA(plaintext, keyId) {
    try {
      const keyPair = this.rsaKeyPairs.get(keyId);
      if (!keyPair) {
        throw new Error('RSA key pair not found');
      }

      const encrypted = crypto.publicEncrypt(
        {
          key: keyPair.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(plaintext)
      );

      return {
        success: true,
        encrypted: encrypted.toString('base64'),
        keyId
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decryptWithRSA(encryptedData, keyId) {
    try {
      const keyPair = this.rsaKeyPairs.get(keyId);
      if (!keyPair) {
        throw new Error('RSA key pair not found');
      }

      const decrypted = crypto.privateDecrypt(
        {
          key: keyPair.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedData, 'base64')
      );

      return {
        success: true,
        decrypted: decrypted.toString('utf8')
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Digital signatures
  async signData(data, keyId, algorithm = 'sha256') {
    try {
      this.stats.signatureOperations++;

      const keyPair = this.rsaKeyPairs.get(keyId);
      if (!keyPair) {
        throw new Error('RSA key pair not found');
      }

      const sign = crypto.createSign(algorithm);
      sign.update(data);

      const signature = sign.sign(keyPair.privateKey, 'base64');

      this.emit('dataSign', { keyId, algorithm, dataSize: data.length });

      return {
        success: true,
        signature,
        algorithm,
        keyId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  async verifySignature(data, signature, keyId, algorithm = 'sha256') {
    try {
      this.stats.verificationOperations++;

      const keyPair = this.rsaKeyPairs.get(keyId);
      if (!keyPair) {
        throw new Error('RSA key pair not found');
      }

      const verify = crypto.createVerify(algorithm);
      verify.update(data);

      const isValid = verify.verify(keyPair.publicKey, signature, 'base64');

      this.emit('signatureVerification', { keyId, algorithm, isValid });

      return {
        success: true,
        isValid,
        keyId,
        algorithm
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Key derivation
  async deriveKey(password, salt = null, iterations = null) {
    try {
      const actualSalt = salt ? Buffer.from(salt, 'base64') : crypto.randomBytes(this.config.saltLength);
      const actualIterations = iterations || this.config.keyDerivationIterations;

      const derivedKey = crypto.pbkdf2Sync(
        password,
        actualSalt,
        actualIterations,
        this.config.keyLength,
        'sha256'
      );

      return {
        success: true,
        key: derivedKey.toString('base64'),
        salt: actualSalt.toString('base64'),
        iterations: actualIterations
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Secure random generation
  generateSecureRandom(length = 32, encoding = 'base64') {
    try {
      const random = crypto.randomBytes(length);
      return {
        success: true,
        random: random.toString(encoding),
        length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Hash functions
  hash(data, algorithm = 'sha256', encoding = 'hex') {
    try {
      const hash = crypto.createHash(algorithm);
      hash.update(data);

      return {
        success: true,
        hash: hash.digest(encoding),
        algorithm
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // HMAC
  generateHMAC(data, keyId, algorithm = 'sha256') {
    try {
      const key = this.keys.get(keyId);
      if (!key) {
        throw new Error('HMAC key not found');
      }

      const hmac = crypto.createHmac(algorithm, key.key);
      hmac.update(data);

      return {
        success: true,
        hmac: hmac.digest('hex'),
        algorithm,
        keyId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Certificate management
  async storeCertificate(certId, certificate, privateKey = null) {
    try {
      const certData = {
        id: certId,
        certificate,
        privateKey,
        createdAt: new Date(),
        isActive: true
      };

      this.certificateStore.set(certId, certData);

      this.emit('certificateStored', { certId });

      return {
        success: true,
        certId,
        createdAt: certData.createdAt
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getCertificate(certId) {
    const cert = this.certificateStore.get(certId);
    return cert ? {
      id: cert.id,
      certificate: cert.certificate,
      createdAt: cert.createdAt,
      isActive: cert.isActive
    } : null;
  }

  // Key storage (encrypted)
  async storeKey(keyId, keyData) {
    try {
      const keyPath = path.join(this.config.keyStorePath, `${keyId}.key`);

      // Encrypt key with master key
      const iv = crypto.randomBytes(this.config.ivLength);
      const cipher = crypto.createCipher(this.config.algorithm, this.masterKey, { iv });

      const keyDataString = JSON.stringify({
        ...keyData,
        key: keyData.key.toString('base64')
      });

      let encrypted = cipher.update(keyDataString, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const tag = cipher.getAuthTag();

      const storedData = {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
      };

      await fs.writeFile(keyPath, JSON.stringify(storedData), { mode: 0o600 });

    } catch (error) {
      console.error('Failed to store key:', error);
      throw error;
    }
  }

  async loadKey(keyId) {
    try {
      const keyPath = path.join(this.config.keyStorePath, `${keyId}.key`);
      const storedData = JSON.parse(await fs.readFile(keyPath, 'utf8'));

      const decipher = crypto.createDecipher(
        this.config.algorithm,
        this.masterKey,
        { iv: Buffer.from(storedData.iv, 'base64') }
      );

      decipher.setAuthTag(Buffer.from(storedData.tag, 'base64'));

      let decrypted = decipher.update(Buffer.from(storedData.encrypted, 'base64'));
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const keyData = JSON.parse(decrypted.toString('utf8'));
      keyData.key = Buffer.from(keyData.key, 'base64');

      return keyData;

    } catch (error) {
      console.error('Failed to load key:', error);
      return null;
    }
  }

  // Secure communication helpers
  async createSecureSession(peerId) {
    try {
      // Generate ephemeral key pair for key exchange
      const ephemeralKeyId = `ephemeral_${peerId}_${Date.now()}`;
      await this.generateRSAKeyPair(ephemeralKeyId, 2048);

      // Generate session key
      const sessionKeyId = `session_${peerId}_${Date.now()}`;
      await this.generateKey(sessionKeyId, 'session');

      const sessionData = {
        peerId,
        sessionKeyId,
        ephemeralKeyId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isActive: true
      };

      return {
        success: true,
        session: sessionData,
        publicKey: this.rsaKeyPairs.get(ephemeralKeyId).publicKey
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // API methods
  getKeyInfo(keyId) {
    const keyData = this.keys.get(keyId);
    if (!keyData) {
      return null;
    }

    return {
      id: keyData.id,
      purpose: keyData.purpose,
      algorithm: keyData.algorithm,
      createdAt: keyData.createdAt,
      version: keyData.version,
      isActive: keyData.isActive
    };
  }

  listKeys(filters = {}) {
    const keys = Array.from(this.keys.values());

    let filteredKeys = keys;

    if (filters.purpose) {
      filteredKeys = filteredKeys.filter(key => key.purpose === filters.purpose);
    }

    if (filters.isActive !== undefined) {
      filteredKeys = filteredKeys.filter(key => key.isActive === filters.isActive);
    }

    return filteredKeys.map(key => ({
      id: key.id,
      purpose: key.purpose,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      version: key.version,
      isActive: key.isActive
    }));
  }

  listRSAKeyPairs(filters = {}) {
    const keyPairs = Array.from(this.rsaKeyPairs.values());

    let filteredKeys = keyPairs;

    if (filters.isActive !== undefined) {
      filteredKeys = filteredKeys.filter(key => key.isActive === filters.isActive);
    }

    return filteredKeys.map(key => ({
      id: key.id,
      keySize: key.keySize,
      createdAt: key.createdAt,
      isActive: key.isActive,
      publicKey: key.publicKey
    }));
  }

  getStats() {
    return {
      ...this.stats,
      totalKeys: this.keys.size,
      activeKeys: Array.from(this.keys.values()).filter(k => k.isActive).length,
      rsaKeyPairs: this.rsaKeyPairs.size,
      certificates: this.certificateStore.size,
      averageKeyAge: this.calculateAverageKeyAge()
    };
  }

  calculateAverageKeyAge() {
    const activeKeys = Array.from(this.keys.values()).filter(k => k.isActive);
    if (activeKeys.length === 0) return 0;

    const totalAge = activeKeys.reduce((sum, key) => {
      return sum + (new Date() - key.createdAt);
    }, 0);

    return Math.floor(totalAge / activeKeys.length / (1000 * 60 * 60)); // Hours
  }

  async shutdown() {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let encryptionManagerInstance = null;

class EncryptionManagerSingleton {
  static getInstance(options = {}) {
    if (!encryptionManagerInstance) {
      encryptionManagerInstance = new EncryptionManager(options);
    }
    return encryptionManagerInstance;
  }
}

module.exports = { EncryptionManager, EncryptionManagerSingleton };
