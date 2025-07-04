/**
 * Bot Trading Cycle Integration Service
 * 
 * Orchestrates the complete bot trading cycle by integrating strategy execution,
 * signal processing, and trading engine coordination.
 */

import { EventEmitter } from 'events';

import type { StrategyExecutionConfig } from '../bots/strategy-execution-integration';
import { StrategyExecutionIntegration } from '../bots/strategy-execution-integration';
import logger from '../services/logging.service';
import { StrategyType } from '../strategies/strategy-factory';

import { SignalProcessingManager } from './signal-processing/signal-processing-manager';
import type { StandardSignal} from './signal-processing/signal-translator';
import { SignalSource } from './signal-processing/signal-translator';
import { SMASignalProcessor } from './signals/sma/sma-signal-processor';
import type { 
  StrategyContext, 
  BotConfig, 
  MarketDataProvider, 
  TradeExecutorProvider, 
  LoggerProvider, 
  StorageProvider, 
  EventEmitterProvider 
} from './target-reacher/interfaces';


/**
 * Bot Trading Cycle Configuration
 */
export interface BotTradingCycleConfig {
  // Strategy execution config
  strategyConfig: {
    maxActiveStrategies: number;
    performanceThreshold: number;
    enableHotSwapping: boolean;
    metricsCollectionInterval: number;
  };
  
  // Signal processing config
  signalConfig: {
    batchSize: number;
    maxSignalsPerMinute: number;
    minConfidence: number;
    minStrength: number;
    maxHighRiskSignals: number;
  };
  
  // Trading engine config
  tradingConfig: {
    enableRiskManagement: boolean;
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
  
  // General settings
  enableAutoStart: boolean;
  enableMonitoring: boolean;
  enableBackups: boolean;
}

/**
 * Bot Trading Cycle Status
 */
export interface BotTradingCycleStatus {
  isRunning: boolean;
  strategiesActive: number;
  signalsProcessed: number;
  ordersExecuted: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  lastActivity: number;
  uptime: number;
  errors: string[];
}

/**
 * Bot Trading Cycle Integration Service
 */
export class BotTradingCycleIntegration extends EventEmitter {
  private strategyExecution: StrategyExecutionIntegration;
  private signalProcessing: SignalProcessingManager;
  private smaProcessor: SMASignalProcessor;
  
  private config: BotTradingCycleConfig;
  private isInitialized = false;
  private isRunning = false;
  private startTime = 0;
  private errors: string[] = [];
  
  // Statistics
  private stats = {
    strategiesLoaded: 0,
    signalsProcessed: 0,
    ordersExecuted: 0,
    errorsEncountered: 0,
    lastActivity: 0
  };

  constructor(config?: Partial<BotTradingCycleConfig>) {
    super();
    
    this.config = {
      strategyConfig: {
        maxActiveStrategies: 5,
        performanceThreshold: 0.6,
        enableHotSwapping: true,
        metricsCollectionInterval: 30000
      },
      signalConfig: {
        batchSize: 10,
        maxSignalsPerMinute: 60,
        minConfidence: 0.3,
        minStrength: 0.2,
        maxHighRiskSignals: 5
      },
      tradingConfig: {
        enableRiskManagement: true,
        maxPositionSize: 1000,
        stopLossPercent: 5,
        takeProfitPercent: 10
      },
      enableAutoStart: false,
      enableMonitoring: true,
      enableBackups: true,
      ...config
    };

    this.signalProcessing = new SignalProcessingManager(this.config.signalConfig);
    this.smaProcessor = new SMASignalProcessor();
    
    // Initialize strategy execution with proper configuration
    const strategyExecutionConfig: StrategyExecutionConfig = {
      botId: 'default-bot',
      strategyType: 'sma-crossover',
      strategyConfig: {
        type: 'sma-crossover',
        parameters: {}
      },
      executionInterval: this.config.strategyConfig.metricsCollectionInterval || 30000,
      enableDynamicLoading: this.config.strategyConfig.enableHotSwapping || false,
      enablePerformanceTracking: true,
      maxExecutionTime: 30000,
      retryAttempts: 3
    };
    
    // Create a minimal strategy context
    const strategyContext: StrategyContext = {
      config: strategyExecutionConfig.strategyConfig,
      botConfig: {} as BotConfig, // Will be set later during initialization
      symbol: 'BTC/USDT',
      marketData: {} as MarketDataProvider, // Will be set later
      tradeExecutor: {} as TradeExecutorProvider, // Will be set later
      logger: {} as LoggerProvider, // Will be set later
      storage: {} as StorageProvider, // Will be set later
      eventEmitter: {} as EventEmitterProvider // Will be set later
    };
    
    this.strategyExecution = new StrategyExecutionIntegration(
      strategyExecutionConfig,
      strategyContext
    );
    
    logger.info('🚀 Bot Trading Cycle Integration initialized', {
      config: this.config
    });
  }

  /**
   * Set up event listeners for coordination
   */
  private setupEventListeners(): void {
    // Ensure strategy execution is initialized before setting up listeners
    if (!this.strategyExecution) {
      logger.error('❌ Cannot setup event listeners: strategy execution not initialized');
      return;
    }

    // Strategy execution events
    this.strategyExecution.on('strategy-loaded', (data) => {
      logger.info('📈 Strategy loaded in trading cycle', data);
      this.stats.strategiesLoaded++;
      this.stats.lastActivity = Date.now();
      this.emit('strategy-loaded', data);
    });

    this.strategyExecution.on('strategy-executed', (data) => {
      logger.debug('⚡ Strategy executed in trading cycle', data);
      this.stats.lastActivity = Date.now();
      
      // If strategy produces signals, process them through signal manager
      if (data.result && data.result.action && data.result.action !== 'hold') {
        const signal: StandardSignal = {
          id: `strategy-${data.strategyId}-${Date.now()}`,
          source: SignalSource.STRATEGY,
          action: data.result.action,
          confidence: data.result.confidence || 0.5,
          strength: data.result.confidence || 0.5,
          symbol: data.context?.symbol || 'UNKNOWN',
          timestamp: Date.now(),
          reason: data.result.reason || 'Strategy execution result',
          metadata: data.result.metadata || {},
          riskLevel: 'medium',
          urgency: 'medium'
        };
        
        this.signalProcessing.addSignal(signal, 3); // High priority for strategy signals
      }
      
      this.emit('strategy-executed', data);
    });

    this.strategyExecution.on('error', (error) => {
      logger.error('❌ Strategy execution error in trading cycle', error);
      this.errors.push(`Strategy: ${error.message || error}`);
      this.stats.errorsEncountered++;
      this.emit('error', { source: 'strategy', error });
    });

    // Signal processing events
    this.signalProcessing.on('signal-processed', (data) => {
      logger.debug('📡 Signal processed in trading cycle', {
        id: data.signal.id,
        source: data.signal.source,
        action: data.signal.action
      });
      this.stats.signalsProcessed++;
      this.stats.lastActivity = Date.now();
      this.emit('signal-processed', data);
    });

    this.signalProcessing.on('source-error', (error) => {
      logger.error('❌ Signal processing error in trading cycle', error);
      this.errors.push(`Signal: ${error.error || error}`);
      this.stats.errorsEncountered++;
      this.emit('error', { source: 'signal', error });
    });

    this.signalProcessing.on('batch-processed', (data) => {
      logger.debug('📊 Signal batch processed in trading cycle', data);
      this.emit('batch-processed', data);
    });
  }

  /**
   * Initialize the bot trading cycle
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔄 Initializing Bot Trading Cycle Integration...');

      if (this.isInitialized) {
        logger.warn('⚠️ Bot Trading Cycle already initialized');
        return;
      }

      // Initialize strategy execution
      await this.strategyExecution.initialize();
      logger.info('✅ Strategy execution initialized');

      // Initialize signal processing with SMA processor
      await this.signalProcessing.initialize({
        smaProcessor: this.smaProcessor,
        tradingEngine: {
          processAdvancedSignals: async (signals: StandardSignal[]) => {
            // Mock trading engine integration for now
            for (const signal of signals) {
              logger.info('🎯 Processing signal in trading engine', {
                id: signal.id,
                action: signal.action,
                symbol: signal.symbol,
                confidence: signal.confidence
              });
              this.stats.ordersExecuted++;
            }
            this.emit('orders-executed', { count: signals.length, signals });
          }
        }
      });
      logger.info('✅ Signal processing initialized');

      this.isInitialized = true;
      this.startTime = Date.now();

      this.emit('initialized', {
        timestamp: this.startTime,
        config: this.config
      });

      logger.info('🎯 Bot Trading Cycle Integration fully initialized');

      // Auto-start if configured
      if (this.config.enableAutoStart) {
        await this.start();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to initialize Bot Trading Cycle Integration', { error: errorMessage });
      this.errors.push(`Initialization: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Start the bot trading cycle
   */
  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Bot Trading Cycle not initialized. Call initialize() first.');
      }

      if (this.isRunning) {
        logger.warn('⚠️ Bot Trading Cycle already running');
        return;
      }

      logger.info('🚀 Starting Bot Trading Cycle...');

      // Load default strategies
      await this.loadDefaultStrategies();

      this.isRunning = true;
      this.stats.lastActivity = Date.now();

      this.emit('started', {
        timestamp: Date.now(),
        strategiesActive: this.stats.strategiesLoaded
      });

      logger.info('✅ Bot Trading Cycle started successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to start Bot Trading Cycle', { error: errorMessage });
      this.errors.push(`Start: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Stop the bot trading cycle
   */
  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        logger.warn('⚠️ Bot Trading Cycle not running');
        return;
      }

      logger.info('⏹️ Stopping Bot Trading Cycle...');

      // Stop signal processing
      this.signalProcessing.stop();

      // Stop strategy execution
      // Note: StrategyExecutionIntegration doesn't have a stop method yet
      // This would be implemented in a future enhancement

      this.isRunning = false;

      this.emit('stopped', {
        timestamp: Date.now(),
        uptime: Date.now() - this.startTime,
        stats: this.stats
      });

      logger.info('✅ Bot Trading Cycle stopped successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to stop Bot Trading Cycle', { error: errorMessage });
      this.errors.push(`Stop: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Load default trading strategies
   */
  private async loadDefaultStrategies(): Promise<void> {
    try {
      logger.info('📚 Loading default strategies...');

      // Load a basic SMA crossover strategy
      const smaStrategy = {
        type: 'sma-crossover',
        parameters: {
          fastPeriod: 9,
          slowPeriod: 21,
          confidenceThreshold: 0.6
        }
      };

      await this.strategyExecution.loadStrategy('sma-crossover', smaStrategy);
      logger.info('✅ Default SMA strategy loaded');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('⚠️ Failed to load default strategies', { error: errorMessage });
      // Don't throw here as it's not critical for operation
    }
  }

  /**
   * Process market data through SMA and generate signals
   */
  async processMarketData(symbol: string, candles: any[]): Promise<void> {
    try {
      if (!this.isRunning) {
        logger.warn('⚠️ Bot Trading Cycle not running, ignoring market data');
        return;
      }

      logger.debug('📊 Processing market data', { symbol, candleCount: candles.length });

      // Process through SMA signal processor
      await this.signalProcessing.processSMASignals(candles, symbol);

      this.stats.lastActivity = Date.now();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to process market data', { error: errorMessage, symbol });
      this.errors.push(`Market data: ${errorMessage}`);
    }
  }

  /**
   * Execute strategy manually
   */
  async executeStrategy(botId: string, strategyId: string, context: any): Promise<any> {
    try {
      if (!this.isRunning) {
        throw new Error('Bot Trading Cycle not running');
      }

      logger.info('🎯 Executing strategy manually', { botId, strategyId });

      const result = await this.strategyExecution.executeStrategy();
      this.stats.lastActivity = Date.now();

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to execute strategy', { error: errorMessage, botId, strategyId });
      this.errors.push(`Strategy execution: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get trading cycle status
   */
  getStatus(): BotTradingCycleStatus {
    const now = Date.now();
    const timeSinceLastActivity = now - this.stats.lastActivity;
    
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (!this.isRunning) {
      healthStatus = 'critical';
    } else if (this.errors.length > 5) {
      healthStatus = 'critical';
    } else if (timeSinceLastActivity > 300000 || this.errors.length > 2) { // 5 minutes
      healthStatus = 'warning';
    }

    return {
      isRunning: this.isRunning,
      strategiesActive: this.stats.strategiesLoaded,
      signalsProcessed: this.stats.signalsProcessed,
      ordersExecuted: this.stats.ordersExecuted,
      healthStatus,
      lastActivity: this.stats.lastActivity,
      uptime: this.isRunning ? now - this.startTime : 0,
      errors: [...this.errors] // Copy to prevent external modification
    };
  }

  /**
   * Get detailed statistics
   */
  getStatistics(): any {
    return {
      ...this.stats,
      signalProcessingStats: this.signalProcessing.getStats(),
      queueStatus: this.signalProcessing.getQueueStatus(),
      strategyExecutionMetrics: this.strategyExecution.getPerformanceMetrics(),
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      errorCount: this.errors.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BotTradingCycleConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update sub-component configs
    if (newConfig.signalConfig) {
      this.signalProcessing.updateConfig(newConfig.signalConfig);
    }
    
    logger.info('⚙️ Bot Trading Cycle configuration updated', { config: this.config });
    this.emit('config-updated', this.config);
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.errors = [];
    this.stats.errorsEncountered = 0;
    logger.info('🗑️ Bot Trading Cycle errors cleared');
    this.emit('errors-cleared');
  }

  /**
   * Get health check information
   */
  getHealthCheck(): {
    overall: 'healthy' | 'warning' | 'critical';
    components: Record<string, any>;
    recommendations: string[];
  } {
    const strategyMetrics = this.strategyExecution.getPerformanceMetrics();
    const signalHealth = this.signalProcessing.getHealthStatus();
    const status = this.getStatus();

    const components = {
      strategyExecution: strategyMetrics,
      signalProcessing: signalHealth,
      tradingCycle: {
        healthy: status.healthStatus === 'healthy',
        running: this.isRunning,
        initialized: this.isInitialized,
        uptime: status.uptime,
        errors: this.errors.length
      }
    };

    const recommendations: string[] = [];
    
    if (!this.isRunning) {
      recommendations.push('Start the bot trading cycle');
    }
    
    if (this.errors.length > 0) {
      recommendations.push('Review and address recent errors');
    }
    
    if (strategyMetrics.errorCount > 0) {
      recommendations.push('Check strategy execution health');
    }
    
    if (!signalHealth.healthy) {
      recommendations.push('Check signal processing health');
    }

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (!this.isRunning || strategyMetrics.errorCount > 0 || !signalHealth.healthy) {
      overall = 'critical';
    } else if (this.errors.length > 2 || status.healthStatus !== 'healthy') {
      overall = 'warning';
    }

    return {
      overall,
      components,
      recommendations
    };
  }
}

/**
 * Default bot trading cycle integration instance
 */
export const botTradingCycleIntegration = new BotTradingCycleIntegration();
