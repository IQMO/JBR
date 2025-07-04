/**
 * Exchange Monitoring Integration Tests
 * 
 * Tests the ExchangeMonitorService integration with the performance monitoring system,
 * API endpoints, and real-time monitoring capabilities.
 */

import express from 'express';

import performanceRoutes, { shutdownPerformanceServices } from '../../src/routes/performance.routes';
import ExchangeMonitorService from '../../src/services/exchange-monitor.service';

describe('Exchange Monitoring Integration', () => {
  let app: express.Application;
  let exchangeMonitor: ExchangeMonitorService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/performance', performanceRoutes);
    
    exchangeMonitor = new ExchangeMonitorService();
  });

  afterEach(async () => {
    exchangeMonitor.shutdown();
    // Give time for cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    // Stop metrics collector to prevent open handles
    shutdownPerformanceServices();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('ExchangeMonitorService Lifecycle', () => {
    it('should initialize and start monitoring for an exchange', () => {
      const exchangeName = 'bybit';
      
      exchangeMonitor.startMonitoring(exchangeName);
      
      const metrics = exchangeMonitor.getExchangeMetrics(exchangeName);
      expect(metrics).toBeDefined();
      expect(metrics?.exchange).toBe(exchangeName);
      expect(metrics?.connectivity.status).toBe('disconnected'); // Initial state
      expect(metrics?.health.status).toBe('healthy'); // Initial state
    });

    it('should track multiple exchanges simultaneously', () => {
      const exchanges = ['bybit', 'binance', 'okx'];
      
      exchanges.forEach(exchange => {
        exchangeMonitor.startMonitoring(exchange);
      });
      
      const allMetrics = exchangeMonitor.getAllMetrics();
      expect(allMetrics.size).toBe(exchanges.length);
      
      exchanges.forEach(exchange => {
        expect(allMetrics.has(exchange)).toBe(true);
        const metrics = allMetrics.get(exchange);
        expect(metrics?.exchange).toBe(exchange);
      });
    });

    it('should stop monitoring and clean up resources', () => {
      const exchangeName = 'binance';
      
      exchangeMonitor.startMonitoring(exchangeName);
      expect(exchangeMonitor.getExchangeMetrics(exchangeName)).toBeDefined();
      
      exchangeMonitor.stopMonitoring(exchangeName);
      expect(exchangeMonitor.getExchangeMetrics(exchangeName)).toBeNull();
    });

    it('should handle duplicate start monitoring requests gracefully', () => {
      const exchangeName = 'okx';
      
      exchangeMonitor.startMonitoring(exchangeName);
      exchangeMonitor.startMonitoring(exchangeName); // Duplicate
      
      const allMetrics = exchangeMonitor.getAllMetrics();
      expect(allMetrics.size).toBe(1);
      expect(allMetrics.has(exchangeName)).toBe(true);
    });
  });

  describe('API Request Tracking', () => {
    beforeEach(() => {
      exchangeMonitor.startMonitoring('bybit');
    });

    it('should record successful API requests', () => {
      const requestDetails = {
        endpoint: '/api/v5/market/ticker',
        method: 'GET',
        duration: 150,
        success: true,
        statusCode: 200,
        rateLimitRemaining: 950
      };

      exchangeMonitor.recordApiRequest(
        'bybit',
        requestDetails.endpoint,
        requestDetails.method,
        requestDetails.duration,
        requestDetails.success,
        undefined,
        requestDetails.statusCode,
        requestDetails.rateLimitRemaining
      );

      const history = exchangeMonitor.getApiRequestHistory('bybit', 10);
      expect(history).toHaveLength(1);
      
      const request = history[0];
      expect(request.endpoint).toBe(requestDetails.endpoint);
      expect(request.method).toBe(requestDetails.method);
      expect(request.duration).toBe(requestDetails.duration);
      expect(request.success).toBe(true);
      expect(request.statusCode).toBe(requestDetails.statusCode);
      expect(request.rateLimitRemaining).toBe(requestDetails.rateLimitRemaining);
    });

    it('should record failed API requests with error details', () => {
      const requestDetails = {
        endpoint: '/api/v5/trade/order',
        method: 'POST',
        duration: 2500,
        success: false,
        error: 'Rate limit exceeded',
        statusCode: 429
      };

      exchangeMonitor.recordApiRequest(
        'bybit',
        requestDetails.endpoint,
        requestDetails.method,
        requestDetails.duration,
        requestDetails.success,
        requestDetails.error,
        requestDetails.statusCode
      );

      const history = exchangeMonitor.getApiRequestHistory('bybit', 10);
      expect(history).toHaveLength(1);
      
      const request = history[0];
      expect(request.success).toBe(false);
      expect(request.error).toBe(requestDetails.error);
      expect(request.statusCode).toBe(requestDetails.statusCode);
    });

    it('should update API metrics based on requests', () => {
      // Record multiple successful requests
      for (let i = 0; i < 5; i++) {
        exchangeMonitor.recordApiRequest(
          'bybit',
          '/api/v5/market/ticker',
          'GET',
          100 + i * 20,
          true,
          undefined,
          200,
          900 - i * 10
        );
      }

      // Record some failed requests
      for (let i = 0; i < 2; i++) {
        exchangeMonitor.recordApiRequest(
          'bybit',
          '/api/v5/trade/order',
          'POST',
          500,
          false,
          'Invalid order',
          400
        );
      }

      const metrics = exchangeMonitor.getExchangeMetrics('bybit');
      expect(metrics).toBeDefined();
      
      if (metrics) {
        expect(metrics.api.requestCount).toBe(7);
        expect(metrics.api.successRate).toBeCloseTo(71.43, 1); // 5/7 ≈ 71.43%
        expect(metrics.api.errorRate).toBeCloseTo(28.57, 1); // 2/7 ≈ 28.57%
        expect(metrics.api.averageResponseTime).toBeGreaterThan(0);
      }
    });
  });

  describe('Order Execution Tracking', () => {
    beforeEach(() => {
      exchangeMonitor.startMonitoring('binance');
    });

    it('should record filled orders with slippage calculation', () => {
      const orderDetails = {
        orderId: 'order_123',
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.1,
        price: 45000,
        executedPrice: 45050,
        executedQuantity: 0.1,
        executionTime: 250
      };

      exchangeMonitor.recordOrderExecution(
        'binance',
        orderDetails.orderId,
        orderDetails.symbol,
        orderDetails.side,
        orderDetails.type,
        orderDetails.quantity,
        orderDetails.price,
        orderDetails.executedPrice,
        orderDetails.executedQuantity,
        orderDetails.executionTime,
        'filled'
      );

      const history = exchangeMonitor.getOrderHistory('binance', 10);
      expect(history).toHaveLength(1);
      
      const order = history[0];
      expect(order.orderId).toBe(orderDetails.orderId);
      expect(order.symbol).toBe(orderDetails.symbol);
      expect(order.status).toBe('filled');
      expect(order.slippage).toBeCloseTo(0.11, 2); // (45050-45000)/45000 * 100 ≈ 0.11%
    });

    it('should record failed orders without slippage', () => {
      exchangeMonitor.recordOrderExecution(
        'binance',
        'order_456',
        'ETHUSDT',
        'sell',
        'limit',
        1.0,
        3000,
        undefined,
        undefined,
        100,
        'failed'
      );

      const history = exchangeMonitor.getOrderHistory('binance', 10);
      expect(history).toHaveLength(1);
      
      const order = history[0];
      expect(order.status).toBe('failed');
      expect(order.slippage).toBeUndefined();
      expect(order.executedPrice).toBeUndefined();
      expect(order.executedQuantity).toBeUndefined();
    });

    it('should update trading metrics based on order executions', () => {
      // Record filled orders
      for (let i = 0; i < 8; i++) {
        exchangeMonitor.recordOrderExecution(
          'binance',
          `order_filled_${i}`,
          'BTCUSDT',
          'buy',
          'market',
          0.1,
          45000,
          45000 + i * 10,
          0.1,
          200 + i * 10,
          'filled'
        );
      }

      // Record failed orders
      for (let i = 0; i < 2; i++) {
        exchangeMonitor.recordOrderExecution(
          'binance',
          `order_failed_${i}`,
          'ETHUSDT',
          'sell',
          'limit',
          1.0,
          3000,
          undefined,
          undefined,
          150,
          'failed'
        );
      }

      const metrics = exchangeMonitor.getExchangeMetrics('binance');
      expect(metrics).toBeDefined();
      
      if (metrics) {
        expect(metrics.trading.completedOrders).toBe(8);
        expect(metrics.trading.failedOrders).toBe(2);
        expect(metrics.trading.orderFillRate).toBe(80); // 8/10 = 80%
        expect(metrics.trading.averageExecutionTime).toBeGreaterThan(0);
        expect(metrics.trading.slippage.count).toBe(8);
        expect(metrics.trading.slippage.average).toBeGreaterThan(0);
      }
    });
  });

  describe('WebSocket Status Tracking', () => {
    beforeEach(() => {
      exchangeMonitor.startMonitoring('okx');
    });

    it('should update WebSocket connection status', () => {
      exchangeMonitor.updateWebSocketStatus('okx', 'connected', 50);
      
      const metrics = exchangeMonitor.getExchangeMetrics('okx');
      expect(metrics?.websocket.status).toBe('connected');
      expect(metrics?.websocket.latency).toBe(50);
      expect(metrics?.websocket.lastMessage).toBeDefined();
    });

    it('should track WebSocket reconnections', () => {
      exchangeMonitor.updateWebSocketStatus('okx', 'reconnecting');
      exchangeMonitor.updateWebSocketStatus('okx', 'connected', 75);
      
      const metrics = exchangeMonitor.getExchangeMetrics('okx');
      expect(metrics?.websocket.status).toBe('connected');
      expect(metrics?.websocket.reconnectCount).toBe(1);
    });

    it('should record WebSocket messages', () => {
      exchangeMonitor.recordWebSocketMessage('okx');
      exchangeMonitor.recordWebSocketMessage('okx');
      exchangeMonitor.recordWebSocketMessage('okx');
      
      const metrics = exchangeMonitor.getExchangeMetrics('okx');
      expect(metrics?.websocket.messagesReceived).toBe(3);
      expect(metrics?.websocket.lastMessage).toBeDefined();
    });
  });

  describe('Health Assessment', () => {
    beforeEach(() => {
      exchangeMonitor.startMonitoring('coinbase');
    });

    it('should provide health summary for monitored exchange', () => {
      const health = exchangeMonitor.getHealthSummary('coinbase');
      
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy'); // Initial state
      expect(health.score).toBe(100); // Initial score
      expect(Array.isArray(health.issues)).toBe(true);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return error for non-monitored exchange', () => {
      const health = exchangeMonitor.getHealthSummary('non_existent');
      
      expect(health.status).toBe('critical');
      expect(health.score).toBe(0);
      expect(health.issues).toContain('Exchange not monitored');
    });
  });

  describe('Data Export and Analytics', () => {
    beforeEach(() => {
      exchangeMonitor.startMonitoring('kraken');
      
      // Add some test data
      exchangeMonitor.recordApiRequest('kraken', '/api/ticker', 'GET', 100, true, undefined, 200);
      exchangeMonitor.recordOrderExecution('kraken', 'order_1', 'BTCUSD', 'buy', 'market', 1.0, 40000, 40010, 1.0, 200, 'filled');
    });

    it('should export comprehensive metrics data', () => {
      const exportData = exchangeMonitor.exportMetrics();
      
      expect(exportData).toBeDefined();
      expect(exportData.exchanges).toBeDefined();
      expect(exportData.apiRequests).toBeDefined();
      expect(exportData.orders).toBeDefined();
      expect(exportData.summary).toBeDefined();
      
      expect(exportData.summary.totalExchanges).toBe(1);
      expect(exportData.summary.healthyExchanges).toBe(1);
      expect(exportData.summary.totalApiRequests).toBe(1);
      expect(exportData.summary.totalOrders).toBe(1);
    });

    it('should track metrics across multiple exchanges', () => {
      exchangeMonitor.startMonitoring('binance');
      exchangeMonitor.recordApiRequest('binance', '/api/trades', 'GET', 150, true);
      
      const exportData = exchangeMonitor.exportMetrics();
      expect(exportData.summary.totalExchanges).toBe(2);
      expect(exportData.summary.totalApiRequests).toBe(2);
    });
  });

  describe('Performance API Integration', () => {
    let testExchangeMonitor: ExchangeMonitorService;
    
    beforeEach(() => {
      // Mock exchange monitor with some test data
      testExchangeMonitor = new ExchangeMonitorService();
      testExchangeMonitor.startMonitoring('test_exchange');
      
      // Add test API requests
      testExchangeMonitor.recordApiRequest('test_exchange', '/api/test', 'GET', 100, true, undefined, 200, 950);
      testExchangeMonitor.recordApiRequest('test_exchange', '/api/test2', 'POST', 200, false, 'Test error', 500);
      
      // Add test orders
      testExchangeMonitor.recordOrderExecution('test_exchange', 'test_order_1', 'BTCUSD', 'buy', 'market', 1.0, 40000, 40010, 1.0, 150, 'filled');
    });
    
    afterEach(async () => {
      if (testExchangeMonitor) {
        await testExchangeMonitor.shutdown();
      }
    });

    it('should be ready for API endpoint integration', () => {
      // This test verifies that the performance routes are properly set up
      // for integration with the exchange monitoring system
      expect(performanceRoutes).toBeDefined();
      expect(app).toBeDefined();
    });

    it('should support exchange monitoring service integration', () => {
      // Verify that the exchange monitor service can be properly integrated
      // with the Express application and performance routes
      const monitor = new ExchangeMonitorService();
      monitor.startMonitoring('integration_test');
      
      expect(monitor.getExchangeMetrics('integration_test')).toBeDefined();
      
      monitor.shutdown();
    });
  });

  describe('Integration with WebSocket Broadcasting', () => {
    it('should initialize with WebSocket server for broadcasting', () => {
      const mockWebSocketServer = {
        broadcast: jest.fn()
      };
      
      const monitorWithWS = new ExchangeMonitorService({}, mockWebSocketServer as any);
      expect(monitorWithWS).toBeDefined();
      
      monitorWithWS.shutdown();
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      exchangeMonitor.startMonitoring('test_events');
    });

    it('should emit events for monitoring lifecycle', (done) => {
      let eventCount = 0;
      
      exchangeMonitor.on('monitoringStarted', (exchangeName) => {
        expect(exchangeName).toBe('event_test');
        eventCount++;
        if (eventCount === 1) {done();}
      });
      
      exchangeMonitor.startMonitoring('event_test');
    });

    it('should emit events for API requests', (done) => {
      exchangeMonitor.on('apiRequest', (exchangeName, request) => {
        expect(exchangeName).toBe('test_events');
        expect(request).toBeDefined();
        expect(request.endpoint).toBe('/test/endpoint');
        done();
      });
      
      exchangeMonitor.recordApiRequest('test_events', '/test/endpoint', 'GET', 100, true);
    });

    it('should emit events for order executions', (done) => {
      exchangeMonitor.on('orderExecution', (exchangeName, order) => {
        expect(exchangeName).toBe('test_events');
        expect(order).toBeDefined();
        expect(order.orderId).toBe('test_order');
        done();
      });
      
      exchangeMonitor.recordOrderExecution('test_events', 'test_order', 'BTCUSD', 'buy', 'market', 1.0, 40000, 40010, 1.0, 200, 'filled');
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should initialize with custom configuration', () => {
      const customConfig = {
        pingInterval: 60000,
        healthCheckInterval: 120000,
        thresholds: {
          slowRequestMs: 10000,
          highErrorRate: 20,
          criticalPing: 5000,
          rateLimitWarning: 80,
          rateLimitCritical: 95
        }
      };
      
      const customMonitor = new ExchangeMonitorService(customConfig);
      expect(customMonitor).toBeDefined();
      
      customMonitor.shutdown();
    });

    it('should use default configuration when none provided', () => {
      const defaultMonitor = new ExchangeMonitorService();
      expect(defaultMonitor).toBeDefined();
      
      defaultMonitor.shutdown();
    });
  });
});
