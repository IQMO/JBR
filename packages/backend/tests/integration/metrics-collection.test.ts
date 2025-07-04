import express from 'express';
import request from 'supertest';

import performanceRoutes, { metricsCollector } from '../../src/routes/performance.routes';

describe('Centralized Metrics Collection Integration', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Setup test app
    app = express();
    app.use(express.json());
    
    // Setup routes (which already includes the metrics collector)
    app.use('/performance', performanceRoutes);

    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (metricsCollector) {
      metricsCollector.stop();
    }
  });

  beforeEach(() => {
    // Reset metrics between tests
    metricsCollector.reset();
  });

  describe('Metrics Overview Endpoint', () => {
    test('GET /performance/metrics should return metrics overview', async () => {
      // Record some test metrics
      metricsCollector.recordMetric('test.counter', 10, 'counter');
      metricsCollector.recordMetric('test.gauge', 50.5, 'gauge');
      metricsCollector.recordMetric('system.cpu.usage', 75.2, 'gauge', {
        unit: 'percent',
        description: 'CPU usage percentage'
      });

      const response = await request(app)
        .get('/performance/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          summary: expect.objectContaining({
            totalMetrics: expect.any(Number),
            totalDataPoints: expect.any(Number),
            memoryUsage: expect.any(Number)
          }),
          metricNames: expect.arrayContaining([
            'test.counter',
            'test.gauge',
            'system.cpu.usage'
          ]),
          aggregated: expect.any(Object),
          overview: expect.objectContaining({
            totalMetricsCollected: expect.any(Number),
            totalDataPoints: expect.any(Number),
            dataRetentionPeriod: '24 hours',
            collectionStatus: 'active'
          })
        },
        meta: expect.objectContaining({
          responseTime: expect.any(Number),
          timestamp: expect.any(String),
          endpoint: '/performance/metrics'
        })
      });

      expect(response.body.data.metricNames).toContain('test.counter');
      expect(response.body.data.metricNames).toContain('test.gauge');
      expect(response.body.data.metricNames).toContain('system.cpu.usage');
    });

    test('should handle empty metrics gracefully', async () => {
      const response = await request(app)
        .get('/performance/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalMetrics).toBe(0);
      expect(response.body.data.metricNames).toEqual([]);
    });
  });

  describe('Metrics Query Endpoint', () => {
    beforeEach(() => {
      // Setup test data
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(fiveMinutesAgo.getTime() + i * 30 * 1000);
        metricsCollector.recordMetric('api.response_time', 100 + i * 10, 'gauge', {
          labels: { endpoint: '/api/test' },
          timestamp
        });
      }
    });

    test('should query metrics successfully', async () => {
      const response = await request(app)
        .post('/performance/metrics/query')
        .send({
          metric: 'api.response_time',
          aggregation: 'avg'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          query: {
            metric: 'api.response_time',
            aggregation: 'avg'
          },
          result: expect.objectContaining({
            values: expect.any(Array)
          }),
          analysis: expect.objectContaining({
            dataPoints: expect.any(Number),
            aggregationApplied: 'avg'
          })
        }
      });

      expect(response.body.data.result.values.length).toBeGreaterThan(0);
    });

    test('should require metric name', async () => {
      const response = await request(app)
        .post('/performance/metrics/query')
        .send({
          aggregation: 'avg'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Metric name is required');
    });

    test('should query with time range filters', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      const response = await request(app)
        .post('/performance/metrics/query')
        .send({
          metric: 'api.response_time',
          startTime: fiveMinutesAgo.toISOString(),
          endTime: twoMinutesAgo.toISOString(),
          aggregation: 'max'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query.startTime).toBe(fiveMinutesAgo.toISOString());
      expect(response.body.data.query.endTime).toBe(twoMinutesAgo.toISOString());
    });
  });

  describe('Specific Metric Endpoint', () => {
    beforeEach(() => {
      // Setup test metric data
      metricsCollector.recordMetric('memory.usage', 1024, 'gauge', {
        unit: 'MB',
        description: 'Memory usage in megabytes'
      });
      metricsCollector.recordMetric('memory.usage', 1100, 'gauge');
      metricsCollector.recordMetric('memory.usage', 950, 'gauge');
    });

    test('should get specific metric data', async () => {
      const response = await request(app)
        .get('/performance/metrics/memory.usage')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          metricName: 'memory.usage',
          series: expect.objectContaining({
            name: 'memory.usage',
            type: 'gauge',
            unit: 'MB',
            description: 'Memory usage in megabytes',
            totalDataPoints: 3
          }),
          recentValues: expect.any(Array),
          latestValue: expect.objectContaining({
            value: 950,
            timestamp: expect.any(String) // JSON serializes Date to string
          }),
          statistics: expect.objectContaining({
            min: 950,
            max: 1100,
            avg: expect.any(Number),
            count: 3,
            latest: 950
          })
        }
      });

      expect(response.body.data.recentValues).toHaveLength(3);
      expect(response.body.data.statistics.avg).toBeCloseTo(1024.67, 1);
    });

    test('should return 404 for non-existent metric', async () => {
      const response = await request(app)
        .get('/performance/metrics/non.existent.metric')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe("Metric 'non.existent.metric' not found");
    });

    test('should handle metric name validation', async () => {
      const response = await request(app)
        .get('/performance/metrics/%20')  // URL-encoded space as metric name
        .expect(400); // Empty metric name validation

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Metric name is required');
    });
  });

  describe('Custom Metric Recording', () => {
    test('should record custom metrics successfully', async () => {
      const metricData = {
        name: 'custom.business.metric',
        value: 42.5,
        type: 'gauge',
        unit: 'count',
        description: 'Custom business metric for testing',
        labels: {
          category: 'business',
          environment: 'test'
        }
      };

      const response = await request(app)
        .post('/performance/metrics/record')
        .send(metricData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Metric recorded successfully',
          metric: expect.objectContaining({
            name: 'custom.business.metric',
            value: 42.5,
            type: 'gauge',
            unit: 'count',
            description: 'Custom business metric for testing',
            labels: {
              category: 'business',
              environment: 'test'
            }
          })
        }
      });

      // Verify the metric was actually recorded
      const series = metricsCollector.getMetricSeries('custom.business.metric');
      expect(series).toBeDefined();
      expect(series?.values).toHaveLength(1);
      expect(series?.values[0].value).toBe(42.5);
    });

    test('should require metric name and value', async () => {
      const response = await request(app)
        .post('/performance/metrics/record')
        .send({
          type: 'gauge'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Metric name and value are required');
    });

    test('should validate metric value is numeric', async () => {
      const response = await request(app)
        .post('/performance/metrics/record')
        .send({
          name: 'test.metric',
          value: 'not-a-number',
          type: 'gauge'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Metric value must be a number');
    });

    test('should use default type when not specified', async () => {
      const response = await request(app)
        .post('/performance/metrics/record')
        .send({
          name: 'test.default.type',
          value: 123
        })
        .expect(200);

      expect(response.body.data.metric.type).toBe('gauge');
    });
  });

  describe('Real-time System Metrics', () => {
    beforeEach(() => {
      // Setup system metrics
      metricsCollector.recordMetric('system.cpu.usage', 65.4, 'gauge', {
        unit: 'percent'
      });
      metricsCollector.recordMetric('system.memory.percentage', 78.2, 'gauge', {
        unit: 'percent'
      });
      metricsCollector.recordMetric('system.disk.percentage', 45.8, 'gauge', {
        unit: 'percent'
      });
      metricsCollector.recordMetric('system.process.uptime', 3600000, 'gauge', {
        unit: 'milliseconds'
      });
      metricsCollector.recordMetric('system.process.memory', 256, 'gauge', {
        unit: 'MB'
      });
    });

    test('should get real-time system metrics', async () => {
      const response = await request(app)
        .get('/performance/metrics/system/realtime')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          realtime: {
            cpu: expect.objectContaining({
              value: 65.4,
              timestamp: expect.any(String) // JSON serializes Date to string
            }),
            memory: expect.objectContaining({
              value: 78.2,
              timestamp: expect.any(String) // JSON serializes Date to string
            }),
            disk: expect.objectContaining({
              value: 45.8,
              timestamp: expect.any(String) // JSON serializes Date to string
            }),
            process: {
              uptime: expect.objectContaining({
                value: 3600000
              }),
              memory: expect.objectContaining({
                value: 256
              })
            }
          },
          status: {
            cpu: 'medium', // 65.4% is between 60-80%
            memory: 'medium', // 78.2% is between 70-85%
            disk: 'normal' // 45.8% is below 75%
          },
          dataAge: expect.objectContaining({
            cpu: expect.any(Number),
            memory: expect.any(Number),
            disk: expect.any(Number)
          })
        }
      });
    });

    test('should handle missing system metrics gracefully', async () => {
      // Reset to clear existing metrics
      metricsCollector.reset();

      const response = await request(app)
        .get('/performance/metrics/system/realtime')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.realtime.cpu).toBeNull();
      expect(response.body.data.status.cpu).toBe('unknown');
      expect(response.body.data.dataAge.cpu).toBeNull();
    });
  });

  describe('Metrics Reset', () => {
    beforeEach(() => {
      // Setup some metrics
      metricsCollector.recordMetric('test.reset.1', 100, 'counter');
      metricsCollector.recordMetric('test.reset.2', 200, 'gauge');
      metricsCollector.recordMetric('test.reset.3', 300, 'histogram');
    });

    test('should reset all metrics successfully', async () => {
      // Verify metrics exist first
      const beforeReset = await request(app)
        .get('/performance/metrics')
        .expect(200);

      expect(beforeReset.body.data.summary.totalMetrics).toBeGreaterThan(0);

      // Reset metrics
      const response = await request(app)
        .delete('/performance/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'All metrics reset successfully',
          cleared: expect.objectContaining({
            totalMetrics: expect.any(Number),
            totalDataPoints: expect.any(Number),
            memoryFreed: expect.any(String)
          })
        }
      });

      // Verify metrics are cleared
      const afterReset = await request(app)
        .get('/performance/metrics')
        .expect(200);

      expect(afterReset.body.data.summary.totalMetrics).toBe(0);
      expect(afterReset.body.data.metricNames).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed query requests', async () => {
      const response = await request(app)
        .post('/performance/metrics/query')
        .send('invalid json')
        .expect(400);

      // Express will handle JSON parsing errors
    });

    test('should handle service errors gracefully', async () => {
      // Stop the metrics collector to simulate service errors
      metricsCollector.stop();

      const response = await request(app)
        .post('/performance/metrics/record')
        .send({
          name: 'test.error',
          value: 123
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to record metric');

      // Restart for other tests
      metricsCollector.start();
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high-frequency metric recording', async () => {
      const startTime = Date.now();
      const promises = [];

      // Record 100 metrics concurrently
      for (let i = 0; i < 100; i++) {
        const promise = request(app)
          .post('/performance/metrics/record')
          .send({
            name: `load.test.metric.${i}`,
            value: Math.random() * 100,
            type: 'gauge'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time (adjust based on performance requirements)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Verify all metrics were recorded
      const summary = await request(app)
        .get('/performance/metrics')
        .expect(200);

      expect(summary.body.data.summary.totalMetrics).toBe(100);
    });

    test('should maintain performance with large metric queries', async () => {
      // Record many data points for a single metric
      for (let i = 0; i < 1000; i++) {
        metricsCollector.recordMetric('performance.test', Math.random() * 100, 'gauge');
      }

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/performance/metrics/performance.test')
        .expect(200);

      const queryTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.series.totalDataPoints).toBe(1000);
      expect(response.body.data.recentValues).toHaveLength(100); // Should return last 100
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
