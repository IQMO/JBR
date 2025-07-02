/**
 * Standard Deviation Indicator
 *
 * Standard deviation measures the dispersion of a dataset relative to its mean.
 * In trading, it's often used as a measure of volatility.
 */

/**
 * Calculate Standard Deviation
 *
 * @param values Array of values
 * @returns Standard deviation of the values
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) {
    throw new Error("Insufficient data for standard deviation calculation. Need at least 2 data points.")
  }

  // Calculate mean
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length

  // Calculate sum of squared differences from mean
  const squaredDifferences = values.map((value) => Math.pow(value - mean, 2))
  const sumSquaredDiff = squaredDifferences.reduce((sum, value) => sum + value, 0)

  // Calculate standard deviation
  return Math.sqrt(sumSquaredDiff / values.length)
}

/**
 * Calculate Standard Deviation over a period
 *
 * @param values Array of values
 * @param period Period for calculation
 * @returns Array of standard deviation values
 */
export function calculateStandardDeviationSeries(values: number[], period: number): number[] {
  if (values.length < period) {
    throw new Error(`Insufficient data for standard deviation series. Need at least ${period} data points.`)
  }

  const stdDevValues: number[] = []

  for (let i = period - 1; i < values.length; i++) {
    const windowValues = values.slice(i - period + 1, i + 1)
    stdDevValues.push(calculateStandardDeviation(windowValues))
  }

  return stdDevValues
}
