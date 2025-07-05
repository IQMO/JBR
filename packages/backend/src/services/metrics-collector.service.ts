/**
 * Metrics Collector Service
 * 
 * Centralized metrics collection and aggregation service that gathers metrics
 * from all monitoring services and provides unified metrics storage and querying.
 */

import { EventEmitter } from 'events';

import type { ApplicationMetrics } from './application-monitor.service';
import logger from './logging.service';
import type { SystemMetrics } from './system-monitor.service';

export interface MetricValue {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  unit?: string;
  description?: string;
  values: MetricValue[];
}

export interface AggregatedMetrics {
  system: {
    cpu: {
      usage: MetricSeries;
      loadAverage: MetricSeries;
    };
    memory: {
      usage: MetricSeries;
      percentage: MetricSeries;
    };
    disk: {
      usage: MetricSeries;
      percentage: MetricSeries;
    };
    process: {
      uptime: MetricSeries;
      memoryUsage: MetricSeries;
    };
  };
  application: {
    performance: {
      responseTime: MetricSeries;
      throughput: MetricSeries;
      errorRate: MetricSeries;
    };
    database: {
      queryTime: MetricSeries;
      queryCount: MetricSeries;
      connectionPool: MetricSeries;
    };
    websocket: {
      activeConnections: MetricSeries;
      messagesPerSecond: MetricSeries;
    };
  };
  trading: {
    bots: {
      activeCount: MetricSeries;
      totalTrades: MetricSeries;
      totalPnL: MetricSeries;
      winRate: MetricSeries;
    };
    orders: {
      placed: MetricSeries;
      filled: MetricSeries;
      cancelled: MetricSeries;
      failed: MetricSeries;
    };
    positions: {
      open: MetricSeries;
      unrealizedPnL: MetricSeries;
    };
  };
  custom: Record<string, MetricSeries>;
}

export interface MetricsQuery {
  metric: string;
  startTime?: Date;
  endTime?: Date;
  labels?: Record<string, string>;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'last';
  groupBy?: string[];
  interval?: number; // milliseconds for time-based grouping
}

export interface QueryResult {
  metric: string;
  values: Array<{
    timestamp: Date;
    value: number;
    labels?: Record<string, string>;
  }>;
  aggregation?: string;
  interval?: number;
}

export interface MetricsCollectorConfig {
  retentionPeriod: number; // milliseconds
  maxMetricsPerSeries: number;
  aggregationInterval: number; // milliseconds
  enablePersistence: boolean;
  persistenceInterval: number; // milliseconds
}

export class MetricsCollectorService extends EventEmitter {
  private config: MetricsCollectorConfig;
  private metrics: Map<string, MetricSeries> = new Map();
  private aggregatedMetrics: AggregatedMetrics;
  private aggregationInterval?: NodeJS.Timeout;
  private persistenceInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    super();
    
    this.config = {
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      maxMetricsPerSeries: 10000,
      aggregationInterval: 60000, // 1 minute
      enablePersistence: true,
      persistenceInterval: 5 * 60 * 1000, // 5 minutes
      ...config
    };

    this.aggregatedMetrics = this.initializeAggregatedMetrics();
    logger.info('Metrics Collector Service initialized', { config: this.config });
  }

  /**
   * Start metrics collection
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Metrics Collector is already running');
      return;
    }

    this.isRunning = true;

    // Start aggregation interval
    this.aggregationInterval = setInterval(() => {
      this.performAggregation();
      this.cleanupOldMetrics();
    }, this.config.aggregationInterval);

    // Start persistence interval if enabled
    if (this.config.enablePersistence) {
      this.persistenceInterval = setInterval(() => {
        void this.persistMetrics();
      }, this.config.persistenceInterval);
    }

    logger.info('Metrics Collector started', {
      aggregationInterval: this.config.aggregationInterval,
      persistenceEnabled: this.config.enablePersistence
    });

    this.emit('started');
  }

  /**
   * Stop metrics collection
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = undefined;
    }

    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
      this.persistenceInterval = undefined;
    }

    logger.info('Metrics Collector stopped');
    this.emit('stopped');
  }

  /**
   * Record a metric value
   */
  public recordMetric(
    name: string,
    value: number,
    type: MetricSeries['type'] = 'gauge',
    options: {
      unit?: string;
      description?: string;
      labels?: Record<string, string>;
      timestamp?: Date;
    } = {}
  ): void {
    if (!this.isRunning) {
      throw new Error('Metrics collector is not running. Call start() first.');
    }

    const metricValue: MetricValue = {
      timestamp: options.timestamp || new Date(),
      value,
      labels: options.labels
    };

    let series = this.metrics.get(name);
    
    if (!series) {
      series = {
        name,
        type,
        unit: options.unit,
        description: options.description,
        values: []
      };
      this.metrics.set(name, series);
    }

    // Add the value
    series.values.push(metricValue);

    // Trim if exceeding max size
    if (series.values.length > this.config.maxMetricsPerSeries) {
      series.values = series.values.slice(-this.config.maxMetricsPerSeries / 2);
    }

    // Emit metric event
    this.emit('metric', { name, value: metricValue, series });

    logger.debug('Metric recorded', {
      name,
      value,
      type,
      labels: options.labels
    });
  }

  /**
   * Record counter increment
   */
  public incrementCounter(name: string, amount = 1, labels?: Record<string, string>): void {
    const existing = this.getLatestValue(name);
    const newValue = (existing?.value || 0) + amount;
    
    this.recordMetric(name, newValue, 'counter', { labels });
  }

  /**
   * Record gauge value
   */
  public recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, 'gauge', { labels });
  }

  /**
   * Record histogram value (simplified implementation)
   */
  public recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    // For simplicity, we'll store histogram values as individual points
    // In a production system, you'd want proper histogram buckets
    this.recordMetric(`${name}_value`, value, 'histogram', { labels });
    this.incrementCounter(`${name}_count`, 1, labels);
  }

  /**
   * Process system metrics
   */
  public processSystemMetrics(metrics: SystemMetrics): void {
    const timestamp = metrics.timestamp;

    // CPU metrics
    this.recordMetric('system.cpu.usage', metrics.cpu.usage, 'gauge', {
      unit: 'percent',
      timestamp,
      description: 'CPU usage percentage'
    });

    this.recordMetric('system.cpu.load_average_1m', metrics.cpu.loadAverage.at(0) || 0, 'gauge', {
      unit: 'load',
      timestamp,
      description: '1-minute load average'
    });

    // Memory metrics
    this.recordMetric('system.memory.usage', metrics.memory.used, 'gauge', {
      unit: 'bytes',
      timestamp,
      description: 'Memory usage in bytes'
    });

    this.recordMetric('system.memory.percentage', metrics.memory.percentage, 'gauge', {
      unit: 'percent',
      timestamp,
      description: 'Memory usage percentage'
    });

    // Disk metrics
    this.recordMetric('system.disk.usage', metrics.disk.used, 'gauge', {
      unit: 'bytes',
      timestamp,
      description: 'Disk usage in bytes'
    });

    this.recordMetric('system.disk.percentage', metrics.disk.percentage, 'gauge', {
      unit: 'percent',
      timestamp,
      description: 'Disk usage percentage'
    });

    // Process metrics
    this.recordMetric('system.process.uptime', metrics.process.uptime, 'gauge', {
      unit: 'seconds',
      timestamp,
      description: 'Process uptime in seconds'
    });

    this.recordMetric('system.process.memory', metrics.process.memoryUsage.heapUsed, 'gauge', {
      unit: 'bytes',
      timestamp,
      description: 'Process heap memory usage'
    });
  }

  /**
   * Process application metrics
   */
  public processApplicationMetrics(metrics: ApplicationMetrics): void {
    const timestamp = metrics.timestamp;

    // Performance metrics
    this.recordMetric('app.performance.response_time_avg', metrics.performance.responseTime.average, 'gauge', {
      unit: 'milliseconds',
      timestamp,
      description: 'Average response time'
    });

    this.recordMetric('app.performance.throughput', metrics.performance.throughput.requestsPerSecond, 'gauge', {
      unit: 'requests/second',
      timestamp,
      description: 'Requests per second'
    });

    this.recordMetric('app.performance.error_rate', metrics.performance.errorRate, 'gauge', {
      unit: 'percent',
      timestamp,
      description: 'Error rate percentage'
    });

    // Database metrics
    this.recordMetric('app.database.query_time_avg', metrics.database.averageQueryTime, 'gauge', {
      unit: 'milliseconds',
      timestamp,
      description: 'Average database query time'
    });

    this.recordMetric('app.database.query_count', metrics.database.queryCount, 'counter', {
      unit: 'queries',
      timestamp,
      description: 'Total database queries'
    });

    this.recordMetric('app.database.active_connections', metrics.database.activeConnections, 'gauge', {
      unit: 'connections',
      timestamp,
      description: 'Active database connections'
    });

    // WebSocket metrics
    this.recordMetric('app.websocket.active_connections', metrics.websocket.activeConnections, 'gauge', {
      unit: 'connections',
      timestamp,
      description: 'Active WebSocket connections'
    });

    this.recordMetric('app.websocket.messages_per_second', metrics.websocket.messagesPerSecond, 'gauge', {
      unit: 'messages/second',
      timestamp,
      description: 'WebSocket messages per second'
    });
  }

  /**
   * Process trading metrics
   */
  public processTradingMetrics(metrics: {
    activeBots: number;
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    ordersPlaced: number;
    ordersFilled: number;
    ordersCancelled: number;
    ordersFailed: number;
    openPositions: number;
    unrealizedPnL: number;
    timestamp?: Date;
  }): void {
    const timestamp = metrics.timestamp || new Date();

    // Bot metrics
    this.recordMetric('trading.bots.active', metrics.activeBots, 'gauge', {
      unit: 'bots',
      timestamp,
      description: 'Number of active trading bots'
    });

    this.recordMetric('trading.bots.total_trades', metrics.totalTrades, 'counter', {
      unit: 'trades',
      timestamp,
      description: 'Total trades executed'
    });

    this.recordMetric('trading.bots.total_pnl', metrics.totalPnL, 'gauge', {
      unit: 'currency',
      timestamp,
      description: 'Total profit and loss'
    });

    this.recordMetric('trading.bots.win_rate', metrics.winRate, 'gauge', {
      unit: 'percent',
      timestamp,
      description: 'Win rate percentage'
    });

    // Order metrics
    this.recordMetric('trading.orders.placed', metrics.ordersPlaced, 'counter', {
      unit: 'orders',
      timestamp,
      description: 'Orders placed'
    });

    this.recordMetric('trading.orders.filled', metrics.ordersFilled, 'counter', {
      unit: 'orders',
      timestamp,
      description: 'Orders filled'
    });

    this.recordMetric('trading.orders.cancelled', metrics.ordersCancelled, 'counter', {
      unit: 'orders',
      timestamp,
      description: 'Orders cancelled'
    });

    this.recordMetric('trading.orders.failed', metrics.ordersFailed, 'counter', {
      unit: 'orders',
      timestamp,
      description: 'Orders failed'
    });

    // Position metrics
    this.recordMetric('trading.positions.open', metrics.openPositions, 'gauge', {
      unit: 'positions',
      timestamp,
      description: 'Open positions'
    });

    this.recordMetric('trading.positions.unrealized_pnl', metrics.unrealizedPnL, 'gauge', {
      unit: 'currency',
      timestamp,
      description: 'Unrealized profit and loss'
    });
  }

  /**
   * Query metrics
   */
  public queryMetrics(query: MetricsQuery): QueryResult {
    const series = this.metrics.get(query.metric);
    
    if (!series) {
      return {
        metric: query.metric,
        values: []
      };
    }

    let values = [...series.values];

    // Filter by time range
    if (query.startTime) {
      values = values.filter(v => v.timestamp >= query.startTime!);
    }
    
    if (query.endTime) {
      values = values.filter(v => v.timestamp <= query.endTime!);
    }

    // Filter by labels
    if (query.labels) {
      values = values.filter(v => {
        if (!v.labels) {return false;}
        
        for (const [key, value] of Object.entries(query.labels!)) {
          if (v.labels[key] !== value) {return false;}
        }
        
        return true;
      });
    }

    // Apply aggregation
    if (query.aggregation && values.length > 0) {
      const aggregatedValue = this.aggregateValues(values, query.aggregation);
      const lastValue = values.at(-1);
      if (lastValue) {
        return {
          metric: query.metric,
          values: [{
            timestamp: lastValue.timestamp,
            value: aggregatedValue,
            labels: query.labels
          }],
          aggregation: query.aggregation
        };
      }
    }

    // Group by interval if specified
    if (query.interval && query.interval > 0) {
      values = this.groupByInterval(values, query.interval);
    }

    return {
      metric: query.metric,
      values: values.map(v => ({
        timestamp: v.timestamp,
        value: v.value,
        labels: v.labels
      })),
      interval: query.interval
    };
  }

  /**
   * Get all metric names
   */
  public getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get metric series
   */
  public getMetricSeries(name: string): MetricSeries | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get latest value for a metric
   */
  public getLatestValue(name: string): MetricValue | undefined {
    const series = this.metrics.get(name);
    if (!series || series.values.length === 0) {
      return undefined;
    }
    
    return series.values[series.values.length - 1];
  }

  /**
   * Get aggregated metrics
   */
  public getAggregatedMetrics(): AggregatedMetrics {
    return this.aggregatedMetrics;
  }

  /**
   * Get metrics summary for dashboard
   */
  public getMetricsSummary(): {
    totalMetrics: number;
    totalDataPoints: number;
    oldestDataPoint: Date | null;
    newestDataPoint: Date | null;
    memoryUsage: number;
  } {
    let totalDataPoints = 0;
    let oldestDataPoint: Date | null = null;
    let newestDataPoint: Date | null = null;

    for (const series of this.metrics.values()) {
      totalDataPoints += series.values.length;
      
      if (series.values.length > 0) {
        const firstValue = series.values.at(0);
        const lastValue = series.values[series.values.length - 1];
        
        if (firstValue && lastValue) {
          const oldest = firstValue.timestamp;
          const newest = lastValue.timestamp;
          
          if (!oldestDataPoint || oldest < oldestDataPoint) {
            oldestDataPoint = oldest;
          }
          
          if (!newestDataPoint || newest > newestDataPoint) {
            newestDataPoint = newest;
          }
        }
      }
    }

    return {
      totalMetrics: this.metrics.size,
      totalDataPoints,
      oldestDataPoint,
      newestDataPoint,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Initialize aggregated metrics structure
   */
  private initializeAggregatedMetrics(): AggregatedMetrics {
    const createSeries = (name: string, type: MetricSeries['type'] = 'gauge'): MetricSeries => ({
      name,
      type,
      values: []
    });

    return {
      system: {
        cpu: {
          usage: createSeries('system.cpu.usage'),
          loadAverage: createSeries('system.cpu.load_average_1m')
        },
        memory: {
          usage: createSeries('system.memory.usage'),
          percentage: createSeries('system.memory.percentage')
        },
        disk: {
          usage: createSeries('system.disk.usage'),
          percentage: createSeries('system.disk.percentage')
        },
        process: {
          uptime: createSeries('system.process.uptime'),
          memoryUsage: createSeries('system.process.memory')
        }
      },
      application: {
        performance: {
          responseTime: createSeries('app.performance.response_time_avg'),
          throughput: createSeries('app.performance.throughput'),
          errorRate: createSeries('app.performance.error_rate')
        },
        database: {
          queryTime: createSeries('app.database.query_time_avg'),
          queryCount: createSeries('app.database.query_count', 'counter'),
          connectionPool: createSeries('app.database.active_connections')
        },
        websocket: {
          activeConnections: createSeries('app.websocket.active_connections'),
          messagesPerSecond: createSeries('app.websocket.messages_per_second')
        }
      },
      trading: {
        bots: {
          activeCount: createSeries('trading.bots.active'),
          totalTrades: createSeries('trading.bots.total_trades', 'counter'),
          totalPnL: createSeries('trading.bots.total_pnl'),
          winRate: createSeries('trading.bots.win_rate')
        },
        orders: {
          placed: createSeries('trading.orders.placed', 'counter'),
          filled: createSeries('trading.orders.filled', 'counter'),
          cancelled: createSeries('trading.orders.cancelled', 'counter'),
          failed: createSeries('trading.orders.failed', 'counter')
        },
        positions: {
          open: createSeries('trading.positions.open'),
          unrealizedPnL: createSeries('trading.positions.unrealized_pnl')
        }
      },
      custom: {}
    };
  }

  /**
   * Perform aggregation
   */
  private performAggregation(): void {
    // Update aggregated metrics with latest values
    for (const [key, series] of this.metrics) {
      if (series.values.length === 0) {continue;}
      
      const latestValue = series.values[series.values.length - 1];
      
      // Update aggregated structure
      if (key.startsWith('system.cpu.usage') && latestValue) {
        this.aggregatedMetrics.system.cpu.usage.values.push(latestValue);
      } else if (key.startsWith('system.memory.percentage') && latestValue) {
        this.aggregatedMetrics.system.memory.percentage.values.push(latestValue);
      }
      // Add more mappings as needed...
    }

    this.emit('aggregation', this.aggregatedMetrics);
  }

  /**
   * Aggregate values using specified method
   */
  private aggregateValues(values: MetricValue[], method: string): number {
    if (values.length === 0) {return 0;}

    switch (method) {
      case 'avg':
        return values.reduce((sum, v) => sum + v.value, 0) / values.length;
      case 'sum':
        return values.reduce((sum, v) => sum + v.value, 0);
      case 'min':
        return Math.min(...values.map(v => v.value));
      case 'max':
        return Math.max(...values.map(v => v.value));
      case 'count':
        return values.length;
      case 'last':
        return values.length > 0 ? values.at(-1)?.value ?? 0 : 0;
      default:
        return values.length > 0 ? values.at(-1)?.value ?? 0 : 0;
    }
  }

  /**
   * Group values by time interval
   */
  private groupByInterval(values: MetricValue[], interval: number): MetricValue[] {
    if (values.length === 0) {return [];}

    const firstValue = values.at(0);
    if (!firstValue) {return [];}

    const grouped: MetricValue[] = [];
    const startTime = firstValue.timestamp.getTime();
    
    let currentBucket = Math.floor((firstValue.timestamp.getTime() - startTime) / interval);
    let bucketValues: MetricValue[] = [];

    for (const value of values) {
      const bucket = Math.floor((value.timestamp.getTime() - startTime) / interval);
      
      if (bucket === currentBucket) {
        bucketValues.push(value);
      } else {
        // Process current bucket
        if (bucketValues.length > 0) {
          const avgValue = bucketValues.reduce((sum, v) => sum + v.value, 0) / bucketValues.length;
          const firstBucketValue = bucketValues.at(0);
          grouped.push({
            timestamp: new Date(startTime + currentBucket * interval),
            value: avgValue,
            labels: firstBucketValue?.labels
          });
        }
        
        // Start new bucket
        currentBucket = bucket;
        bucketValues = [value];
      }
    }

    // Process last bucket
    if (bucketValues.length > 0) {
      const avgValue = bucketValues.reduce((sum, v) => sum + v.value, 0) / bucketValues.length;
      const firstBucketValue = bucketValues.at(0);
      grouped.push({
        timestamp: new Date(startTime + currentBucket * interval),
        value: avgValue,
        labels: firstBucketValue?.labels
      });
    }

    return grouped;
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);
    let totalRemoved = 0;

    for (const [name, series] of this.metrics) {
      const initialLength = series.values.length;
      series.values = series.values.filter(v => v.timestamp >= cutoff);
      totalRemoved += initialLength - series.values.length;
    }

    if (totalRemoved > 0) {
      logger.debug(`Cleaned up ${totalRemoved} old metric values`);
    }
  }

  /**
   * Persist metrics to storage (placeholder implementation)
   */
  private async persistMetrics(): Promise<void> {
    try {
      // In a real implementation, this would save metrics to a database
      // For now, we'll just log the operation
      const summary = this.getMetricsSummary();
      logger.debug('Metrics persistence checkpoint', {
        totalMetrics: summary.totalMetrics,
        totalDataPoints: summary.totalDataPoints
      });
      
      this.emit('persistence', summary);
    } catch (error) {
      logger.error('Failed to persist metrics', { error });
    }
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics.clear();
    this.aggregatedMetrics = this.initializeAggregatedMetrics();
    
    logger.info('Metrics Collector reset');
    this.emit('reset');
  }

  /**
   * Shutdown the metrics collector
   */
  public shutdown(): void {
    this.stop();
    
    // Perform final persistence if enabled
    if (this.config.enablePersistence) {
      this.persistMetrics();
    }
    
    this.reset();
    this.removeAllListeners();
    
    logger.info('Metrics Collector shut down');
  }
}

export default MetricsCollectorService;
