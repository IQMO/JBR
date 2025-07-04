/**
 * Enhanced Graceful Shutdown Manager
 * 
 * Provides comprehensive shutdown procedures for bots including:
 * - Position closure and order cancellation
 * - State persistence and backup creation
 * - Resource cleanup and service termination
 * - Configurable shutdown timeouts and priorities
 */

import { EventEmitter } from 'events';

import logger from '../services/logging.service';

import type StateManager from './state-manager';

export interface ShutdownConfig {
  gracePeriod: number; // Total time allowed for graceful shutdown (ms)
  positionTimeout: number; // Time to close positions (ms)
  orderTimeout: number; // Time to cancel orders (ms)
  backupTimeout: number; // Time to create backup (ms)
  forceKillDelay: number; // Delay before force termination (ms)
  enablePositionClosure: boolean; // Whether to close positions on shutdown
  enableOrderCancellation: boolean; // Whether to cancel orders on shutdown
  enableEmergencyBackup: boolean; // Whether to create emergency backup
  retryAttempts: number; // Number of retry attempts for operations
}

export interface ShutdownStep {
  name: string;
  priority: number; // Lower numbers execute first
  timeout: number;
  retryable: boolean;
  execute: () => Promise<void>;
}

export interface ShutdownContext {
  botId: string;
  reason: string;
  signal?: string;
  startedAt: Date;
  steps: ShutdownStep[];
  completedSteps: string[];
  failedSteps: string[];
  currentState: any;
}

export class GracefulShutdownManager extends EventEmitter {
  private config: ShutdownConfig;
  private stateManager: StateManager;
  private shutdownContexts: Map<string, ShutdownContext> = new Map();
  private isShuttingDown = false;

  constructor(
    stateManager: StateManager,
    config: Partial<ShutdownConfig> = {}
  ) {
    super();

    this.stateManager = stateManager;
    this.config = {
      gracePeriod: 60000, // 1 minute
      positionTimeout: 30000, // 30 seconds
      orderTimeout: 15000, // 15 seconds
      backupTimeout: 10000, // 10 seconds
      forceKillDelay: 5000, // 5 seconds
      enablePositionClosure: true,
      enableOrderCancellation: true,
      enableEmergencyBackup: true,
      retryAttempts: 3,
      ...config
    };

    this.setupSignalHandlers();
  }

  /**
   * Initiate graceful shutdown for a bot
   */
  async initiateShutdown(
    botId: string,
    reason: string,
    signal?: string,
    currentState?: any
  ): Promise<void> {
    if (this.shutdownContexts.has(botId)) {
      logger.warn('[GracefulShutdown] Shutdown already in progress', { botId });
      return;
    }

    logger.info('[GracefulShutdown] Initiating graceful shutdown', {
      botId,
      reason,
      signal
    });

    const context: ShutdownContext = {
      botId,
      reason,
      signal,
      startedAt: new Date(),
      steps: this.createShutdownSteps(botId, currentState),
      completedSteps: [],
      failedSteps: [],
      currentState: currentState || {}
    };

    this.shutdownContexts.set(botId, context);
    this.emit('shutdown-initiated', context);

    try {
      await this.executeShutdownSequence(context);
      
      logger.info('[GracefulShutdown] Graceful shutdown completed', {
        botId,
        duration: Date.now() - context.startedAt.getTime(),
        completedSteps: context.completedSteps.length,
        failedSteps: context.failedSteps.length
      });

      this.emit('shutdown-completed', context);
    } catch (error) {
      logger.error('[GracefulShutdown] Shutdown failed', {
        botId,
        error: error instanceof Error ? error.message : String(error),
        context
      });

      this.emit('shutdown-failed', { context, error });
      
      // Force termination after delay
      setTimeout(() => {
        this.forceTermination(botId, 'Graceful shutdown failed');
      }, this.config.forceKillDelay);
    } finally {
      this.shutdownContexts.delete(botId);
    }
  }

  /**
   * Execute shutdown sequence with timeout and retry handling
   */
  private async executeShutdownSequence(context: ShutdownContext): Promise<void> {
    const { botId, steps } = context;
    
    // Sort steps by priority
    const sortedSteps = steps.sort((a, b) => a.priority - b.priority);
    
    const overallTimeout = setTimeout(() => {
      throw new Error(`Shutdown sequence timeout after ${this.config.gracePeriod}ms`);
    }, this.config.gracePeriod);

    try {
      for (const step of sortedSteps) {
        await this.executeStep(context, step);
      }
    } finally {
      clearTimeout(overallTimeout);
    }
  }

  /**
   * Execute individual shutdown step with timeout and retry
   */
  private async executeStep(context: ShutdownContext, step: ShutdownStep): Promise<void> {
    const { botId } = context;
    let attempts = 0;
    let lastError: Error | null = null;

    logger.info('[GracefulShutdown] Executing step', {
      botId,
      step: step.name,
      priority: step.priority,
      timeout: step.timeout
    });

    this.emit('step-started', { context, step });

    while (attempts <= this.config.retryAttempts) {
      const stepTimeout = setTimeout(() => {
        throw new Error(`Step '${step.name}' timeout after ${step.timeout}ms`);
      }, step.timeout);

      try {
        await step.execute();
        clearTimeout(stepTimeout);
        
        context.completedSteps.push(step.name);
        
        logger.info('[GracefulShutdown] Step completed', {
          botId,
          step: step.name,
          attempts: attempts + 1
        });

        this.emit('step-completed', { context, step });
        return;
      } catch (error) {
        clearTimeout(stepTimeout);
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;

        logger.warn('[GracefulShutdown] Step failed', {
          botId,
          step: step.name,
          attempt: attempts,
          error: lastError.message,
          retryable: step.retryable
        });

        if (!step.retryable || attempts > this.config.retryAttempts) {
          break;
        }

        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts - 1) * 1000));
      }
    }

    // Step failed after all attempts
    context.failedSteps.push(step.name);
    
    logger.error('[GracefulShutdown] Step failed permanently', {
      botId,
      step: step.name,
      attempts,
      error: lastError?.message
    });

    this.emit('step-failed', { context, step, error: lastError });

    // Continue with other steps unless this is critical
    if (step.name.includes('backup') || step.name.includes('state')) {
      // Non-critical steps, continue
      return;
    }

    throw lastError || new Error(`Step '${step.name}' failed after ${attempts} attempts`);
  }

  /**
   * Create shutdown steps based on configuration
   */
  private createShutdownSteps(botId: string, currentState: any): ShutdownStep[] {
    const steps: ShutdownStep[] = [];

    // Step 1: Cancel all pending orders
    if (this.config.enableOrderCancellation) {
      steps.push({
        name: 'cancel-orders',
        priority: 1,
        timeout: this.config.orderTimeout,
        retryable: true,
        execute: async () => {
          await this.cancelAllOrders(botId, currentState);
        }
      });
    }

    // Step 2: Close all positions
    if (this.config.enablePositionClosure) {
      steps.push({
        name: 'close-positions',
        priority: 2,
        timeout: this.config.positionTimeout,
        retryable: true,
        execute: async () => {
          await this.closeAllPositions(botId, currentState);
        }
      });
    }

    // Step 3: Create emergency backup
    if (this.config.enableEmergencyBackup) {
      steps.push({
        name: 'create-backup',
        priority: 3,
        timeout: this.config.backupTimeout,
        retryable: true,
        execute: async () => {
          await this.createEmergencyBackup(botId, currentState);
        }
      });
    }

    // Step 4: Persist final state
    steps.push({
      name: 'persist-state',
      priority: 4,
      timeout: this.config.backupTimeout,
      retryable: true,
      execute: async () => {
        await this.persistFinalState(botId, currentState);
      }
    });

    // Step 5: Cleanup resources
    steps.push({
      name: 'cleanup-resources',
      priority: 5,
      timeout: 5000,
      retryable: false,
      execute: async () => {
        await this.cleanupResources(botId);
      }
    });

    // Step 6: Stop services
    steps.push({
      name: 'stop-services',
      priority: 6,
      timeout: 5000,
      retryable: false,
      execute: async () => {
        await this.stopServices(botId);
      }
    });

    return steps;
  }

  /**
   * Cancel all pending orders
   */
  private async cancelAllOrders(botId: string, currentState: any): Promise<void> {
    try {
      const pendingOrders = currentState.orders?.filter(
        (order: any) => order.status === 'pending' || order.status === 'open'
      ) || [];

      if (pendingOrders.length === 0) {
        logger.info('[GracefulShutdown] No pending orders to cancel', { botId });
        return;
      }

      logger.info('[GracefulShutdown] Cancelling orders', {
        botId,
        orderCount: pendingOrders.length
      });

      // This would integrate with the exchange service
      // For now, we'll simulate the cancellation
      for (const order of pendingOrders) {
        logger.info('[GracefulShutdown] Cancelling order', {
          botId,
          orderId: order.id,
          symbol: order.symbol
        });
        
        // TODO: Integrate with actual exchange cancellation
        // await exchangeService.cancelOrder(order.id);
      }

      this.emit('orders-cancelled', { botId, orderCount: pendingOrders.length });
    } catch (error) {
      logger.error('[GracefulShutdown] Failed to cancel orders', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Close all open positions
   */
  private async closeAllPositions(botId: string, currentState: any): Promise<void> {
    try {
      const openPositions = currentState.positions?.filter(
        (position: any) => position.size !== 0
      ) || [];

      if (openPositions.length === 0) {
        logger.info('[GracefulShutdown] No open positions to close', { botId });
        return;
      }

      logger.info('[GracefulShutdown] Closing positions', {
        botId,
        positionCount: openPositions.length
      });

      // This would integrate with the exchange service
      for (const position of openPositions) {
        logger.info('[GracefulShutdown] Closing position', {
          botId,
          symbol: position.symbol,
          size: position.size,
          pnl: position.pnl
        });
        
        // TODO: Integrate with actual position closure
        // await exchangeService.closePosition(position.symbol, position.size);
      }

      this.emit('positions-closed', { botId, positionCount: openPositions.length });
    } catch (error) {
      logger.error('[GracefulShutdown] Failed to close positions', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create emergency backup
   */
  private async createEmergencyBackup(botId: string, currentState: any): Promise<void> {
    try {
      logger.info('[GracefulShutdown] Creating emergency backup', { botId });
      
      await this.stateManager.createEmergencyBackup(
        botId,
        currentState,
        'Graceful shutdown emergency backup'
      );

      this.emit('backup-created', { botId });
    } catch (error) {
      logger.error('[GracefulShutdown] Failed to create emergency backup', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Persist final state
   */
  private async persistFinalState(botId: string, currentState: any): Promise<void> {
    try {
      logger.info('[GracefulShutdown] Persisting final state', { botId });
      
      const finalState = {
        ...currentState,
        status: 'shutdown',
        shutdownAt: new Date(),
        runtimeMetrics: {
          ...currentState.runtimeMetrics,
          lastTickAt: new Date(),
          shutdownAt: new Date()
        }
      };

      const snapshot = await this.stateManager.createSnapshot(botId, finalState);
      await this.stateManager.saveSnapshot(snapshot);

      this.emit('state-persisted', { botId });
    } catch (error) {
      logger.error('[GracefulShutdown] Failed to persist final state', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanupResources(botId: string): Promise<void> {
    try {
      logger.info('[GracefulShutdown] Cleaning up resources', { botId });
      
      // Clear timers, intervals, subscriptions, etc.
      // This would be bot-specific cleanup
      
      this.emit('resources-cleaned', { botId });
    } catch (error) {
      logger.error('[GracefulShutdown] Failed to cleanup resources', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Stop services
   */
  private async stopServices(botId: string): Promise<void> {
    try {
      logger.info('[GracefulShutdown] Stopping services', { botId });
      
      // Stop websocket connections, database connections, etc.
      // This would integrate with service managers
      
      this.emit('services-stopped', { botId });
    } catch (error) {
      logger.error('[GracefulShutdown] Failed to stop services', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Force termination as last resort
   */
  private forceTermination(botId: string, reason: string): void {
    logger.error('[GracefulShutdown] Force terminating bot', { botId, reason });
    
    this.emit('force-termination', { botId, reason });
    
    // This would forcefully terminate the bot process
    // Implementation depends on how bots are managed (child processes, workers, etc.)
  }

  /**
   * Setup signal handlers for process-wide shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        if (this.isShuttingDown) {return;}
        
        this.isShuttingDown = true;
        logger.info('[GracefulShutdown] Process signal received', { signal });
        
        this.emit('process-shutdown-signal', { signal });
        
        // Initiate shutdown for all active bots
        const activeBots = Array.from(this.shutdownContexts.keys());
        
        Promise.all(
          activeBots.map(botId =>
            this.initiateShutdown(botId, `Process ${signal}`, signal)
          )
        ).finally(() => {
          logger.info('[GracefulShutdown] All bots shutdown complete');
          process.exit(0);
        });
      });
    });
  }

  /**
   * Get shutdown status for a bot
   */
  getShutdownStatus(botId: string): ShutdownContext | null {
    return this.shutdownContexts.get(botId) || null;
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(botId?: string): boolean {
    if (botId) {
      return this.shutdownContexts.has(botId);
    }
    return this.shutdownContexts.size > 0 || this.isShuttingDown;
  }

  /**
   * Emergency shutdown (skip graceful procedures)
   */
  async emergencyShutdown(botId: string, reason: string): Promise<void> {
    logger.warn('[GracefulShutdown] Emergency shutdown initiated', { botId, reason });
    
    try {
      // Only perform critical operations
      const currentState = {}; // Get from bot runtime
      
      await this.createEmergencyBackup(botId, currentState);
      await this.persistFinalState(botId, currentState);
      
      this.emit('emergency-shutdown', { botId, reason });
    } catch (error) {
      logger.error('[GracefulShutdown] Emergency shutdown failed', {
        botId,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Cleanup and shutdown the manager itself
   */
  shutdown(): void {
    logger.info('[GracefulShutdown] Shutting down graceful shutdown manager');
    
    // Cancel any ongoing shutdowns
    this.shutdownContexts.clear();
    this.isShuttingDown = true;
    
    this.removeAllListeners();
    
    logger.info('[GracefulShutdown] Graceful shutdown manager stopped');
  }
}

export default GracefulShutdownManager;
