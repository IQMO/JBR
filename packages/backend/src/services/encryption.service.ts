import * as crypto from 'crypto';
import { z } from 'zod';

/**
 * Encryption Configuration Schema
 */
const EncryptionConfigSchema = z.object({
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  ENCRYPTION_ALGORITHM: z.string().default('aes-256-cbc')
});

type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: string;
  iv: string;
  algorithm: string;
}

/**
 * Encryption Service
 * Provides secure encryption/decryption for sensitive data like API keys
 */
export class EncryptionService {
  private config: EncryptionConfig;
  private key: Buffer;

  constructor() {
    // Validate environment configuration
    this.config = EncryptionConfigSchema.parse({
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      ENCRYPTION_ALGORITHM: process.env.ENCRYPTION_ALGORITHM
    });

    // Derive a 32-byte key from the provided key
    this.key = this.deriveKey(this.config.ENCRYPTION_KEY);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher with IV
      const cipher = crypto.createCipheriv(this.config.ENCRYPTION_ALGORITHM, this.key, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encrypted,
        iv: iv.toString('hex'),
        algorithm: this.config.ENCRYPTION_ALGORITHM
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      // Validate algorithm
      if (encryptedData.algorithm !== this.config.ENCRYPTION_ALGORITHM) {
        throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
      }

      // Convert hex strings back to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      
      // Create decipher with IV
      const decipher = crypto.createDecipheriv(this.config.ENCRYPTION_ALGORITHM, this.key, iv);
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt API key credentials
   */
  encryptApiKey(apiKey: string): string {
    const encrypted = this.encrypt(apiKey);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt API key credentials
   */
  decryptApiKey(encryptedApiKey: string): string {
    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedApiKey);
      return this.decrypt(encryptedData);
    } catch (error) {
      throw new Error(`Failed to decrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt API secret credentials
   */
  encryptApiSecret(apiSecret: string): string {
    const encrypted = this.encrypt(apiSecret);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt API secret credentials
   */
  decryptApiSecret(encryptedApiSecret: string): string {
    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedApiSecret);
      return this.decrypt(encryptedData);
    } catch (error) {
      throw new Error(`Failed to decrypt API secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt passphrase (for exchanges like OKX)
   */
  encryptPassphrase(passphrase: string): string {
    const encrypted = this.encrypt(passphrase);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt passphrase
   */
  decryptPassphrase(encryptedPassphrase: string): string {
    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedPassphrase);
      return this.decrypt(encryptedData);
    } catch (error) {
      throw new Error(`Failed to decrypt passphrase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a secure random key
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash sensitive data (one-way, for comparison purposes)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string): boolean {
    const dataHash = this.hash(data);
    return crypto.timingSafeEqual(Buffer.from(dataHash), Buffer.from(hash));
  }

  /**
   * Test encryption/decryption functionality
   */
  test(): { success: boolean; error?: string } {
    try {
      const testData = 'test-api-key-12345';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      if (decrypted !== testData) {
        return { success: false, error: 'Decrypted data does not match original' };
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Derive a consistent key from the provided encryption key
   */
  private deriveKey(inputKey: string): Buffer {
    // Use PBKDF2 to derive a consistent 32-byte key
    return crypto.pbkdf2Sync(inputKey, 'jabbr-salt', 100000, 32, 'sha256');
  }

  /**
   * Get encryption configuration (without sensitive data)
   */
  getConfig(): Omit<EncryptionConfig, 'ENCRYPTION_KEY'> {
    const safeConfig = { ...this.config };
    delete (safeConfig as any).ENCRYPTION_KEY;
    return safeConfig;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

/**
 * Convenience functions for common encryption operations
 */
export const encryptApiCredentials = (apiKey: string, apiSecret: string, passphrase?: string) => {
  return {
    apiKey: encryptionService.encryptApiKey(apiKey),
    apiSecret: encryptionService.encryptApiSecret(apiSecret),
    passphrase: passphrase ? encryptionService.encryptPassphrase(passphrase) : undefined
  };
};

export const decryptApiCredentials = (encryptedApiKey: string, encryptedApiSecret: string, encryptedPassphrase?: string) => {
  return {
    apiKey: encryptionService.decryptApiKey(encryptedApiKey),
    apiSecret: encryptionService.decryptApiSecret(encryptedApiSecret),
    passphrase: encryptedPassphrase ? encryptionService.decryptPassphrase(encryptedPassphrase) : undefined
  };
}; 