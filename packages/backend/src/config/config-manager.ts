import fs from 'fs';
import path from 'path';

import * as dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Environment Types
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Configuration Schema
 * Validates all application configuration with environment-specific optimizations
 */
const ConfigSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  API_VERSION: z.string().default('v1'),

  // Database Configuration
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().default('jabbr_trading_bot'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.coerce.boolean().default(false),
  
  // Environment-optimized database pool settings
  DB_POOL_MIN: z.coerce.number().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().min(1).default(20),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(60000),

  // JWT Configuration
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).default(0),
  REDIS_CLUSTER_MODE: z.coerce.boolean().default(false),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  LOG_MAX_SIZE: z.string().default('10m'),
  LOG_MAX_FILES: z.coerce.number().min(1).default(5),
  LOG_JSON_FORMAT: z.coerce.boolean().default(false),

  // Exchange Configuration
  BYBIT_API_KEY: z.string().optional(),
  BYBIT_SECRET: z.string().optional(),
  BYBIT_TESTNET: z.coerce.boolean().default(true),
  USE_MOCK_EXCHANGE: z.coerce.boolean().default(false),

  // Performance Monitoring
  ENABLE_PERFORMANCE_MONITORING: z.coerce.boolean().default(true),
  PERFORMANCE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1.0),
  METRICS_COLLECTION_INTERVAL: z.coerce.number().min(1000).default(60000),
  APM_SERVICE_NAME: z.string().default('jabbr-trading-bot'),
  APM_ENVIRONMENT: z.string().optional(),

  // Security Configuration
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW: z.coerce.number().min(1000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
  BCRYPT_ROUNDS: z.coerce.number().min(4).max(20).default(10),
  ENABLE_HELMET: z.coerce.boolean().default(true),
  ENABLE_COMPRESSION: z.coerce.boolean().default(true),

  // WebSocket Configuration
  WS_PORT: z.coerce.number().min(1).max(65535).default(3001),
  WS_PATH: z.string().default('/ws'),
  WS_HEARTBEAT_INTERVAL: z.coerce.number().min(1000).default(30000),
  WS_MAX_CONNECTIONS: z.coerce.number().min(1).default(1000),

  // Cache Configuration
  CACHE_TTL: z.coerce.number().min(0).default(300),
  CACHE_MAX_KEYS: z.coerce.number().min(1).default(1000),
  ENABLE_QUERY_CACHE: z.coerce.boolean().default(true),
  CACHE_COMPRESSION: z.coerce.boolean().default(false),

  // File Upload Configuration
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().min(1).default(10485760),
  UPLOAD_ALLOWED_TYPES: z.string().default('image/jpeg,image/png,text/csv'),
  UPLOAD_VIRUS_SCAN: z.coerce.boolean().default(false),

  // Health Check Configuration
  HEALTH_CHECK_INTERVAL: z.coerce.number().min(1000).default(30000),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().min(1000).default(5000),
  HEALTH_CHECK_PATH: z.string().default('/health'),

  // Feature Flags
  ENABLE_MOCK_DATA: z.coerce.boolean().default(false),
  ENABLE_TEST_ROUTES: z.coerce.boolean().default(false),
  SKIP_AUTH_FOR_TESTING: z.coerce.boolean().default(false),
  ENABLE_DEBUG_ROUTES: z.coerce.boolean().default(false),
  ENABLE_SWAGGER_UI: z.coerce.boolean().default(false),
  ENABLE_HOT_RELOAD: z.coerce.boolean().default(false),

  // Advanced Features
  ENABLE_ADVANCED_ANALYTICS: z.coerce.boolean().default(false),
  ENABLE_MACHINE_LEARNING: z.coerce.boolean().default(false),
  ENABLE_RISK_MANAGEMENT: z.coerce.boolean().default(true),
  ENABLE_PORTFOLIO_OPTIMIZATION: z.coerce.boolean().default(false),

  // Scaling Configuration
  CLUSTER_MODE: z.coerce.boolean().default(false),
  WORKER_PROCESSES: z.union([z.literal('auto'), z.coerce.number().min(1)]).default('auto'),
  GRACEFUL_SHUTDOWN_TIMEOUT: z.coerce.number().min(1000).default(30000),

  // Test Configuration
  AUTO_MIGRATE: z.coerce.boolean().default(false),
  AUTO_SEED: z.coerce.boolean().default(false),
  CLEAR_DB_BEFORE_TESTS: z.coerce.boolean().default(false),
  TEST_TIMEOUT: z.coerce.number().min(1000).default(30000),
  API_TIMEOUT: z.coerce.number().min(1000).default(5000),
  DB_QUERY_TIMEOUT: z.coerce.number().min(1000).default(10000),
  JEST_MAX_WORKERS: z.coerce.number().min(1).default(4),
  JEST_WORKER_IDLE_MEMORY_LIMIT: z.string().default('512MB'),

  // External Services
  EMAIL_SERVICE_API_KEY: z.string().optional(),
  SMS_SERVICE_API_KEY: z.string().optional(),
  NOTIFICATION_WEBHOOK_URL: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Environment-specific configuration optimizations
 */
const EnvironmentOptimizations = {
  development: {
    DB_POOL_MIN: 1,
    DB_POOL_MAX: 10,
    DB_POOL_IDLE_TIMEOUT: 60000,
    LOG_LEVEL: 'debug' as const,
    PERFORMANCE_SAMPLE_RATE: 1.0,
    ENABLE_DEBUG_ROUTES: true,
    ENABLE_SWAGGER_UI: true,
    ENABLE_HOT_RELOAD: true,
    BCRYPT_ROUNDS: 10,
    CORS_ORIGIN: 'http://localhost:3000,http://localhost:3001',
    RATE_LIMIT_MAX_REQUESTS: 1000,
  },
  production: {
    DB_POOL_MIN: 5,
    DB_POOL_MAX: 50,
    DB_POOL_IDLE_TIMEOUT: 120000,
    LOG_LEVEL: 'info' as const,
    LOG_JSON_FORMAT: true,
    PERFORMANCE_SAMPLE_RATE: 0.1,
    ENABLE_DEBUG_ROUTES: false,
    ENABLE_SWAGGER_UI: false,
    ENABLE_TEST_ROUTES: false,
    ENABLE_MOCK_DATA: false,
    BCRYPT_ROUNDS: 12,
    ENABLE_HELMET: true,
    ENABLE_COMPRESSION: true,
    CACHE_COMPRESSION: true,
    DB_SSL: true,
    CLUSTER_MODE: true,
    RATE_LIMIT_MAX_REQUESTS: 100,
  },
  test: {
    DB_POOL_MIN: 1,
    DB_POOL_MAX: 5,
    DB_POOL_IDLE_TIMEOUT: 10000,
    DB_POOL_CONNECTION_TIMEOUT: 15000,
    LOG_LEVEL: 'error' as const,
    PERFORMANCE_SAMPLE_RATE: 0,
    ENABLE_PERFORMANCE_MONITORING: false,
    ENABLE_MOCK_DATA: true,
    ENABLE_TEST_ROUTES: true,
    SKIP_AUTH_FOR_TESTING: true,
    BCRYPT_ROUNDS: 4,
    AUTO_MIGRATE: true,
    AUTO_SEED: true,
    CLEAR_DB_BEFORE_TESTS: true,
    USE_MOCK_EXCHANGE: true,
    ENABLE_QUERY_CACHE: false,
    CACHE_TTL: 60,
    API_TIMEOUT: 5000,
    DB_QUERY_TIMEOUT: 3000,
  },
};

/**
 * Configuration Manager
 * Handles loading, validating, and optimizing configuration based on environment
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private environment: Environment;

  private constructor() {
    this.environment = this.detectEnvironment();
    this.loadEnvironmentFile();
    this.config = this.loadAndValidateConfig();
    this.applyEnvironmentOptimizations();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get configuration
   */
  public getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Get environment
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig() {
    return {
      host: this.config.DB_HOST,
      port: this.config.DB_PORT,
      database: this.config.DB_NAME,
      user: this.config.DB_USER,
      password: this.config.DB_PASSWORD,
      ssl: this.config.DB_SSL,
      pool: {
        min: this.config.DB_POOL_MIN,
        max: this.config.DB_POOL_MAX,
        idleTimeoutMillis: this.config.DB_POOL_IDLE_TIMEOUT,
        connectionTimeoutMillis: this.config.DB_POOL_CONNECTION_TIMEOUT,
      },
    };
  }

  /**
   * Get Redis configuration
   */
  public getRedisConfig() {
    return {
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
      password: this.config.REDIS_PASSWORD,
      db: this.config.REDIS_DB,
      clusterMode: this.config.REDIS_CLUSTER_MODE,
    };
  }

  /**
   * Get performance monitoring configuration
   */
  public getPerformanceConfig() {
    return {
      enabled: this.config.ENABLE_PERFORMANCE_MONITORING,
      sampleRate: this.config.PERFORMANCE_SAMPLE_RATE,
      metricsInterval: this.config.METRICS_COLLECTION_INTERVAL,
      serviceName: this.config.APM_SERVICE_NAME,
      environment: this.config.APM_ENVIRONMENT || this.environment,
    };
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig() {
    return {
      corsOrigin: this.config.CORS_ORIGIN.split(','),
      rateLimit: {
        windowMs: this.config.RATE_LIMIT_WINDOW,
        max: this.config.RATE_LIMIT_MAX_REQUESTS,
      },
      bcryptRounds: this.config.BCRYPT_ROUNDS,
      helmet: this.config.ENABLE_HELMET,
      compression: this.config.ENABLE_COMPRESSION,
      jwt: {
        secret: this.config.JWT_SECRET,
        expiresIn: this.config.JWT_EXPIRES_IN,
      },
    };
  }

  /**
   * Get feature flags
   */
  public getFeatureFlags() {
    return {
      mockData: this.config.ENABLE_MOCK_DATA,
      testRoutes: this.config.ENABLE_TEST_ROUTES,
      skipAuth: this.config.SKIP_AUTH_FOR_TESTING,
      debugRoutes: this.config.ENABLE_DEBUG_ROUTES,
      swaggerUI: this.config.ENABLE_SWAGGER_UI,
      hotReload: this.config.ENABLE_HOT_RELOAD,
      advancedAnalytics: this.config.ENABLE_ADVANCED_ANALYTICS,
      machineLearning: this.config.ENABLE_MACHINE_LEARNING,
      riskManagement: this.config.ENABLE_RISK_MANAGEMENT,
      portfolioOptimization: this.config.ENABLE_PORTFOLIO_OPTIMIZATION,
    };
  }

  /**
   * Check if configuration is valid for environment
   */
  public validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Production-specific validations
    if (this.environment === 'production') {
      if (this.config.JWT_SECRET.length < 64) {
        errors.push('JWT_SECRET must be at least 64 characters in production');
      }
      if (this.config.ENABLE_DEBUG_ROUTES) {
        errors.push('Debug routes must be disabled in production');
      }
      if (this.config.ENABLE_TEST_ROUTES) {
        errors.push('Test routes must be disabled in production');
      }
      if (!this.config.DB_SSL) {
        errors.push('Database SSL must be enabled in production');
      }
    }

    // Development-specific validations
    if (this.environment === 'development') {
      if (!this.config.ENABLE_DEBUG_ROUTES) {
        console.warn('Debug routes are disabled in development environment');
      }
    }

    // Test-specific validations
    if (this.environment === 'test') {
      if (!this.config.USE_MOCK_EXCHANGE) {
        errors.push('Mock exchange should be enabled in test environment');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    const env = process.env.NODE_ENV?.toLowerCase();
    if (env === 'production' || env === 'test') {
      return env;
    }
    return 'development';
  }

  /**
   * Load environment-specific .env file
   */
  private loadEnvironmentFile(): void {
    const envFile = path.join(process.cwd(), 'config', `.env.${this.environment}`);
    
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile });
      console.log(`✅ Loaded environment configuration: ${envFile}`);
    } else {
      console.warn(`⚠️  Environment file not found: ${envFile}`);
      // Fallback to root .env file
      dotenv.config({ path: path.join(process.cwd(), '../../.env') });
    }
  }

  /**
   * Load and validate configuration
   */
  private loadAndValidateConfig(): Config {
    try {
      const config = ConfigSchema.parse(process.env);
      console.log(`✅ Configuration validated for ${this.environment} environment`);
      return config;
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      throw new Error(`Invalid configuration: ${error}`);
    }
  }

  /**
   * Apply environment-specific optimizations
   */
  private applyEnvironmentOptimizations(): void {
    const optimizations = EnvironmentOptimizations[this.environment];
    
    // Apply optimizations
    Object.assign(this.config, optimizations);
    
    console.log(`✅ Applied ${this.environment} environment optimizations`);
    
    // Log key optimizations
    console.log(`📊 Database pool: ${this.config.DB_POOL_MIN}-${this.config.DB_POOL_MAX} connections`);
    console.log(`📝 Log level: ${this.config.LOG_LEVEL}`);
    console.log(`🔍 Performance sampling: ${this.config.PERFORMANCE_SAMPLE_RATE * 100}%`);
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();
export const config = configManager.getConfig();

// Export utility functions
export function getEnvironment(): Environment {
  return configManager.getEnvironment();
}

export function isProduction(): boolean {
  return configManager.getEnvironment() === 'production';
}

export function isDevelopment(): boolean {
  return configManager.getEnvironment() === 'development';
}

export function isTest(): boolean {
  return configManager.getEnvironment() === 'test';
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  return configManager.validateConfiguration();
}
