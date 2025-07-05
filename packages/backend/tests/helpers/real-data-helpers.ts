/**
 * Real-Data Test Helpers
 * Standardized utilities for consistent real-data testing patterns
 * 
 * These helpers ensure all tests follow the same approach for:
 * - Real database connections
 * - Real API interactions
 * - Consistent error handling
 * - Proper resource cleanup
 */

import { Client } from 'pg';
import { BybitExchange } from '../../src/exchanges/bybit-exchange';
import { MarketType } from '@jabbr/shared';
import { 
  BYBIT_CONFIG, 
  DATABASE_CONFIG, 
  TEST_CONFIG,
  SENSITIVE_OPERATIONS,
  validateTestConfiguration,
  getConfigSummary,
  logSafetyWarning,
  IS_TESTNET,
  IS_PRODUCTION_TRADING
} from '../config/test-config';

/**
 * Real Database Test Helper
 * Provides standardized real PostgreSQL database connections for tests
 */
export class RealDatabaseTestHelper {
  private client: Client | null = null;
  private testDbName: string;

  constructor(testDbName?: string) {
    this.testDbName = testDbName || DATABASE_CONFIG.database;
  }

  /**
   * Connect to real test database
   */
  async connect(): Promise<Client> {
    if (!DATABASE_CONFIG.useRealDatabase) {
      throw new Error('Real database testing is disabled. Set TEST_USE_REAL_DB=true');
    }

    this.client = new Client({
      host: DATABASE_CONFIG.host,
      port: DATABASE_CONFIG.port,
      database: this.testDbName,
      user: DATABASE_CONFIG.username,
      password: DATABASE_CONFIG.password,
      ssl: DATABASE_CONFIG.ssl
    });

    await this.client.connect();
    return this.client;
  }

  /**
   * Execute SQL query with real database
   */
  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first');
    }
    return await this.client.query(sql, params);
  }

  /**
   * Clean up test data (safer than full table truncation)
   */
  async cleanupTestData(testUserId?: string): Promise<void> {
    if (!this.client) return;

    const cleanupQueries = [
      // Clean up test-specific data only
      testUserId ? `DELETE FROM risk_management WHERE user_id = $1` : null,
      testUserId ? `DELETE FROM trading_bots WHERE user_id = $1` : null,
      testUserId ? `DELETE FROM api_keys WHERE user_id = $1` : null,
      // Add more cleanup queries as needed
    ].filter(Boolean);

    for (const query of cleanupQueries) {
      if (query) {
        await this.client.query(query, testUserId ? [testUserId] : []);
      }
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}

/**
 * Real Exchange Test Helper
 * Provides standardized real API connections for exchange testing
 */
export class RealExchangeTestHelper {
  private exchange: BybitExchange | null = null;

  /**
   * Create real exchange connection
   */
  async createExchange(): Promise<BybitExchange> {
    const validation = validateTestConfiguration();
    if (!validation.isValid) {
      throw new Error(`Test configuration invalid: ${validation.errors.join(', ')}`);
    }

    // Log safety warning for production trading
    logSafetyWarning();

    // Create API key object
    const apiKey = {
      id: 'test-key-1',
      userId: 'test-user',
      exchange: 'bybit' as const,
      keyName: IS_TESTNET ? 'Testnet Key' : 'Production Key',
      apiKey: BYBIT_CONFIG.apiKey!,
      apiSecret: BYBIT_CONFIG.apiSecret!,
      sandbox: IS_TESTNET,
      permissions: ['trade', 'read'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.exchange = new BybitExchange(apiKey, IS_TESTNET);
    await this.exchange.connect();
    
    return this.exchange;
  }

  /**
   * Execute safe market data request (allowed in both testnet and production)
   */
  async fetchMarketData(symbol: string = 'BTCUSDT') {
    if (!this.exchange) {
      throw new Error('Exchange not connected. Call createExchange() first');
    }
    return await this.exchange.getMarketData(symbol, MarketType.SPOT);
  }

  /**
   * Execute order placement (only if sensitive operations are allowed)
   */
  async placeTestOrder(orderParams: any) {
    if (!SENSITIVE_OPERATIONS.allowOrderPlacement) {
      throw new Error(
        `Order placement blocked in ${IS_TESTNET ? 'testnet' : 'production'} mode. ` +
        'Set ALLOW_REAL_ORDERS=true to override (NOT RECOMMENDED for production)'
      );
    }

    if (!this.exchange) {
      throw new Error('Exchange not connected. Call createExchange() first');
    }

    // Additional safety check for production
    if (IS_PRODUCTION_TRADING) {
      console.warn('🚨 PLACING REAL ORDER WITH REAL MONEY! 🚨');
    }

    return await this.exchange.placeOrder(orderParams);
  }

  /**
   * Disconnect from exchange
   */
  async disconnect(): Promise<void> {
    if (this.exchange) {
      await this.exchange.disconnect();
      this.exchange = null;
    }
  }
}

/**
 * Test Environment Validator
 * Validates test environment is properly configured before running tests
 */
export class TestEnvironmentValidator {
  static validate(): void {
    const validation = validateTestConfiguration();
    
    if (!validation.isValid) {
      console.error('');
      console.error('❌ TEST CONFIGURATION INVALID');
      console.error('═══════════════════════════════════════');
      validation.errors.forEach(error => console.error(`   ❌ ${error}`));
      console.error('');
      console.error('🔧 REQUIRED ACTIONS:');
      console.error('   1. Check your .env file configuration');
      console.error('   2. Ensure API keys are properly set');
      console.error('   3. Verify database connection settings');
      console.error('');
      throw new Error('Test environment validation failed');
    }

    // Log configuration summary
    if (TEST_CONFIG.enableDebugLogs) {
      console.log(getConfigSummary());
    }
  }

  static skipTestIfInvalid(testName: string): boolean {
    try {
      TestEnvironmentValidator.validate();
      return false; // Don't skip
    } catch (error) {
      console.log(`⏭️  Skipping ${testName}: ${(error as Error).message}`);
      return true; // Skip test
    }
  }
}

/**
 * Standardized Test Lifecycle Helpers
 */
export class TestLifecycleHelper {
  private dbHelper: RealDatabaseTestHelper | null = null;
  private exchangeHelper: RealExchangeTestHelper | null = null;

  /**
   * Standard test setup
   */
  async setupTest(options: {
    useDatabase?: boolean;
    useExchange?: boolean;
    testUserId?: string;
  } = {}): Promise<{
    db?: RealDatabaseTestHelper;
    exchange?: RealExchangeTestHelper;
  }> {
    const result: any = {};

    if (options.useDatabase) {
      this.dbHelper = new RealDatabaseTestHelper();
      await this.dbHelper.connect();
      result.db = this.dbHelper;
    }

    if (options.useExchange) {
      this.exchangeHelper = new RealExchangeTestHelper();
      await this.exchangeHelper.createExchange();
      result.exchange = this.exchangeHelper;
    }

    return result;
  }

  /**
   * Standard test cleanup
   */
  async cleanupTest(testUserId?: string): Promise<void> {
    try {
      if (this.dbHelper) {
        await this.dbHelper.cleanupTestData(testUserId);
        await this.dbHelper.disconnect();
        this.dbHelper = null;
      }

      if (this.exchangeHelper) {
        await this.exchangeHelper.disconnect();
        this.exchangeHelper = null;
      }
    } catch (error) {
      console.warn('Warning: Test cleanup failed:', error);
    }
  }
}

/**
 * Export convenience functions for common test patterns
 */
export {
  IS_TESTNET,
  IS_PRODUCTION_TRADING,
  BYBIT_CONFIG,
  DATABASE_CONFIG,
  TEST_CONFIG,
  SENSITIVE_OPERATIONS,
  validateTestConfiguration,
  getConfigSummary,
  logSafetyWarning
};
