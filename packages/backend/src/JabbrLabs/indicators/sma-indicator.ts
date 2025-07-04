/**
 * Simple Moving Average (SMA) Indicator
 * 
 * Calculates the arithmetic mean of prices over a specified period.
 *
 * @example
 * // Calculate 3-period SMA for a price series
 * const sma = new SMAIndicator({ period: 3 });
 * const result = sma.calculate([1, 2, 3, 4, 5, 6]); // [2, 3, 4, 5]
 */

import { BaseIndicator, type IndicatorMetadata, type IIndicator } from './indicator-interface';

/**
 * SMA Indicator Metadata
 */
const SMA_METADATA: IndicatorMetadata = {
  name: 'SMA',
  description: 'Simple Moving Average - calculates the arithmetic mean of prices over a specified period',
  category: 'trend',
  parameters: [
    {
      name: 'period',
      type: 'number',
      description: 'Number of periods for SMA calculation',
      default: 14,
      min: 1,
      max: 200,
      required: true
    }
  ],
  outputs: [
    {
      name: 'sma',
      type: 'array',
      description: 'Array of SMA values'
    }
  ],
  minimumDataPoints: 1,
  version: '1.0.0'
};

/**
 * Simple Moving Average (SMA) indicator
 */
export class SMAIndicator extends BaseIndicator<number[]> {
  /**
   * Create a new SMAIndicator
   * @param parameters Object with SMA parameters
   * @param parameters.period Number of periods for SMA calculation (default: 14)
   * @throws If period is less than 1
   */
  constructor(parameters?: Record<string, unknown>) {
    super(SMA_METADATA, parameters);
    // Validate period on instantiation
    const period = this.getNumericParameter('period', 14);
    if (period < 1) {
      throw new Error('SMA period must be at least 1');
    }
  }
  
  /**
   * Update SMA parameters
   * @param parameters Object with updated parameters
   * @throws If period is less than 1
   */
  override updateParameters(parameters: Record<string, unknown>): void {
    if ('period' in parameters) {
      const period = Number(parameters.period);
      if (isNaN(period) || period < 1) {
        throw new Error('SMA period must be at least 1');
      }
    }
    super.updateParameters(parameters);
  }
  
  /**
   * Calculate SMA values for the given price data
   * @param data Array of price data
   * @returns Array of SMA values
   * @throws If not enough data points are provided
   * @example
   * const sma = new SMAIndicator({ period: 3 });
   * sma.calculate([1, 2, 3, 4, 5, 6]); // [2, 3, 4, 5]
   */
  calculate(data: number[]): number[] {
    const validData = this.validateNumericArray(data);
    const period = this.getNumericParameter('period', 14);
    
    this.validateDataLength(validData, period);
    
    const smaValues: number[] = [];
    
    for (let i = period - 1; i < validData.length; i++) {
      const windowPrices = validData.slice(i - period + 1, i + 1);
      const sum = windowPrices.reduce((total, price) => total + price, 0);
      smaValues.push(sum / period);
    }
    
    return smaValues;
  }
  
  /**
   * Clone the indicator with the same parameters
   * @returns New SMAIndicator instance
   */
  clone(): IIndicator<number[]> {
    return new SMAIndicator(this.getParameters());
  }
  
  /**
   * Set the period for the SMA calculation
   * @param period Number of periods (must be >= 1)
   * @throws If period is less than 1
   */
  setPeriod(period: number): void {
    if (period < 1) {
      throw new Error('SMA period must be at least 1');
    }
    this.updateParameters({ period });
  }
  
  /**
   * Get the current SMA period
   * @returns Current SMA period
   */
  getPeriod(): number {
    return this.getNumericParameter('period', 14);
  }
}
