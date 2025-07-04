/**
 * Moving Average Convergence Divergence (MACD) Indicator
 *
 * MACD is a trend-following momentum indicator that shows the relationship
 * between two moving averages of a security's price.
 */

import { calculateEMA } from "./moving-averages"

export interface MACDResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 *
 * @param prices Array of price values
 * @param fastPeriod Fast EMA period (default: 12)
 * @param slowPeriod Slow EMA period (default: 26)
 * @param signalPeriod Signal EMA period (default: 9)
 * @returns Object containing MACD, signal, and histogram arrays
 */
export function calculateMACD(prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDResult {
  if (prices.length < Math.max(fastPeriod, slowPeriod) + signalPeriod) {
    throw new Error(
      `Insufficient data for MACD calculation. Need at least ${Math.max(fastPeriod, slowPeriod) + signalPeriod} data points.`,
    )
  }

  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)

  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: number[] = []

  // Align the arrays (slow EMA will have more initial null values)
  const startIndex = slowPeriod - 1

  for (let i = startIndex; i < prices.length; i++) {
    const fastIdx = i - (slowPeriod - fastPeriod);
    const slowIdx = i - startIndex + slowPeriod - 1;
    const fast = fastEMA.at(fastIdx);
    const slow = slowEMA.at(slowIdx);
    if (fast === undefined || slow === undefined) {
      throw new Error(`Missing EMA value at index (fast: ${fastIdx}, slow: ${slowIdx}) for MACD calculation`);
    }
    macdLine.push(fast - slow);
  }

  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod)

  // Calculate histogram (MACD line - signal line)
  const histogram: number[] = []
  for (let i = signalPeriod - 1; i < macdLine.length; i++) {
    const macdVal = macdLine.at(i);
    const signalVal = signalLine.at(i - signalPeriod + 1);
    if (macdVal === undefined || signalVal === undefined) {
      throw new Error(`Missing MACD or signal value at index ${i} for histogram calculation`);
    }
    histogram.push(macdVal - signalVal);
  }

  // Align all arrays to the same length
  return {
    macd: macdLine.slice(signalPeriod - 1),
    signal: signalLine,
    histogram,
  }
}

/**
 * Get MACD crossover signals
 *
 * @param macdResult MACD calculation result
 * @returns Array of signals (1 for bullish crossover, -1 for bearish crossover, 0 for no crossover)
 */
export function getMACDSignals(macdResult: MACDResult): number[] {
  const { macd, signal } = macdResult
  const signals: number[] = []

  for (let i = 1; i < macd.length; i++) {
    const m = macd.at(i);
    const mPrev = macd.at(i - 1);
    const s = signal.at(i);
    const sPrev = signal.at(i - 1);
    if (m === undefined || mPrev === undefined || s === undefined || sPrev === undefined) {
      throw new Error(`Missing MACD or signal value at index ${i} for crossover signal calculation`);
    }
    if (m > s && mPrev <= sPrev) {
      // Bullish crossover (MACD crosses above signal line)
      signals.push(1);
    } else if (m < s && mPrev >= sPrev) {
      // Bearish crossover (MACD crosses below signal line)
      signals.push(-1);
    } else {
      // No crossover
      signals.push(0);
    }
  }

  return signals
}
