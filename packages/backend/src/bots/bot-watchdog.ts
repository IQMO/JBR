/**
 * Bot Watchdog Service
 * 
 * Monitors bot health and automatically restarts failed or unhealthy bots.
 * Provides continuous monitoring, health checks, and automated recovery.
 */

import { EventEmitter } from 'events';

import logger from '../services/logging.service';

import type { BotManager } from './bot-manager';
import type { ErrorRecoveryManager } from './error-recovery-manager';

export interface BotHealthMetrics {
  botId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'dead';
  lastHeartbeat: Date;
  responseTime: number; // milliseconds
  errorRate: number; // errors per minute
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  activeConnections: number;
  lastError?: string;
  uptime: number; // milliseconds
}

export interface WatchdogConfig {
  healthCheckInterval: number; // milliseconds
  heartbeatTimeout: number; // milliseconds
  maxErrorRate: number; // errors per minute
  maxResponseTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  restartThreshold: number; // consecutive unhealthy checks
  enableAutoRestart: boolean;
  enableHealthEndpoints: boolean;
  alertOnRestart: boolean;
}

export interface HealthCheckResult {
  botId: string;
  healthy: boolean;
  metrics: BotHealthMetrics;
  issues: string[];
  timestamp: Date;
}

export class BotWatchdog extends EventEmitter {
  private config: WatchdogConfig;
  private botManager: BotManager;
  private errorRecoveryManager: ErrorRecoveryManager;
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private healthMetrics: Map<string, BotHealthMetrics> = new Map();
  private unhealthyStreaks: Map<string, number> = new Map();
  private running = false;

  constructor(
    botManager: BotManager,
    errorRecoveryManager: ErrorRecoveryManager,
    config: Partial<WatchdogConfig> = {}
  ) {
    super();

    this.botManager = botManager;
    this.errorRecoveryManager = errorRecoveryManager;
    
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      heartbeatTimeout: 60000, // 1 minute
      maxErrorRate: 10, // 10 errors per minute
      maxResponseTime: 5000, // 5 seconds
      maxMemoryUsage: 512, // 512 MB
      restartThreshold: 3, // 3 consecutive unhealthy checks
      enableAutoRestart: true,
      enableHealthEndpoints: true,
      alertOnRestart: true,
      ...config
    };

    this.setupEventListeners();
  }

  /**
   * Start the watchdog service
   */
  start(): void {
    if (this.running) {
      logger.warn('[BotWatchdog] Watchdog is already running');
      return;
    }

    this.running = true;
    logger.info('[BotWatchdog] Starting bot watchdog service', {
      healthCheckInterval: this.config.healthCheckInterval,
      enableAutoRestart: this.config.enableAutoRestart
    });

    // Start monitoring all active bots
    this.startMonitoringAllBots();
    
    this.emit('started');
  }

  /**
   * Stop the watchdog service
   */
  stop(): void {
    if (!this.running) {
      logger.warn('[BotWatchdog] Watchdog is not running');
      return;
    }

    this.running = false;
    logger.info('[BotWatchdog] Stopping bot watchdog service');

    // Clear all health check timers
    for (const [botId, timer] of this.healthChecks) {
      clearInterval(timer);
      logger.info('[BotWatchdog] Stopped monitoring bot', { botId });
    }

    this.healthChecks.clear();
    this.emit('stopped');
  }

  /**
   * Start monitoring a specific bot
   */
  startMonitoring(botId: string): void {
    if (this.healthChecks.has(botId)) {
      logger.warn('[BotWatchdog] Already monitoring bot', { botId });
      return;
    }

    logger.info('[BotWatchdog] Starting to monitor bot', { botId });

    // Initialize metrics
    this.healthMetrics.set(botId, {
      botId,
      status: 'healthy',
      lastHeartbeat: new Date(),
      responseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      uptime: 0
    });

    this.unhealthyStreaks.set(botId, 0);

    // Start periodic health checks
    const timer = setInterval(async () => {
      await this.performHealthCheck(botId);
    }, this.config.healthCheckInterval);

    this.healthChecks.set(botId, timer);

    // Perform initial health check
    this.performHealthCheck(botId);
  }

  /**
   * Stop monitoring a specific bot
   */
  stopMonitoring(botId: string): void {
    const timer = this.healthChecks.get(botId);
    if (timer) {
      clearInterval(timer);
      this.healthChecks.delete(botId);
      this.healthMetrics.delete(botId);
      this.unhealthyStreaks.delete(botId);
      
      logger.info('[BotWatchdog] Stopped monitoring bot', { botId });
    }
  }

  /**
   * Perform health check for a specific bot
   */
  async performHealthCheck(botId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const botStatus = await this.botManager.getBotStatus(botId);
      const metrics = await this.collectBotMetrics(botId, botStatus);
      const issues = this.analyzeHealthIssues(metrics);
      
      const healthy = issues.length === 0;
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      metrics.responseTime = responseTime;
      metrics.lastHeartbeat = new Date();
      this.healthMetrics.set(botId, metrics);

      // Update unhealthy streak
      const currentStreak = this.unhealthyStreaks.get(botId) || 0;
      if (healthy) {
        this.unhealthyStreaks.set(botId, 0);
      } else {
        this.unhealthyStreaks.set(botId, currentStreak + 1);
      }

      const result: HealthCheckResult = {
        botId,
        healthy,
        metrics,
        issues,
        timestamp: new Date()
      };

      // Handle unhealthy bots
      if (!healthy) {
        await this.handleUnhealthyBot(botId, result);
      }

      this.emit('health-check', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('[BotWatchdog] Health check failed', {
        botId,
        error: errorMessage,
        responseTime: Date.now() - startTime
      });

      // Mark as dead bot
      const metrics: BotHealthMetrics = {
        botId,
        status: 'dead',
        lastHeartbeat: new Date(),
        responseTime: Date.now() - startTime,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        uptime: 0,
        lastError: errorMessage
      };

      this.healthMetrics.set(botId, metrics);
      this.unhealthyStreaks.set(botId, (this.unhealthyStreaks.get(botId) || 0) + 1);

      const result: HealthCheckResult = {
        botId,
        healthy: false,
        metrics,
        issues: ['Health check failed', errorMessage],
        timestamp: new Date()
      };

      await this.handleUnhealthyBot(botId, result);
      this.emit('health-check', result);
      return result;
    }
  }

  /**
   * Collect bot metrics
   */
  private async collectBotMetrics(botId: string, botStatus: any): Promise<BotHealthMetrics> {
    const currentMetrics = this.healthMetrics.get(botId);
    const now = Date.now();
    
    // Calculate error rate (errors in last minute)
    const errorHistory = this.errorRecoveryManager.getErrorHistory(botId);
    const recentErrors = errorHistory.filter(
      record => now - record.context.timestamp.getTime() < 60000
    );

    // Get system metrics (this would integrate with actual system monitoring)
    const systemMetrics = await this.getSystemMetrics(botId);

    const metrics: BotHealthMetrics = {
      botId,
      status: this.determineHealthStatus(botStatus, recentErrors, systemMetrics),
      lastHeartbeat: new Date(),
      responseTime: currentMetrics?.responseTime || 0,
      errorRate: recentErrors.length,
      memoryUsage: systemMetrics.memoryUsage,
      cpuUsage: systemMetrics.cpuUsage,
      activeConnections: systemMetrics.activeConnections,
      uptime: systemMetrics.uptime,
      lastError: recentErrors.length > 0 ? recentErrors.at(0)?.context.errorMessage : undefined
    };

    return metrics;
  }

  /**
   * Determine bot health status
   */
  private determineHealthStatus(
    botStatus: any, 
    recentErrors: any[], 
    systemMetrics: any
  ): 'healthy' | 'degraded' | 'unhealthy' | 'dead' {
    
    // Check if bot is responding
    if (!botStatus || botStatus.state === 'stopped' || botStatus.state === 'error') {
      return 'dead';
    }

    // Check error rate
    if (recentErrors.length >= this.config.maxErrorRate) {
      return 'unhealthy';
    }

    // Check system resources
    if (systemMetrics.memoryUsage >= this.config.maxMemoryUsage * 0.9) {
      return 'degraded';
    }

    if (systemMetrics.cpuUsage >= 90) {
      return 'degraded';
    }

    // Check for moderate issues
    if (recentErrors.length >= this.config.maxErrorRate * 0.5) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Analyze health issues
   */
  private analyzeHealthIssues(metrics: BotHealthMetrics): string[] {
    const issues: string[] = [];

    if (metrics.responseTime > this.config.maxResponseTime) {
      issues.push(`High response time: ${metrics.responseTime}ms`);
    }

    if (metrics.errorRate >= this.config.maxErrorRate) {
      issues.push(`High error rate: ${metrics.errorRate} errors/min`);
    }

    if (metrics.memoryUsage >= this.config.maxMemoryUsage) {
      issues.push(`High memory usage: ${metrics.memoryUsage}MB`);
    }

    if (metrics.cpuUsage >= 90) {
      issues.push(`High CPU usage: ${metrics.cpuUsage}%`);
    }

    const timeSinceHeartbeat = Date.now() - metrics.lastHeartbeat.getTime();
    if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
      issues.push(`Stale heartbeat: ${timeSinceHeartbeat}ms ago`);
    }

    if (metrics.status === 'dead') {
      issues.push('Bot is not responding');
    }

    return issues;
  }

  /**
   * Handle unhealthy bot
   */
  private async handleUnhealthyBot(botId: string, healthResult: HealthCheckResult): Promise<void> {
    const unhealthyStreak = this.unhealthyStreaks.get(botId) || 0;
    
    logger.warn('[BotWatchdog] Bot is unhealthy', {
      botId,
      status: healthResult.metrics.status,
      issues: healthResult.issues,
      unhealthyStreak,
      restartThreshold: this.config.restartThreshold
    });

    this.emit('bot-unhealthy', healthResult);

    // Check if we should restart the bot
    if (this.config.enableAutoRestart && unhealthyStreak >= this.config.restartThreshold) {
      await this.restartBot(botId, healthResult);
    }
  }

  /**
   * Restart an unhealthy bot
   */
  private async restartBot(botId: string, healthResult: HealthCheckResult): Promise<void> {
    try {
      logger.info('[BotWatchdog] Attempting to restart unhealthy bot', {
        botId,
        issues: healthResult.issues,
        unhealthyStreak: this.unhealthyStreaks.get(botId)
      });

      if (this.config.alertOnRestart) {
        this.emit('bot-restart-required', { botId, healthResult });
      }

      // Stop the bot first (need userId - for now use a placeholder)
      await this.botManager.stopBot('system', botId);
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start the bot again
      await this.botManager.startBot('system', botId);

      // Reset unhealthy streak
      this.unhealthyStreaks.set(botId, 0);

      // Reset error history
      this.errorRecoveryManager.clearErrorHistory(botId);
      this.errorRecoveryManager.resetCircuitBreaker(botId);

      logger.info('[BotWatchdog] Successfully restarted bot', { botId });
      this.emit('bot-restarted', { botId, healthResult });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('[BotWatchdog] Failed to restart bot', {
        botId,
        error: errorMessage
      });

      this.emit('bot-restart-failed', { botId, error: errorMessage, healthResult });

      // Escalate to error recovery manager
      await this.errorRecoveryManager.handleError(
        error instanceof Error ? error : new Error(errorMessage),
        {
          botId,
          operation: 'bot-restart',
          metadata: { healthResult }
        }
      );
    }
  }

  /**
   * Get system metrics (placeholder for actual implementation)
   */
  private async getSystemMetrics(botId: string): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    uptime: number;
  }> {
    // This would integrate with actual system monitoring
    // For now, return mock data
    return {
      memoryUsage: Math.random() * 256, // MB
      cpuUsage: Math.random() * 50, // %
      activeConnections: Math.floor(Math.random() * 10),
      uptime: Date.now() - (Math.random() * 3600000) // Random uptime up to 1 hour
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for bot lifecycle events
    this.botManager.on('bot-started', (data: any) => {
      this.startMonitoring(data.botId);
    });

    this.botManager.on('bot-stopped', (data: any) => {
      this.stopMonitoring(data.botId);
    });

    // Listen for error recovery events
    this.errorRecoveryManager.on('admin-alert', (errorRecord: any) => {
      this.emit('admin-alert', {
        source: 'error-recovery',
        botId: errorRecord.context.botId,
        errorRecord
      });
    });
  }

  /**
   * Start monitoring all currently active bots
   */
  private startMonitoringAllBots(): void {
    const activeBots = Array.from(this.botManager.getAllBotsStatus().keys());
    
    for (const botId of activeBots) {
      this.startMonitoring(botId);
    }

    logger.info('[BotWatchdog] Started monitoring all active bots', {
      count: activeBots.length,
      bots: activeBots
    });
  }

  /**
   * Public methods for monitoring and management
   */
  getHealthMetrics(botId?: string): BotHealthMetrics | Map<string, BotHealthMetrics> {
    if (botId) {
      return this.healthMetrics.get(botId) || {
        botId,
        status: 'dead',
        lastHeartbeat: new Date(0),
        responseTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        uptime: 0
      };
    }

    return new Map(this.healthMetrics);
  }

  getUnhealthyStreak(botId: string): number {
    return this.unhealthyStreaks.get(botId) || 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  getMonitoredBots(): string[] {
    return Array.from(this.healthChecks.keys());
  }

  getWatchdogStats(): {
    running: boolean;
    monitoredBots: number;
    healthyBots: number;
    unhealthyBots: number;
    deadBots: number;
    totalHealthChecks: number;
  } {
    const healthyBots = Array.from(this.healthMetrics.values())
      .filter(m => m.status === 'healthy').length;
    
    const unhealthyBots = Array.from(this.healthMetrics.values())
      .filter(m => m.status === 'degraded' || m.status === 'unhealthy').length;
    
    const deadBots = Array.from(this.healthMetrics.values())
      .filter(m => m.status === 'dead').length;

    return {
      running: this.running,
      monitoredBots: this.healthChecks.size,
      healthyBots,
      unhealthyBots,
      deadBots,
      totalHealthChecks: this.healthMetrics.size
    };
  }

  /**
   * Force health check for a specific bot
   */
  async forceHealthCheck(botId: string): Promise<HealthCheckResult> {
    return await this.performHealthCheck(botId);
  }

  /**
   * Force restart of a bot (bypass unhealthy streak check)
   */
  async forceRestart(botId: string): Promise<void> {
    const healthResult: HealthCheckResult = {
      botId,
      healthy: false,
      metrics: this.healthMetrics.get(botId) || {
        botId,
        status: 'dead',
        lastHeartbeat: new Date(),
        responseTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        uptime: 0
      },
      issues: ['Manual restart requested'],
      timestamp: new Date()
    };

    await this.restartBot(botId, healthResult);
  }
}

export default BotWatchdog;
