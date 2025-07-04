/**
 * Performance Profiler Utility
 * 
 * Provides comprehensive performance monitoring and benchmarking capabilities
 * for the trading bot platform.
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';

import logger from '../services/logging.service';

export interface PerformanceMetric {
  name: string;
  duration: number; // milliseconds
  startTime: number;
  endTime: number;
  category: 'api' | 'database' | 'strategy' | 'websocket' | 'calculation' | 'other';
  metadata?: Record<string, any>;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  operationsPerSecond: number;
}

export interface PerformanceReport {
  timestamp: Date;
  totalMetrics: number;
  categories: Record<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    slowestOperation: PerformanceMetric | null;
  }>;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export class PerformanceProfiler extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private activeTimers: Map<string, { startTime: number; category: 'api' | 'database' | 'strategy' | 'websocket' | 'calculation' | 'other'; metadata?: Record<string, any> }> = new Map();
  private observer: PerformanceObserver;
  private isEnabled = true;
  private maxMetricsRetention = 10000; // Keep last 10k metrics

  constructor() {
    super();
    
    // Set up performance observer for automatic monitoring
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('jabbr:')) {
          this.recordMetric({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            endTime: entry.startTime + entry.duration,
            category: this.extractCategoryFromName(entry.name)
          });
        }
      }
    });

    this.observer.observe({ entryTypes: ['measure'] });
    logger.info('Performance Profiler initialized');
  }

  /**
   * Start timing an operation
   */
  public startTimer(name: string, category: 'api' | 'database' | 'strategy' | 'websocket' | 'calculation' | 'other' = 'other', metadata?: Record<string, any>): string {
    if (!this.isEnabled) {return '';}

    const timerKey = `${name}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(timerKey, {
      startTime: performance.now(),
      category,
      metadata
    });

    // Also create a performance mark
    performance.mark(`jabbr:${name}:start`);
    return timerKey;
  }

  /**
   * End timing an operation
   */
  public endTimer(timerKey: string, name: string): PerformanceMetric | null {
    if (!this.isEnabled) {return null;}

    const timer = this.activeTimers.get(timerKey);
    if (!timer) {
      logger.warn(`Timer not found: ${timerKey}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;

    // Create performance measure
    performance.mark(`jabbr:${name}:end`);
    performance.measure(`jabbr:${name}`, `jabbr:${name}:start`, `jabbr:${name}:end`);

    const metric: PerformanceMetric = {
      name,
      duration,
      startTime: timer.startTime,
      endTime,
      category: timer.category,
      metadata: timer.metadata
    };

    this.recordMetric(metric);
    this.activeTimers.delete(timerKey);

    return metric;
  }

  /**
   * Time a function execution
   */
  public async timeFunction<T>(
    name: string,
    fn: () => Promise<T> | T,
    category: 'api' | 'database' | 'strategy' | 'websocket' | 'calculation' | 'other' = 'other',
    metadata?: Record<string, any>
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      
      const metric: PerformanceMetric = {
        name,
        duration: endTime - startTime,
        startTime,
        endTime,
        category,
        metadata
      };

      this.recordMetric(metric);
      
      return { result, metric };
    } catch (error) {
      const endTime = performance.now();
      
      const metric: PerformanceMetric = {
        name: `${name}:error`,
        duration: endTime - startTime,
        startTime,
        endTime,
        category,
        metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) }
      };

      this.recordMetric(metric);
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Maintain metrics retention limit
    if (this.metrics.length > this.maxMetricsRetention) {
      this.metrics = this.metrics.slice(-this.maxMetricsRetention);
    }

    // Emit metric event
    this.emit('metric', metric);

    // Log slow operations
    if (metric.duration > 1000) { // > 1 second
      logger.warn('Slow operation detected', {
        name: metric.name,
        duration: metric.duration,
        category: metric.category
      });
    }
  }

  /**
   * Extract category from performance mark name
   */
  private extractCategoryFromName(name: string): 'api' | 'database' | 'strategy' | 'websocket' | 'calculation' | 'other' {
    if (name.includes('api') || name.includes('request')) {return 'api';}
    if (name.includes('db') || name.includes('database')) {return 'database';}
    if (name.includes('strategy') || name.includes('signal')) {return 'strategy';}
    if (name.includes('websocket') || name.includes('ws')) {return 'websocket';}
    if (name.includes('calc') || name.includes('compute')) {return 'calculation';}
    return 'other';
  }

  /**
   * Run benchmark on a function
   */
  public async benchmark(
    name: string,
    fn: () => Promise<any> | any,
    iterations = 100,
    warmupIterations = 10
  ): Promise<BenchmarkResult> {
    logger.info(`Starting benchmark: ${name} (${iterations} iterations)`);

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Collect garbage before benchmark
    if (global.gc) {
      global.gc();
    }

    const times: number[] = [];
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      await fn();
      const iterationEnd = performance.now();
      times.push(iterationEnd - iterationStart);
    }

    const totalTime = performance.now() - startTime;
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    const operationsPerSecond = 1000 / averageTime;

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      operationsPerSecond
    };

    logger.info('Benchmark completed', result);
    this.emit('benchmark', result);

    return result;
  }

  /**
   * Get performance report
   */
  public getReport(timeWindow?: number): PerformanceReport {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    const relevantMetrics = this.metrics.filter(m => m.startTime >= windowStart);
    
    const categories: Record<string, {
      count: number;
      totalTime: number;
      averageTime: number;
      slowestOperation: PerformanceMetric | null;
    }> = {};

    // Process metrics by category
    for (const metric of relevantMetrics) {
      if (!categories[metric.category]) {
        categories[metric.category] = {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          slowestOperation: null
        };
      }

      const cat = categories[metric.category]!; // Non-null assertion since we just created it
      cat.count++;
      cat.totalTime += metric.duration;
      
      if (!cat.slowestOperation || metric.duration > cat.slowestOperation.duration) {
        cat.slowestOperation = metric;
      }
    }

    // Calculate averages
    for (const cat of Object.values(categories)) {
      cat.averageTime = cat.totalTime / cat.count;
    }

    return {
      timestamp: new Date(),
      totalMetrics: relevantMetrics.length,
      categories,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * Get metrics by category
   */
  public getMetricsByCategory(category: string, limit = 100): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.category === category)
      .slice(-limit);
  }

  /**
   * Get slowest operations
   */
  public getSlowestOperations(limit = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }

  /**
   * Enable/disable profiling
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Performance profiling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get profiler statistics
   */
  public getStats(): {
    isEnabled: boolean;
    totalMetrics: number;
    activeTimers: number;
    memoryUsage: number;
  } {
    return {
      isEnabled: this.isEnabled,
      totalMetrics: this.metrics.length,
      activeTimers: this.activeTimers.size,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Shutdown the profiler
   */
  public shutdown(): void {
    this.observer.disconnect();
    this.activeTimers.clear();
    this.metrics = [];
    this.removeAllListeners();
    logger.info('Performance Profiler shut down');
  }
}

// Export singleton instance
export const performanceProfiler = new PerformanceProfiler();
export default performanceProfiler;
