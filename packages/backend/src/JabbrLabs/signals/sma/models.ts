/**
 * SMA Signal Processor Models
 * 
 * Defines interfaces and types for the SMA signal processing system.
 */

/**
 * Configuration interface for SMA signal processing
 */
export interface SMASignalConfig {
  // Short period for fast-moving average
  fastPeriod: number;
  
  // Long period for slow-moving average
  slowPeriod: number;
  
  // Minimum price change percentage to consider a signal valid (0-100)
  minChangePercent?: number;
  
  // Minimum confidence to generate a signal (0-1)
  confidenceThreshold?: number;
  
  // Price data source to use (close, open, high, low)
  priceSource: 'close' | 'open' | 'high' | 'low';
  
  // Signal generation mode (crossover, trend, or both)
  signalMode: 'crossover' | 'trend' | 'combined';
  
  // Whether to use EMA instead of SMA for faster response
  useEMA?: boolean;
}

/**
 * SMA signal output
 */
export interface SMASignalOutput {
  // Signal direction: 1 for buy, -1 for sell, 0 for no signal
  signal: number;
  
  // Confidence level 0-1
  confidence: number;
  
  // Last prices used in calculation
  lastPrice: number;
  
  // Fast Moving Average value
  fastMA: number;
  
  // Slow Moving Average value
  slowMA: number;
  
  // Signal reason/explanation
  reason: string;
  
  // Signal strength (calculated based on price distance from MA)
  strength: number;
  
  // Signal timestamp
  timestamp: number;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
}
