/**
 * Consolidated Test Data Generation Utilities
 * 
 * This module provides shared utilities for generating test data across
 * the entire codebase, eliminating code duplication in test files.
 */

/**
 * Candle data structure for OHLCV data
 */
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Options for generating synthetic candles
 */
export interface CandleGenerationOptions {
  count: number;
  startPrice?: number;
  startTime?: Date;
  timeframe?: string;
  trend?: 'bullish' | 'bearish' | 'mixed' | 'crossover';
  volatility?: number;
  volume?: number;
}

/**
 * Convert timeframe string to milliseconds
 */
export const timeframeToMs = (timeframe: string): number => {
  const timeframes: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return timeframes[timeframe] ?? timeframes['1h']!;
};

/**
 * Generate bullish trend candles
 */
export const generateBullishCandles = (
  count: number, 
  startPrice = 100, 
  timeframe = '1h'
): Candle[] => {
  const candles: Candle[] = [];
  const timeframeMs = timeframeToMs(timeframe);
  let currentPrice = startPrice;
  const startTime = new Date().getTime() - (count * timeframeMs);

  for (let i = 0; i < count; i++) {
    const open = currentPrice;
    const priceIncrease = Math.random() * 2 + 0.5; // 0.5-2.5 increase
    const high = open + priceIncrease + Math.random() * 0.5;
    const low = open - Math.random() * 0.3;
    const close = open + priceIncrease;
    
    candles.push({
      timestamp: startTime + (i * timeframeMs),
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500
    });
    
    currentPrice = close;
  }
  
  return candles;
};

/**
 * Generate bearish trend candles
 */
export const generateBearishCandles = (
  count: number, 
  startPrice = 100, 
  timeframe = '1h'
): Candle[] => {
  const candles: Candle[] = [];
  const timeframeMs = timeframeToMs(timeframe);
  let currentPrice = startPrice;
  const startTime = new Date().getTime() - (count * timeframeMs);

  for (let i = 0; i < count; i++) {
    const open = currentPrice;
    const priceDecrease = Math.random() * 2 + 0.5; // 0.5-2.5 decrease
    const high = open + Math.random() * 0.3;
    const low = open - priceDecrease - Math.random() * 0.5;
    const close = open - priceDecrease;
    
    candles.push({
      timestamp: startTime + (i * timeframeMs),
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500
    });
    
    currentPrice = close;
  }
  
  return candles;
};

/**
 * Generate crossover pattern candles (ideal for testing MA crossovers)
 */
export const generateCrossoverCandles = (
  count: number, 
  startPrice = 100, 
  timeframe = '1h'
): Candle[] => {
  const candles: Candle[] = [];
  const timeframeMs = timeframeToMs(timeframe);
  let currentPrice = startPrice;
  const startTime = new Date().getTime() - (count * timeframeMs);
  
  // Create alternating trends to generate crossovers
  const segmentSize = Math.floor(count / 4);
  
  for (let i = 0; i < count; i++) {
    const segmentIndex = Math.floor(i / segmentSize);
    const isBullish = segmentIndex % 2 === 0;
    
    const open = currentPrice;
    const priceChange = (Math.random() * 1.5 + 0.3) * (isBullish ? 1 : -1);
    const high = Math.max(open, open + priceChange) + Math.random() * 0.2;
    const low = Math.min(open, open + priceChange) - Math.random() * 0.2;
    const close = open + priceChange;
    
    candles.push({
      timestamp: startTime + (i * timeframeMs),
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500
    });
    
    currentPrice = close;
  }
  
  return candles;
};

/**
 * Generate mixed trend candles
 */
export const generateMixedTrendCandles = (
  count: number, 
  startPrice = 100, 
  timeframe = '1h'
): Candle[] => {
  if (count === 0) return [];
  
  const firstHalf = generateBearishCandles(Math.floor(count / 2), startPrice, timeframe);
  if (firstHalf.length === 0) return generateBullishCandles(count, startPrice, timeframe);
  
  const lastPrice = firstHalf[firstHalf.length - 1]!.close;
  const secondHalf = generateBullishCandles(Math.ceil(count / 2), lastPrice, timeframe);
  
  // Adjust timestamps for second half to continue from first half
  const lastTimestamp = firstHalf[firstHalf.length - 1]!.timestamp;
  const timeframeMs = timeframeToMs(timeframe);
  
  secondHalf.forEach((candle, index) => {
    candle.timestamp = lastTimestamp + ((index + 1) * timeframeMs);
  });
  
  return [...firstHalf, ...secondHalf];
};

/**
 * Generate synthetic candles with comprehensive options
 */
export function generateSyntheticCandles(options: CandleGenerationOptions): Candle[] {
  const {
    count,
    startPrice = 100,
    startTime = new Date(),
    timeframe = '1h',
    trend = 'mixed',
    volatility = 1,
    volume = 1000
  } = options;

  switch (trend) {
    case 'bullish':
      return generateBullishCandles(count, startPrice, timeframe);
    case 'bearish':
      return generateBearishCandles(count, startPrice, timeframe);
    case 'crossover':
      return generateCrossoverCandles(count, startPrice, timeframe);
    case 'mixed':
    default:
      return generateMixedTrendCandles(count, startPrice, timeframe);
  }
}

/**
 * Generate test data with specific length (legacy compatibility)
 */
export const generateTestData = (length: number): Candle[] => {
  return generateSyntheticCandles({ count: length, trend: 'mixed' });
};

/**
 * Generate sample data for backtesting (legacy compatibility)
 */
export const generateSampleData = (): Candle[] => {
  return generateSyntheticCandles({ 
    count: 100, 
    trend: 'crossover',
    startPrice: 50000 // Bitcoin-like price
  });
};

/**
 * Generate candles with specific trends for testing
 */
export const generateCandlesWithTrends = (): Candle[] => {
  return generateSyntheticCandles({
    count: 50,
    trend: 'mixed',
    startPrice: 100,
    volatility: 1.5
  });
};
