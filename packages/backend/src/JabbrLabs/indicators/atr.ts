/**
 * Average True Range (ATR) Indicator
 *
 * ATR is a volatility indicator that measures market volatility by
 * decomposing the entire range of an asset price for a period.
 */

/**
 * Calculate True Range
 *
 * @param high Current high price
 * @param low Current low price
 * @param prevClose Previous close price
 * @returns True range value
 */
export function calculateTrueRange(high: number, low: number, prevClose: number): number {
  const range1 = high - low
  const range2 = Math.abs(high - prevClose)
  const range3 = Math.abs(low - prevClose)

  return Math.max(range1, range2, range3)
}

/**
 * Calculate Average True Range (ATR)
 *
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of close prices
 * @param period ATR period (default: 14)
 * @returns Array of ATR values
 */
export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error("High, low, and close arrays must be of the same length")
  }

  if (highs.length < period + 1) {
    throw new Error(`Insufficient data for ATR calculation. Need at least ${period + 1} data points.`)
  }

  const trValues: number[] = []
  const atrValues: number[] = []

  // Calculate true range values
  for (let i = 1; i < highs.length; i++) {
    trValues.push(calculateTrueRange(highs[i], lows[i], closes[i - 1]))
  }

  // Calculate first ATR value (simple average of first 'period' TR values)
  const firstATR = trValues.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period
  atrValues.push(firstATR)

  // Calculate remaining ATR values using smoothing
  for (let i = period; i < trValues.length; i++) {
    const atr = (atrValues[atrValues.length - 1] * (period - 1) + trValues[i]) / period
    atrValues.push(atr)
  }

  return atrValues
}

/**
 * Calculate ATR-based stop loss levels
 *
 * @param closes Array of close prices
 * @param atrValues Array of ATR values
 * @param multiplier ATR multiplier for stop loss (default: 2)
 * @param isLong Boolean indicating if position is long (true) or short (false)
 * @returns Array of stop loss levels
 */
export function calculateATRStopLoss(closes: number[], atrValues: number[], multiplier = 2, isLong = true): number[] {
  if (closes.length < atrValues.length) {
    throw new Error("Close prices array must be at least as long as ATR values array")
  }

  const stopLevels: number[] = []
  const alignedCloses = closes.slice(closes.length - atrValues.length)

  for (let i = 0; i < atrValues.length; i++) {
    if (isLong) {
      // For long positions, stop loss is below the close price
      stopLevels.push(alignedCloses[i] - atrValues[i] * multiplier)
    } else {
      // For short positions, stop loss is above the close price
      stopLevels.push(alignedCloses[i] + atrValues[i] * multiplier)
    }
  }

  return stopLevels
}
