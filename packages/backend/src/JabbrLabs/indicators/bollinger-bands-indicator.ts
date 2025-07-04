/**
 * Bollinger Bands Indicator Class
 * 
 * Class-based implementation of Bollinger Bands indicator conforming to the unified interface
 */

import type { BollingerBandsResult } from './bollinger-bands';
import { calculateBollingerBands } from './bollinger-bands';
import type { IndicatorMetadata } from './indicator-interface';
import { BaseIndicator } from './indicator-interface';

/**
 * Bollinger Bands Indicator Class
 */
export class BollingerBandsIndicator extends BaseIndicator<BollingerBandsResult> {
  constructor(parameters: Record<string, unknown> = {}) {
    const metadata: IndicatorMetadata = {
      name: 'Bollinger Bands',
      description: 'Bollinger Bands - volatility indicator with upper and lower bands around a moving average',
      category: 'volatility',
      parameters: [
        {
          name: 'period',
          type: 'number',
          description: 'Period for SMA calculation',
          default: 20,
          min: 2,
          max: 100,
          required: false
        },
        {
          name: 'multiplier',
          type: 'number',
          description: 'Standard deviation multiplier',
          default: 2,
          min: 0.1,
          max: 5,
          required: false
        }
      ],
      outputs: [
        {
          name: 'upper',
          type: 'array',
          description: 'Upper band values'
        },
        {
          name: 'middle',
          type: 'array',
          description: 'Middle band (SMA) values'
        },
        {
          name: 'lower',
          type: 'array',
          description: 'Lower band values'
        },
        {
          name: 'bandwidth',
          type: 'array',
          description: 'Bandwidth values'
        },
        {
          name: 'percentB',
          type: 'array',
          description: 'Percent B values'
        }
      ],
      minimumDataPoints: 20, // Default period
      version: '1.0.0'
    };
    
    super(metadata, parameters);
  }
  
  calculate(data: number[]): BollingerBandsResult {
    const validData = this.validateNumericArray(data);
    
    const period = this.getNumericParameter('period', 20);
    const multiplier = this.getNumericParameter('multiplier', 2);
    
    this.validateDataLength(validData, period);
    
    return calculateBollingerBands(validData, period, multiplier);
  }
  
  clone(): BollingerBandsIndicator {
    return new BollingerBandsIndicator(this.getParameters());
  }
  
  /**
   * Get the latest Bollinger Bands signal
   * 
   * @param data Input price data
   * @returns Signal value (1 for buy signal, -1 for sell signal, 0 for no signal)
   */
  getLatestSignal(data: number[]): number {
    const result = this.calculate(data);
    const { upper, lower } = result;
    
    if (data.length < 2 || upper.length < 2 || lower.length < 2) {
      return 0;
    }
    
    const currentPrice = data[data.length - 1];
    const prevPrice = data[data.length - 2];
    const currentUpper = upper[upper.length - 1];
    const prevUpper = upper[upper.length - 2];
    const currentLower = lower[lower.length - 1];
    const prevLower = lower[lower.length - 2];
    
    if (currentPrice === undefined || prevPrice === undefined ||
        currentUpper === undefined || prevUpper === undefined ||
        currentLower === undefined || prevLower === undefined) {
      return 0;
    }
    
    // Price crosses below lower band - potential buy signal
    if (currentPrice < currentLower && prevPrice >= prevLower) {
      return 1;
    }
    
    // Price crosses above upper band - potential sell signal
    if (currentPrice > currentUpper && prevPrice <= prevUpper) {
      return -1;
    }
    
    return 0;
  }
  
  /**
   * Get current position relative to bands
   * 
   * @param data Input price data
   * @returns Position (-1 to 1, where -1 is at lower band, 0 is at middle, 1 is at upper band)
   */
  getPosition(data: number[]): number {
    const result = this.calculate(data);
    const { upper, lower } = result;
    
    if (data.length === 0 || upper.length === 0 || lower.length === 0) {
      return 0;
    }
    
    const currentPrice = data[data.length - 1];
    const currentUpper = upper[upper.length - 1];
    const currentLower = lower[lower.length - 1];
    
    if (currentPrice === undefined || currentUpper === undefined || currentLower === undefined) {
      return 0;
    }
    
    const bandWidth = currentUpper - currentLower;
    if (bandWidth === 0) {
      return 0;
    }
    
    // Calculate position within bands
    const position = (currentPrice - currentLower) / bandWidth;
    
    // Scale to -1 to 1 range
    return position * 2 - 1;
  }
  
  /**
   * Check if price is in squeeze condition (low volatility)
   * 
   * @param data Input price data
   * @param lookbackPeriod Period to compare bandwidth against
   * @returns True if in squeeze condition
   */
  isSqueeze(data: number[], lookbackPeriod = 20): boolean {
    const result = this.calculate(data);
    const { bandwidth } = result;
    
    if (bandwidth.length < lookbackPeriod) {
      return false;
    }
    
    const currentBandwidth = bandwidth[bandwidth.length - 1];
    if (currentBandwidth === undefined) {
      return false;
    }
    
    // Compare current bandwidth to recent average
    const recentBandwidth = bandwidth.slice(-lookbackPeriod);
    const avgBandwidth = recentBandwidth.reduce((sum, val) => sum + val, 0) / recentBandwidth.length;
    
    // Squeeze if current bandwidth is significantly lower than recent average
    return currentBandwidth < avgBandwidth * 0.8;
  }
  
  /**
   * Get %B value (position within bands as percentage)
   * 
   * @param data Input price data
   * @returns %B value (0 to 1, where 0 is at lower band, 1 is at upper band)
   */
  getPercentB(data: number[]): number {
    const result = this.calculate(data);
    const { percentB } = result;
    
    if (percentB.length === 0) {
      return 0.5; // Default to middle
    }
    
    const latestPercentB = percentB[percentB.length - 1];
    return latestPercentB !== undefined ? latestPercentB : 0.5;
  }
  
  /**
   * Check if bands are expanding (increasing volatility)
   * 
   * @param data Input price data
   * @param periods Number of periods to compare
   * @returns True if bands are expanding
   */
  isExpanding(data: number[], periods = 3): boolean {
    const result = this.calculate(data);
    const { bandwidth } = result;
    
    if (bandwidth.length < periods + 1) {
      return false;
    }
    
    const recentBandwidth = bandwidth.slice(-periods - 1);
    
    // Check if bandwidth is generally increasing
    for (let i = 1; i < recentBandwidth.length; i++) {
      const current = recentBandwidth.at(i);
      const previous = recentBandwidth.at(i - 1);
      if (current === undefined || previous === undefined || current <= previous) {
        return false;
      }
    }
    
    return true;
  }
}
