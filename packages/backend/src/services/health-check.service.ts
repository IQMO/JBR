/**
 * Health Check Service
 * 
 * Provides system health validation and monitoring endpoints.
 * Aggregates health information from all system components.
 */

import { EventEmitter } from 'events';

import type ApplicationMonitorService from './application-monitor.service';
import { database } from './database.service';
import logger from './logging.service';
import type SystemMonitorService from './system-monitor.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  components: Record<string, ComponentHealth>;
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastCheck: Date;
  responseTime?: number;
  metadata?: any;
  dependencies?: string[];
}

export interface HealthCheckConfig {
  checkInterval: number; // milliseconds
  timeoutPerCheck: number; // milliseconds
  enableDetailedChecks: boolean;
  criticalComponents: string[];
}

export class HealthCheckService extends EventEmitter {
  private config: HealthCheckConfig;
  private systemMonitor?: SystemMonitorService;
  private applicationMonitor?: ApplicationMonitorService;
  private componentChecks: Map<string, () => Promise<ComponentHealth>> = new Map();
  private lastHealthStatus?: HealthStatus;
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;
  private startTime: Date;

  constructor(
    config: Partial<HealthCheckConfig> = {},
    systemMonitor?: SystemMonitorService,
    applicationMonitor?: ApplicationMonitorService
  ) {
    super();
    
    this.config = {
      checkInterval: 30000, // 30 seconds
      timeoutPerCheck: 5000, // 5 seconds
      enableDetailedChecks: true,
      criticalComponents: ['database', 'system', 'application'],
      ...config
    };

    this.systemMonitor = systemMonitor;
    this.applicationMonitor = applicationMonitor;
    this.startTime = new Date();

    this.setupDefaultChecks();
    logger.info('Health Check Service initialized', { config: this.config });
  }

  /**
   * Start health monitoring
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Health Check Service is already running');
      return;
    }

    this.isRunning = true;

    // Perform initial health check
    this.performHealthCheck();

    // Start periodic health checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    logger.info('Health Check Service started', {
      interval: this.config.checkInterval
    });

    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    logger.info('Health Check Service stopped');
    this.emit('stopped');
  }

  /**
   * Get current health status
   */
  public async getCurrentHealth(): Promise<HealthStatus> {
    return this.performHealthCheck();
  }

  /**
   * Get cached health status
   */
  public getCachedHealth(): HealthStatus | null {
    return this.lastHealthStatus || null;
  }

  /**
   * Add a custom component health check
   */
  public addComponentCheck(name: string, checkFunction: () => Promise<ComponentHealth>): void {
    this.componentChecks.set(name, checkFunction);
    logger.info('Component health check added', { component: name });
  }

  /**
   * Remove a component health check
   */
  public removeComponentCheck(name: string): void {
    this.componentChecks.delete(name);
    logger.info('Component health check removed', { component: name });
  }

  /**
   * Check if system is healthy
   */
  public isHealthy(): boolean {
    return this.lastHealthStatus?.status === 'healthy';
  }

  /**
   * Get uptime in seconds
   */
  public getUptime(): number {
    return (Date.now() - this.startTime.getTime()) / 1000;
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const components: Record<string, ComponentHealth> = {};

    try {
      // Run all component checks
      const checkPromises = Array.from(this.componentChecks.entries()).map(
        async ([name, checkFn]) => {
          try {
            const result = await Promise.race([
              checkFn(),
              this.createTimeoutPromise(name)
            ]);
            if (typeof name !== 'string' || !name) {
              throw new Error('Health check component name must be a non-empty string');
            }
            components[name as keyof typeof components] = result;
          } catch (error) {
            if (typeof name !== 'string' || !name) {
              throw new Error('Health check component name must be a non-empty string');
            }
            components[name as keyof typeof components] = {
              status: 'unhealthy',
              message: error instanceof Error ? error.message : String(error),
              lastCheck: new Date(),
              responseTime: Date.now() - startTime
            };
          }
        }
      );

      await Promise.all(checkPromises);

      // Calculate overall status
      const summary = {
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        total: Object.keys(components).length
      };

      let overallStatus: HealthStatus['status'] = 'healthy';

      for (const component of Object.values(components)) {
        summary[component.status]++;
        
        // If any critical component is unhealthy, mark overall as unhealthy
        if (component.status === 'unhealthy' && 
            this.config.criticalComponents.includes(component.status)) {
          overallStatus = 'unhealthy';
        } else if (component.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date(),
        uptime: this.getUptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        components,
        summary
      };

      this.lastHealthStatus = healthStatus;

      // Emit health status change if different
      if (!this.lastHealthStatus || this.lastHealthStatus.status !== healthStatus.status) {
        this.emit('healthStatusChange', healthStatus);
      }

      this.emit('healthCheck', healthStatus);

      logger.debug('Health check completed', {
        status: healthStatus.status,
        componentCount: summary.total,
        responseTime: Date.now() - startTime
      });

      return healthStatus;

    } catch (error) {
      logger.error('Health check failed', { error });
      
      const errorStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date(),
        uptime: this.getUptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        components,
        summary: {
          healthy: 0,
          degraded: 0,
          unhealthy: 1,
          total: 1
        }
      };

      this.lastHealthStatus = errorStatus;
      this.emit('healthCheck', errorStatus);
      
      return errorStatus;
    }
  }

  /**
   * Create a timeout promise for health checks
   */
  private createTimeoutPromise(componentName: string): Promise<ComponentHealth> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout for ${componentName}`));
      }, this.config.timeoutPerCheck);
    });
  }

  /**
   * Setup default health checks
   */
  private setupDefaultChecks(): void {
    // Database health check
    this.addComponentCheck('database', async (): Promise<ComponentHealth> => {
      const startTime = Date.now();
      
      try {
        // Simple query to test database connectivity
        await database.query('SELECT 1 as health_check');
        
        return {
          status: 'healthy',
          message: 'Database connection successful',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }
    });

    // System health check
    this.addComponentCheck('system', async (): Promise<ComponentHealth> => {
      const startTime = Date.now();
      
      try {
        if (!this.systemMonitor) {
          return {
            status: 'degraded',
            message: 'System monitor not available',
            lastCheck: new Date(),
            responseTime: Date.now() - startTime
          };
        }

        const systemHealth = this.systemMonitor.getHealthSummary();
        
        return {
          status: systemHealth.status === 'healthy' ? 'healthy' : 
                  systemHealth.status === 'warning' ? 'degraded' : 'unhealthy',
          message: systemHealth.issues.length > 0 ? 
                   systemHealth.issues.join(', ') : 'System resources healthy',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          metadata: {
            uptime: systemHealth.uptime,
            lastSystemCheck: systemHealth.lastCheck,
            issues: systemHealth.issues
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `System health check failed: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }
    });

    // Application health check
    this.addComponentCheck('application', async (): Promise<ComponentHealth> => {
      const startTime = Date.now();
      
      try {
        if (!this.applicationMonitor) {
          return {
            status: 'degraded',
            message: 'Application monitor not available',
            lastCheck: new Date(),
            responseTime: Date.now() - startTime
          };
        }

        const appMetrics = this.applicationMonitor.getCurrentMetrics();
        const issues: string[] = [];

        // Check error rate
        if (appMetrics.performance.errorRate > 10) {
          issues.push(`High error rate: ${appMetrics.performance.errorRate.toFixed(1)}%`);
        }

        // Check response time
        if (appMetrics.performance.responseTime.average > 2000) {
          issues.push(`High response time: ${appMetrics.performance.responseTime.average.toFixed(0)}ms`);
        }

        // Check database
        if (appMetrics.database.averageQueryTime > 1000) {
          issues.push(`Slow database queries: ${appMetrics.database.averageQueryTime.toFixed(0)}ms`);
        }

        const status = issues.length === 0 ? 'healthy' : 
                      issues.length <= 2 ? 'degraded' : 'unhealthy';

        return {
          status,
          message: issues.length > 0 ? issues.join(', ') : 'Application metrics healthy',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          metadata: {
            errorRate: appMetrics.performance.errorRate,
            avgResponseTime: appMetrics.performance.responseTime.average,
            throughput: appMetrics.performance.throughput.requestsPerSecond,
            dbQueryTime: appMetrics.database.averageQueryTime
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Application health check failed: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }
    });

    // Memory health check
    this.addComponentCheck('memory', async (): Promise<ComponentHealth> => {
      const startTime = Date.now();
      
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const usage = (heapUsedMB / heapTotalMB) * 100;

        let status: ComponentHealth['status'] = 'healthy';
        let message = `Memory usage: ${heapUsedMB.toFixed(1)}MB (${usage.toFixed(1)}%)`;

        if (usage > 90) {
          status = 'unhealthy';
          message = `Critical memory usage: ${usage.toFixed(1)}%`;
        } else if (usage > 80) {
          status = 'degraded';
          message = `High memory usage: ${usage.toFixed(1)}%`;
        }

        return {
          status,
          message,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          metadata: {
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            usage,
            external: memUsage.external / 1024 / 1024,
            rss: memUsage.rss / 1024 / 1024
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Memory health check failed: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }
    });

    // Process health check
    this.addComponentCheck('process', async (): Promise<ComponentHealth> => {
      const startTime = Date.now();
      
      try {
        const uptime = process.uptime();
        const pid = process.pid;
        const version = process.version;

        // Check if process has been running for a reasonable time
        const status: ComponentHealth['status'] = uptime > 10 ? 'healthy' : 'degraded';
        const message = `Process ${pid} running for ${Math.floor(uptime)}s on Node.js ${version}`;

        return {
          status,
          message,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          metadata: {
            pid,
            uptime,
            nodeVersion: version,
            platform: process.platform,
            arch: process.arch
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Process health check failed: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }
    });

    logger.info('Default health checks setup completed');
  }

  /**
   * Get health check summary for quick status
   */
  public getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: Date | null;
    criticalIssues: string[];
  } {
    const health = this.getCachedHealth();
    
    if (!health) {
      return {
        status: 'unhealthy',
        uptime: this.getUptime(),
        lastCheck: null,
        criticalIssues: ['No health data available']
      };
    }

    const criticalIssues: string[] = [];
    
    for (const [name, component] of Object.entries(health.components)) {
      if (component.status === 'unhealthy' && this.config.criticalComponents.includes(name)) {
        criticalIssues.push(`${name}: ${component.message}`);
      }
    }

    return {
      status: health.status,
      uptime: health.uptime,
      lastCheck: health.timestamp,
      criticalIssues
    };
  }

  /**
   * Express middleware for health check endpoint
   */
  public getHealthMiddleware() {
    return async (req: any, res: any) => {
      try {
        const health = await this.getCurrentHealth();
        
        const statusCode = health.status === 'healthy' ? 200 :
                          health.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check endpoint error', { error });
        res.status(503).json({
          status: 'unhealthy',
          message: 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Express middleware for readiness check
   */
  public getReadinessMiddleware() {
    return async (req: any, res: any) => {
      try {
        const health = await this.getCurrentHealth();
        
        // Ready if system is healthy or degraded (but not unhealthy)
        const isReady = health.status !== 'unhealthy';
        
        if (isReady) {
          res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({
            status: 'not_ready',
            reason: 'Critical components unhealthy',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('Readiness check endpoint error', { error });
        res.status(503).json({
          status: 'not_ready',
          reason: 'Readiness check failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Express middleware for liveness check
   */
  public getLivenessMiddleware() {
    return (req: any, res: any) => {
      // Simple liveness check - if we can respond, we're alive
      res.status(200).json({
        status: 'alive',
        uptime: this.getUptime(),
        timestamp: new Date().toISOString()
      });
    };
  }

  /**
   * Shutdown the health check service
   */
  public shutdown(): void {
    this.stop();
    this.componentChecks.clear();
    this.lastHealthStatus = undefined;
    this.removeAllListeners();
    
    logger.info('Health Check Service shut down');
  }
}

export default HealthCheckService;
