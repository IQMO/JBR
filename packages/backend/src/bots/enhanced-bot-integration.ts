/**
 * Enhanced Bot Runtime Integration Documentation
 * 
 * This file demonstrates the enhanced state persistence and graceful shutdown
 * features integrated into the bot runtime system for Task 36.7.
 * 
 * Key Features Implemented:
 * 1. StateManager - Comprehensive state persistence with backups and recovery
 * 2. GracefulShutdownManager - Enhanced shutdown procedures with position/order handling
 * 3. Enhanced BotRuntime - Integration of both managers with existing bot lifecycle
 * 
 * Usage Examples:
 */

import type { BotRuntime} from './bot-runtime';
import { BotRuntimeConfig } from './bot-runtime';
import GracefulShutdownManager from './graceful-shutdown-manager';
import StateManager from './state-manager';

/**
 * Example 1: Creating Enhanced State Manager
 */
export function createStateManager(): StateManager {
  return new StateManager({
    enableIncrementalUpdates: true,    // Enable real-time state updates
    enableCompression: true,           // Compress large state data
    backupInterval: 300000,           // Create backup every 5 minutes
    maxBackups: 48,                   // Keep 48 backups (8 hours worth)
    enableIntegrityChecks: true,      // Verify state integrity
    autoRecovery: true,               // Automatically recover from failures
    emergencyBackupThreshold: 3      // Emergency backup after 3 errors
  });
}

/**
 * Example 2: Creating Enhanced Graceful Shutdown Manager
 */
export function createShutdownManager(stateManager: StateManager): GracefulShutdownManager {
  return new GracefulShutdownManager(stateManager, {
    gracePeriod: 60000,              // 1 minute total shutdown time
    positionTimeout: 30000,          // 30 seconds to close positions
    orderTimeout: 15000,             // 15 seconds to cancel orders  
    backupTimeout: 10000,            // 10 seconds to create backup
    forceKillDelay: 5000,           // 5 seconds before force termination
    enablePositionClosure: true,     // Close positions on shutdown
    enableOrderCancellation: true,   // Cancel orders on shutdown
    enableEmergencyBackup: true,     // Create emergency backup
    retryAttempts: 3                // Retry failed operations 3 times
  });
}

/**
 * Example 3: State Management Operations
 */
export class StateManagementExample {
  private stateManager: StateManager;
  private botId = 'example-bot-001';

  constructor() {
    this.stateManager = createStateManager();
  }

  /**
   * Create manual backup before important operations
   */
  async createBackupBeforeOperation(operation: string): Promise<void> {
    const currentState = {
      status: 'running',
      performance: { totalTrades: 10, winRate: 0.7 },
      positions: [{ symbol: 'BTCUSDT', size: 0.1, pnl: 150 }],
      orders: [{ id: 'order-123', symbol: 'BTCUSDT', status: 'pending' }]
    };

    await this.stateManager.createBackup(
      this.botId,
      'manual',
      `Pre-operation backup: ${operation}`,
      currentState
    );
  }

  /**
   * Recover from backup if something goes wrong
   */
  async recoverFromBackup(backupId?: string): Promise<void> {
    const snapshot = await this.stateManager.recoverFromBackup(this.botId, {
      backupId,                    // Specific backup or latest if undefined
      restorePositions: true,      // Restore open positions
      restoreOrders: true,         // Restore pending orders
      restoreConfiguration: true,   // Restore bot configuration
      restoreStrategy: true,       // Restore strategy state
      validateIntegrity: true      // Verify backup integrity
    });

    console.log('✅ State recovered:', {
      version: snapshot.version,
      timestamp: snapshot.timestamp
    });
  }

  /**
   * Get backup history for analysis
   */
  async getBackupHistory(): Promise<void> {
    const history = await this.stateManager.getBackupHistory(this.botId, 10);
    
    console.log('📦 Backup History:');
    history.forEach(backup => {
      console.log(`  ${backup.id}: ${backup.type} - ${backup.reason} (${backup.size} bytes)`);
    });
  }
}

/**
 * Example 4: Graceful Shutdown Operations  
 */
export class ShutdownExample {
  private shutdownManager: GracefulShutdownManager;
  private botId = 'example-bot-001';

  constructor(stateManager: StateManager) {
    this.shutdownManager = createShutdownManager(stateManager);
  }

  /**
   * Initiate graceful shutdown with full procedure
   */
  async initiateGracefulShutdown(): Promise<void> {
    const currentState = {
      status: 'running',
      positions: [{ symbol: 'BTCUSDT', size: 0.1 }],
      orders: [{ id: 'order-123', status: 'pending' }]
    };

    await this.shutdownManager.initiateShutdown(
      this.botId,
      'User requested shutdown',
      undefined,
      currentState
    );
  }

  /**
   * Emergency shutdown for critical situations
   */
  async emergencyShutdown(): Promise<void> {
    await this.shutdownManager.emergencyShutdown(
      this.botId,
      'Critical error detected'
    );
  }

  /**
   * Check shutdown status
   */
  getShutdownStatus(): any {
    return this.shutdownManager.getShutdownStatus(this.botId);
  }
}

/**
 * Example 5: Enhanced Bot Runtime Usage
 * 
 * This shows how the enhanced features are automatically integrated
 * into the existing BotRuntime class.
 */
export class EnhancedBotRuntimeExample {
  private botRuntime: BotRuntime | undefined;

  /**
   * The BotRuntime now automatically includes:
   * - Enhanced state persistence via StateManager
   * - Graceful shutdown via GracefulShutdownManager  
   * - Position and order state tracking
   * - Automatic backup creation
   * - State recovery on startup
   */
  async demonstrateEnhancedFeatures(): Promise<void> {
    if (!this.botRuntime) {return;}

    // 1. State is automatically persisted during bot execution
    console.log('📊 Current state statistics:', this.botRuntime.getStateStatistics());

    // 2. Manual backup creation
    await this.botRuntime.createManualBackup('Before strategy change');

    // 3. Position updates are automatically tracked
    this.botRuntime.updatePosition('BTCUSDT', {
      size: 0.1,
      entryPrice: 50000,
      currentPrice: 51000,
      pnl: 100
    });

    // 4. Order updates are automatically tracked  
    this.botRuntime.updateOrder({
      id: 'order-123',
      symbol: 'BTCUSDT',
      type: 'market',
      status: 'filled',
      size: 0.1,
      price: 51000
    });

    // 5. Scheduled backups happen automatically
    await this.botRuntime.createScheduledBackup();

    // 6. Enhanced graceful shutdown is triggered automatically on process signals
    // (SIGINT, SIGTERM) or when bot.stop() is called
  }
}

/**
 * Database Schema Requirements
 * 
 * The enhanced state persistence requires the following database tables:
 * 
 * 1. bot_states - Enhanced with versioning and integrity checks
 * 2. bot_state_backups - Comprehensive backup storage  
 * 3. state_persistence_metadata - Metadata tracking
 * 4. bot_shutdown_log - Audit log for shutdown procedures
 * 5. bot_recovery_log - Audit log for state recovery
 * 
 * See: packages/backend/src/database/migrations/004_enhanced_state_persistence.sql
 */

export const EnhancedStateManagementDocumentation = {
  StateManager: 'Comprehensive state persistence with backups, compression, and integrity checks',
  GracefulShutdownManager: 'Enhanced shutdown with position closure, order cancellation, and emergency procedures',
  BotRuntime: 'Integrated with both managers for seamless state persistence and graceful shutdown',
  DatabaseMigration: 'New tables for enhanced state tracking and audit logging',
  AutomaticFeatures: [
    'State persistence on every bot tick',
    'Automatic state recovery on startup', 
    'Scheduled backup creation',
    'Emergency backups on errors',
    'Graceful shutdown on process signals',
    'Position and order state tracking',
    'Backup cleanup and rotation'
  ],
  ManualOperations: [
    'Create manual backups',
    'Recover from specific backups', 
    'View backup history',
    'Emergency shutdown',
    'State statistics monitoring'
  ]
};

export default EnhancedStateManagementDocumentation;
