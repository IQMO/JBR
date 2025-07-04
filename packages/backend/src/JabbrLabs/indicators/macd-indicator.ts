/**
 * MACD (Moving Average Convergence Divergence) Indicator Class
 * 
 * Class-based implementation of MACD indicator conforming to the unified interface
 */

import type { IndicatorMetadata } from './indicator-interface';
import { BaseIndicator } from './indicator-interface';
import type { MACDResult } from './macd';
import { calculateMACD } from './macd';

/**
 * MACD Indicator Class
 */
export class MACDIndicator extends BaseIndicator<MACDResult> {
  constructor(parameters: Record<string, unknown> = {}) {
    const metadata: IndicatorMetadata = {
      name: 'MACD',
      description: 'Moving Average Convergence Divergence - trend-following momentum indicator',
      category: 'momentum',
      parameters: [
        {
          name: 'fastPeriod',
          type: 'number',
          description: 'Fast EMA period',
          default: 12,
          min: 1,
          max: 100,
          required: false
        },
        {
          name: 'slowPeriod',
          type: 'number',
          description: 'Slow EMA period',
          default: 26,
          min: 1,
          max: 200,
          required: false
        },
        {
          name: 'signalPeriod',
          type: 'number',
          description: 'Signal EMA period',
          default: 9,
          min: 1,
          max: 100,
          required: false
        }
      ],
      outputs: [
        {
          name: 'macd',
          type: 'array',
          description: 'MACD line values'
        },
        {
          name: 'signal',
          type: 'array',
          description: 'Signal line values'
        },
        {
          name: 'histogram',
          type: 'array',
          description: 'Histogram values (MACD - Signal)'
        }
      ],
      minimumDataPoints: 34, // Default: 26 + 9 - 1
      version: '1.0.0'
    };
    
    super(metadata, parameters);
  }
  
  calculate(data: number[]): MACDResult {
    const validData = this.validateNumericArray(data);
    
    const fastPeriod = this.getNumericParameter('fastPeriod', 12);
    const slowPeriod = this.getNumericParameter('slowPeriod', 26);
    const signalPeriod = this.getNumericParameter('signalPeriod', 9);
    
    // Update minimum data points based on actual parameters
    const minDataPoints = Math.max(fastPeriod, slowPeriod) + signalPeriod;
    this.validateDataLength(validData, minDataPoints);
    
    return calculateMACD(validData, fastPeriod, slowPeriod, signalPeriod);
  }
  
  clone(): MACDIndicator {
    return new MACDIndicator(this.getParameters());
  }
  
  /**
   * Get the latest MACD signal (crossover detection)
   * 
   * @param data Input price data
   * @returns Latest signal value (1 for bullish, -1 for bearish, 0 for no signal)
   */
  getLatestSignal(data: number[]): number {
    const result = this.calculate(data);
    const { macd, signal } = result;
    
    if (macd.length < 2 || signal.length < 2) {
      return 0;
    }
    
    const latestMacd = macd[macd.length - 1];
    const prevMacd = macd[macd.length - 2];
    const latestSignal = signal[signal.length - 1];
    const prevSignal = signal[signal.length - 2];
    
    if (latestMacd === undefined || prevMacd === undefined || 
        latestSignal === undefined || prevSignal === undefined) {
      return 0;
    }
    
    // Bullish crossover: MACD crosses above signal
    if (latestMacd > latestSignal && prevMacd <= prevSignal) {
      return 1;
    }
    
    // Bearish crossover: MACD crosses below signal
    if (latestMacd < latestSignal && prevMacd >= prevSignal) {
      return -1;
    }
    
    return 0;
  }
  
  /**
   * Check if MACD is currently bullish (above signal line)
   * 
   * @param data Input price data
   * @returns True if MACD is above signal line
   */
  isBullish(data: number[]): boolean {
    const result = this.calculate(data);
    const { macd, signal } = result;
    
    if (macd.length === 0 || signal.length === 0) {
      return false;
    }
    
    const latestMacd = macd[macd.length - 1];
    const latestSignal = signal[signal.length - 1];
    
    if (latestMacd === undefined || latestSignal === undefined) {
      return false;
    }
    
    return latestMacd > latestSignal;
  }
  
  /**
   * Get MACD divergence strength (normalized histogram value)
   * 
   * @param data Input price data
   * @returns Divergence strength (-1 to 1)
   */
  getDivergenceStrength(data: number[]): number {
    const result = this.calculate(data);
    const { histogram } = result;
    
    if (histogram.length === 0) {
      return 0;
    }
    
    const latestHistogram = histogram[histogram.length - 1];
    
    if (latestHistogram === undefined) {
      return 0;
    }
    
    // Normalize based on recent histogram range
    const recentHistogram = histogram.slice(-20); // Last 20 values
    const maxHist = Math.max(...recentHistogram);
    const minHist = Math.min(...recentHistogram);
    const range = maxHist - minHist;
    
    if (range === 0) {
      return 0;
    }
    
    return (latestHistogram - minHist) / range * 2 - 1; // Scale to -1 to 1
  }
}
