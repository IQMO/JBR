import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { riskManagementController } from './risk-management.controller';

/**
 * Risk Management Routes
 * Handles per-bot risk management configuration endpoints
 */

// Bot-specific risk management routes (prefixed with /api/bots/:botId/risk-management)
export const botRiskManagementRoutes = Router({ mergeParams: true });

// Apply authentication middleware to all routes
botRiskManagementRoutes.use(authMiddleware.requireAuth);

/**
 * GET /api/bots/:botId/risk-management
 * Get risk management configuration for a specific bot
 * 
 * Response: { 
 *   success: boolean, 
 *   data: PerBotRiskManagement, 
 *   timestamp: string 
 * }
 */
botRiskManagementRoutes.get('/', riskManagementController.getBotRiskManagement);

/**
 * PUT /api/bots/:botId/risk-management
 * Update risk management configuration for a specific bot
 * 
 * Body: {
 *   riskManagement: PerBotRiskManagement
 * }
 * 
 * Response: { 
 *   success: boolean, 
 *   data: PerBotRiskManagement, 
 *   validation: RiskManagementValidationResult,
 *   timestamp: string 
 * }
 */
botRiskManagementRoutes.put('/', riskManagementController.updateBotRiskManagement);

/**
 * POST /api/bots/:botId/risk-management/validate
 * Validate risk management configuration without saving
 * 
 * Body: {
 *   riskManagement: PerBotRiskManagement,
 *   accountBalance?: number
 * }
 * 
 * Response: { 
 *   success: boolean, 
 *   data: RiskManagementValidationResult,
 *   timestamp: string 
 * }
 */
botRiskManagementRoutes.post('/validate', riskManagementController.validateRiskManagement);

// Global risk management routes (prefixed with /api/risk-management)
export const globalRiskManagementRoutes = Router();

// Apply authentication middleware to all routes
globalRiskManagementRoutes.use(authMiddleware.requireAuth);

/**
 * GET /api/risk-management/templates
 * Get all risk management templates
 * 
 * Response: { 
 *   success: boolean, 
 *   data: RiskManagementTemplate[], 
 *   timestamp: string 
 * }
 */
globalRiskManagementRoutes.get('/templates', riskManagementController.getRiskManagementTemplates);

/**
 * POST /api/risk-management/templates
 * Create a new risk management template
 * 
 * Body: {
 *   name: string,
 *   description: string,
 *   category: 'conservative' | 'moderate' | 'aggressive' | 'custom',
 *   configuration: PerBotRiskManagement
 * }
 * 
 * Response: { 
 *   success: boolean, 
 *   data: RiskManagementTemplate,
 *   timestamp: string 
 * }
 */
globalRiskManagementRoutes.post('/templates', riskManagementController.createRiskManagementTemplate);

/**
 * POST /api/risk-management/validate
 * Validate risk management configuration (standalone)
 * 
 * Body: {
 *   riskManagement: PerBotRiskManagement,
 *   botId?: string,
 *   accountBalance?: number
 * }
 * 
 * Response: { 
 *   success: boolean, 
 *   data: RiskManagementValidationResult,
 *   timestamp: string 
 * }
 */
globalRiskManagementRoutes.post('/validate', riskManagementController.validateRiskManagementStandalone);

export default {
  botRiskManagementRoutes,
  globalRiskManagementRoutes
};
