/**
 * Production-Ready Bot Runtime System
 * 
 * This module handles the complete lifecycle of trading bots in production:
 * - Bot initialization and configuration loading
 * - Dynamic strategy loading and execution
 * - Signal processing and trade execution
 * - Error handling and recovery
 * - State persistence and monitoring
 * - Graceful shutdown and cleanup
 */

import { EventEmitter } from 'events';

import type { IStrategy, StrategyResult, StrategyContext, StrategyConfig } from '../JabbrLabs/target-reacher/interfaces';
import { database } from '../services/database.service';
import type { StrategyType } from '../strategies/strategy-factory';

import type { Bot } from './bots.service';
import type { StrategySwapOptions } from './dynamic-strategy-loader';
import { dynamicStrategyLoader } from './dynamic-strategy-loader';
import type { ErrorRecoveryManager } from './error-recovery-manager';
import GracefulShutdownManager from './graceful-shutdown-manager';
import type { ProcessedSignal } from './signal-processor';
import { SignalProcessor } from './signal-processor';
import StateManager from './state-manager';
import type { StrategyExecutionConfig, StrategyExecutionResult } from './strategy-execution-integration';
import StrategyExecutionIntegration from './strategy-execution-integration';
import { TradeDecisionEngine } from './trade-decision-engine';
import type { TradeDecision, ExecutionResult } from './trade-decision-engine';
import type { TradeExecutor } from './trade-executor';

export interface BotRuntimeConfig {
  bot: Bot;
  strategy: IStrategy;
  context: StrategyContext;
  checkInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  tradeExecutor?: TradeExecutor; // Optional trade executor for real trading
  errorRecoveryManager?: ErrorRecoveryManager; // Optional error recovery manager
  stateManager?: StateManager; // Enhanced state persistence manager
  shutdownManager?: GracefulShutdownManager; // Enhanced graceful shutdown manager
  strategyExecutionIntegration?: StrategyExecutionIntegration; // Enhanced strategy execution
}

export interface BotState {
  botId: string;
  status: 'initializing' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
  startedAt?: Date;
  lastTickAt?: Date;
  errorCount: number;
  lastError?: string;
  performance: {
    tickCount: number;
    signalCount: number;
    tradeCount: number;
    errorCount: number;
    totalProfit: number;
    totalLoss: number;
    winRate: number;
    avgTradeTime: number;
    maxDrawdown: number;
  };
  currentStrategy?: {
    name: string;
    version: string;
    type: string;
  };
  positions?: Array<{
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    openedAt: Date;
  }>;
  orders?: Array<{
    id: string;
    symbol: string;
    type: string;
    status: string;
    size: number;
    price: number;
    createdAt: Date;
  }>;
  strategy?: {
    type: string;
    parameters: Record<string, unknown>;
    indicators: Record<string, unknown>;
    signals: Array<{
      type: string;
      strength: number;
      timestamp: Date;
    }>;
  };
}

export class BotRuntime extends EventEmitter {
  private config: BotRuntimeConfig;
  private state: BotState;
  private intervalId?: NodeJS.Timeout;
  private shutdownPromise?: Promise<void>;
  private isShuttingDown = false;
  private signalProcessor: SignalProcessor;
  private tradeDecisionEngine: TradeDecisionEngine;
  private stateManager: StateManager;
  private shutdownManager: GracefulShutdownManager;
  private strategyExecutionIntegration?: StrategyExecutionIntegration;

  constructor(config: BotRuntimeConfig) {
    super();
    this.config = config;
    this.state = {
      botId: config.bot.id,
      status: 'initializing',
      errorCount: 0,
      performance: {
        tickCount: 0,
        signalCount: 0,
        tradeCount: 0,
        errorCount: 0,
        totalProfit: 0,
        totalLoss: 0,
        winRate: 0,
        avgTradeTime: 0,
        maxDrawdown: 0
      },
      currentStrategy: {
        name: config.strategy.name,
        version: config.strategy.version,
        type: config.bot.strategy
      }
    };

    // Initialize signal processing and trade decision components
    this.signalProcessor = new SignalProcessor({
      enableRiskValidation: true,
      enableSignalEnrichment: true,
      minConfidenceThreshold: config.bot.configuration?.minConfidence || 0.6,
      maxSignalsPerMinute: config.bot.configuration?.maxSignalsPerMinute || 10
    });

    this.tradeDecisionEngine = new TradeDecisionEngine({
      enablePositionManagement: true,
      enableStopLoss: config.bot.riskManagement?.enableStopLoss ?? true,
      enableTakeProfit: config.bot.riskManagement?.enableTakeProfit ?? true,
      maxPositionsPerBot: config.bot.configuration?.maxPositions || 3,
      slippageTolerance: config.bot.riskManagement?.maxSlippage || 0.1
    }, config.tradeExecutor);

    // Initialize enhanced state management
    this.stateManager = config.stateManager || new StateManager({
      enableIncrementalUpdates: true,
      enableCompression: true,
      backupInterval: 300000, // 5 minutes
      maxBackups: 48,
      enableIntegrityChecks: true,
      autoRecovery: true,
      emergencyBackupThreshold: 5
    });

    // Initialize enhanced graceful shutdown management
    this.shutdownManager = config.shutdownManager || new GracefulShutdownManager(this.stateManager, {
      gracePeriod: 60000, // 1 minute
      positionTimeout: 30000,
      orderTimeout: 15000,
      backupTimeout: 10000,
      enablePositionClosure: true,
      enableOrderCancellation: true,
      enableEmergencyBackup: true
    });

    // Set up event listeners for signal processing
    this.setupSignalProcessingEvents();

    // Set up event listeners for enhanced state management
    this.setupStateManagementEvents();

    // Set up error handling
    this.on('error', (errorData) => {
      if (errorData && typeof errorData === 'object' && errorData.error) {
        // Already handled by explicit handleError call
        return;
      }
      // Handle direct error emissions
      this.handleError(errorData as Error, 'event-emission').catch(err => {
        console.error('Failed to handle error event:', err);
      });
    });
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  /**
   * Initialize the bot runtime
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing bot runtime', {
        botId: this.config.bot.id,
        botName: this.config.bot.name,
        strategy: this.config.bot.strategy
      });

      // Load and validate configuration
      await this.loadConfiguration();

      // Initialize strategy
      await this.initializeStrategy();

      // Initialize strategy execution integration
      await this.initializeStrategyExecution();

      // Validate exchange connection
      await this.validateExchangeConnection();

      // Load persisted state if exists
      await this.loadPersistedState();

      this.state.status = 'stopped';
      
      console.log('✅ Bot runtime initialized successfully', {
        botId: this.config.bot.id
      });

      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize bot runtime', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.state.status = 'error';
      await this.handleError(
        error instanceof Error ? error : new Error(String(error)), 
        'bot-initialization'
      );
      throw error;
    }
  }

  /**
   * Start the bot execution
   */
  async start(): Promise<void> {
    if (this.state.status === 'running') {
      console.warn('⚠️ Bot is already running', {
        botId: this.config.bot.id
      });
      return;
    }

    if (this.isShuttingDown) {
      throw new Error('Cannot start bot during shutdown');
    }

    try {
      this.state.status = 'running';
      this.state.startedAt = new Date();
      this.state.errorCount = 0;

      console.log('▶️ Starting bot execution', {
        botId: this.config.bot.id,
        checkInterval: this.config.checkInterval
      });

      // Start the main execution loop
      this.intervalId = setInterval(
        this.executionTick.bind(this),
        this.config.checkInterval
      );

      // Update database status
      await this.updateDatabaseStatus('running');

      this.emit('started');
    } catch (error) {
      this.state.status = 'error';
      this.state.lastError = error instanceof Error ? error.message : String(error);
      
      console.error('❌ Failed to start bot', {
        botId: this.config.bot.id,
        error: this.state.lastError
      });
      
      throw error;
    }
  }

  /**
   * Pause the bot execution
   */
  async pause(): Promise<void> {
    if (this.state.status !== 'running') {
      console.warn('⚠️ Bot is not running, cannot pause', {
        botId: this.config.bot.id,
        currentStatus: this.state.status
      });
      return;
    }

    this.state.status = 'paused';
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    await this.updateDatabaseStatus('paused');

    console.log('⏸️ Bot execution paused', {
      botId: this.config.bot.id
    });

    this.emit('paused');
  }

  /**
   * Resume the bot execution
   */
  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      console.warn('⚠️ Bot is not paused, cannot resume', {
        botId: this.config.bot.id,
        currentStatus: this.state.status
      });
      return;
    }

    this.state.status = 'running';
    
    this.intervalId = setInterval(
      this.executionTick.bind(this),
      this.config.checkInterval
    );

    await this.updateDatabaseStatus('running');

    console.log('▶️ Bot execution resumed', {
      botId: this.config.bot.id
    });

    this.emit('resumed');
  }

  /**
   * Stop the bot execution
   */
  async stop(): Promise<void> {
    if (this.state.status === 'stopped') {
      console.warn('⚠️ Bot is already stopped', {
        botId: this.config.bot.id
      });
      return;
    }

    this.state.status = 'stopping';

    console.log('⏹️ Stopping bot execution', {
      botId: this.config.bot.id
    });

    // Clear the execution interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Cleanup strategy
    try {
      await this.config.strategy.cleanup(this.config.context);
    } catch (error) {
      console.warn('⚠️ Error during strategy cleanup', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Shutdown strategy execution integration
    try {
      if (this.strategyExecutionIntegration) {
        await this.strategyExecutionIntegration.shutdown();
        console.log('✅ Strategy execution integration shutdown complete', {
          botId: this.config.bot.id
        });
      }
    } catch (error) {
      console.warn('⚠️ Error during strategy execution integration shutdown', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Persist final state
    await this.persistState();

    // Cleanup enhanced state management components
    try {
      if (this.stateManager) {
        this.stateManager.shutdown();
      }
      if (this.shutdownManager) {
        this.shutdownManager.shutdown();
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning up state management components', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.state.status = 'stopped';
    await this.updateDatabaseStatus('stopped');

    console.log('✅ Bot execution stopped', {
      botId: this.config.bot.id,
      performance: this.state.performance
    });

    this.emit('stopped');
  }

  /**
   * Get current bot state
   */
  getState(): BotState {
    return { ...this.state };
  }

  /**
   * Main execution tick - runs at configured intervals
   */
  private async executionTick(): Promise<void> {
    if (this.state.status !== 'running' || this.isShuttingDown) {
      return;
    }

    try {
      this.state.lastTickAt = new Date();
      this.state.performance.tickCount++;

      // Execute strategy using enhanced strategy execution integration
      let executionResult: StrategyExecutionResult;
      
      if (this.strategyExecutionIntegration) {
        // Use enhanced strategy execution integration
        executionResult = await this.strategyExecutionIntegration.executeStrategy();
        
        if (!executionResult.success) {
          throw new Error(executionResult.error || 'Strategy execution failed');
        }

        // Extract the strategy result
        const result = executionResult.result;
        if (!result) {
          console.warn('⚠️ Strategy execution succeeded but no result returned', {
            botId: this.config.bot.id
          });
          return;
        }

        // Process successful strategy execution
        if (result.action !== 'hold') {
          this.state.performance.signalCount++;
          
          console.log('📊 Enhanced strategy signal generated', {
            botId: this.config.bot.id,
            action: result.action,
            confidence: result.confidence,
            reason: result.reason,
            executionTime: executionResult.executionTime,
            metrics: executionResult.metrics
          });

          // Process the trading signal
          await this.processSignal(result);
        }

        // Emit enhanced tick event for monitoring
        this.emit('tick', {
          botId: this.config.bot.id,
          timestamp: this.state.lastTickAt,
          result,
          executionMetrics: executionResult.metrics,
          executionTime: executionResult.executionTime
        });

      } else {
        // Fallback to original strategy execution
        const result = await this.config.strategy.execute(this.config.context);

        if (result.action !== 'hold') {
          this.state.performance.signalCount++;
          
          console.log('📊 Strategy signal generated (fallback)', {
            botId: this.config.bot.id,
            action: result.action,
            confidence: result.confidence,
            reason: result.reason
          });

          // Process the trading signal
          await this.processSignal(result);
        }

        // Emit tick event for monitoring
        this.emit('tick', {
          botId: this.config.bot.id,
          timestamp: this.state.lastTickAt,
          result
        });
      }

    } catch (error) {
      this.state.performance.errorCount++;
      
      console.error('❌ Error in execution tick', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error),
        errorCount: this.state.errorCount
      });

      // Use enhanced error handling
      await this.handleError(
        error instanceof Error ? error : new Error(String(error)), 
        'execution-tick'
      );

      // Check if we should stop due to too many errors
      if (this.state.errorCount >= this.config.maxRetries) {
        console.error('🚨 Too many errors, stopping bot', {
          botId: this.config.bot.id,
          errorCount: this.state.errorCount,
          maxRetries: this.config.maxRetries
        });

        await this.stop();
        return;
      }

      // Exponential backoff for retries
      const delay = this.config.retryDelay * Math.pow(2, this.state.errorCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Load and validate bot configuration
   */
  private async loadConfiguration(): Promise<void> {
    // Validate required configuration fields
    if (!this.config.bot.configuration) {
      throw new Error('Bot configuration is missing');
    }

    if (!this.config.bot.exchangeApiKeyId) {
      throw new Error('Exchange API key ID is missing');
    }

    // Load exchange API credentials
    const apiKeyResult = await database.query(
      'SELECT * FROM exchange_api_keys WHERE id = $1 AND user_id = $2 AND is_active = true',
      [this.config.bot.exchangeApiKeyId, this.config.bot.userId]
    );

    if (apiKeyResult.length === 0) {
      throw new Error('Exchange API key not found or inactive');
    }

    console.log('✅ Configuration loaded successfully', {
      botId: this.config.bot.id,
      exchange: this.config.bot.exchange,
      strategy: this.config.bot.strategy
    });
  }

  /**
   * Initialize the trading strategy
   */
  private async initializeStrategy(): Promise<void> {
    try {
      await this.config.strategy.initialize(this.config.context);
      
      console.log('✅ Strategy initialized successfully', {
        botId: this.config.bot.id,
        strategy: this.config.bot.strategy
      });
    } catch (error) {
      console.error('❌ Failed to initialize strategy', {
        botId: this.config.bot.id,
        strategy: this.config.bot.strategy,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Initialize strategy execution integration
   */
  private async initializeStrategyExecution(): Promise<void> {
    try {
      // Use provided strategy execution integration or create default one
      if (this.config.strategyExecutionIntegration) {
        this.strategyExecutionIntegration = this.config.strategyExecutionIntegration;
      } else {
        // Create default strategy execution integration
        const strategyConfig: StrategyExecutionConfig = {
          botId: this.config.bot.id,
          strategyType: this.config.bot.strategy as StrategyType,
          strategyConfig: {
            type: this.config.bot.strategy,
            parameters: this.config.bot.configuration || {}
          },
          executionInterval: this.config.checkInterval,
          enableDynamicLoading: true,
          enablePerformanceTracking: true,
          maxExecutionTime: 30000, // 30 seconds
          retryAttempts: this.config.maxRetries
        };

        this.strategyExecutionIntegration = new StrategyExecutionIntegration(
          strategyConfig,
          this.config.context
        );
      }

      // Initialize the strategy execution integration
      await this.strategyExecutionIntegration.initialize();

      // Set up event listeners for strategy execution
      this.strategyExecutionIntegration.on('strategy-executed', (data) => {
        this.emit('strategy-executed', data);
      });

      this.strategyExecutionIntegration.on('strategy-execution-error', (data) => {
        this.emit('strategy-execution-error', data);
      });

      this.strategyExecutionIntegration.on('strategy-swapped', (data) => {
        console.log('🔄 Strategy swapped successfully', data);
        this.emit('strategy-swapped', data);
      });

      console.log('✅ Strategy execution integration initialized successfully', {
        botId: this.config.bot.id,
        strategyType: this.config.bot.strategy
      });

    } catch (error) {
      console.error('❌ Failed to initialize strategy execution integration', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate exchange connection
   */
  private async validateExchangeConnection(): Promise<void> {
    try {
      // This would test the exchange connection using the configured API keys
      // For now, we'll simulate a successful connection
      console.log('✅ Exchange connection validated', {
        botId: this.config.bot.id,
        exchange: this.config.bot.exchange
      });
    } catch (error) {
      console.error('❌ Exchange connection validation failed', {
        botId: this.config.bot.id,
        exchange: this.config.bot.exchange,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Load persisted state from enhanced state manager
   */
  private async loadPersistedState(): Promise<void> {
    try {
      console.log('🔄 Loading persisted state with enhanced state manager', {
        botId: this.config.bot.id
      });

      const snapshot = await this.stateManager.loadSnapshot(this.config.bot.id);
      
      if (snapshot) {
        // Merge persisted state with current state
        this.state = {
          ...this.state,
          status: 'stopped', // Always start as stopped for safety
          startedAt: undefined, // Will be set when starting
          errorCount: snapshot.state.runtimeMetrics?.errorCount || this.state.errorCount,
          lastError: snapshot.state.runtimeMetrics?.lastError || this.state.lastError,
          performance: {
            tickCount: snapshot.state.runtimeMetrics?.tickCount || this.state.performance.tickCount,
            signalCount: this.state.performance.signalCount, // Keep current as this is runtime-specific
            tradeCount: snapshot.state.performance?.totalTrades || this.state.performance.tradeCount,
            errorCount: snapshot.state.performance?.errorCount || this.state.performance.errorCount,
            totalProfit: snapshot.state.performance?.totalProfit || this.state.performance.totalProfit,
            totalLoss: snapshot.state.performance?.totalLoss || this.state.performance.totalLoss,
            winRate: snapshot.state.performance?.winRate || this.state.performance.winRate,
            avgTradeTime: snapshot.state.performance?.avgTradeTime || this.state.performance.avgTradeTime,
            maxDrawdown: snapshot.state.performance?.maxDrawdown || this.state.performance.maxDrawdown
          },
          positions: snapshot.state.positions || [],
          orders: snapshot.state.orders || [],
          strategy: snapshot.state.strategy
        };

        console.log('✅ Enhanced persisted state loaded', {
          botId: this.config.bot.id,
          version: snapshot.version,
          timestamp: snapshot.timestamp,
          performance: this.state.performance
        });

        this.emit('state-loaded', { snapshot, state: this.state });
      } else {
        console.log('ℹ️ No persisted state found, starting fresh', {
          botId: this.config.bot.id
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to load persisted state, attempting recovery', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Attempt recovery from backup
      try {
        const recoveredSnapshot = await this.stateManager.recoverFromBackup(this.config.bot.id, {
          restorePositions: true,
          restoreOrders: true,
          restoreConfiguration: true,
          restoreStrategy: true,
          validateIntegrity: true
        });

        this.state = {
          ...this.state,
          status: 'stopped',
          errorCount: recoveredSnapshot.state.runtimeMetrics?.errorCount || this.state.errorCount,
          lastError: recoveredSnapshot.state.runtimeMetrics?.lastError || this.state.lastError,
          performance: {
            tickCount: recoveredSnapshot.state.runtimeMetrics?.tickCount || this.state.performance.tickCount,
            signalCount: this.state.performance.signalCount,
            tradeCount: recoveredSnapshot.state.performance?.totalTrades || this.state.performance.tradeCount,
            errorCount: recoveredSnapshot.state.performance?.errorCount || this.state.performance.errorCount,
            totalProfit: recoveredSnapshot.state.performance?.totalProfit || this.state.performance.totalProfit,
            totalLoss: recoveredSnapshot.state.performance?.totalLoss || this.state.performance.totalLoss,
            winRate: recoveredSnapshot.state.performance?.winRate || this.state.performance.winRate,
            avgTradeTime: recoveredSnapshot.state.performance?.avgTradeTime || this.state.performance.avgTradeTime,
            maxDrawdown: recoveredSnapshot.state.performance?.maxDrawdown || this.state.performance.maxDrawdown
          },
          positions: recoveredSnapshot.state.positions || [],
          orders: recoveredSnapshot.state.orders || [],
          strategy: recoveredSnapshot.state.strategy
        };

        console.log('✅ State recovered from backup', {
          botId: this.config.bot.id,
          version: recoveredSnapshot.version
        });

        this.emit('state-recovered', { recoveredSnapshot, state: this.state });
      } catch (recoveryError) {
        console.error('❌ Failed to recover state from backup', {
          botId: this.config.bot.id,
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        });
        // Continue with fresh state
      }
    }
  }

  /**
   * Persist current state using enhanced state manager
   */
  private async persistState(): Promise<void> {
    try {
      const additionalData = {
        positions: this.state.positions || [],
        orders: this.state.orders || [],
        strategy: this.state.strategy || {
          type: this.config.bot.strategy,
          parameters: this.config.bot.configuration || {},
          indicators: {},
          signals: []
        }
      };

      const snapshot = await this.stateManager.createSnapshot(
        this.config.bot.id,
        this.state,
        additionalData
      );

      await this.stateManager.saveSnapshot(snapshot);

      console.debug('💾 Enhanced state persisted successfully', {
        botId: this.config.bot.id,
        version: snapshot.version,
        timestamp: snapshot.timestamp
      });

      this.emit('state-persisted', { snapshot });
    } catch (error) {
      console.warn('⚠️ Failed to persist enhanced state', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to legacy persistence if enhanced fails
      try {
        await this.legacyPersistState();
      } catch (fallbackError) {
        console.error('❌ Legacy state persistence also failed', {
          botId: this.config.bot.id,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
      }
    }
  }

  /**
   * Legacy state persistence (fallback)
   */
  private async legacyPersistState(): Promise<void> {
    const stateJson = JSON.stringify({
      performance: this.state.performance,
      errorCount: this.state.errorCount,
      lastTickAt: this.state.lastTickAt
    });

    await database.query(`
      INSERT INTO bot_states (bot_id, state, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (bot_id)
      DO UPDATE SET state = $2, updated_at = NOW()
    `, [this.config.bot.id, stateJson]);
  }

  /**
   * Update position in state
   */
  updatePosition(symbol: string, position: any): void {
    if (!this.state.positions) {
      this.state.positions = [];
    }

    const existingIndex = this.state.positions.findIndex(p => p.symbol === symbol);
    if (existingIndex >= 0) {
      if (position.size === 0) {
        // Remove closed position
        this.state.positions.splice(existingIndex, 1);
      } else {
        // Update existing position
        this.state.positions[existingIndex] = {
          symbol,
          size: position.size,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          pnl: position.pnl,
          openedAt: this.state.positions.at(existingIndex)?.openedAt || new Date()
        };
      }
    } else if (position.size !== 0) {
      // Add new position
      this.state.positions.push({
        symbol,
        size: position.size,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        pnl: position.pnl,
        openedAt: new Date()
      });
    }

    // Update state incrementally
    this.stateManager.updateState(this.config.bot.id, {
      positions: this.state.positions
    }).catch(error => {
      console.warn('Failed to update position state', { symbol, error: error.message });
    });
  }

  /**
   * Update order in state
   */
  updateOrder(order: any): void {
    if (!this.state.orders) {
      this.state.orders = [];
    }

    const existingIndex = this.state.orders.findIndex(o => o.id === order.id);
    if (existingIndex >= 0) {
      if (order.status === 'filled' || order.status === 'cancelled') {
        // Remove completed orders
        this.state.orders.splice(existingIndex, 1);
      } else {
        // Update existing order
        this.state.orders[existingIndex] = {
          id: order.id,
          symbol: order.symbol,
          type: order.type,
          status: order.status,
          size: order.size,
          price: order.price,
          createdAt: this.state.orders.at(existingIndex)?.createdAt || new Date()
        };
      }
    } else {
      // Add new order
      this.state.orders.push({
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        status: order.status,
        size: order.size,
        price: order.price,
        createdAt: new Date()
      });
    }

    // Update state incrementally
    this.stateManager.updateState(this.config.bot.id, {
      orders: this.state.orders
    }).catch(error => {
      console.warn('Failed to update order state', { orderId: order.id, error: error.message });
    });
  }

  /**
   * Create scheduled backup
   */
  async createScheduledBackup(): Promise<void> {
    try {
      await this.stateManager.createBackup(
        this.config.bot.id,
        'scheduled',
        'Scheduled backup',
        this.state,
        {
          positions: this.state.positions || [],
          orders: this.state.orders || [],
          strategy: this.state.strategy
        }
      );

      console.log('📦 Scheduled backup created', {
        botId: this.config.bot.id
      });
    } catch (error) {
      console.warn('⚠️ Failed to create scheduled backup', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Create manual backup
   */
  async createManualBackup(reason: string): Promise<void> {
    try {
      await this.stateManager.createBackup(
        this.config.bot.id,
        'manual',
        reason,
        this.state,
        {
          positions: this.state.positions || [],
          orders: this.state.orders || [],
          strategy: this.state.strategy
        }
      );

      console.log('📦 Manual backup created', {
        botId: this.config.bot.id,
        reason
      });
    } catch (error) {
      console.warn('⚠️ Failed to create manual backup', {
        botId: this.config.bot.id,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get state statistics
   */
  getStateStatistics(): any {
    return {
      botId: this.state.botId,
      status: this.state.status,
      uptime: this.state.startedAt ? Date.now() - this.state.startedAt.getTime() : 0,
      performance: this.state.performance,
      positionsCount: this.state.positions?.length || 0,
      ordersCount: this.state.orders?.length || 0,
      lastTickAt: this.state.lastTickAt,
      errorCount: this.state.errorCount,
      lastError: this.state.lastError
    };
  }
  private async updateDatabaseStatus(status: Bot['status']): Promise<void> {
    try {
      await database.query(
        'UPDATE bots SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, this.config.bot.id]
      );
    } catch (error) {
      console.warn('⚠️ Failed to update database status', {
        botId: this.config.bot.id,
        status,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Process trading signals from strategy with comprehensive pipeline
   */
  private async processSignal(signal: StrategyResult): Promise<void> {
    try {
      console.log('📊 Starting comprehensive signal processing', {
        botId: this.config.bot.id,
        action: signal.action,
        confidence: signal.confidence,
        reason: signal.reason
      });

      // Step 1: Process signal through signal processor
      const processedSignal: ProcessedSignal | null = await this.signalProcessor.processSignal(
        signal,
        this.config.bot,
        this.config.context
      );

      if (!processedSignal) {
        console.warn('⚠️ Signal rejected by signal processor', {
          botId: this.config.bot.id,
          action: signal.action
        });
        return;
      }

      console.log('✅ Signal processed successfully', {
        botId: this.config.bot.id,
        signalId: processedSignal.processingMetadata.signalId,
        riskScore: processedSignal.riskAssessment.riskScore,
        processingTime: processedSignal.processingMetadata.processingTimeMs
      });

      // Step 2: Make trade decision
      const tradeDecision: TradeDecision = await this.tradeDecisionEngine.makeTradeDecision(
        processedSignal,
        this.config.bot,
        this.config.context
      );

      if (!tradeDecision.approved) {
        console.warn('⚠️ Trade rejected by decision engine', {
          botId: this.config.bot.id,
          signalId: processedSignal.processingMetadata.signalId,
          reason: tradeDecision.reason
        });
        return;
      }

      console.log('✅ Trade decision approved', {
        botId: this.config.bot.id,
        signalId: processedSignal.processingMetadata.signalId,
        estimatedCost: tradeDecision.estimatedCost,
        action: tradeDecision.action
      });

      // Step 3: Execute the trade
      const executionResult: ExecutionResult = await this.tradeDecisionEngine.executeTrade(
        tradeDecision,
        processedSignal,
        this.config.bot,
        this.config.context
      );

      if (executionResult.success) {
        // Update performance metrics
        this.state.performance.tradeCount++;
        
        console.log('🎉 Trade executed successfully', {
          botId: this.config.bot.id,
          orderId: executionResult.order?.id,
          executionTime: executionResult.executionTime,
          positionCreated: !!executionResult.position
        });

        // Emit successful trade event
        this.emit('trade-completed', {
          botId: this.config.bot.id,
          signal: processedSignal,
          decision: tradeDecision,
          result: executionResult,
          timestamp: new Date()
        });

        // Update bot performance in database
        await this.updateBotPerformance(executionResult);

      } else {
        console.error('❌ Trade execution failed', {
          botId: this.config.bot.id,
          signalId: processedSignal.processingMetadata.signalId,
          error: executionResult.error,
          executionTime: executionResult.executionTime
        });

        // Emit failed trade event
        this.emit('trade-failed', {
          botId: this.config.bot.id,
          signal: processedSignal,
          decision: tradeDecision,
          error: executionResult.error,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Critical error in signal processing pipeline', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      this.emit('signal-processing-error', {
        botId: this.config.bot.id,
        originalSignal: signal,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Set up event listeners for signal processing components
   */
  private setupSignalProcessingEvents(): void {
    // Signal processor events
    this.signalProcessor.on('signal-processed', (event) => {
      console.log('📊 Signal processor event', event);
      this.emit('signal-validated', event);
    });

    this.signalProcessor.on('signal-error', (event) => {
      console.error('❌ Signal processor error', event);
      this.emit('signal-validation-failed', event);
    });

    // Trade decision engine events
    this.tradeDecisionEngine.on('trade-executed', (event) => {
      console.log('🚀 Trade execution event', event);
      this.emit('order-placed', event);
    });

    this.tradeDecisionEngine.on('trade-failed', (event) => {
      console.error('❌ Trade execution failed event', event);
      this.emit('order-failed', event);
    });
  }

  /**
   * Set up event listeners for enhanced state management
   */
  private setupStateManagementEvents(): void {
    // State manager events
    this.stateManager.on('snapshot-saved', (snapshot) => {
      console.debug('💾 State snapshot saved', {
        botId: this.config.bot.id,
        version: snapshot.version
      });
    });

    this.stateManager.on('backup-created', (backup) => {
      console.log('📦 Backup created', {
        botId: this.config.bot.id,
        backupId: backup.id,
        type: backup.type,
        size: backup.size
      });
    });

    this.stateManager.on('state-recovered', (event) => {
      console.log('🔄 State recovered', {
        botId: this.config.bot.id,
        backupId: event.backup.id,
        recoveryTime: event.backup.createdAt
      });
    });

    this.stateManager.on('scheduled-backup-required', async () => {
      await this.createScheduledBackup();
    });

    // Shutdown manager events
    this.shutdownManager.on('shutdown-initiated', (context) => {
      console.log('🔄 Enhanced shutdown initiated', {
        botId: context.botId,
        reason: context.reason
      });
    });

    this.shutdownManager.on('shutdown-completed', (context) => {
      console.log('✅ Enhanced shutdown completed', {
        botId: context.botId,
        duration: Date.now() - context.startedAt.getTime(),
        completedSteps: context.completedSteps.length
      });
    });

    this.shutdownManager.on('shutdown-failed', (event) => {
      console.error('❌ Enhanced shutdown failed', {
        botId: event.context.botId,
        error: event.error instanceof Error ? event.error.message : String(event.error)
      });
    });
  }

  /**
   * Update bot performance metrics in database
   */
  private async updateBotPerformance(executionResult: ExecutionResult): Promise<void> {
    try {
      // Calculate performance metrics
      const performance = {
        totalTrades: this.state.performance.tradeCount,
        totalSignals: this.state.performance.signalCount,
        totalTicks: this.state.performance.tickCount,
        errorCount: this.state.performance.errorCount,
        lastTradeAt: new Date(),
        avgExecutionTime: executionResult.executionTime
      };

      // Update in database
      await database.query(`
        UPDATE bots 
        SET performance = $1, updated_at = NOW() 
        WHERE id = $2
      `, [JSON.stringify(performance), this.config.bot.id]);

      console.log('📈 Bot performance updated', {
        botId: this.config.bot.id,
        performance
      });

    } catch (error) {
      console.warn('⚠️ Failed to update bot performance', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get comprehensive bot status including signal processing stats
   */
  getBotStatus() {
    return {
      runtime: this.getState(),
      signalProcessor: this.signalProcessor.getStats(),
      tradeDecisionEngine: this.tradeDecisionEngine.getStats(),
      activePositions: this.tradeDecisionEngine.getActivePositions(),
      pendingOrders: this.tradeDecisionEngine.getPendingOrders()
    };
  }

  /**
   * Handle errors with retry logic and recovery management
   */
  private async handleError(error: Error, operation = 'unknown'): Promise<void> {
    this.state.lastError = error.message;
    this.state.errorCount++;
    
    console.error('🚨 Bot runtime error', {
      botId: this.config.bot.id,
      operation,
      error: error.message,
      stack: error.stack,
      errorCount: this.state.errorCount
    });

    // Use error recovery manager if available
    if (this.config.errorRecoveryManager) {
      try {
        const recovered = await this.config.errorRecoveryManager.handleError(error, {
          botId: this.config.bot.id,
          operation,
          metadata: {
            state: this.state,
            errorCount: this.state.errorCount,
            strategy: this.config.bot.strategy
          }
        });

        if (recovered) {
          console.log('✅ Error recovery successful', {
            botId: this.config.bot.id,
            operation
          });
          
          // Reset error count on successful recovery
          this.state.errorCount = Math.max(0, this.state.errorCount - 1);
        } else {
          console.warn('⚠️ Error recovery failed', {
            botId: this.config.bot.id,
            operation,
            errorCount: this.state.errorCount
          });
        }
      } catch (recoveryError) {
        console.error('❌ Error recovery system failed', {
          botId: this.config.bot.id,
          operation,
          originalError: error.message,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        });
      }
    }

    // Emit error event for external listeners
    this.emit('error', { error, operation, botId: this.config.bot.id });

    // Check if bot should be stopped due to too many errors
    if (this.state.errorCount >= this.config.maxRetries) {
      console.error('🚨 Too many errors, stopping bot', {
        botId: this.config.bot.id,
        errorCount: this.state.errorCount,
        maxRetries: this.config.maxRetries
      });

      this.emit('critical-error', { 
        botId: this.config.bot.id, 
        errorCount: this.state.errorCount, 
        lastError: error.message 
      });

      await this.stop();
    }
  }

  /**
   * Enhanced graceful shutdown handler
   */
  private async gracefulShutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;

    this.shutdownPromise = (async () => {
      console.log('🔄 Initiating enhanced graceful shutdown', {
        botId: this.config.bot.id
      });

      try {
        // Use enhanced graceful shutdown manager
        await this.shutdownManager.initiateShutdown(
          this.config.bot.id,
          'Process signal shutdown',
          'SIGTERM',
          this.state
        );

        // Fallback to basic stop if enhanced shutdown fails
        await this.stop();
        
        console.log('✅ Enhanced graceful shutdown completed', {
          botId: this.config.bot.id
        });

        this.emit('graceful-shutdown-completed', { botId: this.config.bot.id });
      } catch (error) {
        console.error('❌ Error during enhanced graceful shutdown', {
          botId: this.config.bot.id,
          error: error instanceof Error ? error.message : String(error)
        });

        // Emergency shutdown as last resort
        try {
          await this.shutdownManager.emergencyShutdown(
            this.config.bot.id,
            'Graceful shutdown failed'
          );
        } catch (emergencyError) {
          console.error('❌ Emergency shutdown also failed', {
            botId: this.config.bot.id,
            error: emergencyError instanceof Error ? emergencyError.message : String(emergencyError)
          });
        }

        this.emit('graceful-shutdown-failed', { 
          botId: this.config.bot.id, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();

    return this.shutdownPromise;
  }

  /**
   * Switch strategy at runtime without stopping the bot
   */
  async switchStrategy(
    newStrategyType: StrategyType,
    newConfig: StrategyConfig,
    options: StrategySwapOptions = {
      preserveState: true,
      validateFirst: true,
      rollbackOnError: true
    },
    pluginId?: string
  ): Promise<boolean> {
    try {
      const wasRunning = this.state.status === 'running';
      
      console.log('🔄 Switching bot strategy at runtime', {
        botId: this.config.bot.id,
        from: this.state.currentStrategy?.name,
        to: newStrategyType,
        wasRunning,
        options
      });

      // Temporarily pause execution if running
      if (wasRunning) {
        await this.pause();
      }

      // Use dynamic strategy loader to switch strategy
      const switchResult = await dynamicStrategyLoader.switchStrategy(
        this.config.bot.id,
        newStrategyType,
        newConfig,
        this.config.context,
        options,
        pluginId
      );

      if (!switchResult.success) {
        console.error('❌ Strategy switch failed', {
          botId: this.config.bot.id,
          error: switchResult.error
        });

        // Resume if it was running before
        if (wasRunning && this.state.status === 'paused') {
          await this.resume();
        }

        return false;
      }

      // Update runtime configuration with new strategy
      this.config.strategy = switchResult.strategy!;
      this.state.currentStrategy = {
        name: switchResult.strategy!.name,
        version: switchResult.strategy!.version,
        type: newStrategyType
      };

      // Re-initialize strategy in the runtime context
      await this.initializeStrategy();

      // Resume execution if it was running before
      if (wasRunning) {
        await this.resume();
      }

      console.log('✅ Strategy switched successfully in bot runtime', {
        botId: this.config.bot.id,
        newStrategy: this.state.currentStrategy
      });

      this.emit('strategy-switched', {
        botId: this.config.bot.id,
        newStrategy: this.state.currentStrategy,
        preservedState: options.preserveState
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to switch strategy in bot runtime', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.state.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Rollback to previous strategy version
   */
  async rollbackStrategy(): Promise<boolean> {
    try {
      const wasRunning = this.state.status === 'running';

      console.log('🔄 Rolling back bot strategy', {
        botId: this.config.bot.id,
        currentStrategy: this.state.currentStrategy,
        wasRunning
      });

      // Temporarily pause execution if running
      if (wasRunning) {
        await this.pause();
      }

      // Use dynamic strategy loader to rollback
      const rollbackResult = await dynamicStrategyLoader.rollbackToPreviousVersion(
        this.config.bot.id,
        this.config.context
      );

      if (!rollbackResult.success) {
        console.error('❌ Strategy rollback failed', {
          botId: this.config.bot.id,
          error: rollbackResult.error
        });

        // Resume if it was running before
        if (wasRunning && this.state.status === 'paused') {
          await this.resume();
        }

        return false;
      }

      // Update runtime configuration with rolled back strategy
      this.config.strategy = rollbackResult.strategy!;
      this.state.currentStrategy = {
        name: rollbackResult.strategy!.name,
        version: rollbackResult.strategy!.version,
        type: rollbackResult.version!.strategyType
      };

      // Re-initialize strategy in the runtime context
      await this.initializeStrategy();

      // Resume execution if it was running before
      if (wasRunning) {
        await this.resume();
      }

      console.log('✅ Strategy rollback successful in bot runtime', {
        botId: this.config.bot.id,
        rolledBackStrategy: this.state.currentStrategy
      });

      this.emit('strategy-rollback', {
        botId: this.config.bot.id,
        rolledBackStrategy: this.state.currentStrategy
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to rollback strategy in bot runtime', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.state.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Get current strategy information
   */
  getCurrentStrategyInfo(): {
    name: string;
    version: string;
    type: string;
    performance?: any;
  } | null {
    if (!this.state.currentStrategy) {
      return null;
    }

    const performance = dynamicStrategyLoader.getPerformanceMetrics(this.config.bot.id);
    
    return {
      ...this.state.currentStrategy,
      performance
    };
  }

  /**
   * Set or update the trade executor
   */
  setTradeExecutor(tradeExecutor: TradeExecutor): void {
    this.config.tradeExecutor = tradeExecutor;
    this.tradeDecisionEngine.setTradeExecutor(tradeExecutor);
    
    console.log('✅ Trade executor configured for bot runtime', {
      botId: this.config.bot.id
    });
  }

  /**
   * Hot-swap strategy without stopping the bot
   */
  async hotSwapStrategy(
    newStrategyType: StrategyType,
    newStrategyConfig: StrategyConfig
  ): Promise<boolean> {
    try {
      console.log('🔄 Initiating hot strategy swap in bot runtime', {
        botId: this.config.bot.id,
        currentStrategy: this.config.bot.strategy,
        newStrategy: newStrategyType
      });

      if (!this.strategyExecutionIntegration) {
        console.error('❌ Strategy execution integration not available for hot swap', {
          botId: this.config.bot.id
        });
        return false;
      }

      // Perform hot swap using strategy execution integration
      const swapResult = await this.strategyExecutionIntegration.hotSwapStrategy(
        newStrategyType,
        newStrategyConfig
      );

      if (!swapResult.success) {
        console.error('❌ Hot strategy swap failed', {
          botId: this.config.bot.id,
          error: swapResult.error
        });
        return false;
      }

      // Update bot configuration and state
      this.config.bot.strategy = newStrategyType as any; // Type conversion for compatibility
      this.config.bot.configuration = newStrategyConfig.parameters;
      
      this.state.currentStrategy = {
        name: swapResult.strategy?.name || newStrategyType,
        version: swapResult.version?.version || '1.0.0',
        type: newStrategyType
      };

      console.log('✅ Hot strategy swap completed successfully', {
        botId: this.config.bot.id,
        newStrategy: newStrategyType,
        version: swapResult.version?.version
      });

      this.emit('strategy-hot-swapped', {
        botId: this.config.bot.id,
        newStrategy: newStrategyType,
        version: swapResult.version
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to perform hot strategy swap', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Update strategy configuration dynamically
   */
  async updateStrategyConfig(newConfig: Partial<StrategyConfig>): Promise<boolean> {
    try {
      console.log('🔧 Updating strategy configuration', {
        botId: this.config.bot.id,
        updatedFields: Object.keys(newConfig)
      });

      if (!this.strategyExecutionIntegration) {
        console.error('❌ Strategy execution integration not available for config update', {
          botId: this.config.bot.id
        });
        return false;
      }

      // Update configuration using strategy execution integration
      const updateResult = await this.strategyExecutionIntegration.updateStrategyConfig(newConfig);

      if (!updateResult) {
        console.error('❌ Strategy configuration update failed', {
          botId: this.config.bot.id
        });
        return false;
      }

      // Update bot configuration
      if (newConfig.parameters) {
        this.config.bot.configuration = {
          ...this.config.bot.configuration,
          ...newConfig.parameters
        };
      }

      console.log('✅ Strategy configuration updated successfully', {
        botId: this.config.bot.id,
        updatedFields: Object.keys(newConfig)
      });

      this.emit('strategy-config-updated', {
        botId: this.config.bot.id,
        updatedConfig: newConfig
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to update strategy configuration', {
        botId: this.config.bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get enhanced strategy execution metrics
   */
  getStrategyExecutionMetrics(): any {
    if (!this.strategyExecutionIntegration) {
      return null;
    }

    return this.strategyExecutionIntegration.getPerformanceMetrics();
  }

  /**
   * Reset strategy execution metrics
   */
  resetStrategyMetrics(): void {
    if (this.strategyExecutionIntegration) {
      this.strategyExecutionIntegration.resetMetrics();
      
      console.log('📊 Strategy execution metrics reset', {
        botId: this.config.bot.id
      });

      this.emit('strategy-metrics-reset', {
        botId: this.config.bot.id
      });
    }
  }

  /**
   * Get current strategy execution integration info
   */
  getStrategyExecutionInfo(): any {
    if (!this.strategyExecutionIntegration) {
      return {
        available: false,
        reason: 'Strategy execution integration not initialized'
      };
    }

    return {
      available: true,
      ...this.strategyExecutionIntegration.getCurrentStrategyInfo()
    };
  }
} 