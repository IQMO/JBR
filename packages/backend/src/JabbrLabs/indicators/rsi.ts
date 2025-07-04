/**
 * Relative Strength Index (RSI) Indicator
 *
 * Calculates the momentum oscillator that measures the speed and change of price movements.
 *
 * @example
 * // Calculate 14-period RSI for a price series
 * const rsi = new RSIIndicator({ period: 14 });
 * const result = rsi.calculate([1, 2, 3, 2, 1, 2, 3, 4, 5]);
 */
import { BaseIndicator, type IndicatorMetadata, type IIndicator } from './indicator-interface';

const RSI_METADATA: IndicatorMetadata = {
  name: 'RSI',
  description: 'Relative Strength Index - momentum oscillator for overbought/oversold conditions',
  category: 'momentum',
  parameters: [
    {
      name: 'period',
      type: 'number',
      description: 'Number of periods for RSI calculation',
      default: 14,
      min: 1,
      max: 200,
      required: true
    }
  ],
  outputs: [
    {
      name: 'rsi',
      type: 'array',
      description: 'Array of RSI values'
    }
  ],
  minimumDataPoints: 2,
  version: '1.0.0'
};

/**
 * RSIIndicator class (preferred usage)
 */
export class RSIIndicator extends BaseIndicator<number[]> {
  /**
   * Create a new RSIIndicator
   * @param parameters Object with RSI parameters
   * @param parameters.period Number of periods for RSI calculation (default: 14)
   * @throws If period is less than 1
   */
  constructor(parameters?: Record<string, unknown>) {
    super(RSI_METADATA, parameters);
    const period = this.getNumericParameter('period', 14);
    if (period < 1) {
      throw new Error('RSI period must be at least 1');
    }
  }

  /**
   * Update RSI parameters
   * @param parameters Object with updated parameters
   * @throws If period is less than 1
   */
  override updateParameters(parameters: Record<string, unknown>): void {
    if ('period' in parameters) {
      const period = Number(parameters.period);
      if (isNaN(period) || period < 1) {
        throw new Error('RSI period must be at least 1');
      }
    }
    super.updateParameters(parameters);
  }

  /**
   * Calculate RSI values for the given price data
   * @param data Array of price values
   * @returns Array of RSI values
   * @throws If not enough data points
   * @example
   * const rsi = new RSIIndicator({ period: 14 });
   * rsi.calculate([1, 2, 3, 2, 1, 2, 3, 4, 5]);
   */
  calculate(data: number[]): number[] {
    const prices = this.validateNumericArray(data);
    const period = this.getNumericParameter('period', 14);
    if (prices.length < period + 1) {
      throw new Error(`Insufficient data for RSI calculation. Need at least ${period + 1} data points.`);
    }
    const rsiValues: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const price = prices.at(i);
      const prevPrice = prices.at(i - 1);
      if (price === undefined || prevPrice === undefined) {
        throw new Error(`Missing price at index ${i} for RSI calculation`);
      }
      const change = price - prevPrice;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    rsiValues.push(100 - 100 / (1 + rs));
    for (let i = period; i < gains.length; i++) {
      const gain = gains.at(i);
      const loss = losses.at(i);
      if (gain === undefined || loss === undefined) {
        throw new Error(`Missing gain/loss at index ${i} for RSI smoothing calculation`);
      }
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
      rsiValues.push(100 - 100 / (1 + rs));
    }
    return rsiValues;
  }

  /**
   * Clone the indicator with the same parameters
   * @returns New RSIIndicator instance
   */
  clone(): IIndicator<number[]> {
    return new RSIIndicator(this.getParameters());
  }

  /**
   * Set the period for the RSI calculation
   * @param period Number of periods (must be >= 1)
   * @throws If period is less than 1
   */
  setPeriod(period: number): void {
    if (period < 1) {
      throw new Error('RSI period must be at least 1');
    }
    this.updateParameters({ period });
  }

  /**
   * Get the current RSI period
   * @returns Current RSI period
   */
  getPeriod(): number {
    return this.getNumericParameter('period', 14);
  }
}

/**
 * @deprecated Use RSIIndicator class instead.
 */
export function calculateRSI(prices: number[], period = 14): number[] {
  return new RSIIndicator({ period }).calculate(prices);
}

/**
 * Get RSI signals based on overbought/oversold levels (utility, not part of indicator interface)
 *
 * @param rsiValues Array of RSI values
 * @param overboughtLevel Overbought threshold (default: 70)
 * @param oversoldLevel Oversold threshold (default: 30)
 * @returns Array of signals (1 for buy signal, -1 for sell signal, 0 for no signal)
 */
export function getRSISignals(rsiValues: number[], overboughtLevel = 70, oversoldLevel = 30): number[] {
  const signals: number[] = [];
  for (let i = 1; i < rsiValues.length; i++) {
    const rsi = rsiValues.at(i);
    const rsiPrev = rsiValues.at(i - 1);
    if (rsi === undefined || rsiPrev === undefined) {
      throw new Error(`Missing RSI value at index ${i} for signal calculation`);
    }
    if (rsi < oversoldLevel && rsiPrev >= oversoldLevel) {
      signals.push(1);
    } else if (rsi > overboughtLevel && rsiPrev <= overboughtLevel) {
      signals.push(-1);
    } else {
      signals.push(0);
    }
  }
  return signals;
}
