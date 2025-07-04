/**
 * Bot Error Handling and Recovery Integration
 * 
 * Integrates all error handling, recovery, and monitoring components
 * to provide a comprehensive bot reliability system.
 */

import { EventEmitter } from 'events';

import logger from '../services/logging.service';

import type { BotManager } from './bot-manager';
import { BotRuntime } from './bot-runtime';
import type { WatchdogConfig } from './bot-watchdog';
import { BotWatchdog } from './bot-watchdog';
import type { RecoveryConfig } from './error-recovery-manager';
import { ErrorRecoveryManager } from './error-recovery-manager';
import HealthCheckService from './health-check.service';

export interface BotReliabilityConfig {
  errorRecovery: Partial<RecoveryConfig>;
  watchdog: Partial<WatchdogConfig>;
  integration: {
    enableAutoRestarts: boolean;
    enableFailoverMode: boolean;
    maxSystemErrors: number;
    systemErrorWindow: number; // milliseconds
    alertWebhookUrl?: string;
    enableMetricsCollection: boolean;
  };
}

export interface SystemAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  source: 'error-recovery' | 'watchdog' | 'health-check' | 'system';
  title: string;
  message: string;
  botId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class BotReliabilitySystem extends EventEmitter {
  private config: BotReliabilityConfig;
  private errorRecoveryManager!: ErrorRecoveryManager;
  private botWatchdog!: BotWatchdog;
  private healthCheckService!: HealthCheckService;
  private botManager: BotManager;
  
  private systemErrorCount = 0;
  private systemErrorWindow: NodeJS.Timeout | null = null;
  private alertHistory: SystemAlert[] = [];
  private running = false;

  constructor(
    botManager: BotManager,
    config: Partial<BotReliabilityConfig> = {}
  ) {
    super();

    this.botManager = botManager;
    this.config = {
      errorRecovery: {
        maxRetries: 3,
        baseRetryDelay: 1000,
        maxRetryDelay: 30000,
        enableAutoRestart: true,
        alertThreshold: 10,
        ...config.errorRecovery
      },
      watchdog: {
        healthCheckInterval: 30000,
        enableAutoRestart: true,
        restartThreshold: 3,
        alertOnRestart: true,
        ...config.watchdog
      },
      integration: {
        enableAutoRestarts: true,
        enableFailoverMode: false,
        maxSystemErrors: 20,
        systemErrorWindow: 300000, // 5 minutes
        enableMetricsCollection: true,
        ...config.integration
      }
    };

    this.initializeComponents();
    this.setupIntegrationEvents();
  }

  /**
   * Initialize all reliability components
   */
  private initializeComponents(): void {
    // Initialize Error Recovery Manager
    this.errorRecoveryManager = new ErrorRecoveryManager(this.config.errorRecovery);

    // Initialize Bot Watchdog
    this.botWatchdog = new BotWatchdog(
      this.botManager,
      this.errorRecoveryManager,
      this.config.watchdog
    );

    // Initialize Health Check Service
    this.healthCheckService = new HealthCheckService(
      this.botManager,
      this.errorRecoveryManager,
      this.botWatchdog
    );

    logger.info('[BotReliability] Initialized all reliability components');
  }

  /**
   * Setup integration event handlers
   */
  private setupIntegrationEvents(): void {
    // Error Recovery Manager Events
    this.errorRecoveryManager.on('error', (errorRecord) => {
      this.handleErrorRecoveryEvent('error', errorRecord);
    });

    this.errorRecoveryManager.on('recovery', (errorRecord) => {
      this.handleErrorRecoveryEvent('recovery', errorRecord);
    });

    this.errorRecoveryManager.on('recovery-failed', (errorRecord) => {
      this.handleErrorRecoveryEvent('recovery-failed', errorRecord);
    });

    this.errorRecoveryManager.on('admin-alert', (errorRecord) => {
      this.sendAlert({
        level: 'critical',
        source: 'error-recovery',
        title: 'Admin Intervention Required',
        message: `Bot ${errorRecord.context.botId} requires admin intervention: ${errorRecord.context.errorMessage}`,
        botId: errorRecord.context.botId,
        timestamp: new Date(),
        metadata: { errorRecord }
      });
    });

    this.errorRecoveryManager.on('restart-required', (errorRecord) => {
      this.handleBotRestartRequest(errorRecord.context.botId, 'error-recovery');
    });

    this.errorRecoveryManager.on('alert-threshold-exceeded', (data) => {
      this.sendAlert({
        level: 'error',
        source: 'error-recovery',
        title: 'Error Threshold Exceeded',
        message: `Bot ${data.botId} has exceeded error threshold: ${data.errorCount}/${data.threshold}`,
        botId: data.botId,
        timestamp: new Date(),
        metadata: data
      });
    });

    // Bot Watchdog Events
    this.botWatchdog.on('bot-unhealthy', (healthResult) => {
      this.sendAlert({
        level: 'warning',
        source: 'watchdog',
        title: 'Bot Health Degraded',
        message: `Bot ${healthResult.botId} is unhealthy: ${healthResult.issues.join(', ')}`,
        botId: healthResult.botId,
        timestamp: new Date(),
        metadata: { healthResult }
      });
    });

    this.botWatchdog.on('bot-restart-required', (data) => {
      this.handleBotRestartRequest(data.botId, 'watchdog');
    });

    this.botWatchdog.on('bot-restarted', (data) => {
      this.sendAlert({
        level: 'info',
        source: 'watchdog',
        title: 'Bot Restarted',
        message: `Bot ${data.botId} has been successfully restarted`,
        botId: data.botId,
        timestamp: new Date(),
        metadata: data
      });
    });

    this.botWatchdog.on('bot-restart-failed', (data) => {
      this.sendAlert({
        level: 'critical',
        source: 'watchdog',
        title: 'Bot Restart Failed',
        message: `Failed to restart bot ${data.botId}: ${data.error}`,
        botId: data.botId,
        timestamp: new Date(),
        metadata: data
      });

      this.incrementSystemErrorCount();
    });

    // Bot Manager Events
    this.botManager.on('bot-error', (data) => {
      this.handleBotError(data.botId, data.error);
    });

    this.botManager.on('bot-crashed', (data) => {
      this.sendAlert({
        level: 'critical',
        source: 'system',
        title: 'Bot Crashed',
        message: `Bot ${data.botId} has crashed: ${data.reason}`,
        botId: data.botId,
        timestamp: new Date(),
        metadata: data
      });

      this.incrementSystemErrorCount();
    });

    logger.info('[BotReliability] Setup integration event handlers');
  }

  /**
   * Start the reliability system
   */
  start(): void {
    if (this.running) {
      logger.warn('[BotReliability] System is already running');
      return;
    }

    this.running = true;
    
    logger.info('[BotReliability] Starting bot reliability system', {
      config: this.config
    });

    // Start all components
    this.botWatchdog.start();

    // Start system error window tracking
    this.resetSystemErrorWindow();

    this.sendAlert({
      level: 'info',
      source: 'system',
      title: 'Reliability System Started',
      message: 'Bot reliability system is now active and monitoring all bots',
      timestamp: new Date()
    });

    this.emit('started');
  }

  /**
   * Stop the reliability system
   */
  stop(): void {
    if (!this.running) {
      logger.warn('[BotReliability] System is not running');
      return;
    }

    this.running = false;

    logger.info('[BotReliability] Stopping bot reliability system');

    // Stop all components
    this.botWatchdog.stop();

    // Clear system error window
    if (this.systemErrorWindow) {
      clearTimeout(this.systemErrorWindow);
      this.systemErrorWindow = null;
    }

    this.sendAlert({
      level: 'info',
      source: 'system',
      title: 'Reliability System Stopped',
      message: 'Bot reliability system has been stopped',
      timestamp: new Date()
    });

    this.emit('stopped');
  }

  /**
   * Handle bot errors through the recovery system
   */
  async handleBotError(botId: string, error: Error): Promise<boolean> {
    logger.info('[BotReliability] Handling bot error', {
      botId,
      error: error.message
    });

    // Use error recovery manager to handle the error
    const recovered = await this.errorRecoveryManager.handleError(error, {
      botId,
      operation: 'bot-operation'
    });

    if (!recovered) {
      this.incrementSystemErrorCount();
    }

    return recovered;
  }

  /**
   * Handle error recovery events
   */
  private handleErrorRecoveryEvent(eventType: string, errorRecord: any): void {
    const alertLevel = this.getAlertLevelForRecoveryEvent(eventType);
    const message = this.getMessageForRecoveryEvent(eventType, errorRecord);

    if (alertLevel) {
      this.sendAlert({
        level: alertLevel,
        source: 'error-recovery',
        title: `Error Recovery: ${eventType}`,
        message,
        botId: errorRecord.context.botId,
        timestamp: new Date(),
        metadata: { errorRecord, eventType }
      });
    }

    // Emit for external listeners
    this.emit('error-recovery-event', { eventType, errorRecord });
  }

  /**
   * Handle bot restart requests
   */
  private async handleBotRestartRequest(botId: string, source: string): Promise<void> {
    if (!this.config.integration.enableAutoRestarts) {
      logger.warn('[BotReliability] Auto-restarts disabled, skipping restart', {
        botId,
        source
      });
      return;
    }

    logger.info('[BotReliability] Handling bot restart request', {
      botId,
      source
    });

    try {
      // The watchdog will handle the actual restart
      // We just track the request here
      this.emit('bot-restart-requested', { botId, source });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[BotReliability] Failed to handle restart request', {
        botId,
        source,
        error: errorMessage
      });

      this.incrementSystemErrorCount();
    }
  }

  /**
   * Increment system error count and check thresholds
   */
  private incrementSystemErrorCount(): void {
    this.systemErrorCount++;

    logger.warn('[BotReliability] System error count incremented', {
      count: this.systemErrorCount,
      threshold: this.config.integration.maxSystemErrors
    });

    if (this.systemErrorCount >= this.config.integration.maxSystemErrors) {
      this.sendAlert({
        level: 'critical',
        source: 'system',
        title: 'System Error Threshold Exceeded',
        message: `System has exceeded maximum error threshold: ${this.systemErrorCount}/${this.config.integration.maxSystemErrors}`,
        timestamp: new Date(),
        metadata: {
          errorCount: this.systemErrorCount,
          threshold: this.config.integration.maxSystemErrors,
          window: this.config.integration.systemErrorWindow
        }
      });

      // Consider entering failover mode or alerting operations
      if (this.config.integration.enableFailoverMode) {
        this.enterFailoverMode();
      }
    }
  }

  /**
   * Reset system error window
   */
  private resetSystemErrorWindow(): void {
    if (this.systemErrorWindow) {
      clearTimeout(this.systemErrorWindow);
    }

    this.systemErrorWindow = setTimeout(() => {
      logger.info('[BotReliability] Resetting system error count', {
        previousCount: this.systemErrorCount
      });
      
      this.systemErrorCount = 0;
      this.resetSystemErrorWindow();
    }, this.config.integration.systemErrorWindow);
  }

  /**
   * Enter failover mode (emergency procedure)
   */
  private async enterFailoverMode(): Promise<void> {
    logger.error('[BotReliability] Entering failover mode due to system errors');

    this.sendAlert({
      level: 'critical',
      source: 'system',
      title: 'System Entering Failover Mode',
      message: 'Too many system errors detected, entering emergency failover mode',
      timestamp: new Date()
    });

    // Stop all bots to prevent further damage
    try {
      const allBots = this.botManager.getAllBotsStatus();
      for (const botId of allBots.keys()) {
        try {
          await this.botManager.stopBot('system', botId);
          logger.info('[BotReliability] Stopped bot in failover mode', { botId });
        } catch (error) {
          logger.error('[BotReliability] Failed to stop bot in failover mode', {
            botId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('[BotReliability] Failed to execute failover procedure', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.emit('failover-mode-entered');
  }

  /**
   * Send system alert
   */
  private sendAlert(alert: SystemAlert): void {
    // Store alert in history
    this.alertHistory.push(alert);

    // Keep only recent alerts (last 1000)
    if (this.alertHistory.length > 1000) {
      this.alertHistory.splice(0, this.alertHistory.length - 1000);
    }

    // Log the alert
    const logLevel = alert.level === 'critical' ? 'error' : 
                    alert.level === 'error' ? 'error' :
                    alert.level === 'warning' ? 'warn' : 'info';

    logger[logLevel](`[BotReliability] ALERT: ${alert.title}`, {
      source: alert.source,
      message: alert.message,
      botId: alert.botId,
      metadata: alert.metadata
    });

    // Emit alert event
    this.emit('alert', alert);

    // Send webhook if configured
    if (this.config.integration.alertWebhookUrl) {
      this.sendWebhookAlert(alert);
    }
  }

  /**
   * Send webhook alert (placeholder implementation)
   */
  private async sendWebhookAlert(alert: SystemAlert): Promise<void> {
    try {
      // This would send a webhook to external alerting systems
      // For now, just log it
      logger.info('[BotReliability] Would send webhook alert', {
        url: this.config.integration.alertWebhookUrl,
        alert
      });
    } catch (error) {
      logger.error('[BotReliability] Failed to send webhook alert', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Helper methods
   */
  private getAlertLevelForRecoveryEvent(eventType: string): SystemAlert['level'] | null {
    switch (eventType) {
      case 'error':
        return 'warning';
      case 'recovery':
        return 'info';
      case 'recovery-failed':
        return 'error';
      default:
        return null;
    }
  }

  private getMessageForRecoveryEvent(eventType: string, errorRecord: any): string {
    switch (eventType) {
      case 'error':
        return `Error detected in bot ${errorRecord.context.botId}: ${errorRecord.context.errorMessage}`;
      case 'recovery':
        return `Bot ${errorRecord.context.botId} successfully recovered from error`;
      case 'recovery-failed':
        return `Failed to recover bot ${errorRecord.context.botId} from error: ${errorRecord.context.errorMessage}`;
      default:
        return `Unknown recovery event: ${eventType}`;
    }
  }

  /**
   * Public methods for monitoring and management
   */
  getSystemStats(): {
    running: boolean;
    systemErrorCount: number;
    alertCount: number;
    errorRecoveryStats: any;
    watchdogStats: any;
  } {
    return {
      running: this.running,
      systemErrorCount: this.systemErrorCount,
      alertCount: this.alertHistory.length,
      errorRecoveryStats: this.errorRecoveryManager.getStats(),
      watchdogStats: this.botWatchdog.getWatchdogStats()
    };
  }

  getRecentAlerts(limit = 50): SystemAlert[] {
    return this.alertHistory.slice(-limit);
  }

  getErrorRecoveryManager(): ErrorRecoveryManager {
    return this.errorRecoveryManager;
  }

  getBotWatchdog(): BotWatchdog {
    return this.botWatchdog;
  }

  getHealthCheckService(): HealthCheckService {
    return this.healthCheckService;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Force health check for all bots
   */
  async performSystemHealthCheck(): Promise<any> {
    return await this.healthCheckService.getHealthStatus();
  }

  /**
   * Clear error history for a bot
   */
  clearBotErrorHistory(botId: string): void {
    this.errorRecoveryManager.clearErrorHistory(botId);
    this.errorRecoveryManager.resetCircuitBreaker(botId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BotReliabilityConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    logger.info('[BotReliability] Configuration updated', { config: this.config });
  }
}

export default BotReliabilitySystem;
