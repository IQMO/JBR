/**
 * Express Middleware for Application Performance Monitoring
 * 
 * Automatically tracks all HTTP requests, response times, error rates,
 * and endpoint performance for the ApplicationMonitorService
 */

import { performance } from 'perf_hooks';

import type { Request, Response, NextFunction } from 'express';

import ApplicationMonitorService from '../services/application-monitor.service';
import logger from '../services/logging.service';

/**
 * Extended request interface with monitoring data
 */
interface MonitoredRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Application Performance Monitoring Middleware
 */
class AppMonitoringMiddleware {
  private applicationMonitor: ApplicationMonitorService;

  constructor() {
    // Use singleton instance instead of creating new one
    this.applicationMonitor = ApplicationMonitorService.getInstance();
  }

  /**
   * Express middleware to track request performance
   */
  public trackRequests() {
    return (req: MonitoredRequest, res: Response, next: NextFunction) => {
      // Generate unique request ID
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.startTime = performance.now();

      // Track request start
      logger.debug('Request started', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Override res.end to capture response data
      const originalEnd = res.end;
      const self = this;
      res.end = function(this: Response, chunk?: any, encoding?: any): Response {
        const endTime = performance.now();
        const responseTime = endTime - (req.startTime || endTime);

        // Log the request to ApplicationMonitorService
        self.applicationMonitor.logRequest({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime: Math.round(responseTime * 100) / 100, // Round to 2 decimal places
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        // Log completion
        logger.debug('Request completed', {
          requestId: req.requestId,
          statusCode: res.statusCode,
          responseTime: Math.round(responseTime * 100) / 100
        });

        // Call original end method
        return originalEnd.call(this, chunk, encoding);
      };

      // Store references for the response handler
      (req as any)._applicationMonitor = this.applicationMonitor;

      next();
    };
  }

  /**
   * Error handling middleware to track application errors
   */
  public trackErrors() {
    return (err: Error, req: MonitoredRequest, res: Response, next: NextFunction) => {
      // Log error to ApplicationMonitorService
      this.applicationMonitor.logError({
        type: err.name || 'UnknownError',
        message: err.message,
        stack: err.stack,
        level: 'error',
        context: {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      next(err);
    };
  }

  /**
   * Middleware to track database queries
   */
  public trackDatabaseQueries() {
    return (queryTime: number, isSlowQuery?: boolean) => {
      this.applicationMonitor.updateDatabaseMetrics({
        queryTime,
        isSlowQuery
      });
    };
  }

  /**
   * Track WebSocket connections
   */
  public trackWebSocketConnection(connected = true) {
    const currentConnections = this.getWebSocketConnectionCount();
    
    this.applicationMonitor.updateWebSocketMetrics({
      activeConnections: connected ? currentConnections + 1 : Math.max(0, currentConnections - 1),
      disconnection: !connected
    });
  }

  /**
   * Track WebSocket messages
   */
  public trackWebSocketMessage(messageCount = 1) {
    this.applicationMonitor.updateWebSocketMetrics({
      messagesSent: messageCount
    });
  }

  /**
   * Get current WebSocket connection count (placeholder - would be implemented with actual WebSocket server)
   */
  private getWebSocketConnectionCount(): number {
    // This would be implemented to get actual WebSocket connection count
    // from the WebSocket server instance
    return 0;
  }

  /**
   * Initialize monitoring middleware
   */
  public initialize() {
    // Start the ApplicationMonitorService
    this.applicationMonitor.start();

    logger.info('Application monitoring middleware initialized');

    return {
      trackRequests: this.trackRequests.bind(this),
      trackErrors: this.trackErrors.bind(this),
      trackDatabaseQueries: this.trackDatabaseQueries.bind(this),
      trackWebSocketConnection: this.trackWebSocketConnection.bind(this),
      trackWebSocketMessage: this.trackWebSocketMessage.bind(this)
    };
  }

  /**
   * Get current application metrics
   */
  public getMetrics() {
    return this.applicationMonitor.getCurrentMetrics();
  }

  /**
   * Get monitoring statistics
   */
  public getStats() {
    return this.applicationMonitor.getStats();
  }

  /**
   * Shutdown monitoring
   */
  public shutdown() {
    this.applicationMonitor.shutdown();
    logger.info('Application monitoring middleware shut down');
  }
}

// Export singleton instance
export const appMonitoringMiddleware = new AppMonitoringMiddleware();

// Export class for custom instances
export default AppMonitoringMiddleware;
