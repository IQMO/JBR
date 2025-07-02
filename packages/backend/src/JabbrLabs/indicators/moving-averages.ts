/**
 * Moving Averages Indicators
 *
 * This file contains implementations of Simple Moving Average (SMA) and
 * Exponential Moving Average (EMA) calculations.
 */

/**
 * Calculate Simple Moving Average (SMA)
 *
 * @param prices Array of price values
 * @param period Period for SMA calculation
 * @returns Array of SMA values
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    throw new Error(`Insufficient data for SMA calculation. Need at least ${period} data points.`)
  }

  const smaValues: number[] = []

  for (let i = period - 1; i < prices.length; i++) {
    const windowPrices = prices.slice(i - period + 1, i + 1)
    const sum = windowPrices.reduce((total, price) => total + price, 0)
    smaValues.push(sum / period)
  }

  return smaValues
}

/**
 * Calculate Exponential Moving Average (EMA)
 *
 * @param prices Array of price values
 * @param period Period for EMA calculation
 * @returns Array of EMA values
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    throw new Error(`Insufficient data for EMA calculation. Need at least ${period} data points.`)
  }

  const emaValues: number[] = []
  const multiplier = 2 / (period + 1)

  // Calculate SMA for the first EMA value
  const firstSMA = prices.slice(0, period).reduce((total, price) => total + price, 0) / period
  emaValues.push(firstSMA)

  // Calculate remaining EMA values
  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1]
    emaValues.push(ema)
  }

  return emaValues
}

/**
 * Get moving average crossover signals
 *
 * @param fastMA Array of fast moving average values
 * @param slowMA Array of slow moving average values
 * @returns Array of signals (1 for bullish crossover, -1 for bearish crossover, 0 for no crossover)
 */
export function getMASignals(fastMA: number[], slowMA: number[]): number[] {
  if (fastMA.length !== slowMA.length) {
    throw new Error("Moving average arrays must be of the same length")
  }

  const signals: number[] = []

  for (let i = 1; i < fastMA.length; i++) {
    if (fastMA[i] > slowMA[i] && fastMA[i - 1] <= slowMA[i - 1]) {
      // Bullish crossover (fast MA crosses above slow MA)
      signals.push(1)
    } else if (fastMA[i] < slowMA[i] && fastMA[i - 1] >= slowMA[i - 1]) {
      // Bearish crossover (fast MA crosses below slow MA)
      signals.push(-1)
    } else {
      // No crossover
      signals.push(0)
    }
  }

  return signals
}
