"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const shared_1 = require("@jabbr/shared");
const AuthConfigSchema = zod_1.z.object({
    JWT_SECRET: zod_1.z.string().min(shared_1.CONSTANTS.LIMITS.JWT_SECRET_MIN_LENGTH),
    JWT_REFRESH_SECRET: zod_1.z.string().min(shared_1.CONSTANTS.LIMITS.JWT_SECRET_MIN_LENGTH),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    BCRYPT_ROUNDS: zod_1.z.number().min(8).max(shared_1.CONSTANTS.LIMITS.BCRYPT_MAX_ROUNDS).default(12)
});
class AuthService {
    config;
    constructor() {
        this.config = AuthConfigSchema.parse({
            JWT_SECRET: process.env.JWT_SECRET,
            JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
            JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
            JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
            BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS) : undefined
        });
    }
    async hashPassword(password) {
        return bcryptjs_1.default.hash(password, this.config.BCRYPT_ROUNDS);
    }
    async verifyPassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    generateAccessToken(userId, email) {
        const payload = {
            userId,
            email,
            type: 'access'
        };
        const options = {
            expiresIn: this.config.JWT_EXPIRES_IN,
            issuer: 'jabbr-trading-bot',
            audience: 'jabbr-users'
        };
        return jsonwebtoken_1.default.sign(payload, this.config.JWT_SECRET, options);
    }
    generateRefreshToken(userId) {
        const payload = {
            userId,
            type: 'refresh'
        };
        const options = {
            expiresIn: this.config.JWT_REFRESH_EXPIRES_IN,
            issuer: 'jabbr-trading-bot',
            audience: 'jabbr-users'
        };
        return jsonwebtoken_1.default.sign(payload, this.config.JWT_REFRESH_SECRET, options);
    }
    verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.config.JWT_SECRET, {
                issuer: 'jabbr-trading-bot',
                audience: 'jabbr-users'
            });
            if (decoded.type !== 'access') {
                return null;
            }
            return {
                userId: decoded.userId,
                email: decoded.email
            };
        }
        catch (error) {
            return null;
        }
    }
    verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.config.JWT_REFRESH_SECRET, {
                issuer: 'jabbr-trading-bot',
                audience: 'jabbr-users'
            });
            if (decoded.type !== 'refresh') {
                return null;
            }
            return {
                userId: decoded.userId
            };
        }
        catch (error) {
            return null;
        }
    }
    generateTokenPair(userId, email) {
        return {
            accessToken: this.generateAccessToken(userId, email),
            refreshToken: this.generateRefreshToken(userId),
            expiresIn: this.config.JWT_EXPIRES_IN
        };
    }
    validateLoginRequest(data) {
        return shared_1.LoginRequestSchema.parse(data);
    }
    validateRegisterRequest(data) {
        return shared_1.RegisterRequestSchema.parse(data);
    }
    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }
    validatePasswordStrength(password) {
        const errors = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (password.length > 128) {
            errors.push('Password must be less than 128 characters');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        const commonPasswords = [
            'password', '123456', '123456789', 'qwerty', 'abc123',
            'password123', 'admin', 'letmein', 'welcome', 'monkey'
        ];
        if (commonPasswords.includes(password.toLowerCase())) {
            errors.push('Password is too common');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    generateSecureToken() {
        return require('crypto').randomBytes(32).toString('hex');
    }
    isTokenExpired(timestamp, expirationHours = 24) {
        const now = new Date();
        const expirationTime = new Date(timestamp.getTime() + (expirationHours * 60 * 60 * 1000));
        return now > expirationTime;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map