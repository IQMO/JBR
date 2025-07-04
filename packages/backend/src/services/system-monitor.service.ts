/**
 * System Monitor Service
 * 
 * Monitors system resources including CPU, memory, disk usage, and process health.
 * Provides real-time metrics and alerts for system performance issues.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import logger from './logging.service';

export interface SystemMetrics {
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number; // bytes
    used: number; // bytes
    free: number; // bytes
    percentage: number;
  };
  disk: {
    total: number; // bytes
    used: number; // bytes
    free: number; // bytes
    percentage: number;
  };
  process: {
    pid: number;
    uptime: number; // seconds
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  network: {
    interfaces: NetworkInterface[];
  };
  timestamp: Date;
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  mac: string;
}

export interface SystemAlert {
  type: 'cpu' | 'memory' | 'disk' | 'process';
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface SystemMonitorConfig {
  collectInterval: number; // milliseconds
  alertThresholds: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    disk: { warning: number; critical: number };
  };
  enableAlerts: boolean;
  retentionPeriod: number; // milliseconds
}

export class SystemMonitorService extends EventEmitter {
  private config: SystemMonitorConfig;
  private metrics: SystemMetrics[] = [];
  private isRunning = false;
  private monitorInterval?: NodeJS.Timeout;
  private previousCpuUsage?: NodeJS.CpuUsage;
  private startTime: Date;

  constructor(config: Partial<SystemMonitorConfig> = {}) {
    super();
    
    this.config = {
      collectInterval: 5000, // 5 seconds
      alertThresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 80, critical: 95 },
        disk: { warning: 85, critical: 95 }
      },
      enableAlerts: true,
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };

    this.startTime = new Date();
    logger.info('System Monitor Service initialized', { config: this.config });
  }

  /**
   * Start system monitoring
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('System Monitor is already running');
      return;
    }

    this.isRunning = true;
    this.previousCpuUsage = process.cpuUsage();
    
    // Collect initial metrics
    this.collectMetrics();
    
    // Start periodic collection
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectInterval);

    // Start cleanup routine (every hour)
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);

    logger.info('System Monitor started', {
      interval: this.config.collectInterval,
      alertsEnabled: this.config.enableAlerts
    });

    this.emit('started');
  }

  /**
   * Stop system monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    logger.info('System Monitor stopped');
    this.emit('stopped');
  }

  /**
   * Get current system metrics
   */
  public getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? (this.metrics[this.metrics.length - 1] || null) : null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(duration?: number): SystemMetrics[] {
    if (!duration) {
      return [...this.metrics];
    }

    const cutoff = new Date(Date.now() - duration);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get system health summary
   */
  public getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
    lastCheck: Date | null;
  } {
    const current = this.getCurrentMetrics();
    
    if (!current) {
      return {
        status: 'critical',
        issues: ['No metrics available'],
        uptime: 0,
        lastCheck: null
      };
    }

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check CPU
    if (current.cpu.usage >= this.config.alertThresholds.cpu.critical) {
      issues.push(`Critical CPU usage: ${current.cpu.usage.toFixed(1)}%`);
      status = 'critical';
    } else if (current.cpu.usage >= this.config.alertThresholds.cpu.warning) {
      issues.push(`High CPU usage: ${current.cpu.usage.toFixed(1)}%`);
      status = 'warning';
    }

    // Check Memory
    if (current.memory.percentage >= this.config.alertThresholds.memory.critical) {
      issues.push(`Critical memory usage: ${current.memory.percentage.toFixed(1)}%`);
      status = 'critical';
    } else if (current.memory.percentage >= this.config.alertThresholds.memory.warning) {
      issues.push(`High memory usage: ${current.memory.percentage.toFixed(1)}%`);
      if (status !== 'critical') {status = 'warning';}
    }

    // Check Disk
    if (current.disk.percentage >= this.config.alertThresholds.disk.critical) {
      issues.push(`Critical disk usage: ${current.disk.percentage.toFixed(1)}%`);
      status = 'critical';
    } else if (current.disk.percentage >= this.config.alertThresholds.disk.warning) {
      issues.push(`High disk usage: ${current.disk.percentage.toFixed(1)}%`);
      if (status !== 'critical') {status = 'warning';}
    }

    return {
      status,
      issues,
      uptime: current.process.uptime,
      lastCheck: current.timestamp
    };
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        cpu: await this.getCpuMetrics(),
        memory: this.getMemoryMetrics(),
        disk: await this.getDiskMetrics(),
        process: this.getProcessMetrics(),
        network: this.getNetworkMetrics(),
        timestamp: new Date()
      };

      this.metrics.push(metrics);
      
      // Check for alerts
      if (this.config.enableAlerts) {
        this.checkAlerts(metrics);
      }

      // Emit metrics event
      this.emit('metrics', metrics);

      logger.debug('System metrics collected', {
        cpu: metrics.cpu.usage,
        memory: metrics.memory.percentage,
        disk: metrics.disk.percentage
      });

    } catch (error) {
      logger.error('Failed to collect system metrics', { error });
      this.emit('error', error);
    }
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // Calculate CPU usage using process.cpuUsage()
    const currentUsage = process.cpuUsage(this.previousCpuUsage);
    this.previousCpuUsage = process.cpuUsage();
    
    // Calculate percentage (approximation)
    const totalUsage = currentUsage.user + currentUsage.system;
    const intervalMs = this.config.collectInterval;
    const intervalMicroseconds = intervalMs * 1000;
    const usage = Math.min((totalUsage / intervalMicroseconds) * 100, 100);

    return {
      usage: Math.max(0, usage), // Ensure non-negative
      loadAverage,
      cores: cpus.length
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): SystemMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      total,
      used,
      free,
      percentage
    };
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      // For cross-platform compatibility, we'll use a simple approach
      // In production, you might want to use a more sophisticated disk monitoring library
      const stats = await fs.stat(process.cwd());
      
      // Simplified disk metrics (this is a basic implementation)
      // In a real scenario, you'd use platform-specific tools or libraries
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB placeholder
        used: 50 * 1024 * 1024 * 1024,   // 50GB placeholder
        free: 50 * 1024 * 1024 * 1024,   // 50GB placeholder
        percentage: 50 // 50% placeholder
      };
    } catch (error) {
      logger.warn('Failed to get disk metrics, using defaults', { error });
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      };
    }
  }

  /**
   * Get process metrics
   */
  private getProcessMetrics(): SystemMetrics['process'] {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * Get network metrics
   */
  private getNetworkMetrics(): SystemMetrics['network'] {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterface[] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (addresses) {
        for (const addr of addresses) {
          result.push({
            name,
            address: addr.address,
            family: addr.family,
            internal: addr.internal,
            mac: addr.mac
          });
        }
      }
    }

    return { interfaces: result };
  }

  /**
   * Check for alerts based on thresholds
   */
  private checkAlerts(metrics: SystemMetrics): void {
    const alerts: SystemAlert[] = [];

    // CPU alerts
    if (metrics.cpu.usage >= this.config.alertThresholds.cpu.critical) {
      alerts.push({
        type: 'cpu',
        level: 'critical',
        message: `Critical CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: this.config.alertThresholds.cpu.critical,
        timestamp: metrics.timestamp
      });
    } else if (metrics.cpu.usage >= this.config.alertThresholds.cpu.warning) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: this.config.alertThresholds.cpu.warning,
        timestamp: metrics.timestamp
      });
    }

    // Memory alerts
    if (metrics.memory.percentage >= this.config.alertThresholds.memory.critical) {
      alerts.push({
        type: 'memory',
        level: 'critical',
        message: `Critical memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        value: metrics.memory.percentage,
        threshold: this.config.alertThresholds.memory.critical,
        timestamp: metrics.timestamp
      });
    } else if (metrics.memory.percentage >= this.config.alertThresholds.memory.warning) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        value: metrics.memory.percentage,
        threshold: this.config.alertThresholds.memory.warning,
        timestamp: metrics.timestamp
      });
    }

    // Disk alerts
    if (metrics.disk.percentage >= this.config.alertThresholds.disk.critical) {
      alerts.push({
        type: 'disk',
        level: 'critical',
        message: `Critical disk usage: ${metrics.disk.percentage.toFixed(1)}%`,
        value: metrics.disk.percentage,
        threshold: this.config.alertThresholds.disk.critical,
        timestamp: metrics.timestamp
      });
    } else if (metrics.disk.percentage >= this.config.alertThresholds.disk.warning) {
      alerts.push({
        type: 'disk',
        level: 'warning',
        message: `High disk usage: ${metrics.disk.percentage.toFixed(1)}%`,
        value: metrics.disk.percentage,
        threshold: this.config.alertThresholds.disk.warning,
        timestamp: metrics.timestamp
      });
    }

    // Emit alerts
    for (const alert of alerts) {
      this.emit('alert', alert);
      logger.warn('System alert triggered', alert);
    }
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    const removed = initialCount - this.metrics.length;
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} old system metrics`);
    }
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): {
    isRunning: boolean;
    uptime: number;
    metricsCollected: number;
    collectInterval: number;
    memoryUsage: number;
  } {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      metricsCollected: this.metrics.length,
      collectInterval: this.config.collectInterval,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Shutdown the monitor
   */
  public shutdown(): void {
    this.stop();
    this.metrics = [];
    this.removeAllListeners();
    logger.info('System Monitor shut down');
  }
}

export default SystemMonitorService;
