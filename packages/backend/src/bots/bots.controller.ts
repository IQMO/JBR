import type { Request, Response } from 'express';

import { BotManager } from './bot-manager';
import type { CreateBotRequest, UpdateBotRequest, BotFilters } from './bots.service';
import { botService } from './bots.service';

/**
 * Extended Request interface with user information from auth middleware
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// Get bot manager instance
const botManager = BotManager.getInstance();

/**
 * Bot Controller
 * Handles all HTTP requests for bot management
 */
export class BotController {
  /**
   * GET /api/bots
   * Get all bots for the authenticated user
   */
  async getAllBots(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const filters: BotFilters = {
        status: req.query.status as any,
        strategy: req.query.strategy as string,
        exchange: req.query.exchange as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const { bots, total } = await botService.getAllBots(req.user.userId, filters);

      res.json({
        success: true,
        data: bots,
        pagination: {
          total,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          hasMore: (filters.offset || 0) + (filters.limit || 50) < total
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching bots:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bots',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots
   * Create a new trading bot
   */
  async createBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validate required fields
      const { name, strategy, exchange, exchangeApiKeyId, configuration, riskManagement } = req.body;

      if (!name || !strategy || !exchange || !exchangeApiKeyId) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, strategy, exchange, exchangeApiKeyId',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botData: CreateBotRequest = {
        name,
        description: req.body.description,
        strategy,
        exchange,
        exchangeApiKeyId,
        configuration: configuration || {},
        riskManagement: riskManagement || {}
      };

      const bot = await botService.createBot(req.user.userId, botData);

      res.status(201).json({
        success: true,
        data: bot,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating bot:', error);
      
      if (error instanceof Error) {
        // Handle specific error messages
        if (error.message.includes('already exists')) {
          res.status(409).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        if (error.message.includes('Invalid') || error.message.includes('inactive')) {
          res.status(400).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/:id
   * Get a specific bot by ID
   */
  async getBotById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const bot = await botService.getBotById(req.user.userId, botId);

      if (!bot) {
        res.status(404).json({
          success: false,
          error: 'Bot not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        data: bot,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching bot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * PUT /api/bots/:id
   * Update an existing bot
   */
  async updateBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const updates: UpdateBotRequest = {
        name: req.body.name,
        description: req.body.description,
        configuration: req.body.configuration,
        riskManagement: req.body.riskManagement
      };

      const bot = await botService.updateBot(req.user.userId, botId, updates);

      if (!bot) {
        res.status(404).json({
          success: false,
          error: 'Bot not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        data: bot,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating bot:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * DELETE /api/bots/:id
   * Delete a bot
   */
  async deleteBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const deleted = await botService.deleteBot(req.user.userId, botId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Bot not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        data: { message: 'Bot deleted successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting bot:', error);
      
      if (error instanceof Error && error.message.includes('must be stopped')) {
        res.status(400).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/start
   * Start a bot (change status to 'starting' then 'running')
   */
  async startBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use the bot manager for production runtime management
      await botManager.startBot(req.user.userId, botId);

      res.json({
        success: true,
        data: { status: 'running', message: 'Bot started successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error starting bot:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/stop
   * Stop a bot (change status to 'stopping' then 'stopped')
   */
  async stopBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use the bot manager for production runtime management
      await botManager.stopBot(req.user.userId, botId);

      res.json({
        success: true,
        data: { status: 'stopped', message: 'Bot stopped successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error stopping bot:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/pause
   * Pause a running bot (change status to 'pausing' then 'paused')
   */
  async pauseBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use the bot manager for production runtime management
      await botManager.pauseBot(req.user.userId, botId);

      res.json({
        success: true,
        data: { status: 'paused', message: 'Bot paused successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error pausing bot:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/resume
   * Resume a paused bot (change status to 'starting' then 'running')
   */
  async resumeBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use the bot manager for production runtime management
      await botManager.resumeBot(req.user.userId, botId);

      res.json({
        success: true,
        data: { status: 'running', message: 'Bot resumed successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error resuming bot:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume bot',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/:id/performance
   * Get bot performance metrics
   */
  async getBotPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const bot = await botService.getBotById(req.user.userId, botId);

      if (!bot) {
        res.status(404).json({
          success: false,
          error: 'Bot not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // For now, return the performance data from the bot record
      // In a real implementation, this might aggregate data from trades table
      res.json({
        success: true,
        data: bot.performance,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching bot performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bot performance',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/:id/trades
   * Get trades for a specific bot
   */
  async getBotTrades(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // For now, return empty array
      // In a real implementation, this would query the trades table
      res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching bot trades:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bot trades',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/:id/positions
   * Get current positions for a specific bot
   */
  async getBotPositions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // For now, return empty array
      // In a real implementation, this would query the positions table
      res.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching bot positions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bot positions',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/validate
   * Validate bot configuration
   */
  async validateBotConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Basic validation logic
      const errors: string[] = [];
      const config = req.body;

      if (!config.strategy) {
        errors.push('Strategy is required');
      }

      if (!config.exchange) {
        errors.push('Exchange is required');
      }

      // Add more validation logic as needed

      res.json({
        success: true,
        data: {
          valid: errors.length === 0,
          errors
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error validating bot config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate bot configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/strategies
   * Get available trading strategies
   */
  async getAvailableStrategies(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const strategies = await botService.getAvailableStrategies();

      res.json({
        success: true,
        data: strategies,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching strategies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch strategies',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/strategy/switch
   * Switch bot strategy at runtime
   */
  async switchBotStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { strategyType, config, pluginId, options } = req.body;

      if (!strategyType || !config) {
        res.status(400).json({
          success: false,
          error: 'Strategy type and config are required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('🔄 API: Switching bot strategy', {
        botId,
        userId: req.user.userId,
        strategyType,
        options
      });

      const result = await botManager.switchBotStrategy(
        req.user.userId,
        botId,
        strategyType,
        {
          type: strategyType,
          parameters: config,
          execution: {
            timeframe: '1m',
            minimumConfidence: 0.7
          }
        },
        options || {
          preserveState: true,
          validateFirst: true,
          rollbackOnError: true
        },
        pluginId
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to switch strategy',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        message: 'Strategy switched successfully',
        warnings: result.warnings,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ API: Failed to switch bot strategy', {
        botId: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch strategy',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/bots/:id/strategy/rollback
   * Rollback bot strategy to previous version
   */
  async rollbackBotStrategy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('🔄 API: Rolling back bot strategy', {
        botId,
        userId: req.user.userId
      });

      const result = await botManager.rollbackBotStrategy(req.user.userId, botId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to rollback strategy',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        message: 'Strategy rolled back successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ API: Failed to rollback bot strategy', {
        botId: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rollback strategy',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/strategies/available
   * Get available strategies
   */
  async getAvailableStrategiesNew(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const strategies = botManager.getAvailableStrategies();

      res.json({
        success: true,
        data: strategies,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ API: Failed to get available strategies', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get available strategies',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/bots/:id/strategy/performance
   * Get bot strategy performance
   */
  async getBotStrategyPerformanceNew(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const botId = req.params.id;
      if (!botId) {
        res.status(400).json({
          success: false,
          error: 'Bot ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const performance = botManager.getBotStrategyPerformance(botId);

      res.json({
        success: true,
        data: performance,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ API: Failed to get bot strategy performance', {
        botId: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get strategy performance',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export singleton instance
export const botController = new BotController(); 