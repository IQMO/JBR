import { z } from 'zod';
declare const EncryptionConfigSchema: z.ZodObject<{
    ENCRYPTION_KEY: z.ZodString;
    ENCRYPTION_ALGORITHM: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ENCRYPTION_KEY: string;
    ENCRYPTION_ALGORITHM: string;
}, {
    ENCRYPTION_KEY: string;
    ENCRYPTION_ALGORITHM?: string | undefined;
}>;
type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;
export interface EncryptedData {
    encrypted: string;
    iv: string;
    algorithm: string;
}
export declare class EncryptionService {
    private config;
    private key;
    constructor();
    encrypt(plaintext: string): EncryptedData;
    decrypt(encryptedData: EncryptedData): string;
    encryptApiKey(apiKey: string): string;
    decryptApiKey(encryptedApiKey: string): string;
    encryptApiSecret(apiSecret: string): string;
    decryptApiSecret(encryptedApiSecret: string): string;
    encryptPassphrase(passphrase: string): string;
    decryptPassphrase(encryptedPassphrase: string): string;
    static generateKey(): string;
    hash(data: string): string;
    verifyHash(data: string, hash: string): boolean;
    test(): {
        success: boolean;
        error?: string;
    };
    private deriveKey;
    getConfig(): Omit<EncryptionConfig, 'ENCRYPTION_KEY'>;
}
export declare const encryptionService: EncryptionService;
export declare const encryptApiCredentials: (apiKey: string, apiSecret: string, passphrase?: string) => {
    apiKey: string;
    apiSecret: string;
    passphrase: string | undefined;
};
export declare const decryptApiCredentials: (encryptedApiKey: string, encryptedApiSecret: string, encryptedPassphrase?: string) => {
    apiKey: string;
    apiSecret: string;
    passphrase: string | undefined;
};
export {};
//# sourceMappingURL=encryption.service.d.ts.map