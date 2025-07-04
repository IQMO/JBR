/**
 * Comprehensive Monitoring Service
 * 
 * Central monitoring service that coordinates all monitoring components
 * and provides unified monitoring capabilities for the bot lifecycle system.
 */

import { EventEmitter } from 'events';

import AlertManagerService from './alert-manager.service';
import ApplicationMonitorService from './application-monitor.service';
import DatabaseMonitorService from './database-monitor.service';
import ExchangeMonitorService from './exchange-monitor.service';
import HealthCheckService from './health-check.service';
import logger from './logging.service';
import MetricsCollectorService from './metrics-collector.service';
import SystemMonitorService from './system-monitor.service';

export interface MonitoringConfig {
  enableSystemMonitoring: boolean;
  enableApplicationMonitoring: boolean;
  enableDatabaseMonitoring: boolean;
  enableExchangeMonitoring: boolean;
  enableHealthChecks: boolean;
  enableMetricsCollection: boolean;
  enableAlerting: boolean;
  metricsRetentionHours: number;
  alertingEnabled: boolean;
  broadcastMetrics: boolean;
}

export interface MonitoringStatus {
  isRunning: boolean;
  services: {
    system: boolean;
    application: boolean;
    database: boolean;
    exchange: boolean;
    health: boolean;
    metrics: boolean;
    alerts: boolean;
  };
  startTime: Date;
  uptime: number;
  lastHealthCheck: Date | null;
  totalAlerts: number;
  criticalIssues: string[];
}

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private systemMonitor?: SystemMonitorService;
  private applicationMonitor?: ApplicationMonitorService;
  private alertManager?: AlertManagerService;
  private metricsCollector?: MetricsCollectorService;
  private healthCheck?: HealthCheckService;
  private databaseMonitor?: DatabaseMonitorService;
  private exchangeMonitor?: ExchangeMonitorService;
  
  private isRunning = false;
  private startTime?: Date;
  private websocketServer?: any; // JabbrWebSocketServer type

  constructor(
    config: Partial<MonitoringConfig> = {},
    websocketServer?: any
  ) {
    super();
    
    this.config = {
      enableSystemMonitoring: true,
      enableApplicationMonitoring: true,
      enableDatabaseMonitoring: true,
      enableExchangeMonitoring: true,
      enableHealthChecks: true,
      enableMetricsCollection: true,
      enableAlerting: true,
      metricsRetentionHours: 24,
      alertingEnabled: true,
      broadcastMetrics: true,
      ...config
    };

    this.websocketServer = websocketServer;

    logger.info('Monitoring Service initialized', { 
      config: this.config 
    });
  }

  /**
   * Start comprehensive monitoring
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitoring Service is already running');
      return;
    }

    this.startTime = new Date();
    this.isRunning = true;

    try {
      // Initialize all monitoring services
      await this.initializeServices();

      // Start individual services
      await this.startServices();

      // Setup cross-service communication
      this.setupServiceIntegration();

      logger.info('Comprehensive Monitoring Service started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start Monitoring Service', { error });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop comprehensive monitoring
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Monitoring Service...');

    try {
      // Stop all services
      await this.stopServices();

      this.isRunning = false;
      this.startTime = undefined;

      logger.info('Monitoring Service stopped successfully');
      this.emit('stopped');

    } catch (error) {
      logger.error('Error stopping Monitoring Service', { error });
      throw error;
    }
  }

  /**
   * Get current monitoring status
   */
  public getStatus(): MonitoringStatus {
    const totalAlerts = this.alertManager?.getActiveAlerts().length || 0;
    const criticalIssues: string[] = [];

    // Collect critical issues from all services
    if (this.systemMonitor) {
      const systemHealth = this.systemMonitor.getHealthSummary();
      if (systemHealth.status === 'critical') {
        criticalIssues.push(...systemHealth.issues);
      }
    }

    if (this.databaseMonitor) {
      this.databaseMonitor.getHealthSummary().then(dbHealth => {
        if (dbHealth.status === 'critical') {
          criticalIssues.push(...dbHealth.issues);
        }
      });
    }

    if (this.healthCheck) {
      const healthSummary = this.healthCheck.getHealthSummary();
      if (healthSummary.status === 'unhealthy') {
        criticalIssues.push(...healthSummary.criticalIssues);
      }
    }

    return {
      isRunning: this.isRunning,
      services: {
        system: !!this.systemMonitor,
        application: !!this.applicationMonitor,
        database: !!this.databaseMonitor,
        exchange: !!this.exchangeMonitor,
        health: !!this.healthCheck,
        metrics: !!this.metricsCollector,
        alerts: !!this.alertManager
      },
      startTime: this.startTime || new Date(),
      uptime: this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0,
      lastHealthCheck: this.healthCheck?.getCachedHealth()?.timestamp || null,
      totalAlerts,
      criticalIssues
    };
  }

  /**
   * Get comprehensive health report
   */
  public async getHealthReport(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    services: Record<string, any>;
    summary: {
      totalServices: number;
      healthyServices: number;
      warningServices: number;
      criticalServices: number;
    };
    recommendations: string[];
  }> {
    const services: Record<string, any> = {};
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    const recommendations: string[] = [];

    // System monitoring
    if (this.systemMonitor) {
      const systemHealth = this.systemMonitor.getHealthSummary();
      services.system = systemHealth;
      
      if (systemHealth.status === 'healthy') {healthyCount++;}
      else if (systemHealth.status === 'warning') {warningCount++;}
      else {criticalCount++;}

      if (systemHealth.status !== 'healthy') {
        recommendations.push('Check system resources and optimize performance');
      }
    }

    // Application monitoring
    if (this.applicationMonitor) {
      const appMetrics = this.applicationMonitor.getCurrentMetrics();
      services.application = {
        status: appMetrics.performance.errorRate > 10 ? 'critical' : 
                appMetrics.performance.errorRate > 5 ? 'warning' : 'healthy',
        errorRate: appMetrics.performance.errorRate,
        responseTime: appMetrics.performance.responseTime.average,
        throughput: appMetrics.performance.throughput.requestsPerSecond
      };

      if (services.application.status === 'healthy') {healthyCount++;}
      else if (services.application.status === 'warning') {warningCount++;}
      else {criticalCount++;}

      if (appMetrics.performance.errorRate > 5) {
        recommendations.push('Investigate application errors and improve error handling');
      }
    }

    // Database monitoring
    if (this.databaseMonitor) {
      const dbHealth = await this.databaseMonitor.getHealthSummary();
      services.database = dbHealth;

      if (dbHealth.status === 'healthy') {healthyCount++;}
      else if (dbHealth.status === 'warning') {warningCount++;}
      else {criticalCount++;}

      if (dbHealth.status !== 'healthy') {
        recommendations.push('Optimize database queries and check connection pool');
      }
    }

    // Exchange monitoring
    if (this.exchangeMonitor) {
      const exchanges = this.exchangeMonitor.getAllMetrics();
      const exchangeStatuses = Array.from(exchanges.values()).map(e => e.health.status);
      
      const healthyExchanges = exchangeStatuses.filter(s => s === 'healthy').length;
      const warningExchanges = exchangeStatuses.filter(s => s === 'warning').length;
      const criticalExchanges = exchangeStatuses.filter(s => s === 'critical').length;

      services.exchanges = {
        total: exchanges.size,
        healthy: healthyExchanges,
        warning: warningExchanges,
        critical: criticalExchanges,
        status: criticalExchanges > 0 ? 'critical' : 
                warningExchanges > 0 ? 'warning' : 'healthy'
      };

      if (services.exchanges.status === 'healthy') {healthyCount++;}
      else if (services.exchanges.status === 'warning') {warningCount++;}
      else {criticalCount++;}

      if (criticalExchanges > 0) {
        recommendations.push('Check exchange connectivity and API rate limits');
      }
    }

    // Health checks
    if (this.healthCheck) {
      const healthSummary = this.healthCheck.getHealthSummary();
      services.healthCheck = healthSummary;

      if (healthSummary.status === 'healthy') {healthyCount++;}
      else if (healthSummary.status === 'degraded') {warningCount++;}
      else {criticalCount++;}
    }

    // Determine overall status
    const totalServices = healthyCount + warningCount + criticalCount;
    let overall: 'healthy' | 'warning' | 'critical';

    if (criticalCount > 0) {
      overall = 'critical';
    } else if (warningCount > 0) {
      overall = 'warning';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      summary: {
        totalServices,
        healthyServices: healthyCount,
        warningServices: warningCount,
        criticalServices: criticalCount
      },
      recommendations
    };
  }

  /**
   * Get monitoring metrics summary
   */
  public async getMetricsSummary(): Promise<{
    system?: any;
    application?: any;
    database?: any;
    exchanges?: any;
    timestamp: Date;
  }> {
    const summary: any = {
      timestamp: new Date()
    };

    if (this.systemMonitor) {
      summary.system = this.systemMonitor.getCurrentMetrics();
    }

    if (this.applicationMonitor) {
      summary.application = this.applicationMonitor.getCurrentMetrics();
    }

    if (this.databaseMonitor) {
      summary.database = await this.databaseMonitor.getCurrentMetrics();
    }

    if (this.exchangeMonitor) {
      summary.exchanges = Object.fromEntries(this.exchangeMonitor.getAllMetrics());
    }

    return summary;
  }

  /**
   * Record a custom metric
   */
  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    timestamp?: Date
  ): void {
    if (this.metricsCollector) {
      this.metricsCollector.recordMetric(name, value, 'gauge', { 
        labels: tags, 
        timestamp 
      });
    }
  }

  /**
   * Create a custom alert
   */
  public createAlert(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    source?: string,
    metadata?: any
  ): void {
    if (this.alertManager) {
      this.alertManager.createAlert({
        type: 'custom',
        category: type,
        level: severity === 'low' ? 'info' : severity === 'medium' ? 'warning' : severity === 'high' ? 'error' : 'critical',
        title: `${type} Alert`,
        message,
        source: source || 'monitoring-service',
        metadata
      });
    }
  }

  /**
   * Add exchange to monitoring
   */
  public addExchange(exchangeName: string): void {
    if (this.exchangeMonitor) {
      this.exchangeMonitor.startMonitoring(exchangeName);
      logger.info(`Added exchange to monitoring: ${exchangeName}`);
    }
  }

  /**
   * Remove exchange from monitoring
   */
  public removeExchange(exchangeName: string): void {
    if (this.exchangeMonitor) {
      this.exchangeMonitor.stopMonitoring(exchangeName);
      logger.info(`Removed exchange from monitoring: ${exchangeName}`);
    }
  }

  /**
   * Record API request for exchange monitoring
   */
  public recordExchangeApiRequest(
    exchangeName: string,
    endpoint: string,
    method: string,
    duration: number,
    success: boolean,
    error?: string,
    statusCode?: number,
    rateLimitRemaining?: number,
    weight?: number
  ): void {
    if (this.exchangeMonitor) {
      this.exchangeMonitor.recordApiRequest(
        exchangeName,
        endpoint,
        method,
        duration,
        success,
        error,
        statusCode,
        rateLimitRemaining,
        weight
      );
    }
  }

  /**
   * Record order execution for exchange monitoring
   */
  public recordOrderExecution(
    exchangeName: string,
    orderId: string,
    symbol: string,
    side: 'buy' | 'sell',
    type: 'market' | 'limit' | 'stop',
    quantity: number,
    price: number | undefined,
    executedPrice: number | undefined,
    executedQuantity: number | undefined,
    executionTime: number,
    status: 'filled' | 'partial' | 'failed' | 'cancelled'
  ): void {
    if (this.exchangeMonitor) {
      this.exchangeMonitor.recordOrderExecution(
        exchangeName,
        orderId,
        symbol,
        side,
        type,
        quantity,
        price,
        executedPrice,
        executedQuantity,
        executionTime,
        status
      );
    }
  }

  /**
   * Initialize all monitoring services
   */
  private async initializeServices(): Promise<void> {
    if (this.config.enableAlerting) {
      this.alertManager = new AlertManagerService(this.websocketServer);
    }

    if (this.config.enableMetricsCollection) {
      this.metricsCollector = new MetricsCollectorService({
        retentionPeriod: this.config.metricsRetentionHours * 60 * 60 * 1000 // convert hours to milliseconds
      });
    }

    if (this.config.enableSystemMonitoring) {
      this.systemMonitor = new SystemMonitorService({});
    }

    if (this.config.enableApplicationMonitoring) {
      this.applicationMonitor = ApplicationMonitorService.getInstance({});
    }

    if (this.config.enableDatabaseMonitoring) {
      this.databaseMonitor = new DatabaseMonitorService({
        metricsRetentionHours: this.config.metricsRetentionHours
      }, this.websocketServer);
    }

    if (this.config.enableExchangeMonitoring) {
      this.exchangeMonitor = new ExchangeMonitorService({
        metricsRetentionHours: this.config.metricsRetentionHours
      }, this.websocketServer);
    }

    if (this.config.enableHealthChecks) {
      this.healthCheck = new HealthCheckService(
        {},
        this.systemMonitor,
        this.applicationMonitor
      );
    }
  }

  /**
   * Start all monitoring services
   */
  private async startServices(): Promise<void> {
    // AlertManager starts automatically in constructor

    if (this.systemMonitor) {
      this.systemMonitor.start();
    }

    if (this.applicationMonitor) {
      this.applicationMonitor.start();
    }

    if (this.databaseMonitor) {
      this.databaseMonitor.start();
    }

    if (this.healthCheck) {
      this.healthCheck.start();
    }

    // Exchange monitor doesn't have a general start method
    // Exchanges are added individually via addExchange()
  }

  /**
   * Stop all monitoring services
   */
  private async stopServices(): Promise<void> {
    if (this.healthCheck) {
      this.healthCheck.stop();
    }

    if (this.databaseMonitor) {
      this.databaseMonitor.stop();
    }

    if (this.applicationMonitor) {
      this.applicationMonitor.stop();
    }

    if (this.systemMonitor) {
      this.systemMonitor.stop();
    }

    // AlertManager stops automatically

    if (this.exchangeMonitor) {
      this.exchangeMonitor.shutdown();
    }

    if (this.metricsCollector) {
      this.metricsCollector.shutdown();
    }
  }

  /**
   * Setup integration between services
   */
  private setupServiceIntegration(): void {
    // Connect system monitoring to alerting
    if (this.systemMonitor && this.alertManager) {
      this.systemMonitor.on('criticalAlert', (alert) => {
        this.alertManager!.createAlert({
          type: 'system',
          category: 'system_critical',
          level: 'critical',
          title: 'System Critical Alert',
          message: alert.message,
          source: 'system_monitor',
          metadata: alert
        });
      });

      this.systemMonitor.on('warningAlert', (alert) => {
        this.alertManager!.createAlert({
          type: 'system',
          category: 'system_warning',
          level: 'warning',
          title: 'System Warning Alert',
          message: alert.message,
          source: 'system_monitor',
          metadata: alert
        });
      });
    }

    // Connect application monitoring to alerting
    if (this.applicationMonitor && this.alertManager) {
      this.applicationMonitor.on('highErrorRate', (metrics) => {
        this.alertManager!.createAlert({
          type: 'application',
          category: 'high_error_rate',
          level: 'error',
          title: 'High Error Rate Detected',
          message: `High error rate detected: ${metrics.errorRate.toFixed(1)}%`,
          source: 'application_monitor',
          metadata: metrics
        });
      });

      this.applicationMonitor.on('slowResponse', (metrics) => {
        this.alertManager!.createAlert({
          type: 'application',
          category: 'slow_response',
          level: 'warning',
          title: 'Slow Response Time',
          message: `Slow response time: ${metrics.responseTime.toFixed(0)}ms`,
          source: 'application_monitor',
          metadata: metrics
        });
      });
    }

    // Connect database monitoring to alerting
    if (this.databaseMonitor && this.alertManager) {
      this.databaseMonitor.on('slowQuery', (query) => {
        this.alertManager!.createAlert({
          type: 'application',
          category: 'slow_query',
          level: 'warning',
          title: 'Slow Database Query',
          message: `Slow database query: ${query.duration}ms`,
          source: 'database_monitor',
          metadata: query
        });
      });

      this.databaseMonitor.on('queryError', (query) => {
        this.alertManager!.createAlert({
          type: 'application',
          category: 'database_error',
          level: 'error',
          title: 'Database Query Error',
          message: `Database query error: ${query.error}`,
          source: 'database_monitor',
          metadata: query
        });
      });
    }

    // Connect exchange monitoring to alerting
    if (this.exchangeMonitor && this.alertManager) {
      this.exchangeMonitor.on('exchangeCritical', (exchangeName, issues) => {
        this.alertManager!.createAlert({
          type: 'trading',
          category: 'exchange_critical',
          level: 'critical',
          title: 'Exchange Critical Issue',
          message: `Exchange ${exchangeName} critical: ${issues.join(', ')}`,
          source: 'exchange_monitor',
          metadata: { exchangeName, issues }
        });
      });

      this.exchangeMonitor.on('rateLimitViolation', (exchangeName, rateLimits) => {
        this.alertManager!.createAlert({
          type: 'trading',
          category: 'rate_limit_violation',
          level: 'error',
          title: 'Rate Limit Violation',
          message: `Rate limit violation on ${exchangeName}: ${rateLimits.utilizationPercentage}%`,
          source: 'exchange_monitor',
          metadata: { exchangeName, rateLimits }
        });
      });
    }

    // Connect health checks to alerting
    if (this.healthCheck && this.alertManager) {
      this.healthCheck.on('healthStatusChange', (healthStatus) => {
        if (healthStatus.status === 'unhealthy') {
          this.alertManager!.createAlert({
            type: 'system',
            category: 'health_check_failed',
            level: 'critical',
            title: 'System Health Check Failed',
            message: 'System health check failed',
            source: 'health_check',
            metadata: healthStatus
          });
        }
      });
    }

    // Connect metrics collection to all services
    if (this.metricsCollector) {
      // System metrics
      if (this.systemMonitor) {
        this.systemMonitor.on('metricsUpdate', (metrics) => {
          this.metricsCollector!.recordMetric('system.cpu_usage', metrics.cpu.usage);
          this.metricsCollector!.recordMetric('system.memory_usage', metrics.memory.usage);
          this.metricsCollector!.recordMetric('system.disk_usage', metrics.disk.usage);
        });
      }

      // Application metrics
      if (this.applicationMonitor) {
        this.applicationMonitor.on('metricsUpdate', (metrics) => {
          this.metricsCollector!.recordMetric('app.error_rate', metrics.performance.errorRate);
          this.metricsCollector!.recordMetric('app.response_time', metrics.performance.responseTime.average);
          this.metricsCollector!.recordMetric('app.throughput', metrics.performance.throughput.requestsPerSecond);
        });
      }

      // Database metrics
      if (this.databaseMonitor) {
        this.databaseMonitor.on('metricsUpdate', (metrics) => {
          this.metricsCollector!.recordMetric('db.connections', metrics.connections.active);
          this.metricsCollector!.recordMetric('db.query_time', metrics.queries.averageTime);
          this.metricsCollector!.recordMetric('db.queries_per_second', metrics.queries.queriesPerSecond);
        });
      }
    }

    logger.info('Service integration setup completed');
  }

  /**
   * Get service instances for external access
   */
  public getServices() {
    return {
      system: this.systemMonitor,
      application: this.applicationMonitor,
      database: this.databaseMonitor,
      exchange: this.exchangeMonitor,
      health: this.healthCheck,
      metrics: this.metricsCollector,
      alerts: this.alertManager
    };
  }

  /**
   * Shutdown the monitoring service
   */
  public async shutdown(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    logger.info('Monitoring Service shut down completely');
  }
}

export default MonitoringService;
