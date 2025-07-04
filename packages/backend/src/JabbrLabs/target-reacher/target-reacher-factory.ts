/**
 * Target Reacher Strategy Factory
 * 
 * Factory implementation for the Target Reacher strategy
 */

import type { 
  StrategyConfig, 
  StrategyContext,
  ConfigValidationResult,
  IStrategy
} from './interfaces'
import { camelToSnake } from './parameter-mapping';
import { TargetReacherStrategy } from './target-reacher'

// [Canonical Target Reacher Strategy Factory. All logic unified here.]
export const targetReacherFactory = {
  create(config: StrategyConfig, context: StrategyContext): IStrategy {
    // Map camelCase parameters to snake_case for strategy
    const snakeConfig = {
      ...config,
      parameters: camelToSnake(config.parameters || {})
    };
    return new TargetReacherStrategy(snakeConfig, context)
  },

  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    // Use the strategy's own validation method
    // Canonical: Use runtime type guard for config
    if (!config || typeof config !== 'object') {
      return { valid: false, errors: [{ field: 'config', message: 'Config must be an object', code: 'INVALID_TYPE' }], warnings: [] };
    }
    // Only cast after runtime check
    const safeConfig = config as Partial<StrategyConfig>;
    const strategy = new TargetReacherStrategy(safeConfig as StrategyConfig, {} as StrategyContext);
    return strategy.validateConfig(config);
  },

  getDefaultConfig(): StrategyConfig {
    // Use the strategy's default configuration
    // Canonical: Use empty object for context, but do not use as unknown as
    const strategy = new TargetReacherStrategy({} as StrategyConfig, {} as StrategyContext);
    return strategy.getDefaultConfig();
  }
}
