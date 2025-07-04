/**
 * Simple SMA Strategy Debug Script
 */
import { SMACrossoverStrategy } from '../../src/JabbrLabs/signals/sma/sma-crossover-strategy';
import { SMASignalProcessor } from '../../src/JabbrLabs/signals/sma/sma-signal-processor';
import type { Candle } from '../../src/JabbrLabs/target-reacher/interfaces';

// Generate sample data with clear trends
const generateCandlesWithTrends = (): Candle[] => {
  const candles: Candle[] = [];
  
  // Create a series of candles with definitive trend patterns
  // First, a flat period
  for (let i = 0; i < 30; i++) {
    candles.push({
      timestamp: Date.now() + i * 3600000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000
    });
  }
  
  // Then a strong uptrend
  for (let i = 0; i < 15; i++) {
    candles.push({
      timestamp: Date.now() + (i + 30) * 3600000,
      open: 100 + i * 3,
      high: 101 + i * 3,
      low: 99 + i * 3,
      close: 100 + i * 3,
      volume: 2000
    });
  }
  
  // Then a strong downtrend
  for (let i = 0; i < 15; i++) {
    candles.push({
      timestamp: Date.now() + (i + 45) * 3600000,
      open: 145 - i * 3,
      high: 146 - i * 3,
      low: 144 - i * 3,
      close: 145 - i * 3,
      volume: 3000
    });
  }
  
  return candles;
};

// Test the direct signal processor
const testSignalProcessor = () => {
  console.log("=== TESTING SMA SIGNAL PROCESSOR ===");
  
  const candles = generateCandlesWithTrends();
  console.log(`Generated ${candles.length} candles with clear trends`);
  
  // Create a signal processor with very permissive settings
  const processor = new SMASignalProcessor({
    fastPeriod: 5,
    slowPeriod: 15,
    priceSource: 'close' as 'close',
    signalMode: 'crossover' as 'crossover',
    confidenceThreshold: 0.01
  });
  
  console.log("Processing candles with sliding window:");
  
  // Test every 5th candle to reduce output
  for (let i = 15; i < candles.length; i += 5) {
    const window = candles.slice(0, i + 1);
    try {
      const lastCandle = window[window.length-1];
      if (!lastCandle) {
        console.log(`\nCandle ${i}: No candle data available`);
        continue;
      }
      
      console.log(`\nCandle ${i}: Price=${lastCandle.close}`);
      
      const result = processor.process(window);
      if (result) {
        console.log(`SIGNAL: ${result.signal > 0 ? 'BUY' : 'SELL'}, Confidence: ${result.confidence}`);
        console.log(`Reason: ${result.reason}`);
      } else {
        console.log("No signal generated");
      }
    } catch (error) {
      console.error(`Error at index ${i}:`, error);
    }
  }
};

// Test the full strategy implementation
const testStrategy = () => {
  console.log("\n=== TESTING SMA CROSSOVER STRATEGY ===");
  
  const strategy = new SMACrossoverStrategy();
  console.log("Strategy loaded:", strategy.name);
  
  // Log strategy configuration
  const config = strategy.getDefaultConfig();
  console.log("Default configuration:", JSON.stringify(config.parameters, null, 2));
  
  // Print summary
  console.log("\nSummary of debugging analysis:");
  console.log("1. The SMA signal processor is configured to detect crossovers between fast and slow MAs");
  console.log("2. The processor requires a minimum confidence level to generate signals");
  console.log("3. Check the 'generateSignal' method in sma-signal-processor.ts for any issues");
};

// Run the tests
console.log("Starting SMA strategy diagnostic tests...");
testSignalProcessor();
testStrategy();
