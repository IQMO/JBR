/**
 * SMA Signal Processor with Fixes
 * 
 * This is an improved version of the SMA Signal Processor that fixes issues
 * with signal generation and confidence calculation.
 */

import { calculateSMA, calculateEMA, getMASignals } from '../../indicators';
import type { Candle, TradeSignal } from '../../target-reacher/interfaces';

import type { SMASignalConfig, SMASignalOutput } from './models';

export class ImprovedSMASignalProcessor {
  private config: SMASignalConfig;
  
  constructor(config?: Partial<SMASignalConfig>) {
    // Default configuration
    this.config = {
      fastPeriod: 9,
      slowPeriod: 21,
      minChangePercent: 0.5,
      confidenceThreshold: 0.4, // Lower threshold to generate more signals
      priceSource: 'close',
      signalMode: 'crossover', 
      useEMA: false,
      ...config
    };
    
    this.validateConfig();
  }
  
  /**
   * Validate configuration parameters
   */
  private validateConfig() {
    const { fastPeriod, slowPeriod } = this.config;
    
    if (fastPeriod >= slowPeriod) {
      throw new Error('Fast period must be less than slow period');
    }
    
    if (fastPeriod < 2) {
      throw new Error('Fast period must be at least 2');
    }
    
    if (slowPeriod < 3) {
      throw new Error('Slow period must be at least 3');
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SMASignalConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    this.validateConfig();
  }
  
  /**
   * Get current configuration
   */
  getConfig(): SMASignalConfig {
    return { ...this.config };
  }
  
  /**
   * Process candle data and generate SMA signals
   * 
   * @param candles Array of candle data
   * @returns Signal output or null if no signal
   */
  process(candles: Candle[]): SMASignalOutput | null {
    if (candles.length < this.config.slowPeriod + 1) {
      console.warn(`Insufficient data for SMA signal processing. Need at least ${this.config.slowPeriod + 1} candles.`);
      return null;
    }
    
    // Extract price data from candles based on configured source
    const prices = candles.map(candle => candle[this.config.priceSource]);
    
    // Calculate moving averages
    const calculateMA = this.config.useEMA ? calculateEMA : calculateSMA;
    let fastMA: number[];
    let slowMA: number[];
    
    try {
      fastMA = calculateMA(prices, this.config.fastPeriod);
      slowMA = calculateMA(prices, this.config.slowPeriod);
    } catch (error) {
      console.error('Error calculating moving averages:', error);
      return null;
    }
    
    // Ensure we have enough data points after calculation
    if (fastMA.length === 0 || slowMA.length === 0) {
      return null;
    }
    
    // Get latest values
    const lastPrice = prices[prices.length - 1];
    const lastFastMA = fastMA[fastMA.length - 1];
    const lastSlowMA = slowMA[slowMA.length - 1];
    
    // Generate signal based on configuration
    const lastCandle = candles[candles.length - 1];
    const timestamp = lastCandle ? lastCandle.timestamp : Date.now();
    
    // Adjust arrays to same length for signal generation
    // Fast MA will have more values than slow MA due to different periods
    const adjustedFastMA = fastMA.slice(fastMA.length - slowMA.length);
    
    return this.generateSignal(prices, adjustedFastMA, slowMA, timestamp);
  }
  
  /**
   * Generate trading signal based on MA values - FIXED VERSION
   */
  private generateSignal(prices: number[], fastMA: number[], slowMA: number[], timestamp: number): SMASignalOutput | null {
    // Ensure arrays are not empty and have data
    if (!prices.length || !fastMA.length || !slowMA.length) {
      return null;
    }
    
    // Ensure arrays are the same length
    if (fastMA.length !== slowMA.length || !fastMA.length) {
      console.warn('Moving average arrays must be of the same length for signal generation');
      return null;
    }
    
    // Get crossover signals 
    const crossoverSignals = getMASignals(fastMA, slowMA);
    
    // Last values with null checks
    const lastPrice = prices[prices.length - 1];
    const lastFastMA = fastMA[fastMA.length - 1];
    const lastSlowMA = slowMA[slowMA.length - 1];
    const lastCrossoverSignal = crossoverSignals[crossoverSignals.length - 1] || 0;
    
    if (lastPrice === undefined || lastFastMA === undefined || lastSlowMA === undefined) {
      return null;
    }
    
    let signal = 0;
    let reason = 'No signal detected';
    let confidence = 0;
    
    // Calculate strength based on price distance from MA
    const priceDistance = Math.abs((lastPrice - lastSlowMA) / lastSlowMA) * 100;
    const strength = Math.min(priceDistance / 3, 1); // Normalize to 0-1, more sensitive
    
    // FIX: More sensitive confidence calculation
    // Calculate confidence based on the distance between MAs as percentage of price
    const maDistance = Math.abs(lastFastMA - lastSlowMA) / lastPrice * 100;
    confidence = Math.min(maDistance * 5, 1); // Scale up to get more reasonable values
    
    // Determine signal based on mode
    if (this.config.signalMode === 'crossover' || this.config.signalMode === 'combined') {
      // Check if we have a crossover signal
      if (lastCrossoverSignal !== 0) {
        signal = lastCrossoverSignal;
        
        if (signal > 0) {
          reason = `Bullish crossover: Fast MA (${lastFastMA.toFixed(2)}) crossed above Slow MA (${lastSlowMA.toFixed(2)})`;
        } else {
          reason = `Bearish crossover: Fast MA (${lastFastMA.toFixed(2)}) crossed below Slow MA (${lastSlowMA.toFixed(2)})`;
        }
      }
    }
    
    // Check trend if mode is trend or combined
    if ((this.config.signalMode === 'trend' || this.config.signalMode === 'combined') && signal === 0) {
      // Check the slope of fast MA (using last 3 points)
      const fastMASlope = fastMA.length >= 3 ? 
        ((fastMA[fastMA.length - 1] || 0) - (fastMA[fastMA.length - 3] || 0)) / 2 : 0;
      
      // Price is above both MAs and fast MA is rising = strong bullish
      if (lastPrice > lastFastMA && lastPrice > lastSlowMA && fastMASlope > 0) {
        signal = 1;
        reason = `Strong bullish trend: Price (${lastPrice.toFixed(2)}) above both MAs with rising Fast MA`;
        confidence = Math.min(0.8, strength); // Cap at 0.8 since it's not a crossover
      } 
      // Price is below both MAs and fast MA is falling = strong bearish
      else if (lastPrice < lastFastMA && lastPrice < lastSlowMA && fastMASlope < 0) {
        signal = -1;
        reason = `Strong bearish trend: Price (${lastPrice.toFixed(2)}) below both MAs with falling Fast MA`;
        confidence = Math.min(0.8, strength); // Cap at 0.8 since it's not a crossover
      }
    }
    
    // Return null if confidence threshold not met
    const threshold = this.config.confidenceThreshold || 0.6;
    if (confidence < threshold) {
      return null;
    }
    
    // Return signal output
    return {
      signal,
      confidence,
      lastPrice,
      fastMA: lastFastMA,
      slowMA: lastSlowMA,
      reason,
      strength,
      timestamp,
      metadata: {
        fastPeriod: this.config.fastPeriod,
        slowPeriod: this.config.slowPeriod,
        useEMA: this.config.useEMA
      }
    };
  }
  
  /**
   * Create a trade signal from the SMA signal output
   */
  createTradeSignal(output: SMASignalOutput, botId: string, symbol: string): TradeSignal {
    return {
      id: `sma-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      botId,
      symbol,
      side: output.signal > 0 ? 'buy' : 'sell',
      confidence: output.confidence,
      price: output.lastPrice,
      timestamp: output.timestamp,
      reason: output.reason
    };
  }
  
  /**
   * Get default SMA configuration
   */
  static getDefaultConfig(): SMASignalConfig {
    return {
      fastPeriod: 9,
      slowPeriod: 21,
      minChangePercent: 0.5,
      confidenceThreshold: 0.4, // Lower default threshold
      priceSource: 'close',
      signalMode: 'crossover',
      useEMA: false
    };
  }
}
