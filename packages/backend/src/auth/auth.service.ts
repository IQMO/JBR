import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  LoginRequest,
  RegisterRequest,
  LoginRequestSchema,
  RegisterRequestSchema,
  CONSTANTS
} from '@jabbr/shared';

// Environment variables validation
const AuthConfigSchema = z.object({
  JWT_SECRET: z.string().min(CONSTANTS.LIMITS.JWT_SECRET_MIN_LENGTH),
  JWT_REFRESH_SECRET: z.string().min(CONSTANTS.LIMITS.JWT_SECRET_MIN_LENGTH),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.number().min(8).max(CONSTANTS.LIMITS.BCRYPT_MAX_ROUNDS).default(12)
});

type AuthConfig = z.infer<typeof AuthConfigSchema>;

export class AuthService {
  private config: AuthConfig;

  constructor() {
    // Validate environment configuration
    this.config = AuthConfigSchema.parse({
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
      BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS) : undefined
    });
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.BCRYPT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(userId: string, email: string): string {
    const payload = { 
      userId, 
      email, 
      type: 'access' 
    };
    
    const options: any = { 
      expiresIn: this.config.JWT_EXPIRES_IN,
      issuer: 'jabbr-trading-bot',
      audience: 'jabbr-users'
    };
    
    return jwt.sign(payload, this.config.JWT_SECRET, options);
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(userId: string): string {
    const payload = { 
      userId, 
      type: 'refresh' 
    };
    
    const options: any = { 
      expiresIn: this.config.JWT_REFRESH_EXPIRES_IN,
      issuer: 'jabbr-trading-bot',
      audience: 'jabbr-users'
    };
    
    return jwt.sign(payload, this.config.JWT_REFRESH_SECRET, options);
  }

  /**
   * Verify and decode JWT access token
   */
  verifyAccessToken(token: string): { userId: string; email: string } | null {
    try {
      const decoded = jwt.verify(token, this.config.JWT_SECRET, {
        issuer: 'jabbr-trading-bot',
        audience: 'jabbr-users'
      }) as any;

      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify and decode JWT refresh token
   */
  verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.config.JWT_REFRESH_SECRET, {
        issuer: 'jabbr-trading-bot',
        audience: 'jabbr-users'
      }) as any;

      if (decoded.type !== 'refresh') {
        return null;
      }

      return {
        userId: decoded.userId
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userId: string, email: string): {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  } {
    return {
      accessToken: this.generateAccessToken(userId, email),
      refreshToken: this.generateRefreshToken(userId),
      expiresIn: this.config.JWT_EXPIRES_IN
    };
  }

  /**
   * Validate login request data
   */
  validateLoginRequest(data: unknown): LoginRequest {
    return LoginRequestSchema.parse(data);
  }

  /**
   * Validate register request data
   */
  validateRegisterRequest(data: unknown): RegisterRequest {
    return RegisterRequestSchema.parse(data);
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Validate password strength (additional validation beyond Zod)
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

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

    // Check for common weak passwords
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

  /**
   * Generate a secure random token for password reset, email verification, etc.
   */
  generateSecureToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Check if token is expired based on timestamp
   */
  isTokenExpired(timestamp: Date, expirationHours: number = 24): boolean {
    const now = new Date();
    const expirationTime = new Date(timestamp.getTime() + (expirationHours * 60 * 60 * 1000));
    return now > expirationTime;
  }
} 