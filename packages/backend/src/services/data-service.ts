/**
 * Data service for downloading and managing historical market data
 */

// Import axios if needed (commented out as we're using mock data)
// import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

import type { Candle } from '../JabbrLabs/target-reacher/interfaces';

import logger from './logging.service';

/**
 * Default data directory for storing cached historical data
 */
const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data', 'historical');

/**
 * Download historical price data for a symbol and timeframe
 * Uses a local cache to avoid repeated downloads
 */
export async function downloadHistoricalData(
  symbol: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  cacheDir: string = DEFAULT_DATA_DIR
): Promise<Candle[]> {
  // Validate and sanitize inputs
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol provided');
  }
  if (!timeframe || typeof timeframe !== 'string') {
    throw new Error('Invalid timeframe provided');
  }
  
  // Normalize symbol for file naming (remove dangerous characters)
  const normalizedSymbol = symbol.replace(/[^a-zA-Z0-9_-]/g, '_');
  const normalizedTimeframe = timeframe.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cacheFileName = `${normalizedSymbol}_${normalizedTimeframe}_${startTime}_${endTime}.json`;
  
  // Validate that cache directory is within allowed bounds
  const resolvedCacheDir = path.resolve(cacheDir);
  const resolvedBasePath = path.resolve(DEFAULT_DATA_DIR);
  if (!resolvedCacheDir.startsWith(resolvedBasePath)) {
    throw new Error('Invalid cache directory path');
  }
  
  const cachePath = path.join(resolvedCacheDir, path.basename(cacheFileName));
  
  // Try to load from cache first
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    
    try {
      const cacheFile = await fs.readFile(cachePath, 'utf8');
      const cachedData = JSON.parse(cacheFile);
      logger.info(`Loaded ${cachedData.length} candles from cache for ${symbol} ${timeframe}`);
      return cachedData;
    } catch (err) {
      // Cache file doesn't exist, continue to download
      logger.debug(`No cache found for ${symbol} ${timeframe}, downloading...`);
    }
  } catch (err) {
    logger.warn(`Could not create cache directory: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  try {
    // For this example, we'll generate mock data
    // In production, you would fetch from an exchange API
    const candles = generateMockCandles(symbol, timeframe, startTime, endTime);
    
    // Save to cache
    try {
      await fs.writeFile(cachePath, JSON.stringify(candles));
      logger.debug(`Saved ${candles.length} candles to cache for ${symbol} ${timeframe}`);
    } catch (err) {
      logger.warn(`Could not save to cache: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    return candles;
  } catch (error) {
    logger.error(`Failed to download historical data: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to download historical data for ${symbol} ${timeframe}`);
  }
}

/**
 * Generate mock price data for testing and examples
 */
function generateMockCandles(
  symbol: string,
  timeframe: string,
  startTime: number,
  endTime: number
): Candle[] {
  const candles: Candle[] = [];
  let currentTime = startTime;
  
  // Calculate time increment based on timeframe
  const timeIncrement = getTimeframeMilliseconds(timeframe);
  
  // Initial price
  let price = 30000; // Starting price (e.g., for BTC)
  
  while (currentTime <= endTime) {
    // Generate some realistic price movement with trends and volatility
    const trend = Math.sin(currentTime / (86400000 * 30)) * 5000; // 30-day cycle
    const volatility = (Math.random() - 0.5) * 500; // Random noise
    
    price = Math.max(100, price + trend / 100 + volatility);
    
    // Calculate OHLC
    const open = price;
    const high = open * (1 + Math.random() * 0.02); // Up to 2% higher
    const low = open * (1 - Math.random() * 0.02); // Up to 2% lower
    const close = (open + high + low) / 3 + (Math.random() - 0.5) * (high - low);
    
    // Random volume
    const volume = 10 + Math.random() * 100;
    
    candles.push({
      timestamp: currentTime,
      open,
      high,
      low,
      close,
      volume
    });
    
    currentTime += timeIncrement;
  }
  
  return candles;
}

/**
 * Convert timeframe string to milliseconds
 */
function getTimeframeMilliseconds(timeframe: string): number {
  const unit = timeframe.charAt(timeframe.length - 1);
  const value = parseInt(timeframe.substring(0, timeframe.length - 1));
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: throw new Error(`Invalid timeframe unit: ${unit}`);
  }
}

/**
 * Save candle data to a CSV file for external analysis
 */
export async function exportCandlesToCsv(
  candles: Candle[],
  filePath: string
): Promise<void> {
  try {
    const headers = 'timestamp,datetime,open,high,low,close,volume\n';
    const rows = candles.map(c => 
      `${c.timestamp},${new Date(c.timestamp).toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume}`
    ).join('\n');
    
    const csvContent = headers + rows;
    await fs.writeFile(filePath, csvContent);
    
    logger.info(`Exported ${candles.length} candles to ${filePath}`);
  } catch (error) {
    logger.error(`Failed to export candles to CSV: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
