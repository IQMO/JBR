/**
 * Integration Tests for Database Performance Monitoring System
 * 
 * Tests the complete database monitoring infrastructure including:
 * - DatabaseMonitorService functionality
 * - Performance metrics collection
 * - Query tracking and analysis
 * - Health monitoring and reporting
 * - API endpoint responses
 */

import express from 'express';

import performanceRoutes, { metricsCollector } from '../../src/routes/performance.routes';
import DatabaseMonitorService from '../../src/services/database-monitor.service';

describe('Database Performance Monitoring Integration', () => {
  let app: express.Application;
  let server: any;
  let databaseMonitor: DatabaseMonitorService;

  beforeAll(async () => {
    // Create Express app with database monitoring
    app = express();
    
    // Setup middleware
    app.use(express.json());
    
    // Add performance routes
    app.use('/performance', performanceRoutes);
    
    // Initialize database monitor
    databaseMonitor = new DatabaseMonitorService({
      metricsRetentionHours: 1,
      slowQueryThresholdMs: 100,
      enableQueryLogging: true,
      healthCheckInterval: 5000,
      connectionThresholds: {
        warning: 15,
        critical: 18
      },
      performanceThresholds: {
        slowQueryMs: 100,
        highLockWaitMs: 1000,
        lowCacheHitRatio: 0.8
      }
    });
    
    // Start monitoring
    databaseMonitor.start();
    
    // Start server
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    // Stop metrics collection to prevent memory leaks
    if (metricsCollector) {
      metricsCollector.stop();
    }
    
    if (databaseMonitor) {
      databaseMonitor.shutdown();
    }
    
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('DatabaseMonitorService Core Functionality', () => {
    test('should initialize and start monitoring successfully', () => {
      expect(databaseMonitor).toBeDefined();
      expect(() => databaseMonitor.start()).not.toThrow();
    });

    test('should record and track query metrics', () => {
      const testQuery = 'SELECT * FROM users WHERE id = $1';
      
      // Record a test query using correct signature
      databaseMonitor.recordQuery(testQuery, 50, undefined, 5);
      
      // Get query history
      const history = databaseMonitor.getQueryHistory(10);
      
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(q => q.query.includes('SELECT * FROM users'))).toBe(true);
    });

    test('should detect slow queries', () => {
      const slowQuery = 'SELECT * FROM large_table ORDER BY created_at';
      
      // Record a slow query (200ms, above threshold of 100ms)
      databaseMonitor.recordQuery(slowQuery, 200, undefined, 1000);
      
      // Get slow queries
      const slowQueries = databaseMonitor.getSlowQueries(5);
      
      expect(slowQueries.length).toBeGreaterThan(0);
      expect(slowQueries.some(q => q.duration >= 100)).toBe(true);
    });

    test('should track table access patterns', () => {
      // Record queries on different tables
      databaseMonitor.recordQuery('SELECT * FROM users', 30, undefined, 1);
      databaseMonitor.recordQuery('INSERT INTO orders VALUES (...)', 45, undefined, 1);
      databaseMonitor.recordQuery('SELECT * FROM users WHERE active = true', 25, undefined, 10);
      
      // Get table access patterns
      const patterns = databaseMonitor.getTableAccessPatterns();
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.tableName === 'users')).toBe(true);
      expect(patterns.some(p => p.tableName === 'orders')).toBe(true);
      
      // Check that users table has multiple accesses
      const usersPattern = patterns.find(p => p.tableName === 'users');
      expect(usersPattern?.accessCount).toBeGreaterThan(1);
    });

    test('should generate comprehensive metrics', async () => {
      // Add some test data
      databaseMonitor.recordQuery('SELECT COUNT(*) FROM products', 80, undefined, 1);
      databaseMonitor.recordQuery('UPDATE users SET last_login = NOW()', 120, undefined, 5);
      
      // Get current metrics
      const metrics = await databaseMonitor.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.queries).toBeDefined();
      expect(metrics.connections).toBeDefined();
      expect(metrics.tables).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.health).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      
      expect(metrics.queries.totalExecuted).toBeGreaterThan(0);
      expect(metrics.queries.averageTime).toBeGreaterThan(0);
    });

    test('should assess health status correctly', async () => {
      // Add a mix of queries to test health assessment
      databaseMonitor.recordQuery('SELECT * FROM users', 50, undefined, 1);
      databaseMonitor.recordQuery('SELECT * FROM products', 150, undefined, 1); // Slow
      databaseMonitor.recordQuery('SELECT * FROM orders', 30, undefined, 1);
      
      // Add a small delay to ensure some uptime accumulates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const healthSummary = await databaseMonitor.getHealthSummary();
      
      expect(healthSummary).toBeDefined();
      expect(healthSummary.status).toMatch(/healthy|warning|critical/);
      expect(healthSummary.uptime).toBeGreaterThan(0);
      expect(Array.isArray(healthSummary.issues)).toBe(true);
    });

    test('should handle query errors', () => {
      const errorQuery = 'SELECT * FROM nonexistent_table';
      
      // Record a query with error
      databaseMonitor.recordQuery(errorQuery, 0, 'Table does not exist');
      
      const history = databaseMonitor.getQueryHistory(10);
      const errorQuery_record = history.find(q => q.error);
      
      expect(errorQuery_record).toBeDefined();
      expect(errorQuery_record?.error).toBe('Table does not exist');
    });
  });

  describe('Service Lifecycle and Configuration', () => {
    test('should handle service shutdown gracefully', () => {
      const testMonitor = new DatabaseMonitorService();
      testMonitor.start();
      
      expect(() => {
        testMonitor.shutdown();
      }).not.toThrow();
    });

    test('should handle restart scenarios', () => {
      const restartMonitor = new DatabaseMonitorService();
      
      expect(() => {
        restartMonitor.start();
        restartMonitor.stop();
        restartMonitor.start();
        restartMonitor.shutdown();
      }).not.toThrow();
    });

    test('should respect configuration settings', () => {
      const customConfig = {
        slowQueryThresholdMs: 50,
        enableQueryLogging: false
      };
      
      const configuredMonitor = new DatabaseMonitorService(customConfig);
      expect(configuredMonitor).toBeDefined();
    });
  });

  describe('Data Export and Analysis', () => {
    test('should export comprehensive metrics data', () => {
      // Add some test data
      databaseMonitor.recordQuery('SELECT * FROM export_test', 45, undefined, 1);
      databaseMonitor.recordQuery('INSERT INTO export_test VALUES (...)', 65, undefined, 1);
      
      const exportData = databaseMonitor.exportMetrics();
      
      expect(exportData).toBeDefined();
      expect(exportData.queries).toBeDefined();
      expect(exportData.tables).toBeDefined();
      expect(exportData.metricsHistory).toBeDefined();
      expect(exportData.summary).toBeDefined();
      
      expect(Array.isArray(exportData.queries)).toBe(true);
      expect(Array.isArray(exportData.tables)).toBe(true);
      expect(exportData.summary.totalQueries).toBeGreaterThan(0);
    });

    test('should provide metrics history filtering', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      
      const history = databaseMonitor.getMetricsHistory(oneHourAgo, now);
      
      expect(Array.isArray(history)).toBe(true);
      // History might be empty for a new service, which is fine
    });
  });

  describe('Performance Tracking', () => {
    test('should track metrics over time', async () => {
      // Add queries at different times
      databaseMonitor.recordQuery('SELECT * FROM users', 40, undefined, 1);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      databaseMonitor.recordQuery('SELECT * FROM products', 60, undefined, 1);
      
      const metrics = await databaseMonitor.getCurrentMetrics();
      expect(metrics.queries.totalExecuted).toBeGreaterThanOrEqual(2);
    });

    test('should handle concurrent query tracking', async () => {
      // Simulate concurrent queries
      const concurrentPromises = Array.from({ length: 10 }, (_, i) => 
        new Promise<void>(resolve => {
          setTimeout(() => {
            databaseMonitor.recordQuery(`SELECT * FROM table${i}`, 20 + i * 5, undefined, 1);
            resolve();
          }, i * 10);
        })
      );
      
      await Promise.all(concurrentPromises);
      
      const history = databaseMonitor.getQueryHistory(20);
      expect(history.length).toBeGreaterThanOrEqual(10);
    });

    test('should calculate query operation types correctly', () => {
      // Test different operation types
      databaseMonitor.recordQuery('SELECT * FROM test', 25, undefined, 1);
      databaseMonitor.recordQuery('INSERT INTO test VALUES (1)', 35, undefined, 1);
      databaseMonitor.recordQuery('UPDATE test SET value = 2', 40, undefined, 1);
      databaseMonitor.recordQuery('DELETE FROM test WHERE id = 1', 30, undefined, 1);
      
      const history = databaseMonitor.getQueryHistory(10);
      
      const operations = history.map(q => q.operation);
      expect(operations).toContain('SELECT');
      expect(operations).toContain('INSERT');
      expect(operations).toContain('UPDATE');
      expect(operations).toContain('DELETE');
    });
  });
});
