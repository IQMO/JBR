/**
 * Exponential Moving Average (EMA) Indicator
 * 
 * Calculates the exponentially weighted moving average of prices over a specified period.
 *
 * @example
 * // Calculate 3-period EMA for a price series
 * const ema = new EMAIndicator({ period: 3, smoothing: 2 });
 * const result = ema.calculate([2, 4, 6, 8, 10]); // [2, 3, 4.5, 6.25, 8.125]
 */

import { BaseIndicator, type IndicatorMetadata, type IIndicator } from './indicator-interface';

/**
 * EMA Indicator Metadata
 */
const EMA_METADATA: IndicatorMetadata = {
  name: 'EMA',
  description: 'Exponential Moving Average - gives more weight to recent prices with exponential decay',
  category: 'trend',
  parameters: [
    {
      name: 'period',
      type: 'number',
      description: 'Number of periods for EMA calculation',
      default: 14,
      min: 1,
      max: 200,
      required: true
    },
    {
      name: 'smoothing',
      type: 'number',
      description: 'Smoothing factor (2 = standard EMA)',
      default: 2,
      min: 0.1,
      max: 10,
      required: false
    }
  ],
  outputs: [
    {
      name: 'ema',
      type: 'array',
      description: 'Array of EMA values'
    }
  ],
  minimumDataPoints: 1,
  version: '1.0.0'
};

/**
 * Exponential Moving Average (EMA) indicator
 */
export class EMAIndicator extends BaseIndicator<number[]> {
  /**
   * Create a new EMAIndicator
   * @param parameters Object with EMA parameters
   * @param parameters.period Number of periods for EMA calculation (default: 14)
   * @param parameters.smoothing Smoothing factor (default: 2)
   * @throws If period is less than 1 or smoothing is not positive
   */
  constructor(parameters?: Record<string, unknown>) {
    super(EMA_METADATA, parameters);
    // Validate period and smoothing on instantiation
    const period = this.getNumericParameter('period', 14);
    const smoothing = this.getNumericParameter('smoothing', 2);
    if (period < 1) {
      throw new Error('EMA period must be at least 1');
    }
    if (smoothing <= 0) {
      throw new Error('EMA smoothing factor must be positive');
    }
  }
  
  /**
   * Update EMA parameters
   * @param parameters Object with updated parameters
   * @throws If period is less than 1 or smoothing is not positive
   */
  override updateParameters(parameters: Record<string, unknown>): void {
    if ('period' in parameters) {
      const period = Number(parameters.period);
      if (isNaN(period) || period < 1) {
        throw new Error('EMA period must be at least 1');
      }
    }
    if ('smoothing' in parameters) {
      const smoothing = Number(parameters.smoothing);
      if (isNaN(smoothing) || smoothing <= 0) {
        throw new Error('EMA smoothing factor must be positive');
      }
    }
    super.updateParameters(parameters);
  }
  
  /**
   * Calculate EMA values for the given price data
   * @param data Array of price data
   * @returns Array of EMA values
   * @throws If not enough data points are provided
   * @example
   * const ema = new EMAIndicator({ period: 3, smoothing: 2 });
   * ema.calculate([2, 4, 6, 8, 10]); // [2, 3, 4.5, 6.25, 8.125]
   */
  calculate(data: number[]): number[] {
    const validData = this.validateNumericArray(data);
    const period = this.getNumericParameter('period', 14);
    const smoothing = this.getNumericParameter('smoothing', 2);
    
    this.validateDataLength(validData, period);
    
    if (validData.length === 0) {
      return [];
    }
    
    const multiplier = smoothing / (period + 1);
    const emaValues: number[] = [];
    
    // First EMA value is the first price
    const firstPrice = validData[0];
    if (firstPrice !== undefined) {
      emaValues.push(firstPrice);
    } else {
      throw new Error('First price is undefined');
    }
    
    // Calculate subsequent EMA values
    for (let i = 1; i < validData.length; i++) {
      const currentPrice = validData.at(i);
      const previousEma = emaValues.at(i - 1);
      
      if (currentPrice !== undefined && previousEma !== undefined) {
        const ema = (currentPrice * multiplier) + (previousEma * (1 - multiplier));
        emaValues.push(ema);
      }
    }
    
    return emaValues;
  }
  
  /**
   * Clone the indicator with the same parameters
   * @returns New EMAIndicator instance
   */
  clone(): IIndicator<number[]> {
    return new EMAIndicator(this.getParameters());
  }
  
  /**
   * Set the period for the EMA calculation
   * @param period Number of periods (must be >= 1)
   * @throws If period is less than 1
   */
  setPeriod(period: number): void {
    if (period < 1) {
      throw new Error('EMA period must be at least 1');
    }
    this.updateParameters({ period });
  }
  
  /**
   * Get the current EMA period
   * @returns Current EMA period
   */
  getPeriod(): number {
    return this.getNumericParameter('period', 14);
  }
  
  /**
   * Set the smoothing factor for the EMA calculation
   * @param smoothing Smoothing factor (must be > 0)
   * @throws If smoothing is not positive
   */
  setSmoothing(smoothing: number): void {
    if (smoothing <= 0) {
      throw new Error('EMA smoothing factor must be positive');
    }
    this.updateParameters({ smoothing });
  }
  
  /**
   * Get the current EMA smoothing factor
   * @returns Current EMA smoothing factor
   */
  getSmoothing(): number {
    return this.getNumericParameter('smoothing', 2);
  }
}
