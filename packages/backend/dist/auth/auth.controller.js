"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const user_repository_1 = require("../users/user.repository");
const shared_1 = require("@jabbr/shared");
class AuthController {
    authService;
    constructor() {
        this.authService = new auth_service_1.AuthService();
    }
    register = async (req, res) => {
        try {
            const registerData = this.authService.validateRegisterRequest(req.body);
            if (registerData.password !== registerData.confirmPassword) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                        message: 'Passwords do not match',
                        details: 'password and confirmPassword must be identical'
                    },
                    timestamp: new Date()
                });
                return;
            }
            const passwordValidation = this.authService.validatePasswordStrength(registerData.password);
            if (!passwordValidation.isValid) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                        message: 'Password does not meet security requirements',
                        details: passwordValidation.errors.join(', ')
                    },
                    timestamp: new Date()
                });
                return;
            }
            const existingUser = await user_repository_1.userRepository.findByEmail(registerData.email);
            if (existingUser) {
                res.status(409).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                        message: 'Email already registered',
                        details: 'A user with this email address already exists'
                    },
                    timestamp: new Date()
                });
                return;
            }
            const hashedPassword = await this.authService.hashPassword(registerData.password);
            const newUser = await user_repository_1.userRepository.create({
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
            const tokens = this.authService.generateTokenPair(newUser.id, newUser.email);
            await user_repository_1.userRepository.updateLastLogin(newUser.id);
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
        }
        catch (error) {
            console.error('Registration error:', error);
            if (error instanceof Error && error.name === 'ZodError') {
                res.status(400).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
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
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Registration failed',
                    details: 'An error occurred during user registration'
                },
                timestamp: new Date()
            });
        }
    };
    login = async (req, res) => {
        try {
            const loginData = this.authService.validateLoginRequest(req.body);
            const user = await user_repository_1.userRepository.findByEmail(loginData.email);
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Invalid credentials',
                        details: 'Email or password is incorrect'
                    },
                    timestamp: new Date()
                });
                return;
            }
            const isPasswordValid = await this.authService.verifyPassword(loginData.password, user.passwordHash);
            if (!isPasswordValid) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Invalid credentials',
                        details: 'Email or password is incorrect'
                    },
                    timestamp: new Date()
                });
                return;
            }
            const tokens = this.authService.generateTokenPair(user.id, user.email);
            await user_repository_1.userRepository.updateLastLogin(user.id);
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
        }
        catch (error) {
            console.error('Login error:', error);
            if (error instanceof Error && error.name === 'ZodError') {
                res.status(400).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
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
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Login failed',
                    details: 'An error occurred during authentication'
                },
                timestamp: new Date()
            });
        }
    };
    refresh = async (req, res) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Invalid refresh token',
                        details: 'User information not found in token'
                    },
                    timestamp: new Date()
                });
                return;
            }
            const user = await user_repository_1.userRepository.findById(userId);
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.USER_NOT_FOUND,
                        message: 'User not found',
                        details: 'The user associated with this token no longer exists'
                    },
                    timestamp: new Date()
                });
                return;
            }
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
        }
        catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Token refresh failed',
                    details: 'An error occurred while refreshing the token'
                },
                timestamp: new Date()
            });
        }
    };
    profile = async (req, res) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                        message: 'Authentication required',
                        details: 'User information not found in request'
                    },
                    timestamp: new Date()
                });
                return;
            }
            const user = await user_repository_1.userRepository.findById(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: shared_1.CONSTANTS.ERROR_CODES.USER_NOT_FOUND,
                        message: 'User not found',
                        details: 'The authenticated user no longer exists'
                    },
                    timestamp: new Date()
                });
                return;
            }
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
        }
        catch (error) {
            console.error('Profile fetch error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Failed to fetch profile',
                    details: 'An error occurred while retrieving user profile'
                },
                timestamp: new Date()
            });
        }
    };
    logout = async (req, res) => {
        try {
            res.status(200).json({
                success: true,
                data: {
                    message: 'Logged out successfully'
                },
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: shared_1.CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
                    message: 'Logout failed',
                    details: 'An error occurred during logout'
                },
                timestamp: new Date()
            });
        }
    };
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map