#!/usr/bin/env node

/**
 * Performance Analysis Script
 * 
 * Runs comprehensive performance tests and analysis on the trading bot platform
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { performanceProfiler } from '../../src/utils/performance-profiler';
import SystemMonitorService from '../../src/services/system-monitor.service';

// Import key components for testing
import { IndicatorService } from '../../src/services/indicator.service';

interface PerformanceTestSuite {
  name: string;
  description: string;
  tests: PerformanceTest[];
}

interface PerformanceTest {
  name: string;
  category: 'api' | 'database' | 'strategy' | 'websocket' | 'calculation' | 'other';
  testFunction: () => Promise<any>;
  iterations?: number;
  warmupIterations?: number;
}

class PerformanceAnalyzer {
  private systemMonitor: SystemMonitorService;
  private testResults: any[] = [];

  constructor() {
    this.systemMonitor = new SystemMonitorService({
      collectInterval: 1000, // 1 second for detailed monitoring
      enableAlerts: true
    });
  }

  /**
   * Run all performance tests
   */
  async runAnalysis(): Promise<void> {
    console.log('🚀 Starting Performance Analysis...\n');
    
    // Start system monitoring
    this.systemMonitor.start();
    
    try {
      // Define test suites
      const testSuites: PerformanceTestSuite[] = [
        this.createCalculationTests(),
        this.createIndicatorTests(),
        this.createSignalProcessingTests(),
        this.createMemoryTests()
      ];

      // Run each test suite
      for (const suite of testSuites) {
        await this.runTestSuite(suite);
      }

      // Generate comprehensive report
      await this.generateReport();

    } finally {
      this.systemMonitor.stop();
    }
  }

  /**
   * Create calculation performance tests
   */
  private createCalculationTests(): PerformanceTestSuite {
    return {
      name: 'Mathematical Calculations',
      description: 'Tests performance of mathematical operations used in trading algorithms',
      tests: [
        {
          name: 'Simple Moving Average Calculation',
          category: 'calculation',
          testFunction: async () => {
            const data = Array.from({ length: 1000 }, (_, i) => i + Math.random());
            const period = 20;
            
            // Calculate SMA
            const sma: number[] = [];
            for (let i = period - 1; i < data.length; i++) {
              const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
              sma.push(sum / period);
            }
            
            return sma.length;
          },
          iterations: 1000
        },
        {
          name: 'Exponential Moving Average Calculation',
          category: 'calculation',
          testFunction: async () => {
            const data = Array.from({ length: 1000 }, (_, i) => i + Math.random());
            const period = 20;
            const multiplier = 2 / (period + 1);
            
            // Calculate EMA
            let ema = data[0];
            for (let i = 1; i < data.length; i++) {
              ema = (data[i] * multiplier) + (ema * (1 - multiplier));
            }
            
            return ema;
          },
          iterations: 1000
        },
        {
          name: 'RSI Calculation',
          category: 'calculation',
          testFunction: async () => {
            const prices = Array.from({ length: 100 }, () => 100 + Math.random() * 50);
            const period = 14;
            
            // Calculate price changes
            const changes = prices.slice(1).map((price, i) => price - prices[i]);
            
            // Separate gains and losses
            const gains = changes.map(change => change > 0 ? change : 0);
            const losses = changes.map(change => change < 0 ? -change : 0);
            
            // Calculate average gain and loss
            const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
            const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;
            
            // Calculate RS and RSI
            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            
            return rsi;
          },
          iterations: 500
        },
        {
          name: 'Large Array Processing',
          category: 'calculation',
          testFunction: async () => {
            const size = 100000;
            const data = Array.from({ length: size }, (_, i) => Math.random() * 100);
            
            // Perform multiple operations
            const filtered = data.filter(x => x > 50);
            const mapped = filtered.map(x => x * 2);
            const reduced = mapped.reduce((sum, x) => sum + x, 0);
            
            return reduced;
          },
          iterations: 100
        }
      ]
    };
  }

  /**
   * Create indicator service tests
   */
  private createIndicatorTests(): PerformanceTestSuite {
    return {
      name: 'Indicator Service Performance',
      description: 'Tests performance of the indicator calculation service',
      tests: [
        {
          name: 'Multiple Indicator Calculations',
          category: 'calculation',
          testFunction: async () => {
            const indicatorService = new IndicatorService();
            const prices = Array.from({ length: 200 }, () => ({
              timestamp: Date.now(),
              open: 100 + Math.random() * 10,
              high: 105 + Math.random() * 10,
              low: 95 + Math.random() * 10,
              close: 100 + Math.random() * 10,
              volume: 1000 + Math.random() * 500
            }));

            // Calculate multiple indicators
            const sma20 = indicatorService.calculateSMA(prices.map(p => p.close), 20);
            const sma50 = indicatorService.calculateSMA(prices.map(p => p.close), 50);
            const ema12 = indicatorService.calculateEMA(prices.map(p => p.close), 12);
            const rsi = indicatorService.calculateRSI(prices.map(p => p.close), 14);

            return { sma20: sma20.length, sma50: sma50.length, ema12: ema12.length, rsi: rsi.length };
          },
          iterations: 200
        }
      ]
    };
  }

  /**
   * Create signal processing tests
   */
  private createSignalProcessingTests(): PerformanceTestSuite {
    return {
      name: 'Signal Processing Performance',
      description: 'Tests performance of signal processing algorithms',
      tests: [
        {
          name: 'SMA Signal Generation',
          category: 'calculation',
          testFunction: async () => {
            const prices = Array.from({ length: 500 }, () => Math.random() * 100);
            const signals = [];
            
            for (let i = 20; i < prices.length; i++) {
              const sma20 = prices.slice(i - 20, i).reduce((a, b) => a + b) / 20;
              const sma50 = i >= 50 ? prices.slice(i - 50, i).reduce((a, b) => a + b) / 50 : 0;
              
              if (sma20 > sma50) {
                signals.push('BUY');
              } else if (sma20 < sma50) {
                signals.push('SELL');
              }
            }
            
            return signals.length;
          },
          iterations: 100
        }
      ]
    };
  }

  /**
   * Create memory usage tests
   */
  private createMemoryTests(): PerformanceTestSuite {
    return {
      name: 'Memory Usage Tests',
      description: 'Tests memory usage and garbage collection performance',
      tests: [
        {
          name: 'Large Array Processing',
          category: 'other',
          testFunction: async () => {
            const initialMemory = process.memoryUsage();
            const data = Array.from({ length: 100000 }, () => Math.random());
            const processed = data.map(x => x * 2).filter(x => x > 1);
            const finalMemory = process.memoryUsage();
            
            return {
              processed: processed.length,
              memoryDelta: finalMemory.heapUsed - initialMemory.heapUsed
            };
          },
          iterations: 10
        }
      ]
    };
  }

  /**
   * Run a test suite
   */
  private async runTestSuite(suite: PerformanceTestSuite): Promise<void> {
    console.log(`\n📊 Running ${suite.name}`);
    console.log(`   ${suite.description}\n`);

    for (const test of suite.tests) {
      await this.runTest(test);
    }
  }

  /**
   * Run an individual test
   */
  private async runTest(test: PerformanceTest): Promise<void> {
    const iterations = test.iterations || 100;
    const warmupIterations = test.warmupIterations || 10;
    
    console.log(`   🧪 ${test.name}`);
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await test.testFunction();
    }
    
    // Actual test
    const startTime = performanceProfiler.now();
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const testStart = performanceProfiler.now();
      const result = await test.testFunction();
      const testEnd = performanceProfiler.now();
      
      results.push({
        duration: testEnd - testStart,
        result
      });
    }
    
    const endTime = performanceProfiler.now();
    const totalDuration = endTime - startTime;
    const avgDuration = totalDuration / iterations;
    
    this.testResults.push({
      suiteName: test.category,
      testName: test.name,
      iterations,
      totalDuration,
      avgDuration,
      minDuration: Math.min(...results.map(r => r.duration)),
      maxDuration: Math.max(...results.map(r => r.duration)),
      results
    });
    
    console.log(`      ⏱️  Average: ${avgDuration.toFixed(2)}ms`);
    console.log(`      📈 Total: ${totalDuration.toFixed(2)}ms`);
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(): Promise<void> {
    console.log('\n📊 Generating Performance Report...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        memory: process.memoryUsage()
      },
      testResults: this.testResults,
      summary: this.generateSummary()
    };
    
    // Save report
    const reportPath = path.join(__dirname, '../../reports/performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Performance report saved to: ${reportPath}`);
    console.log('\n📊 Performance Summary:');
    console.log(this.generateSummary());
  }

  /**
   * Generate performance summary
   */
  private generateSummary(): any {
    const categories = {};
    
    for (const result of this.testResults) {
      if (!categories[result.suiteName]) {
        categories[result.suiteName] = {
          testCount: 0,
          totalAvgDuration: 0,
          tests: []
        };
      }
      
      categories[result.suiteName].testCount++;
      categories[result.suiteName].totalAvgDuration += result.avgDuration;
      categories[result.suiteName].tests.push({
        name: result.testName,
        avgDuration: result.avgDuration,
        iterations: result.iterations
      });
    }
    
    return categories;
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer();
  analyzer.runAnalysis().catch(console.error);
}

export default PerformanceAnalyzer;
