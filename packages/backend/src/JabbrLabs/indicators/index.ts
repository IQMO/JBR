/**
 * Unified Indicators Library
 * 
 * Central export point for all technical indicators with factory pattern
 * and utility functions for indicator management.
 */

// Core Interfaces and Base Classes
export * from './indicator-interface';
export type { 
  IIndicator, 
  IndicatorMetadata, 
  IndicatorResult,
  BaseIndicator 
} from './indicator-interface';

// Individual Indicator Exports
export * from './moving-averages';
export * from './sma-indicator';
export * from './ema-indicator';
export * from './macd';
export * from './macd-indicator';
export * from './rsi';
export * from './bollinger-bands';
export * from './bollinger-bands-indicator';
export * from './atr';
export * from './standard-deviation';
export * from './average-price';

// Import indicator classes for factory
import { ATRIndicator } from './atr';
import { BollingerBandsIndicator } from './bollinger-bands-indicator';
import { EMAIndicator } from './ema-indicator';
import type { IIndicator, IndicatorMetadata } from './indicator-interface';
import { MACDIndicator } from './macd-indicator';
import { RSIIndicator } from './rsi';
import { SMAIndicator } from './sma-indicator';

// Import function-based indicators for compatibility
export * from './macd';
export * from './bollinger-bands';
export * from './standard-deviation';
export * from './average-price';

/**
 * Indicator constructor type
 */
export type IndicatorConstructor = new (parameters?: Record<string, unknown>) => IIndicator<any>;

/**
 * Registry of all available indicators
 */
export const IndicatorRegistry: Record<string, IndicatorConstructor> = {
  'sma': SMAIndicator,
  'ema': EMAIndicator,
  'macd': MACDIndicator,
  'bollinger-bands': BollingerBandsIndicator,
  'rsi': RSIIndicator,
  'atr': ATRIndicator,
  
  // Aliases for convenience
  'simple-moving-average': SMAIndicator,
  'exponential-moving-average': EMAIndicator,
  'moving-average-convergence-divergence': MACDIndicator,
  'bb': BollingerBandsIndicator,
  'bbands': BollingerBandsIndicator,
  'relative-strength-index': RSIIndicator,
  'average-true-range': ATRIndicator
};

/**
 * Indicator Factory for creating indicators by name
 */
export class IndicatorFactory {
  /**
   * Create an indicator by name
   * 
   * @param name Indicator name (e.g., 'sma', 'ema', 'rsi')
   * @param parameters Optional parameters for the indicator
   * @returns Indicator instance
   */
  static create(name: string, parameters?: Record<string, unknown>): IIndicator {
    const IndicatorClass = IndicatorRegistry[name.toLowerCase()];
    
    if (!IndicatorClass) {
      throw new Error(`Unknown indicator: ${name}. Available indicators: ${Object.keys(IndicatorRegistry).join(', ')}`);
    }
    
    return new IndicatorClass(parameters);
  }
  
  /**
   * Get list of all available indicator names
   * 
   * @returns Array of indicator names
   */
  static getAvailableIndicators(): string[] {
    return Object.keys(IndicatorRegistry);
  }
  
  /**
   * Get metadata for all available indicators
   * 
   * @returns Array of indicator metadata
   */
  static getAllMetadata(): IndicatorMetadata[] {
    return Object.values(IndicatorRegistry).map(IndicatorClass => {
      const instance = new IndicatorClass();
      return instance.getMetadata();
    });
  }
  
  /**
   * Get metadata for a specific indicator
   * 
   * @param name Indicator name
   * @returns Indicator metadata
   */
  static getMetadata(name: string): IndicatorMetadata {
    const indicator = this.create(name);
    return indicator.getMetadata();
  }
  
  /**
   * Check if an indicator exists
   * 
   * @param name Indicator name
   * @returns True if indicator exists
   */
  static exists(name: string): boolean {
    return name.toLowerCase() in IndicatorRegistry;
  }
  
  /**
   * Get indicators by category
   * 
   * @param category Indicator category
   * @returns Array of indicator names in the category
   */
  static getByCategory(category: IndicatorMetadata['category']): string[] {
    return Object.keys(IndicatorRegistry).filter(name => {
      const indicator = this.create(name);
      return indicator.getMetadata().category === category;
    });
  }
}

/**
 * Utility functions for indicator management
 */
export class IndicatorUtils {
  /**
   * Validate indicator parameters against metadata
   * 
   * @param indicatorName Indicator name
   * @param parameters Parameters to validate
   * @returns Validation result
   */
  static validateParameters(indicatorName: string, parameters: Record<string, unknown>): { valid: boolean; errors: string[] } {
    try {
      const indicator = IndicatorFactory.create(indicatorName);
      return indicator.validateParameters(parameters);
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
  
  /**
   * Get default parameters for an indicator
   * 
   * @param indicatorName Indicator name
   * @returns Default parameters
   */
  static getDefaultParameters(indicatorName: string): Record<string, unknown> {
    const metadata = IndicatorFactory.getMetadata(indicatorName);
    const defaults: Record<string, unknown> = {};
    
    for (const param of metadata.parameters) {
      defaults[param.name] = param.default;
    }
    
    return defaults;
  }
  
  /**
   * Create multiple indicators from configuration
   * 
   * @param configs Array of indicator configurations
   * @returns Array of indicator instances
   */
  static createMultiple(configs: Array<{ name: string; parameters?: Record<string, unknown> }>): IIndicator[] {
    return configs.map(config => IndicatorFactory.create(config.name, config.parameters));
  }
  
  /**
   * Calculate multiple indicators on the same data
   * 
   * @param data Input price data
   * @param indicators Array of indicator instances
   * @returns Array of calculation results
   */
  static calculateMultiple(data: number[], indicators: IIndicator[]): Array<{ name: string; result: any }> {
    return indicators.map(indicator => ({
      name: indicator.getName(),
      result: indicator.calculate(data)
    }));
  }
}

/**
 * Pre-configured indicator sets for common use cases
 */
export const IndicatorSets = {
  /**
   * Basic trend following indicators
   */
  trendFollowing: () => [
    IndicatorFactory.create('sma', { period: 20 }),
    IndicatorFactory.create('ema', { period: 12 }),
    IndicatorFactory.create('ema', { period: 26 }),
    IndicatorFactory.create('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })
  ],
  
  /**
   * Momentum oscillators
   */
  momentum: () => [
    IndicatorFactory.create('rsi', { period: 14 }),
    IndicatorFactory.create('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })
  ],
  
  /**
   * Volatility indicators
   */
  volatility: () => [
    IndicatorFactory.create('atr', { period: 14 }),
    IndicatorFactory.create('bollinger-bands', { period: 20, multiplier: 2 })
  ],
  
  /**
   * Mean reversion indicators
   */
  meanReversion: () => [
    IndicatorFactory.create('bollinger-bands', { period: 20, multiplier: 2 }),
    IndicatorFactory.create('rsi', { period: 14 })
  ],
  
  /**
   * Complete technical analysis suite
   */
  complete: () => [
    ...IndicatorSets.trendFollowing(),
    ...IndicatorSets.momentum(),
    ...IndicatorSets.volatility()
  ],
  
  /**
   * Day trading focused indicators
   */
  dayTrading: () => [
    IndicatorFactory.create('ema', { period: 9 }),
    IndicatorFactory.create('ema', { period: 21 }),
    IndicatorFactory.create('rsi', { period: 14 }),
    IndicatorFactory.create('bollinger-bands', { period: 20, multiplier: 2 })
  ],
  
  /**
   * Swing trading indicators
   */
  swingTrading: () => [
    IndicatorFactory.create('sma', { period: 50 }),
    IndicatorFactory.create('sma', { period: 200 }),
    IndicatorFactory.create('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
    IndicatorFactory.create('rsi', { period: 14 })
  ]
};

/**
 * Default export for convenience
 */
export default {
  Factory: IndicatorFactory,
  Utils: IndicatorUtils,
  Sets: IndicatorSets,
  Registry: IndicatorRegistry
};
