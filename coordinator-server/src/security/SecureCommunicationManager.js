/**
 * Secure Communication Manager - Handles TLS/SSL, certificates, and secure protocols
 * Provides secure websocket connections, certificate validation, and encrypted channels
 */

const https = require('https');
const tls = require('tls');
const crypto = require('crypto');
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { EncryptionManagerSingleton } = require('./EncryptionManager');

class SecureCommunicationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      tlsVersion: options.tlsVersion || 'TLSv1.3',
      cipherSuites: options.cipherSuites || [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES128-SHA256'
      ],
      enableHSTS: options.enableHSTS !== false,
      hstsMaxAge: options.hstsMaxAge || 31536000, // 1 year
      enableOCSP: options.enableOCSP !== false,
      certificateTransparency: options.certificateTransparency !== false,
      secureWebSockets: options.secureWebSockets !== false,
      clientCertificateAuth: options.clientCertificateAuth || false,
      certificateChainValidation: options.certificateChainValidation !== false,
      allowSelfSigned: options.allowSelfSigned || false,
      pinPublicKeys: options.pinPublicKeys || false,
      enablePerfectForwardSecrecy: options.enablePerfectForwardSecrecy !== false
    };

    this.encryptionManager = EncryptionManagerSingleton.getInstance();

    // Certificate store
    this.certificates = new Map();
    this.caCertificates = new Map();
    this.certificateChains = new Map();
    this.pinnedKeys = new Map();

    // Secure connections tracking
    this.secureConnections = new Map();
    this.webSocketConnections = new Map();

    // Statistics
    this.stats = {
      secureConnections: 0,
      webSocketConnections: 0,
      certificateValidations: 0,
      tlsHandshakes: 0,
      rejectedConnections: 0,
      certificateErrors: 0,
      protocolViolations: 0
    };

    // Initialize default TLS context
    this.initializeTLSContext();
  }

  initializeTLSContext() {
    // Create secure TLS context with strong defaults
    this.tlsOptions = {
      secureProtocol: this.config.tlsVersion,
      ciphers: this.config.cipherSuites.join(':'),
      honorCipherOrder: true,
      secureOptions: (
        crypto.constants.SSL_OP_NO_SSLv2 |
                crypto.constants.SSL_OP_NO_SSLv3 |
                crypto.constants.SSL_OP_NO_TLSv1 |
                crypto.constants.SSL_OP_NO_TLSv1_1 |
                crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE
      ),
      dhparam: this.generateDHParams(),
      ecdhCurve: 'prime256v1:secp384r1:secp521r1'
    };

    if (this.config.enablePerfectForwardSecrecy) {
      this.tlsOptions.secureOptions |= crypto.constants.SSL_OP_SINGLE_ECDH_USE;
    }
  }

  generateDHParams() {
    // Generate Diffie-Hellman parameters for perfect forward secrecy
    try {
      return crypto.getDiffieHellman('modp2048').getPrime();
    } catch (error) {
      console.warn('Failed to generate DH params, using default');
      return null;
    }
  }

  // Certificate management
  async loadCertificate(certId, certPath, keyPath, passphrase = null) {
    try {
      const fs = require('fs').promises;

      const cert = await fs.readFile(certPath, 'utf8');
      const key = await fs.readFile(keyPath, 'utf8');

      // Validate certificate
      const certInfo = this.parseCertificate(cert);
      if (!certInfo.valid) {
        throw new Error('Invalid certificate');
      }

      const certificateData = {
        id: certId,
        certificate: cert,
        privateKey: key,
        passphrase,
        info: certInfo,
        loadedAt: new Date(),
        isActive: true
      };

      this.certificates.set(certId, certificateData);

      // Store in encryption manager
      await this.encryptionManager.storeCertificate(certId, cert, key);

      this.emit('certificateLoaded', { certId, info: certInfo });

      return {
        success: true,
        certId,
        info: certInfo
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  parseCertificate(certPem) {
    try {
      const cert = crypto.X509Certificate ? new crypto.X509Certificate(certPem) : null;

      if (!cert) {
        // Fallback parsing for older Node.js versions
        return this.parseCertificateFallback(certPem);
      }

      return {
        valid: true,
        subject: cert.subject,
        issuer: cert.issuer,
        serialNumber: cert.serialNumber,
        validFrom: new Date(cert.validFrom),
        validTo: new Date(cert.validTo),
        fingerprint: cert.fingerprint,
        keyUsage: cert.keyUsage,
        subjectAltName: cert.subjectAltName,
        publicKey: cert.publicKey
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  parseCertificateFallback(certPem) {
    // Simplified certificate parsing for older Node.js versions
    try {
      const certBuffer = Buffer.from(
        certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '').replace(/\s/g, ''),
        'base64'
      );

      return {
        valid: true,
        subject: 'Parsed via fallback',
        issuer: 'Unknown',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        fingerprint: crypto.createHash('sha256').update(certBuffer).digest('hex')
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Create secure HTTPS server
  createSecureServer(options = {}) {
    const certId = options.certificateId;
    const certificate = this.certificates.get(certId);

    if (!certificate) {
      throw new Error('Certificate not found');
    }

    const serverOptions = {
      ...this.tlsOptions,
      cert: certificate.certificate,
      key: certificate.privateKey,
      passphrase: certificate.passphrase,
      requestCert: this.config.clientCertificateAuth,
      rejectUnauthorized: !this.config.allowSelfSigned,
      ...options.tlsOptions
    };

    // Add CA certificates if available
    if (this.caCertificates.size > 0) {
      serverOptions.ca = Array.from(this.caCertificates.values()).map(ca => ca.certificate);
    }

    const server = https.createServer(serverOptions, options.requestHandler);

    // Add security headers middleware
    if (options.requestHandler) {
      server.on('request', (req, res) => {
        this.addSecurityHeaders(res);
      });
    }

    // Track TLS connections
    server.on('secureConnection', (tlsSocket) => {
      this.handleSecureConnection(tlsSocket);
    });

    server.on('tlsClientError', (err, tlsSocket) => {
      this.handleTLSError(err, tlsSocket);
    });

    return server;
  }

  // Create secure WebSocket server
  createSecureWebSocketServer(options = {}) {
    const httpsServer = this.createSecureServer({
      certificateId: options.certificateId,
      requestHandler: options.requestHandler
    });

    const wsOptions = {
      server: httpsServer,
      verifyClient: (info) => this.verifyWebSocketClient(info),
      ...options.webSocketOptions
    };

    const wss = new WebSocket.Server(wsOptions);

    // Handle WebSocket connections
    wss.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });

    wss.on('error', (error) => {
      this.emit('webSocketError', { error: error.message });
    });

    return { httpsServer, webSocketServer: wss };
  }

  verifyWebSocketClient(info) {
    try {
      // Verify origin if specified
      if (this.config.allowedOrigins) {
        const origin = info.origin;
        if (!this.config.allowedOrigins.includes(origin)) {
          console.log(`WebSocket connection rejected: Invalid origin ${origin}`);
          return false;
        }
      }

      // Additional custom verification can be added here
      return true;

    } catch (error) {
      console.error('WebSocket client verification error:', error);
      return false;
    }
  }

  handleSecureConnection(tlsSocket) {
    this.stats.tlsHandshakes++;
    this.stats.secureConnections++;

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const connectionInfo = {
      id: connectionId,
      remoteAddress: tlsSocket.remoteAddress,
      remotePort: tlsSocket.remotePort,
      protocol: tlsSocket.getProtocol(),
      cipher: tlsSocket.getCipher(),
      peerCertificate: tlsSocket.getPeerCertificate(),
      authorized: tlsSocket.authorized,
      authorizationError: tlsSocket.authorizationError,
      connectedAt: new Date()
    };

    // Validate peer certificate if client authentication is enabled
    if (this.config.clientCertificateAuth && !tlsSocket.authorized) {
      console.log(`TLS connection rejected: ${tlsSocket.authorizationError}`);
      this.stats.rejectedConnections++;
      tlsSocket.destroy();
      return;
    }

    this.secureConnections.set(connectionId, connectionInfo);

    tlsSocket.on('close', () => {
      this.secureConnections.delete(connectionId);
      this.stats.secureConnections--;
    });

    tlsSocket.on('error', (error) => {
      this.handleTLSError(error, tlsSocket);
    });

    this.emit('secureConnection', connectionInfo);
  }

  handleWebSocketConnection(ws, req) {
    this.stats.webSocketConnections++;

    const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const connectionInfo = {
      id: connectionId,
      remoteAddress: req.connection.remoteAddress,
      headers: req.headers,
      url: req.url,
      connectedAt: new Date()
    };

    this.webSocketConnections.set(connectionId, {
      ...connectionInfo,
      socket: ws
    });

    // Set up secure message handling
    ws.on('message', (message) => {
      this.handleSecureWebSocketMessage(connectionId, message);
    });

    ws.on('close', () => {
      this.webSocketConnections.delete(connectionId);
      this.stats.webSocketConnections--;
    });

    ws.on('error', (error) => {
      this.emit('webSocketConnectionError', { connectionId, error: error.message });
    });

    this.emit('webSocketConnection', connectionInfo);
  }

  handleSecureWebSocketMessage(connectionId, message) {
    try {
      // Decrypt message if it's encrypted
      let decryptedMessage = message;

      if (this.isEncryptedMessage(message)) {
        const decryptResult = this.decryptWebSocketMessage(message);
        if (!decryptResult.success) {
          this.emit('webSocketDecryptionError', { connectionId, error: decryptResult.error });
          return;
        }
        decryptedMessage = decryptResult.data;
      }

      this.emit('secureWebSocketMessage', {
        connectionId,
        message: decryptedMessage,
        encrypted: this.isEncryptedMessage(message)
      });

    } catch (error) {
      this.emit('webSocketMessageError', { connectionId, error: error.message });
    }
  }

  isEncryptedMessage(message) {
    try {
      const parsed = JSON.parse(message);
      return parsed.encrypted && parsed.iv && parsed.tag;
    } catch {
      return false;
    }
  }

  async encryptWebSocketMessage(message, keyId = 'websocket') {
    try {
      const encryptResult = await this.encryptionManager.encrypt(message, keyId);

      if (!encryptResult.success) {
        return encryptResult;
      }

      return {
        success: true,
        encryptedMessage: JSON.stringify({
          type: 'encrypted',
          ...encryptResult.data
        })
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decryptWebSocketMessage(encryptedMessage) {
    try {
      const parsed = JSON.parse(encryptedMessage);

      if (parsed.type !== 'encrypted') {
        throw new Error('Invalid encrypted message format');
      }

      const decryptResult = await this.encryptionManager.decrypt(parsed);

      return decryptResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  handleTLSError(error, tlsSocket) {
    this.stats.certificateErrors++;

    console.error('TLS Error:', {
      error: error.message,
      code: error.code,
      remoteAddress: tlsSocket ? tlsSocket.remoteAddress : 'unknown'
    });

    this.emit('tlsError', {
      error: error.message,
      code: error.code,
      remoteAddress: tlsSocket ? tlsSocket.remoteAddress : 'unknown'
    });
  }

  addSecurityHeaders(res) {
    // HSTS (HTTP Strict Transport Security)
    if (this.config.enableHSTS) {
      res.setHeader('Strict-Transport-Security', `max-age=${this.config.hstsMaxAge}; includeSubDomains; preload`);
    }

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");

    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
  }

  // Certificate validation
  async validateCertificate(certificate, options = {}) {
    try {
      this.stats.certificateValidations++;

      const certInfo = this.parseCertificate(certificate);

      if (!certInfo.valid) {
        return {
          valid: false,
          errors: ['Certificate parsing failed']
        };
      }

      const validationErrors = [];

      // Check expiration
      const now = new Date();
      if (now < certInfo.validFrom) {
        validationErrors.push('Certificate not yet valid');
      }
      if (now > certInfo.validTo) {
        validationErrors.push('Certificate expired');
      }

      // Check certificate chain if provided
      if (options.certificateChain && this.config.certificateChainValidation) {
        const chainValidation = await this.validateCertificateChain(certificate, options.certificateChain);
        if (!chainValidation.valid) {
          validationErrors.push(...chainValidation.errors);
        }
      }

      // Check against pinned keys
      if (this.config.pinPublicKeys && options.expectedFingerprint) {
        if (certInfo.fingerprint !== options.expectedFingerprint) {
          validationErrors.push('Certificate fingerprint mismatch');
        }
      }

      // OCSP validation (if enabled)
      if (this.config.enableOCSP) {
        const ocspValidation = await this.validateOCSP(certificate);
        if (!ocspValidation.valid) {
          validationErrors.push('OCSP validation failed');
        }
      }

      return {
        valid: validationErrors.length === 0,
        errors: validationErrors,
        info: certInfo
      };

    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  async validateCertificateChain(leafCert, chain) {
    // Simplified certificate chain validation
    try {
      const errors = [];

      // In a real implementation, this would verify each certificate
      // in the chain against its issuer up to a trusted root CA

      if (!Array.isArray(chain) || chain.length === 0) {
        errors.push('Invalid certificate chain');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  async validateOCSP(certificate) {
    // OCSP (Online Certificate Status Protocol) validation
    // This is a placeholder - real implementation would check certificate revocation status
    try {
      if (!certificate) {
        throw new Error('Certificate is required for OCSP validation');
      }
      
      // In production, this would make an OCSP request to the CA
      return {
        valid: true,
        status: 'good'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Public key pinning
  pinPublicKey(keyId, publicKey, domains = []) {
    const pinData = {
      keyId,
      publicKey,
      domains,
      hash: crypto.createHash('sha256').update(publicKey).digest('base64'),
      pinnedAt: new Date()
    };

    this.pinnedKeys.set(keyId, pinData);

    this.emit('publicKeyPinned', { keyId, domains });

    return {
      success: true,
      keyId,
      hash: pinData.hash
    };
  }

  // Get connection information
  getSecureConnections() {
    return Array.from(this.secureConnections.values()).map(conn => ({
      id: conn.id,
      remoteAddress: conn.remoteAddress,
      protocol: conn.protocol,
      cipher: conn.cipher ? {
        name: conn.cipher.name,
        version: conn.cipher.version
      } : null,
      authorized: conn.authorized,
      connectedAt: conn.connectedAt
    }));
  }

  getWebSocketConnections() {
    return Array.from(this.webSocketConnections.values()).map(conn => ({
      id: conn.id,
      remoteAddress: conn.remoteAddress,
      url: conn.url,
      connectedAt: conn.connectedAt
    }));
  }

  // Security audit
  async performSecurityAudit() {
    const audit = {
      timestamp: new Date(),
      certificates: [],
      connections: {
        secure: this.stats.secureConnections,
        webSocket: this.stats.webSocketConnections,
        rejected: this.stats.rejectedConnections
      },
      tlsConfiguration: {
        version: this.config.tlsVersion,
        cipherSuites: this.config.cipherSuites.length,
        perfectForwardSecrecy: this.config.enablePerfectForwardSecrecy,
        clientAuth: this.config.clientCertificateAuth
      },
      security: {
        hstsEnabled: this.config.enableHSTS,
        ocspEnabled: this.config.enableOCSP,
        publicKeyPinning: this.config.pinPublicKeys,
        certificateValidation: this.config.certificateChainValidation
      },
      errors: {
        certificateErrors: this.stats.certificateErrors,
        protocolViolations: this.stats.protocolViolations
      }
    };

    // Audit certificates
    for (const [certId, cert] of this.certificates.entries()) {
      const validation = await this.validateCertificate(cert.certificate);
      audit.certificates.push({
        id: certId,
        valid: validation.valid,
        expiresAt: cert.info.validTo,
        daysUntilExpiry: Math.ceil((cert.info.validTo - new Date()) / (1000 * 60 * 60 * 24)),
        errors: validation.errors
      });
    }

    return audit;
  }

  getStats() {
    return {
      ...this.stats,
      certificates: this.certificates.size,
      caCertificates: this.caCertificates.size,
      pinnedKeys: this.pinnedKeys.size,
      activeSecureConnections: this.secureConnections.size,
      activeWebSocketConnections: this.webSocketConnections.size
    };
  }

  async shutdown() {
    // Close all WebSocket connections
    for (const [connectionId, conn] of this.webSocketConnections.entries()) {
      if (conn.socket && conn.socket.readyState === WebSocket.OPEN) {
        conn.socket.close();
      }
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let secureCommManagerInstance = null;

class SecureCommunicationManagerSingleton {
  static getInstance(options = {}) {
    if (!secureCommManagerInstance) {
      secureCommManagerInstance = new SecureCommunicationManager(options);
    }
    return secureCommManagerInstance;
  }
}

module.exports = { SecureCommunicationManager, SecureCommunicationManagerSingleton };
