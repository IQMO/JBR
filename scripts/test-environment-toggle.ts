#!/usr/bin/env tsx

/**
 * Environment Toggle Test Script
 * Tests switching between testnet and mainnet configurations
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { performance } from 'perf_hooks';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

import BybitExchange from '../packages/backend/src/exchanges/bybit-exchange';
import { ExchangeApiKey } from '@jabbr/shared';

interface ToggleTestResult {
  mode: 'testnet' | 'mainnet';
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

class EnvironmentToggleTester {
  private results: ToggleTestResult[] = [];

  /**
   * Create a proper ExchangeApiKey object for testing
   */
  private createTestApiKey(isTestnet: boolean): ExchangeApiKey {
    const apiKey = isTestnet ? process.env.BYBIT_TESTNET_API_KEY : process.env.BYBIT_API_KEY;
    const apiSecret = isTestnet ? process.env.BYBIT_TESTNET_API_SECRET : process.env.BYBIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error(`Missing ${isTestnet ? 'testnet' : 'mainnet'} API credentials`);
    }

    return {
      id: `test-${isTestnet ? 'testnet' : 'mainnet'}-key`,
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
  }

  /**
   * Test connectivity for a specific mode
   */
  private async testMode(isTestnet: boolean): Promise<ToggleTestResult> {
    const mode = isTestnet ? 'testnet' : 'mainnet';
    const startTime = performance.now();

    try {
      console.log(`\n🧪 Testing ${mode.toUpperCase()} Mode...`);

      // Create API key object
      const apiKeyObj = this.createTestApiKey(isTestnet);
      
      // Initialize exchange
      const exchange = new BybitExchange(apiKeyObj, isTestnet);

      const testDetails: any = {
        mode,
        environment: isTestnet ? 'testnet' : 'mainnet',
        capabilities: exchange.getCapabilities()
      };

      // Test connection
      console.log(`🔌 Connecting to Bybit ${mode}...`);
      await exchange.connect();
      testDetails.connected = exchange.isConnectedToExchange();

      // Test API connectivity
      console.log(`📡 Testing ${mode} API...`);
      const apiTest = await exchange.testConnection();
      testDetails.apiTest = apiTest;

      // Get server time to verify connection
      console.log(`⏰ Getting ${mode} server time...`);
      const serverTime = await exchange.getServerTime();
      const localTime = new Date();
      const timeDiff = Math.abs(serverTime.getTime() - localTime.getTime());
      
      testDetails.timeSync = {
        serverTime: serverTime.toISOString(),
        localTime: localTime.toISOString(),
        timeDifference: timeDiff,
        syncQuality: timeDiff < 5000 ? 'excellent' : timeDiff < 30000 ? 'good' : 'poor'
      };

      // Test account balance (read-only operation)
      console.log(`💰 Getting ${mode} account balance...`);
      const balances = await exchange.getBalance();
      testDetails.balances = {
        count: balances.length,
        totalAssets: balances.reduce((sum, bal) => sum + bal.total, 0),
        currencies: balances.map(bal => bal.currency)
      };

      // Test market data
      console.log(`📊 Getting ${mode} market data...`);
      const marketData = await exchange.getMarketData('BTCUSDT', 'futures' as any);
      testDetails.marketData = {
        symbol: marketData.symbol,
        price: marketData.price,
        timestamp: marketData.timestamp,
        valid: marketData.price > 0
      };

      // Disconnect
      console.log(`🔌 Disconnecting from ${mode}...`);
      await exchange.disconnect();
      testDetails.disconnected = !exchange.isConnectedToExchange();

      const duration = performance.now() - startTime;
      console.log(`✅ ${mode.toUpperCase()} test completed successfully (${duration.toFixed(2)}ms)`);

      return {
        mode: mode as 'testnet' | 'mainnet',
        success: true,
        duration,
        details: testDetails
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ ${mode.toUpperCase()} test failed (${duration.toFixed(2)}ms): ${errorMsg}`);

      return {
        mode: mode as 'testnet' | 'mainnet',
        success: false,
        duration,
        details: { mode, error: errorMsg },
        error: errorMsg
      };
    }
  }

  /**
   * Test environment variable switching
   */
  private testEnvironmentVariables(): void {
    console.log('\n🔍 Environment Variable Analysis:');
    console.log('='.repeat(50));

    const currentMode = process.env.BYBIT_TESTNET === 'true' ? 'testnet' : 'mainnet';
    const useRealDb = process.env.TEST_USE_REAL_DB === 'true';

    console.log(`📊 Current Configuration:`);
    console.log(`   BYBIT_TESTNET: ${process.env.BYBIT_TESTNET}`);
    console.log(`   TEST_USE_REAL_DB: ${process.env.TEST_USE_REAL_DB}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   Active Mode: ${currentMode.toUpperCase()}`);
    console.log(`   Database Mode: ${useRealDb ? 'REAL' : 'MOCK'}`);

    // API Key Availability
    console.log(`\n🔑 API Key Availability:`);
    console.log(`   Testnet Keys: ${process.env.BYBIT_TESTNET_API_KEY ? '✅ Available' : '❌ Missing'}`);
    console.log(`   Mainnet Keys: ${process.env.BYBIT_API_KEY ? '✅ Available' : '❌ Missing'}`);

    // Safety Analysis
    console.log(`\n🛡️ Safety Analysis:`);
    if (currentMode === 'testnet' && useRealDb) {
      console.log('   ✅ SAFE: Using testnet API with real database for testing');
    } else if (currentMode === 'mainnet' && process.env.NODE_ENV === 'production') {
      console.log('   ⚠️ PRODUCTION: Using mainnet API in production environment');
    } else if (currentMode === 'mainnet') {
      console.log('   🚨 DANGER: Using mainnet API keys in non-production environment!');
      console.log('   💡 Recommendation: Set BYBIT_TESTNET=true for development');
    } else {
      console.log('   ⚠️ LIMITED: Using testnet but not real database');
      console.log('   💡 Consider setting TEST_USE_REAL_DB=true for integration testing');
    }
  }

  /**
   * Test environment switching capability
   */
  private async testEnvironmentSwitching(): Promise<void> {
    console.log('\n🔄 Testing Environment Switching Capability...');
    console.log('='.repeat(50));

    // Test current mode
    const currentTestnet = process.env.BYBIT_TESTNET === 'true';
    console.log(`🎯 Current environment: ${currentTestnet ? 'TESTNET' : 'MAINNET'}`);

    // Test if we can create instances for different modes
    try {
      // Test both modes if credentials are available
      const testnetCredentialsAvailable = !!(process.env.BYBIT_TESTNET_API_KEY && process.env.BYBIT_TESTNET_API_SECRET);
      const mainnetCredentialsAvailable = !!(process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET);

      if (testnetCredentialsAvailable) {
        console.log('✅ Testnet credentials available - can switch to testnet mode');
      } else {
        console.log('❌ Testnet credentials missing - cannot switch to testnet mode');
      }

      if (mainnetCredentialsAvailable) {
        console.log('✅ Mainnet credentials available - can switch to mainnet mode');
      } else {
        console.log('❌ Mainnet credentials missing - cannot switch to mainnet mode');
      }

      // Test instantiation with different modes
      if (testnetCredentialsAvailable) {
        const testnetApiKey = this.createTestApiKey(true);
        const testnetExchange = new BybitExchange(testnetApiKey, true);
        console.log('✅ Testnet exchange instance created successfully');
      }

      if (mainnetCredentialsAvailable) {
        const mainnetApiKey = this.createTestApiKey(false);
        const mainnetExchange = new BybitExchange(mainnetApiKey, false);
        console.log('✅ Mainnet exchange instance created successfully');
      }

    } catch (error) {
      console.log(`❌ Environment switching test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run comprehensive toggle tests
   */
  async runToggleTests(): Promise<void> {
    console.log('🔄 Starting Environment Toggle Tests...');
    console.log('='.repeat(60));

    const startTime = performance.now();

    try {
      // Analyze environment variables
      this.testEnvironmentVariables();

      // Test switching capability
      await this.testEnvironmentSwitching();

      // Test actual connectivity for available modes
      const testnetAvailable = !!(process.env.BYBIT_TESTNET_API_KEY && process.env.BYBIT_TESTNET_API_SECRET);
      const mainnetAvailable = !!(process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET);

      if (testnetAvailable) {
        const testnetResult = await this.testMode(true);
        this.results.push(testnetResult);
      } else {
        console.log('\n⏭️ Skipping testnet connectivity test - credentials not available');
      }

      if (mainnetAvailable) {
        // Only test mainnet if explicitly requested or in production
        if (process.env.NODE_ENV === 'production' || process.env.TEST_MAINNET === 'true') {
          const mainnetResult = await this.testMode(false);
          this.results.push(mainnetResult);
        } else {
          console.log('\n⏭️ Skipping mainnet connectivity test - not in production mode');
          console.log('   💡 Set TEST_MAINNET=true to force mainnet testing (⚠️ CAUTION)');
        }
      } else {
        console.log('\n⏭️ Skipping mainnet connectivity test - credentials not available');
      }

      const totalTime = performance.now() - startTime;

      // Generate summary
      console.log('\n' + '='.repeat(60));
      console.log(`🏁 Toggle tests completed in ${totalTime.toFixed(2)}ms`);
      
      console.log('\n📊 Test Results Summary:');
      const passedTests = this.results.filter(r => r.success).length;
      const failedTests = this.results.filter(r => !r.success).length;
      console.log(`   Total Tests: ${this.results.length}`);
      console.log(`   Passed: ${passedTests} ✅`);
      console.log(`   Failed: ${failedTests} ❌`);

      if (failedTests > 0) {
        console.log('\n❌ Failed Tests:');
        this.results
          .filter(test => !test.success)
          .forEach(test => {
            console.log(`   - ${test.mode.toUpperCase()}: ${test.error}`);
          });
      }

      // Final recommendations
      console.log('\n💡 Recommendations:');
      const currentMode = process.env.BYBIT_TESTNET === 'true' ? 'testnet' : 'mainnet';
      if (currentMode === 'testnet') {
        console.log('   ✅ Current setup is safe for development and testing');
        console.log('   🔄 To switch to production: Set BYBIT_TESTNET=false');
      } else {
        console.log('   ⚠️ Currently in mainnet mode - be cautious with trading operations');
        console.log('   🔄 To switch to testing: Set BYBIT_TESTNET=true');
      }

      console.log('   📚 Toggle by changing BYBIT_TESTNET in .env file');
      console.log('   🔄 Restart application after changing environment variables');

    } catch (error) {
      console.error('💥 Toggle test failed:', error);
      throw error;
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const tester = new EnvironmentToggleTester();
  
  try {
    await tester.runToggleTests();
    console.log('\n🎉 Environment toggle test completed successfully');
  } catch (error) {
    console.error('💥 Environment toggle test failed:', error);
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

export { EnvironmentToggleTester };
