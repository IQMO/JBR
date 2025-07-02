"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptApiCredentials = exports.encryptApiCredentials = exports.encryptionService = exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const zod_1 = require("zod");
const EncryptionConfigSchema = zod_1.z.object({
    ENCRYPTION_KEY: zod_1.z.string().min(32, 'Encryption key must be at least 32 characters'),
    ENCRYPTION_ALGORITHM: zod_1.z.string().default('aes-256-cbc')
});
class EncryptionService {
    config;
    key;
    constructor() {
        this.config = EncryptionConfigSchema.parse({
            ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
            ENCRYPTION_ALGORITHM: process.env.ENCRYPTION_ALGORITHM
        });
        this.key = this.deriveKey(this.config.ENCRYPTION_KEY);
    }
    encrypt(plaintext) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.config.ENCRYPTION_ALGORITHM, this.key, iv);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return {
                encrypted,
                iv: iv.toString('hex'),
                algorithm: this.config.ENCRYPTION_ALGORITHM
            };
        }
        catch (error) {
            throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    decrypt(encryptedData) {
        try {
            if (encryptedData.algorithm !== this.config.ENCRYPTION_ALGORITHM) {
                throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
            }
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const decipher = crypto.createDecipheriv(this.config.ENCRYPTION_ALGORITHM, this.key, iv);
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    encryptApiKey(apiKey) {
        const encrypted = this.encrypt(apiKey);
        return JSON.stringify(encrypted);
    }
    decryptApiKey(encryptedApiKey) {
        try {
            const encryptedData = JSON.parse(encryptedApiKey);
            return this.decrypt(encryptedData);
        }
        catch (error) {
            throw new Error(`Failed to decrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    encryptApiSecret(apiSecret) {
        const encrypted = this.encrypt(apiSecret);
        return JSON.stringify(encrypted);
    }
    decryptApiSecret(encryptedApiSecret) {
        try {
            const encryptedData = JSON.parse(encryptedApiSecret);
            return this.decrypt(encryptedData);
        }
        catch (error) {
            throw new Error(`Failed to decrypt API secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    encryptPassphrase(passphrase) {
        const encrypted = this.encrypt(passphrase);
        return JSON.stringify(encrypted);
    }
    decryptPassphrase(encryptedPassphrase) {
        try {
            const encryptedData = JSON.parse(encryptedPassphrase);
            return this.decrypt(encryptedData);
        }
        catch (error) {
            throw new Error(`Failed to decrypt passphrase: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    verifyHash(data, hash) {
        const dataHash = this.hash(data);
        return crypto.timingSafeEqual(Buffer.from(dataHash), Buffer.from(hash));
    }
    test() {
        try {
            const testData = 'test-api-key-12345';
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);
            if (decrypted !== testData) {
                return { success: false, error: 'Decrypted data does not match original' };
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    deriveKey(inputKey) {
        return crypto.pbkdf2Sync(inputKey, 'jabbr-salt', 100000, 32, 'sha256');
    }
    getConfig() {
        const { ENCRYPTION_KEY, ...safeConfig } = this.config;
        return safeConfig;
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = new EncryptionService();
const encryptApiCredentials = (apiKey, apiSecret, passphrase) => {
    return {
        apiKey: exports.encryptionService.encryptApiKey(apiKey),
        apiSecret: exports.encryptionService.encryptApiSecret(apiSecret),
        passphrase: passphrase ? exports.encryptionService.encryptPassphrase(passphrase) : undefined
    };
};
exports.encryptApiCredentials = encryptApiCredentials;
const decryptApiCredentials = (encryptedApiKey, encryptedApiSecret, encryptedPassphrase) => {
    return {
        apiKey: exports.encryptionService.decryptApiKey(encryptedApiKey),
        apiSecret: exports.encryptionService.decryptApiSecret(encryptedApiSecret),
        passphrase: encryptedPassphrase ? exports.encryptionService.decryptPassphrase(encryptedPassphrase) : undefined
    };
};
exports.decryptApiCredentials = decryptApiCredentials;
//# sourceMappingURL=encryption.service.js.map