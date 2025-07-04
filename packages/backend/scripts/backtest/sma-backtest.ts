/**
 * SMA Strategy Backtest
 * 
 * This script runs a backtest of the SMA signal processor against synthetic price data
 * to validate its performance and signal generation.
 */

import * as fs from 'fs';
import * as path from 'path';

import { generateSyntheticCandles, type Candle } from '../../../shared/src/test-utils/data-generators';
import type { SMASignalConfig } from '../../src/JabbrLabs/signals/sma/models';
import { SMASignalProcessor } from '../../src/JabbrLabs/signals/sma/sma-signal-processor';

// Configuration
const config: SMASignalConfig = {
  fastPeriod: 9,
  slowPeriod: 21,
  minChangePercent: 0.5,
  confidenceThreshold: 0.4,
  priceSource: 'close',
  signalMode: 'crossover',
  useEMA: false
};

// Main function to run the backtest
async function runBacktest() {
  console.log('Starting SMA Backtest');
  console.log(`Configuration: Fast Period: ${config.fastPeriod}, Slow Period: ${config.slowPeriod}, Threshold: ${config.confidenceThreshold}`);
  
  // Generate test data using shared utility
  const candles = generateSyntheticCandles({
    count: 200,
    startPrice: 100,
    trend: 'mixed',
    timeframe: '15m'
  });
  
  const processor = new SMASignalProcessor(config);
  
  interface SignalRecord {
    timestamp: number;
    price: number;
    signal: 'buy' | 'sell';
    confidence: number;
    reason: string;
  }

  interface TradeRecord {
    type: string;
    timestamp: number;
    price: number;
    profit?: number;
    reason?: string;
  }
  
  const signals: SignalRecord[] = [];
  const trades: TradeRecord[] = [];
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
      if (!candle) {continue;} // Skip if candle is undefined
      
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
        if (position.side === 'sell' && position.entryPrice !== null) {
          const profit = position.entryPrice - candle.close;
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
        if (position.side === 'buy' && position.entryPrice !== null) {
          const profit = candle.close - position.entryPrice;
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
  if (position.side !== null && position.entryPrice !== null) {
    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      let profit = 0;
      
      if (position.side === 'buy') {
        profit = lastCandle.close - position.entryPrice;
        trades.push({
          type: 'Close Long (End)',
          timestamp: lastCandle.timestamp,
          price: lastCandle.close,
          profit
        });
      } else if (position.side === 'sell') {
        profit = position.entryPrice - lastCandle.close;
        trades.push({
          type: 'Close Short (End)',
          timestamp: lastCandle.timestamp,
          price: lastCandle.close,
          profit
        });
      }
      
      pnl += profit;
    }
  }
  
  // Log results
  console.log(`Generated ${signals.length} signals and ${trades.length} trades`);
  console.log(`Final P&L: ${pnl.toFixed(2)}`);
  
  // Generate report
  const report = {
    config,
    summary: {
      signalCount: signals.length,
      tradeCount: trades.length,
      pnl
    },
    signals,
    trades
  };
  
  // Write report to file
  fs.writeFileSync(
    path.join(__dirname, 'sma-backtest-results.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('Backtest complete. Results saved to sma-backtest-results.json');
}

// Run the backtest
runBacktest().catch(console.error);
