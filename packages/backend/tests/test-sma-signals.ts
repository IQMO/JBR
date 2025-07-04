/**
 * SMA Signal Testing Script
 * 
 * This script tests SMA signal generation directly to verify the signal processor is working
 * correctly with our synthetic data.
 */

import { SMASignalProcessor } from './src/JabbrLabs/signals/sma/sma-signal-processor';
import type { Candle } from './src/JabbrLabs/target-reacher/interfaces';

// Generate test data
const generateTestData = (length: number): Candle[] => {
  const candles: Candle[] = [];
  let price = 100;
  
  for (let i = 0; i < length; i++) {
    // Create a sine wave pattern with 40 candle cycle
    const cycle1 = Math.sin(i / 40) * 15;  // Primary trend
    const cycle2 = Math.sin(i / 20) * 5;   // Secondary trend
    const noise = (Math.random() - 0.5) * 2; // Random noise
    
    // Calculate price based on cycles and noise
    price = 100 + cycle1 + cycle2 + noise;
    
    const timestamp = Date.now() + i * 60 * 60 * 1000;
    const open = price * (1 + (Math.random() - 0.5) / 100);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() / 100);
    const low = Math.min(open, close) * (1 - Math.random() / 100);
    const volume = 1000 + Math.random() * 9000;
    
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
  }
  
  return candles;
};

// Main test function
const testSMASignals = () => {
  console.log('\n----- SMA SIGNAL TESTING -----');
  
  // Generate test data - 200 candles
  const candles = generateTestData(200);
  console.log(`Generated ${candles.length} test candles`);
  
  // Test different SMA configurations
  testConfig('Standard SMA Crossover', {
    fastPeriod: 9,
    slowPeriod: 21,
    priceSource: 'close',
    signalMode: 'crossover',
    useEMA: false,
    minChangePercent: 0.5,
    confidenceThreshold: 0.5
  }, candles);
  
  testConfig('Fast/Short EMA Crossover', {
    fastPeriod: 5,
    slowPeriod: 15,
    priceSource: 'close',
    signalMode: 'crossover',
    useEMA: true,
    minChangePercent: 0.3,
    confidenceThreshold: 0.4
  }, candles);
  
  testConfig('Combined Signal Mode', {
    fastPeriod: 8,
    slowPeriod: 20,
    priceSource: 'close',
    signalMode: 'combined',
    useEMA: true,
    minChangePercent: 0.3,
    confidenceThreshold: 0.4
  }, candles);
  
  testConfig('Trend Signal Mode', {
    fastPeriod: 8,
    slowPeriod: 20,
    priceSource: 'close',
    signalMode: 'trend',
    useEMA: true,
    minChangePercent: 0.3,
    confidenceThreshold: 0.4
  }, candles);
};

// Test a specific configuration
const testConfig = (name: string, config: any, candles: Candle[]) => {
  console.log(`\n--- Testing ${name} ---`);
  
  try {
    const processor = new SMASignalProcessor(config);
    
    // Process all candles and count signals
    let buys = 0;
    let sells = 0;
    let nosignal = 0;
    
    // Use sliding window to process candles like in real trading
    const windowSize = Math.max(config.slowPeriod * 3, 30); // Enough history for calculations
    
    for (let i = windowSize; i < candles.length; i++) {
      // Get window of candles
      const window = candles.slice(i - windowSize, i);
      
      try {
        const result = processor.process(window);
        
        if (result) {
          if (result.signal > 0) {
            buys++;
            console.log(`[${i}] BUY signal: ${result.reason} (confidence: ${result.confidence.toFixed(2)})`);
          } else if (result.signal < 0) {
            sells++;
            console.log(`[${i}] SELL signal: ${result.reason} (confidence: ${result.confidence.toFixed(2)})`);
          }
        } else {
          nosignal++;
        }
      } catch (error) {
        console.error(`Error processing window at index ${i}:`, error);
      }
    }
    
    console.log(`Results for ${name}:`);
    console.log(`- Buy signals: ${buys}`);
    console.log(`- Sell signals: ${sells}`);
    console.log(`- No signals: ${nosignal}`);
    console.log(`- Total processed: ${candles.length - windowSize}`);
    console.log(`- Signal rate: ${((buys + sells) / (candles.length - windowSize) * 100).toFixed(2)}%`);
  } catch (error) {
    console.error(`Failed to test ${name}:`, error);
  }
};

// Run the test
testSMASignals();
