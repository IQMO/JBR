/**
 * SMA Strategy Backtesting Script
 * 
 * This script runs a backtesting simulation for the SMA crossover strategy
 * using historical price data. It provides insights into how the strategy
 * would have performed over a historical time period.
 */

import fs from 'fs';
import path from 'path';

import { SMACrossoverStrategy } from './src/JabbrLabs/signals/sma/sma-crossover-strategy';
import type { Candle, StrategyContext } from './src/JabbrLabs/target-reacher/interfaces';

// Sample historical data (Normally, this would be loaded from a file or database)
// For a real implementation, add a CSV loader or API client to fetch historical data
const loadHistoricalData = (symbol: string, startDate: Date, endDate: Date): Candle[] => {
  // This is a placeholder - in a real implementation, load data from file or API
  console.log(`Loading historical data for ${symbol} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // Generate synthetic data for demonstration purposes
  const candles: Candle[] = [];
  let price = 100; // Starting price
  const hoursInRange = Math.floor((endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000));
  
  // Create a more realistic price pattern with clearer trends
  // Using a sine wave with noise for more predictable crossovers
  for (let i = 0; i < hoursInRange; i++) {
    // Create a sine wave pattern with 240 hour cycle (10 days)
    const cycle1 = Math.sin(i / 40) * 15;  // Primary trend
    const cycle2 = Math.sin(i / 20) * 5;   // Secondary trend
    const noise = (Math.random() - 0.5) * 3; // Random noise
    
    // Calculate price based on cycles and noise
    price = 100 + cycle1 + cycle2 + noise;
    
    // Add some volatility
    const timestamp = new Date(startDate.getTime() + i * 60 * 60 * 1000).getTime();
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

// Create a mock context for backtesting
const createBacktestContext = (candles: Candle[]): StrategyContext => {
  const context: StrategyContext = {
    config: {
      type: 'sma-crossover',
      parameters: {
        fastPeriod: 5,  // Reduced from 9 to generate more signals
        slowPeriod: 15, // Reduced from 21 to generate more signals
        priceSource: 'close',
        signalMode: 'combined', // Use both crossover and trend signals
        useEMA: true,
        confidenceThreshold: 0.4 // Lower threshold to generate more signals
      },
      execution: {
        timeframe: '1h',
        minimumConfidence: 0.4 // Reduced to match more signals
      }
    },
    botConfig: {
      id: 'backtest-bot',
      name: 'Backtest Bot',
      symbol: 'BTC/USDT',
      tradeType: 'spot',
      amount: 0.1 // 0.1 BTC per trade
    },
    symbol: 'BTC/USDT',
    marketData: {
      getCurrentPrice: async () => {
        const lastCandle = candles[candles.length - 1];
        return lastCandle ? lastCandle.close : 0;
      },
      getOrderBook: async () => ({
        bids: [[0, 0]],
        asks: [[0, 0]],
        timestamp: Date.now()
      }),
      getCandles: async () => [...candles], // Return a copy
      getTicker: async () => ({
        symbol: 'BTC/USDT',
        last: candles[candles.length - 1]?.close || 0,
        bid: 0,
        ask: 0,
        volume: 0,
        timestamp: Date.now()
      })
    },
    tradeExecutor: {
      executeSignal: async (signal) => {
        console.log(`[${new Date(signal.timestamp).toISOString()}] EXECUTE ${signal.side.toUpperCase()} at $${signal.price.toFixed(2)}`);
        return {
          id: `order-${Date.now()}`,
          orderId: `backtest-${Date.now()}`,
          botId: signal.botId,
          symbol: signal.symbol,
          type: 'market',
          side: signal.side,
          amount: 0.1,
          price: signal.price,
          status: 'filled',
          filled: 0.1,
          remaining: 0,
          timestamp: signal.timestamp,
          updatedAt: signal.timestamp
        };
      },
      getPosition: async () => null, // For simplicity, we don't track positions in this demo
      closePosition: async () => {
        console.log(`[${new Date().toISOString()}] CLOSE position`);
      }
    },
    logger: {
      info: (message, data) => console.log(`[INFO] ${message}`, data || ''),
      warn: (message, data) => console.warn(`[WARN] ${message}`, data || ''),
      error: (message, data) => console.error(`[ERROR] ${message}`, data || ''),
      debug: (message, data) => console.debug(`[DEBUG] ${message}`, data || '')
    },
    storage: {
      storeStrategyEvent: async () => {},
      getStrategyState: async () => null,
      saveStrategyState: async () => {}
    },
    eventEmitter: {
      emit: () => {},
      on: () => {},
      off: () => {}
    }
  };
  
  return context;
};

// Main backtesting function
const runBacktest = async (
  strategy: SMACrossoverStrategy,
  symbol: string,
  startDate: Date,
  endDate: Date,
  windowSize = 100
): Promise<{ trades: number; profitLoss: number; }> => {
  // Load historical data
  const allCandles = loadHistoricalData(symbol, startDate, endDate);
  
  // Get current config for display
  const testContext = createBacktestContext([]);
  const currentConfig = testContext.config;
  const fastPeriod = currentConfig.parameters.fastPeriod as number;
  const slowPeriod = currentConfig.parameters.slowPeriod as number;
  const signalMode = currentConfig.parameters.signalMode as string;
  
  console.log(`\n----- BACKTESTING SMA CROSSOVER STRATEGY -----`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Period: ${startDate.toDateString()} to ${endDate.toDateString()}`);
  console.log(`Candles: ${allCandles.length}`);
  console.log(`Fast Period: ${fastPeriod}`);
  console.log(`Slow Period: ${slowPeriod}`);
  console.log(`Signal Mode: ${signalMode}`);
  console.log(`Minimum Confidence: ${currentConfig.execution?.minimumConfidence}`);
  console.log(`-----------------------------------------------\n`);
  
  // Stats
  let trades = 0;
  let profitLoss = 0;
  let position: 'long' | 'short' | null = null;
  let entryPrice = 0;
  const positionSize = 0.1; // Default position size
  let capital = 10000; // Starting capital (USDT)
  let equity = capital;
  
  // For tracking execution history
  const executionHistory: Array<{
    timestamp: number;
    action: string;
    price: number;
    reason: string;
    equity: number;
  }> = [];
  
  // Initialize strategy
  const context = createBacktestContext([]);
  await strategy.initialize(context);
  
  // Process historical data with a sliding window
  for (let i = windowSize; i < allCandles.length; i++) {
    // Get window of candles
    const windowCandles = allCandles.slice(i - windowSize, i);
    
    // Update context with current window
    context.marketData.getCandles = async () => [...windowCandles];
    
    // Get the last candle, with safety check
    const lastCandle = windowCandles[windowCandles.length - 1];
    if (!lastCandle) {
      console.error('Missing last candle in window');
      continue;
    }
    
    // Current price (close of the last candle)
    const currentPrice = lastCandle.close;
    const currentTimestamp = lastCandle.timestamp;
    
    // Update PnL if we have a position
    if (position === 'long') {
      const unrealizedPnl = (currentPrice - entryPrice) * positionSize;
      equity = capital + unrealizedPnl;
    } else if (position === 'short') {
      const unrealizedPnl = (entryPrice - currentPrice) * positionSize;
      equity = capital + unrealizedPnl;
    }
    
    // Mock position data
    if (position) {
      context.tradeExecutor.getPosition = async () => ({
        symbol,
        side: position as 'long' | 'short', // Type assertion to match Position interface
        size: positionSize,
        entryPrice,
        currentPrice,
        unrealizedPnl: equity - capital,
        timestamp: currentTimestamp
      });
    } else {
      context.tradeExecutor.getPosition = async () => null;
    }
    
    // Execute strategy with debugging
    try {
      // Debug log for candles
      if (i % 100 === 0) {
        console.log(`Processing window at index ${i}, price: ${currentPrice.toFixed(2)}`);
      }
      
      const result = await strategy.execute(context);
      
      // Log all strategy results for debugging
      if (i % 100 === 0 || result.action !== 'hold') {
        console.log(`Strategy result [${new Date(currentTimestamp).toISOString()}]:`, {
          success: result.success,
          action: result.action,
          reason: result.reason,
          confidence: result.confidence
        });
      }
      
      // Process trade
      if (result.success && (result.action === 'buy' || result.action === 'sell')) {
        // If we have a position and signal is in opposite direction, close it
        if (position && 
            ((position === 'long' && result.action === 'sell') ||
             (position === 'short' && result.action === 'buy'))) {
          // Calculate P&L
          const closingPnl = position === 'long' 
            ? (currentPrice - entryPrice) * positionSize
            : (entryPrice - currentPrice) * positionSize;
          
          profitLoss += closingPnl;
          capital += closingPnl;
          equity = capital;
          
          console.log(`[${new Date(currentTimestamp).toISOString()}] CLOSE ${position} position at $${currentPrice.toFixed(2)}, P&L: ${closingPnl.toFixed(2)}`);
          executionHistory.push({
            timestamp: currentTimestamp,
            action: `CLOSE ${position}`,
            price: currentPrice,
            reason: result.reason || '',
            equity
          });
          
          position = null;
          entryPrice = 0;
        }
        
        // Open new position
        if (!position) {
          position = result.action === 'buy' ? 'long' : 'short';
          entryPrice = currentPrice;
          trades++;
          
          console.log(`[${new Date(currentTimestamp).toISOString()}] OPEN ${position} position at $${currentPrice.toFixed(2)}`);
          executionHistory.push({
            timestamp: currentTimestamp,
            action: `OPEN ${position}`,
            price: currentPrice,
            reason: result.reason || '',
            equity
          });
        }
      }
    } catch (error) {
      console.error(`Error during backtesting:`, error);
    }
  }
  
  // Close any open position at the end of the backtest
  if (position) {
    // Get the last candle with safety check
    const lastCandle = allCandles[allCandles.length - 1];
    if (!lastCandle) {
      console.error('Missing last candle in dataset');
      return { trades, profitLoss };
    }
    
    const lastPrice = lastCandle.close;
    const finalPnl = position === 'long' 
      ? (lastPrice - entryPrice) * positionSize
      : (entryPrice - lastPrice) * positionSize;
    
    profitLoss += finalPnl;
    capital += finalPnl;
    equity = capital;
    
    console.log(`[End of backtest] CLOSE ${position} position at $${lastPrice.toFixed(2)}, P&L: ${finalPnl.toFixed(2)}`);
    executionHistory.push({
      timestamp: lastCandle.timestamp,
      action: `CLOSE ${position} (END)`,
      price: lastPrice,
      reason: 'End of backtest',
      equity
    });
  }
  
  // Print backtest results
  console.log('\n----- BACKTEST RESULTS -----');
  console.log(`Total trades: ${trades}`);
  console.log(`Total P&L: ${profitLoss.toFixed(2)} USDT`);
  console.log(`Final equity: ${equity.toFixed(2)} USDT`);
  console.log(`Return: ${(((equity - 10000) / 10000) * 100).toFixed(2)}%`);
  console.log('---------------------------\n');
  
  // Save execution history to file
  const outputDir = path.join(__dirname, 'backtest-results');
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = path.join(outputDir, `sma-backtest-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(filename, JSON.stringify({
      strategy: 'SMA Crossover',
      symbol,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      config: strategy.getDefaultConfig(),
      results: {
        trades,
        profitLoss,
        startingCapital: 10000,
        finalEquity: equity,
        returnPercent: ((equity - 10000) / 10000) * 100
      },
      executionHistory
    }, null, 2));
    
    console.log(`Backtest results saved to ${filename}`);
  } catch (error) {
    console.error('Failed to save backtest results:', error);
  }
  
  return { trades, profitLoss };
};

// Run the backtest
const main = async () => {
  const strategy = new SMACrossoverStrategy();
  
  // Three months of hourly data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - 3);
  
  await runBacktest(strategy, 'BTC/USDT', startDate, endDate);
};

main().catch(error => {
  console.error('Backtest failed:', error);
});
