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
    const price = prices.at(i);
    const prevEma = emaValues.at(-1);
    if (price === undefined || prevEma === undefined) {
      throw new Error(`Missing data at index ${i} for EMA calculation`);
    }
    const ema = (price - prevEma) * multiplier + prevEma;
    emaValues.push(ema);
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
    const f = fastMA.at(i);
    const fPrev = fastMA.at(i - 1);
    const s = slowMA.at(i);
    const sPrev = slowMA.at(i - 1);
    if (f === undefined || fPrev === undefined || s === undefined || sPrev === undefined) {
      throw new Error(`Missing moving average value at index ${i} for crossover signal calculation`);
    }
    if (f > s && fPrev <= sPrev) {
      // Bullish crossover (fast MA crosses above slow MA)
      signals.push(1);
    } else if (f < s && fPrev >= sPrev) {
      // Bearish crossover (fast MA crosses below slow MA)
      signals.push(-1);
    } else {
      // No crossover
      signals.push(0);
    }
  }

  return signals
}
