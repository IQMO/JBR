/**
 * Fixed SMA Crossover Strategy Backtesting Script
 * 
 * This script implements a fixed version of the SMA crossover strategy
 * and runs a backtesting simulation using historical price data.
 */

import fs from 'fs';
import path from 'path';

import { calculateSMA, calculateEMA, getMASignals } from '../../src/JabbrLabs/indicators/moving-averages';
import type { Candle} from '../../src/JabbrLabs/target-reacher/interfaces';
import { StrategyContext } from '../../src/JabbrLabs/target-reacher/interfaces';
import { generateSampleData } from '../../../shared/src/test-utils/data-generators';

/**
 * Fixed SMA Signal Processor that fixes the signal generation issues
 */
class FixedSMASignalProcessor {
  private fastPeriod: number;
  private slowPeriod: number;
  private useEMA: boolean;
  private priceSource: 'close' | 'open' | 'high' | 'low';
  
  constructor() {
    this.fastPeriod = 5;  // Faster period for more signals
    this.slowPeriod = 15; // Shorter slow period for more signals
    this.useEMA = true;   // EMA is more responsive than SMA
    this.priceSource = 'close';
  }
  
  process(candles: Candle[]): { signal: number; reason: string; confidence: number } | null {
    // Ensure we have enough candles
    if (candles.length < this.slowPeriod + 1) {
      return null;
    }
    
    // Get prices
    const prices = candles.map(c => c[this.priceSource]);
    
    // Calculate moving averages
    const calculateMA = this.useEMA ? calculateEMA : calculateSMA;
    const fastMA = calculateMA(prices, this.fastPeriod);
    const slowMA = calculateMA(prices, this.slowPeriod);
    
    // Calculate crossovers
    const lastFast = fastMA[fastMA.length - 1];
    const prevFast = fastMA[fastMA.length - 2];
    const lastSlow = slowMA[slowMA.length - 1];
    const prevSlow = slowMA[slowMA.length - 2];
    
    // Safety checks
    if (lastFast === undefined || prevFast === undefined || 
        lastSlow === undefined || prevSlow === undefined ||
        prices.length === 0) {
      return null;
    }
    
    const lastPrice = prices[prices.length - 1];
    if (lastPrice === undefined) {
      return null;
    }
    
    // Logging for debugging
    console.log(`Price: ${lastPrice.toFixed(2)}`);
    console.log(`Fast MA: ${lastFast.toFixed(2)} (prev: ${prevFast.toFixed(2)})`);
    console.log(`Slow MA: ${lastSlow.toFixed(2)} (prev: ${prevSlow.toFixed(2)})`);
    
    // Check for crossover - directly without using getMASignals
    if (lastFast > lastSlow && prevFast <= prevSlow) {
      // Bullish crossover
      return {
        signal: 1,
        reason: 'Bullish crossover detected',
        confidence: 0.8
      };
    } else if (lastFast < lastSlow && prevFast >= prevSlow) {
      // Bearish crossover
      return {
        signal: -1,
        reason: 'Bearish crossover detected',
        confidence: 0.8
      };
    } else if (Math.abs(lastFast - lastSlow) / lastFast < 0.01) {
      // MAs are very close - potential crossover soon
      if (lastFast > prevFast && lastSlow < prevSlow) {
        return {
          signal: 0.5, // Weak bullish signal
          reason: 'MAs converging with bullish bias',
          confidence: 0.6
        };
      } else if (lastFast < prevFast && lastSlow > prevSlow) {
        return {
          signal: -0.5, // Weak bearish signal
          reason: 'MAs converging with bearish bias',
          confidence: 0.6
        };
      }
    }
    
    return null;
  }
}

/**
 * Fixed backtest function
 */
const runFixedBacktest = () => {
  console.log('\n----- RUNNING FIXED SMA CROSSOVER BACKTEST -----');
  
  // Generate sample price data with clear trends for testing
  const candles = generateSampleData();
  console.log(`Generated ${candles.length} sample candles`);
  
  // Create the fixed signal processor
  const processor = new FixedSMASignalProcessor();
  
  // Trading state
  let position: 'long' | 'short' | null = null;
  let entryPrice = 0;
  let totalProfit = 0;
  let trades = 0;
  
  // Process candles with sliding window
  const windowSize = 30; // Enough data for calculations
  
  console.log('\nProcessing price data...');
  for (let i = windowSize; i < candles.length; i++) {
    // Get current window
    const window = candles.slice(i - windowSize, i + 1);
    
    // Safety check
    if (window.length === 0) {
      continue;
    }
    
    const lastCandle = window[window.length - 1];
    if (!lastCandle) {
      continue;
    }
    
    const currentPrice = lastCandle.close;
    console.log(`\nWindow ${i}: Price ${currentPrice.toFixed(2)}`);
    
    // Process signal
    const result = processor.process(window);
    
    // Track position and calculate P&L
    if (result) {
      if (result.signal > 0.7) { // Strong buy signal
        if (position === 'short') {
          // Close short position
          const profit = entryPrice - currentPrice;
          totalProfit += profit;
          console.log(`Close SHORT position at ${currentPrice.toFixed(2)}, profit: ${profit.toFixed(2)}`);
          position = null;
          trades++;
        }
        
        if (!position) {
          // Open long position
          position = 'long';
          entryPrice = currentPrice;
          console.log(`Open LONG position at ${currentPrice.toFixed(2)}`);
          trades++;
        }
      } else if (result.signal < -0.7) { // Strong sell signal
        if (position === 'long') {
          // Close long position
          const profit = currentPrice - entryPrice;
          totalProfit += profit;
          console.log(`Close LONG position at ${currentPrice.toFixed(2)}, profit: ${profit.toFixed(2)}`);
          position = null;
          trades++;
        }
        
        if (!position) {
          // Open short position
          position = 'short';
          entryPrice = currentPrice;
          console.log(`Open SHORT position at ${currentPrice.toFixed(2)}`);
          trades++;
        }
      }
    }
  }
  
  // Close any open position
  if (position && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      const lastPrice = lastCandle.close;
      const profit = position === 'long' ? 
        (lastPrice - entryPrice) : (entryPrice - lastPrice);
      totalProfit += profit;
      console.log(`Close final ${position} position at ${lastPrice.toFixed(2)}, profit: ${profit.toFixed(2)}`);
    }
  }
  
  // Print results
  console.log('\n----- BACKTEST RESULTS -----');
  console.log(`Total trades: ${trades}`);
  console.log(`Total profit: ${totalProfit.toFixed(2)}`);
  console.log(`Final position: ${position || 'none'}`);
  console.log('---------------------------\n');
};

// Run the backtest
runFixedBacktest();
