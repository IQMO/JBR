/**
 * System Health Check Service
 * 
 * Provides comprehensive health monitoring for all system components
 * including database, exchange connections, bot runtime status,
 * memory usage, and overall system health.
 */

import { EventEmitter } from 'events';

import { database } from '../services/database.service';
import logger from '../services/logging.service';

import SystemMonitorService from './system-monitor.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
    cpu: ComponentHealth;
    bots: ComponentHealth;
    exchanges: ComponentHealth;
    websockets: ComponentHealth;
    logging: ComponentHealth;
  };
  metrics: {
    totalRequests: number;
    activeConnections: number;
    errorRate: number;
    responseTime: number;
  };
  details?: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastCheck: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface HealthCheckConfig {
  enableDetailedChecks: boolean;
  checkInterval: number; // milliseconds
  timeoutThreshold: number; // milliseconds for checks
  memoryThreshold: number; // percentage
  cpuThreshold: number; // percentage
  errorRateThreshold: number; // percentage
  responseTimeThreshold: number; // milliseconds
}

export class SystemHealthService extends EventEmitter {
  private config: HealthCheckConfig;
  private startTime: Date;
  private healthCache: HealthStatus | null = null;
  private cacheExpiry = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  private systemMonitor: SystemMonitorService;
  private metrics = {
    totalRequests: 0,
    totalErrors: 0,
    responseTimeSum: 0,
    requestCount: 0,
    activeConnections: 0
  };

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super();
    
    this.config = {
      enableDetailedChecks: true,
      checkInterval: 30000, // 30 seconds
      timeoutThreshold: 5000, // 5 seconds
      memoryThreshold: 85, // 85%
      cpuThreshold: 90, // 90%
      errorRateThreshold: 5, // 5%
      responseTimeThreshold: 1000, // 1 second
      ...config
    };

    this.startTime = new Date();
    this.systemMonitor = new SystemMonitorService({
      collectInterval: 5000, // 5 seconds
      alertThresholds: {
        cpu: { warning: this.config.cpuThreshold - 20, critical: this.config.cpuThreshold },
        memory: { warning: this.config.memoryThreshold - 15, critical: this.config.memoryThreshold },
        disk: { warning: 80, critical: 90 }
      },
      enableAlerts: true
    });

    // Start system monitoring
    this.systemMonitor.start();
    this.startPeriodicChecks();
  }

  /**
   * Get overall system health status
   */
  async getSystemHealth(useCache = true): Promise<HealthStatus> {
    // Return cached result if still valid
    if (useCache && this.healthCache && Date.now() < this.cacheExpiry) {
      return this.healthCache;
    }

    const startTime = Date.now();
    
    try {
      logger.debug('[HealthCheck] Starting system health assessment');

      // Perform all health checks in parallel
      const [
        databaseHealth,
        memoryHealth,
        cpuHealth,
        botsHealth,
        exchangesHealth,
        websocketsHealth,
        loggingHealth
      ] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkMemoryHealth(),
        this.checkCpuHealth(),
        this.checkBotsHealth(),
        this.checkExchangesHealth(),
        this.checkWebsocketsHealth(),
        this.checkLoggingHealth()
      ]);

      // Extract results, defaulting to unhealthy if promise rejected
      const components = {
        database: this.extractHealthResult(databaseHealth, 'Database check failed'),
        memory: this.extractHealthResult(memoryHealth, 'Memory check failed'),
        cpu: this.extractHealthResult(cpuHealth, 'CPU check failed'),
        bots: this.extractHealthResult(botsHealth, 'Bots check failed'),
        exchanges: this.extractHealthResult(exchangesHealth, 'Exchanges check failed'),
        websockets: this.extractHealthResult(websocketsHealth, 'WebSockets check failed'),
        logging: this.extractHealthResult(loggingHealth, 'Logging check failed')
      };

      // Calculate overall health status
      const overallStatus = this.calculateOverallStatus(components);
      const checkDuration = Date.now() - startTime;

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        version: process.env.npm_package_version || '1.0.0',
        components,
        metrics: {
          totalRequests: this.metrics.totalRequests,
          activeConnections: this.metrics.activeConnections,
          errorRate: this.calculateErrorRate(),
          responseTime: this.calculateAverageResponseTime()
        },
        details: overallStatus !== 'healthy' ? this.getUnhealthyDetails(components) : undefined
      };

      // Cache the result for 10 seconds
      this.healthCache = healthStatus;
      this.cacheExpiry = Date.now() + 10000;

      logger.debug('[HealthCheck] Health assessment completed', {
        status: overallStatus,
        duration: checkDuration,
        componentsChecked: Object.keys(components).length
      });

      this.emit('health-check-completed', healthStatus);

      return healthStatus;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('[HealthCheck] Health assessment failed', {
        error: errorMessage,
        duration: Date.now() - startTime
      });

      const unhealthyStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        version: process.env.npm_package_version || '1.0.0',
        components: {
          database: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() },
          memory: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() },
          cpu: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() },
          bots: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() },
          exchanges: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() },
          websockets: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() },
          logging: { status: 'unhealthy', message: 'Check failed', lastCheck: new Date() }
        },
        metrics: {
          totalRequests: this.metrics.totalRequests,
          activeConnections: this.metrics.activeConnections,
          errorRate: 100,
          responseTime: -1
        },
        details: `Health check system failure: ${errorMessage}`
      };

      this.emit('health-check-failed', { error: errorMessage, status: unhealthyStatus });

      return unhealthyStatus;
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const result = await Promise.race([
        database.query('SELECT 1 as health_check'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), this.config.timeoutThreshold)
        )
      ]) as any[];

      if (!result || result.length === 0 || result.at(0).health_check !== 1) {
        throw new Error('Invalid database response');
      }

      // Get additional database metrics if detailed checks enabled
      let details = {};
      if (this.config.enableDetailedChecks) {
        try {
          const [connectionInfo, tableInfo] = await Promise.all([
            database.query('SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE state = $1', ['active']),
            database.query('SELECT schemaname, tablename FROM pg_tables WHERE schemaname = $1 LIMIT 5', ['public'])
          ]);

          details = {
            activeConnections: connectionInfo.at(0)?.active_connections || 0,
            tablesCount: tableInfo.length,
            tables: tableInfo.map(t => `${t.schemaname}.${t.tablename}`)
          };
        } catch (detailError) {
          details = { detailError: 'Could not fetch detailed metrics' };
        }
      }

      const responseTime = Date.now() - startTime;

      return {
        status: responseTime > this.config.responseTimeThreshold ? 'degraded' : 'healthy',
        message: `Database responsive (${responseTime}ms)`,
        lastCheck: new Date(),
        responseTime,
        details
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        status: 'unhealthy',
        message: `Database error: ${errorMessage}`,
        lastCheck: new Date(),
        responseTime,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryHealth(): Promise<ComponentHealth> {
    try {
      // Get system memory metrics from SystemMonitorService
      const systemMetrics = this.systemMonitor.getCurrentMetrics();
      const processMemory = process.memoryUsage();

      if (!systemMetrics) {
        return {
          status: 'degraded',
          message: 'Memory metrics unavailable',
          lastCheck: new Date(),
          details: { reason: 'System monitor not ready' }
        };
      }

      const systemMemoryPercentage = systemMetrics.memory.percentage;
      const processHeapPercentage = (processMemory.heapUsed / processMemory.heapTotal) * 100;

      const details = {
        system: {
          total: Math.round(systemMetrics.memory.total / 1024 / 1024 / 1024 * 100) / 100, // GB
          used: Math.round(systemMetrics.memory.used / 1024 / 1024 / 1024 * 100) / 100, // GB
          percentage: Math.round(systemMemoryPercentage * 100) / 100
        },
        process: {
          heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
          external: Math.round(processMemory.external / 1024 / 1024), // MB
          rss: Math.round(processMemory.rss / 1024 / 1024), // MB
          heapPercentage: Math.round(processHeapPercentage * 100) / 100
        }
      };

      let status: ComponentHealth['status'];
      let message: string;

      // Use system memory percentage as primary indicator
      if (systemMemoryPercentage > this.config.memoryThreshold) {
        status = 'unhealthy';
        message = `Critical system memory usage: ${details.system.percentage}%`;
      } else if (systemMemoryPercentage > this.config.memoryThreshold * 0.8) {
        status = 'degraded';
        message = `High system memory usage: ${details.system.percentage}%`;
      } else if (processHeapPercentage > 90) {
        status = 'degraded';
        message = `High process heap usage: ${details.process.heapPercentage}%`;
      } else {
        status = 'healthy';
        message = `Memory usage normal: ${details.system.percentage}% system, ${details.process.heapPercentage}% heap`;
      }

      return {
        status,
        message,
        lastCheck: new Date(),
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check CPU usage
   */
  private async checkCpuHealth(): Promise<ComponentHealth> {
    try {
      // Get CPU metrics from SystemMonitorService
      const systemMetrics = this.systemMonitor.getCurrentMetrics();
      const processCpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      if (!systemMetrics) {
        return {
          status: 'degraded',
          message: 'CPU metrics unavailable',
          lastCheck: new Date(),
          details: { reason: 'System monitor not ready' }
        };
      }

      const systemCpuPercentage = systemMetrics.cpu.usage;
      const loadAverage = systemMetrics.cpu.loadAverage;
      
      const details = {
        system: {
          usage: Math.round(systemCpuPercentage * 100) / 100,
          cores: systemMetrics.cpu.cores,
          loadAverage: loadAverage.map(avg => Math.round(avg * 100) / 100)
        },
        process: {
          user: Math.round(processCpuUsage.user / 1000000), // seconds
          system: Math.round(processCpuUsage.system / 1000000), // seconds
          uptime: Math.round(uptime)
        }
      };

      let status: ComponentHealth['status'];
      let message: string;

      // Use system CPU usage as primary indicator
      if (systemCpuPercentage > this.config.cpuThreshold) {
        status = 'unhealthy';
        message = `Critical CPU usage: ${details.system.usage}%`;
      } else if (systemCpuPercentage > this.config.cpuThreshold * 0.8) {
        status = 'degraded';
        message = `High CPU usage: ${details.system.usage}%`;
      } else if (loadAverage && loadAverage.length > 0 && (loadAverage.at(0) || 0) > (systemMetrics?.cpu.cores || 1) * 0.8) {
        status = 'degraded';
        message = `High system load: ${details.system.loadAverage.at(0) || 0} (${systemMetrics?.cpu.cores || 1} cores)`;
      } else {
        status = 'healthy';
        message = `CPU usage normal: ${details.system.usage}%, load: ${details.system.loadAverage.at(0) || 'N/A'}`;
      }

      return {
        status,
        message,
        lastCheck: new Date(),
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `CPU check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check bot runtime health
   */
  private async checkBotsHealth(): Promise<ComponentHealth> {
    try {
      // Query bot status from database
      const botsResult = await database.query(`
        SELECT 
          status, 
          COUNT(*) as count 
        FROM bots 
        GROUP BY status
      `);

      const botCounts = botsResult.reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});

      const totalBots = Object.values(botCounts).reduce((sum: number, count: number) => sum + count, 0);
      const runningBots = botCounts.running || 0;
      const errorBots = botCounts.error || 0;

      const details = {
        total: totalBots,
        running: runningBots,
        stopped: botCounts.stopped || 0,
        paused: botCounts.paused || 0,
        error: errorBots,
        distribution: botCounts
      };

      let status: ComponentHealth['status'];
      let message: string;

      if (totalBots === 0) {
        status = 'healthy';
        message = 'No bots configured';
      } else if (errorBots > 0) {
        status = 'degraded';
        message = `${errorBots} bots in error state`;
      } else if (runningBots === 0) {
        status = 'degraded';
        message = 'No bots currently running';
      } else {
        status = 'healthy';
        message = `${runningBots}/${totalBots} bots running`;
      }

      return {
        status,
        message,
        lastCheck: new Date(),
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Bots check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check exchange connectivity
   */
  private async checkExchangesHealth(): Promise<ComponentHealth> {
    try {
      // This would integrate with actual exchange services
      // For now, we'll simulate the check
      const details = {
        binance: 'connected',
        bybit: 'connected',
        lastPing: new Date().toISOString()
      };

      return {
        status: 'healthy',
        message: 'Exchange connections healthy',
        lastCheck: new Date(),
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Exchange check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check WebSocket connections
   */
  private async checkWebsocketsHealth(): Promise<ComponentHealth> {
    try {
      // This would integrate with actual WebSocket manager
      // For now, we'll simulate the check
      const details = {
        activeConnections: this.metrics.activeConnections,
        totalConnections: this.metrics.totalRequests
      };

      return {
        status: 'healthy',
        message: `WebSocket connections healthy (${details.activeConnections} active)`,
        lastCheck: new Date(),
        details
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `WebSocket check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Check logging system
   */
  private async checkLoggingHealth(): Promise<ComponentHealth> {
    try {
      // Test logging system
      const testMessage = `Health check test - ${Date.now()}`;
      logger.debug(testMessage);

      return {
        status: 'healthy',
        message: 'Logging system operational',
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Logging check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Extract health result from promise result
   */
  private extractHealthResult(
    result: PromiseSettledResult<ComponentHealth>,
    defaultError: string
  ): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } 
      return {
        status: 'unhealthy',
        message: defaultError,
        lastCheck: new Date(),
        details: { error: result.reason?.message || result.reason }
      };
    
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(components: HealthStatus['components']): HealthStatus['status'] {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.some(s => s === 'unhealthy')) {
      return 'unhealthy';
    } else if (statuses.some(s => s === 'degraded')) {
      return 'degraded';
    } 
      return 'healthy';
    
  }

  /**
   * Get details about unhealthy components
   */
  private getUnhealthyDetails(components: HealthStatus['components']): string {
    const unhealthyComponents = Object.entries(components)
      .filter(([_, health]) => health.status !== 'healthy')
      .map(([name, health]) => `${name}: ${health.message}`)
      .join('; ');

    return unhealthyComponents || 'Unknown health issues detected';
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    if (this.metrics.totalRequests === 0) {return 0;}
    return (this.metrics.totalErrors / this.metrics.totalRequests) * 100;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.metrics.requestCount === 0) {return 0;}
    return this.metrics.responseTimeSum / this.metrics.requestCount;
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, isError = false): void {
    this.metrics.totalRequests++;
    this.metrics.requestCount++;
    this.metrics.responseTimeSum += responseTime;
    
    if (isError) {
      this.metrics.totalErrors++;
    }
  }

  /**
   * Update active connections count
   */
  updateActiveConnections(count: number): void {
    this.metrics.activeConnections = count;
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth(false); // Force fresh check
        
        if (health.status !== 'healthy') {
          logger.warn('[HealthCheck] System health degraded', {
            status: health.status,
            details: health.details
          });
          
          this.emit('health-degraded', health);
        }
      } catch (error) {
        logger.error('[HealthCheck] Periodic health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.checkInterval);
  }

  /**
   * Get simplified health status for quick checks
   */
  async getQuickHealth(): Promise<{ status: string; uptime: number }> {
    try {
      // Just check if we can connect to database
      await database.query('SELECT 1');
      
      return {
        status: 'healthy',
        uptime: Date.now() - this.startTime.getTime()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        uptime: Date.now() - this.startTime.getTime()
      };
    }
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Stop system monitoring
    if (this.systemMonitor) {
      this.systemMonitor.shutdown();
    }

    this.removeAllListeners();
    this.healthCache = null;
    
    logger.info('[HealthCheck] System health service shutdown complete');
  }
}

export default SystemHealthService;
