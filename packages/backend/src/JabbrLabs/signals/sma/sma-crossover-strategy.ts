/**
 * SMA Crossover Strategy
 * 
 * Implements a trading strategy based on SMA crossover signals.
 * This is a simple demonstration strategy that follows the IStrategy interface.
 */

import { z } from 'zod';

import type { 
  IStrategy, 
  StrategyConfig, 
  StrategyContext, 
  ConfigValidationResult,
  StrategyResult,
  StrategyState
} from '../../target-reacher/interfaces';
import type { SMASignalConfig } from '../sma/models';
import { SMASignalProcessor } from '../sma/sma-signal-processor';

// Configuration schema for validation
const SMACrossoverConfigSchema = z.object({
  fastPeriod: z.number().int().min(2).max(50).default(9),
  slowPeriod: z.number().int().min(3).max(200).default(21),
  priceSource: z.enum(['close', 'open', 'high', 'low']).default('close'),
  signalMode: z.enum(['crossover', 'trend', 'combined']).default('crossover'),
  useEMA: z.boolean().default(false),
  minChangePercent: z.number().min(0).max(100).default(0.5),
  confidenceThreshold: z.number().min(0).max(1).default(0.6)
});

export class SMACrossoverStrategy implements IStrategy {
  readonly name = 'SMA Crossover Strategy';
  readonly version = '1.0.0';
  readonly description = 'Trading strategy based on SMA crossover signals';
  readonly supportedMarkets = ['spot', 'futures'];

  private processor: SMASignalProcessor;
  private config: SMASignalConfig;
  private state: StrategyState = {
    isRunning: false,
    totalProfit: 0,
    tradesExecuted: 0,
    lastUpdate: new Date(),
    customState: {}
  };

  constructor() {
    // Initialize with default config (will be updated in initialize)
    this.config = SMASignalProcessor.getDefaultConfig();
    this.processor = new SMASignalProcessor(this.config);
  }

  /**
   * Initialize the strategy with context
   */
  async initialize(context: StrategyContext): Promise<void> {
    const { config } = context;
    
    // Update config from context
    this.config = {
      fastPeriod: config.parameters.fastPeriod as number,
      slowPeriod: config.parameters.slowPeriod as number,
      priceSource: config.parameters.priceSource as 'close' | 'open' | 'high' | 'low',
      signalMode: config.parameters.signalMode as 'crossover' | 'trend' | 'combined',
      useEMA: config.parameters.useEMA as boolean,
      minChangePercent: config.parameters.minChangePercent as number,
      confidenceThreshold: config.parameters.confidenceThreshold as number
    };

    // Initialize processor with config
    this.processor = new SMASignalProcessor(this.config);
    
    // Update state
    this.state.isRunning = true;
    this.state.lastUpdate = new Date();
    
    // Log initialization
    context.logger.info(`SMA Crossover Strategy initialized for ${context.symbol}`, {
      fastPeriod: this.config.fastPeriod,
      slowPeriod: this.config.slowPeriod,
      signalMode: this.config.signalMode
    });
  }

  /**
   * Execute the strategy
   */
  async execute(context: StrategyContext): Promise<StrategyResult> {
    try {
      // Get candle data
      const timeframe = context.config.execution?.timeframe || '1h';
      const candles = await context.marketData.getCandles(context.symbol, timeframe, 100);
      
      if (!candles || candles.length < this.config.slowPeriod) {
        return {
          success: false,
          action: 'hold',
          reason: `Insufficient data: need at least ${this.config.slowPeriod} candles`,
          error: 'Insufficient data'
        };
      }
      
      // Process candles with SMA processor
      const signal = this.processor.process(candles);
      
      // No signal
      if (!signal || signal.signal === 0) {
        return {
          success: true,
          action: 'hold',
          reason: 'No signal detected',
          confidence: 0
        };
      }
      
      // Got a signal
      const action = signal.signal > 0 ? 'buy' : 'sell';
      
      // Check if signal meets confidence threshold
      if (signal.confidence < (context.config.execution?.minimumConfidence || 0.6)) {
        return {
          success: true,
          action: 'hold',
          confidence: signal.confidence,
          reason: `${action.toUpperCase()} signal detected but confidence below threshold`
        };
      }
      
      // Check current position
      const position = await context.tradeExecutor.getPosition(
        context.botConfig.id,
        context.symbol
      );
      
      // If we already have a position in the same direction, hold
      if (position) {
        const positionSide = position.side;
        if ((positionSide === 'long' && action === 'buy') || 
            (positionSide === 'short' && action === 'sell')) {
          return {
            success: true,
            action: 'hold',
            confidence: signal.confidence,
            reason: `Already have a ${positionSide} position`
          };
        }
        
        // If we have a position in the opposite direction, close it first
        await context.tradeExecutor.closePosition(context.botConfig.id, context.symbol);
        this.state.tradesExecuted++;
      }
      
      // Create trade signal
      const tradeSignal = this.processor.createTradeSignal(
        signal,
        context.botConfig.id,
        context.symbol
      );
      
      // Execute the trade
      const order = await context.tradeExecutor.executeSignal(tradeSignal, context.botConfig);
      
      // Update state
      this.state.tradesExecuted++;
      this.state.lastUpdate = new Date();
      
      // Log the signal
      context.logger.info(`SMA Crossover Signal: ${action.toUpperCase()}`, {
        symbol: context.symbol,
        confidence: signal.confidence,
        reason: signal.reason,
        fastMA: signal.fastMA,
        slowMA: signal.slowMA
      });
      
      // Emit event
      context.eventEmitter.emit('strategy:signal', {
        type: 'signal',
        botId: context.botConfig.id,
        symbol: context.symbol,
        strategy: this.name,
        signal: action,
        confidence: signal.confidence,
        timestamp: Date.now()
      });
      
      return {
        success: true,
        action,
        confidence: signal.confidence,
        reason: signal.reason,
        metadata: {
          fastMA: signal.fastMA,
          slowMA: signal.slowMA,
          lastPrice: signal.lastPrice,
          orderId: order.orderId
        }
      };
    } catch (error) {
      context.logger.error(`SMA Crossover Strategy error: ${error instanceof Error ? error.message : String(error)}`, {
        botId: context.botConfig.id,
        symbol: context.symbol
      });
      
      return {
        success: false,
        action: 'hold',
        error: error instanceof Error ? error.message : String(error),
        reason: 'Strategy execution failed'
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(context: StrategyContext): Promise<void> {
    // Nothing to clean up for this strategy
    this.state.isRunning = false;
    context.logger.info('SMA Crossover Strategy cleaned up');
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    try {
      const validation = SMACrossoverConfigSchema.safeParse(config);
      
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
        
        // Add warnings for unusual values
        if (data.fastPeriod < 5) {
          warnings.push({
            field: 'fastPeriod',
            message: 'Fast period is very short, may generate many false signals',
            suggestion: 'Consider using a value between 5 and 20'
          });
        }
        
        if (data.slowPeriod > 100) {
          warnings.push({
            field: 'slowPeriod',
            message: 'Slow period is very long, may generate signals too late',
            suggestion: 'Consider using a value between 20 and 100'
          });
        }
        
        if (data.confidenceThreshold < 0.5) {
          warnings.push({
            field: 'confidenceThreshold',
            message: 'Low confidence threshold may generate more false signals',
            suggestion: 'Consider using a value above 0.5 for better signal quality'
          });
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
      type: 'sma-crossover',
      parameters: {
        fastPeriod: 9,
        slowPeriod: 21,
        priceSource: 'close',
        signalMode: 'crossover',
        useEMA: false,
        minChangePercent: 0.5,
        confidenceThreshold: 0.6
      },
      riskManagement: {
        stopLossPercentage: 2,
        takeProfitPercentage: 4
      },
      execution: {
        timeframe: '1h',
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

export default SMACrossoverStrategy;
