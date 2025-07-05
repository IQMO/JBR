/**
 * SMA Signal Processor
 * 
 * Processes price data using Simple Moving Averages (SMA) to generate
 * buy/sell signals based on crossovers and trend analysis.
 */

import { calculateSMA, calculateEMA, getMASignals } from '../../indicators';
import type { Candle, TradeSignal } from '../../target-reacher/interfaces';

import type { SMASignalConfig, SMASignalOutput } from './models';

export class SMASignalProcessor {
  private config: SMASignalConfig;
  
  constructor(config?: Partial<SMASignalConfig>) {
    // Default configuration
    this.config = {
      fastPeriod: 9,
      slowPeriod: 21,
      minChangePercent: 0.5,
      confidenceThreshold: 0.4, // Updated default threshold to match test expectations
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
    
    // Get latest values (commented out temporarily for development)
    // const _lastPrice = prices[prices.length - 1]; // Reserved for future use
    // const _lastFastMA = fastMA[fastMA.length - 1]; // Reserved for future use
    // const _lastSlowMA = slowMA[slowMA.length - 1]; // Reserved for future use
    
    // Generate signal based on configuration
    const lastCandle = candles[candles.length - 1];
    const timestamp = lastCandle ? lastCandle.timestamp : Date.now();
    
    // Adjust arrays to same length for signal generation
    // Fast MA will have more values than slow MA due to different periods
    const adjustedFastMA = fastMA.slice(fastMA.length - slowMA.length);
    
    return this.generateSignal(prices, adjustedFastMA, slowMA, timestamp);
  }
  
  /**
   * Generate trading signal based on MA values
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
    
    // Calculate confidence based on signal strength and trend direction
    const trend = lastFastMA > lastSlowMA ? 1 : -1;
    const priceVsSlowMA = lastPrice > lastSlowMA ? 1 : -1;
    
    // Base confidence on trend alignment and MA separation
    const maSeparationPercent = Math.abs(lastFastMA - lastSlowMA) / lastPrice * 100;
    const trendAlignment = trend === priceVsSlowMA ? 1 : 0.5;
    
    // Calculate base confidence more conservatively
    confidence = Math.min(0.1 + (maSeparationPercent * 10) + (trendAlignment * 0.3), 1);
    
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
        
        // Boost confidence for crossovers
        confidence = Math.max(confidence, 0.7);
      }
    }
    
    // Check trend if mode is trend or combined, or if no crossover signal
    if ((this.config.signalMode === 'trend' || this.config.signalMode === 'combined') || signal === 0) {
      // Only generate trend signals if there's meaningful separation between MAs
      const minSeparationPercent = 0.1; // Minimum 0.1% separation required
      
      if (maSeparationPercent >= minSeparationPercent) {
        if (lastFastMA > lastSlowMA && lastPrice > lastFastMA) {
          // Strong bullish: price above fast MA, fast MA above slow MA
          signal = 1;
          reason = `Strong bullish trend: Price (${lastPrice.toFixed(2)}) above Fast MA (${lastFastMA.toFixed(2)}) above Slow MA (${lastSlowMA.toFixed(2)})`;
          confidence = Math.max(confidence, 0.75);
        } 
        else if (lastFastMA < lastSlowMA && lastPrice < lastFastMA) {
          // Strong bearish: price below fast MA, fast MA below slow MA
          signal = -1;
          reason = `Strong bearish trend: Price (${lastPrice.toFixed(2)}) below Fast MA (${lastFastMA.toFixed(2)}) below Slow MA (${lastSlowMA.toFixed(2)})`;
          confidence = Math.max(confidence, 0.75);
        }
        else if (lastFastMA > lastSlowMA) {
          // Mild bullish: fast MA above slow MA
          signal = 1;
          reason = `Bullish trend: Fast MA (${lastFastMA.toFixed(2)}) above Slow MA (${lastSlowMA.toFixed(2)})`;
          confidence = Math.max(confidence, 0.5);
        }
        else if (lastFastMA < lastSlowMA) {
          // Mild bearish: fast MA below slow MA
          signal = -1;
          reason = `Bearish trend: Fast MA (${lastFastMA.toFixed(2)}) below Slow MA (${lastSlowMA.toFixed(2)})`;
          confidence = Math.max(confidence, 0.5);
        }
      } else {
        // Sideways market - no signal
        reason = `Sideways market: Fast MA (${lastFastMA.toFixed(2)}) and Slow MA (${lastSlowMA.toFixed(2)}) too close`;
        signal = 0;
        confidence = 0.1;
      }
    }
    
    // Check confidence threshold - return null if below threshold
    if (confidence < (this.config.confidenceThreshold || 0.4)) {
      console.log(`Signal confidence ${confidence.toFixed(3)} below threshold ${this.config.confidenceThreshold || 0.4}, no signal generated`);
      return null;
    }
    
    // Return null if no meaningful signal was generated
    if (signal === 0) {
      console.log(`No signal generated: ${reason}`);
      return null;
    }
    
    console.log(`Generated signal: ${signal}, confidence: ${confidence}, reason: ${reason}`);
    
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
      confidenceThreshold: 0.4, // Updated default threshold to match test expectations
      priceSource: 'close',
      signalMode: 'crossover',
      useEMA: false
    };
  }
}
