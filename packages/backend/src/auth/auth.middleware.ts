import { CONSTANTS } from '@jabbr/shared';
import type { Request, Response, NextFunction } from 'express';

import { AuthService } from './auth.service';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to require authentication
   * Verifies JWT token and attaches user info to request
   */
  requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = this.authService.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'No authentication token provided',
            details: 'Authorization header with Bearer token is required'
          }
        });
        return;
      }

      const decoded = this.authService.verifyAccessToken(token);

      if (!decoded) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Invalid or expired token',
            details: 'Please login again to get a new token'
          }
        });
        return;
      }

      // Attach user info to request for use in route handlers
      req.user = {
        userId: decoded.userId,
        email: decoded.email
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Authentication error',
          details: 'An error occurred while verifying authentication'
        }
      });
    }
  };

  /**
   * Optional authentication middleware
   * Attaches user info if token is valid, but doesn't require it
   */
  optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = this.authService.extractTokenFromHeader(authHeader);

      if (token) {
        const decoded = this.authService.verifyAccessToken(token);
        if (decoded) {
          req.user = {
            userId: decoded.userId,
            email: decoded.email
          };
        }
      }

      next();
    } catch (error) {
      // Log error but don't block the request
      console.error('Optional auth middleware error:', error);
      next();
    }
  };

  /**
   * Middleware to check if user owns a resource
   * Must be used after requireAuth middleware
   */
  requireOwnership = (resourceUserIdField = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Authentication required',
            details: 'This middleware must be used after requireAuth'
          }
        });
        return;
      }

      // Check if the resource belongs to the authenticated user
      // This can be used with req.params, req.body, or req.query
      // Validate the field name to prevent object injection
      if (typeof resourceUserIdField !== 'string' || !resourceUserIdField) {
        res.status(500).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHORIZATION_ERROR,
            message: 'Invalid resource field configuration'
          }
        });
        return;
      }

      const resourceUserId = (req.params && Object.prototype.hasOwnProperty.call(req.params, resourceUserIdField) ? req.params[resourceUserIdField] : null) || 
                           (req.body && Object.prototype.hasOwnProperty.call(req.body, resourceUserIdField) ? req.body[resourceUserIdField] : null) || 
                           (req.query && Object.prototype.hasOwnProperty.call(req.query, resourceUserIdField) ? req.query[resourceUserIdField] : null);

      if (!resourceUserId) {
        res.status(400).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Resource user ID not found',
            details: `${resourceUserIdField} must be provided in request parameters, body, or query`
          }
        });
        return;
      }

      if (req.user.userId !== resourceUserId) {
        res.status(403).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHORIZATION_ERROR,
            message: 'Access denied',
            details: 'You can only access your own resources'
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Rate limiting middleware for authentication endpoints
   * Simple in-memory rate limiter (in production, use Redis)
   */
  createRateLimiter = (maxAttempts = 5, windowMs: number = 15 * 60 * 1000) => {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();

      // Clean up old entries
      for (const [ip, data] of attempts.entries()) {
        if (now > data.resetTime) {
          attempts.delete(ip);
        }
      }

      const clientAttempts = attempts.get(clientIp);

      if (!clientAttempts) {
        attempts.set(clientIp, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      if (now > clientAttempts.resetTime) {
        // Reset window
        attempts.set(clientIp, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      if (clientAttempts.count >= maxAttempts) {
        const remainingTime = Math.ceil((clientAttempts.resetTime - now) / 1000);
        res.status(429).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.RATE_LIMIT_ERROR,
            message: 'Too many attempts',
            details: `Please try again in ${remainingTime} seconds`
          }
        });
        return;
      }

      clientAttempts.count++;
      next();
    };
  };

  /**
   * Middleware to validate refresh token
   */
  requireRefreshToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Refresh token required',
            details: 'refreshToken must be provided in request body'
          }
        });
        return;
      }

      const decoded = this.authService.verifyRefreshToken(refreshToken);

      if (!decoded) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Invalid refresh token',
            details: 'Please login again to get new tokens'
          }
        });
        return;
      }

      // Attach userId to request for use in refresh endpoint
      req.user = {
        userId: decoded.userId,
        email: '' // Will be filled by the refresh endpoint
      };

      next();
    } catch (error) {
      console.error('Refresh token middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Token verification error',
          details: 'An error occurred while verifying refresh token'
        }
      });
    }
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware(); 