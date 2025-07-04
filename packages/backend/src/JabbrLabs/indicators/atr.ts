/**
 * Average True Range (ATR) Indicator
 *
 * Calculates market volatility by decomposing the entire range of an asset price for a period.
 *
 * @example
 * // Calculate 14-period ATR for price series
 * const atr = new ATRIndicator({ period: 14 });
 * const result = atr.calculate({ highs, lows, closes });
 */
import { BaseIndicator, type IndicatorMetadata, type IIndicator } from './indicator-interface';

const ATR_METADATA: IndicatorMetadata = {
  name: 'ATR',
  description: 'Average True Range - measures market volatility over a specified period',
  category: 'volatility',
  parameters: [
    {
      name: 'period',
      type: 'number',
      description: 'Number of periods for ATR calculation',
      default: 14,
      min: 1,
      max: 200,
      required: true
    }
  ],
  outputs: [
    {
      name: 'atr',
      type: 'array',
      description: 'Array of ATR values'
    }
  ],
  minimumDataPoints: 2,
  version: '1.0.0'
};

/**
 * ATRIndicator class (preferred usage)
 */
export class ATRIndicator extends BaseIndicator<number[]> {
  /**
   * Create a new ATRIndicator
   * @param parameters Object with ATR parameters
   * @param parameters.period Number of periods for ATR calculation (default: 14)
   * @throws If period is less than 1
   */
  constructor(parameters?: Record<string, unknown>) {
    super(ATR_METADATA, parameters);
    const period = this.getNumericParameter('period', 14);
    if (period < 1) {
      throw new Error('ATR period must be at least 1');
    }
  }

  /**
   * Update ATR parameters
   * @param parameters Object with updated parameters
   * @throws If period is less than 1
   */
  override updateParameters(parameters: Record<string, unknown>): void {
    if ('period' in parameters) {
      const period = Number(parameters.period);
      if (isNaN(period) || period < 1) {
        throw new Error('ATR period must be at least 1');
      }
    }
    super.updateParameters(parameters);
  }

  /**
   * Calculate ATR values for the given price data (expects [high, low, close, high, low, close, ...])
   * or throws if not possible. For full object input, use calculateRaw.
   * @param data Flat array: [high, low, close, ...] (length must be multiple of 3)
   * @returns Array of ATR values
   * @throws If not enough data points or mismatched array lengths
   */
  calculate(data: number[]): number[] {
    // Validate input is a flat array of [high, low, close, ...]
    if (!Array.isArray(data) || data.length % 3 !== 0) {
      throw new Error('ATRIndicator.calculate expects a flat array of [high, low, close, ...]');
    }
    // Validate all values are finite numbers
    this.validateNumericArray(data);
    const highs: number[] = [];
    const lows: number[] = [];
    const closes: number[] = [];
    for (let i = 0; i < data.length; i += 3) {
      // Ensure we have enough data for a complete OHLC set
      if (i + 2 < data.length) {
        const high = data.at(i);
        const low = data.at(i + 1);
        const close = data.at(i + 2);
        if (high !== undefined && low !== undefined && close !== undefined) {
          highs.push(high);
          lows.push(low);
          closes.push(close);
        }
      }
    }
    return this.calculateRaw({ highs, lows, closes });
  }

  /**
   * Calculate ATR values for the given price data (object input)
   * @param data Object with highs, lows, closes arrays
   * @returns Array of ATR values
   * @throws If not enough data points or mismatched array lengths
   */
  calculateRaw(data: {highs: number[], lows: number[], closes: number[]}): number[] {
    const highs = this.validateNumericArray(data.highs);
    const lows = this.validateNumericArray(data.lows);
    const closes = this.validateNumericArray(data.closes);
    if (highs.length !== lows.length || highs.length !== closes.length) {
      throw new Error('High, low, and close arrays must be of the same length');
    }
    const period = this.getNumericParameter('period', 14);
    if (highs.length < period + 1) {
      throw new Error(`Insufficient data for ATR calculation. Need at least ${period + 1} data points.`);
    }
    const trValues: number[] = [];
    const atrValues: number[] = [];
    function assertIsNumber(val: number | undefined, name: string, idx: number): asserts val is number {
      if (val === undefined) {throw new Error(`Missing or invalid ${name} at index ${idx} for ATR calculation`);}
    }
    for (let i = 1; i < highs.length; i++) {
      const highVal = highs.at(i);
      const lowVal = lows.at(i);
      const prevCloseVal = closes.at(i - 1);
      assertIsNumber(highVal, 'high', i);
      assertIsNumber(lowVal, 'low', i);
      assertIsNumber(prevCloseVal, 'prevClose', i);
      const high = highVal as number;
      const low = lowVal as number;
      const prevClose = prevCloseVal as number;
      trValues.push(ATRIndicator.calculateTrueRange(high, low, prevClose));
    }
    const firstATR = trValues.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
    atrValues.push(firstATR);
    for (let i = period; i < trValues.length; i++) {
      const prevAtr = atrValues.at(-1);
      const currentTr = trValues.at(i);
      if (typeof prevAtr !== 'number' || typeof currentTr !== 'number') {
        throw new Error(`Missing or invalid data at index ${i} for ATR smoothing calculation`);
      }
      const atr = (prevAtr * (period - 1) + currentTr) / period;
      atrValues.push(atr);
    }
    return atrValues;
  }

/**
   * Clone the indicator with the same parameters
   * @returns New ATRIndicator instance
   */
  clone(): IIndicator<number[]> {
    return new ATRIndicator(this.getParameters());
  }

  /**
   * Set the period for the ATR calculation
   * @param period Number of periods (must be >= 1)
   * @throws If period is less than 1
   */
  setPeriod(period: number): void {
    if (period < 1) {
      throw new Error('ATR period must be at least 1');
    }
    this.updateParameters({ period });
  }

  /**
   * Get the current ATR period
   * @returns Current ATR period
   */
  getPeriod(): number {
    return this.getNumericParameter('period', 14);
  }

  /**
   * Calculate the true range for a single period
 * @param high Current high price
 * @param low Current low price
 * @param prevClose Previous close price
 * @returns True range value
 */
  static calculateTrueRange(high: number, low: number, prevClose: number): number {
    const range1 = high - low;
    const range2 = Math.abs(high - prevClose);
    const range3 = Math.abs(low - prevClose);
    return Math.max(range1, range2, range3);
  }
}

/**
 * @deprecated Use ATRIndicator class instead.
 */
export const calculateTrueRange = ATRIndicator.calculateTrueRange;

/**
 * @deprecated Use ATRIndicator class instead.
 */
export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) {
    throw new Error('ATR input must be object with highs, lows, closes arrays');
  }
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error('High, low, and close arrays must be of the same length');
  }
  // Flatten to [high, low, close, ...] format
  const flat: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    const h = highs.at(i) ?? NaN;
    const l = lows.at(i) ?? NaN;
    const c = closes.at(i) ?? NaN;
    if (isNaN(h) || isNaN(l) || isNaN(c)) {
      throw new Error(`Missing or invalid data at index ${i} for ATR calculation`);
    }
    flat.push(h, l, c);
  }
  return new ATRIndicator({ period }).calculate(flat);
}

/**
 * Calculate ATR-based stop loss levels (utility, not part of indicator interface)
 *
 * @param closes Array of close prices
 * @param atrValues Array of ATR values
 * @param multiplier ATR multiplier for stop loss (default: 2)
 * @param isLong Boolean indicating if position is long (true) or short (false)
 * @returns Array of stop loss levels
 */
export function calculateATRStopLoss(closes: number[], atrValues: number[], multiplier = 2, isLong = true): number[] {
  if (closes.length < atrValues.length) {
    throw new Error('Close prices array must be at least as long as ATR values array');
  }
  const stopLevels: number[] = [];
  const alignedCloses = closes.slice(closes.length - atrValues.length);
  for (let i = 0; i < atrValues.length; i++) {
    const close = alignedCloses.at(i);
    const atr = atrValues.at(i);
    if (close === undefined || atr === undefined) {
      throw new Error(`Missing data at index ${i} for ATR stop loss calculation`);
    }
    if (isLong) {
      stopLevels.push(close - atr * multiplier);
    } else {
      stopLevels.push(close + atr * multiplier);
    }
  }
  return stopLevels;
}
