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
    macdLine.push(fastEMA[i - (slowPeriod - fastPeriod)] - slowEMA[i - startIndex + slowPeriod - 1])
  }

  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod)

  // Calculate histogram (MACD line - signal line)
  const histogram: number[] = []
  for (let i = signalPeriod - 1; i < macdLine.length; i++) {
    histogram.push(macdLine[i] - signalLine[i - signalPeriod + 1])
  }

  // Align all arrays to the same length
  const result = {
    macd: macdLine.slice(signalPeriod - 1),
    signal: signalLine,
    histogram: histogram,
  }

  return result
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
    if (macd[i] > signal[i] && macd[i - 1] <= signal[i - 1]) {
      // Bullish crossover (MACD crosses above signal line)
      signals.push(1)
    } else if (macd[i] < signal[i] && macd[i - 1] >= signal[i - 1]) {
      // Bearish crossover (MACD crosses below signal line)
      signals.push(-1)
    } else {
      // No crossover
      signals.push(0)
    }
  }

  return signals
}
