import { CONSTANTS } from '@jabbr/shared';
import type { Request, Response } from 'express';

import { userRepository } from '../users/user.repository';

import { AuthService } from './auth.service';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * User registration endpoint
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request data
      const registerData = this.authService.validateRegisterRequest(req.body);

      // Check if passwords match
      if (registerData.password !== registerData.confirmPassword) {
        res.status(400).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Passwords do not match',
            details: 'password and confirmPassword must be identical'
          },
          timestamp: new Date()
        });
        return;
      }

      // Check password strength
      const passwordValidation = this.authService.validatePasswordStrength(registerData.password);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Password does not meet security requirements',
            details: passwordValidation.errors.join(', ')
          },
          timestamp: new Date()
        });
        return;
      }

      // Check if email already exists
      const existingUser = await userRepository.findByEmail(registerData.email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Email already registered',
            details: 'A user with this email address already exists'
          },
          timestamp: new Date()
        });
        return;
      }

      // Hash password
      const hashedPassword = await this.authService.hashPassword(registerData.password);

      // Create user
      const newUser = await userRepository.create({
        email: registerData.email,
        passwordHash: hashedPassword,
        role: 'user',
        apiKeys: [],
        preferences: {
          timezone: 'UTC',
          currency: 'USD',
          notifications: {
            email: true,
            browser: true,
            tradingAlerts: true,
            systemAlerts: true,
            riskAlerts: true
          },
          dashboard: {
            theme: 'dark',
            layout: 'standard',
            refreshRate: 30000
          }
        },
        isEmailVerified: false,
        lastLoginAt: null
      });

      // Generate tokens
      const tokens = this.authService.generateTokenPair(newUser.id, newUser.email);

      // Update last login
      await userRepository.updateLastLogin(newUser.id);

      // Prepare response (exclude sensitive data)
      const userResponse = {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        preferences: newUser.preferences,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      };

      res.status(201).json({
        success: true,
        data: {
          user: userResponse,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid request data',
            details: error.message
          },
          timestamp: new Date()
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Registration failed',
          details: 'An error occurred during user registration'
        },
        timestamp: new Date()
      });
    }
  };

  /**
   * User login endpoint
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request data
      const loginData = this.authService.validateLoginRequest(req.body);

      // Find user by email
      const user = await userRepository.findByEmail(loginData.email);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Invalid credentials',
            details: 'Email or password is incorrect'
          },
          timestamp: new Date()
        });
        return;
      }

      // Verify password
      const isPasswordValid = await this.authService.verifyPassword(
        loginData.password, 
        user.passwordHash
      );

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Invalid credentials',
            details: 'Email or password is incorrect'
          },
          timestamp: new Date()
        });
        return;
      }

      // Generate tokens
      const tokens = this.authService.generateTokenPair(user.id, user.email);

      // Update last login
      await userRepository.updateLastLogin(user.id);

      // Prepare response (exclude sensitive data)
      const userResponse = {
        id: user.id,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      res.status(200).json({
        success: true,
        data: {
          user: userResponse,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Login error:', error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid request data',
            details: error.message
          },
          timestamp: new Date()
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Login failed',
          details: 'An error occurred during authentication'
        },
        timestamp: new Date()
      });
    }
  };

  /**
   * Token refresh endpoint
   */
  refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      // User ID is attached by requireRefreshToken middleware
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Invalid refresh token',
            details: 'User information not found in token'
          },
          timestamp: new Date()
        });
        return;
      }

      // Find user to get current email
      const user = await userRepository.findById(userId);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.USER_NOT_FOUND,
            message: 'User not found',
            details: 'The user associated with this token no longer exists'
          },
          timestamp: new Date()
        });
        return;
      }

      // Generate new tokens
      const tokens = this.authService.generateTokenPair(user.id, user.email);

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Token refresh failed',
          details: 'An error occurred while refreshing the token'
        },
        timestamp: new Date()
      });
    }
  };

  /**
   * Get current user profile
   */
  profile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            message: 'Authentication required',
            details: 'User information not found in request'
          },
          timestamp: new Date()
        });
        return;
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: CONSTANTS.ERROR_CODES.USER_NOT_FOUND,
            message: 'User not found',
            details: 'The authenticated user no longer exists'
          },
          timestamp: new Date()
        });
        return;
      }

      // Prepare response (exclude sensitive data)
      const userResponse = {
        id: user.id,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      res.status(200).json({
        success: true,
        data: userResponse,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Failed to fetch profile',
          details: 'An error occurred while retrieving user profile'
        },
        timestamp: new Date()
      });
    }
  };

  /**
   * Logout endpoint (client-side token invalidation)
   * In a production system, you might want to maintain a token blacklist
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, logout is handled client-side by removing tokens
      // In production, you might want to:
      // 1. Add tokens to a blacklist in Redis
      // 2. Track active sessions in database
      // 3. Implement token revocation

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully'
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Logout failed',
          details: 'An error occurred during logout'
        },
        timestamp: new Date()
      });
    }
  };
}

// Export singleton instance
export const authController = new AuthController(); 