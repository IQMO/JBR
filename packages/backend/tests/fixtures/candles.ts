/**
 * Test candles generator for backend tests
 * 
 * This file contains utility functions to generate test candles
 * that can be used across multiple test files
 */
import type { Candle } from '../../packages/backend/src/JabbrLabs/target-reacher/interfaces';

// Test data - creating a rising market
export const generateBullishCandles = (count: number, startPrice = 100, timeframe = '1h'): Candle[] => {
  const candles: Candle[] = [];
  let price = startPrice;
  
  // Determine milliseconds based on timeframe
  const msPerCandle = timeframeToMs(timeframe);
  
  for (let i = 0; i < count; i++) {
    // Generate slightly uptrending prices
    const open = price;
    const close = price * (1 + 0.01 + Math.random() * 0.01); // 1-2% increase
    const high = Math.max(open, close) * (1 + Math.random() * 0.005); // 0-0.5% above max
    const low = Math.min(open, close) * (1 - Math.random() * 0.005); // 0-0.5% below min
    const volume = 1000 + Math.random() * 1000;
    
    candles.push({
      timestamp: Date.now() - (count - i) * msPerCandle,
      open,
      high,
      low,
      close,
      volume
    });
    
    // Update price for next candle
    price = close;
  }
  
  return candles;
};

// Test data - creating a falling market
export const generateBearishCandles = (count: number, startPrice = 100, timeframe = '1h'): Candle[] => {
  const candles: Candle[] = [];
  let price = startPrice;
  
  // Determine milliseconds based on timeframe
  const msPerCandle = timeframeToMs(timeframe);
  
  for (let i = 0; i < count; i++) {
    // Generate slightly downtrending prices
    const open = price;
    const close = price * (1 - 0.01 - Math.random() * 0.01); // 1-2% decrease
    const high = Math.max(open, close) * (1 + Math.random() * 0.005); // 0-0.5% above max
    const low = Math.min(open, close) * (1 - Math.random() * 0.005); // 0-0.5% below min
    const volume = 1000 + Math.random() * 1000;
    
    candles.push({
      timestamp: Date.now() - (count - i) * msPerCandle,
      open,
      high,
      low,
      close,
      volume
    });
    
    // Update price for next candle
    price = close;
  }
  
  return candles;
};

// Test data - creating a sideways market with a crossover
export const generateCrossoverCandles = (count: number, startPrice = 100, timeframe = '1h'): Candle[] => {
  // First half - price going down
  const firstHalf = generateBearishCandles(Math.floor(count / 2), startPrice, timeframe);
  // Second half - price going up (creating a crossover)
  const secondHalf = generateBullishCandles(Math.ceil(count / 2), firstHalf[firstHalf.length - 1].close, timeframe);
  
  return [...firstHalf, ...secondHalf];
};

// Helper function to convert timeframe string to milliseconds
const timeframeToMs = (timeframe: string): number => {
  const match = timeframe.match(/^(\d+)([mhd])$/);
  if (!match) {return 60 * 60 * 1000;} // Default to 1h
  
  const [, count, unit] = match;
  const countNum = parseInt(count, 10);
  
  switch(unit) {
    case 'm': return countNum * 60 * 1000;
    case 'h': return countNum * 60 * 60 * 1000;
    case 'd': return countNum * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
};
