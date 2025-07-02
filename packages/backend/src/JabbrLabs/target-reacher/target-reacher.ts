/**
 * Modular Target Reacher Strategy
 * 
 * Redesigned Target Reacher strategy using the new modular system
 */

import type { 
  IStrategy, 
  StrategyConfig, 
  StrategyContext, 
  StrategyResult, 
  StrategyState,
  ConfigValidationResult,
  Candle
} from './interfaces'
import { validateConfig, ConfigValidator } from './config-validator'

export class ModularTargetReacherStrategy implements IStrategy {
  readonly name = 'target-reacher'
  readonly version = '2.0.0'
  readonly description = 'Modular Target Reacher strategy with fixed and average price sources (pure signal generator)'
  readonly supportedMarkets = ['spot', 'futures', 'cross-margin'] as const

  constructor(private readonly config: StrategyConfig, private readonly context: StrategyContext) {}

  async initialize(): Promise<void> {
    // No-op for pure signal strategy
  }

  async execute(): Promise<StrategyResult> {
    const { priceSource, fixedPrice, averagePeriod, averageType } = this.config.parameters
    const currentPriceRaw = await this.context.marketData.getCurrentPrice(this.context.symbol)
    const currentPrice = typeof currentPriceRaw === 'number' ? currentPriceRaw : Number(currentPriceRaw) || 0
    let targetPrice: number | undefined

    if (priceSource === 'fixed') {
      targetPrice = typeof fixedPrice === 'number' ? fixedPrice : Number(fixedPrice) || undefined
    } else if (priceSource === 'average') {
      const avgPeriod = typeof averagePeriod === 'number' && !isNaN(averagePeriod) ? averagePeriod : 20;
      const candles: Candle[] = await this.context.marketData.getCandles(this.context.symbol, '1h', avgPeriod)
      const priceKey: keyof Candle = (averageType ?? 'low') as keyof Candle;
      targetPrice = candles.length > 0
        ? candles.reduce((sum, c) => {
            const val = c[priceKey];
            return sum + (typeof val === 'number' ? val : Number(val) || 0);
          }, 0) / candles.length
        : undefined;
    } else {
      throw new Error('Unsupported price source')
    }

    if (typeof targetPrice === 'number') {
      if (currentPrice <= targetPrice) {
        return { success: true, action: 'buy', reason: `Current price <= target (${targetPrice})` }
      } else if (currentPrice >= targetPrice) {
        return { success: true, action: 'sell', reason: `Current price >= target (${targetPrice})` }
      }
    }
    return { success: true, action: 'hold', reason: 'No signal' }
  }

  async cleanup(): Promise<void> {
    // No-op for pure signal strategy
  }

  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    return validateConfig(config, (validator: ConfigValidator) => {
      validator.required(config, 'parameters')
      const params = config.parameters as Record<string, unknown>
      validator.string(params, 'priceSource', { enum: ['fixed', 'average'], fieldName: 'Price Source' })
      if (params.priceSource === 'fixed') {
        validator.number(params, 'fixedPrice', { min: 0, fieldName: 'Fixed Price' })
      } else if (params.priceSource === 'average') {
        validator.number(params, 'averagePeriod', { min: 1, max: 500, integer: true, fieldName: 'Average Period' })
        validator.string(params, 'averageType', { enum: ['low', 'close', 'high', 'open'], fieldName: 'Average Type' })
      }
    })
  }

  getDefaultConfig(): StrategyConfig {
    // Provide a unique default config for ModularTargetReacherStrategy
    return {
      type: 'modular-target-reacher',
      parameters: {
        priceSource: 'fixed',
        fixedPrice: 50,
        averagePeriod: 10,
        averageType: 'close',
      },
    };
  }

  getState(): StrategyState {
    // Provide a unique state for ModularTargetReacherStrategy
    return {
      isRunning: false,
      totalProfit: 0,
      tradesExecuted: 0,
      lastUpdate: new Date(),
      customState: { modular: true },
    };
  }
  setState(): void {
    // No-op for pure signal strategy
  }
}

// Canonical export for production usage
// All backend logic is strictly in ./lib/ per project instructions
export class TargetReacherStrategy {
  readonly name = 'target-reacher'
  readonly version = '2.0.0'
  readonly description = 'Modular Target Reacher strategy with fixed and average price sources (pure signal generator)'
  readonly supportedMarkets = ['spot', 'futures', 'cross-margin'] as const

  constructor(private readonly config: StrategyConfig, private readonly context: StrategyContext) {}

  async initialize(): Promise<void> {
    // No-op for pure signal strategy
  }

  async execute(): Promise<StrategyResult> {
    const { priceSource, fixedPrice, averagePeriod, averageType } = this.config.parameters;
    const currentPriceRaw = await this.context.marketData.getCurrentPrice(this.context.symbol);
    const currentPrice = typeof currentPriceRaw === 'number' ? currentPriceRaw : Number(currentPriceRaw) || 0;
    let targetPrice: number | undefined;

    if (priceSource === 'fixed') {
      targetPrice = typeof fixedPrice === 'number' ? fixedPrice : Number(fixedPrice) || undefined;
    } else if (priceSource === 'average') {
      const avgPeriod = typeof averagePeriod === 'number' && !isNaN(averagePeriod) ? averagePeriod : 20;
      const candles: Candle[] = await this.context.marketData.getCandles(this.context.symbol, '1h', avgPeriod);
      const priceKey: keyof Candle = (averageType ?? 'low') as keyof Candle;
      targetPrice = candles.length > 0
        ? candles.reduce((sum, c) => {
            const val = c[priceKey];
            return sum + (typeof val === 'number' ? val : Number(val) || 0);
          }, 0) / candles.length
        : undefined;
    } else {
      throw new Error('Unsupported price source');
    }

    if (typeof targetPrice === 'number') {
      if (currentPrice <= targetPrice) {
        return { success: true, action: 'buy', reason: `Current price <= target (${targetPrice})` };
      } else if (currentPrice >= targetPrice) {
        return { success: true, action: 'sell', reason: `Current price >= target (${targetPrice})` };
      }
    }
    return { success: true, action: 'hold', reason: 'No signal' };
  }

  async cleanup(): Promise<void> {
    // No-op for pure signal strategy
  }

  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    return validateConfig(config, (validator: ConfigValidator) => {
      validator.required(config, 'parameters');
      const params = config.parameters as Record<string, unknown>;
      validator.string(params, 'priceSource', { enum: ['fixed', 'average'], fieldName: 'Price Source' });
      if (params.priceSource === 'fixed') {
        validator.number(params, 'fixedPrice', { min: 0, fieldName: 'Fixed Price' });
      } else if (params.priceSource === 'average') {
        validator.number(params, 'averagePeriod', { min: 1, max: 500, integer: true, fieldName: 'Average Period' });
        validator.string(params, 'averageType', { enum: ['low', 'close', 'high', 'open'], fieldName: 'Average Type' });
      }
    });
  }

  getDefaultConfig(): StrategyConfig {
    // Provide a unique default config for TargetReacherStrategy
    return {
      type: 'target-reacher',
      parameters: {
        priceSource: 'fixed',
        fixedPrice: 100,
        averagePeriod: 10,
        averageType: 'close',
      },
    };
  }

  // Fix: Implement getState to return a valid StrategyState
  getState(): StrategyState {
    return {
      isRunning: false,
      totalProfit: 0,
      tradesExecuted: 0,
      lastUpdate: new Date(),
      customState: {},
    };
  }
  setState(): void {
    // No-op for pure signal strategy
  }
}
