/**
 * Bollinger Bands Indicator
 *
 * Bollinger Bands consist of a middle band (SMA) with upper and lower bands
 * at a standard deviation level above and below the middle band.
 */

import { calculateSMA } from "./moving-averages"
import { calculateStandardDeviation } from "./standard-deviation"

export interface BollingerBandsResult {
  upper: number[]
  middle: number[]
  lower: number[]
  bandwidth: number[]
  percentB: number[]
}

/**
 * Calculate Bollinger Bands
 *
 * @param prices Array of price values
 * @param period Period for SMA calculation (default: 20)
 * @param multiplier Standard deviation multiplier (default: 2)
 * @returns Object containing upper, middle, lower bands, bandwidth, and %B
 */
export function calculateBollingerBands(prices: number[], period = 20, multiplier = 2): BollingerBandsResult {
  if (prices.length < period) {
    throw new Error(`Insufficient data for Bollinger Bands calculation. Need at least ${period} data points.`)
  }

  const result: BollingerBandsResult = {
    upper: [],
    middle: [],
    lower: [],
    bandwidth: [],
    percentB: [],
  }

  // Calculate middle band (SMA)
  result.middle = calculateSMA(prices, period)

  // Calculate Bollinger Bands for each point
  for (let i = period - 1; i < prices.length; i++) {
    const windowPrices = prices.slice(i - period + 1, i + 1)
    const stdDev = calculateStandardDeviation(windowPrices)

    const upperBand = result.middle[i - period + 1] + multiplier * stdDev
    const lowerBand = result.middle[i - period + 1] - multiplier * stdDev

    result.upper.push(upperBand)
    result.lower.push(lowerBand)

    // Calculate bandwidth: (upper - lower) / middle
    const bandwidth = (upperBand - lowerBand) / result.middle[i - period + 1]
    result.bandwidth.push(bandwidth)

    // Calculate %B: (price - lower) / (upper - lower)
    const percentB = (prices[i] - lowerBand) / (upperBand - lowerBand)
    result.percentB.push(percentB)
  }

  return result
}

/**
 * Get Bollinger Bands signals
 *
 * @param prices Current price array
 * @param bollingerBands Bollinger Bands calculation result
 * @returns Array of signals (1 for buy signal, -1 for sell signal, 0 for no signal)
 */
export function getBollingerBandsSignals(prices: number[], bollingerBands: BollingerBandsResult): number[] {
  const { upper, lower } = bollingerBands
  const signals: number[] = []

  // Align prices with Bollinger Bands (which start after 'period' elements)
  const alignedPrices = prices.slice(prices.length - upper.length)

  for (let i = 1; i < alignedPrices.length; i++) {
    if (alignedPrices[i] < lower[i] && alignedPrices[i - 1] >= lower[i - 1]) {
      // Price crosses below lower band - potential buy signal
      signals.push(1)
    } else if (alignedPrices[i] > upper[i] && alignedPrices[i - 1] <= upper[i - 1]) {
      // Price crosses above upper band - potential sell signal
      signals.push(-1)
    } else {
      // No signal
      signals.push(0)
    }
  }

  return signals
}
