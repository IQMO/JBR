/**
 * Exchange Monitor Service
 * 
 * Monitors exchange connectivity, API performance, rate limits, and trading operations.
 * Provides real-time insights into exchange health and performance metrics.
 */

import { EventEmitter } from 'events';

import type { JabbrWebSocketServer } from '../websocket/websocket.service';

import logger from './logging.service';

export interface ExchangeMetrics {
  exchange: string;
  connectivity: {
    status: 'connected' | 'disconnected' | 'degraded';
    lastConnected: Date | null;
    uptime: number;
    connectionAttempts: number;
    failedConnections: number;
    ping: number; // milliseconds
  };
  api: {
    requestCount: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
    slowRequests: number;
    timeouts: number;
  };
  rateLimits: {
    current: number;
    maximum: number;
    resetTime: Date | null;
    utilizationPercentage: number;
    violations: number;
    weight: number;
  };
  trading: {
    activeOrders: number;
    completedOrders: number;
    failedOrders: number;
    orderFillRate: number;
    averageExecutionTime: number;
    slippage: {
      average: number;
      maximum: number;
      count: number;
    };
  };
  websocket: {
    status: 'connected' | 'disconnected' | 'reconnecting';
    lastMessage: Date | null;
    messagesReceived: number;
    reconnectCount: number;
    latency: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    lastCheck: Date;
    score: number; // 0-100
  };
  timestamp: Date;
}

export interface ApiRequestMetric {
  id: string;
  endpoint: string;
  method: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: string;
  statusCode?: number;
  rateLimitRemaining?: number;
  weight?: number;
}

export interface OrderExecutionMetric {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price?: number;
  executedPrice?: number;
  executedQuantity?: number;
  slippage?: number;
  executionTime: number;
  status: 'filled' | 'partial' | 'failed' | 'cancelled';
  timestamp: Date;
}

export interface ExchangeMonitorConfig {
  pingInterval: number;
  healthCheckInterval: number;
  metricsRetentionHours: number;
  thresholds: {
    slowRequestMs: number;
    highErrorRate: number;
    criticalPing: number;
    rateLimitWarning: number;
    rateLimitCritical: number;
  };
  enableDetailedLogging: boolean;
}

export class ExchangeMonitorService extends EventEmitter {
  private config: ExchangeMonitorConfig;
  private websocketServer?: JabbrWebSocketServer;
  private exchangeMetrics: Map<string, ExchangeMetrics> = new Map();
  private apiRequestHistory: Map<string, ApiRequestMetric[]> = new Map();
  private orderHistory: Map<string, OrderExecutionMetric[]> = new Map();
  private isMonitoring = false;
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: Date;

  constructor(
    config: Partial<ExchangeMonitorConfig> = {},
    websocketServer?: JabbrWebSocketServer
  ) {
    super();
    
    this.config = {
      pingInterval: 30000, // 30 seconds
      healthCheckInterval: 60000, // 60 seconds
      metricsRetentionHours: 24,
      thresholds: {
        slowRequestMs: 5000,
        highErrorRate: 10, // 10%
        criticalPing: 2000, // 2 seconds
        rateLimitWarning: 80, // 80%
        rateLimitCritical: 95 // 95%
      },
      enableDetailedLogging: true,
      ...config
    };

    this.websocketServer = websocketServer;
    this.startTime = new Date();

    logger.info('Exchange Monitor Service initialized', { config: this.config });
  }

  /**
   * Start monitoring an exchange
   */
  public startMonitoring(exchangeName: string): void {
    if (this.isMonitoring && this.exchangeMetrics.has(exchangeName)) {
      logger.warn(`Already monitoring exchange: ${exchangeName}`);
      return;
    }

    // Initialize metrics for the exchange
    this.initializeExchangeMetrics(exchangeName);

    // Start ping monitoring
    this.startPingMonitoring(exchangeName);

    // Start health checks if not already running
    if (!this.healthCheckInterval) {
      this.startHealthChecks();
    }

    this.isMonitoring = true;

    logger.info(`Started monitoring exchange: ${exchangeName}`);
    this.emit('monitoringStarted', exchangeName);
  }

  /**
   * Stop monitoring an exchange
   */
  public stopMonitoring(exchangeName: string): void {
    const pingInterval = this.pingIntervals.get(exchangeName);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(exchangeName);
    }

    this.exchangeMetrics.delete(exchangeName);
    this.apiRequestHistory.delete(exchangeName);
    this.orderHistory.delete(exchangeName);

    logger.info(`Stopped monitoring exchange: ${exchangeName}`);
    this.emit('monitoringStopped', exchangeName);

    // Stop health checks if no exchanges are being monitored
    if (this.exchangeMetrics.size === 0 && this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.isMonitoring = false;
    }
  }

  /**
   * Record an API request
   */
  public recordApiRequest(
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
    const requestMetric: ApiRequestMetric = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      startTime: new Date(Date.now() - duration),
      endTime: new Date(),
      duration,
      success,
      error,
      statusCode,
      rateLimitRemaining,
      weight
    };

    // Store request history
    if (!this.apiRequestHistory.has(exchangeName)) {
      this.apiRequestHistory.set(exchangeName, []);
    }
    this.apiRequestHistory.get(exchangeName)!.push(requestMetric);

    // Update exchange metrics
    this.updateApiMetrics(exchangeName, requestMetric);

    // Check for issues
    this.checkApiIssues(exchangeName, requestMetric);

    this.emit('apiRequest', exchangeName, requestMetric);
  }

  /**
   * Record order execution
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
    const slippage = price && executedPrice 
      ? Math.abs((executedPrice - price) / price) * 100
      : undefined;

    const orderMetric: OrderExecutionMetric = {
      orderId,
      symbol,
      side,
      type,
      quantity,
      price,
      executedPrice,
      executedQuantity,
      slippage,
      executionTime,
      status,
      timestamp: new Date()
    };

    // Store order history
    if (!this.orderHistory.has(exchangeName)) {
      this.orderHistory.set(exchangeName, []);
    }
    this.orderHistory.get(exchangeName)!.push(orderMetric);

    // Update trading metrics
    this.updateTradingMetrics(exchangeName, orderMetric);

    this.emit('orderExecution', exchangeName, orderMetric);
  }

  /**
   * Update WebSocket connection status
   */
  public updateWebSocketStatus(
    exchangeName: string,
    status: 'connected' | 'disconnected' | 'reconnecting',
    latency?: number
  ): void {
    const metrics = this.exchangeMetrics.get(exchangeName);
    if (!metrics) {return;}

    metrics.websocket.status = status;
    metrics.websocket.latency = latency || 0;

    if (status === 'connected') {
      metrics.websocket.lastMessage = new Date();
    } else if (status === 'reconnecting') {
      metrics.websocket.reconnectCount++;
    }

    this.emit('websocketStatusChange', exchangeName, status);
  }

  /**
   * Record WebSocket message
   */
  public recordWebSocketMessage(exchangeName: string): void {
    const metrics = this.exchangeMetrics.get(exchangeName);
    if (!metrics) {return;}

    metrics.websocket.messagesReceived++;
    metrics.websocket.lastMessage = new Date();
  }

  /**
   * Get current metrics for an exchange
   */
  public getExchangeMetrics(exchangeName: string): ExchangeMetrics | null {
    return this.exchangeMetrics.get(exchangeName) || null;
  }

  /**
   * Get metrics for all monitored exchanges
   */
  public getAllMetrics(): Map<string, ExchangeMetrics> {
    return new Map(this.exchangeMetrics);
  }

  /**
   * Get API request history
   */
  public getApiRequestHistory(
    exchangeName: string,
    limit = 100
  ): ApiRequestMetric[] {
    const history = this.apiRequestHistory.get(exchangeName) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Get order execution history
   */
  public getOrderHistory(
    exchangeName: string,
    limit = 100
  ): OrderExecutionMetric[] {
    const history = this.orderHistory.get(exchangeName) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Get exchange health summary
   */
  public getHealthSummary(exchangeName: string): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    uptime: number;
  } {
    const metrics = this.getExchangeMetrics(exchangeName);
    
    if (!metrics) {
      return {
        status: 'critical',
        score: 0,
        issues: ['Exchange not monitored'],
        uptime: 0
      };
    }

    return {
      status: metrics.health.status,
      score: metrics.health.score,
      issues: metrics.health.issues,
      uptime: metrics.connectivity.uptime
    };
  }

  /**
   * Initialize metrics for a new exchange
   */
  private initializeExchangeMetrics(exchangeName: string): void {
    const metrics: ExchangeMetrics = {
      exchange: exchangeName,
      connectivity: {
        status: 'disconnected',
        lastConnected: null,
        uptime: 0,
        connectionAttempts: 0,
        failedConnections: 0,
        ping: 0
      },
      api: {
        requestCount: 0,
        requestsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 0,
        successRate: 100,
        slowRequests: 0,
        timeouts: 0
      },
      rateLimits: {
        current: 0,
        maximum: 1000, // Default, will be updated
        resetTime: null,
        utilizationPercentage: 0,
        violations: 0,
        weight: 0
      },
      trading: {
        activeOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        orderFillRate: 0,
        averageExecutionTime: 0,
        slippage: {
          average: 0,
          maximum: 0,
          count: 0
        }
      },
      websocket: {
        status: 'disconnected',
        lastMessage: null,
        messagesReceived: 0,
        reconnectCount: 0,
        latency: 0
      },
      health: {
        status: 'healthy',
        issues: [],
        lastCheck: new Date(),
        score: 100
      },
      timestamp: new Date()
    };

    this.exchangeMetrics.set(exchangeName, metrics);
    this.apiRequestHistory.set(exchangeName, []);
    this.orderHistory.set(exchangeName, []);
  }

  /**
   * Start ping monitoring for an exchange
   */
  private startPingMonitoring(exchangeName: string): void {
    const pingInterval = setInterval(async () => {
      await this.performPing(exchangeName);
    }, this.config.pingInterval);

    this.pingIntervals.set(exchangeName, pingInterval);

    // Perform initial ping
    this.performPing(exchangeName);
  }

  /**
   * Perform ping test to exchange
   */
  private async performPing(exchangeName: string): Promise<void> {
    const metrics = this.exchangeMetrics.get(exchangeName);
    if (!metrics) {return;}

    const startTime = Date.now();
    metrics.connectivity.connectionAttempts++;

    try {
      // This would be replaced with actual exchange ping/health check
      // For now, we'll simulate it
      const ping = await this.simulateExchangePing(exchangeName);
      
      metrics.connectivity.ping = ping;
      metrics.connectivity.status = ping < this.config.thresholds.criticalPing ? 'connected' : 'degraded';
      metrics.connectivity.lastConnected = new Date();
      metrics.connectivity.uptime = (Date.now() - this.startTime.getTime()) / 1000;

    } catch (error) {
      metrics.connectivity.failedConnections++;
      metrics.connectivity.status = 'disconnected';
      metrics.connectivity.ping = Date.now() - startTime;

      logger.error(`Exchange ping failed for ${exchangeName}`, { error });
    }

    this.emit('pingResult', exchangeName, metrics.connectivity);
  }

  /**
   * Simulate exchange ping (to be replaced with actual implementation)
   */
  private async simulateExchangePing(exchangeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Simulate network delay
      setTimeout(() => {
        const ping = Date.now() - startTime;
        
        // Simulate occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
          reject(new Error('Connection timeout'));
        } else {
          resolve(ping);
        }
      }, Math.random() * 500 + 50); // 50-550ms delay
    });
  }

  /**
   * Update API metrics based on request
   */
  private updateApiMetrics(exchangeName: string, request: ApiRequestMetric): void {
    const metrics = this.exchangeMetrics.get(exchangeName);
    if (!metrics) {return;}

    metrics.api.requestCount++;

    // Update response time
    if (request.duration) {
      const totalTime = metrics.api.averageResponseTime * (metrics.api.requestCount - 1) + request.duration;
      metrics.api.averageResponseTime = totalTime / metrics.api.requestCount;

      // Count slow requests
      if (request.duration > this.config.thresholds.slowRequestMs) {
        metrics.api.slowRequests++;
      }
    }

    // Update success/error rates
    if (request.success) {
      metrics.api.successRate = ((metrics.api.successRate * (metrics.api.requestCount - 1)) + 100) / metrics.api.requestCount;
    } else {
      metrics.api.errorRate = ((metrics.api.errorRate * (metrics.api.requestCount - 1)) + 100) / metrics.api.requestCount;
      metrics.api.successRate = 100 - metrics.api.errorRate;
    }

    // Update rate limit info
    if (request.rateLimitRemaining !== undefined) {
      metrics.rateLimits.current = request.rateLimitRemaining;
      if (metrics.rateLimits.maximum > 0) {
        metrics.rateLimits.utilizationPercentage = 
          ((metrics.rateLimits.maximum - request.rateLimitRemaining) / metrics.rateLimits.maximum) * 100;
      }
    }

    if (request.weight !== undefined) {
      metrics.rateLimits.weight += request.weight;
    }

    // Calculate requests per second
    const timeWindow = 60000; // 1 minute
    const recentRequests = this.apiRequestHistory.get(exchangeName)?.filter(
      req => req.startTime.getTime() > Date.now() - timeWindow
    ) || [];
    metrics.api.requestsPerSecond = recentRequests.length / 60;

    metrics.timestamp = new Date();
  }

  /**
   * Update trading metrics based on order execution
   */
  private updateTradingMetrics(exchangeName: string, order: OrderExecutionMetric): void {
    const metrics = this.exchangeMetrics.get(exchangeName);
    if (!metrics) {return;}

    // Update order counts
    if (order.status === 'filled') {
      metrics.trading.completedOrders++;
    } else if (order.status === 'failed') {
      metrics.trading.failedOrders++;
    }

    // Update execution time
    const totalOrders = metrics.trading.completedOrders + metrics.trading.failedOrders;
    if (totalOrders > 0) {
      const totalTime = metrics.trading.averageExecutionTime * (totalOrders - 1) + order.executionTime;
      metrics.trading.averageExecutionTime = totalTime / totalOrders;
    }

    // Update order fill rate
    const totalOrdersAttempted = metrics.trading.completedOrders + metrics.trading.failedOrders;
    if (totalOrdersAttempted > 0) {
      metrics.trading.orderFillRate = (metrics.trading.completedOrders / totalOrdersAttempted) * 100;
    }

    // Update slippage
    if (order.slippage !== undefined) {
      const currentCount = metrics.trading.slippage.count;
      const currentAverage = metrics.trading.slippage.average;
      
      metrics.trading.slippage.count++;
      metrics.trading.slippage.average = (currentAverage * currentCount + order.slippage) / metrics.trading.slippage.count;
      metrics.trading.slippage.maximum = Math.max(metrics.trading.slippage.maximum, order.slippage);
    }

    metrics.timestamp = new Date();
  }

  /**
   * Check for API issues and alerts
   */
  private checkApiIssues(exchangeName: string, request: ApiRequestMetric): void {
    // Check for rate limit violations
    if (request.rateLimitRemaining !== undefined) {
      const metrics = this.exchangeMetrics.get(exchangeName);
      if (metrics && metrics.rateLimits.utilizationPercentage > this.config.thresholds.rateLimitCritical) {
        this.emit('rateLimitViolation', exchangeName, metrics.rateLimits);
      }
    }

    // Check for slow requests
    if (request.duration && request.duration > this.config.thresholds.slowRequestMs) {
      this.emit('slowApiRequest', exchangeName, request);
    }

    // Check for API errors
    if (!request.success) {
      this.emit('apiError', exchangeName, request);
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks for all exchanges
   */
  private performHealthChecks(): void {
    for (const [exchangeName, metrics] of this.exchangeMetrics) {
      this.updateHealthScore(exchangeName, metrics);
    }

    // Broadcast health update
    if (this.websocketServer) {
      this.websocketServer.broadcast('exchange-health', {
        type: 'exchange_health_update',
        data: Object.fromEntries(this.exchangeMetrics)
      });
    }
  }

  /**
   * Update health score for an exchange
   */
  private updateHealthScore(exchangeName: string, metrics: ExchangeMetrics): void {
    const issues: string[] = [];
    let score = 100;

    // Check connectivity
    if (metrics.connectivity.status === 'disconnected') {
      score -= 30;
      issues.push('Exchange disconnected');
    } else if (metrics.connectivity.status === 'degraded') {
      score -= 15;
      issues.push(`High ping: ${metrics.connectivity.ping}ms`);
    }

    // Check API performance
    if (metrics.api.errorRate > this.config.thresholds.highErrorRate) {
      score -= 20;
      issues.push(`High API error rate: ${metrics.api.errorRate.toFixed(1)}%`);
    }

    if (metrics.api.averageResponseTime > this.config.thresholds.slowRequestMs) {
      score -= 10;
      issues.push(`Slow API responses: ${metrics.api.averageResponseTime.toFixed(0)}ms`);
    }

    // Check rate limits
    if (metrics.rateLimits.utilizationPercentage > this.config.thresholds.rateLimitCritical) {
      score -= 25;
      issues.push(`Critical rate limit usage: ${metrics.rateLimits.utilizationPercentage.toFixed(1)}%`);
    } else if (metrics.rateLimits.utilizationPercentage > this.config.thresholds.rateLimitWarning) {
      score -= 10;
      issues.push(`High rate limit usage: ${metrics.rateLimits.utilizationPercentage.toFixed(1)}%`);
    }

    // Check WebSocket
    if (metrics.websocket.status === 'disconnected') {
      score -= 15;
      issues.push('WebSocket disconnected');
    } else if (metrics.websocket.status === 'reconnecting') {
      score -= 5;
      issues.push('WebSocket reconnecting');
    }

    // Check trading performance
    if (metrics.trading.orderFillRate < 95 && metrics.trading.completedOrders > 10) {
      score -= 10;
      issues.push(`Low order fill rate: ${metrics.trading.orderFillRate.toFixed(1)}%`);
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 90) {
      status = 'healthy';
    } else if (score >= 70) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    // Update metrics
    metrics.health = {
      status,
      issues,
      lastCheck: new Date(),
      score: Math.max(0, score)
    };

    // Emit health change events
    this.emit('healthUpdate', exchangeName, metrics.health);

    if (status === 'critical') {
      this.emit('exchangeCritical', exchangeName, issues);
    } else if (status === 'warning') {
      this.emit('exchangeWarning', exchangeName, issues);
    }
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);

    for (const [exchangeName, requests] of this.apiRequestHistory) {
      this.apiRequestHistory.set(
        exchangeName,
        requests.filter(req => req.startTime.getTime() > cutoffTime)
      );
    }

    for (const [exchangeName, orders] of this.orderHistory) {
      this.orderHistory.set(
        exchangeName,
        orders.filter(order => order.timestamp.getTime() > cutoffTime)
      );
    }
  }

  /**
   * Export metrics data
   */
  public exportMetrics(): {
    exchanges: Record<string, ExchangeMetrics>;
    apiRequests: Record<string, ApiRequestMetric[]>;
    orders: Record<string, OrderExecutionMetric[]>;
    summary: {
      totalExchanges: number;
      healthyExchanges: number;
      totalApiRequests: number;
      totalOrders: number;
    };
  } {
    const exchanges = Object.fromEntries(this.exchangeMetrics);
    const apiRequests = Object.fromEntries(this.apiRequestHistory);
    const orders = Object.fromEntries(this.orderHistory);

    const healthyExchanges = Array.from(this.exchangeMetrics.values())
      .filter(m => m.health.status === 'healthy').length;

    const totalApiRequests = Array.from(this.apiRequestHistory.values())
      .reduce((sum, requests) => sum + requests.length, 0);

    const totalOrders = Array.from(this.orderHistory.values())
      .reduce((sum, orders) => sum + orders.length, 0);

    return {
      exchanges,
      apiRequests,
      orders,
      summary: {
        totalExchanges: this.exchangeMetrics.size,
        healthyExchanges,
        totalApiRequests,
        totalOrders
      }
    };
  }

  /**
   * Shutdown the exchange monitor service
   */
  public shutdown(): void {
    // Stop all ping intervals
    for (const [exchangeName, interval] of this.pingIntervals) {
      clearInterval(interval);
    }
    this.pingIntervals.clear();

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Clear data
    this.exchangeMetrics.clear();
    this.apiRequestHistory.clear();
    this.orderHistory.clear();

    this.isMonitoring = false;
    this.removeAllListeners();

    logger.info('Exchange Monitor Service shut down');
  }
}

export default ExchangeMonitorService;
