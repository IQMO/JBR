"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
exports.authRoutes = (0, express_1.Router)();
const authRateLimit = auth_middleware_1.authMiddleware.createRateLimiter(5, 15 * 60 * 1000);
exports.authRoutes.post('/register', authRateLimit, auth_controller_1.authController.register);
exports.authRoutes.post('/login', authRateLimit, auth_controller_1.authController.login);
exports.authRoutes.post('/refresh', auth_middleware_1.authMiddleware.requireRefreshToken, auth_controller_1.authController.refresh);
exports.authRoutes.get('/profile', auth_middleware_1.authMiddleware.requireAuth, auth_controller_1.authController.profile);
exports.authRoutes.post('/logout', auth_controller_1.authController.logout);
exports.authRoutes.get('/verify', auth_middleware_1.authMiddleware.requireAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            valid: true,
            userId: req.user?.userId,
            email: req.user?.email
        },
        timestamp: new Date()
    });
});
exports.default = exports.authRoutes;
//# sourceMappingURL=auth.routes.js.map