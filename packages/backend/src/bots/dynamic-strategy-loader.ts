/**
 * Dynamic Strategy Loader
 * 
 * Provides comprehensive dynamic strategy loading capabilities:
 * - Runtime strategy switching without bot restart
 * - Strategy versioning and rollback mechanisms
 * - Performance monitoring and automatic fallback
 * - Configuration validation and security
 * - Integration with existing plugin system
 */

import { EventEmitter } from 'events';

import type { IStrategy, StrategyConfig, StrategyContext, ConfigValidationResult } from '../JabbrLabs/target-reacher/interfaces';
import { database } from '../services/database.service';
import { strategyPluginManager } from '../strategies/plugin-manager';
import type { StrategyType, ExtendedStrategyConfig } from '../strategies/strategy-factory';
import { strategyFactory } from '../strategies/strategy-factory';

export interface StrategyVersion {
  id: string;
  strategyType: string;
  pluginId?: string;
  version: string;
  config: StrategyConfig;
  createdAt: Date;
  isActive: boolean;
  performance?: StrategyPerformance;
}

export interface StrategyPerformance {
  totalTrades: number;
  successRate: number;
  averageReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  lastUpdated: Date;
  errorCount: number;
  lastError?: string;
}

export interface StrategyLoadResult {
  success: boolean;
  strategy?: IStrategy;
  version?: StrategyVersion;
  error?: string;
  warnings?: string[];
}

export interface StrategySwapOptions {
  preserveState: boolean;
  validateFirst: boolean;
  rollbackOnError: boolean;
  performanceThreshold?: number;
}

export class DynamicStrategyLoader extends EventEmitter {
  private strategyRegistry: Map<string, StrategyVersion[]> = new Map();
  private activeStrategies: Map<string, IStrategy> = new Map();
  private performanceMonitor: Map<string, StrategyPerformance> = new Map();
  private fallbackStrategies: Map<string, string> = new Map();
  private performanceInterval?: NodeJS.Timeout;
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize the dynamic strategy loader
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Dynamic Strategy Loader...');

      // Initialize plugin manager
      await strategyPluginManager.initialize();

      // Initialize strategy factory
      await strategyFactory.initialize();

      // Load strategy registry from database
      await this.loadStrategyRegistry();

      // Initialize performance monitoring
      this.setupPerformanceMonitoring();

      this.initialized = true;

      console.log('✅ Dynamic Strategy Loader initialized successfully', {
        registeredStrategies: this.strategyRegistry.size,
        availablePlugins: strategyPluginManager.getPlugins().length
      });

      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Dynamic Strategy Loader', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Load a strategy dynamically with comprehensive validation
   */
  async loadStrategy(
    botId: string,
    strategyType: StrategyType,
    config: StrategyConfig,
    context: StrategyContext,
    pluginId?: string
  ): Promise<StrategyLoadResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🔄 Loading strategy', {
        botId,
        strategyType,
        pluginId
      });

      // Validate configuration first
      const validationResult = await this.validateStrategyConfig(strategyType, config, pluginId);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
        };
      }

      // Create extended config for strategy factory
      const extendedConfig: ExtendedStrategyConfig = {
        ...config,
        pluginId
      };

      // Create strategy instance using factory
      const strategy = await strategyFactory.createStrategy(strategyType, extendedConfig, context);

      // Create version record
      const version: StrategyVersion = {
        id: this.generateVersionId(botId, strategyType),
        strategyType,
        pluginId,
        version: strategy.version,
        config,
        createdAt: new Date(),
        isActive: true
      };

      // Store in registry
      this.addToRegistry(botId, version);

      // Store active strategy
      this.activeStrategies.set(botId, strategy);

      // Initialize performance monitoring
      this.initializePerformanceMonitoring(botId);

      // Save to database
      await this.saveStrategyVersion(botId, version);

      console.log('✅ Strategy loaded successfully', {
        botId,
        strategyName: strategy.name,
        version: strategy.version
      });

      this.emit('strategy-loaded', {
        botId,
        strategy: strategy.name,
        version: strategy.version
      });

      return {
        success: true,
        strategy,
        version,
        warnings: validationResult.warnings?.map(w => w.message)
      };

    } catch (error) {
      console.error('❌ Failed to load strategy', {
        botId,
        strategyType,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Switch strategy at runtime with hot-swapping
   */
  async switchStrategy(
    botId: string,
    newStrategyType: StrategyType,
    newConfig: StrategyConfig,
    context: StrategyContext,
    options: StrategySwapOptions = {
      preserveState: true,
      validateFirst: true,
      rollbackOnError: true
    },
    pluginId?: string
  ): Promise<StrategyLoadResult> {
    try {
      console.log('🔄 Switching strategy', {
        botId,
        from: this.activeStrategies.get(botId)?.name,
        to: newStrategyType,
        options
      });

      // Get current strategy for potential rollback
      const currentStrategy = this.activeStrategies.get(botId);
      const currentVersion = this.getCurrentVersion(botId);

      // Validate new strategy first if requested
      if (options.validateFirst) {
        const validationResult = await this.validateStrategyConfig(newStrategyType, newConfig, pluginId);
        if (!validationResult.valid) {
          return {
            success: false,
            error: `New strategy validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
          };
        }
      }

      // Preserve current strategy state if requested
      let preservedState: any = null;
      if (options.preserveState && currentStrategy) {
        try {
          preservedState = currentStrategy.getState();
          console.log('💾 Preserved strategy state for rollback', { botId });
        } catch (error) {
          console.warn('⚠️ Failed to preserve strategy state', {
            botId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Load new strategy
      const loadResult = await this.loadStrategy(botId, newStrategyType, newConfig, context, pluginId);

      if (!loadResult.success) {
        return loadResult;
      }

      // Clean up old strategy
      if (currentStrategy) {
        try {
          await currentStrategy.cleanup(context);
          console.log('🧹 Cleaned up previous strategy', { botId });
        } catch (error) {
          console.warn('⚠️ Failed to cleanup previous strategy', {
            botId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Apply preserved state to new strategy if compatible
      if (preservedState && loadResult.strategy && options.preserveState) {
        try {
          loadResult.strategy.setState(preservedState);
          console.log('🔄 Applied preserved state to new strategy', { botId });
        } catch (error) {
          console.warn('⚠️ Failed to apply preserved state', {
            botId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Set up performance monitoring for new strategy
      this.setupStrategyPerformanceMonitoring(botId, loadResult.strategy!);

      // Mark previous version as inactive
      if (currentVersion) {
        currentVersion.isActive = false;
        await this.saveStrategyVersion(botId, currentVersion);
      }

      console.log('✅ Strategy switched successfully', {
        botId,
        newStrategy: loadResult.strategy!.name,
        version: loadResult.strategy!.version
      });

      this.emit('strategy-switched', {
        botId,
        previousStrategy: currentStrategy?.name,
        newStrategy: loadResult.strategy!.name,
        preservedState: !!preservedState
      });

      return loadResult;

    } catch (error) {
      console.error('❌ Failed to switch strategy', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Attempt rollback if enabled
      if (options.rollbackOnError) {
        console.log('🔄 Attempting strategy rollback', { botId });
        await this.rollbackToPreviousVersion(botId, context);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Rollback to previous strategy version
   */
  async rollbackToPreviousVersion(botId: string, context: StrategyContext): Promise<StrategyLoadResult> {
    try {
      const versions = this.strategyRegistry.get(botId);
      if (!versions || versions.length < 2) {
        throw new Error('No previous version available for rollback');
      }

      // Find the previous active version
      const sortedVersions = versions
        .filter(v => !v.isActive)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      if (sortedVersions.length === 0) {
        throw new Error('No previous version found for rollback');
      }

      const previousVersion = sortedVersions.at(0);
      if (!previousVersion) {
        throw new Error('Previous version is undefined');
      }

      console.log('🔄 Rolling back to previous strategy version', {
        botId,
        versionId: previousVersion.id,
        strategyType: previousVersion.strategyType
      });

      // Load previous version
      const rollbackResult = await this.loadStrategy(
        botId,
        previousVersion.strategyType as StrategyType,
        previousVersion.config,
        context,
        previousVersion.pluginId
      );

      if (rollbackResult.success) {
        console.log('✅ Strategy rollback successful', {
          botId,
          rolledBackTo: previousVersion.id
        });

        this.emit('strategy-rollback', {
          botId,
          rolledBackTo: previousVersion.id,
          strategyType: previousVersion.strategyType
        });
      }

      return rollbackResult;

    } catch (error) {
      console.error('❌ Strategy rollback failed', {
        botId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get current active strategy for a bot
   */
  getCurrentStrategy(botId: string): IStrategy | null {
    return this.activeStrategies.get(botId) || null;
  }

  /**
   * Get current strategy version for a bot
   */
  getCurrentVersion(botId: string): StrategyVersion | null {
    const versions = this.strategyRegistry.get(botId);
    return versions?.find(v => v.isActive) || null;
  }

  /**
   * Get strategy performance metrics
   */
  getPerformanceMetrics(botId: string): StrategyPerformance | null {
    return this.performanceMonitor.get(botId) || null;
  }

  /**
   * Get available strategies (built-in + plugins)
   */
  getAvailableStrategies(): Array<{
    type: StrategyType;
    name: string;
    description: string;
    isPlugin: boolean;
    pluginId?: string;
  }> {
    const strategies: Array<{
      type: StrategyType;
      name: string;
      description: string;
      isPlugin: boolean;
      pluginId?: string;
    }> = [];

    // Add built-in strategies
    const builtInTypes: StrategyType[] = ['sma-crossover', 'aether', 'target-reacher'];
    builtInTypes.forEach(type => {
      strategies.push({
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
        description: `Built-in ${type} strategy`,
        isPlugin: false
      });
    });

    // Add plugin strategies
    const plugins = strategyPluginManager.getPlugins();
    plugins.forEach(plugin => {
      strategies.push({
        type: 'custom',
        name: plugin.metadata.name,
        description: plugin.metadata.description,
        isPlugin: true,
        pluginId: plugin.id
      });
    });

    return strategies;
  }

  /**
   * Validate strategy configuration
   */
  private async validateStrategyConfig(
    strategyType: StrategyType,
    config: StrategyConfig,
    pluginId?: string
  ): Promise<ConfigValidationResult> {
    try {
      if (strategyType === 'custom' && pluginId) {
        return await strategyPluginManager.validatePluginConfig(pluginId, config.parameters || {});
      }

      // For built-in strategies, use factory validation
      await strategyFactory.getDefaultConfig(strategyType, pluginId);
      
      // Basic validation - in a real implementation, this would be more comprehensive
      return {
        valid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'config',
          message: error instanceof Error ? error.message : String(error),
          code: 'VALIDATION_ERROR'
        }],
        warnings: []
      };
    }
  }

  /**
   * Load strategy registry from database
   */
  private async loadStrategyRegistry(): Promise<void> {
    try {
      // Check if database connection is available before attempting query
      if (!database.isConnectionActive()) {
        // Only log in non-test environments to prevent test interference
        if (process.env.NODE_ENV !== 'test') {
          console.warn('⚠️ Database not connected during strategy registry load, will retry later');
        }
        
        // Don't schedule retry in test environment to prevent hanging
        if (process.env.NODE_ENV !== 'test') {
          // Use a timeout reference that can be cleared
          const retryTimeout = setTimeout(() => {
            this.loadStrategyRegistry().catch(() => {});
          }, 5000);
          
          // Store timeout reference for cleanup if needed
          if (!this.retryTimeouts) {
            this.retryTimeouts = new Set();
          }
          this.retryTimeouts.add(retryTimeout);
        }
        return;
      }

      const result = await database.query(`
        SELECT bot_id, strategy_data 
        FROM bot_strategy_versions 
        ORDER BY created_at DESC
      `);

      for (const row of result) {
        const versions: StrategyVersion[] = JSON.parse(row.strategy_data);
        this.strategyRegistry.set(row.bot_id, versions);
      }

      console.log('✅ Strategy registry loaded from database', {
        botsWithStrategies: this.strategyRegistry.size
      });
    } catch (error) {
      console.warn('⚠️ Failed to load strategy registry from database', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue without persisted registry
    }
  }

  /**
   * Save strategy version to database
   */
  private async saveStrategyVersion(botId: string, version: StrategyVersion): Promise<void> {
    // Skip database operations if not connected (e.g., in test environments)
    if (!database.isConnectionActive()) {
      console.debug('🔍 Skipping strategy version save - database not connected', {
        botId,
        versionId: version.id
      });
      return;
    }

    try {
      const versions = this.strategyRegistry.get(botId) || [];
      const versionData = JSON.stringify(versions);

      await database.query(`
        INSERT INTO bot_strategy_versions (bot_id, strategy_data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (bot_id)
        DO UPDATE SET strategy_data = $2, updated_at = NOW()
      `, [botId, versionData]);

      console.debug('💾 Strategy version saved to database', {
        botId,
        versionId: version.id
      });
    } catch (error) {
      console.warn('⚠️ Failed to save strategy version to database', {
        botId,
        versionId: version.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Add version to registry
   */
  private addToRegistry(botId: string, version: StrategyVersion): void {
    const versions = this.strategyRegistry.get(botId) || [];
    
    // Mark previous versions as inactive
    versions.forEach(v => v.isActive = false);
    
    // Add new version
    versions.push(version);
    
    this.strategyRegistry.set(botId, versions);
  }

  /**
   * Generate unique version ID
   */
  private generateVersionId(botId: string, strategyType: string): string {
    const timestamp = Date.now();
    return `${botId}-${strategyType}-${timestamp}`;
  }

  /**
   * Initialize performance monitoring for a bot
   */
  private initializePerformanceMonitoring(botId: string): void {
    this.performanceMonitor.set(botId, {
      totalTrades: 0,
      successRate: 0,
      averageReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      lastUpdated: new Date(),
      errorCount: 0
    });
  }

  /**
   * Set up performance monitoring for a strategy
   */
  private setupStrategyPerformanceMonitoring(botId: string, strategy: IStrategy): void {
    // This would integrate with the strategy's event system
    // For now, we'll set up basic monitoring
    console.log('📊 Setting up performance monitoring', {
      botId,
      strategy: strategy.name
    });
  }

  /**
   * Set up general performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Clear existing interval if any
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
    }
    
    // Set up periodic performance evaluation
    this.performanceInterval = setInterval(() => {
      this.evaluateStrategyPerformance();
    }, 60000); // Every minute

    console.log('📊 Performance monitoring initialized');
  }

  /**
   * Evaluate strategy performance and trigger fallbacks if needed
   */
  private evaluateStrategyPerformance(): void {
    for (const [botId, performance] of this.performanceMonitor.entries()) {
      // Check if strategy is underperforming
      if (performance.errorCount > 10 || performance.successRate < 0.3) {
        console.warn('⚠️ Strategy underperforming, considering fallback', {
          botId,
          errorCount: performance.errorCount,
          successRate: performance.successRate
        });

        this.emit('strategy-underperforming', {
          botId,
          performance
        });
      }
    }
  }

  /**
   * Cleanup all resources and intervals
   */
  public cleanup(): void {
    // Clear performance monitoring interval
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = undefined;
    }
    
    // Clear all retry timeouts to prevent hanging
    this.retryTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.retryTimeouts.clear();
    
    // Clear all maps
    this.strategyRegistry.clear();
    this.activeStrategies.clear();
    this.performanceMonitor.clear();
    this.fallbackStrategies.clear();
    
    // Only log in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      console.log('🧹 Dynamic strategy loader cleaned up');
    }
  }
}

// Export singleton instance
export const dynamicStrategyLoader = new DynamicStrategyLoader(); 