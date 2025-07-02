import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from './auth.middleware';

/**
 * Authentication routes
 * All routes are prefixed with /auth in the main app
 */
export const authRoutes = Router();

// Rate limiting for auth endpoints (5 attempts per 15 minutes)
const authRateLimit = authMiddleware.createRateLimiter(5, 15 * 60 * 1000);

/**
 * POST /auth/register
 * Register a new user account
 * 
 * Body: { email: string, password: string, confirmPassword: string }
 * Response: { success: boolean, data: { user, accessToken, refreshToken, expiresIn }, timestamp }
 */
authRoutes.post('/register', authRateLimit, authController.register);

/**
 * POST /auth/login
 * Authenticate user and get tokens
 * 
 * Body: { email: string, password: string }
 * Response: { success: boolean, data: { user, accessToken, refreshToken, expiresIn }, timestamp }
 */
authRoutes.post('/login', authRateLimit, authController.login);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * 
 * Body: { refreshToken: string }
 * Response: { success: boolean, data: { accessToken, refreshToken, expiresIn }, timestamp }
 */
authRoutes.post('/refresh', 
  authMiddleware.requireRefreshToken, 
  authController.refresh
);

/**
 * GET /auth/profile
 * Get current user profile (requires authentication)
 * 
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: boolean, data: User, timestamp }
 */
authRoutes.get('/profile', 
  authMiddleware.requireAuth, 
  authController.profile
);

/**
 * POST /auth/logout
 * Logout user (client-side token invalidation)
 * 
 * Headers: { Authorization: "Bearer <token>" } (optional)
 * Response: { success: boolean, data: { message }, timestamp }
 */
authRoutes.post('/logout', authController.logout);

/**
 * GET /auth/verify
 * Verify if current token is valid (requires authentication)
 * 
 * Headers: { Authorization: "Bearer <token>" }
 * Response: { success: boolean, data: { valid: true, userId, email }, timestamp }
 */
authRoutes.get('/verify', 
  authMiddleware.requireAuth, 
  (req, res) => {
    res.json({
      success: true,
      data: {
        valid: true,
        userId: req.user?.userId,
        email: req.user?.email
      },
      timestamp: new Date()
    });
  }
);

export default authRoutes; 