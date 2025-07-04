/**
 * Consolidated Test Context Utilities
 * 
 * This module provides shared mock context creation utilities
 * to eliminate duplication across test files.
 */

import type { Candle } from './data-generators';

/**
 * Strategy context for testing strategies
 */
export interface StrategyContext {
  candles: Candle[];
  currentPrice: number;
  balance: number;
  position?: {
    size: number;
    side: 'long' | 'short';
    entryPrice: number;
    unrealizedPnl: number;
  };
  indicators: Record<string, any>;
  config: Record<string, any>;
  timestamp: number;
}

/**
 * Trading context interface
 */
export interface TradingContext extends StrategyContext {
  exchange: string;
  symbol: string;
  timeframe: string;
  fees: {
    maker: number;
    taker: number;
  };
}

/**
 * Create a basic mock strategy context
 */
export const createMockContext = (candles: Candle[] = []): StrategyContext => {
  const currentPrice = candles.length > 0 ? candles[candles.length - 1]!.close : 100;
  
  return {
    candles,
    currentPrice,
    balance: 10000, // $10k starting balance
    indicators: {},
    config: {
      fastPeriod: 5,
      slowPeriod: 20,
      stopLoss: 0.02, // 2%
      takeProfit: 0.04, // 4%
    },
    timestamp: Date.now()
  };
};

/**
 * Create a mock context with position
 */
export const createMockContextWithPosition = (
  candles: Candle[] = [],
  side: 'long' | 'short' = 'long',
  size = 1,
  entryPrice?: number
): StrategyContext => {
  const context = createMockContext(candles);
  const currentPrice = context.currentPrice;
  const entry = entryPrice ?? currentPrice;
  
  const unrealizedPnl = side === 'long' 
    ? (currentPrice - entry) * size
    : (entry - currentPrice) * size;
  
  context.position = {
    size,
    side,
    entryPrice: entry,
    unrealizedPnl
  };
  
  return context;
};

/**
 * Create a basic backtest context
 */
export const createBacktestContext = (candles: Candle[]): StrategyContext => {
  return {
    ...createMockContext(candles),
    config: {
      initialBalance: 10000,
      commission: 0.001, // 0.1%
      slippage: 0.0005, // 0.05%
      fastPeriod: 5,
      slowPeriod: 20
    }
  };
};

/**
 * Create a trading context with exchange details
 */
export const createTradingContext = (
  candles: Candle[] = [],
  exchange = 'binance',
  symbol = 'BTCUSDT',
  timeframe = '1h'
): TradingContext => {
  const baseContext = createMockContext(candles);
  
  return {
    ...baseContext,
    exchange,
    symbol,
    timeframe,
    fees: {
      maker: 0.001, // 0.1%
      taker: 0.001  // 0.1%
    }
  };
};

/**
 * Load historical data simulation (for testing)
 */
export const loadHistoricalData = (
  symbol: string, 
  startDate: Date, 
  endDate: Date
): Candle[] => {
  const daysBetween = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const candleCount = Math.min(daysBetween * 24, 1000); // Max 1000 candles
  
  // Return mixed trend data for historical simulation
  const candles: Candle[] = [];
  let currentPrice = 50000; // Start with BTC-like price
  const startTime = startDate.getTime();
  
  for (let i = 0; i < candleCount; i++) {
    const timestamp = startTime + (i * 60 * 60 * 1000); // 1 hour intervals
    const priceChange = (Math.random() - 0.5) * currentPrice * 0.02; // ±2% change
    
    const open = currentPrice;
    const close = currentPrice + priceChange;
    const high = Math.max(open, close) + Math.abs(priceChange) * 0.5;
    const low = Math.min(open, close) - Math.abs(priceChange) * 0.5;
    
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 2000
    });
    
    currentPrice = close;
  }
  
  return candles;
};
