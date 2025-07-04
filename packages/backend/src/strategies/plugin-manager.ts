/**
 * Strategy Plugin Manager
 * 
 * Comprehensive plugin system for custom trading strategies with security,
 * validation, and dynamic loading capabilities.
 */

import fs from 'fs/promises';
import path from 'path';

import { z } from 'zod';

import type { 
  IStrategy, 
  StrategyConfig, 
  StrategyContext, 
  ConfigValidationResult,
  StrategyResult 
} from '../JabbrLabs/target-reacher/interfaces';
import logger from '../services/logging.service';

// Plugin metadata interface
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  supportedMarkets: string[];
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Plugin information for registry
export interface PluginInfo {
  id: string;
  metadata: PluginMetadata;
  filePath: string;
  isLoaded: boolean;
  loadedAt?: string;
  error?: string;
  instance?: IStrategy;
}

// Plugin configuration schema for validation
const PluginMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1).max(500),
  author: z.string().min(1).max(100),
  supportedMarkets: z.array(z.string()).min(1),
  riskLevel: z.enum(['low', 'medium', 'high']),
  category: z.string().min(1).max(50),
  tags: z.array(z.string()).optional().default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Plugin wrapper for sandboxing
export interface PluginWrapper {
  execute(context: StrategyContext): Promise<StrategyResult>;
  validateConfig(config: Record<string, unknown>): ConfigValidationResult;
  getDefaultConfig(): StrategyConfig;
  cleanup(): Promise<void>;
}

export class StrategyPluginManager {
  private pluginRegistry: Map<string, PluginInfo> = new Map();
  private pluginDirectory: string;
  private allowedDependencies: Set<string>;
  private securityEnabled: boolean;

  constructor(
    pluginDirectory: string = path.join(process.cwd(), 'plugins'),
    securityEnabled = true
  ) {
    this.pluginDirectory = pluginDirectory;
    this.securityEnabled = securityEnabled;
    
    // Whitelist of allowed dependencies for security
    this.allowedDependencies = new Set([
      'lodash',
      'moment',
      'decimal.js',
      'ta-lib',
      'technicalindicators'
    ]);
  }

  /**
   * Initialize the plugin manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure plugin directory exists
      await this.ensurePluginDirectory();
      
      // Load existing plugins
      await this.scanAndLoadPlugins();
      
      logger.info(`Strategy Plugin Manager initialized with ${this.pluginRegistry.size} plugins`);
    } catch (error) {
      logger.error('Failed to initialize Strategy Plugin Manager', { error });
      throw error;
    }
  }

  /**
   * Register a new plugin from file path
   */
  async registerPlugin(filePath: string): Promise<string> {
    try {
      const absolutePath = path.resolve(filePath);
      
      // Security check: ensure plugin is in allowed directory
      if (this.securityEnabled && !absolutePath.startsWith(path.resolve(this.pluginDirectory))) {
        throw new Error('Plugin must be located in the designated plugin directory');
      }

      // Load and validate plugin metadata
      const pluginModule = await this.loadPluginModule(absolutePath);
      const metadata = await this.validatePluginMetadata(pluginModule.metadata);
      
      // Generate unique plugin ID
      const pluginId = this.generatePluginId(metadata.name, metadata.version);
      
      // Create plugin info
      const pluginInfo: PluginInfo = {
        id: pluginId,
        metadata,
        filePath: absolutePath,
        isLoaded: false
      };

      // Validate plugin implementation
      await this.validatePluginImplementation(pluginModule);
      
      // Register plugin
      this.pluginRegistry.set(pluginId, pluginInfo);
      
      logger.info(`Plugin registered: ${metadata.name} v${metadata.version}`, {
        pluginId,
        author: metadata.author,
        markets: metadata.supportedMarkets
      });

      return pluginId;
    } catch (error) {
      logger.error(`Failed to register plugin: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * Load a plugin and create an instance
   */
  async loadPlugin(pluginId: string, config: StrategyConfig, context: StrategyContext): Promise<IStrategy> {
    try {
      const pluginInfo = this.pluginRegistry.get(pluginId);
      if (!pluginInfo) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      // Load plugin module
      const pluginModule = await this.loadPluginModule(pluginInfo.filePath);
      
      // Validate configuration
      const tempInstance = new pluginModule.default();
      const configValidation = tempInstance.validateConfig(config.parameters || {});
      
      if (!configValidation.valid) {
        throw new Error(`Invalid plugin configuration: ${configValidation.errors.map((e: any) => e.message).join(', ')}`);
      }

      // Create plugin instance with dependency injection
      const pluginInstance = new pluginModule.default();
      await pluginInstance.initialize(context);
      
      // Update plugin info
      pluginInfo.isLoaded = true;
      pluginInfo.loadedAt = new Date().toISOString();
      pluginInfo.instance = pluginInstance;
      pluginInfo.error = undefined;

      logger.info(`Plugin loaded: ${pluginInfo.metadata.name}`, {
        pluginId,
        botId: context.botConfig?.id
      });

      return pluginInstance;
    } catch (error) {
      // Update plugin info with error
      const pluginInfo = this.pluginRegistry.get(pluginId);
      if (pluginInfo) {
        pluginInfo.error = error instanceof Error ? error.message : String(error);
        pluginInfo.isLoaded = false;
      }

      logger.error(`Failed to load plugin: ${pluginId}`, { error });
      throw error;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    try {
      const pluginInfo = this.pluginRegistry.get(pluginId);
      if (!pluginInfo || !pluginInfo.isLoaded) {
        return;
      }

      // Cleanup plugin instance
      if (pluginInfo.instance && typeof pluginInfo.instance.cleanup === 'function') {
        await pluginInfo.instance.cleanup({} as StrategyContext);
      }

      // Clear module cache to allow hot reloading
      delete require.cache[require.resolve(pluginInfo.filePath)];

      // Update plugin info
      pluginInfo.isLoaded = false;
      pluginInfo.instance = undefined;
      pluginInfo.loadedAt = undefined;

      logger.info(`Plugin unloaded: ${pluginInfo.metadata.name}`, { pluginId });
    } catch (error) {
      logger.error(`Failed to unload plugin: ${pluginId}`, { error });
      throw error;
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): PluginInfo[] {
    return Array.from(this.pluginRegistry.values());
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): PluginInfo | undefined {
    return this.pluginRegistry.get(pluginId);
  }

  /**
   * Search plugins by criteria
   */
  searchPlugins(criteria: {
    name?: string;
    category?: string;
    riskLevel?: string;
    supportedMarket?: string;
    tags?: string[];
  }): PluginInfo[] {
    return this.getPlugins().filter(plugin => {
      if (criteria.name && !plugin.metadata.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.category && plugin.metadata.category !== criteria.category) {
        return false;
      }
      if (criteria.riskLevel && plugin.metadata.riskLevel !== criteria.riskLevel) {
        return false;
      }
      if (criteria.supportedMarket && !plugin.metadata.supportedMarkets.includes(criteria.supportedMarket)) {
        return false;
      }
      if (criteria.tags && !criteria.tags.some(tag => plugin.metadata.tags.includes(tag))) {
        return false;
      }
      return true;
    });
  }

  /**
   * Validate plugin configuration
   */
  async validatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<ConfigValidationResult> {
    try {
      const pluginInfo = this.pluginRegistry.get(pluginId);
      if (!pluginInfo) {
        return {
          valid: false,
          errors: [{ field: 'plugin', message: 'Plugin not found', code: 'PLUGIN_NOT_FOUND' }],
          warnings: []
        };
      }

      // Load plugin module if not already loaded
      const pluginModule = await this.loadPluginModule(pluginInfo.filePath);
      const tempInstance = new pluginModule.default();
      
      return tempInstance.validateConfig(config);
    } catch (error) {
      return {
        valid: false,
        errors: [{ field: 'validation', message: error instanceof Error ? error.message : String(error), code: 'VALIDATION_ERROR' }],
        warnings: []
      };
    }
  }

  /**
   * Private: Ensure plugin directory exists
   */
  private async ensurePluginDirectory(): Promise<void> {
    try {
      await fs.access(this.pluginDirectory);
    } catch {
      await fs.mkdir(this.pluginDirectory, { recursive: true });
      logger.info(`Created plugin directory: ${this.pluginDirectory}`);
    }
  }

  /**
   * Private: Scan and load all plugins in directory
   */
  private async scanAndLoadPlugins(): Promise<void> {
    try {
      const files = await fs.readdir(this.pluginDirectory);
      const pluginFiles = files.filter(file => file.endsWith('.js') || file.endsWith('.ts'));

      for (const file of pluginFiles) {
        try {
          const filePath = path.join(this.pluginDirectory, file);
          await this.registerPlugin(filePath);
        } catch (error) {
          logger.warn(`Failed to load plugin file: ${file}`, { error });
        }
      }
    } catch (error) {
      logger.error('Failed to scan plugin directory', { error });
    }
  }

  /**
   * Private: Load plugin module with security checks
   */
  private async loadPluginModule(filePath: string): Promise<any> {
    try {
      // Ensure we have an absolute path
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      // Security: Check file exists and is readable
      await fs.access(absolutePath, fs.constants.R_OK);
      
      // Security: Validate file extension
      const ext = path.extname(absolutePath);
      if (!['.js', '.ts'].includes(ext)) {
        throw new Error('Invalid plugin file extension. Only .js and .ts files are allowed.');
      }

      // Clear module cache for hot reloading
      if (require.cache[require.resolve(absolutePath)]) {
        delete require.cache[require.resolve(absolutePath)];
      }
      
      // Dynamic import for ES modules or require for CommonJS
      let pluginModule;
      try {
        pluginModule = await import(absolutePath);
      } catch (importError: unknown) {
        try {
          pluginModule = require(absolutePath);
        } catch (requireError: unknown) {
          const importMsg = importError instanceof Error ? importError.message : 'Import error';
          const requireMsg = requireError instanceof Error ? requireError.message : 'Require error';
          throw new Error(`Failed to import plugin: ${importMsg || requireMsg}`);
        }
      }

      if (!pluginModule.default) {
        throw new Error('Plugin must have a default export');
      }

      return pluginModule;
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Private: Validate plugin metadata
   */
  private async validatePluginMetadata(metadata: any): Promise<PluginMetadata> {
    try {
      return PluginMetadataSchema.parse(metadata);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid plugin metadata: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Private: Validate plugin implementation
   */
  private async validatePluginImplementation(pluginModule: any): Promise<void> {
    const PluginClass = pluginModule.default;
    
    if (typeof PluginClass !== 'function') {
      throw new Error('Plugin default export must be a class constructor');
    }

    // Create temporary instance to check interface compliance
    const tempInstance = new PluginClass();
    
    // Check required methods
    const requiredMethods = ['initialize', 'execute', 'cleanup', 'validateConfig', 'getDefaultConfig'];
    for (const method of requiredMethods) {
      if (typeof (tempInstance as any)[method] !== 'function') {
        throw new Error(`Plugin must implement ${method} method`);
      }
    }

    // Check required properties
    const requiredProperties = ['name', 'version', 'description', 'supportedMarkets'];
    for (const prop of requiredProperties) {
      if ((tempInstance as any)[prop] === undefined) {
        throw new Error(`Plugin must have ${prop} property`);
      }
    }
  }

  /**
   * Private: Generate unique plugin ID
   */
  private generatePluginId(name: string, version: string): string {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const sanitizedVersion = version.replace(/[^0-9.]/g, '');
    return `${sanitizedName}-${sanitizedVersion}`;
  }
}

// Export singleton instance
export const strategyPluginManager = new StrategyPluginManager(); 