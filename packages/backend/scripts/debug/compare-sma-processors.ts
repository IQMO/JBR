/**
 * Compare original and improved SMA signal processors
 * 
 * This script runs both the original and improved SMA signal processors
 * on the same data and compares their signal generation.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ImprovedSMASignalProcessor } from '../../src/JabbrLabs/signals/sma/improved-sma-signal-processor';
import type { SMASignalConfig} from '../../src/JabbrLabs/signals/sma/models';
import { SMASignalOutput } from '../../src/JabbrLabs/signals/sma/models';
import { SMASignalProcessor } from '../../src/JabbrLabs/signals/sma/sma-signal-processor';
import type { Candle } from '../../src/JabbrLabs/target-reacher/interfaces';

// Configuration
const config: SMASignalConfig = {
  fastPeriod: 9,
  slowPeriod: 21,
  minChangePercent: 0.5,
  confidenceThreshold: 0.4, // Lowered threshold for comparison
  priceSource: 'close',
  signalMode: 'crossover',
  useEMA: false
};

// Generate synthetic price data for testing
function generateSyntheticCandles(options: {
  startPrice: number,
  dataPoints: number,
  volatility: number,
  trendStrength: number,
  trendChangeProbability: number
}): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = options.startPrice;
  let trend = 1; // 1 = up, -1 = down

  for (let i = 0; i < options.dataPoints; i++) {
    // Potentially change trend
    if (Math.random() < options.trendChangeProbability) {
      trend *= -1;
    }
    
    // Calculate price movement
    const trendMovement = trend * options.trendStrength * currentPrice;
    const randomMovement = (Math.random() * 2 - 1) * options.volatility * currentPrice;
    const movement = trendMovement + randomMovement;
    
    // Calculate candle prices
    const open = currentPrice;
    const close = currentPrice + movement;
    const high = Math.max(open, close) + Math.random() * options.volatility * currentPrice;
    const low = Math.min(open, close) - Math.random() * options.volatility * currentPrice;
    const volume = Math.random() * 100000 + 10000;
    
    // Create candle
    candles.push({
      timestamp: Date.now() + i * 900000, // 15-minute intervals
      open,
      high,
      low,
      close,
      volume
    });
    
    // Update current price for next iteration
    currentPrice = close;
  }
  
  return candles;
}

// Process signals and execute trades
function processAndTrade(processor: SMASignalProcessor | ImprovedSMASignalProcessor, candles: Candle[]) {
  const signals: any[] = [];
  const trades: any[] = [];
  let position: { side: 'buy' | 'sell' | null, entryPrice: number | null } = {
    side: null,
    entryPrice: null
  };
  
  let pnl = 0;
  
  // Process each candle
  for (let i = config.slowPeriod; i < candles.length; i++) {
    const windowCandles = candles.slice(0, i + 1);
    const output = processor.process(windowCandles);
    
    if (output && output.signal !== 0) {
      const candle = candles[i];
      signals.push({
        timestamp: candle.timestamp,
        price: candle.close,
        signal: output.signal > 0 ? 'buy' : 'sell',
        confidence: output.confidence,
        reason: output.reason
      });
      
      // Execute trades based on signals
      if (output.signal > 0 && position.side !== 'buy') {
        // Close existing position if any
        if (position.side === 'sell') {
          const profit = position.entryPrice! - candle.close;
          pnl += profit;
          trades.push({
            type: 'Close Short',
            timestamp: candle.timestamp,
            price: candle.close,
            profit
          });
        }
        
        // Open long position
        position = { side: 'buy', entryPrice: candle.close };
        trades.push({
          type: 'Open Long',
          timestamp: candle.timestamp,
          price: candle.close,
          reason: output.reason
        });
      } else if (output.signal < 0 && position.side !== 'sell') {
        // Close existing position if any
        if (position.side === 'buy') {
          const profit = candle.close - position.entryPrice!;
          pnl += profit;
          trades.push({
            type: 'Close Long',
            timestamp: candle.timestamp,
            price: candle.close,
            profit
          });
        }
        
        // Open short position
        position = { side: 'sell', entryPrice: candle.close };
        trades.push({
          type: 'Open Short',
          timestamp: candle.timestamp,
          price: candle.close,
          reason: output.reason
        });
      }
    }
  }
  
  // Close final position at the end of the test
  if (position.side !== null) {
    const lastCandle = candles[candles.length - 1];
    let profit = 0;
    
    if (position.side === 'buy') {
      profit = lastCandle.close - position.entryPrice!;
      trades.push({
        type: 'Close Long (End)',
        timestamp: lastCandle.timestamp,
        price: lastCandle.close,
        profit
      });
    } else {
      profit = position.entryPrice! - lastCandle.close;
      trades.push({
        type: 'Close Short (End)',
        timestamp: lastCandle.timestamp,
        price: lastCandle.close,
        profit
      });
    }
    
    pnl += profit;
  }
  
  return {
    signals,
    trades,
    pnl
  };
}

// Main test function
async function runComparisonTest() {
  console.log('Starting SMA Signal Processor Comparison Test');
  console.log(`Configuration: Fast Period: ${config.fastPeriod}, Slow Period: ${config.slowPeriod}`);
  
  // Generate test data
  const candles = generateSyntheticCandles({
    startPrice: 100,
    dataPoints: 200,
    volatility: 0.01,
    trendStrength: 0.005,
    trendChangeProbability: 0.05
  });
  
  // Create processors
  const originalProcessor = new SMASignalProcessor(config);
  const improvedProcessor = new ImprovedSMASignalProcessor(config);
  
  // Process with both implementations
  console.log('\nRunning Original SMA Signal Processor...');
  const originalResults = processAndTrade(originalProcessor, candles);
  
  console.log('\nRunning Improved SMA Signal Processor...');
  const improvedResults = processAndTrade(improvedProcessor, candles);
  
  // Log comparison results
  console.log('\n===== COMPARISON RESULTS =====');
  console.log(`Original: ${originalResults.signals.length} signals, ${originalResults.trades.length} trades, P&L: ${originalResults.pnl.toFixed(2)}`);
  console.log(`Improved: ${improvedResults.signals.length} signals, ${improvedResults.trades.length} trades, P&L: ${improvedResults.pnl.toFixed(2)}`);
  
  // Generate comparison report
  const report = {
    config,
    summary: {
      original: {
        signalCount: originalResults.signals.length,
        tradeCount: originalResults.trades.length,
        pnl: originalResults.pnl
      },
      improved: {
        signalCount: improvedResults.signals.length,
        tradeCount: improvedResults.trades.length,
        pnl: improvedResults.pnl
      },
      comparison: {
        signalDifference: improvedResults.signals.length - originalResults.signals.length,
        pnlDifference: improvedResults.pnl - originalResults.pnl
      }
    },
    details: {
      original: {
        signals: originalResults.signals,
        trades: originalResults.trades
      },
      improved: {
        signals: improvedResults.signals,
        trades: improvedResults.trades
      }
    }
  };
  
  // Write report to file
  fs.writeFileSync(
    path.join(__dirname, 'sma-comparison-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('Test complete. Comparison report saved to sma-comparison-report.json');
}

runComparisonTest().catch(console.error);
