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
    const windowPrices = prices.slice(i - period + 1, i + 1);
    const stdDev = calculateStandardDeviation(windowPrices);
    const middleIdx = i - period + 1;
    const middle = result.middle.at(middleIdx);
    if (middle === undefined) {
      throw new Error(`Missing middle band value at index ${middleIdx}`);
    }
    const upperBand = middle + multiplier * stdDev;
    const lowerBand = middle - multiplier * stdDev;
    result.upper.push(upperBand);
    result.lower.push(lowerBand);
    // Calculate bandwidth: (upper - lower) / middle
    const bandwidth = (upperBand - lowerBand) / middle;
    result.bandwidth.push(bandwidth);
    // Calculate %B: (price - lower) / (upper - lower)
    const price = prices.at(i);
    if (price === undefined) {
      throw new Error(`Missing price at index ${i}`);
    }
    const percentB = (price - lowerBand) / (upperBand - lowerBand);
    result.percentB.push(percentB);
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
    const price = alignedPrices.at(i);
    const pricePrev = alignedPrices.at(i - 1);
    const l = lower.at(i);
    const lPrev = lower.at(i - 1);
    const u = upper.at(i);
    const uPrev = upper.at(i - 1);
    if (
      price !== undefined && l !== undefined && pricePrev !== undefined && lPrev !== undefined &&
      price < l && pricePrev >= lPrev
    ) {
      // Price crosses below lower band - potential buy signal
      signals.push(1);
    } else if (
      price !== undefined && u !== undefined && pricePrev !== undefined && uPrev !== undefined &&
      price > u && pricePrev <= uPrev
    ) {
      // Price crosses above upper band - potential sell signal
      signals.push(-1);
    } else {
      // No signal
      signals.push(0);
    }
  }

  return signals
}
