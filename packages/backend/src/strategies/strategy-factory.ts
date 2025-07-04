/**
 * Unified Strategy Factory
 * 
 * Central factory for creating strategy instances, supporting both built-in
 * strategies and custom plugins.
 */

import { SMACrossoverStrategy } from '../JabbrLabs/signals/sma/sma-crossover-strategy';
import type { 
  IStrategy, 
  StrategyConfig, 
  StrategyContext, 
  ConfigValidationResult 
} from '../JabbrLabs/target-reacher/interfaces';
import { targetReacherFactory } from '../JabbrLabs/target-reacher/target-reacher-factory';
import logger from '../services/logging.service';

import { AetherSignalStrategy } from './aether-signal-strategy';
import { strategyPluginManager } from './plugin-manager';

export type StrategyType = 
  | 'target-reacher'
  | 'sma-crossover'
  | 'custom'
  | 'aether-signal'
  | 'aether';

// Extended strategy config for plugins
export interface ExtendedStrategyConfig extends StrategyConfig {
  pluginId?: string;
}

// Strategy factory interface
interface StrategyFactoryInterface {
  create(config: StrategyConfig, context: StrategyContext): IStrategy;
  validateConfig(config: Record<string, unknown>): ConfigValidationResult;
  getDefaultConfig(): StrategyConfig;
}

// SMA Crossover Strategy Factory
const smaCrossoverFactory: StrategyFactoryInterface = {
  create(__config: StrategyConfig, __context: StrategyContext): IStrategy {
    return new SMACrossoverStrategy();
  },
  
  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    const strategy = new SMACrossoverStrategy();
    return strategy.validateConfig(config);
  },
  
  getDefaultConfig(): StrategyConfig {
    const strategy = new SMACrossoverStrategy();
    return strategy.getDefaultConfig();
  }
};

// Aether Signal Strategy Factory
const aetherSignalFactory: StrategyFactoryInterface = {
  create(config: StrategyConfig, __context: StrategyContext): IStrategy {
    return new AetherSignalStrategy(config);
  },
  
  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    const strategy = new AetherSignalStrategy();
    return strategy.validateConfig(config);
  },
  
  getDefaultConfig(): StrategyConfig {
    const strategy = new AetherSignalStrategy();
    return strategy.getDefaultConfig();
  }
};

// Built-in strategy factories registry
const builtInFactories: Record<string, StrategyFactoryInterface> = {
  'target-reacher': targetReacherFactory,
  'sma-crossover': smaCrossoverFactory,
  'aether-signal': aetherSignalFactory,
  'aether': aetherSignalFactory, // Alternative name for compatibility
  // Add other built-in strategy factories here as they're implemented
};

export class StrategyFactory {
  private initialized = false;

  /**
   * Initialize the strategy factory and plugin manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize plugin manager
      await strategyPluginManager.initialize();
      
      this.initialized = true;
      logger.info('Strategy Factory initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Strategy Factory', { error });
      throw error;
    }
  }

  /**
   * Create a strategy instance
   */
  async createStrategy(
    type: StrategyType,
    config: ExtendedStrategyConfig,
    context: StrategyContext
  ): Promise<IStrategy> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Handle built-in strategies
      if (type !== 'custom' && Object.prototype.hasOwnProperty.call(builtInFactories, type)) {
        const factory = builtInFactories[type as keyof typeof builtInFactories];
        if (!factory) {
          throw new Error(`No factory found for built-in strategy type: ${type}`);
        }
        logger.info(`Creating built-in strategy: ${type}`, { botId: context.botConfig?.id });
        return factory.create(config, context);
      }

      // Handle custom plugin strategies
      if (type === 'custom' && config.pluginId) {
        logger.info(`Creating custom plugin strategy: ${config.pluginId}`, { botId: context.botConfig?.id });
        return await strategyPluginManager.loadPlugin(config.pluginId, config, context);
      }

      throw new Error(`Unsupported strategy type: ${type}`);
    } catch (error) {
      logger.error(`Failed to create strategy: ${type}`, { error, botId: context.botConfig?.id });
      throw error;
    }
  }

  /**
   * Validate strategy configuration
   */
  async validateConfig(type: StrategyType, config: Record<string, unknown>): Promise<ConfigValidationResult> {
    try {
      // Handle built-in strategies
      if (type !== 'custom' && Object.prototype.hasOwnProperty.call(builtInFactories, type)) {
        const factory = builtInFactories[type as keyof typeof builtInFactories];
        if (!factory) {
          return {
            valid: false,
            errors: [{ field: 'type', message: `No factory found for built-in strategy type: ${type}`, code: 'INVALID_TYPE' }],
            warnings: []
          };
        }
        return factory.validateConfig(config);
      }

      // Handle custom plugin strategies
      if (type === 'custom' && config.pluginId) {
        return await strategyPluginManager.validatePluginConfig(
          config.pluginId as string,
          config
        );
      }

      return {
        valid: false,
        errors: [{ field: 'type', message: `Unsupported strategy type: ${type}`, code: 'INVALID_TYPE' }],
        warnings: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{ field: 'validation', message: error instanceof Error ? error.message : String(error), code: 'VALIDATION_ERROR' }],
        warnings: []
      };
    }
  }

  /**
   * Get default configuration for a strategy type
   */
  async getDefaultConfig(type: StrategyType, pluginId?: string): Promise<StrategyConfig> {
    try {
      // Handle built-in strategies
      if (type !== 'custom' && Object.prototype.hasOwnProperty.call(builtInFactories, type)) {
        const factory = builtInFactories[type as keyof typeof builtInFactories];
        if (!factory) {
          throw new Error(`No factory found for built-in strategy type: ${type}`);
        }
        return factory.getDefaultConfig();
      }

      // Handle custom plugin strategies
      if (type === 'custom' && pluginId) {
        const plugin = strategyPluginManager.getPlugin(pluginId);
        if (!plugin) {
          throw new Error(`Plugin not found: ${pluginId}`);
        }

        // Load plugin module to get default config
        const pluginModule = await import(plugin.filePath);
        const tempInstance = new pluginModule.default();
        return tempInstance.getDefaultConfig();
      }

      throw new Error(`Cannot get default config for strategy type: ${type}`);
    } catch (error) {
      logger.error(`Failed to get default config for strategy: ${type}`, { error, pluginId });
      throw error;
    }
  }

  /**
   * Get available built-in strategies
   */
  getBuiltInStrategies(): Array<{ type: StrategyType; name: string; description: string }> {
    return [
      {
        type: 'target-reacher',
        name: 'Target Reacher',
        description: 'Modular target reacher strategy with fixed and average price sources'
      },
      {
        type: 'sma-crossover',
        name: 'SMA Crossover',
        description: 'Trading strategy based on SMA crossover signals'
      },
      {
        type: 'aether-signal',
        name: 'Aether Signal Generator',
        description: 'Advanced mathematical signal generator using fractional calculus and stochastic processes'
      }
    ];
  }

  /**
   * Get available custom plugins
   */
  getAvailablePlugins() {
    return strategyPluginManager.getPlugins().map(plugin => ({
      id: plugin.id,
      name: plugin.metadata.name,
      version: plugin.metadata.version,
      description: plugin.metadata.description,
      author: plugin.metadata.author,
      supportedMarkets: plugin.metadata.supportedMarkets,
      riskLevel: plugin.metadata.riskLevel,
      category: plugin.metadata.category,
      tags: plugin.metadata.tags,
      isLoaded: plugin.isLoaded,
      error: plugin.error
    }));
  }

  /**
   * Search available plugins
   */
  searchPlugins(criteria: {
    name?: string;
    category?: string;
    riskLevel?: string;
    supportedMarket?: string;
    tags?: string[];
  }) {
    return strategyPluginManager.searchPlugins(criteria);
  }

  /**
   * Register a new plugin
   */
  async registerPlugin(filePath: string): Promise<string> {
    return await strategyPluginManager.registerPlugin(filePath);
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    return await strategyPluginManager.unloadPlugin(pluginId);
  }
}

// Export singleton instance
export const strategyFactory = new StrategyFactory(); 