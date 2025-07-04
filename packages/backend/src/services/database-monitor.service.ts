/**
 * Database Monitor Service
 * 
 * Monitors database performance, connections, query patterns, and health.
 * Provides insights into database bottlenecks and optimization opportunities.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import type { JabbrWebSocketServer } from '../websocket/websocket.service';

import { database } from './database.service';
import logger from './logging.service';

export interface DatabaseMetrics {
  connections: {
    active: number;
    idle: number;
    total: number;
    maxAllowed: number;
    utilizationPercentage: number;
  };
  queries: {
    totalExecuted: number;
    averageTime: number;
    slowQueries: number;
    failedQueries: number;
    queriesPerSecond: number;
    longestQuery: QueryMetric | null;
  };
  tables: {
    mostAccessed: TableMetric[];
    tableStats: Map<string, TableStatistic>;
  };
  performance: {
    transactionsPerSecond: number;
    lockWaitTime: number;
    cacheHitRatio: number;
    indexEfficiency: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    lastCheck: Date;
    uptime: number;
  };
  timestamp: Date;
}

export interface QueryMetric {
  id: string;
  query: string;
  duration: number;
  timestamp: Date;
  tableName?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  rowsAffected?: number;
  error?: string;
}

export interface TableMetric {
  tableName: string;
  accessCount: number;
  totalTime: number;
  averageTime: number;
  operations: {
    select: number;
    insert: number;
    update: number;
    delete: number;
  };
}

export interface TableStatistic {
  tableName: string;
  rowCount: number;
  sizeInMB: number;
  indexCount: number;
  lastAnalyzed: Date;
  fragmentationPercentage: number;
}

export interface DatabaseMonitorConfig {
  metricsRetentionHours: number;
  slowQueryThresholdMs: number;
  enableQueryLogging: boolean;
  healthCheckInterval: number;
  connectionThresholds: {
    warning: number;
    critical: number;
  };
  performanceThresholds: {
    slowQueryMs: number;
    highLockWaitMs: number;
    lowCacheHitRatio: number;
  };
}

export class DatabaseMonitorService extends EventEmitter {
  private config: DatabaseMonitorConfig;
  private websocketServer?: JabbrWebSocketServer;
  private queryHistory: QueryMetric[] = [];
  private tableMetrics: Map<string, TableMetric> = new Map();
  private metricsHistory: DatabaseMetrics[] = [];
  private isMonitoring = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private queryCounter = 0;
  private startTime: Date;
  private lastMetricsCalculation = Date.now();

  constructor(
    config: Partial<DatabaseMonitorConfig> = {},
    websocketServer?: JabbrWebSocketServer
  ) {
    super();
    
    this.config = {
      metricsRetentionHours: 24,
      slowQueryThresholdMs: 1000,
      enableQueryLogging: true,
      healthCheckInterval: 30000, // 30 seconds
      connectionThresholds: {
        warning: 80, // 80% of max connections
        critical: 95 // 95% of max connections
      },
      performanceThresholds: {
        slowQueryMs: 1000,
        highLockWaitMs: 100,
        lowCacheHitRatio: 0.8
      },
      ...config
    };

    this.websocketServer = websocketServer;
    this.startTime = new Date();

    logger.info('Database Monitor Service initialized', { config: this.config });
  }

  /**
   * Start database monitoring
   */
  public start(): void {
    if (this.isMonitoring) {
      logger.warn('Database Monitor Service is already running');
      return;
    }

    this.isMonitoring = true;

    // Setup query monitoring
    if (this.config.enableQueryLogging) {
      this.setupQueryMonitoring();
    }

    // Start health checks
    this.startHealthChecks();

    // Cleanup old metrics
    this.scheduleMetricsCleanup();

    logger.info('Database Monitor Service started');
    this.emit('started');
  }

  /**
   * Stop database monitoring
   */
  public stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    logger.info('Database Monitor Service stopped');
    this.emit('stopped');
  }

  /**
   * Get current database metrics
   */
  public async getCurrentMetrics(): Promise<DatabaseMetrics> {
    try {
      const connections = await this.getConnectionMetrics();
      const queries = this.getQueryMetrics();
      const tables = await this.getTableMetrics();
      const performance = await this.getPerformanceMetrics();
      const health = await this.getHealthMetrics();

      const metrics: DatabaseMetrics = {
        connections,
        queries,
        tables,
        performance,
        health,
        timestamp: new Date()
      };

      // Store metrics history
      this.metricsHistory.push(metrics);

      // Emit metrics
      this.emit('metricsUpdate', metrics);        // Broadcast via WebSocket
        if (this.websocketServer) {
          this.websocketServer.broadcast('system', {
            type: 'database_metrics',
            data: metrics
          });
        }

      return metrics;

    } catch (error) {
      logger.error('Failed to collect database metrics', { error });
      throw error;
    }
  }

  /**
   * Record a query execution
   */
  public recordQuery(
    query: string,
    duration: number,
    error?: string,
    rowsAffected?: number
  ): void {
    if (!this.isMonitoring || !this.config.enableQueryLogging) {
      return;
    }

    this.queryCounter++;

    const queryMetric: QueryMetric = {
      id: `query_${this.queryCounter}_${Date.now()}`,
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      operation: this.determineOperation(query),
      rowsAffected,
      error,
      tableName: this.extractTableName(query)
    };

    this.queryHistory.push(queryMetric);

    // Update table metrics
    if (queryMetric.tableName) {
      this.updateTableMetrics(queryMetric);
    }

    // Check for slow queries
    if (duration > this.config.slowQueryThresholdMs) {
      this.handleSlowQuery(queryMetric);
    }

    // Check for query errors
    if (error) {
      this.handleQueryError(queryMetric);
    }

    this.emit('queryExecuted', queryMetric);
  }

  /**
   * Get query history
   */
  public getQueryHistory(limit = 100): QueryMetric[] {
    return this.queryHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get slow queries
   */
  public getSlowQueries(limit = 50): QueryMetric[] {
    return this.queryHistory
      .filter(query => query.duration > this.config.slowQueryThresholdMs)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get table access patterns
   */
  public getTableAccessPatterns(): TableMetric[] {
    return Array.from(this.tableMetrics.values())
      .sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Get database health summary
   */
  public async getHealthSummary(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
    lastCheck: Date;
  }> {
    try {
      return await this.getHealthMetrics();
    } catch (error) {
      logger.error('Failed to get database health summary', { error });
      return {
        status: 'critical',
        issues: ['Failed to check database health'],
        uptime: 0,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Get connection metrics
   */
  private async getConnectionMetrics(): Promise<DatabaseMetrics['connections']> {
    try {
      // Get current connection stats
      const connectionQuery = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const result = await database.query(connectionQuery) as any;
      const connectionStats = result.rows?.[0] || {};

      // Get max connections setting
      const maxConnResult = await database.query('SHOW max_connections') as any;
      const maxConnections = parseInt(maxConnResult.rows?.[0]?.max_connections) || 100;

      const active = parseInt(connectionStats.active_connections) || 0;
      const idle = parseInt(connectionStats.idle_connections) || 0;
      const total = parseInt(connectionStats.total_connections) || 0;

      return {
        active,
        idle,
        total,
        maxAllowed: maxConnections,
        utilizationPercentage: (total / maxConnections) * 100
      };

    } catch (error) {
      logger.error('Failed to get connection metrics', { error });
      return {
        active: 0,
        idle: 0,
        total: 0,
        maxAllowed: 100,
        utilizationPercentage: 0
      };
    }
  }

  /**
   * Get query metrics
   */
  private getQueryMetrics(): DatabaseMetrics['queries'] {
    const now = Date.now();
    const timeWindow = now - this.lastMetricsCalculation;
    const recentQueries = this.queryHistory.filter(
      q => now - q.timestamp.getTime() < timeWindow
    );

    const totalExecuted = this.queryHistory.length;
    const averageTime = recentQueries.length > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
      : 0;

    const slowQueries = this.queryHistory.filter(
      q => q.duration > this.config.slowQueryThresholdMs
    ).length;

    const failedQueries = this.queryHistory.filter(q => q.error).length;

    const queriesPerSecond = timeWindow > 0 
      ? (recentQueries.length / (timeWindow / 1000))
      : 0;

    const longestQuery = this.queryHistory.length > 0
      ? this.queryHistory.reduce((longest, current) => 
          current.duration > longest.duration ? current : longest
        )
      : null;

    this.lastMetricsCalculation = now;

    return {
      totalExecuted,
      averageTime,
      slowQueries,
      failedQueries,
      queriesPerSecond,
      longestQuery
    };
  }

  /**
   * Get table metrics
   */
  private async getTableMetrics(): Promise<DatabaseMetrics['tables']> {
    try {
      // Get table statistics from PostgreSQL
      const tableStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan as sequential_scans,
          seq_tup_read as sequential_reads,
          idx_scan as index_scans,
          idx_tup_fetch as index_reads
        FROM pg_stat_user_tables
        ORDER BY (seq_scan + idx_scan) DESC
        LIMIT 10
      `;

      const tableStatsResult = await database.query(tableStatsQuery) as any;
      const tableStats = new Map<string, TableStatistic>();

      // Get table sizes
      const tableSizeQuery = `
        SELECT 
          tablename,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
      `;

      const tableSizeResult = await database.query(tableSizeQuery) as any;
      const tableSizes = new Map<string, number>();

      (tableSizeResult.rows || []).forEach((row: any) => {
        tableSizes.set(row.tablename, parseInt(row.size_bytes) || 0);
      });

      // Process table statistics
      for (const row of (tableStatsResult.rows || [])) {
        const tableName = row.tablename;
        const sizeBytes = tableSizes.get(tableName) || 0;

        tableStats.set(tableName, {
          tableName,
          rowCount: parseInt(row.sequential_reads) + parseInt(row.index_reads),
          sizeInMB: sizeBytes / (1024 * 1024),
          indexCount: parseInt(row.index_scans) > 0 ? 1 : 0, // Simplified
          lastAnalyzed: new Date(), // Would need pg_stat_user_tables.last_analyze
          fragmentationPercentage: 0 // Would need more complex query
        });
      }

      // Get most accessed tables from our metrics
      const mostAccessed = Array.from(this.tableMetrics.values())
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10);

      return {
        mostAccessed,
        tableStats
      };

    } catch (error) {
      logger.error('Failed to get table metrics', { error });
      return {
        mostAccessed: [],
        tableStats: new Map()
      };
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<DatabaseMetrics['performance']> {
    try {
      // Get database statistics
      const statsQuery = `
        SELECT 
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted
        FROM pg_stat_database 
        WHERE datname = current_database()
      `;

      const result = await database.query(statsQuery) as any;
      const stats = result.rows?.[0] || {};

      // Calculate cache hit ratio
      const blksRead = parseInt(stats.blks_read) || 0;
      const blksHit = parseInt(stats.blks_hit) || 0;
      const cacheHitRatio = (blksRead + blksHit) > 0 
        ? blksHit / (blksRead + blksHit) 
        : 1;

      // Calculate transactions per second (approximation)
      const commits = parseInt(stats.xact_commit) || 0;
      const rollbacks = parseInt(stats.xact_rollback) || 0;
      const uptime = (Date.now() - this.startTime.getTime()) / 1000;
      const transactionsPerSecond = uptime > 0 
        ? (commits + rollbacks) / uptime 
        : 0;

      // Get lock information
      const lockQuery = `
        SELECT count(*) as lock_count
        FROM pg_locks 
        WHERE NOT granted
      `;

      const lockResult = await database.query(lockQuery) as any;
      const lockCount = parseInt(lockResult.rows?.[0]?.lock_count) || 0;

      return {
        transactionsPerSecond,
        lockWaitTime: lockCount * 10, // Simplified estimate
        cacheHitRatio,
        indexEfficiency: cacheHitRatio // Simplified - would need more complex calculation
      };

    } catch (error) {
      logger.error('Failed to get performance metrics', { error });
      return {
        transactionsPerSecond: 0,
        lockWaitTime: 0,
        cacheHitRatio: 1,
        indexEfficiency: 1
      };
    }
  }

  /**
   * Get health metrics
   */
  private async getHealthMetrics(): Promise<DatabaseMetrics['health']> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    try {
      // Check connections
      const connections = await this.getConnectionMetrics();
      if (connections.utilizationPercentage > this.config.connectionThresholds.critical) {
        issues.push(`Critical connection usage: ${connections.utilizationPercentage.toFixed(1)}%`);
        status = 'critical';
      } else if (connections.utilizationPercentage > this.config.connectionThresholds.warning) {
        issues.push(`High connection usage: ${connections.utilizationPercentage.toFixed(1)}%`);
        if (status === 'healthy') {status = 'warning';}
      }

      // Check performance
      const performance = await this.getPerformanceMetrics();
      if (performance.cacheHitRatio < this.config.performanceThresholds.lowCacheHitRatio) {
        issues.push(`Low cache hit ratio: ${(performance.cacheHitRatio * 100).toFixed(1)}%`);
        if (status === 'healthy') {status = 'warning';}
      }

      if (performance.lockWaitTime > this.config.performanceThresholds.highLockWaitMs) {
        issues.push(`High lock wait time: ${performance.lockWaitTime.toFixed(0)}ms`);
        if (status === 'healthy') {status = 'warning';}
      }

      // Check for too many slow queries
      const slowQueries = this.getSlowQueries(10);
      if (slowQueries.length > 5) {
        issues.push(`Many slow queries: ${slowQueries.length} recent slow queries`);
        if (status === 'healthy') {status = 'warning';}
      }

      // Check connectivity
      try {
        await database.query('SELECT 1');
      } catch (connectError) {
        issues.push(`Database connectivity error: ${connectError instanceof Error ? connectError.message : String(connectError)}`);
        status = 'critical';
      }
      
      return {
        status,
        issues,
        lastCheck: new Date(),
        uptime: (Date.now() - this.startTime.getTime()) / 1000
      };

    } catch (error) {
      return {
        status: 'critical',
        issues: [`Health check error: ${error instanceof Error ? error.message : String(error)}`],
        lastCheck: new Date(),
        uptime: (Date.now() - this.startTime.getTime()) / 1000
      };
    }
  }

  /**
   * Setup query monitoring hooks
   */
  private setupQueryMonitoring(): void {
    // Note: This would typically hook into the database client
    // For now, we'll rely on manual recordQuery calls
    logger.info('Query monitoring setup completed');
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getCurrentMetrics();
      } catch (error) {
        logger.error('Database health check failed', { error });
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Schedule metrics cleanup
   */
  private scheduleMetricsCleanup(): void {
    const cleanupIntervalMs = 60 * 60 * 1000; // 1 hour

    // Clear existing interval if any
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, cleanupIntervalMs);
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);

    // Clean query history
    this.queryHistory = this.queryHistory.filter(
      query => query.timestamp.getTime() > cutoffTime
    );

    // Clean metrics history
    this.metricsHistory = this.metricsHistory.filter(
      metrics => metrics.timestamp.getTime() > cutoffTime
    );

    logger.debug('Cleaned up old database metrics', {
      queryHistorySize: this.queryHistory.length,
      metricsHistorySize: this.metricsHistory.length
    });
  }

  /**
   * Handle slow query detection
   */
  private handleSlowQuery(queryMetric: QueryMetric): void {
    logger.warn('Slow query detected', {
      queryId: queryMetric.id,
      duration: queryMetric.duration,
      query: queryMetric.query,
      tableName: queryMetric.tableName
    });

    this.emit('slowQuery', queryMetric);

    // Broadcast slow query alert
    if (this.websocketServer) {
      this.websocketServer.broadcast('alerts', {
        type: 'slow_query',
        data: {
          queryId: queryMetric.id,
          duration: queryMetric.duration,
          query: queryMetric.query,
          timestamp: queryMetric.timestamp
        }
      });
    }
  }

  /**
   * Handle query error
   */
  private handleQueryError(queryMetric: QueryMetric): void {
    logger.error('Database query error', {
      queryId: queryMetric.id,
      error: queryMetric.error,
      query: queryMetric.query
    });

    this.emit('queryError', queryMetric);
  }

  /**
   * Update table metrics
   */
  private updateTableMetrics(queryMetric: QueryMetric): void {
    if (!queryMetric.tableName) {return;}

    const existing = this.tableMetrics.get(queryMetric.tableName) || {
      tableName: queryMetric.tableName,
      accessCount: 0,
      totalTime: 0,
      averageTime: 0,
      operations: {
        select: 0,
        insert: 0,
        update: 0,
        delete: 0
      }
    };

    existing.accessCount++;
    existing.totalTime += queryMetric.duration;
    existing.averageTime = existing.totalTime / existing.accessCount;

    // Update operation counts
    const operation = queryMetric.operation.toLowerCase();
    if (operation in existing.operations) {
      (existing.operations as any)[operation]++;
    }

    this.tableMetrics.set(queryMetric.tableName, existing);
  }

  /**
   * Utility functions
   */
  private sanitizeQuery(query: string): string {
    // Remove sensitive data and normalize query
    return query
      .replace(/VALUES\s*\([^)]*\)/gi, 'VALUES (...)')
      .replace(/=\s*'[^']*'/gi, "= '***'")
      .replace(/=\s*\d+/gi, '= ***')
      .substring(0, 200);
  }

  private determineOperation(query: string): QueryMetric['operation'] {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (normalizedQuery.startsWith('SELECT')) {return 'SELECT';}
    if (normalizedQuery.startsWith('INSERT')) {return 'INSERT';}
    if (normalizedQuery.startsWith('UPDATE')) {return 'UPDATE';}
    if (normalizedQuery.startsWith('DELETE')) {return 'DELETE';}
    
    return 'OTHER';
  }

  private extractTableName(query: string): string | undefined {
    // Simple table name extraction
    const patterns = [
      /FROM\s+(\w+)/i,
      /UPDATE\s+(\w+)/i,
      /INSERT\s+INTO\s+(\w+)/i,
      /DELETE\s+FROM\s+(\w+)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }

    return undefined;
  }

  /**
   * Get metrics for specific time range
   */
  public getMetricsHistory(
    startTime: Date,
    endTime: Date = new Date()
  ): DatabaseMetrics[] {
    return this.metricsHistory.filter(
      metrics => metrics.timestamp >= startTime && metrics.timestamp <= endTime
    );
  }

  /**
   * Export metrics data
   */
  public exportMetrics(): {
    queries: QueryMetric[];
    tables: TableMetric[];
    metricsHistory: DatabaseMetrics[];
    summary: {
      totalQueries: number;
      slowQueries: number;
      errorQueries: number;
      monitoringDuration: number;
    };
  } {
    return {
      queries: this.queryHistory,
      tables: Array.from(this.tableMetrics.values()),
      metricsHistory: this.metricsHistory,
      summary: {
        totalQueries: this.queryHistory.length,
        slowQueries: this.queryHistory.filter(q => q.duration > this.config.slowQueryThresholdMs).length,
        errorQueries: this.queryHistory.filter(q => q.error).length,
        monitoringDuration: (Date.now() - this.startTime.getTime()) / 1000
      }
    };
  }

  /**
   * Shutdown the database monitor service
   */
  public shutdown(): void {
    this.stop();
    this.queryHistory = [];
    this.tableMetrics.clear();
    this.metricsHistory = [];
    this.removeAllListeners();
    
    logger.info('Database Monitor Service shut down');
  }
}

export default DatabaseMonitorService;
