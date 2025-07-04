import { randomUUID } from 'crypto';

import { database } from '../database/database.config';

/**
 * Bot-related types
 */
export interface Bot {
  id: string;
  userId: string;
  name: string;
  description?: string;
  strategy: 'aether' | 'target-reacher' | 'sma-crossover' | 'rsi-divergence' | 'custom';
  exchange: 'bybit' | 'binance' | 'okx' | 'coinbase' | 'kraken';
  exchangeApiKeyId: string;
  status: 'stopped' | 'starting' | 'running' | 'pausing' | 'paused' | 'stopping' | 'error';
  configuration: Record<string, any>;
  riskManagement: Record<string, any>;
  performance: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    maxDrawdown: number;
    averageTradeTime: number;
    lastCalculatedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
}

export interface CreateBotRequest {
  name: string;
  description?: string;
  strategy: Bot['strategy'];
  exchange: Bot['exchange'];
  exchangeApiKeyId: string;
  configuration: Record<string, any>;
  riskManagement: Record<string, any>;
}

export interface UpdateBotRequest {
  name?: string;
  description?: string;
  strategy?: string;
  configuration?: Record<string, any>;
  riskManagement?: Record<string, any>;
}

export interface BotFilters {
  status?: Bot['status'];
  strategy?: string;
  exchange?: string;
  limit?: number;
  offset?: number;
}

export interface StrategySchema {
  id: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    default?: any;
    min?: number;
    max?: number;
    options?: string[];
    description?: string;
  }[];
  riskManagement: {
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required?: boolean;
    default?: any;
    min?: number;
    max?: number;
    options?: string[];
    description?: string;
  }[];
}

/**
 * Bot Service
 * Handles all bot-related database operations and business logic
 */
export class BotService {
  /**
   * Get all bots for a user with optional filtering
   */
  async getAllBots(userId: string, filters: BotFilters = {}): Promise<{ bots: Bot[], total: number }> {
    const {
      status,
      strategy,
      exchange,
      limit = 50,
      offset = 0
    } = filters;

    const whereConditions = ['user_id = $1'];
    const queryParams: any[] = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    if (strategy) {
      paramCount++;
      whereConditions.push(`strategy = $${paramCount}`);
      queryParams.push(strategy);
    }

    if (exchange) {
      paramCount++;
      whereConditions.push(`exchange = $${paramCount}`);
      queryParams.push(exchange);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bots
      WHERE ${whereClause}
    `;

    const countResult = await database.query(countQuery, queryParams);
    const total = parseInt(countResult.at(0).total);

    // Get bots with pagination
    const botsQuery = `
      SELECT 
        id,
        user_id,
        name,
        description,
        strategy,
        exchange,
        exchange_api_key_id,
        status,
        configuration,
        risk_management,
        performance,
        created_at,
        updated_at,
        last_active_at
      FROM bots
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);
    const botsResult = await database.query(botsQuery, queryParams);

    const bots = botsResult.map(this.mapBotFromDb);

    return { bots, total };
  }

  /**
   * Get a specific bot by ID (only if it belongs to the user)
   */
  async getBotById(userId: string, botId: string): Promise<Bot | null> {
    const query = `
      SELECT 
        id,
        user_id,
        name,
        description,
        strategy,
        exchange,
        exchange_api_key_id,
        status,
        configuration,
        risk_management,
        performance,
        created_at,
        updated_at,
        last_active_at
      FROM bots
      WHERE id = $1 AND user_id = $2
    `;

    const result = await database.query(query, [botId, userId]);

    if (result.length === 0) {
      return null;
    }

    return this.mapBotFromDb(result.at(0));
  }

  /**
   * Create a new bot
   */
  async createBot(userId: string, botData: CreateBotRequest): Promise<Bot> {
    const botId = randomUUID();

    // Check if bot name is unique for this user
    const existingBot = await database.query(
      'SELECT id FROM bots WHERE user_id = $1 AND name = $2',
      [userId, botData.name]
    );

    if (existingBot.length > 0) {
      throw new Error('A bot with this name already exists');
    }

    // Verify the exchange API key belongs to the user
    const apiKeyCheck = await database.query(
      'SELECT id FROM exchange_api_keys WHERE id = $1 AND user_id = $2 AND is_active = true',
      [botData.exchangeApiKeyId, userId]
    );

    if (apiKeyCheck.length === 0) {
      throw new Error('Invalid or inactive exchange API key');
    }

    const query = `
      INSERT INTO bots (
        id,
        user_id,
        name,
        description,
        strategy,
        exchange,
        exchange_api_key_id,
        status,
        configuration,
        risk_management,
        performance
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING 
        id,
        user_id,
        name,
        description,
        strategy,
        exchange,
        exchange_api_key_id,
        status,
        configuration,
        risk_management,
        performance,
        created_at,
        updated_at,
        last_active_at
    `;

    const defaultPerformance = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      winRate: 0,
      maxDrawdown: 0,
      averageTradeTime: 0,
      lastCalculatedAt: null
    };

    const values = [
      botId,
      userId,
      botData.name,
      botData.description || null,
      botData.strategy,
      botData.exchange,
      botData.exchangeApiKeyId,
      'stopped',
      JSON.stringify(botData.configuration),
      JSON.stringify(botData.riskManagement),
      JSON.stringify(defaultPerformance)
    ];

    const result = await database.query(query, values);
    return this.mapBotFromDb(result.at(0));
  }

  /**
   * Update an existing bot
   */
  async updateBot(userId: string, botId: string, updates: UpdateBotRequest): Promise<Bot | null> {
    // Check if bot exists and belongs to user
    const existingBot = await this.getBotById(userId, botId);
    if (!existingBot) {
      return null;
    }

    // Check if trying to rename to an existing name
    if (updates.name && updates.name !== existingBot.name) {
      const nameCheck = await database.query(
        'SELECT id FROM bots WHERE user_id = $1 AND name = $2 AND id != $3',
        [userId, updates.name, botId]
      );

      if (nameCheck.length > 0) {
        throw new Error('A bot with this name already exists');
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 0;

    if (updates.name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(updates.name);
    }

    if (updates.description !== undefined) {
      paramCount++;
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(updates.description);
    }

    if (updates.configuration !== undefined) {
      paramCount++;
      updateFields.push(`configuration = $${paramCount}`);
      updateValues.push(JSON.stringify(updates.configuration));
    }

    if (updates.riskManagement !== undefined) {
      paramCount++;
      updateFields.push(`risk_management = $${paramCount}`);
      updateValues.push(JSON.stringify(updates.riskManagement));
    }

    if (updateFields.length === 0) {
      return existingBot; // No updates provided
    }

    // Add updated_at field
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Add WHERE conditions
    paramCount++;
    updateValues.push(botId);
    paramCount++;
    updateValues.push(userId);

    const query = `
      UPDATE bots
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
      RETURNING 
        id,
        user_id,
        name,
        description,
        strategy,
        exchange,
        exchange_api_key_id,
        status,
        configuration,
        risk_management,
        performance,
        created_at,
        updated_at,
        last_active_at
    `;

    const result = await database.query(query, updateValues);
    return this.mapBotFromDb(result.at(0));
  }

  /**
   * Delete a bot (only if stopped)
   */
  async deleteBot(userId: string, botId: string): Promise<boolean> {
    // Check if bot exists, belongs to user, and is stopped
    const bot = await this.getBotById(userId, botId);
    if (!bot) {
      return false;
    }

    if (bot.status !== 'stopped') {
      throw new Error('Bot must be stopped before deletion');
    }

    const query = `
      DELETE FROM bots
      WHERE id = $1 AND user_id = $2 AND status = 'stopped'
    `;

    const result = await database.query(query, [botId, userId]);
    return (result as any).rowCount > 0;
  }

  /**
   * Update bot status
   */
  async updateBotStatus(userId: string, botId: string, status: Bot['status']): Promise<Bot | null> {
    const query = `
      UPDATE bots
      SET 
        status = $1,
        updated_at = NOW(),
        last_active_at = CASE WHEN $1 = 'running' THEN NOW() ELSE last_active_at END
      WHERE id = $2 AND user_id = $3
      RETURNING 
        id,
        user_id,
        name,
        description,
        strategy,
        exchange,
        exchange_api_key_id,
        status,
        configuration,
        risk_management,
        performance,
        created_at,
        updated_at,
        last_active_at
    `;

    const result = await database.query(query, [status, botId, userId]);

    if (result.length === 0) {
      return null;
    }

    return this.mapBotFromDb(result.at(0));
  }

  /**
   * Get available trading strategies with their schemas
   */
  async getAvailableStrategies(): Promise<StrategySchema[]> {
    // This would normally come from a database or configuration file
    // For now, returning static strategies that match the frontend
    return [
      {
        id: 'aether',
        name: 'Aether Signal Generator',
        description: 'Advanced mathematical signal generator using fractional calculus and stochastic processes',
        parameters: [
          {
            name: 'hurstExponent',
            label: 'Hurst Exponent',
            type: 'number',
            required: true,
            default: 0.7,
            min: 0.1,
            max: 0.9,
            description: 'Controls the memory and trend characteristics of the fractional Brownian motion'
          },
          {
            name: 'fractionalOrder',
            label: 'Fractional Order',
            type: 'number',
            required: true,
            default: 0.8,
            min: 0.1,
            max: 2.0,
            description: 'Order of the fractional differential operator'
          },
          {
            name: 'confidenceThreshold',
            label: 'Confidence Threshold',
            type: 'number',
            required: true,
            default: 0.7,
            min: 0.1,
            max: 1.0,
            description: 'Minimum confidence level required for signal execution'
          }
        ],
        riskManagement: [
          {
            name: 'maxPositionSize',
            label: 'Max Position Size (%)',
            type: 'number',
            required: true,
            default: 15,
            min: 1,
            max: 50,
            description: 'Maximum percentage of portfolio per position'
          },
          {
            name: 'stopLoss',
            label: 'Stop Loss (%)',
            type: 'number',
            required: true,
            default: 8,
            min: 0.1,
            max: 25,
            description: 'Stop loss percentage'
          },
          {
            name: 'takeProfit',
            label: 'Take Profit (%)',
            type: 'number',
            required: true,
            default: 15,
            min: 0.1,
            max: 100,
            description: 'Take profit percentage'
          }
        ]
      },
      {
        id: 'SMA',
        name: 'Simple Moving Average',
        description: 'Buy/sell signals based on Simple Moving Average crossovers',
        parameters: [
          {
            name: 'period',
            label: 'Period',
            type: 'number',
            required: true,
            default: 14,
            min: 1,
            max: 200,
            description: 'Number of periods for SMA calculation'
          },
          {
            name: 'threshold',
            label: 'Threshold',
            type: 'number',
            required: true,
            default: 50,
            min: 0,
            max: 100,
            description: 'Signal strength threshold percentage'
          }
        ],
        riskManagement: [
          {
            name: 'maxPositionSize',
            label: 'Max Position Size (%)',
            type: 'number',
            required: true,
            default: 10,
            min: 1,
            max: 100,
            description: 'Maximum percentage of portfolio per position'
          },
          {
            name: 'stopLoss',
            label: 'Stop Loss (%)',
            type: 'number',
            required: true,
            default: 5,
            min: 0.1,
            max: 50,
            description: 'Stop loss percentage'
          },
          {
            name: 'takeProfit',
            label: 'Take Profit (%)',
            type: 'number',
            required: true,
            default: 10,
            min: 0.1,
            max: 100,
            description: 'Take profit percentage'
          }
        ]
      },
      {
        id: 'EMA',
        name: 'Exponential Moving Average',
        description: 'Buy/sell signals based on Exponential Moving Average crossovers',
        parameters: [
          {
            name: 'period',
            label: 'Period',
            type: 'number',
            required: true,
            default: 14,
            min: 1,
            max: 200,
            description: 'Number of periods for EMA calculation'
          },
          {
            name: 'multiplier',
            label: 'Multiplier',
            type: 'number',
            required: true,
            default: 2,
            min: 1,
            max: 10,
            description: 'EMA smoothing multiplier'
          }
        ],
        riskManagement: [
          {
            name: 'maxPositionSize',
            label: 'Max Position Size (%)',
            type: 'number',
            required: true,
            default: 10,
            min: 1,
            max: 100,
            description: 'Maximum percentage of portfolio per position'
          },
          {
            name: 'stopLoss',
            label: 'Stop Loss (%)',
            type: 'number',
            required: true,
            default: 5,
            min: 0.1,
            max: 50,
            description: 'Stop loss percentage'
          }
        ]
      },
      {
        id: 'Custom',
        name: 'Custom Script',
        description: 'Custom trading strategy using user-provided script',
        parameters: [
          {
            name: 'script',
            label: 'Strategy Script',
            type: 'textarea',
            required: true,
            description: 'Custom JavaScript trading strategy code'
          }
        ],
        riskManagement: [
          {
            name: 'maxPositionSize',
            label: 'Max Position Size (%)',
            type: 'number',
            required: true,
            default: 5,
            min: 1,
            max: 50,
            description: 'Maximum percentage of portfolio per position'
          },
          {
            name: 'maxDrawdown',
            label: 'Max Drawdown (%)',
            type: 'number',
            required: true,
            default: 20,
            min: 5,
            max: 80,
            description: 'Maximum allowed portfolio drawdown'
          }
        ]
      },
      {
        id: 'target-reacher',
        name: 'Target Reacher',
        description: 'Price targeting strategy with fixed and average price sources',
        parameters: [
          {
            name: 'priceSource',
            label: 'Price Source',
            type: 'select',
            required: true,
            default: 'fixed',
            options: ['fixed', 'average'],
            description: 'Source for target price calculation'
          },
          {
            name: 'fixedPrice',
            label: 'Fixed Target Price',
            type: 'number',
            required: false,
            default: 50000,
            min: 0.01,
            description: 'Fixed target price (used when source is "fixed")'
          },
          {
            name: 'averagePeriod',
            label: 'Average Period',
            type: 'number',
            required: false,
            default: 20,
            min: 1,
            max: 500,
            description: 'Period for average calculation (used when source is "average")'
          },
          {
            name: 'averageType',
            label: 'Average Type',
            type: 'select',
            required: false,
            default: 'close',
            options: ['open', 'high', 'low', 'close'],
            description: 'Price type for average calculation'
          },
          {
            name: 'confidenceThreshold',
            label: 'Confidence Threshold',
            type: 'number',
            required: true,
            default: 0.8,
            min: 0.1,
            max: 1.0,
            description: 'Minimum confidence level for signal execution'
          }
        ],
        riskManagement: [
          {
            name: 'maxPositionSize',
            label: 'Max Position Size (%)',
            type: 'number',
            required: true,
            default: 10,
            min: 1,
            max: 50,
            description: 'Maximum percentage of portfolio per position'
          },
          {
            name: 'stopLoss',
            label: 'Stop Loss (%)',
            type: 'number',
            required: true,
            default: 5,
            min: 0.1,
            max: 25,
            description: 'Stop loss percentage'
          },
          {
            name: 'takeProfit',
            label: 'Take Profit (%)',
            type: 'number',
            required: true,
            default: 10,
            min: 0.1,
            max: 100,
            description: 'Take profit percentage'
          }
        ]
      }
    ];
  }

  /**
   * Map database row to Bot interface
   */
  private mapBotFromDb(row: any): Bot {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      strategy: row.strategy,
      exchange: row.exchange,
      exchangeApiKeyId: row.exchange_api_key_id,
      status: row.status,
      configuration: row.configuration,
      riskManagement: row.risk_management,
      performance: row.performance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActiveAt: row.last_active_at
    };
  }
}

// Export singleton instance
export const botService = new BotService(); 