/**
 * Example SMA Strategy Plugin
 * 
 * This plugin demonstrates how to create a custom SMA-based trading strategy
 * that can be loaded through the strategy plugin system.
 */

import { z } from 'zod';

import type { SMASignalConfig } from '../packages/backend/src/JabbrLabs/signals/sma/models';
import { SMASignalProcessor } from '../packages/backend/src/JabbrLabs/signals/sma/sma-signal-processor';
import type { 
  IStrategy, 
  StrategyContext, 
  StrategyConfig, 
  StrategyResult, 
  ConfigValidationResult,
  StrategyState
} from '../packages/backend/src/JabbrLabs/target-reacher/interfaces';


// Configuration schema for validation
const ExampleSMAConfigSchema = z.object({
  fastPeriod: z.number().int().min(2).max(50).default(5),
  slowPeriod: z.number().int().min(3).max(200).default(14),
  priceSource: z.enum(['close', 'open', 'high', 'low']).default('close'),
  signalMode: z.enum(['crossover', 'trend', 'combined']).default('combined'),
  useEMA: z.boolean().default(true),
  minChangePercent: z.number().min(0).max(100).default(0.5),
  confidenceThreshold: z.number().min(0).max(1).default(0.55)
});

class ExampleSMAStrategy implements IStrategy {
  // Required metadata properties
  readonly name = 'Example SMA Strategy Plugin';
  readonly version = '1.0.0';
  readonly description = 'A simple plugin that uses SMA crossovers for generating signals';
  readonly supportedMarkets = ['spot', 'futures'];

  // Plugin metadata for the plugin manager
  static metadata = {
    name: 'Example SMA Strategy',
    version: '1.0.0',
    description: 'A simple plugin that uses SMA crossovers for generating signals',
    author: 'JabbrLabs',
    supportedMarkets: ['spot', 'futures'],
    riskLevel: 'medium',
    category: 'technical',
    tags: ['sma', 'crossover', 'beginner'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  private processor: SMASignalProcessor;
  private config: SMASignalConfig;
  private state: StrategyState = {
    isRunning: false,
    totalProfit: 0,
    tradesExecuted: 0,
    lastUpdate: new Date(),
    customState: {
      lastSignal: null,
      signalHistory: []
    }
  };

  constructor() {
    // Default configuration
    this.config = {
      fastPeriod: 5,
      slowPeriod: 14,
      priceSource: 'close',
      signalMode: 'combined',
      useEMA: true, // This plugin uses EMA instead of SMA by default for faster response
      minChangePercent: 0.5,
      confidenceThreshold: 0.55
    };
    
    this.processor = new SMASignalProcessor(this.config);
  }

  /**
   * Initialize the strategy
   */
  async initialize(context: StrategyContext): Promise<void> {
    const { config } = context;
    
    // Update configuration with values from context
    this.config = {
      fastPeriod: config.parameters.fastPeriod as number || this.config.fastPeriod,
      slowPeriod: config.parameters.slowPeriod as number || this.config.slowPeriod,
      priceSource: (config.parameters.priceSource as 'close' | 'open' | 'high' | 'low') || this.config.priceSource,
      signalMode: (config.parameters.signalMode as 'crossover' | 'trend' | 'combined') || this.config.signalMode,
      useEMA: (config.parameters.useEMA as boolean) ?? this.config.useEMA,
      minChangePercent: (config.parameters.minChangePercent as number) || this.config.minChangePercent,
      confidenceThreshold: (config.parameters.confidenceThreshold as number) || this.config.confidenceThreshold
    };
    
    // Initialize signal processor
    this.processor.updateConfig(this.config);
    
    // Set state as running
    this.state.isRunning = true;
    this.state.lastUpdate = new Date();
    
    context.logger.info(`Example SMA Strategy initialized for ${context.symbol}`, {
      botId: context.botConfig.id,
      fastPeriod: this.config.fastPeriod,
      slowPeriod: this.config.slowPeriod,
      useEMA: this.config.useEMA
    });
  }

  /**
   * Execute the strategy
   */
  async execute(context: StrategyContext): Promise<StrategyResult> {
    try {
      // Get historical candle data
      const timeframe = context.config.execution?.timeframe || '15m'; // This plugin uses 15m by default
      const candles = await context.marketData.getCandles(context.symbol, timeframe, 50);
      
      if (!candles || candles.length < this.config.slowPeriod) {
        return {
          success: false,
          action: 'hold',
          reason: `Insufficient data: need at least ${this.config.slowPeriod} candles`,
          error: 'Insufficient data'
        };
      }
      
      // Process candles to get signal
      const signal = this.processor.process(candles);
      
      // No signal or hold
      if (!signal || signal.signal === 0) {
        return {
          success: true,
          action: 'hold',
          reason: 'No trading signal',
          confidence: 0
        };
      }
      
      // Store signal in state
      (this.state.customState as any).lastSignal = {
        direction: signal.signal > 0 ? 'buy' : 'sell',
        confidence: signal.confidence,
        timestamp: Date.now(),
        reason: signal.reason
      };
      
      // Add to history (keep last 10)
      const history = ((this.state.customState as any).signalHistory || []).slice(0, 9);
      history.unshift({
        direction: signal.signal > 0 ? 'buy' : 'sell',
        confidence: signal.confidence,
        timestamp: Date.now()
      });
      (this.state.customState as any).signalHistory = history;
      
      // Determine action based on signal
      const action = signal.signal > 0 ? 'buy' : 'sell';
      
      // Check if signal meets confidence threshold
      if (signal.confidence < (context.config.execution?.minimumConfidence || 0.6)) {
        return {
          success: true,
          action: 'hold',
          confidence: signal.confidence,
          reason: `${action.toUpperCase()} signal detected but confidence ${signal.confidence.toFixed(2)} below threshold`
        };
      }
      
      // Get current position
      const position = await context.tradeExecutor.getPosition(
        context.botConfig.id,
        context.symbol
      );
      
      // Handle existing positions
      if (position) {
        // Already have a position in the same direction
        if ((position.side === 'long' && action === 'buy') || 
            (position.side === 'short' && action === 'sell')) {
          return {
            success: true,
            action: 'hold',
            confidence: signal.confidence,
            reason: `Already have a ${position.side} position`
          };
        }
        
        // Close existing position in opposite direction
        await context.tradeExecutor.closePosition(context.botConfig.id, context.symbol);
        this.state.tradesExecuted++;
      }
      
      // Execute trade
      const tradeSignal = this.processor.createTradeSignal(
        signal,
        context.botConfig.id,
        context.symbol
      );
      
      const order = await context.tradeExecutor.executeSignal(tradeSignal, context.botConfig);
      
      // Update state
      this.state.tradesExecuted++;
      this.state.lastUpdate = new Date();
      
      // Log action
      context.logger.info(`Example SMA Strategy: ${action.toUpperCase()}`, {
        botId: context.botConfig.id,
        symbol: context.symbol,
        confidence: signal.confidence,
        reason: signal.reason
      });
      
      return {
        success: true,
        action,
        confidence: signal.confidence,
        reason: signal.reason,
        metadata: {
          fastMA: signal.fastMA.toFixed(2),
          slowMA: signal.slowMA.toFixed(2),
          orderId: order.orderId
        }
      };
    } catch (error) {
      context.logger.error(`Example SMA Strategy error: ${error instanceof Error ? error.message : String(error)}`, {
        botId: context.botConfig.id,
        symbol: context.symbol
      });
      
      return {
        success: false,
        action: 'hold',
        error: error instanceof Error ? error.message : String(error),
        reason: 'Strategy execution error'
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(context: StrategyContext): Promise<void> {
    this.state.isRunning = false;
    context.logger.info('Example SMA Strategy cleaned up');
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    try {
      const validation = ExampleSMAConfigSchema.safeParse(config);
      
      if (validation.success) {
        const data = validation.data;
        
        // Additional validation
        const warnings: { field: string, message: string, suggestion?: string }[] = [];
        
        if (data.fastPeriod >= data.slowPeriod) {
          return {
            valid: false,
            errors: [
              {
                field: 'fastPeriod',
                message: 'Fast period must be less than slow period',
                code: 'INVALID_VALUE'
              }
            ],
            warnings
          };
        }
        
        return {
          valid: true,
          errors: [],
          warnings
        };
      }
      
      // Format Zod errors
      return {
        valid: false,
        errors: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: 'VALIDATION_ERROR'
        })),
        warnings: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'validation',
            message: error instanceof Error ? error.message : String(error),
            code: 'VALIDATION_ERROR'
          }
        ],
        warnings: []
      };
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig(): StrategyConfig {
    return {
      type: 'custom',
      parameters: {
        fastPeriod: 5,
        slowPeriod: 14,
        priceSource: 'close',
        signalMode: 'combined',
        useEMA: true,
        minChangePercent: 0.5,
        confidenceThreshold: 0.55
      },
      riskManagement: {
        stopLossPercentage: 1.5,
        takeProfitPercentage: 3
      },
      execution: {
        timeframe: '15m',
        minimumConfidence: 0.6
      }
    };
  }

  /**
   * Get current state
   */
  getState(): StrategyState {
    return { ...this.state };
  }

  /**
   * Set state
   */
  setState(state: Partial<StrategyState>): void {
    this.state = {
      ...this.state,
      ...state,
      lastUpdate: new Date()
    };
  }
}

export default ExampleSMAStrategy;
