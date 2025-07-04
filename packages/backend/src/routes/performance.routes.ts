/**
 * Performance Monitoring API Routes
 * 
 * Provides endpoints for accessing application performance metrics,
 * monitoring data, and system statistics for the trading platform.
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import { appMonitoringMiddleware } from '../middleware/app-monitoring.middleware';
import ApplicationMonitorService from '../services/application-monitor.service';
import DatabaseMonitorService from '../services/database-monitor.service';
import ExchangeMonitorService from '../services/exchange-monitor.service';
import logger from '../services/logging.service';
import MetricsCollectorService from '../services/metrics-collector.service';

const router = Router();
// Use singleton instances instead of creating new ones
const applicationMonitor = ApplicationMonitorService.getInstance();
const databaseMonitor = new DatabaseMonitorService();
const exchangeMonitor = new ExchangeMonitorService();
const metricsCollector = new MetricsCollectorService();

// Start the metrics collector
metricsCollector.start();

// Export the metrics collector instance for testing
export { metricsCollector };

// Global cleanup function for tests
export const shutdownPerformanceServices = () => {
  try {
    metricsCollector.stop();
    databaseMonitor.shutdown?.();
    exchangeMonitor.shutdown();
  } catch (error) {
    logger.error('Error during performance services shutdown:', error);
  }
};

/**
 * @route GET /performance
 * @desc Get overall application performance metrics
 * @access Public
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = applicationMonitor.getCurrentMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        ...metrics,
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: '/performance'
        }
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get performance metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve performance metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance'
      }
    });
  }
});

/**
 * @route GET /performance/endpoints
 * @desc Get detailed endpoint performance metrics
 * @access Public
 */
router.get('/endpoints', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = applicationMonitor.getCurrentMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        endpoints: metrics.endpoints,
        summary: {
          totalEndpoints: Object.keys(metrics.endpoints).length,
          avgResponseTime: metrics.performance.responseTime.average,
          totalRequests: Object.values(metrics.endpoints).reduce((sum, endpoint) => sum + endpoint.count, 0),
          totalErrors: Object.values(metrics.endpoints).reduce((sum, endpoint) => sum + endpoint.errorCount, 0)
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/endpoints'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get endpoint metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve endpoint metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/endpoints'
      }
    });
  }
});

/**
 * @route GET /performance/errors
 * @desc Get error metrics and recent errors
 * @access Public
 */
router.get('/errors', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = applicationMonitor.getCurrentMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        errors: metrics.errors,
        errorRate: metrics.performance.errorRate,
        summary: {
          totalErrors: metrics.errors.total,
          errorTypes: Object.keys(metrics.errors.byType).length,
          mostCommonError: Object.entries(metrics.errors.byType)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/errors'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get error metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve error metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/errors'
      }
    });
  }
});

/**
 * @route GET /performance/database
 * @desc Get comprehensive database performance metrics
 * @access Public
 */
router.get('/database', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Get comprehensive database metrics from DatabaseMonitorService
    const dbMetrics = await databaseMonitor.getCurrentMetrics();
    const dbHealth = await databaseMonitor.getHealthSummary();
    const slowQueries = databaseMonitor.getSlowQueries(5);
    
    // Also get basic metrics from ApplicationMonitorService for compatibility
    const appMetrics = applicationMonitor.getCurrentMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        // Comprehensive database metrics
        comprehensive: dbMetrics,
        
        // Health assessment
        health: dbHealth,
        
        // Recent slow queries
        slowQueries,
        
        // Legacy compatibility metrics
        database: appMetrics.database,
        
        // Summary statistics
        summary: {
          status: dbHealth.status,
          totalQueries: dbMetrics.queries.totalExecuted,
          averageQueryTime: dbMetrics.queries.averageTime,
          connectionUtilization: dbMetrics.connections.utilizationPercentage,
          slowQueriesCount: dbMetrics.queries.slowQueries,
          failedQueriesCount: dbMetrics.queries.failedQueries,
          transactionsPerSecond: dbMetrics.performance.transactionsPerSecond,
          cacheHitRatio: dbMetrics.performance.cacheHitRatio
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/database',
        dataSource: 'DatabaseMonitorService'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get database metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve database metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/database'
      }
    });
  }
});

/**
 * @route GET /performance/database/queries
 * @desc Get database query history and analysis
 * @access Public
 */
router.get('/database/queries', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const queryHistory = databaseMonitor.getQueryHistory(limit);
    const slowQueries = databaseMonitor.getSlowQueries(10);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        recentQueries: queryHistory,
        slowQueries,
        analysis: {
          totalQueries: queryHistory.length,
          slowQueryCount: slowQueries.length,
          averageQueryTime: queryHistory.reduce((sum, q) => sum + q.duration, 0) / queryHistory.length || 0,
          queryTypes: {
            select: queryHistory.filter(q => q.operation === 'SELECT').length,
            insert: queryHistory.filter(q => q.operation === 'INSERT').length,
            update: queryHistory.filter(q => q.operation === 'UPDATE').length,
            delete: queryHistory.filter(q => q.operation === 'DELETE').length,
            other: queryHistory.filter(q => q.operation === 'OTHER').length
          }
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/database/queries',
        limit
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get database query metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve database query metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/database/queries'
      }
    });
  }
});

/**
 * @route GET /performance/database/tables
 * @desc Get database table access patterns and statistics
 * @access Public
 */
router.get('/database/tables', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const tablePatterns = databaseMonitor.getTableAccessPatterns();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        tableAccessPatterns: tablePatterns,
        summary: {
          totalTables: tablePatterns.length,
          mostAccessedTable: tablePatterns[0]?.tableName || 'None',
          totalAccesses: tablePatterns.reduce((sum, t) => sum + t.accessCount, 0),
          averageAccessTime: tablePatterns.reduce((sum, t) => sum + t.averageTime, 0) / tablePatterns.length || 0
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/database/tables'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get database table metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve database table metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/database/tables'
      }
    });
  }
});

/**
 * @route GET /performance/exchanges
 * @desc Get comprehensive exchange monitoring metrics for all monitored exchanges
 * @access Public
 */
router.get('/exchanges', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const allMetrics = exchangeMonitor.getAllMetrics();
    const exportData = exchangeMonitor.exportMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        exchanges: Object.fromEntries(allMetrics),
        summary: exportData.summary,
        healthOverview: {
          totalExchanges: exportData.summary.totalExchanges,
          healthyExchanges: exportData.summary.healthyExchanges,
          warningExchanges: Array.from(allMetrics.values()).filter(m => m.health.status === 'warning').length,
          criticalExchanges: Array.from(allMetrics.values()).filter(m => m.health.status === 'critical').length,
          averageHealthScore: Array.from(allMetrics.values()).reduce((sum, m) => sum + m.health.score, 0) / allMetrics.size || 0,
          totalApiRequests: exportData.summary.totalApiRequests,
          totalOrders: exportData.summary.totalOrders
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/exchanges',
        dataSource: 'ExchangeMonitorService'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get exchange metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve exchange metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/exchanges'
      }
    });
  }
});

/**
 * @route GET /performance/exchanges/:exchangeName
 * @desc Get detailed metrics for a specific exchange
 * @access Public
 */
router.get('/exchanges/:exchangeName', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const { exchangeName } = req.params;
  
  if (!exchangeName) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Exchange name is required'
      },
      meta: {
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/exchanges/:exchangeName'
      }
    });
  }
  
  try {
    const metrics = exchangeMonitor.getExchangeMetrics(exchangeName);
    const healthSummary = exchangeMonitor.getHealthSummary(exchangeName);
    const apiHistory = exchangeMonitor.getApiRequestHistory(exchangeName, 100);
    const orderHistory = exchangeMonitor.getOrderHistory(exchangeName, 50);
    const responseTime = Date.now() - startTime;

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Exchange '${exchangeName}' not found or not monitored`,
          details: 'Exchange may not be initialized or monitoring may not be started'
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: `/performance/exchanges/${exchangeName}`
        }
      });
    }

    return res.json({
      success: true,
      data: {
        exchange: exchangeName,
        metrics,
        health: healthSummary,
        recentApiRequests: apiHistory.slice(0, 10), // Last 10 requests
        recentOrders: orderHistory.slice(0, 10), // Last 10 orders
        analysis: {
          connectivityStatus: metrics.connectivity.status,
          apiPerformance: {
            requestsPerSecond: metrics.api.requestsPerSecond,
            averageResponseTime: metrics.api.averageResponseTime,
            errorRate: metrics.api.errorRate,
            successRate: metrics.api.successRate
          },
          rateLimitStatus: {
            utilizationPercentage: metrics.rateLimits.utilizationPercentage,
            violations: metrics.rateLimits.violations,
            status: metrics.rateLimits.utilizationPercentage > 95 ? 'critical' :
                   metrics.rateLimits.utilizationPercentage > 80 ? 'warning' : 'healthy'
          },
          tradingPerformance: {
            orderFillRate: metrics.trading.orderFillRate,
            averageExecutionTime: metrics.trading.averageExecutionTime,
            averageSlippage: metrics.trading.slippage.average
          },
          websocketStatus: {
            status: metrics.websocket.status,
            latency: metrics.websocket.latency,
            messagesReceived: metrics.websocket.messagesReceived,
            reconnectCount: metrics.websocket.reconnectCount
          }
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}`,
        dataSource: 'ExchangeMonitorService'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to get metrics for exchange ${exchangeName}`, error);

    return res.status(500).json({
      success: false,
      error: {
        message: `Failed to retrieve metrics for exchange '${exchangeName}'`,
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}`
      }
    });
  }
});

/**
 * @route GET /performance/exchanges/:exchangeName/api
 * @desc Get API request history and analysis for a specific exchange
 * @access Public
 */
router.get('/exchanges/:exchangeName/api', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const { exchangeName } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  
  if (!exchangeName) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Exchange name is required'
      },
      meta: {
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/exchanges/:exchangeName/api'
      }
    });
  }
  
  try {
    const apiHistory = exchangeMonitor.getApiRequestHistory(exchangeName, limit);
    const metrics = exchangeMonitor.getExchangeMetrics(exchangeName);
    const responseTime = Date.now() - startTime;

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Exchange '${exchangeName}' not found or not monitored`
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: `/performance/exchanges/${exchangeName}/api`
        }
      });
    }

    // API request analysis
    const successfulRequests = apiHistory.filter(req => req.success);
    const failedRequests = apiHistory.filter(req => !req.success);
    const slowRequests = apiHistory.filter(req => req.duration && req.duration > 5000);
    
    const endpointStats = apiHistory.reduce((stats, req) => {
      if (!stats[req.endpoint]) {
        stats[req.endpoint] = { count: 0, avgDuration: 0, errors: 0 };
      }
      stats[req.endpoint].count++;
      stats[req.endpoint].avgDuration = (stats[req.endpoint].avgDuration * (stats[req.endpoint].count - 1) + (req.duration || 0)) / stats[req.endpoint].count;
      if (!req.success) {stats[req.endpoint].errors++;}
      return stats;
    }, {} as Record<string, any>);

    return res.json({
      success: true,
      data: {
        exchange: exchangeName,
        apiRequests: apiHistory,
        analysis: {
          total: apiHistory.length,
          successful: successfulRequests.length,
          failed: failedRequests.length,
          slow: slowRequests.length,
          successRate: (successfulRequests.length / apiHistory.length) * 100 || 0,
          averageResponseTime: apiHistory.reduce((sum, req) => sum + (req.duration || 0), 0) / apiHistory.length || 0,
          endpointStats,
          recentErrors: failedRequests.slice(0, 5).map(req => ({
            endpoint: req.endpoint,
            error: req.error,
            statusCode: req.statusCode,
            timestamp: req.startTime
          }))
        },
        currentMetrics: {
          requestsPerSecond: metrics.api.requestsPerSecond,
          averageResponseTime: metrics.api.averageResponseTime,
          errorRate: metrics.api.errorRate,
          rateLimitUtilization: metrics.rateLimits.utilizationPercentage
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}/api`,
        limit
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to get API metrics for exchange ${exchangeName}`, error);

    return res.status(500).json({
      success: false,
      error: {
        message: `Failed to retrieve API metrics for exchange '${exchangeName}'`,
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}/api`
      }
    });
  }
});

/**
 * @route GET /performance/exchanges/:exchangeName/orders
 * @desc Get order execution history and trading performance for a specific exchange
 * @access Public
 */
router.get('/exchanges/:exchangeName/orders', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const { exchangeName } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  if (!exchangeName) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Exchange name is required'
      },
      meta: {
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/exchanges/:exchangeName/orders'
      }
    });
  }
  
  try {
    const orderHistory = exchangeMonitor.getOrderHistory(exchangeName, limit);
    const metrics = exchangeMonitor.getExchangeMetrics(exchangeName);
    const responseTime = Date.now() - startTime;

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Exchange '${exchangeName}' not found or not monitored`
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: `/performance/exchanges/${exchangeName}/orders`
        }
      });
    }

    // Order analysis
    const filledOrders = orderHistory.filter(order => order.status === 'filled');
    const failedOrders = orderHistory.filter(order => order.status === 'failed');
    const partialOrders = orderHistory.filter(order => order.status === 'partial');
    
    const symbolStats = orderHistory.reduce((stats, order) => {
      if (!stats[order.symbol]) {
        stats[order.symbol] = { count: 0, avgExecutionTime: 0, avgSlippage: 0, filled: 0 };
      }
      stats[order.symbol].count++;
      stats[order.symbol].avgExecutionTime = (stats[order.symbol].avgExecutionTime * (stats[order.symbol].count - 1) + order.executionTime) / stats[order.symbol].count;
      if (order.slippage !== undefined) {
        stats[order.symbol].avgSlippage = (stats[order.symbol].avgSlippage * (stats[order.symbol].count - 1) + order.slippage) / stats[order.symbol].count;
      }
      if (order.status === 'filled') {stats[order.symbol].filled++;}
      return stats;
    }, {} as Record<string, any>);

    return res.json({
      success: true,
      data: {
        exchange: exchangeName,
        orders: orderHistory,
        analysis: {
          total: orderHistory.length,
          filled: filledOrders.length,
          failed: failedOrders.length,
          partial: partialOrders.length,
          fillRate: (filledOrders.length / orderHistory.length) * 100 || 0,
          averageExecutionTime: orderHistory.reduce((sum, order) => sum + order.executionTime, 0) / orderHistory.length || 0,
          averageSlippage: orderHistory.filter(o => o.slippage !== undefined).reduce((sum, order) => sum + (order.slippage || 0), 0) / orderHistory.filter(o => o.slippage !== undefined).length || 0,
          symbolStats,
          recentFailures: failedOrders.slice(0, 5).map(order => ({
            orderId: order.orderId,
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            timestamp: order.timestamp
          }))
        },
        currentMetrics: {
          activeOrders: metrics.trading.activeOrders,
          completedOrders: metrics.trading.completedOrders,
          failedOrders: metrics.trading.failedOrders,
          orderFillRate: metrics.trading.orderFillRate,
          averageExecutionTime: metrics.trading.averageExecutionTime,
          slippage: metrics.trading.slippage
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}/orders`,
        limit
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to get order metrics for exchange ${exchangeName}`, error);

    return res.status(500).json({
      success: false,
      error: {
        message: `Failed to retrieve order metrics for exchange '${exchangeName}'`,
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}/orders`
      }
    });
  }
});

/**
 * @route GET /performance/exchanges/:exchangeName/health
 * @desc Get health assessment for a specific exchange
 * @access Public
 */
router.get('/exchanges/:exchangeName/health', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const { exchangeName } = req.params;
  
  if (!exchangeName) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Exchange name is required'
      },
      meta: {
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/exchanges/:exchangeName/health'
      }
    });
  }
  
  try {
    const healthSummary = exchangeMonitor.getHealthSummary(exchangeName);
    const metrics = exchangeMonitor.getExchangeMetrics(exchangeName);
    const responseTime = Date.now() - startTime;

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Exchange '${exchangeName}' not found or not monitored`
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: `/performance/exchanges/${exchangeName}/health`
        }
      });
    }

    return res.json({
      success: true,
      data: {
        exchange: exchangeName,
        health: healthSummary,
        detailedHealth: metrics.health,
        connectivity: {
          status: metrics.connectivity.status,
          uptime: metrics.connectivity.uptime,
          ping: metrics.connectivity.ping,
          failedConnections: metrics.connectivity.failedConnections
        },
        apiHealth: {
          errorRate: metrics.api.errorRate,
          averageResponseTime: metrics.api.averageResponseTime,
          slowRequests: metrics.api.slowRequests,
          timeouts: metrics.api.timeouts
        },
        rateLimitHealth: {
          utilizationPercentage: metrics.rateLimits.utilizationPercentage,
          violations: metrics.rateLimits.violations,
          status: metrics.rateLimits.utilizationPercentage > 95 ? 'critical' :
                 metrics.rateLimits.utilizationPercentage > 80 ? 'warning' : 'healthy'
        },
        websocketHealth: {
          status: metrics.websocket.status,
          latency: metrics.websocket.latency,
          reconnectCount: metrics.websocket.reconnectCount,
          lastMessage: metrics.websocket.lastMessage
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}/health`
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to get health metrics for exchange ${exchangeName}`, error);

    return res.status(500).json({
      success: false,
      error: {
        message: `Failed to retrieve health metrics for exchange '${exchangeName}'`,
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/exchanges/${exchangeName}/health`
      }
    });
  }
});

/**
 * @route GET /performance/websocket
 * @desc Get WebSocket performance metrics
 * @access Public
 */
router.get('/websocket', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = applicationMonitor.getCurrentMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        connections: metrics.websocket.activeConnections,
        messagesPerSecond: metrics.websocket.messagesPerSecond,
        totalMessages: metrics.websocket.totalMessages,
        disconnections: metrics.websocket.disconnections,
        websocket: metrics.websocket,
        health: {
          status: metrics.websocket.disconnections < 10 ? 'healthy' : 
                  metrics.websocket.disconnections < 50 ? 'degraded' : 'unhealthy',
          disconnectionRate: metrics.websocket.totalMessages > 0 ? 
            (metrics.websocket.disconnections / metrics.websocket.totalMessages) * 100 : 0
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/websocket'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get WebSocket metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve WebSocket metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/websocket'
      }
    });
  }
});

/**
 * @route GET /performance/health
 * @desc Get system health summary
 * @access Public
 */
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = applicationMonitor.getCurrentMetrics();
    const stats = applicationMonitor.getStats();
    const responseTime = Date.now() - startTime;

    // Calculate overall health status
    const errorRate = metrics.performance.errorRate;
    const responseTimeAvg = metrics.performance.responseTime.average;
    const uptime = metrics.performance.uptime;
    
    let status = 'healthy';
    if (errorRate > 10 || responseTimeAvg > 2000) {
      status = 'critical';
    } else if (errorRate > 5 || responseTimeAvg > 1000) {
      status = 'warning';
    }

    res.json({
      success: true,
      data: {
        status,
        uptime: uptime,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        monitoring: {
          isRunning: stats.isRunning,
          requestsLogged: stats.requestsLogged,
          errorsLogged: stats.errorsLogged,
          endpointsTracked: stats.endpointsTracked
        },
        performance: {
          errorRate: errorRate,
          averageResponseTime: responseTimeAvg,
          throughput: metrics.performance.throughput.requestsPerSecond
        },
        database: {
          queryCount: metrics.database.queryCount,
          averageQueryTime: metrics.database.averageQueryTime,
          slowQueries: metrics.database.slowQueries,
          activeConnections: metrics.database.activeConnections
        },
        websocket: {
          activeConnections: metrics.websocket.activeConnections,
          totalMessages: metrics.websocket.totalMessages,
          disconnections: metrics.websocket.disconnections
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/health'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get health summary', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve health summary',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/health'
      }
    });
  }
});

/**
 * @route GET /performance/websockets
 * @desc Get WebSocket performance metrics (alias)
 * @access Public
 */
router.get('/websockets', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = applicationMonitor.getCurrentMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        websocket: metrics.websocket,
        health: {
          status: metrics.websocket.disconnections < 10 ? 'healthy' : 
                  metrics.websocket.disconnections < 50 ? 'degraded' : 'unhealthy',
          disconnectionRate: metrics.websocket.totalMessages > 0 ? 
            (metrics.websocket.disconnections / metrics.websocket.totalMessages) * 100 : 0
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/websockets'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get WebSocket metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve WebSocket metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/websockets'
      }
    });
  }
});

/**
 * @route GET /performance/stats
 * @desc Get monitoring service statistics
 * @access Public
 */
router.get('/stats', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const stats = applicationMonitor.getStats();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        stats,
        uptime: stats.uptime,
        isRunning: stats.isRunning
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/stats'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get monitoring stats', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve monitoring statistics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/stats'
      }
    });
  }
});

/**
 * @route POST /performance/reset
 * @desc Reset performance metrics (admin only)
 * @access Private
 */
router.post('/reset', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    applicationMonitor.reset();
    const responseTime = Date.now() - startTime;

    logger.info('Performance metrics reset');

    res.json({
      success: true,
      data: {
        message: 'Performance metrics reset successfully'
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/reset'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to reset performance metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reset performance metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/reset'
      }
    });
  }
});

/**
 * @route GET /performance/metrics
 * @desc Get centralized metrics overview and summary
 * @access Public
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const summary = metricsCollector.getMetricsSummary();
    const metricNames = metricsCollector.getMetricNames();
    const aggregatedMetrics = metricsCollector.getAggregatedMetrics();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        summary,
        metricNames,
        aggregated: aggregatedMetrics,
        overview: {
          totalMetricsCollected: summary.totalMetrics,
          totalDataPoints: summary.totalDataPoints,
          dataRetentionPeriod: '24 hours',
          collectionStatus: 'active',
          oldestData: summary.oldestDataPoint,
          newestData: summary.newestDataPoint,
          memoryUsage: `${(summary.memoryUsage / 1024 / 1024).toFixed(2)} MB`
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics',
        dataSource: 'MetricsCollectorService'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get centralized metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve centralized metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics'
      }
    });
  }
});

/**
 * @route POST /performance/metrics/query
 * @desc Query specific metrics with filters and aggregation
 * @access Public
 */
router.post('/metrics/query', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const {
      metric,
      startTime: queryStartTime,
      endTime: queryEndTime,
      labels,
      aggregation,
      groupBy,
      interval
    } = req.body;

    if (!metric) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Metric name is required',
          details: 'Please provide a metric name to query'
        },
        meta: {
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          endpoint: '/performance/metrics/query'
        }
      });
    }

    const query = {
      metric,
      startTime: queryStartTime ? new Date(queryStartTime) : undefined,
      endTime: queryEndTime ? new Date(queryEndTime) : undefined,
      labels,
      aggregation,
      groupBy,
      interval
    };

    const result = metricsCollector.queryMetrics(query);
    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        query,
        result,
        analysis: {
          dataPoints: result.values.length,
          timeRange: result.values.length > 0 ? {
            start: result.values[0]?.timestamp,
            end: result.values[result.values.length - 1]?.timestamp
          } : null,
          aggregationApplied: result.aggregation || 'none',
          intervalGrouping: result.interval || 'none'
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/query'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to query metrics', error);

    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to query metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/query'
      }
    });
  }
});

/**
 * @route GET /performance/metrics/:metricName
 * @desc Get specific metric data and history
 * @access Public
 */
router.get('/metrics/:metricName', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  const { metricName } = req.params;
  
  if (!metricName || !metricName.trim()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Metric name is required'
      },
      meta: {
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/:metricName'
      }
    });
  }
  
  try {
    const series = metricsCollector.getMetricSeries(metricName);
    const latestValue = metricsCollector.getLatestValue(metricName);
    const responseTime = Date.now() - startTime;

    if (!series) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Metric '${metricName}' not found`,
          details: 'The requested metric is not being collected or does not exist'
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          endpoint: `/performance/metrics/${metricName}`
        }
      });
    }

    // Get recent values (last 100 data points)
    const recentValues = series.values.slice(-100);
    
    // Calculate basic statistics
    const values = recentValues.map(v => v.value);
    const statistics = values.length > 0 ? {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      count: values.length,
      latest: latestValue?.value,
      latestTimestamp: latestValue?.timestamp
    } : null;

    return res.json({
      success: true,
      data: {
        metricName,
        series: {
          name: series.name,
          type: series.type,
          unit: series.unit,
          description: series.description,
          totalDataPoints: series.values.length
        },
        recentValues,
        latestValue,
        statistics,
        timeRange: recentValues.length > 0 ? {
          start: recentValues[0]?.timestamp,
          end: recentValues[recentValues.length - 1]?.timestamp
        } : null
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/metrics/${metricName}`,
        dataPoints: recentValues.length
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to get metric ${metricName}`, error);

    return res.status(500).json({
      success: false,
      error: {
        message: `Failed to retrieve metric '${metricName}'`,
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: `/performance/metrics/${metricName}`
      }
    });
  }
});

/**
 * @route POST /performance/metrics/record
 * @desc Record a custom metric value
 * @access Public
 */
router.post('/metrics/record', async (req: Request, res: Response): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const {
      name,
      value,
      type = 'gauge',
      unit,
      description,
      labels
    } = req.body;

    if (!name || value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Metric name and value are required',
          details: 'Please provide both name and value for the metric'
        },
        meta: {
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          endpoint: '/performance/metrics/record'
        }
      });
    }

    if (typeof value !== 'number') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Metric value must be a number',
          details: `Received value of type ${typeof value}`
        },
        meta: {
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          endpoint: '/performance/metrics/record'
        }
      });
    }

    // Record the metric
    metricsCollector.recordMetric(name, value, type, {
      unit,
      description,
      labels
    });

    const responseTime = Date.now() - startTime;
    
    logger.info('Custom metric recorded', { name, value, type, labels });

    return res.json({
      success: true,
      data: {
        message: 'Metric recorded successfully',
        metric: {
          name,
          value,
          type,
          unit,
          description,
          labels,
          timestamp: new Date().toISOString()
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/record'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to record custom metric', error);

    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to record metric',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/record'
      }
    });
  }
});

/**
 * @route GET /performance/metrics/system/realtime
 * @desc Get real-time system metrics in metrics collector format
 * @access Public
 */
router.get('/metrics/system/realtime', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Get latest values for key system metrics
    const cpuUsage = metricsCollector.getLatestValue('system.cpu.usage');
    const memoryUsage = metricsCollector.getLatestValue('system.memory.percentage');
    const diskUsage = metricsCollector.getLatestValue('system.disk.percentage');
    const processUptime = metricsCollector.getLatestValue('system.process.uptime');
    const processMemory = metricsCollector.getLatestValue('system.process.memory');
    
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        realtime: {
          cpu: cpuUsage || null,
          memory: memoryUsage || null,
          disk: diskUsage || null,
          process: {
            uptime: processUptime || null,
            memory: processMemory || null
          }
        },
        status: {
          cpu: cpuUsage ? (cpuUsage.value > 80 ? 'high' : cpuUsage.value > 60 ? 'medium' : 'normal') : 'unknown',
          memory: memoryUsage ? (memoryUsage.value > 85 ? 'high' : memoryUsage.value > 70 ? 'medium' : 'normal') : 'unknown',
          disk: diskUsage ? (diskUsage.value > 90 ? 'high' : diskUsage.value > 75 ? 'medium' : 'normal') : 'unknown'
        },
        dataAge: {
          cpu: cpuUsage ? Date.now() - cpuUsage.timestamp.getTime() : null,
          memory: memoryUsage ? Date.now() - memoryUsage.timestamp.getTime() : null,
          disk: diskUsage ? Date.now() - diskUsage.timestamp.getTime() : null
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/system/realtime'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to get real-time system metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve real-time system metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics/system/realtime'
      }
    });
  }
});

/**
 * @route DELETE /performance/metrics
 * @desc Reset all collected metrics (admin only)
 * @access Private
 */
router.delete('/metrics', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const summaryBeforeReset = metricsCollector.getMetricsSummary();
    
    metricsCollector.reset();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('All metrics reset', { 
      metricsCleared: summaryBeforeReset.totalMetrics,
      dataPointsCleared: summaryBeforeReset.totalDataPoints
    });

    res.json({
      success: true,
      data: {
        message: 'All metrics reset successfully',
        cleared: {
          totalMetrics: summaryBeforeReset.totalMetrics,
          totalDataPoints: summaryBeforeReset.totalDataPoints,
          memoryFreed: `${(summaryBeforeReset.memoryUsage / 1024 / 1024).toFixed(2)} MB`
        }
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to reset metrics', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reset metrics',
        details: errorMessage
      },
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        endpoint: '/performance/metrics'
      }
    });
  }
});

export default router;
