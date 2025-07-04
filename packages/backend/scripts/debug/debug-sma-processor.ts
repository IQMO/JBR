/**
 * SMA Signal Generator Debug Script
 * 
 * A detailed debug script to identify issues with SMA signal generation
 */

import fs from 'fs';
import path from 'path';

import { calculateSMA } from '../../src/JabbrLabs/indicators/moving-averages';
import { SMASignalProcessor } from '../../src/JabbrLabs/signals/sma/sma-signal-processor';
import type { Candle } from '../../src/JabbrLabs/target-reacher/interfaces';

// Create a function to check and fix SMA signal processor issues
const findAndFixIssues = () => {
  console.log('\n----- SMA SIGNAL PROCESSOR ISSUE FINDER -----');
  
  // Create test data with predictable pattern
  const candles: Candle[] = [];
  
  // Start with a flat pattern
  for (let i = 0; i < 20; i++) {
    candles.push({
      timestamp: Date.now() + i * 3600000,
      open: 100,
      high: 102,
      low: 98,
      close: 100,
      volume: 1000
    });
  }
  
  // Add a clear uptrend - this should cause a bullish crossover
  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp: Date.now() + (i + 20) * 3600000,
      open: 100 + i * 2,
      high: 102 + i * 2,
      low: 98 + i * 2,
      close: 100 + i * 2.5,
      volume: 2000
    });
  }
  
  // Add a clear downtrend - this should cause a bearish crossover
  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp: Date.now() + (i + 30) * 3600000,
      open: 125 - i * 2,
      high: 127 - i * 2,
      low: 123 - i * 2,
      close: 125 - i * 3,
      volume: 3000
    });
  }
  
  console.log(`Created ${candles.length} test candles with clear trend patterns`);
  
  // Configuration with very low thresholds to ensure we get signals
  const config = {
    fastPeriod: 5,
    slowPeriod: 15,
    priceSource: 'close' as 'close',
    signalMode: 'crossover' as 'crossover',
    useEMA: false,
    confidenceThreshold: 0.01, // Almost no threshold
    minChangePercent: 0.01 // Almost no minimum change
  };
  
  // Manually check when crossovers should happen
  console.log('\nAnalyzing data for expected crossover points:');
  
  for (let i = 20; i < candles.length; i++) {
    // Calculate SMA values ourselves
    const prices = candles.slice(0, i + 1).map(c => c.close);
    const fastMA = calculateSMA(prices, config.fastPeriod);
    const slowMA = calculateSMA(prices, config.slowPeriod);
    
    if (fastMA.length < 2 || slowMA.length < 2) {continue;}
    
    // Get current and previous values
    const currFast = fastMA[fastMA.length - 1]; 
    const prevFast = fastMA[fastMA.length - 2];
    const currSlow = slowMA[slowMA.length - 1];
    const prevSlow = slowMA[slowMA.length - 2];
    
    // Check for crossovers manually
    if (currFast && prevFast && currSlow && prevSlow) {
      if (currFast > currSlow && prevFast <= prevSlow) {
        console.log(`Candle ${i}: BULLISH CROSSOVER DETECTED - Should generate BUY signal`);
        console.log(`  Fast: ${prevFast.toFixed(2)} -> ${currFast.toFixed(2)}`);
        console.log(`  Slow: ${prevSlow.toFixed(2)} -> ${currSlow.toFixed(2)}`);
      } else if (currFast < currSlow && prevFast >= prevSlow) {
        console.log(`Candle ${i}: BEARISH CROSSOVER DETECTED - Should generate SELL signal`);
        console.log(`  Fast: ${prevFast.toFixed(2)} -> ${currFast.toFixed(2)}`);
        console.log(`  Slow: ${prevSlow.toFixed(2)} -> ${currSlow.toFixed(2)}`);
      }
    }
  }
  
  // Now test using the SMA processor
  console.log('\nTesting SMA processor with the same data:');
  const processor = new SMASignalProcessor(config);
  
  // Create a log of raw data for analysis
  const logData: {
    configuration: typeof config;
    candleData: Array<{
      index: number;
      price: number;
      fastMA: number;
      slowMA: number;
      difference: number;
    }>;
    signals: Array<{
      index: number;
      type: string;
      confidence: number;
      reason: string;
    }>;
  } = {
    configuration: config,
    candleData: [],
    signals: []
  };
  
  // Process each window
  for (let i = 15; i < candles.length; i++) {
    const window = candles.slice(0, i + 1);
    
    try {
      const result = processor.process(window);
      
      // Calculate MAs directly for reference
      const prices = window.map(c => c.close);
      const fastMA = calculateSMA(prices, config.fastPeriod);
      const slowMA = calculateSMA(prices, config.slowPeriod);
      
      const lastFastMA = fastMA.length > 0 ? fastMA[fastMA.length - 1] : null;
      const lastSlowMA = slowMA.length > 0 ? slowMA[slowMA.length - 1] : null;
      
      console.log(`\nCandle ${i}: Fast MA = ${lastFastMA?.toFixed(2) || 'N/A'}, Slow MA = ${lastSlowMA?.toFixed(2) || 'N/A'}`);
      
      // Save data for analysis
      if (lastFastMA !== null && lastSlowMA !== null && window.length > 0) {
        const lastCandle = window[window.length - 1];
        if (lastCandle) {
          logData.candleData.push({
            index: i,
            price: lastCandle.close,
            fastMA: lastFastMA,
            slowMA: lastSlowMA,
            difference: lastFastMA - lastSlowMA
          });
        }
      }
      
      if (result) {
        const signalType = result.signal > 0 ? 'BUY' : result.signal < 0 ? 'SELL' : 'NONE';
        console.log(`*** SIGNAL: ${signalType} - Confidence: ${result.confidence.toFixed(2)} ***`);
        console.log(`Reason: ${result.reason}`);
        
        logData.signals.push({
          index: i,
          type: signalType,
          confidence: result.confidence,
          reason: result.reason
        });
      } else {
        console.log('No signal generated');
      }
    } catch (error) {
      console.error(`Error processing window at index ${i}:`, error);
    }
  }
  
  // Save data for analysis
  const outputDir = path.join(__dirname, 'debug-output');
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = path.join(outputDir, 'sma-debug-analysis.json');
    fs.writeFileSync(filename, JSON.stringify(logData, null, 2));
    console.log(`\nDetailed analysis data saved to ${filename}`);
  } catch (error) {
    console.error('Error saving analysis data:', error);
  }
  
  // Check the SMASignalProcessor implementation for issues
  console.log('\nChecking SMASignalProcessor implementation:');
  console.log('1. Configuration used:', config);
  console.log('2. Signals generated:', logData.signals.length);
  
  if (logData.signals.length === 0) {
    console.log('\nPOTENTIAL ISSUES IDENTIFIED:');
    console.log(`- Confidence threshold may be too high (current: ${  config.confidenceThreshold  })`);
    console.log('- Signal generation logic may have bugs');
    console.log('- Crossover detection might not be working as expected');
    console.log('\nRECOMMENDATIONS:');
    console.log('- Review the generateSignal method in SMASignalProcessor');
    console.log('- Ensure crossover detection is correctly implemented');
    console.log('- Lower the confidence threshold or modify confidence calculation');
  }
};

// Run the test
findAndFixIssues();
