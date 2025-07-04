/**
 * Unified Indicator Interface
 * 
 * Provides a standard interface for technical indicators to ensure
 * consistent usage across the platform.
 */

import type { Candle } from '../target-reacher/interfaces';

/**
 * Indicator metadata for documentation and validation
 */
export interface IndicatorMetadata {
  name: string;
  description: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'overlay' | 'oscillator';
  parameters: Array<{
    name: string;
    type: 'number' | 'boolean' | 'string';
    description: string;
    default: any;
    min?: number;
    max?: number;
    required?: boolean;
  }>;
  outputs: Array<{
    name: string;
    type: 'number' | 'array';
    description: string;
  }>;
  minimumDataPoints: number;
  version: string;
}

/**
 * Indicator calculation result with metadata
 */
export interface IndicatorResult<T = number | number[]> {
  value: T;
  metadata?: {
    timestamp?: number;
    confidence?: number;
    parameters?: Record<string, unknown>;
    dataPoints?: number;
  };
}

/**
 * Base interface for all indicators
 */
export interface IIndicator<T = number | number[]> {
  /**
   * Get indicator metadata
   */
  getMetadata(): IndicatorMetadata;
  
  /**
   * Calculate indicator value(s) from price data
   * 
   * @param data Input price data
   * @returns Indicator value(s) or result with metadata
   */
  calculate(data: number[]): T;
  
  /**
   * Calculate indicator value(s) from candle data
   * 
   * @param candles Input candle data
   * @param priceSource Which price to use from candles
   * @returns Indicator value(s) or result with metadata
   */
  calculateFromCandles(candles: Candle[], priceSource?: 'open' | 'high' | 'low' | 'close'): T;
  
  /**
   * Calculate with detailed result including metadata
   * 
   * @param data Input price data
   * @returns Detailed result with metadata
   */
  calculateWithMetadata(data: number[]): IndicatorResult<T>;
  
  /**
   * Validate input parameters
   * 
   * @param parameters Parameters to validate
   * @returns Validation result
   */
  validateParameters(parameters: Record<string, unknown>): { valid: boolean; errors: string[] };
  
  /**
   * Get indicator name
   */
  getName(): string;
  
  /**
   * Get indicator parameters
   */
  getParameters(): Record<string, unknown>;
  
  /**
   * Update indicator parameters
   * 
   * @param parameters New parameters to update
   */
  updateParameters(parameters: Record<string, unknown>): void;
  
  /**
   * Reset indicator state (for stateful indicators)
   */
  reset(): void;
  
  /**
   * Clone the indicator with same parameters
   */
  clone(): IIndicator<T>;
}

/**
 * Base abstract class for indicators
 */
export abstract class BaseIndicator<T = number | number[]> implements IIndicator<T> {
  protected name: string;
  protected parameters: Record<string, unknown>;
  protected metadata: IndicatorMetadata;
  
  constructor(metadata: IndicatorMetadata, parameters: Record<string, unknown> = {}) {
    this.metadata = metadata;
    this.name = metadata.name;
    this.parameters = this.setDefaultParameters(parameters);
  }
  
  abstract calculate(data: number[]): T;
  
  getMetadata(): IndicatorMetadata {
    return { ...this.metadata };
  }
  
  calculateFromCandles(candles: Candle[], priceSource: 'open' | 'high' | 'low' | 'close' = 'close'): T {
    const validPriceSources = ['open', 'high', 'low', 'close'] as const;
    if (!validPriceSources.includes(priceSource)) {
      throw new Error(`Invalid price source: ${priceSource}`);
    }
    const prices = candles.map(candle => candle[priceSource]);
    return this.calculate(prices);
  }
  
  calculateWithMetadata(data: number[]): IndicatorResult<T> {
    const value = this.calculate(data);
    // Check for NaN/Infinity in result (supports number or array)
    const checkFinite = (v: any) => {
      if (typeof v === 'number') {return isFinite(v) && !isNaN(v);}
      if (Array.isArray(v)) {return v.every(x => typeof x === 'number' && isFinite(x) && !isNaN(x));}
      return false;
    };
    if (!checkFinite(value)) {
      throw new Error(`Indicator ${this.name} calculation returned non-finite value(s). Check input data and parameters.`);
    }
    return {
      value,
      metadata: {
        timestamp: Date.now(),
        parameters: this.getParameters(),
        dataPoints: data.length
      }
    };
  }
  
  validateParameters(parameters: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const paramDef of this.metadata.parameters) {
      const value = parameters[paramDef.name];
      
      // Check required parameters
      if (paramDef.required && (value === undefined || value === null)) {
        errors.push(`Parameter '${paramDef.name}' is required`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        if (paramDef.type === 'number' && typeof value !== 'number') {
          errors.push(`Parameter '${paramDef.name}' must be a number`);
          continue;
        }
        
        if (paramDef.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter '${paramDef.name}' must be a boolean`);
          continue;
        }
        
        if (paramDef.type === 'string' && typeof value !== 'string') {
          errors.push(`Parameter '${paramDef.name}' must be a string`);
          continue;
        }
        
        // Range validation for numbers
        if (paramDef.type === 'number' && typeof value === 'number') {
          if (paramDef.min !== undefined && value < paramDef.min) {
            errors.push(`Parameter '${paramDef.name}' must be at least ${paramDef.min}`);
          }
          
          if (paramDef.max !== undefined && value > paramDef.max) {
            errors.push(`Parameter '${paramDef.name}' must be at most ${paramDef.max}`);
          }
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  getName(): string {
    return this.name;
  }
  
  getParameters(): Record<string, unknown> {
    return { ...this.parameters };
  }
  
  updateParameters(parameters: Record<string, unknown>): void {
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    this.parameters = { ...this.parameters, ...parameters };
  }
  
  reset(): void {
    // Default implementation - override in stateful indicators
  }
  
  abstract clone(): IIndicator<T>;
  
  /**
   * Set default parameters from metadata
   */
  private setDefaultParameters(parameters: Record<string, unknown>): Record<string, unknown> {
    const result = { ...parameters };
    
    for (const paramDef of this.metadata.parameters) {
      if (result[paramDef.name] === undefined) {
        result[paramDef.name] = paramDef.default;
      }
    }
    
    return result;
  }
  
  /**
   * Validate that enough data points are available
   * 
   * @param data Input data array
   * @param minLength Minimum required length (optional, uses metadata if not provided)
   */
  protected validateDataLength(data: number[], minLength?: number): void {
    const requiredLength = minLength || this.metadata.minimumDataPoints;
    if (data.length < requiredLength) {
      throw new Error(`Insufficient data for ${this.name} calculation. Need at least ${requiredLength} data points, got ${data.length}.`);
    }
  }
  
  /**
   * Get numeric parameter value with validation
   * 
   * @param key Parameter key
   * @param defaultValue Default value if parameter is not set
   * @returns Parameter value
   */
  protected getNumericParameter(key: string, defaultValue: number): number {
    if (typeof key !== 'string' || !key) {
      throw new Error('Parameter key must be a non-empty string');
    }
    const value = Object.prototype.hasOwnProperty.call(this.parameters, key) ? this.parameters[key as keyof typeof this.parameters] : undefined;
    if (value === undefined) {
      return defaultValue;
    }
    
    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new Error(`Invalid parameter value for ${key}: ${value} is not a number`);
    }
    
    return numValue;
  }
  
  /**
   * Get boolean parameter value with validation
   * 
   * @param key Parameter key
   * @param defaultValue Default value if parameter is not set
   * @returns Parameter value
   */
  protected getBooleanParameter(key: string, defaultValue: boolean): boolean {
    if (typeof key !== 'string' || !key) {
      throw new Error('Parameter key must be a non-empty string');
    }
    const value = Object.prototype.hasOwnProperty.call(this.parameters, key) ? this.parameters[key as keyof typeof this.parameters] : undefined;
    if (value === undefined) {
      return defaultValue;
    }
    
    return Boolean(value);
  }
  
  /**
   * Validate numeric array input
   * 
   * @param data Input data array
   * @returns Validated data array
   */
  protected validateNumericArray(data: number[]): number[] {
    if (!Array.isArray(data)) {
      throw new Error(`Input data must be an array for ${this.name}`);
    }
    // Reject NaN, Infinity, -Infinity, and non-numbers
    const validData = data.filter(value => typeof value === 'number' && !isNaN(value) && isFinite(value));
    if (validData.length !== data.length) {
      throw new Error(`Input data contains invalid values for ${this.name}. All values must be finite numbers.`);
    }
    return validData;
  }
}
