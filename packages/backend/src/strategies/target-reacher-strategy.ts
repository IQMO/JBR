/**
 * Target Reacher Strategy Plugin
 * 
 * Trading strategy that targets specific price levels using fixed prices or 
 * moving averages. Integrates the existing Target Reacher implementation 
 * with the strategy framework.
 */

import type { 
  IStrategy,
  StrategyContext, 
  StrategyConfig, 
  StrategyState
} from '../JabbrLabs/target-reacher/interfaces';
import { TargetReacherStrategy as CoreTargetReacher } from '../JabbrLabs/target-reacher/target-reacher';
import logger from '../services/logging.service';

/**
 * Target Reacher Strategy Plugin Metadata
 */
export const TargetReacherStrategyMetadata = {
  id: 'target-reacher',
  name: 'Target Reacher',
  version: '2.0.0',
  description: 'Price targeting strategy with fixed and average price sources',
  author: 'JabbrLabs',
  category: 'price-targeting',
  tags: ['price-target', 'average', 'fixed-price', 'beginner'],
  riskLevel: 'medium',
  supportedMarkets: ['spot', 'futures', 'margin'],
  requiredCapital: 100, // Minimum capital requirement
  maxDrawdown: 10, // Maximum expected drawdown percentage
  expectedReturn: 15, // Expected annual return percentage
  timeframe: ['1m', '5m', '15m', '1h', '4h'],
  dependencies: ['market-data', 'order-execution'],
  configSchema: {
    type: 'object',
    properties: {
      priceSource: { 
        type: 'string', 
        enum: ['fixed', 'average'], 
        default: 'fixed',
        description: 'Source for target price calculation'
      },
      fixedPrice: { 
        type: 'number', 
        minimum: 0.01, 
        default: 50000,
        description: 'Fixed target price (used when priceSource is "fixed")'
      },
      averagePeriod: { 
        type: 'integer', 
        minimum: 1, 
        maximum: 500, 
        default: 20,
        description: 'Period for average calculation (used when priceSource is "average")'
      },
      averageType: { 
        type: 'string', 
        enum: ['open', 'high', 'low', 'close'], 
        default: 'close',
        description: 'Price type for average calculation'
      },
      confidenceThreshold: { 
        type: 'number', 
        minimum: 0.1, 
        maximum: 1.0, 
        default: 0.8,
        description: 'Minimum confidence level for signal execution'
      }
    }
  }
} as const;

/**
 * Target Reacher Strategy Implementation
 */
export class TargetReacherStrategy implements IStrategy {
  // Strategy metadata
  readonly name = TargetReacherStrategyMetadata.name;
  readonly version = TargetReacherStrategyMetadata.version;
  readonly description = TargetReacherStrategyMetadata.description;
  readonly supportedMarkets = TargetReacherStrategyMetadata.supportedMarkets;

  // Static metadata for plugin system
  static readonly metadata = TargetReacherStrategyMetadata;

  // Internal components
  private coreStrategy: CoreTargetReacher;
  private state: StrategyState;
  private config: StrategyConfig;

  constructor(config?: StrategyConfig) {
    this.config = config || this.getDefaultConfig();
    
    // We'll initialize the core strategy later in the initialize method
    // since we need the actual context
    this.coreStrategy = null as any; // Temporary, will be set in initialize()

    // Initialize state
    this.state = {
      isRunning: false,
      totalProfit: 0,
      tradesExecuted: 0,
      lastUpdate: new Date(),
      customState: {
        targetPrice: null,
        lastSignal: null,
        priceHistory: [],
        signalHistory: []
      }
    };
  }

  /**
   * Initialize the strategy
   */
  async initialize(context: StrategyContext): Promise<void> {
    try {
      logger.info(`Initializing Target Reacher Strategy for bot ${context.botConfig.id}`, {
        symbol: context.symbol,
        config: this.config.parameters
      });

      // Now we can initialize the core strategy with the actual context
      this.coreStrategy = new CoreTargetReacher(this.config, context);
      await this.coreStrategy.initialize();
      
      this.state.isRunning = true;
      this.state.lastUpdate = new Date();
      
      logger.info(`Target Reacher Strategy initialized successfully for ${context.symbol}`);
    } catch (error) {
      logger.error(`Failed to initialize Target Reacher Strategy: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Execute the strategy logic and return a trading signal
   */
  async execute(context: StrategyContext): Promise<any> {
    try {
      // Execute the core strategy
      const result = await this.coreStrategy.execute();

      // Update state
      this.state.lastUpdate = new Date();
      if (this.state.customState) {
        this.state.customState.lastSignal = result;
        if (Array.isArray(this.state.customState.signalHistory)) {
          this.state.customState.signalHistory.push({
            action: result.action,
            reason: result.reason,
            timestamp: new Date()
          });
          
          // Keep only last 10 signals
          if (this.state.customState.signalHistory.length > 10) {
            this.state.customState.signalHistory.shift();
          }
        }
      }

      // Check confidence threshold
      const confidenceThreshold = (this.config.parameters.confidenceThreshold as number) || 0.8;
      const confidence = result.confidence || 1.0;

      if (confidence < confidenceThreshold) {
        return {
          success: true,
          action: 'hold',
          confidence,
          reason: `Signal confidence ${confidence.toFixed(2)} below threshold ${confidenceThreshold}`
        };
      }

      logger.debug(`Target Reacher Strategy signal: ${result.action}`, {
        botId: context.botConfig.id,
        symbol: context.symbol,
        confidence,
        reason: result.reason
      });

      return {
        success: result.success,
        action: result.action,
        confidence,
        reason: result.reason,
        metadata: {
          targetPrice: this.state.customState?.targetPrice,
          priceSource: this.config.parameters.priceSource,
          coreResult: result
        }
      };
    } catch (error) {
      logger.error(`Target Reacher Strategy execution failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        action: 'hold',
        confidence: 0,
        reason: `Strategy execution error: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Cleanup any resources used by the strategy
   */
  async cleanup(): Promise<void> {
    try {
      await this.coreStrategy.cleanup();
      this.state.isRunning = false;
      logger.info('Target Reacher Strategy cleaned up successfully');
    } catch (error) {
      logger.error(`Failed to cleanup Target Reacher Strategy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate the strategy configuration
   */
  validateConfig(config: Record<string, unknown>): any {
    const errors: Array<{field: string; message: string; code: string}> = [];
    const warnings: Array<{field: string; message: string; suggestion?: string}> = [];

    // Validate required parameters
    if (!config.parameters || typeof config.parameters !== 'object') {
      errors.push({
        field: 'parameters',
        message: 'Parameters object is required',
        code: 'MISSING_PARAMETERS'
      });
      return { valid: false, errors, warnings };
    }

    const params = config.parameters as Record<string, unknown>;

    // Validate price source
    if (!params.priceSource || !['fixed', 'average'].includes(params.priceSource as string)) {
      errors.push({
        field: 'priceSource',
        message: 'Price source must be either "fixed" or "average"',
        code: 'INVALID_PRICE_SOURCE'
      });
    }

    // Validate fixed price if using fixed source
    if (params.priceSource === 'fixed') {
      if (typeof params.fixedPrice !== 'number' || params.fixedPrice <= 0) {
        errors.push({
          field: 'fixedPrice',
          message: 'Fixed price must be a positive number',
          code: 'INVALID_FIXED_PRICE'
        });
      }
    }

    // Validate average parameters if using average source
    if (params.priceSource === 'average') {
      if (typeof params.averagePeriod !== 'number' || params.averagePeriod < 1 || params.averagePeriod > 500) {
        errors.push({
          field: 'averagePeriod',
          message: 'Average period must be between 1 and 500',
          code: 'INVALID_AVERAGE_PERIOD'
        });
      }

      if (!params.averageType || !['open', 'high', 'low', 'close'].includes(params.averageType as string)) {
        errors.push({
          field: 'averageType',
          message: 'Average type must be one of: open, high, low, close',
          code: 'INVALID_AVERAGE_TYPE'
        });
      }
    }

    // Validate confidence threshold
    if (typeof params.confidenceThreshold === 'number') {
      if (params.confidenceThreshold < 0.1 || params.confidenceThreshold > 1.0) {
        warnings.push({
          field: 'confidenceThreshold',
          message: 'Confidence threshold should be between 0.1 and 1.0',
          suggestion: 'Consider using a value between 0.7 and 0.9 for optimal performance'
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get the default configuration for the strategy
   */
  getDefaultConfig(): StrategyConfig {
    return {
      type: 'target-reacher',
      parameters: {
        priceSource: 'fixed',
        fixedPrice: 50000,
        averagePeriod: 20,
        averageType: 'close',
        confidenceThreshold: 0.8
      },
      riskManagement: {
        stopLossPercentage: 5,
        takeProfitPercentage: 10,
        maxPositionSize: 10,
        maxDailyLoss: 20
      },
      execution: {
        timeframe: '1h',
        maxTrades: 10,
        minimumConfidence: 0.8,
        executionDelay: 1000
      }
    };
  }

  /**
   * Get the current state of the strategy
   */
  getState(): StrategyState {
    return this.state;
  }

  /**
   * Set the state of the strategy
   */
  setState(state: Partial<StrategyState>): void {
    this.state = { ...this.state, ...state };
  }
} 