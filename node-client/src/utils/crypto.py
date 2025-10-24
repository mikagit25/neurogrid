"""
Cryptographic Security Module

Provides encryption, authentication, and secure communication
for the NeuroGrid node client with end-to-end security.
"""

import hashlib
import hmac
import os
import time
import json
import logging
import base64
from typing import Dict, Any, Optional, Tuple, Union
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import jwt
from pathlib import Path


class CryptoManager:
    """Advanced cryptographic operations for secure node communication."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Paths
        self.crypto_dir = Path(config.get('crypto_dir', 'data/crypto'))
        self.crypto_dir.mkdir(parents=True, exist_ok=True)
        
        # Keys
        self.symmetric_key: Optional[bytes] = None
        self.private_key: Optional[rsa.RSAPrivateKey] = None
        self.public_key: Optional[rsa.RSAPublicKey] = None
        
        # Settings
        self.encryption_enabled = config.get('enable_encryption', True)
        self.key_rotation_hours = config.get('key_rotation_hours', 24)
        
        # JWT settings
        self.jwt_secret = config.get('jwt_secret', self._generate_jwt_secret())
        self.jwt_algorithm = 'HS256'
        self.jwt_expiry_hours = config.get('jwt_expiry_hours', 1)
        
        # Initialize
        self._initialize_crypto()
        
        self.logger.info("CryptoManager initialized")
    
    def _initialize_crypto(self):
        """Initialize cryptographic keys and settings."""
        try:
            # Load or generate symmetric key
            self.symmetric_key = self._load_or_generate_symmetric_key()
            
            # Load or generate RSA key pair
            self.private_key, self.public_key = self._load_or_generate_rsa_keys()
            
            self.logger.info("Cryptographic keys initialized")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize crypto: {e}")
            if self.encryption_enabled:
                raise
    
    def _generate_jwt_secret(self) -> str:
        """Generate a random JWT secret."""
        return base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8')
    
    def _load_or_generate_symmetric_key(self) -> bytes:
        """Load existing symmetric key or generate new one."""
        key_file = self.crypto_dir / 'symmetric.key'
        
        if key_file.exists():
            try:
                with open(key_file, 'rb') as f:
                    key_data = f.read()
                
                # Verify key format
                if len(key_data) == 32:  # 256-bit key
                    self.logger.info("Loaded existing symmetric key")
                    return key_data
                else:
                    self.logger.warning("Invalid symmetric key format, regenerating")
            except Exception as e:
                self.logger.warning(f"Failed to load symmetric key: {e}")
        
        # Generate new key
        key = os.urandom(32)  # 256-bit key
        
        try:
            with open(key_file, 'wb') as f:
                f.write(key)
            
            # Set secure permissions
            os.chmod(key_file, 0o600)
            self.logger.info("Generated new symmetric key")
            
        except Exception as e:
            self.logger.error(f"Failed to save symmetric key: {e}")
        
        return key
    
    def _load_or_generate_rsa_keys(self) -> Tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
        """Load or generate RSA key pair."""
        private_key_file = self.crypto_dir / 'private.pem'
        public_key_file = self.crypto_dir / 'public.pem'
        
        # Try to load existing keys
        if private_key_file.exists() and public_key_file.exists():
            try:
                with open(private_key_file, 'rb') as f:
                    private_key = serialization.load_pem_private_key(
                        f.read(),
                        password=None,
                        backend=default_backend()
                    )
                
                with open(public_key_file, 'rb') as f:
                    public_key = serialization.load_pem_public_key(
                        f.read(),
                        backend=default_backend()
                    )
                
                self.logger.info("Loaded existing RSA keys")
                return private_key, public_key
                
            except Exception as e:
                self.logger.warning(f"Failed to load RSA keys: {e}")
        
        # Generate new key pair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        public_key = private_key.public_key()
        
        try:
            # Save private key
            with open(private_key_file, 'wb') as f:
                f.write(private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            
            # Save public key
            with open(public_key_file, 'wb') as f:
                f.write(public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                ))
            
            # Set secure permissions
            os.chmod(private_key_file, 0o600)
            os.chmod(public_key_file, 0o644)
            
            self.logger.info("Generated new RSA key pair")
            
        except Exception as e:
            self.logger.error(f"Failed to save RSA keys: {e}")
        
        return private_key, public_key
    
    def encrypt_data(self, data: Union[str, bytes, Dict], method: str = 'symmetric') -> str:
        """Encrypt data using specified method."""
        if not self.encryption_enabled:
            return data if isinstance(data, str) else json.dumps(data)
        
        try:
            # Convert data to bytes
            if isinstance(data, dict):
                data_bytes = json.dumps(data).encode('utf-8')
            elif isinstance(data, str):
                data_bytes = data.encode('utf-8')
            else:
                data_bytes = data
            
            if method == 'symmetric':
                encrypted = self._encrypt_symmetric(data_bytes)
            elif method == 'asymmetric':
                encrypted = self._encrypt_asymmetric(data_bytes)
            else:
                raise ValueError(f"Unknown encryption method: {method}")
            
            # Return base64 encoded result
            return base64.b64encode(encrypted).decode('utf-8')
            
        except Exception as e:
            self.logger.error(f"Encryption failed: {e}")
            raise
    
    def decrypt_data(self, encrypted_data: str, method: str = 'symmetric') -> Union[str, Dict]:
        """Decrypt data using specified method."""
        if not self.encryption_enabled:
            return encrypted_data
        
        try:
            # Decode from base64
            encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
            
            if method == 'symmetric':
                decrypted = self._decrypt_symmetric(encrypted_bytes)
            elif method == 'asymmetric':
                decrypted = self._decrypt_asymmetric(encrypted_bytes)
            else:
                raise ValueError(f"Unknown decryption method: {method}")
            
            # Try to parse as JSON, fallback to string
            try:
                return json.loads(decrypted.decode('utf-8'))
            except:
                return decrypted.decode('utf-8')
                
        except Exception as e:
            self.logger.error(f"Decryption failed: {e}")
            raise
    
    def _encrypt_symmetric(self, data: bytes) -> bytes:
        """Encrypt data using AES-256-GCM."""
        if not self.symmetric_key:
            raise RuntimeError("Symmetric key not available")
        
        # Generate random IV
        iv = os.urandom(16)
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(self.symmetric_key),
            modes.GCM(iv),
            backend=default_backend()
        )
        
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(data) + encryptor.finalize()
        
        # Combine IV + tag + ciphertext
        return iv + encryptor.tag + ciphertext
    
    def _decrypt_symmetric(self, encrypted_data: bytes) -> bytes:
        """Decrypt data using AES-256-GCM."""
        if not self.symmetric_key:
            raise RuntimeError("Symmetric key not available")
        
        # Extract components
        iv = encrypted_data[:16]
        tag = encrypted_data[16:32]
        ciphertext = encrypted_data[32:]
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(self.symmetric_key),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        
        decryptor = cipher.decryptor()
        return decryptor.update(ciphertext) + decryptor.finalize()
    
    def _encrypt_asymmetric(self, data: bytes) -> bytes:
        """Encrypt data using RSA-OAEP."""
        if not self.public_key:
            raise RuntimeError("Public key not available")
        
        # RSA can only encrypt small amounts of data
        # For larger data, use hybrid encryption
        if len(data) > 190:  # RSA-2048 with OAEP can encrypt ~190 bytes
            return self._hybrid_encrypt(data)
        
        return self.public_key.encrypt(
            data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
    
    def _decrypt_asymmetric(self, encrypted_data: bytes) -> bytes:
        """Decrypt data using RSA-OAEP."""
        if not self.private_key:
            raise RuntimeError("Private key not available")
        
        # Check if this is hybrid encryption
        if len(encrypted_data) > 256:  # Standard RSA-2048 output is 256 bytes
            return self._hybrid_decrypt(encrypted_data)
        
        return self.private_key.decrypt(
            encrypted_data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
    
    def _hybrid_encrypt(self, data: bytes) -> bytes:
        """Hybrid encryption: RSA + AES for large data."""
        # Generate random AES key
        aes_key = os.urandom(32)
        
        # Encrypt data with AES
        iv = os.urandom(16)
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(data) + encryptor.finalize()
        
        # Encrypt AES key with RSA
        encrypted_key = self.public_key.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Combine: encrypted_key_length (4 bytes) + encrypted_key + iv + tag + ciphertext
        result = len(encrypted_key).to_bytes(4, 'big')
        result += encrypted_key + iv + encryptor.tag + ciphertext
        
        return result
    
    def _hybrid_decrypt(self, encrypted_data: bytes) -> bytes:
        """Hybrid decryption: RSA + AES for large data."""
        # Extract encrypted key length
        key_length = int.from_bytes(encrypted_data[:4], 'big')
        
        # Extract components
        encrypted_key = encrypted_data[4:4+key_length]
        iv = encrypted_data[4+key_length:4+key_length+16]
        tag = encrypted_data[4+key_length+16:4+key_length+32]
        ciphertext = encrypted_data[4+key_length+32:]
        
        # Decrypt AES key with RSA
        aes_key = self.private_key.decrypt(
            encrypted_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Decrypt data with AES
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        return decryptor.update(ciphertext) + decryptor.finalize()
    
    def create_jwt_token(self, payload: Dict[str, Any], expiry_hours: Optional[int] = None) -> str:
        """Create JWT token with expiration."""
        if expiry_hours is None:
            expiry_hours = self.jwt_expiry_hours
        
        # Add standard claims
        now = time.time()
        jwt_payload = {
            'iat': now,  # Issued at
            'exp': now + (expiry_hours * 3600),  # Expiration
            'iss': 'neurogrid-node',  # Issuer
            **payload
        }
        
        return jwt.encode(jwt_payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm],
                options={"verify_exp": True}
            )
            return payload
        except jwt.ExpiredSignatureError:
            self.logger.warning("JWT token has expired")
            return None
        except jwt.InvalidTokenError as e:
            self.logger.warning(f"Invalid JWT token: {e}")
            return None
    
    def hash_data(self, data: Union[str, bytes], algorithm: str = 'sha256') -> str:
        """Hash data using specified algorithm."""
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        if algorithm == 'sha256':
            hash_obj = hashlib.sha256(data)
        elif algorithm == 'sha512':
            hash_obj = hashlib.sha512(data)
        elif algorithm == 'blake2b':
            hash_obj = hashlib.blake2b(data)
        else:
            raise ValueError(f"Unsupported hash algorithm: {algorithm}")
        
        return hash_obj.hexdigest()
    
    def create_hmac(self, data: Union[str, bytes], key: Optional[bytes] = None) -> str:
        """Create HMAC signature."""
        if key is None:
            key = self.symmetric_key
        
        if not key:
            raise RuntimeError("No key available for HMAC")
        
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        mac = hmac.new(key, data, hashlib.sha256)
        return mac.hexdigest()
    
    def verify_hmac(self, data: Union[str, bytes], signature: str, key: Optional[bytes] = None) -> bool:
        """Verify HMAC signature."""
        try:
            expected_signature = self.create_hmac(data, key)
            return hmac.compare_digest(signature, expected_signature)
        except Exception as e:
            self.logger.error(f"HMAC verification failed: {e}")
            return False
    
    def derive_key_from_password(self, password: str, salt: Optional[bytes] = None) -> bytes:
        """Derive encryption key from password using PBKDF2."""
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        
        return kdf.derive(password.encode('utf-8'))
    
    def secure_random_bytes(self, length: int) -> bytes:
        """Generate cryptographically secure random bytes."""
        return os.urandom(length)
    
    def secure_random_string(self, length: int = 32) -> str:
        """Generate cryptographically secure random string."""
        random_bytes = self.secure_random_bytes(length)
        return base64.urlsafe_b64encode(random_bytes).decode('utf-8')[:length]
    
    def get_public_key_pem(self) -> str:
        """Get public key in PEM format."""
        if not self.public_key:
            raise RuntimeError("Public key not available")
        
        pem_bytes = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return pem_bytes.decode('utf-8')
    
    def load_peer_public_key(self, pem_data: str) -> rsa.RSAPublicKey:
        """Load peer's public key from PEM data."""
        return serialization.load_pem_public_key(
            pem_data.encode('utf-8'),
            backend=default_backend()
        )
    
    def encrypt_for_peer(self, data: Union[str, bytes, Dict], peer_public_key: rsa.RSAPublicKey) -> str:
        """Encrypt data for a specific peer using their public key."""
        try:
            # Convert data to bytes
            if isinstance(data, dict):
                data_bytes = json.dumps(data).encode('utf-8')
            elif isinstance(data, str):
                data_bytes = data.encode('utf-8')
            else:
                data_bytes = data
            
            # Use hybrid encryption for peer
            if len(data_bytes) > 190:
                encrypted = self._hybrid_encrypt_for_peer(data_bytes, peer_public_key)
            else:
                encrypted = peer_public_key.encrypt(
                    data_bytes,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None
                    )
                )
            
            return base64.b64encode(encrypted).decode('utf-8')
            
        except Exception as e:
            self.logger.error(f"Peer encryption failed: {e}")
            raise
    
    def _hybrid_encrypt_for_peer(self, data: bytes, peer_public_key: rsa.RSAPublicKey) -> bytes:
        """Hybrid encryption for peer with their public key."""
        # Generate random AES key
        aes_key = os.urandom(32)
        
        # Encrypt data with AES
        iv = os.urandom(16)
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(data) + encryptor.finalize()
        
        # Encrypt AES key with peer's RSA public key
        encrypted_key = peer_public_key.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Combine components
        result = len(encrypted_key).to_bytes(4, 'big')
        result += encrypted_key + iv + encryptor.tag + ciphertext
        
        return result
    
    def sign_data(self, data: Union[str, bytes]) -> str:
        """Create digital signature for data."""
        if not self.private_key:
            raise RuntimeError("Private key not available")
        
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        signature = self.private_key.sign(
            data,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        return base64.b64encode(signature).decode('utf-8')
    
    def verify_signature(self, data: Union[str, bytes], signature: str, peer_public_key: rsa.RSAPublicKey) -> bool:
        """Verify digital signature."""
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            signature_bytes = base64.b64decode(signature.encode('utf-8'))
            
            peer_public_key.verify(
                signature_bytes,
                data,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            return True
            
        except Exception as e:
            self.logger.warning(f"Signature verification failed: {e}")
            return False
    
    def rotate_keys(self):
        """Rotate encryption keys."""
        self.logger.info("Rotating encryption keys...")
        
        try:
            # Backup old keys
            backup_dir = self.crypto_dir / f"backup_{int(time.time())}"
            backup_dir.mkdir(exist_ok=True)
            
            for key_file in self.crypto_dir.glob('*.key'):
                shutil.copy2(key_file, backup_dir)
            
            for key_file in self.crypto_dir.glob('*.pem'):
                shutil.copy2(key_file, backup_dir)
            
            # Generate new keys
            self.symmetric_key = self._load_or_generate_symmetric_key()
            self.private_key, self.public_key = self._load_or_generate_rsa_keys()
            
            self.logger.info("Keys rotated successfully")
            
        except Exception as e:
            self.logger.error(f"Key rotation failed: {e}")
            raise
    
    def get_fingerprint(self) -> str:
        """Get public key fingerprint."""
        if not self.public_key:
            return "no-key"
        
        pem_bytes = self.public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        fingerprint = hashlib.sha256(pem_bytes).hexdigest()
        return f"{fingerprint[:8]}...{fingerprint[-8:]}"
    
    def cleanup_old_backups(self, max_age_days: int = 30):
        """Clean up old key backups."""
        try:
            cutoff_time = time.time() - (max_age_days * 24 * 3600)
            
            for backup_dir in self.crypto_dir.glob('backup_*'):
                try:
                    timestamp = int(backup_dir.name.split('_')[1])
                    if timestamp < cutoff_time:
                        shutil.rmtree(backup_dir)
                        self.logger.info(f"Removed old backup: {backup_dir.name}")
                except:
                    pass
                    
        except Exception as e:
            self.logger.warning(f"Failed to cleanup old backups: {e}")