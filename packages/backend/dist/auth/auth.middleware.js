"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.AuthMiddleware = void 0;
const auth_service_1 = require("./auth.service");
const shared_1 = require("@jabbr/shared");
class AuthMiddleware {
    authService;
    constructor() {
        this.authService = new auth_service_1.AuthService();
    }
    requireAuth = (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const token = this.authService.extractTokenFromHeader(authHeader);
            if (!token) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
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
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Invalid or expired token',
                        details: 'Please login again to get a new token'
                    }
                });
                return;
            }
            req.user = {
                userId: decoded.userId,
                email: decoded.email
            };
            next();
        }
        catch (error) {
            console.error('Auth middleware error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Authentication error',
                    details: 'An error occurred while verifying authentication'
                }
            });
        }
    };
    optionalAuth = (req, res, next) => {
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
        }
        catch (error) {
            console.error('Optional auth middleware error:', error);
            next();
        }
    };
    requireOwnership = (resourceUserIdField = 'userId') => {
        return (req, res, next) => {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Authentication required',
                        details: 'This middleware must be used after requireAuth'
                    }
                });
                return;
            }
            const resourceUserId = req.params[resourceUserIdField] ||
                req.body[resourceUserIdField] ||
                req.query[resourceUserIdField];
            if (!resourceUserId) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
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
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHORIZATION_ERROR,
                        message: 'Access denied',
                        details: 'You can only access your own resources'
                    }
                });
                return;
            }
            next();
        };
    };
    createRateLimiter = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
        const attempts = new Map();
        return (req, res, next) => {
            const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
            const now = Date.now();
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
                attempts.set(clientIp, { count: 1, resetTime: now + windowMs });
                next();
                return;
            }
            if (clientAttempts.count >= maxAttempts) {
                const remainingTime = Math.ceil((clientAttempts.resetTime - now) / 1000);
                res.status(429).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.RATE_LIMIT_ERROR,
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
    requireRefreshToken = (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
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
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Invalid refresh token',
                        details: 'Please login again to get new tokens'
                    }
                });
                return;
            }
            req.user = {
                userId: decoded.userId,
                email: ''
            };
            next();
        }
        catch (error) {
            console.error('Refresh token middleware error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Token verification error',
                    details: 'An error occurred while verifying refresh token'
                }
            });
        }
    };
}
exports.AuthMiddleware = AuthMiddleware;
exports.authMiddleware = new AuthMiddleware();
//# sourceMappingURL=auth.middleware.js.map