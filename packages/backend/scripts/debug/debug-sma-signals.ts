/**
 * SMA Signal Generator Debug Script
 * 
 * A detailed debug script to identify issues with SMA signal generation
 */

import fs from 'fs';
import path from 'path';

import { calculateSMA, calculateEMA } from '../../src/JabbrLabs/indicators/moving-averages';
import { SMASignalProcessor } from '../../src/JabbrLabs/signals/sma/sma-signal-processor';
import type { Candle } from './src/JabbrLabs/target-reacher/interfaces';

// Generate test data with clearer trends
const generateTestData = (length: number): Candle[] => {
  const candles: Candle[] = [];
  let price = 100;
  const startTime = Date.now();
  
  // Use a simpler sine wave for clarity
  for (let i = 0; i < length; i++) {
    // Create obvious up and down trends (high amplitude)
    const trend = Math.sin(i / 20) * 20; // 20% price swings
    price = 100 + trend;
    
    const timestamp = startTime + i * 60 * 60 * 1000; // hourly data
    const open = price * 0.99;
    const close = price;
    const high = price * 1.01;
    const low = price * 0.98;
    const volume = 1000;
    
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

// Directly test the signal processor with debug output
const debugSignalProcessor = () => {
  console.log('\n----- SMA SIGNAL PROCESSOR DEBUG -----');
  
  // Generate 100 candles with clear price movements
  const candles = generateTestData(100);
  console.log(`Generated ${candles.length} test candles with sine wave pattern`);
  
  // Extract close prices for analysis
  const prices = candles.map(c => c.close);
  
  // Calculate MAs directly to debug
  const fast1 = calculateSMA(prices, 5);
  const slow1 = calculateSMA(prices, 15);
  console.log(`Calculated MAs directly: Fast(5) length=${fast1.length}, Slow(15) length=${slow1.length}`);
  
  // Create minimal configuration with proper types
  const config = {
    fastPeriod: 5,
    slowPeriod: 15,
    priceSource: 'close' as 'close' | 'open' | 'high' | 'low',
    signalMode: 'crossover' as 'crossover' | 'trend' | 'combined',
    useEMA: false,
    confidenceThreshold: 0.1 // Very low threshold
  };
  
  // Initialize processor
  const processor = new SMASignalProcessor(config);
  
  // Save raw data and MAs to file for inspection
  const outputDir = path.join(__dirname, 'debug-output');
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const dataFile = path.join(outputDir, 'sma-debug-data.json');
    fs.writeFileSync(dataFile, JSON.stringify({
      candles: candles.slice(0, 20), // First 20 candles sample
      prices: prices.slice(0, 20),
      fastMA: fast1.slice(0, 20),
      slowMA: slow1.slice(0, 15)
    }, null, 2));
    
    console.log(`Saved sample data to ${dataFile}`);
  } catch (error) {
    console.error('Error saving debug data:', error);
  }
  
  // Process in a sliding window to debug
  console.log('\nTesting signal processing with sliding window:');
  const startIdx = 20; // Start after enough data for MA calculations
  
  // Direct inspection of signal generation logic
  for (let i = startIdx; i < Math.min(candles.length, startIdx + 10); i++) {
    // Log the prices and MAs
    const window = candles.slice(0, i + 1);
    const windowPrices = window.map(c => c.close);
    
    // Calculate MAs directly for comparison
    const fastMA = calculateSMA(windowPrices, config.fastPeriod);
    const slowMA = calculateSMA(windowPrices, config.slowPeriod);
    
    const lastPrice = windowPrices[windowPrices.length - 1];
    const lastFastMA = fastMA[fastMA.length - 1];
    const lastSlowMA = slowMA[slowMA.length - 1];
    
    console.log(`\nWindow ${i}: Last Price=${lastPrice.toFixed(2)}`);
    console.log(`Fast MA: ${lastFastMA.toFixed(2)}, Slow MA: ${lastSlowMA.toFixed(2)}`);
    
    // Check for crossover conditions manually
    if (fastMA.length >= 2 && slowMA.length >= 2) {
      const currFast = fastMA[fastMA.length - 1];
      const prevFast = fastMA[fastMA.length - 2];
      const currSlow = slowMA[slowMA.length - 1];
      const prevSlow = slowMA[slowMA.length - 2];
      
      console.log(`Previous: Fast=${prevFast.toFixed(2)}, Slow=${prevSlow.toFixed(2)}`);
      console.log(`Current: Fast=${currFast.toFixed(2)}, Slow=${currSlow.toFixed(2)}`);
      
      // Check crossover manually
      if (currFast > currSlow && prevFast <= prevSlow) {
        console.log('*** MANUAL CHECK: Should generate BUY signal (bullish crossover) ***');
      } else if (currFast < currSlow && prevFast >= prevSlow) {
        console.log('*** MANUAL CHECK: Should generate SELL signal (bearish crossover) ***');
      } else {
        console.log('*** MANUAL CHECK: No crossover detected ***');
      }
    }
    
    // Now use the processor and see what it returns
    try {
      const result = processor.process(window);
      if (result) {
        console.log(`PROCESSOR RESULT: Signal=${result.signal}, Confidence=${result.confidence.toFixed(2)}, Reason=${result.reason}`);
      } else {
        console.log('PROCESSOR RESULT: No signal returned');
      }
    } catch (error) {
      console.error(`Error from processor:`, error);
    }
  }
  
  console.log('\n----- DETAILED TESTING WITH FORCED CROSSOVER DATA -----');
  
  // Create data with guaranteed crossover
  const crossoverData: Candle[] = [];
  // First add candles with fast MA below slow MA
  for (let i = 0; i < 30; i++) {
    crossoverData.push({
      timestamp: Date.now() + i * 3600000,
      open: 90,
      high: 95,
      low: 85,
      close: 90 + i * 0.1, // Slowly rising
      volume: 1000
    });
  }
  
  // Then add candles where fast MA will cross above slow MA
  for (let i = 0; i < 10; i++) {
    crossoverData.push({
      timestamp: Date.now() + (i + 30) * 3600000,
      open: 95,
      high: 110,
      low: 95,
      close: 95 + i * 2, // Sharply rising
      volume: 1000
    });
  }
  
  console.log(`Created ${crossoverData.length} candles with forced crossover pattern`);
  
  // Test with forced crossover data
  try {
    // Reset processor with very permissive settings
    const crossoverProcessor = new SMASignalProcessor({
      fastPeriod: 5,
      slowPeriod: 15,
      priceSource: 'close' as 'close' | 'open' | 'high' | 'low',
      signalMode: 'crossover' as 'crossover' | 'trend' | 'combined',
      confidenceThreshold: 0.01 // Almost no threshold
    });
    
    console.log('\nProcessing forced crossover data:');
    // Process each window
    for (let i = 20; i < crossoverData.length; i++) {
      const window = crossoverData.slice(0, i + 1);
      const result = crossoverProcessor.process(window);
      
      // Calculate MAs directly for comparison
      const windowPrices = window.map(c => c.close);
      const fastMA = calculateSMA(windowPrices, 5);
      const slowMA = calculateSMA(windowPrices, 15);
      
      console.log(`\nWindow ${i}: Fast=${fastMA[fastMA.length-1].toFixed(2)}, Slow=${slowMA[slowMA.length-1].toFixed(2)}`);
      
      if (result) {
        console.log(`SIGNAL: ${result.signal > 0 ? 'BUY' : 'SELL'}, Confidence=${result.confidence.toFixed(2)}`);
        console.log(`Reason: ${result.reason}`);
      } else {
        console.log('No signal');
      }
    }
  } catch (error) {
    console.error('Error during forced crossover test:', error);
  }
};

// Run the debug function
debugSignalProcessor();
