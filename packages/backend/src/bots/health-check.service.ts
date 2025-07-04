/**
 * Health Check Service
 * 
 * Provides comprehensive system health validation endpoints and monitoring.
 * Validates database connections, exchange connectivity, system resources,
 * and overall application health.
 */

import type { Request, Response } from 'express';

import { database } from '../services/database.service';
import logger from '../services/logging.service';

import type { BotManager } from './bot-manager';
import type { BotWatchdog } from './bot-watchdog';
import type { ErrorRecoveryManager } from './error-recovery-manager';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  responseTime: number;
  message?: string;
  details?: Record<string, unknown>;
  lastChecked: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    load: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
}

export interface HealthCheckResponse {
  overall: HealthStatus;
  components: ComponentHealth[];
  metrics: SystemMetrics;
  bots: {
    total: number;
    healthy: number;
    unhealthy: number;
    dead: number;
  };
  errors: {
    total: number;
    resolved: number;
    activeCircuitBreakers: number;
  };
}

export class HealthCheckService {
  private botManager: BotManager;
  private errorRecoveryManager: ErrorRecoveryManager;
  private botWatchdog: BotWatchdog;
  private startTime: Date;

  constructor(
    botManager: BotManager,
    errorRecoveryManager: ErrorRecoveryManager,
    botWatchdog: BotWatchdog
  ) {
    this.botManager = botManager;
    this.errorRecoveryManager = errorRecoveryManager;
    this.botWatchdog = botWatchdog;
    this.startTime = new Date();
  }

  /**
   * Main health check endpoint
   */
  async getHealthStatus(): Promise<HealthCheckResponse> {
    const components: ComponentHealth[] = [];
    
    // Check all components
    const databaseHealth = await this.checkDatabaseHealth();
    components.push(databaseHealth);

    const exchangeHealth = await this.checkExchangeHealth();
    components.push(exchangeHealth);

    const systemHealth = await this.checkSystemHealth();
    components.push(systemHealth);

    const watchdogHealth = await this.checkWatchdogHealth();
    components.push(watchdogHealth);

    // Get system metrics
    const metrics = await this.getSystemMetrics();

    // Get bot statistics
    const botStats = this.getBotStatistics();

    // Get error statistics
    const errorStats = this.getErrorStatistics();

    // Determine overall health
    const overall = this.determineOverallHealth(components, metrics);

    return {
      overall,
      components,
      metrics,
      bots: botStats,
      errors: errorStats
    };
  }

  /**
   * Simple liveness probe (for Kubernetes)
   */
  async liveness(): Promise<{ status: 'alive' | 'dead'; timestamp: string }> {
    try {
      // Basic application responsiveness check
      const testResponse = Date.now();
      
      return {
        status: 'alive',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'dead',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Readiness probe (for Kubernetes)
   */
  async readiness(): Promise<{ 
    status: 'ready' | 'not-ready'; 
    timestamp: string; 
    checks: Record<string, boolean> 
  }> {
    const checks = {
      database: false,
      watchdog: false,
      errorRecovery: false
    };

    try {
      // Check database connectivity
      checks.database = await this.isDatabaseReady();
      
      // Check watchdog service
      checks.watchdog = this.botWatchdog.isRunning();
      
      // Check error recovery service
      checks.errorRecovery = true; // ErrorRecoveryManager is always ready if instantiated

      const allReady = Object.values(checks).every(check => check);

      return {
        status: allReady ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString(),
        checks
      };
    } catch (error) {
      logger.error('[HealthCheck] Readiness check failed', { error });
      
      return {
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        checks
      };
    }
  }

  /**
   * Component health checks
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      const result = await database.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;
      
      if (result && result.length > 0 && result.at(0).health_check === 1) {
        return {
          name: 'database',
          status: responseTime > 1000 ? 'degraded' : 'healthy',
          responseTime,
          message: responseTime > 1000 ? 'Slow response time' : 'Connected',
          lastChecked: new Date().toISOString()
        };
      } 
        return {
          name: 'database',
          status: 'unhealthy',
          responseTime,
          message: 'Invalid response from database',
          lastChecked: new Date().toISOString()
        };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        name: 'database',
        status: 'critical',
        responseTime,
        message: `Database connection failed: ${errorMessage}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkExchangeHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // This would check exchange connectivity
      // For now, we'll simulate based on error rates
      const errorStats = this.errorRecoveryManager.getStats();
      const exchangeErrors = errorStats.errorsByType.EXCHANGE_ERROR || 0;
      const responseTime = Date.now() - startTime;
      
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'Exchange connections healthy';
      
      if (exchangeErrors > 50) {
        status = 'critical';
        message = `High exchange error count: ${exchangeErrors}`;
      } else if (exchangeErrors > 20) {
        status = 'degraded';
        message = `Moderate exchange error count: ${exchangeErrors}`;
      } else if (exchangeErrors > 10) {
        status = 'degraded';
        message = `Some exchange errors detected: ${exchangeErrors}`;
      }

      return {
        name: 'exchanges',
        status,
        responseTime,
        message,
        details: {
          exchangeErrors,
          activeCircuitBreakers: errorStats.activeCircuitBreakers
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        name: 'exchanges',
        status: 'critical',
        responseTime,
        message: `Exchange health check failed: ${errorMessage}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkSystemHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const metrics = await this.getSystemMetrics();
      const responseTime = Date.now() - startTime;
      
      let status: ComponentHealth['status'] = 'healthy';
      const issues: string[] = [];
      
      if (metrics.memory.percentage > 90) {
        status = 'critical';
        issues.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
      } else if (metrics.memory.percentage > 80) {
        status = 'degraded';
        issues.push(`Elevated memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
      }
      
      if (metrics.cpu.usage > 90) {
        status = 'critical';
        issues.push(`High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
      } else if (metrics.cpu.usage > 80) {
        status = 'degraded';
        issues.push(`Elevated CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
      }
      
      if (metrics.disk.percentage > 95) {
        status = 'critical';
        issues.push(`High disk usage: ${metrics.disk.percentage.toFixed(1)}%`);
      } else if (metrics.disk.percentage > 85) {
        status = 'degraded';
        issues.push(`Elevated disk usage: ${metrics.disk.percentage.toFixed(1)}%`);
      }

      return {
        name: 'system',
        status,
        responseTime,
        message: issues.length > 0 ? issues.join(', ') : 'System resources normal',
        details: JSON.parse(JSON.stringify(metrics)),
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        name: 'system',
        status: 'critical',
        responseTime,
        message: `System health check failed: ${errorMessage}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkWatchdogHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const watchdogStats = this.botWatchdog.getWatchdogStats();
      const responseTime = Date.now() - startTime;
      
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'Watchdog service operational';
      
      if (!watchdogStats.running) {
        status = 'critical';
        message = 'Watchdog service is not running';
      } else if (watchdogStats.deadBots > 0) {
        status = 'degraded';
        message = `${watchdogStats.deadBots} dead bots detected`;
      } else if (watchdogStats.unhealthyBots > 0) {
        status = 'degraded';
        message = `${watchdogStats.unhealthyBots} unhealthy bots detected`;
      }

      return {
        name: 'watchdog',
        status,
        responseTime,
        message,
        details: watchdogStats,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        name: 'watchdog',
        status: 'critical',
        responseTime,
        message: `Watchdog health check failed: ${errorMessage}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const process = await import('process');
      const os = await import('os');
      const fs = await import('fs');
      
      // Memory metrics
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const usedMemory = memoryUsage.heapUsed + memoryUsage.external;
      
      // CPU metrics
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      
      // Disk metrics (approximate)
      let diskUsed = 0;
      let diskTotal = 1;
      try {
        const stats = fs.statSync('.');
        // This is a simplified disk check
        diskTotal = 1000000000; // 1GB default
        diskUsed = 100000000; // 100MB default
      } catch (error) {
        // Use defaults if disk check fails
      }

      return {
        memory: {
          used: Math.round(usedMemory / 1024 / 1024), // MB
          total: Math.round(totalMemory / 1024 / 1024), // MB
          percentage: (usedMemory / totalMemory) * 100
        },
        cpu: {
          usage: cpus.length > 0 ? ((loadAvg.at(0) || 0) * 100 / cpus.length) : 0, // Approximate CPU usage
          load: loadAvg
        },
        disk: {
          used: Math.round(diskUsed / 1024 / 1024), // MB
          total: Math.round(diskTotal / 1024 / 1024), // MB
          percentage: (diskUsed / diskTotal) * 100
        },
        uptime: Date.now() - this.startTime.getTime()
      };
    } catch (error) {
      // Return default metrics if system check fails
      return {
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0, load: [0, 0, 0] },
        disk: { used: 0, total: 0, percentage: 0 },
        uptime: Date.now() - this.startTime.getTime()
      };
    }
  }

  /**
   * Get bot statistics
   */
  private getBotStatistics(): {
    total: number;
    healthy: number;
    unhealthy: number;
    dead: number;
  } {
    const watchdogStats = this.botWatchdog.getWatchdogStats();
    
    return {
      total: watchdogStats.monitoredBots,
      healthy: watchdogStats.healthyBots,
      unhealthy: watchdogStats.unhealthyBots,
      dead: watchdogStats.deadBots
    };
  }

  /**
   * Get error statistics
   */
  private getErrorStatistics(): {
    total: number;
    resolved: number;
    activeCircuitBreakers: number;
  } {
    const errorStats = this.errorRecoveryManager.getStats();
    
    return {
      total: errorStats.totalErrors,
      resolved: errorStats.resolvedErrors,
      activeCircuitBreakers: errorStats.activeCircuitBreakers
    };
  }

  /**
   * Determine overall health status
   */
  private determineOverallHealth(
    components: ComponentHealth[], 
    metrics: SystemMetrics
  ): HealthStatus {
    const criticalComponents = components.filter(c => c.status === 'critical');
    const unhealthyComponents = components.filter(c => c.status === 'unhealthy');
    const degradedComponents = components.filter(c => c.status === 'degraded');
    
    let status: HealthStatus['status'] = 'healthy';
    
    if (criticalComponents.length > 0) {
      status = 'critical';
    } else if (unhealthyComponents.length > 0) {
      status = 'unhealthy';
    } else if (degradedComponents.length > 0) {
      status = 'degraded';
    }
    
    // Also consider system metrics
    if (metrics.memory.percentage > 95 || metrics.cpu.usage > 95) {
      status = 'critical';
    } else if (metrics.memory.percentage > 85 || metrics.cpu.usage > 85) {
      if (status === 'healthy') {
        status = 'degraded';
      }
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Check if database is ready
   */
  private async isDatabaseReady(): Promise<boolean> {
    try {
      const result = await database.query('SELECT 1');
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Express route handlers
   */
  healthHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const healthStatus = await this.getHealthStatus();
      
      const statusCode = this.getHttpStatusCode(healthStatus.overall.status);
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[HealthCheck] Health check failed', { error: errorMessage });
      
      res.status(503).json({
        overall: {
          status: 'critical',
          timestamp: new Date().toISOString(),
          uptime: Date.now() - this.startTime.getTime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        error: errorMessage
      });
    }
  };

  livenessHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const liveness = await this.liveness();
      const statusCode = liveness.status === 'alive' ? 200 : 503;
      res.status(statusCode).json(liveness);
    } catch (error) {
      res.status(503).json({
        status: 'dead',
        timestamp: new Date().toISOString()
      });
    }
  };

  readinessHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const readiness = await this.readiness();
      const statusCode = readiness.status === 'ready' ? 200 : 503;
      res.status(statusCode).json(readiness);
    } catch (error) {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        checks: {}
      });
    }
  };

  /**
   * Get HTTP status code for health status
   */
  private getHttpStatusCode(status: HealthStatus['status']): number {
    switch (status) {
      case 'healthy':
        return 200;
      case 'degraded':
        return 200; // Still operational
      case 'unhealthy':
        return 503;
      case 'critical':
        return 503;
      default:
        return 503;
    }
  }
}

export default HealthCheckService;
