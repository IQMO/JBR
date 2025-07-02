import { LoginRequest, RegisterRequest } from '@jabbr/shared';
export declare class AuthService {
    private config;
    constructor();
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    generateAccessToken(userId: string, email: string): string;
    generateRefreshToken(userId: string): string;
    verifyAccessToken(token: string): {
        userId: string;
        email: string;
    } | null;
    verifyRefreshToken(token: string): {
        userId: string;
    } | null;
    generateTokenPair(userId: string, email: string): {
        accessToken: string;
        refreshToken: string;
        expiresIn: string;
    };
    validateLoginRequest(data: unknown): LoginRequest;
    validateRegisterRequest(data: unknown): RegisterRequest;
    extractTokenFromHeader(authHeader: string | undefined): string | null;
    validatePasswordStrength(password: string): {
        isValid: boolean;
        errors: string[];
    };
    generateSecureToken(): string;
    isTokenExpired(timestamp: Date, expirationHours?: number): boolean;
}
//# sourceMappingURL=auth.service.d.ts.map