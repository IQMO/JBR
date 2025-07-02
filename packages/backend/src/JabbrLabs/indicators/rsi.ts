/**
 * Relative Strength Index (RSI) Indicator
 *
 * RSI is a momentum oscillator that measures the speed and change of price movements.
 * It oscillates between 0 and 100 and is typically used to identify overbought or
 * oversold conditions.
 */

/**
 * Calculate Relative Strength Index (RSI)
 *
 * @param prices Array of price values
 * @param period RSI period (default: 14)
 * @returns Array of RSI values
 */
export function calculateRSI(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) {
    throw new Error(`Insufficient data for RSI calculation. Need at least ${period + 1} data points.`)
  }

  const rsiValues: number[] = []
  const gains: number[] = []
  const losses: number[] = []

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period

  // Calculate first RSI value
  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss) // Avoid division by zero
  rsiValues.push(100 - 100 / (1 + rs))

  // Calculate remaining RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period

    rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss) // Avoid division by zero
    rsiValues.push(100 - 100 / (1 + rs))
  }

  return rsiValues
}

/**
 * Get RSI signals based on overbought/oversold levels
 *
 * @param rsiValues Array of RSI values
 * @param overboughtLevel Overbought threshold (default: 70)
 * @param oversoldLevel Oversold threshold (default: 30)
 * @returns Array of signals (1 for buy signal, -1 for sell signal, 0 for no signal)
 */
export function getRSISignals(rsiValues: number[], overboughtLevel = 70, oversoldLevel = 30): number[] {
  const signals: number[] = []

  for (let i = 1; i < rsiValues.length; i++) {
    if (rsiValues[i] < oversoldLevel && rsiValues[i - 1] >= oversoldLevel) {
      // RSI crosses below oversold level - buy signal
      signals.push(1)
    } else if (rsiValues[i] > overboughtLevel && rsiValues[i - 1] <= overboughtLevel) {
      // RSI crosses above overbought level - sell signal
      signals.push(-1)
    } else {
      // No signal
      signals.push(0)
    }
  }

  return signals
}
