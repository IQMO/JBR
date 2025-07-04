/**
 * Application Monitor Service
 * 
 * Monitors application performance including response times, throughput, error rates,
 * and API endpoint metrics. Provides detailed performance analytics for the trading platform.
 */

import { EventEmitter } from 'events';

import logger from './logging.service';

export interface EndpointMetrics {
  path: string;
  method: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  errorRate: number;
  lastCall: Date;
  statusCodes: Record<number, number>;
}

export interface ApplicationMetrics {
  performance: {
    responseTime: {
      average: number;
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: {
      requestsPerSecond: number;
      requestsPerMinute: number;
    };
    errorRate: number;
    uptime: number;
  };
  endpoints: Record<string, EndpointMetrics>;
  errors: {
    total: number;
    byType: Record<string, number>;
    recent: ErrorLog[];
  };
  database: {
    queryCount: number;
    averageQueryTime: number;
    slowQueries: number;
    connectionPoolSize: number;
    activeConnections: number;
  };
  websocket: {
    activeConnections: number;
    messagesPerSecond: number;
    totalMessages: number;
    disconnections: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  system: {
    uptime: number;
    cpuUsage: {
      user: number;
      system: number;
    };
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  timestamp: Date;
}

export interface RequestLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  error?: string;
}

export interface ErrorLog {
  id: string;
  type: string;
  message: string;
  stack?: string;
  context?: any;
  timestamp: Date;
  level: 'error' | 'warning';
}

export interface PerformanceAlert {
  type: 'response_time' | 'error_rate' | 'throughput' | 'database' | 'memory';
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface ApplicationMonitorConfig {
  collectInterval: number; // milliseconds
  requestRetentionPeriod: number; // milliseconds
  errorRetentionPeriod: number; // milliseconds
  maxRequestLogs: number;
  maxErrorLogs: number;
  alertThresholds: {
    responseTime: { warning: number; critical: number }; // milliseconds
    errorRate: { warning: number; critical: number }; // percentage
    throughput: { warning: number; critical: number }; // requests per second
    databaseQueryTime: { warning: number; critical: number }; // milliseconds
  };
  enableDetailedLogging: boolean;
}

export class ApplicationMonitorService extends EventEmitter {
  private static instance: ApplicationMonitorService;
  private config: ApplicationMonitorConfig;
  private isRunning = false;
  private monitorInterval?: NodeJS.Timeout;
  private startTime: Date;
  
  // Metrics storage
  private requestLogs: RequestLog[] = [];
  private errorLogs: ErrorLog[] = [];
  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  private responseTimes: number[] = [];
  private requestsPerInterval = 0;
  private errorsPerInterval = 0;
  
  // Database metrics
  private databaseMetrics = {
    queryCount: 0,
    totalQueryTime: 0,
    slowQueries: 0,
    connectionPoolSize: 0,
    activeConnections: 0
  };
  
  // WebSocket metrics
  private websocketMetrics = {
    activeConnections: 0,
    messagesPerSecond: 0,
    totalMessages: 0,
    disconnections: 0
  };

  private constructor(config: Partial<ApplicationMonitorConfig> = {}) {
    super();
    
    this.config = {
      collectInterval: 10000, // 10 seconds
      requestRetentionPeriod: 60 * 60 * 1000, // 1 hour
      errorRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      maxRequestLogs: 10000,
      maxErrorLogs: 1000,
      alertThresholds: {
        responseTime: { warning: 500, critical: 2000 },
        errorRate: { warning: 5, critical: 10 },
        throughput: { warning: 10, critical: 5 },
        databaseQueryTime: { warning: 100, critical: 500 }
      },
      enableDetailedLogging: true,
      ...config
    };

    this.startTime = new Date();
    logger.info('Application Monitor Service initialized', { config: this.config });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<ApplicationMonitorConfig>): ApplicationMonitorService {
    if (!ApplicationMonitorService.instance) {
      ApplicationMonitorService.instance = new ApplicationMonitorService(config);
    }
    return ApplicationMonitorService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (ApplicationMonitorService.instance) {
      ApplicationMonitorService.instance.shutdown();
      ApplicationMonitorService.instance = undefined as any;
    }
  }

  /**
   * Start application monitoring
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Application Monitor is already running');
      return;
    }

    this.isRunning = true;
    
    // Start periodic collection and analysis
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.cleanupOldLogs();
    }, this.config.collectInterval);

    logger.info('Application Monitor started', {
      interval: this.config.collectInterval
    });

    this.emit('started');
  }

  /**
   * Stop application monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    logger.info('Application Monitor stopped');
    this.emit('stopped');
  }

  /**
   * Log a request
   */
  public logRequest(log: Omit<RequestLog, 'id' | 'timestamp'>): void {
    const requestLog: RequestLog = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...log
    };

    // Add to request logs
    this.requestLogs.push(requestLog);
    
    // Update endpoint metrics
    this.updateEndpointMetrics(requestLog);
    
    // Track response times
    this.responseTimes.push(requestLog.responseTime);
    this.requestsPerInterval++;
    
    // Track errors
    if (requestLog.statusCode >= 400) {
      this.errorsPerInterval++;
    }

    // Emit request event
    this.emit('request', requestLog);

    if (this.config.enableDetailedLogging) {
      logger.debug('Request logged', {
        method: requestLog.method,
        path: requestLog.path,
        statusCode: requestLog.statusCode,
        responseTime: requestLog.responseTime
      });
    }
  }

  /**
   * Log an error
   */
  public logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): void {
    const errorLog: ErrorLog = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...error
    };

    this.errorLogs.push(errorLog);
    this.emit('error', errorLog);

    logger.error('Application error logged', {
      type: errorLog.type,
      message: errorLog.message,
      level: errorLog.level
    });
  }

  /**
   * Update database metrics
   */
  public updateDatabaseMetrics(metrics: {
    queryTime?: number;
    connectionPoolSize?: number;
    activeConnections?: number;
    isSlowQuery?: boolean;
  }): void {
    if (metrics.queryTime !== undefined) {
      this.databaseMetrics.queryCount++;
      this.databaseMetrics.totalQueryTime += metrics.queryTime;
      
      if (metrics.isSlowQuery) {
        this.databaseMetrics.slowQueries++;
      }
    }
    
    if (metrics.connectionPoolSize !== undefined) {
      this.databaseMetrics.connectionPoolSize = metrics.connectionPoolSize;
    }
    
    if (metrics.activeConnections !== undefined) {
      this.databaseMetrics.activeConnections = metrics.activeConnections;
    }
  }

  /**
   * Update WebSocket metrics
   */
  public updateWebSocketMetrics(metrics: {
    activeConnections?: number;
    messagesSent?: number;
    disconnection?: boolean;
  }): void {
    if (metrics.activeConnections !== undefined) {
      this.websocketMetrics.activeConnections = metrics.activeConnections;
    }
    
    if (metrics.messagesSent !== undefined) {
      this.websocketMetrics.totalMessages += metrics.messagesSent;
    }
    
    if (metrics.disconnection) {
      this.websocketMetrics.disconnections++;
    }
  }

  /**
   * Get current application metrics
   */
  public getCurrentMetrics(): ApplicationMetrics {
    const now = new Date();
    const uptime = (now.getTime() - this.startTime.getTime()) / 1000;
    const recentRequests = this.getRecentRequests(60000); // Last minute
    const recentErrors = this.getRecentErrors(60000); // Last minute

    // Calculate response time percentiles
    const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
    const responseTimeStats = this.calculatePercentiles(sortedResponseTimes);

    // Calculate throughput
    const requestsPerMinute = recentRequests.length;
    const requestsPerSecond = requestsPerMinute / 60;

    // Calculate error rate
    const errorRate = recentRequests.length > 0 
      ? (recentErrors.length / recentRequests.length) * 100 
      : 0;

    // Calculate database averages
    const averageQueryTime = this.databaseMetrics.queryCount > 0
      ? this.databaseMetrics.totalQueryTime / this.databaseMetrics.queryCount
      : 0;

    // Calculate WebSocket messages per second
    const messagesPerSecond = this.websocketMetrics.totalMessages / uptime;

    // Get memory and system metrics
    const memoryUsage = process.memoryUsage();
    const systemUptime = process.uptime();
    const cpuUsage = process.cpuUsage();

    return {
      performance: {
        responseTime: {
          average: responseTimeStats.average,
          p50: responseTimeStats.p50,
          p95: responseTimeStats.p95,
          p99: responseTimeStats.p99
        },
        throughput: {
          requestsPerSecond,
          requestsPerMinute
        },
        errorRate,
        uptime
      },
      endpoints: this.getEndpointMetricsSummary(),
      errors: {
        total: this.errorLogs.length,
        byType: this.getErrorsByType(),
        recent: this.getRecentErrors(3600000).slice(0, 10) // Last hour, top 10
      },
      database: {
        queryCount: this.databaseMetrics.queryCount,
        averageQueryTime,
        slowQueries: this.databaseMetrics.slowQueries,
        connectionPoolSize: this.databaseMetrics.connectionPoolSize,
        activeConnections: this.databaseMetrics.activeConnections
      },
      websocket: {
        activeConnections: this.websocketMetrics.activeConnections,
        messagesPerSecond,
        totalMessages: this.websocketMetrics.totalMessages,
        disconnections: this.websocketMetrics.disconnections
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      system: {
        uptime: systemUptime,
        cpuUsage: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      },
      timestamp: now
    };
  }

  /**
   * Get endpoint metrics summary
   */
  private getEndpointMetricsSummary(): Record<string, EndpointMetrics> {
    const summary: Record<string, EndpointMetrics> = {};
    
    for (const [key, metrics] of this.endpointMetrics) {
      summary[key] = { ...metrics };
    }
    
    return summary;
  }

  /**
   * Update endpoint metrics
   */
  private updateEndpointMetrics(request: RequestLog): void {
    const key = `${request.method}:${request.path}`;
    const existing = this.endpointMetrics.get(key);
    
    if (existing) {
      existing.count++;
      existing.totalTime += request.responseTime;
      existing.averageTime = existing.totalTime / existing.count;
      existing.minTime = Math.min(existing.minTime, request.responseTime);
      existing.maxTime = Math.max(existing.maxTime, request.responseTime);
      existing.lastCall = request.timestamp;
      existing.statusCodes[request.statusCode] = (existing.statusCodes[request.statusCode] || 0) + 1;
      
      if (request.statusCode >= 400) {
        existing.errorCount++;
        existing.errorRate = (existing.errorCount / existing.count) * 100;
      }
    } else {
      const newMetrics: EndpointMetrics = {
        path: request.path,
        method: request.method,
        count: 1,
        totalTime: request.responseTime,
        averageTime: request.responseTime,
        minTime: request.responseTime,
        maxTime: request.responseTime,
        errorCount: request.statusCode >= 400 ? 1 : 0,
        errorRate: request.statusCode >= 400 ? 100 : 0,
        lastCall: request.timestamp,
        statusCodes: { [request.statusCode]: 1 }
      };
      
      this.endpointMetrics.set(key, newMetrics);
    }
  }

  /**
   * Calculate response time percentiles
   */
  private calculatePercentiles(responseTimes: number[]): {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (responseTimes.length === 0) {
      return { average: 0, p50: 0, p95: 0, p99: 0 };
    }

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

    return { average, p50, p95, p99 };
  }

  /**
   * Get recent requests
   */
  private getRecentRequests(duration: number): RequestLog[] {
    const cutoff = new Date(Date.now() - duration);
    return this.requestLogs.filter(log => log.timestamp >= cutoff);
  }

  /**
   * Get recent errors
   */
  private getRecentErrors(duration: number): ErrorLog[] {
    const cutoff = new Date(Date.now() - duration);
    return this.errorLogs.filter(log => log.timestamp >= cutoff);
  }

  /**
   * Get errors by type
   */
  private getErrorsByType(): Record<string, number> {
    const byType: Record<string, number> = {};
    
    for (const error of this.errorLogs) {
      byType[error.type] = (byType[error.type] || 0) + 1;
    }
    
    return byType;
  }

  /**
   * Collect metrics and reset interval counters
   */
  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    
    // Reset interval counters
    this.requestsPerInterval = 0;
    this.errorsPerInterval = 0;
    
    // Update WebSocket messages per second
    this.websocketMetrics.messagesPerSecond = 
      this.websocketMetrics.totalMessages / metrics.performance.uptime;
    
    this.emit('metrics', metrics);
    
    logger.debug('Application metrics collected', {
      requestsPerSecond: metrics.performance.throughput.requestsPerSecond,
      errorRate: metrics.performance.errorRate,
      averageResponseTime: metrics.performance.responseTime.average
    });
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    const metrics = this.getCurrentMetrics();
    const alerts: PerformanceAlert[] = [];

    // Response time alerts
    const avgResponseTime = metrics.performance.responseTime.average;
    if (avgResponseTime >= this.config.alertThresholds.responseTime.critical) {
      alerts.push({
        type: 'response_time',
        level: 'critical',
        message: `Critical response time: ${avgResponseTime.toFixed(1)}ms`,
        value: avgResponseTime,
        threshold: this.config.alertThresholds.responseTime.critical,
        timestamp: new Date()
      });
    } else if (avgResponseTime >= this.config.alertThresholds.responseTime.warning) {
      alerts.push({
        type: 'response_time',
        level: 'warning',
        message: `High response time: ${avgResponseTime.toFixed(1)}ms`,
        value: avgResponseTime,
        threshold: this.config.alertThresholds.responseTime.warning,
        timestamp: new Date()
      });
    }

    // Error rate alerts
    const errorRate = metrics.performance.errorRate;
    if (errorRate >= this.config.alertThresholds.errorRate.critical) {
      alerts.push({
        type: 'error_rate',
        level: 'critical',
        message: `Critical error rate: ${errorRate.toFixed(1)}%`,
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate.critical,
        timestamp: new Date()
      });
    } else if (errorRate >= this.config.alertThresholds.errorRate.warning) {
      alerts.push({
        type: 'error_rate',
        level: 'warning',
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate.warning,
        timestamp: new Date()
      });
    }

    // Throughput alerts (low throughput)
    const throughput = metrics.performance.throughput.requestsPerSecond;
    if (throughput <= this.config.alertThresholds.throughput.critical && throughput > 0) {
      alerts.push({
        type: 'throughput',
        level: 'critical',
        message: `Low throughput: ${throughput.toFixed(1)} req/s`,
        value: throughput,
        threshold: this.config.alertThresholds.throughput.critical,
        timestamp: new Date()
      });
    } else if (throughput <= this.config.alertThresholds.throughput.warning && throughput > 0) {
      alerts.push({
        type: 'throughput',
        level: 'warning',
        message: `Low throughput: ${throughput.toFixed(1)} req/s`,
        value: throughput,
        threshold: this.config.alertThresholds.throughput.warning,
        timestamp: new Date()
      });
    }

    // Database alerts
    const dbQueryTime = metrics.database.averageQueryTime;
    if (dbQueryTime >= this.config.alertThresholds.databaseQueryTime.critical) {
      alerts.push({
        type: 'database',
        level: 'critical',
        message: `Critical database query time: ${dbQueryTime.toFixed(1)}ms`,
        value: dbQueryTime,
        threshold: this.config.alertThresholds.databaseQueryTime.critical,
        timestamp: new Date()
      });
    } else if (dbQueryTime >= this.config.alertThresholds.databaseQueryTime.warning) {
      alerts.push({
        type: 'database',
        level: 'warning',
        message: `High database query time: ${dbQueryTime.toFixed(1)}ms`,
        value: dbQueryTime,
        threshold: this.config.alertThresholds.databaseQueryTime.warning,
        timestamp: new Date()
      });
    }

    // Emit alerts
    for (const alert of alerts) {
      this.emit('alert', alert);
      logger.warn('Performance alert triggered', alert);
    }
  }

  /**
   * Clean up old logs
   */
  private cleanupOldLogs(): void {
    const now = Date.now();
    
    // Clean up request logs
    const requestCutoff = new Date(now - this.config.requestRetentionPeriod);
    const initialRequestCount = this.requestLogs.length;
    this.requestLogs = this.requestLogs.filter(log => log.timestamp >= requestCutoff);
    
    // Limit request logs by count
    if (this.requestLogs.length > this.config.maxRequestLogs) {
      this.requestLogs = this.requestLogs.slice(-this.config.maxRequestLogs);
    }
    
    // Clean up error logs
    const errorCutoff = new Date(now - this.config.errorRetentionPeriod);
    const initialErrorCount = this.errorLogs.length;
    this.errorLogs = this.errorLogs.filter(log => log.timestamp >= errorCutoff);
    
    // Limit error logs by count
    if (this.errorLogs.length > this.config.maxErrorLogs) {
      this.errorLogs = this.errorLogs.slice(-this.config.maxErrorLogs);
    }
    
    // Clean up response times array
    if (this.responseTimes.length > 10000) {
      this.responseTimes = this.responseTimes.slice(-5000);
    }
    
    const requestsRemoved = initialRequestCount - this.requestLogs.length;
    const errorsRemoved = initialErrorCount - this.errorLogs.length;
    
    if (requestsRemoved > 0 || errorsRemoved > 0) {
      logger.debug('Cleaned up old logs', {
        requestsRemoved,
        errorsRemoved
      });
    }
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): {
    isRunning: boolean;
    uptime: number;
    requestsLogged: number;
    errorsLogged: number;
    endpointsTracked: number;
  } {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      requestsLogged: this.requestLogs.length,
      errorsLogged: this.errorLogs.length,
      endpointsTracked: this.endpointMetrics.size
    };
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.requestLogs = [];
    this.errorLogs = [];
    this.endpointMetrics.clear();
    this.responseTimes = [];
    this.requestsPerInterval = 0;
    this.errorsPerInterval = 0;
    
    this.databaseMetrics = {
      queryCount: 0,
      totalQueryTime: 0,
      slowQueries: 0,
      connectionPoolSize: 0,
      activeConnections: 0
    };
    
    this.websocketMetrics = {
      activeConnections: 0,
      messagesPerSecond: 0,
      totalMessages: 0,
      disconnections: 0
    };

    logger.info('Application Monitor metrics reset');
    this.emit('reset');
  }

  /**
   * Reset all metrics (legacy method - kept for compatibility)
   */
  public reset(): void {
    this.resetMetrics();
  }

  /**
   * Shutdown the monitor
   */
  public shutdown(): void {
    this.stop();
    this.reset();
    this.removeAllListeners();
    logger.info('Application Monitor shut down');
  }
}

export default ApplicationMonitorService;
