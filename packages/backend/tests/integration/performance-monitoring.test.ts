/**
 * Integration Tests for Performance Monitoring System
 * 
 * Tests the complete performance monitoring infrastructure including:
 * - Middleware request tracking
 * - Error monitoring
 * - Performance metrics collection
 * - API endpoint responses
 */

import express from 'express';
import request from 'supertest';

import { appMonitoringMiddleware } from '../../src/middleware/app-monitoring.middleware';
import performanceRoutes, { shutdownPerformanceServices } from '../../src/routes/performance.routes';
import ApplicationMonitorService from '../../src/services/application-monitor.service';

describe('Performance Monitoring Integration', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Create Express app with monitoring
    app = express();
    
    // Setup middleware
    app.use(express.json());
    app.use(appMonitoringMiddleware.trackRequests());
    
    // Add performance routes
    app.use('/performance', performanceRoutes);
    
    // Add test endpoints
    app.get('/test/success', (req, res) => {
      res.json({ message: 'Success', timestamp: new Date().toISOString() });
    });
    
    app.get('/test/slow', (req, res) => {
      // Simulate slow response
      setTimeout(() => {
        res.json({ message: 'Slow response', timestamp: new Date().toISOString() });
      }, 100);
    });
    
    app.get('/test/error', (req, res) => {
      throw new Error('Test error for monitoring');
    });
    
    // Error handler with monitoring
    app.use(appMonitoringMiddleware.trackErrors());
    
    // Initialize monitoring
    appMonitoringMiddleware.initialize();
    
    // Start server
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    // Stop all performance services
    shutdownPerformanceServices();
    
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    appMonitoringMiddleware.shutdown();
    
    // Give time for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    // Reset metrics before each test
    ApplicationMonitorService.getInstance().resetMetrics();
  });

  afterEach(() => {
    // Clean up after each test
    ApplicationMonitorService.getInstance().resetMetrics();
  });

  describe('Request Tracking', () => {
    test('should track successful requests', async () => {
      // Make a test request
      const response = await request(app)
        .get('/test/success')
        .expect(200);

      expect(response.body.message).toBe('Success');

      // Wait a bit for metrics to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check metrics
      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      expect(metrics.performance.throughput.requestsPerSecond).toBeGreaterThan(0);
      expect(metrics.performance.uptime).toBeGreaterThan(0);
      expect(metrics.performance.responseTime.average).toBeGreaterThan(0);
      expect(metrics.endpoints['GET:/test/success']).toBeDefined();
    });

    test('should track request timing accurately', async () => {
      // Make slow request
      const startTime = Date.now();
      await request(app)
        .get('/test/slow')
        .expect(200);
      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Wait for metrics processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      const endpointMetrics = metrics.endpoints['GET:/test/slow'];
      
      expect(endpointMetrics).toBeDefined();
      expect(endpointMetrics.averageTime).toBeGreaterThan(50); // Should reflect the delay
      expect(endpointMetrics.averageTime).toBeLessThan(actualDuration + 50); // Should be reasonable
    });

    test('should track multiple requests to same endpoint', async () => {
      // Make multiple requests
      await Promise.all([
        request(app).get('/test/success'),
        request(app).get('/test/success'),
        request(app).get('/test/success')
      ]);

      // Wait for metrics processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      const endpointMetrics = metrics.endpoints['GET:/test/success'];
      
      expect(endpointMetrics.count).toBeGreaterThanOrEqual(3);
      expect(metrics.performance.throughput.requestsPerMinute).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Tracking', () => {
    test('should track server errors', async () => {
      // Make request that causes error
      await request(app)
        .get('/test/error')
        .expect(500);

      // Wait for error processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      expect(metrics.errors.total).toBeGreaterThan(0);
      expect(metrics.performance.errorRate).toBeGreaterThan(0);
    });

    test('should track 404 errors', async () => {
      await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);

      // Wait for metrics processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      expect(metrics.performance.throughput.requestsPerSecond).toBeGreaterThan(0);
    });
  });

  describe('Performance API Endpoints', () => {
    test('should return current metrics', async () => {
      // Generate some activity first
      await request(app).get('/test/success');
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await request(app)
        .get('/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.errors).toBeDefined();
      expect(response.body.data.endpoints).toBeDefined();
    });

    test('should return error metrics', async () => {
      // Generate an error
      await request(app).get('/test/error').expect(500);
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await request(app)
        .get('/performance/errors')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.errors).toBeDefined();
      expect(response.body.data.errorRate).toBeDefined();
    });

    test('should return endpoint-specific metrics', async () => {
      // Generate activity on specific endpoint
      await request(app).get('/test/success');
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await request(app)
        .get('/performance/endpoints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.endpoints).toBeDefined();
      
      // Check if any endpoint data exists
      const endpointData = response.body.data.endpoints;
      expect(typeof endpointData).toBe('object');
    });

    test('should return system health summary', async () => {
      const response = await request(app)
        .get('/performance/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThan(0);
      expect(response.body.data.monitoring).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
    });

    test('should return database metrics', async () => {
      const response = await request(app)
        .get('/performance/database')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comprehensive).toBeDefined();
      expect(response.body.data.health).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });

    test('should return WebSocket metrics', async () => {
      const response = await request(app)
        .get('/performance/websocket')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connections).toBeDefined();
      expect(response.body.data.messagesPerSecond).toBeDefined();
      expect(response.body.data.totalMessages).toBeDefined();
    });
  });

  describe('Real-time Monitoring', () => {
    test('should track concurrent requests', async () => {
      // Make concurrent requests
      const requests = Array.from({ length: 5 }, () => 
        request(app).get('/test/success')
      );

      await Promise.all(requests);
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      expect(metrics.performance.throughput.requestsPerMinute).toBeGreaterThanOrEqual(5);
      expect(metrics.endpoints['GET:/test/success'].count).toBeGreaterThanOrEqual(5);
    });

    test('should calculate accurate throughput', async () => {
      const startTime = Date.now();
      
      // Make multiple requests over time
      for (let i = 0; i < 3; i++) {
        await request(app).get('/test/success');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      
      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = ApplicationMonitorService.getInstance().getCurrentMetrics();
      const throughput = metrics.performance.throughput.requestsPerSecond;
      
      expect(throughput).toBeGreaterThan(0);
      expect(throughput).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe('Memory and Resource Tracking', () => {
    test('should track memory usage', async () => {
      const response = await request(app)
        .get('/performance')
        .expect(200);

      const memoryMetrics = response.body.data.memory;
      expect(memoryMetrics.heapUsed).toBeGreaterThan(0);
      expect(memoryMetrics.heapTotal).toBeGreaterThan(0);
      expect(memoryMetrics.external).toBeGreaterThan(0);
      expect(memoryMetrics.rss).toBeGreaterThan(0);
    });

    test('should track CPU usage', async () => {
      const response = await request(app)
        .get('/performance')
        .expect(200);

      const systemMetrics = response.body.data.system;
      expect(systemMetrics.uptime).toBeGreaterThan(0);
      expect(systemMetrics.cpuUsage).toBeDefined();
    });
  });

  describe('Integration with Existing Services', () => {
    test('should work with ApplicationMonitorService singleton', () => {
      const instance1 = ApplicationMonitorService.getInstance();
      const instance2 = ApplicationMonitorService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1.getCurrentMetrics).toBeDefined();
    });

    test('should handle middleware initialization properly', () => {
      expect(() => {
        appMonitoringMiddleware.initialize();
      }).not.toThrow();
    });

    test('should handle graceful shutdown', () => {
      expect(() => {
        appMonitoringMiddleware.shutdown();
        appMonitoringMiddleware.initialize(); // Re-initialize for other tests
      }).not.toThrow();
    });
  });
});
