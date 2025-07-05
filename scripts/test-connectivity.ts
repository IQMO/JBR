#!/usr/bin/env tsx

/**
 * Comprehensive Connectivity Test Script
 * Tests both database and exchange connectivity in testing and real environments
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { performance } from 'perf_hooks';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { database } from '../packages/backend/src/database/database.config';
import BybitExchange from '../packages/backend/src/exchanges/bybit-exchange';
import { MarketType, ExchangeApiKey } from '@jabbr/shared';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

interface ConnectivityReport {
  timestamp: Date;
  environment: {
    NODE_ENV: string;
    BYBIT_TESTNET: string;
    TEST_USE_REAL_DB: string;
  };
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
  };
}

class ConnectivityTester {
  private results: TestResult[] = [];

  /**
   * Run a test with timing and error handling
   */
  private async runTest<T>(
    name: string,
    testFn: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string; duration: number }> {
    const startTime = performance.now();
    
    try {
      console.log(`🧪 Running test: ${name}...`);
      const result = await testFn();
      const duration = performance.now() - startTime;
      
      console.log(`✅ ${name} - PASSED (${duration.toFixed(2)}ms)`);
      
      this.results.push({
        name,
        success: true,
        duration,
        details: result
      });
      
      return { success: true, result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ ${name} - FAILED (${duration.toFixed(2)}ms): ${errorMsg}`);
      
      this.results.push({
        name,
        success: false,
        duration,
        details: null,
        error: errorMsg
      });
      
      return { success: false, error: errorMsg, duration };
    }
  }

  /**
   * Test database connectivity
   */
  private async testDatabaseConnectivity(): Promise<void> {
    console.log('\n📊 Testing Database Connectivity...');

    // Test 1: Database Connection
    await this.runTest('Database Connection', async () => {
      await database.connect();
      return { connected: database.isConnectionActive() };
    });

    // Test 2: Database Health Check
    await this.runTest('Database Health Check', async () => {
      const health = await database.healthCheck();
      return health;
    });

    // Test 3: Simple Query Test
    await this.runTest('Database Query Test', async () => {
      const result = await database.query('SELECT NOW() as current_time, version() as pg_version');
      return {
        queryExecuted: true,
        currentTime: result[0]?.current_time,
        postgresVersion: result[0]?.pg_version?.split(' ')[0]
      };
    });

    // Test 4: Database Configuration
    await this.runTest('Database Configuration', async () => {
      const config = database.getConfig();
      return {
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_NAME,
        ssl: config.DB_SSL,
        poolSettings: {
          min: config.DB_POOL_MIN,
          max: config.DB_POOL_MAX
        }
      };
    });
  }

  /**
   * Test Bybit exchange connectivity
   */
  private async testBybitConnectivity(): Promise<void> {
    console.log('\n🏦 Testing Bybit Exchange Connectivity...');

    const isTestnet = process.env.BYBIT_TESTNET === 'true';
    const apiKey = isTestnet ? process.env.BYBIT_TESTNET_API_KEY : process.env.BYBIT_API_KEY;
    const apiSecret = isTestnet ? process.env.BYBIT_TESTNET_API_SECRET : process.env.BYBIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log(`⚠️ Skipping Bybit tests - missing ${isTestnet ? 'testnet' : 'mainnet'} API credentials`);
      return;
    }

    // Create a proper ExchangeApiKey object
    const apiKeyObj: ExchangeApiKey = {
      id: 'test-connectivity-key',
      userId: 'test-user',
      exchange: 'bybit',
      keyName: isTestnet ? 'Testnet Key' : 'Mainnet Key',
      apiKey,
      apiSecret,
      sandbox: isTestnet,
      permissions: ['read', 'trade'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const exchange = new BybitExchange(apiKeyObj, isTestnet);

    // Test 1: Exchange Connection
    await this.runTest('Bybit Connection', async () => {
      await exchange.connect();
      return {
        connected: exchange.isConnectedToExchange(),
        testnet: isTestnet,
        capabilities: exchange.getCapabilities()
      };
    });

    // Test 2: Exchange API Test
    await this.runTest('Bybit API Test', async () => {
      const testResult = await exchange.testConnection();
      return { apiAccessible: testResult };
    });

    // Test 3: Market Data Test
    await this.runTest('Bybit Market Data', async () => {
      const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
      return {
        symbol: marketData.symbol,
        price: marketData.price,
        timestamp: marketData.timestamp,
        dataAvailable: marketData.price > 0
      };
    });

    // Test 4: Account Balance Test
    await this.runTest('Bybit Account Balance', async () => {
      const balances = await exchange.getBalance();
      return {
        balanceCount: balances.length,
        totalAssets: balances.reduce((sum, bal) => sum + bal.total, 0),
        currencies: balances.map(bal => bal.currency)
      };
    });

    // Test 5: Server Time Sync
    await this.runTest('Bybit Server Time', async () => {
      const serverTime = await exchange.getServerTime();
      const localTime = new Date();
      const timeDiff = Math.abs(serverTime.getTime() - localTime.getTime());
      
      return {
        serverTime: serverTime.toISOString(),
        localTime: localTime.toISOString(),
        timeDifference: timeDiff,
        syncQuality: timeDiff < 5000 ? 'excellent' : timeDiff < 30000 ? 'good' : 'poor'
      };
    });

    // Clean up
    await this.runTest('Bybit Disconnect', async () => {
      await exchange.disconnect();
      return { disconnected: !exchange.isConnectedToExchange() };
    });
  }

  /**
   * Test environment-specific configurations
   */
  private async testEnvironmentConfiguration(): Promise<void> {
    console.log('\n⚙️ Testing Environment Configuration...');

    // Test 1: Environment Variables
    await this.runTest('Environment Variables', async () => {
      const requiredVars = [
        'NODE_ENV',
        'DB_HOST',
        'DB_PORT',
        'DB_NAME',
        'DB_USER',
        'BYBIT_TESTNET'
      ];

      const missing = requiredVars.filter(varName => !process.env[varName]);
      const present = requiredVars.filter(varName => !!process.env[varName]);

      return {
        totalRequired: requiredVars.length,
        present: present.length,
        missing: missing,
        allPresent: missing.length === 0
      };
    });

    // Test 2: API Keys Configuration
    await this.runTest('API Keys Configuration', async () => {
      const isTestnet = process.env.BYBIT_TESTNET === 'true';
      
      const mainnetKeys = {
        hasApiKey: !!process.env.BYBIT_API_KEY,
        hasApiSecret: !!process.env.BYBIT_API_SECRET
      };
      
      const testnetKeys = {
        hasApiKey: !!process.env.BYBIT_TESTNET_API_KEY,
        hasApiSecret: !!process.env.BYBIT_TESTNET_API_SECRET
      };

      return {
        currentMode: isTestnet ? 'testnet' : 'mainnet',
        mainnetKeys,
        testnetKeys,
        activeKeysValid: isTestnet ? 
          (testnetKeys.hasApiKey && testnetKeys.hasApiSecret) :
          (mainnetKeys.hasApiKey && mainnetKeys.hasApiSecret)
      };
    });

    // Test 3: Database Configuration
    await this.runTest('Database Configuration', async () => {
      const useRealDb = process.env.TEST_USE_REAL_DB === 'true';
      const testDbName = process.env.TEST_DB_NAME;
      const prodDbName = process.env.DB_NAME;

      return {
        useRealDb,
        testDatabase: testDbName,
        prodDatabase: prodDbName,
        configurationValid: !useRealDb || (useRealDb && testDbName !== prodDbName)
      };
    });
  }

  /**
   * Test toggle functionality (BYBIT_TESTNET switching)
   */
  private async testToggleFunctionality(): Promise<void> {
    console.log('\n🔄 Testing Toggle Functionality...');

    // Test 1: Current Mode Detection
    await this.runTest('Current Mode Detection', async () => {
      const isTestnet = process.env.BYBIT_TESTNET === 'true';
      const testDbEnabled = process.env.TEST_USE_REAL_DB === 'true';
      
      return {
        bybitMode: isTestnet ? 'testnet' : 'mainnet',
        databaseMode: testDbEnabled ? 'real' : 'mock',
        safeMode: isTestnet && testDbEnabled // Both should be true for safe testing
      };
    });

    // Test 2: Safety Mechanisms
    await this.runTest('Safety Mechanisms', async () => {
      const isTestnet = process.env.BYBIT_TESTNET === 'true';
      const nodeEnv = process.env.NODE_ENV;
      
      // Check if we're in a dangerous configuration
      const dangerousConfig = !isTestnet && nodeEnv !== 'production';
      
      return {
        isTestnet,
        nodeEnv,
        isDangerous: dangerousConfig,
        safetyMessage: dangerousConfig ? 
          'WARNING: Using mainnet API keys in non-production environment!' :
          'Configuration is safe for current environment'
      };
    });
  }

  /**
   * Generate comprehensive connectivity report
   */
  private generateReport(): ConnectivityReport {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    return {
      timestamp: new Date(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        BYBIT_TESTNET: process.env.BYBIT_TESTNET || 'unknown',
        TEST_USE_REAL_DB: process.env.TEST_USE_REAL_DB || 'unknown'
      },
      tests: this.results,
      summary: {
        total,
        passed,
        failed,
        successRate: total > 0 ? (passed / total) * 100 : 0
      }
    };
  }

  /**
   * Run all connectivity tests
   */
  async runAllTests(): Promise<ConnectivityReport> {
    console.log('🔍 Starting Comprehensive Connectivity Tests...');
    console.log('='.repeat(60));
    
    const startTime = performance.now();

    try {
      // Run all test suites
      await this.testEnvironmentConfiguration();
      await this.testToggleFunctionality();
      await this.testDatabaseConnectivity();
      await this.testBybitConnectivity();

      const totalTime = performance.now() - startTime;
      
      console.log('\n' + '='.repeat(60));
      console.log(`🏁 All tests completed in ${totalTime.toFixed(2)}ms`);
      
      const report = this.generateReport();
      
      // Print summary
      console.log('\n📊 Test Summary:');
      console.log(`   Total Tests: ${report.summary.total}`);
      console.log(`   Passed: ${report.summary.passed} ✅`);
      console.log(`   Failed: ${report.summary.failed} ❌`);
      console.log(`   Success Rate: ${report.summary.successRate.toFixed(1)}%`);
      
      if (report.summary.failed > 0) {
        console.log('\n❌ Failed Tests:');
        report.tests
          .filter(test => !test.success)
          .forEach(test => {
            console.log(`   - ${test.name}: ${test.error}`);
          });
      }

      // Environment safety check
      console.log('\n🛡️ Environment Safety:');
      const isTestnet = process.env.BYBIT_TESTNET === 'true';
      const useRealDb = process.env.TEST_USE_REAL_DB === 'true';
      
      if (isTestnet && useRealDb) {
        console.log('   ✅ SAFE: Using testnet API with real database for testing');
      } else if (!isTestnet && process.env.NODE_ENV === 'production') {
        console.log('   ⚠️ PRODUCTION: Using mainnet API in production environment');
      } else if (!isTestnet) {
        console.log('   🚨 DANGER: Using mainnet API keys in non-production environment!');
      } else {
        console.log('   ⚠️ LIMITED: Using testnet but not real database');
      }

      return report;

    } catch (error) {
      console.error('💥 Fatal error during connectivity tests:', error);
      throw error;
    } finally {
      // Cleanup
      try {
        await database.disconnect();
      } catch (error) {
        console.warn('⚠️ Warning: Failed to disconnect from database:', error);
      }
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const tester = new ConnectivityTester();
  
  try {
    const report = await tester.runAllTests();
    
    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = resolve(process.cwd(), 'test-results', 'connectivity-report.json');
    
    try {
      await fs.mkdir(resolve(process.cwd(), 'test-results'), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to: ${reportPath}`);
    } catch (saveError) {
      console.warn('⚠️ Failed to save report:', saveError);
    }
    
    // Exit with appropriate code
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    console.log(`\n${exitCode === 0 ? '🎉' : '💔'} Connectivity test ${exitCode === 0 ? 'completed successfully' : 'completed with failures'}`);
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('💥 Connectivity test failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { ConnectivityTester, type ConnectivityReport };
