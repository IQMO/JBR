/**
 * Bot Manager - Production Bot Lifecycle Management
 * 
 * Manages multiple bot instances with:
 * - Dynamic strategy loading
 * - Bot lifecycle coordination
 * - Error recovery and monitoring
 * - WebSocket event broadcasting
 * - Performance tracking
 */

import { EventEmitter } from 'events';

import { ExchangeManager } from '../exchanges/exchange-manager';
import type { IStrategy, StrategyContext, BotConfig, StrategyConfig } from '../JabbrLabs/target-reacher/interfaces';
import type { StrategyType } from '../strategies/strategy-factory';
import { webSocketService } from '../websocket/websocket.service';

import type { BotRuntimeConfig, BotState } from './bot-runtime';
import { BotRuntime } from './bot-runtime';
import type { Bot} from './bots.service';
import { botService } from './bots.service';

// import { logger, LogCategory } from '../utils/logging-utils';

import type { StrategySwapOptions } from './dynamic-strategy-loader';
import { dynamicStrategyLoader } from './dynamic-strategy-loader';
import { TradeExecutor } from './trade-executor';
// import { WebSocketService } from '../websocket/websocket.service';

export interface BotManagerConfig {
  maxConcurrentBots: number;
  defaultCheckInterval: number;
  defaultMaxRetries: number;
  defaultRetryDelay: number;
  monitoringInterval: number;
}

export class BotManager extends EventEmitter {
  private static instance: BotManager;
  private config: BotManagerConfig;
  private activeBots: Map<string, BotRuntime> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private exchangeManager: ExchangeManager;
  private tradeExecutor: TradeExecutor;
  private enableRealTrading: boolean;

  private constructor(config: BotManagerConfig, enableRealTrading = false) {
    super();
    this.config = config;
    this.enableRealTrading = enableRealTrading;

    // Initialize exchange manager
    this.exchangeManager = new ExchangeManager({
      autoReconnect: true,
      reconnectInterval: 30000,
      healthCheckInterval: 60000,
      maxReconnectAttempts: 5
    });

    // Initialize trade executor
    this.tradeExecutor = new TradeExecutor(this.exchangeManager, {
      maxRetries: 3,
      retryDelay: 1000,
      orderTimeout: 30000,
      enableMockMode: !enableRealTrading, // Use mock mode if real trading is disabled
      validateBalance: true,
      maxSlippagePercent: 0.5
    });

    this.setupEventListeners();

    this.setupMonitoring();
    this.initializeDynamicStrategyLoader();

    console.log('🤖 BotManager initialized', {
      maxConcurrentBots: this.config.maxConcurrentBots,
      enableRealTrading
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: BotManagerConfig, enableRealTrading?: boolean): BotManager {
    if (!BotManager.instance) {
      const defaultConfig: BotManagerConfig = {
        maxConcurrentBots: 10,
        defaultCheckInterval: 5000, // 5 seconds
        defaultMaxRetries: 5,
        defaultRetryDelay: 1000, // 1 second
        monitoringInterval: 30000 // 30 seconds
      };

      BotManager.instance = new BotManager(config || defaultConfig, enableRealTrading);
    }
    return BotManager.instance;
  }

  /**
   * Initialize dynamic strategy loader
   */
  private async initializeDynamicStrategyLoader(): Promise<void> {
    try {
      await dynamicStrategyLoader.initialize();
      
      // Set up event listeners for strategy events
      dynamicStrategyLoader.on('strategy-loaded', (data) => {
        // logger.info('📡 Strategy loaded event', LogCategory.STRATEGY, data);
        this.broadcastStrategyUpdate(data.botId, 'loaded', data);
      });

      dynamicStrategyLoader.on('strategy-switched', (data) => {
        // logger.info('📡 Strategy switched event', LogCategory.STRATEGY, data);
        this.broadcastStrategyUpdate(data.botId, 'switched', data);
      });

      dynamicStrategyLoader.on('strategy-rollback', (data) => {
        // logger.info('📡 Strategy rollback event', LogCategory.STRATEGY, data);
        this.broadcastStrategyUpdate(data.botId, 'rollback', data);
      });

      dynamicStrategyLoader.on('strategy-underperforming', (data) => {
        // logger.warn('📡 Strategy underperforming event', LogCategory.STRATEGY, data);
        this.handleUnderperformingStrategy(data.botId, data.performance);
      });

      // logger.info('✅ Dynamic Strategy Loader integrated with Bot Manager');
    } catch (error) {
      // logger.error('❌ Failed to initialize Dynamic Strategy Loader', LogCategory.STRATEGY, {
      //   error: error instanceof Error ? error.message : String(error)
      // });
    }
  }

  /**
   * Start a bot by ID
   */
  async startBot(userId: string, botId: string): Promise<void> {
    try {
      // Check if bot is already running
      if (this.activeBots.has(botId)) {
        const runtime = this.activeBots.get(botId)!;
        const state = runtime.getState();
        
        if (state.status === 'running') {
          // logger.warn('⚠️ Bot is already running', LogCategory.BOT, { botId });
          return;
        }
        
        if (state.status === 'paused') {
          await runtime.resume();
          return;
        }
      }

      // Check concurrent bot limit
      const runningBots = Array.from(this.activeBots.values()).filter(
        runtime => runtime.getState().status === 'running'
      );

      if (runningBots.length >= this.config.maxConcurrentBots) {
        throw new Error(`Maximum concurrent bots limit reached (${this.config.maxConcurrentBots})`);
      }

      // Load bot configuration from database
      const bot = await botService.getBotById(userId, botId);
      if (!bot) {
        throw new Error('Bot not found');
      }

      if (bot.status === 'running') {
        throw new Error('Bot is already marked as running in database');
      }

      // Create bot runtime
      const runtime = await this.createBotRuntime(bot);
      
      // Initialize and start the bot
      await runtime.initialize();
      await runtime.start();

      // Store in active bots
      this.activeBots.set(botId, runtime);

      // Set up event listeners
      this.setupBotEventListeners(runtime);

      // logger.info('✅ Bot started successfully', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   strategy: bot.strategy
      // });

      // Broadcast status update
      this.broadcastBotStatusUpdate(botId, 'running');

    } catch (error) {
      // logger.error('❌ Failed to start bot', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   error: error instanceof Error ? error.message : String(error)
      // });

      // Update database status to error
      await botService.updateBotStatus(userId, botId, 'error');
      this.broadcastBotStatusUpdate(botId, 'error');
      
      throw error;
    }
  }

  /**
   * Stop a bot by ID
   */
  async stopBot(userId: string, botId: string): Promise<void> {
    try {
      const runtime = this.activeBots.get(botId);
      if (!runtime) {
        // logger.warn('⚠️ Bot runtime not found, updating database status only', LogCategory.BOT, { botId });
        await botService.updateBotStatus(userId, botId, 'stopped');
        this.broadcastBotStatusUpdate(botId, 'stopped');
        return;
      }

      await runtime.stop();
      this.activeBots.delete(botId);

      // logger.info('✅ Bot stopped successfully', LogCategory.BOT, {
      //   botId,
      //   userId
      // });

      this.broadcastBotStatusUpdate(botId, 'stopped');

    } catch (error) {
      // logger.error('❌ Failed to stop bot', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   error: error instanceof Error ? error.message : String(error)
      // });
      throw error;
    }
  }

  /**
   * Pause a bot by ID
   */
  async pauseBot(userId: string, botId: string): Promise<void> {
    try {
      const runtime = this.activeBots.get(botId);
      if (!runtime) {
        throw new Error('Bot runtime not found');
      }

      await runtime.pause();

      // logger.info('✅ Bot paused successfully', LogCategory.BOT, {
      //   botId,
      //   userId
      // });

      this.broadcastBotStatusUpdate(botId, 'paused');

    } catch (error) {
      // logger.error('❌ Failed to pause bot', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   error: error instanceof Error ? error.message : String(error)
      // });
      throw error;
    }
  }

  /**
   * Resume a bot by ID
   */
  async resumeBot(userId: string, botId: string): Promise<void> {
    try {
      const runtime = this.activeBots.get(botId);
      if (!runtime) {
        throw new Error('Bot runtime not found');
      }

      await runtime.resume();

      // logger.info('✅ Bot resumed successfully', LogCategory.BOT, {
      //   botId,
      //   userId
      // });

      this.broadcastBotStatusUpdate(botId, 'running');

    } catch (error) {
      // logger.error('❌ Failed to resume bot', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   error: error instanceof Error ? error.message : String(error)
      // });
      throw error;
    }
  }

  /**
   * Get bot status and performance
   */
  getBotStatus(botId: string): BotState | null {
    const runtime = this.activeBots.get(botId);
    return runtime ? runtime.getState() : null;
  }

  /**
   * Get all active bots status
   */
  getAllBotsStatus(): Map<string, BotState> {
    const status = new Map<string, BotState>();
    
    for (const [botId, runtime] of this.activeBots) {
      status.set(botId, runtime.getState());
    }
    
    return status;
  }

  /**
   * Shutdown all bots gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down BotManager');

    // Clear monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Stop all active bots
    const shutdownPromises = Array.from(this.activeBots.values()).map(
      runtime => runtime.stop().catch(error => {
        // logger.error('❌ Error stopping bot during shutdown', LogCategory.BOT, { error })
      })
    );

    await Promise.all(shutdownPromises);
    this.activeBots.clear();

    // Disconnect from all exchanges
    await this.exchangeManager.disconnectAll();

    console.log('✅ All bots shut down successfully');
  }

  /**
   * Create bot runtime instance with strategy loading
   */
  private async createBotRuntime(bot: Bot): Promise<BotRuntime> {
    // Load strategy dynamically based on bot configuration
    const strategy = await this.loadStrategy(bot);
    
    // Create strategy context
    const context = await this.createStrategyContext(bot);

    // Create runtime configuration
    const config: BotRuntimeConfig = {
      bot,
      strategy,
      context,
      checkInterval: this.config.defaultCheckInterval,
      maxRetries: this.config.defaultMaxRetries,
      retryDelay: this.config.defaultRetryDelay,
      tradeExecutor: this.enableRealTrading ? this.tradeExecutor : undefined
    };

    return new BotRuntime(config);
  }

  /**
   * Load strategy using dynamic strategy loader
   */
  private async loadStrategy(bot: Bot): Promise<IStrategy> {
    try {
      // logger.info('🔄 Loading strategy using dynamic loader', LogCategory.STRATEGY, {
      //   botId: bot.id,
      //   strategy: bot.strategy
      // });

      // Create strategy context
      const context = await this.createStrategyContext(bot);

      // Create strategy config
      const strategyConfig: StrategyConfig = {
        type: bot.strategy,
        parameters: bot.configuration || {},
        execution: {
          timeframe: '1m',
          minimumConfidence: 0.7
        }
      };

      // Use dynamic strategy loader to load the strategy
      const loadResult = await dynamicStrategyLoader.loadStrategy(
        bot.id,
        bot.strategy as StrategyType,
        strategyConfig,
        context,
        bot.configuration?.customStrategyName // Use as pluginId for custom strategies
      );

      if (!loadResult.success || !loadResult.strategy) {
        throw new Error(loadResult.error || 'Failed to load strategy');
      }

      // logger.info('✅ Strategy loaded successfully using dynamic loader', LogCategory.STRATEGY, {
      //   botId: bot.id,
      //   strategy: loadResult.strategy.name,
      //   version: loadResult.strategy.version
      // });

      return loadResult.strategy;

    } catch (error) {
      // logger.error('❌ Failed to load strategy using dynamic loader', LogCategory.STRATEGY, {
      //   botId: bot.id,
      //   strategy: bot.strategy,
      //   error: error instanceof Error ? error.message : String(error)
      // });
      throw error;
    }
  }

  /**
   * Create strategy context with all required providers
   */
  private async createStrategyContext(bot: Bot): Promise<StrategyContext> {
    const botConfig: BotConfig = {
      id: bot.id,
      name: bot.name,
      symbol: 'BTCUSDT', // This would come from bot configuration
      tradeType: 'spot',
      amount: 100
    };

    const context: StrategyContext = {
      config: {
        type: bot.strategy,
        parameters: bot.configuration,
        execution: {
          timeframe: '1m',
          minimumConfidence: 0.7
        }
      },
      botConfig,
      symbol: botConfig.symbol,
      marketData: {
        async getCurrentPrice(_symbol: string) { return 50000; },
        async getOrderBook(_symbol: string, _limit?: number) { 
          return { 
            bids: [[50000, 1]], 
            asks: [[50001, 1]], 
            timestamp: Date.now() 
          }; 
        },
        async getCandles(_symbol: string, _timeframe: string, _limit?: number) { return []; },
        async getTicker(_symbol: string) { 
          return { 
            symbol: _symbol,
            last: 50000, 
            bid: 49999,
            ask: 50001,
            volume: 1000,
            timestamp: Date.now()
          }; 
        }
      },
      tradeExecutor: {
        async executeSignal(_signal: any, _botConfig: BotConfig) { 
          return { 
            id: 'mock-order',
            botId: _botConfig.id,
            symbol: _signal.symbol,
            type: 'market',
            side: _signal.side,
            amount: _signal.amount || 1,
            status: 'pending',
            filled: 0,
            remaining: 1,
            timestamp: Date.now(),
            updatedAt: Date.now()
          }; 
        },
        async getPosition(_botId: string, _symbol: string) { return null; },
        async closePosition(_botId: string, _symbol: string) {}
      },
      logger: {
        info: (message: string, data?: any) => {
          // logger.info(message, LogCategory.STRATEGY, data);
        },
        warn: (message: string, data?: any) => {
          // logger.warn(message, LogCategory.STRATEGY, data);
        },
        error: (message: string, data?: any) => {
          // logger.error(message, LogCategory.STRATEGY, data);
        },
        debug: (message: string, data?: any) => {
          // logger.debug(message, LogCategory.STRATEGY, data);
        }
      },
      storage: {
        async storeStrategyEvent(_botId: string, _event: any) {},
        async getStrategyState(_botId: string) { return null; },
        async saveStrategyState(_botId: string, _state: any) {}
      },
      eventEmitter: {
        emit: (event: string, data: unknown) => this.emit(event, data),
        on: (event: string, handler: (data: unknown) => void) => this.on(event, handler),
        off: (event: string, handler: (data: unknown) => void) => this.off(event, handler)
      }
    };

    return context;
  }

  /**
   * Set up event listeners for bot runtime
   */
  private setupBotEventListeners(runtime: BotRuntime): void {
    const state = runtime.getState();
    const botId = state.botId;

    runtime.on('started', () => {
      // logger.info('📡 Bot started event', LogCategory.BOT, { botId });
      this.broadcastBotStatusUpdate(botId, 'running');
    });

    runtime.on('stopped', () => {
      // logger.info('📡 Bot stopped event', LogCategory.BOT, { botId });
      this.activeBots.delete(botId);
      this.broadcastBotStatusUpdate(botId, 'stopped');
    });

    runtime.on('paused', () => {
      // logger.info('📡 Bot paused event', LogCategory.BOT, { botId });
      this.broadcastBotStatusUpdate(botId, 'paused');
    });

    runtime.on('resumed', () => {
      // logger.info('📡 Bot resumed event', LogCategory.BOT, { botId });
      this.broadcastBotStatusUpdate(botId, 'running');
    });

    runtime.on('error', (error: Error) => {
      // logger.error('📡 Bot error event', LogCategory.BOT, {
      //   botId,
      //   error: error.message
      // });
      this.broadcastBotStatusUpdate(botId, 'error');
    });

    runtime.on('signal', (data: any) => {
      // logger.info('📡 Bot signal event', LogCategory.SIGNAL, {
      //   botId,
      //   signal: data.signal
      // });
      
      // Broadcast signal to WebSocket clients
      webSocketService.broadcast('bot-signal', {
        botId,
        signal: data.signal,
        timestamp: data.timestamp
      });
    });

    runtime.on('tick', (_data: any) => {
      // Broadcast performance updates periodically (every 10 ticks)
      const currentState = runtime.getState();
      if (currentState.performance.tickCount % 10 === 0) {
        this.broadcastBotPerformanceUpdate(botId, currentState.performance);
      }
    });
  }

  /**
   * Set up monitoring for bot health and performance
   */
  private setupMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoringInterval);
  }

  /**
   * Perform health check on all active bots
   */
  private performHealthCheck(): void {
    const now = new Date();
    
    for (const [botId, runtime] of this.activeBots) {
      const state = runtime.getState();
      
      // Check for stale bots (no tick in last 2 minutes)
      if (state.lastTickAt && state.status === 'running') {
        const timeSinceLastTick = now.getTime() - state.lastTickAt.getTime();
        const staleThreshold = 2 * 60 * 1000; // 2 minutes
        
        if (timeSinceLastTick > staleThreshold) {
          // logger.warn('⚠️ Bot appears stale', LogCategory.BOT, {
          //   botId,
          //   timeSinceLastTick,
          //   lastTickAt: state.lastTickAt
          // });
          
          // Emit warning event
          this.emit('bot-stale', { botId, timeSinceLastTick });
        }
      }
      
      // Check error rates
      if (state.performance.errorCount > 0) {
        const errorRate = state.performance.errorCount / state.performance.tickCount;
        if (errorRate > 0.1) { // More than 10% error rate
          // logger.warn('⚠️ High error rate detected', LogCategory.BOT, {
          //   botId,
          //   errorRate,
          //   errorCount: state.performance.errorCount,
          //   tickCount: state.performance.tickCount
          // });
        }
      }
    }

    // Log overall health metrics
    // logger.debug('📊 Bot health check completed', LogCategory.BOT, {
    //   activeBots: this.activeBots.size,
    //   runningBots: Array.from(this.activeBots.values()).filter(
    //     runtime => runtime.getState().status === 'running'
    //   ).length
    // });
  }

  /**
   * Broadcast bot status update via WebSocket
   */
  private broadcastBotStatusUpdate(botId: string, status: string): void {
    webSocketService.broadcast('bot-status', {
      botId,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast bot performance update via WebSocket
   */
  private broadcastBotPerformanceUpdate(botId: string, performance: any): void {
    webSocketService.broadcast('bot-performance', {
      botId,
      performance,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Switch strategy for a running bot
   */
  async switchBotStrategy(
    userId: string,
    botId: string,
    newStrategyType: StrategyType,
    newConfig: StrategyConfig,
    options: StrategySwapOptions = {
      preserveState: true,
      validateFirst: true,
      rollbackOnError: true
    },
    pluginId?: string
  ): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      // logger.info('🔄 Switching bot strategy', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   newStrategyType,
      //   options
      // });

      // Check if bot exists and is managed
      const runtime = this.activeBots.get(botId);
      if (!runtime) {
        return {
          success: false,
          error: 'Bot runtime not found or not currently managed'
        };
      }

      // Validate user ownership
      const bot = await botService.getBotById(userId, botId);
      if (!bot) {
        return {
          success: false,
          error: 'Bot not found or access denied'
        };
      }

      // Perform strategy switch
      const switchSuccess = await runtime.switchStrategy(
        newStrategyType,
        newConfig,
        options,
        pluginId
      );

      if (!switchSuccess) {
        return {
          success: false,
          error: 'Strategy switch failed in bot runtime'
        };
      }

      // Update bot configuration in database
      await botService.updateBot(userId, botId, {
        strategy: newStrategyType,
        configuration: newConfig.parameters || {}
      });

      // logger.info('✅ Bot strategy switched successfully', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   newStrategyType
      // });

      // Broadcast update
      this.broadcastBotStatusUpdate(botId, runtime.getState().status);

      return { success: true };

    } catch (error) {
      // logger.error('❌ Failed to switch bot strategy', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   error: error instanceof Error ? error.message : String(error)
      // });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Rollback bot strategy to previous version
   */
  async rollbackBotStrategy(
    userId: string,
    botId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // logger.info('🔄 Rolling back bot strategy', LogCategory.BOT, {
      //   botId,
      //   userId
      // });

      // Check if bot exists and is managed
      const runtime = this.activeBots.get(botId);
      if (!runtime) {
        return {
          success: false,
          error: 'Bot runtime not found or not currently managed'
        };
      }

      // Validate user ownership
      const bot = await botService.getBotById(userId, botId);
      if (!bot) {
        return {
          success: false,
          error: 'Bot not found or access denied'
        };
      }

      // Perform strategy rollback
      const rollbackSuccess = await runtime.rollbackStrategy();

      if (!rollbackSuccess) {
        return {
          success: false,
          error: 'Strategy rollback failed in bot runtime'
        };
      }

      // logger.info('✅ Bot strategy rolled back successfully', LogCategory.BOT, {
      //   botId,
      //   userId
      // });

      // Broadcast update
      this.broadcastBotStatusUpdate(botId, runtime.getState().status);

      return { success: true };

    } catch (error) {
      // logger.error('❌ Failed to rollback bot strategy', LogCategory.BOT, {
      //   botId,
      //   userId,
      //   error: error instanceof Error ? error.message : String(error)
      // });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get available strategies for a bot
   */
  getAvailableStrategies(): Array<{
    type: StrategyType;
    name: string;
    description: string;
    isPlugin: boolean;
    pluginId?: string;
  }> {
    return dynamicStrategyLoader.getAvailableStrategies();
  }

  /**
   * Get strategy performance metrics for a bot
   */
  getBotStrategyPerformance(botId: string): any {
    const runtime = this.activeBots.get(botId);
    if (!runtime) {
      return null;
    }

    return runtime.getCurrentStrategyInfo();
  }

  /**
   * Handle underperforming strategy
   */
  private async handleUnderperformingStrategy(botId: string, performance: any): Promise<void> {
    try {
      // logger.warn('⚠️ Handling underperforming strategy', LogCategory.STRATEGY, {
      //   botId,
      //   performance
      // });

      // Get bot runtime
      const runtime = this.activeBots.get(botId);
      if (!runtime) {
        return;
      }

      // For now, just broadcast the alert
      // In a production system, you might implement automatic fallback strategies
      this.broadcastStrategyAlert(botId, 'underperforming', {
        performance,
        recommendation: 'Consider switching to a different strategy or adjusting parameters'
      });

      // Optional: Implement automatic fallback logic here
      // const fallbackStrategy = this.getFallbackStrategy(botId);
      // if (fallbackStrategy) {
      //   await runtime.switchStrategy(fallbackStrategy.type, fallbackStrategy.config);
      // }

    } catch (error) {
      // logger.error('❌ Failed to handle underperforming strategy', LogCategory.STRATEGY, {
      //   botId,
      //   error: error instanceof Error ? error.message : String(error)
      // });
    }
  }

  /**
   * Broadcast strategy update to WebSocket clients
   */
  private broadcastStrategyUpdate(botId: string, action: string, data: any): void {
    try {
      webSocketService.broadcast('bot-strategy-update', {
        botId,
        action,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // logger.warn('⚠️ Failed to broadcast strategy update', LogCategory.WEBSOCKET, {
      //   botId,
      //   action,
      //   error: error instanceof Error ? error.message : String(error)
      // });
    }
  }

  /**
   * Broadcast strategy alert to WebSocket clients
   */
  private broadcastStrategyAlert(botId: string, alertType: string, data: any): void {
    try {
      webSocketService.broadcast('bot-strategy-alert', {
        botId,
        alertType,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // logger.warn('⚠️ Failed to broadcast strategy alert', LogCategory.WEBSOCKET, {
      //   botId,
      //   alertType,
      //   error: error instanceof Error ? error.message : String(error)
      // });
    }
  }

  /**
   * Enable or disable real trading
   */
  setRealTradingMode(enabled: boolean): void {
    this.enableRealTrading = enabled;
    this.tradeExecutor = new TradeExecutor(this.exchangeManager, {
      maxRetries: 3,
      retryDelay: 1000,
      orderTimeout: 30000,
      enableMockMode: !enabled,
      validateBalance: true,
      maxSlippagePercent: 0.5
    });

    console.log(`💱 Real trading mode ${enabled ? 'enabled' : 'disabled'}`);

    // Update all existing bot runtimes
    for (const [botId, runtime] of this.activeBots) {
      runtime.setTradeExecutor(this.tradeExecutor);
    }
  }

  /**
   * Get exchange manager
   */
  getExchangeManager(): ExchangeManager {
    return this.exchangeManager;
  }

  /**
   * Get trade executor
   */
  getTradeExecutor(): TradeExecutor {
    return this.tradeExecutor;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Exchange manager events
    this.exchangeManager.on('exchange-connected', (event) => {
      console.log('🔌 Exchange connected', event);
      this.emit('exchange-connected', event);
    });

    this.exchangeManager.on('exchange-disconnected', (event) => {
      console.warn('⚠️ Exchange disconnected', event);
      this.emit('exchange-disconnected', event);
    });

    this.exchangeManager.on('exchange-connection-lost', (event) => {
      console.error('❌ Exchange connection lost', event);
      this.emit('exchange-connection-lost', event);
    });

    // Trade executor events
    this.tradeExecutor.on('trade-executed', (event) => {
      console.log('✅ Trade executed', event);
      this.emit('trade-executed', event);
    });

    this.tradeExecutor.on('trade-failed', (event) => {
      console.error('❌ Trade failed', event);
      this.emit('trade-failed', event);
    });

    this.tradeExecutor.on('order-cancelled', (event) => {
      console.log('🚫 Order cancelled', event);
      this.emit('order-cancelled', event);
    });
  }
}

// Export singleton instance
export const botManager = BotManager.getInstance(); 