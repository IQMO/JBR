import { Router } from 'express';

import { authMiddleware } from '../auth/auth.middleware';

import { botController } from './bots.controller';

/**
 * Bot management routes
 * All routes are prefixed with /api/bots in the main app
 * All routes require authentication
 */
export const botRoutes = Router();

// Apply authentication middleware to all bot routes
botRoutes.use(authMiddleware.requireAuth);

/**
 * GET /api/bots
 * Get all bots for the authenticated user
 * 
 * Query params:
 * - status?: 'stopped' | 'starting' | 'running' | 'pausing' | 'paused' | 'stopping' | 'error'
 * - strategy?: string
 * - exchange?: string
 * - limit?: number (default: 50)
 * - offset?: number (default: 0)
 * 
 * Response: { success: boolean, data: Bot[], pagination: {...}, timestamp }
 */
botRoutes.get('/', botController.getAllBots);

/**
 * POST /api/bots
 * Create a new trading bot
 * 
 * Body: {
 *   name: string,
 *   description?: string,
 *   strategy: 'aether' | 'target-reacher' | 'sma-crossover' | 'rsi-divergence' | 'custom',
 *   exchange: 'bybit' | 'binance' | 'okx' | 'coinbase' | 'kraken',
 *   exchangeApiKeyId: string,
 *   configuration: object,
 *   riskManagement: object
 * }
 * 
 * Response: { success: boolean, data: Bot, timestamp }
 */
botRoutes.post('/', botController.createBot);

/**
 * GET /api/bots/:id
 * Get a specific bot by ID (only user's own bots)
 * 
 * Response: { success: boolean, data: Bot, timestamp }
 */
botRoutes.get('/:id', botController.getBotById);

/**
 * PUT /api/bots/:id
 * Update an existing bot configuration
 * 
 * Body: Partial bot configuration
 * Response: { success: boolean, data: Bot, timestamp }
 */
botRoutes.put('/:id', botController.updateBot);

/**
 * DELETE /api/bots/:id
 * Delete a bot (must be stopped first)
 * 
 * Response: { success: boolean, data: { message }, timestamp }
 */
botRoutes.delete('/:id', botController.deleteBot);

/**
 * POST /api/bots/:id/start
 * Start a bot (change status to 'starting' then 'running')
 * 
 * Response: { success: boolean, data: { status, message }, timestamp }
 */
botRoutes.post('/:id/start', botController.startBot);

/**
 * POST /api/bots/:id/stop
 * Stop a bot (change status to 'stopping' then 'stopped')
 * 
 * Response: { success: boolean, data: { status, message }, timestamp }
 */
botRoutes.post('/:id/stop', botController.stopBot);

/**
 * POST /api/bots/:id/pause
 * Pause a running bot (change status to 'pausing' then 'paused')
 * 
 * Response: { success: boolean, data: { status, message }, timestamp }
 */
botRoutes.post('/:id/pause', botController.pauseBot);

/**
 * POST /api/bots/:id/resume
 * Resume a paused bot (change status to 'starting' then 'running')
 * 
 * Response: { success: boolean, data: { status, message }, timestamp }
 */
botRoutes.post('/:id/resume', botController.resumeBot);

/**
 * GET /api/bots/:id/performance
 * Get bot performance metrics
 * 
 * Query params:
 * - timeframe?: '1h' | '24h' | '7d' | '30d' | 'all' (default: '24h')
 * 
 * Response: { success: boolean, data: PerformanceMetrics, timestamp }
 */
botRoutes.get('/:id/performance', botController.getBotPerformance);

/**
 * GET /api/bots/:id/trades
 * Get trades for a specific bot
 * 
 * Query params:
 * - limit?: number (default: 50)
 * - offset?: number (default: 0)
 * - status?: trade status filter
 * - from?: ISO date string
 * - to?: ISO date string
 * 
 * Response: { success: boolean, data: Trade[], pagination: {...}, timestamp }
 */
botRoutes.get('/:id/trades', botController.getBotTrades);

/**
 * GET /api/bots/:id/positions
 * Get current positions for a specific bot
 * 
 * Response: { success: boolean, data: Position[], timestamp }
 */
botRoutes.get('/:id/positions', botController.getBotPositions);

/**
 * POST /api/bots/:id/validate
 * Validate bot configuration before saving/starting
 * 
 * Body: Bot configuration object
 * Response: { success: boolean, data: { valid: boolean, errors: string[] }, timestamp }
 */
botRoutes.post('/:id/validate', botController.validateBotConfig);

/**
 * GET /api/bots/strategies
 * Get available trading strategies and their parameter schemas
 * 
 * Response: { success: boolean, data: StrategySchema[], timestamp }
 */
botRoutes.get('/strategies', botController.getAvailableStrategies);

export default botRoutes; 