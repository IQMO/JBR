/**
 * Enhanced State Persistence Manager
 * 
 * Provides comprehensive state persistence and recovery capabilities for bots.
 * Handles state snapshots, incremental updates, backup management, and
 * recovery from various failtaure scenarios.
 */

import { EventEmitter } from 'events';

import { database } from '../services/database.service';
import logger from '../services/logging.service';

export interface BotStateSnapshot {
  botId: string;
  timestamp: Date;
  version: number;
  state: {
    status: string;
    performance: {
      totalTrades: number;
      successfulTrades: number;
      totalProfit: number;
      totalLoss: number;
      winRate: number;
      avgTradeTime: number;
      maxDrawdown: number;
      errorCount: number;
    };
    configuration: Record<string, unknown>;
    positions: Array<{
      symbol: string;
      size: number;
      entryPrice: number;
      currentPrice: number;
      pnl: number;
      openedAt: Date;
    }>;
    orders: Array<{
      id: string;
      symbol: string;
      type: string;
      status: string;
      size: number;
      price: number;
      createdAt: Date;
    }>;
    strategy: {
      type: string;
      parameters: Record<string, unknown>;
      indicators: Record<string, unknown>;
      signals: Array<{
        type: string;
        strength: number;
        timestamp: Date;
      }>;
    };
    runtimeMetrics: {
      startedAt: Date;
      lastTickAt: Date;
      tickCount: number;
      errorCount: number;
      lastError?: string;
      memoryUsage: number;
      cpuUsage: number;
    };
  };
  checksum: string;
}

export interface StateBackup {
  id: string;
  botId: string;
  createdAt: Date;
  type: 'scheduled' | 'manual' | 'pre-restart' | 'emergency';
  reason: string;
  snapshot: BotStateSnapshot;
  compressed: boolean;
  size: number;
}

export interface RecoveryOptions {
  backupId?: string;
  targetTimestamp?: Date;
  restorePositions: boolean;
  restoreOrders: boolean;
  restoreConfiguration: boolean;
  restoreStrategy: boolean;
  validateIntegrity: boolean;
}

export interface PersistenceConfig {
  enableIncrementalUpdates: boolean;
  enableCompression: boolean;
  backupInterval: number; // milliseconds
  maxBackups: number;
  enableIntegrityChecks: boolean;
  autoRecovery: boolean;
  emergencyBackupThreshold: number; // errors before emergency backup
}

export class StateManager extends EventEmitter {
  private config: PersistenceConfig;
  private backupInterval: NodeJS.Timeout | null = null;
  private lastBackupTime: Map<string, Date> = new Map();
  private stateVersions: Map<string, number> = new Map();

  constructor(config: Partial<PersistenceConfig> = {}) {
    super();

    this.config = {
      enableIncrementalUpdates: true,
      enableCompression: true,
      backupInterval: 300000, // 5 minutes
      maxBackups: 48, // Keep 48 backups (8 hours at 10min intervals)
      enableIntegrityChecks: true,
      autoRecovery: true,
      emergencyBackupThreshold: 5,
      ...config
    };

    this.startBackupScheduler();
  }

  /**
   * Create a complete state snapshot
   */
  async createSnapshot(
    botId: string,
    currentState: any,
    additionalData: Partial<BotStateSnapshot['state']> = {}
  ): Promise<BotStateSnapshot> {
    const version = (this.stateVersions.get(botId) || 0) + 1;
    this.stateVersions.set(botId, version);

    const snapshot: BotStateSnapshot = {
      botId,
      timestamp: new Date(),
      version,
      state: {
        status: currentState.status || 'unknown',
        performance: currentState.performance || {
          totalTrades: 0,
          successfulTrades: 0,
          totalProfit: 0,
          totalLoss: 0,
          winRate: 0,
          avgTradeTime: 0,
          maxDrawdown: 0,
          errorCount: 0
        },
        configuration: currentState.configuration || {},
        positions: additionalData.positions || [],
        orders: additionalData.orders || [],
        strategy: additionalData.strategy || {
          type: 'unknown',
          parameters: {},
          indicators: {},
          signals: []
        },
        runtimeMetrics: {
          startedAt: currentState.startedAt || new Date(),
          lastTickAt: currentState.lastTickAt || new Date(),
          tickCount: currentState.tickCount || 0,
          errorCount: currentState.errorCount || 0,
          lastError: currentState.lastError,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          cpuUsage: process.cpuUsage().user / 1000000 // seconds
        },
        ...additionalData
      },
      checksum: ''
    };

    // Calculate checksum for integrity verification
    snapshot.checksum = this.calculateChecksum(snapshot);

    return snapshot;
  }

  /**
   * Save state snapshot to database
   */
  async saveSnapshot(snapshot: BotStateSnapshot): Promise<void> {
    try {
      let stateData = JSON.stringify(snapshot.state);
      
      // Compress if enabled and data is large
      if (this.config.enableCompression && stateData.length > 1024) {
        stateData = await this.compressData(stateData);
      }

      await database.query(`
        INSERT INTO bot_states (
          bot_id, state, version, checksum, created_at, compressed
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (bot_id)
        DO UPDATE SET 
          state = $2, 
          version = $3, 
          checksum = $4, 
          updated_at = NOW(),
          compressed = $6
      `, [
        snapshot.botId,
        stateData,
        snapshot.version,
        snapshot.checksum,
        snapshot.timestamp,
        this.config.enableCompression && stateData.length > 1024
      ]);

      logger.info('[StateManager] State snapshot saved', {
        botId: snapshot.botId,
        version: snapshot.version,
        size: stateData.length
      });

      this.emit('snapshot-saved', snapshot);
    } catch (error) {
      logger.error('[StateManager] Failed to save state snapshot', {
        botId: snapshot.botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Load latest state snapshot
   */
  async loadSnapshot(botId: string): Promise<BotStateSnapshot | null> {
    try {
      const result = await database.query(
        'SELECT * FROM bot_states WHERE bot_id = $1 ORDER BY version DESC LIMIT 1',
        [botId]
      );

      if (result.length === 0) {
        return null;
      }

      const row = result.at(0);
      let stateData = row.state;

      // Decompress if necessary
      if (row.compressed) {
        stateData = await this.decompressData(stateData);
      }

      const snapshot: BotStateSnapshot = {
        botId: row.bot_id,
        timestamp: new Date(row.created_at),
        version: row.version,
        state: JSON.parse(stateData),
        checksum: row.checksum
      };

      // Verify integrity if enabled
      if (this.config.enableIntegrityChecks) {
        const calculatedChecksum = this.calculateChecksum(snapshot);
        if (calculatedChecksum !== snapshot.checksum) {
          throw new Error('State integrity check failed - checksum mismatch');
        }
      }

      logger.info('[StateManager] State snapshot loaded', {
        botId: snapshot.botId,
        version: snapshot.version,
        timestamp: snapshot.timestamp
      });

      this.emit('snapshot-loaded', snapshot);
      return snapshot;
    } catch (error) {
      logger.error('[StateManager] Failed to load state snapshot', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create backup with metadata
   */
  async createBackup(
    botId: string,
    type: StateBackup['type'],
    reason: string,
    currentState: any,
    additionalData?: Partial<BotStateSnapshot['state']>
  ): Promise<StateBackup> {
    try {
      const snapshot = await this.createSnapshot(botId, currentState, additionalData);
      const backupId = `${botId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      let snapshotData = JSON.stringify(snapshot);
      const originalSize = snapshotData.length;
      let compressed = false;

      if (this.config.enableCompression && originalSize > 1024) {
        snapshotData = await this.compressData(snapshotData);
        compressed = true;
      }

      const backup: StateBackup = {
        id: backupId,
        botId,
        createdAt: new Date(),
        type,
        reason,
        snapshot,
        compressed,
        size: snapshotData.length
      };

      // Save backup to database
      await database.query(`
        INSERT INTO bot_state_backups (
          id, bot_id, type, reason, snapshot_data, compressed, size, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        backupId,
        botId,
        type,
        reason,
        snapshotData,
        compressed,
        backup.size,
        backup.createdAt
      ]);

      this.lastBackupTime.set(botId, backup.createdAt);

      logger.info('[StateManager] Backup created', {
        backupId,
        botId,
        type,
        reason,
        size: backup.size,
        compressed
      });

      this.emit('backup-created', backup);

      // Clean up old backups
      await this.cleanupOldBackups(botId);

      return backup;
    } catch (error) {
      logger.error('[StateManager] Failed to create backup', {
        botId,
        type,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Recover state from backup
   */
  async recoverFromBackup(
    botId: string,
    options: RecoveryOptions = {
      restorePositions: true,
      restoreOrders: true,
      restoreConfiguration: true,
      restoreStrategy: true,
      validateIntegrity: true
    }
  ): Promise<BotStateSnapshot> {
    try {
      let backup: StateBackup;

      if (options.backupId) {
        // Recover from specific backup
        const result = await database.query(
          'SELECT * FROM bot_state_backups WHERE id = $1',
          [options.backupId]
        );
        
        if (result.length === 0) {
          throw new Error(`Backup not found: ${options.backupId}`);
        }

        backup = await this.deserializeBackup(result.at(0));
      } else if (options.targetTimestamp) {
        // Find backup closest to target timestamp
        const result = await database.query(`
          SELECT * FROM bot_state_backups 
          WHERE bot_id = $1 AND created_at <= $2 
          ORDER BY created_at DESC 
          LIMIT 1
        `, [botId, options.targetTimestamp]);

        if (result.length === 0) {
          throw new Error('No backup found for target timestamp');
        }

        backup = await this.deserializeBackup(result.at(0));
      } else {
        // Use latest backup
        const result = await database.query(`
          SELECT * FROM bot_state_backups 
          WHERE bot_id = $1 
          ORDER BY created_at DESC 
          LIMIT 1
        `, [botId]);

        if (result.length === 0) {
          throw new Error('No backups found for bot');
        }

        backup = await this.deserializeBackup(result.at(0));
      }

      // Validate integrity if requested
      if (options.validateIntegrity && this.config.enableIntegrityChecks) {
        const calculatedChecksum = this.calculateChecksum(backup.snapshot);
        if (calculatedChecksum !== backup.snapshot.checksum) {
          throw new Error('Backup integrity check failed');
        }
      }

      // Create recovery snapshot with selective restore
      const recoverySnapshot: BotStateSnapshot = {
        ...backup.snapshot,
        timestamp: new Date(),
        version: (this.stateVersions.get(botId) || 0) + 1
      };

      // Selective restoration based on options
      if (!options.restorePositions) {
        recoverySnapshot.state.positions = [];
      }
      
      if (!options.restoreOrders) {
        recoverySnapshot.state.orders = [];
      }
      
      if (!options.restoreConfiguration) {
        recoverySnapshot.state.configuration = {};
      }
      
      if (!options.restoreStrategy) {
        recoverySnapshot.state.strategy = {
          type: 'unknown',
          parameters: {},
          indicators: {},
          signals: []
        };
      }

      // Update checksum after modifications
      recoverySnapshot.checksum = this.calculateChecksum(recoverySnapshot);

      // Save recovered state
      await this.saveSnapshot(recoverySnapshot);

      logger.info('[StateManager] State recovered from backup', {
        botId,
        backupId: backup.id,
        backupCreatedAt: backup.createdAt,
        options
      });

      this.emit('state-recovered', { backup, recoverySnapshot, options });

      return recoverySnapshot;
    } catch (error) {
      logger.error('[StateManager] Failed to recover from backup', {
        botId,
        options,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Incremental state update
   */
  async updateState(
    botId: string,
    updates: Partial<BotStateSnapshot['state']>
  ): Promise<void> {
    if (!this.config.enableIncrementalUpdates) {
      return;
    }

    try {
      const currentSnapshot = await this.loadSnapshot(botId);
      if (!currentSnapshot) {
        throw new Error('No existing state found for incremental update');
      }

      // Merge updates with existing state
      const updatedState = {
        ...currentSnapshot.state,
        ...updates,
        runtimeMetrics: {
          ...currentSnapshot.state.runtimeMetrics,
          ...updates.runtimeMetrics,
          lastTickAt: new Date()
        }
      };

      const newSnapshot: BotStateSnapshot = {
        ...currentSnapshot,
        timestamp: new Date(),
        version: currentSnapshot.version + 1,
        state: updatedState
      };

      newSnapshot.checksum = this.calculateChecksum(newSnapshot);
      await this.saveSnapshot(newSnapshot);

      this.emit('state-updated', { botId, updates, newSnapshot });
    } catch (error) {
      logger.error('[StateManager] Failed to update state incrementally', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Emergency backup (triggered by errors)
   */
  async createEmergencyBackup(
    botId: string,
    currentState: any,
    errorContext: string
  ): Promise<void> {
    try {
      await this.createBackup(
        botId,
        'emergency',
        `Emergency backup due to: ${errorContext}`,
        currentState
      );

      logger.warn('[StateManager] Emergency backup created', {
        botId,
        errorContext
      });
    } catch (error) {
      logger.error('[StateManager] Failed to create emergency backup', {
        botId,
        errorContext,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get backup history
   */
  async getBackupHistory(
    botId: string,
    limit = 10
  ): Promise<Array<Omit<StateBackup, 'snapshot'>>> {
    try {
      const result = await database.query(`
        SELECT id, bot_id, type, reason, size, compressed, created_at
        FROM bot_state_backups 
        WHERE bot_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [botId, limit]);

      return result.map(row => ({
        id: row.id,
        botId: row.bot_id,
        createdAt: new Date(row.created_at),
        type: row.type,
        reason: row.reason,
        compressed: row.compressed,
        size: row.size,
        snapshot: null as any // Exclude snapshot data for performance
      }));
    } catch (error) {
      logger.error('[StateManager] Failed to get backup history', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private startBackupScheduler(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(async () => {
      // This would be triggered by the bot runtime to create scheduled backups
      this.emit('scheduled-backup-required');
    }, this.config.backupInterval);
  }

  private async cleanupOldBackups(botId: string): Promise<void> {
    try {
      await database.query(`
        DELETE FROM bot_state_backups 
        WHERE bot_id = $1 
        AND id NOT IN (
          SELECT id FROM bot_state_backups 
          WHERE bot_id = $1 
          ORDER BY created_at DESC 
          LIMIT $2
        )
      `, [botId, this.config.maxBackups]);
    } catch (error) {
      logger.warn('[StateManager] Failed to cleanup old backups', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private calculateChecksum(snapshot: BotStateSnapshot): string {
    const crypto = require('crypto');
    const data = JSON.stringify({
      ...snapshot,
      checksum: undefined // Exclude checksum from checksum calculation
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async compressData(data: string): Promise<string> {
    const zlib = require('zlib');
    const compressed = zlib.gzipSync(data);
    return compressed.toString('base64');
  }

  private async decompressData(compressedData: string): Promise<string> {
    const zlib = require('zlib');
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = zlib.gunzipSync(buffer);
    return decompressed.toString();
  }

  private async deserializeBackup(row: any): Promise<StateBackup> {
    let snapshotData = row.snapshot_data;
    
    if (row.compressed) {
      snapshotData = await this.decompressData(snapshotData);
    }

    return {
      id: row.id,
      botId: row.bot_id,
      createdAt: new Date(row.created_at),
      type: row.type,
      reason: row.reason,
      snapshot: JSON.parse(snapshotData),
      compressed: row.compressed,
      size: row.size
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    this.removeAllListeners();
    logger.info('[StateManager] State manager shutdown complete');
  }
}

export default StateManager;
