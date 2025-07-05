/**
 * Unified Test Configuration
 * Single source of truth for all test environment variables and settings
 * 
 * This file ensures ALL tests follow the same pattern for:
 * - Environment variable loading
 * - Database connections
 * - API configurations
 * - Real vs testnet control
 * 
 * Usage: Import this in test files instead of directly accessing process.env
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file (single source of truth)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Ensure NODE_ENV is set to 'test' for cleaner console output
process.env.NODE_ENV = 'test';

/**
 * Master toggle for real money vs testnet
 * When BYBIT_TESTNET=false -> Real money/mainnet APIs with private keys
 * When BYBIT_TESTNET=true -> Testnet APIs (safe for testing)
 */
export const IS_TESTNET = process.env.BYBIT_TESTNET === 'true';
export const IS_PRODUCTION_TRADING = !IS_TESTNET;

/**
 * Database Configuration
 * Uses real PostgreSQL connections for integration testing
 */
export const DATABASE_CONFIG = {
  useRealDatabase: process.env.TEST_USE_REAL_DB === 'true',
  host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || process.env.DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'trading_bot_platform_test',
  username: process.env.TEST_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
  ssl: false
};

/**
 * Bybit API Configuration
 * Automatically switches between testnet and mainnet based on BYBIT_TESTNET
 */
export const BYBIT_CONFIG = {
  // When IS_TESTNET=true, use testnet keys
  // When IS_TESTNET=false, use production keys (REAL MONEY!)
  apiKey: IS_TESTNET 
    ? process.env.BYBIT_TESTNET_API_KEY 
    : process.env.BYBIT_API_KEY,
  apiSecret: IS_TESTNET 
    ? process.env.BYBIT_TESTNET_API_SECRET 
    : process.env.BYBIT_API_SECRET,
  testnet: IS_TESTNET,
  baseUrl: IS_TESTNET 
    ? 'https://api-testnet.bybit.com' 
    : 'https://api.bybit.com'
};

/**
 * Test Execution Configuration
 */
export const TEST_CONFIG = {
  timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
  maxWorkers: parseInt(process.env.JEST_MAX_WORKERS || '4'),
  enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true',
  skipInCI: process.env.CI === 'true'
};

/**
 * Sensitive Operations Control
 * These operations should NEVER run with real money unless explicitly enabled
 */
export const SENSITIVE_OPERATIONS = {
  // Order placement - only allow in testnet unless explicitly overridden
  allowOrderPlacement: IS_TESTNET || process.env.ALLOW_REAL_ORDERS === 'true',
  // Fund transfers - only allow in testnet unless explicitly overridden  
  allowFundTransfers: IS_TESTNET || process.env.ALLOW_REAL_TRANSFERS === 'true',
  // Account modifications - only allow in testnet unless explicitly overridden
  allowAccountModifications: IS_TESTNET || process.env.ALLOW_REAL_ACCOUNT_MODS === 'true'
};

/**
 * Validation Functions
 */
export function validateTestConfiguration(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate Bybit API keys
  if (!BYBIT_CONFIG.apiKey || 
      BYBIT_CONFIG.apiKey === 'REPLACE_WITH_TEST_KEY' ||
      BYBIT_CONFIG.apiKey === 'your_bybit_testnet_api_key_here' ||
      BYBIT_CONFIG.apiKey === 'your_bybit_api_key_here') {
    errors.push(`Missing or placeholder ${IS_TESTNET ? 'BYBIT_TESTNET_API_KEY' : 'BYBIT_API_KEY'}`);
  }

  if (!BYBIT_CONFIG.apiSecret || 
      BYBIT_CONFIG.apiSecret === 'REPLACE_WITH_TEST_SECRET' ||
      BYBIT_CONFIG.apiSecret === 'your_bybit_testnet_api_secret_here' ||
      BYBIT_CONFIG.apiSecret === 'your_bybit_api_secret_here') {
    errors.push(`Missing or placeholder ${IS_TESTNET ? 'BYBIT_TESTNET_API_SECRET' : 'BYBIT_API_SECRET'}`);
  }

  // Validate database configuration if real DB is enabled
  if (DATABASE_CONFIG.useRealDatabase) {
    if (!DATABASE_CONFIG.host) errors.push('Missing database host');
    if (!DATABASE_CONFIG.database) errors.push('Missing database name');
    if (!DATABASE_CONFIG.username) errors.push('Missing database username');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Configuration Summary for Debugging
 */
export function getConfigSummary(): string {
  return `
🔧 TEST CONFIGURATION SUMMARY
═══════════════════════════════════════
Environment: ${IS_TESTNET ? '🧪 TESTNET (Safe)' : '💰 PRODUCTION (Real Money!)'}
Database: ${DATABASE_CONFIG.useRealDatabase ? '🗄️ Real PostgreSQL' : '🔧 Mocked'}
API Keys: ${BYBIT_CONFIG.apiKey ? '✅ Configured' : '❌ Missing'}
Order Placement: ${SENSITIVE_OPERATIONS.allowOrderPlacement ? '✅ Allowed' : '🚫 Blocked'}
Fund Transfers: ${SENSITIVE_OPERATIONS.allowFundTransfers ? '✅ Allowed' : '🚫 Blocked'}
═══════════════════════════════════════

Database: ${DATABASE_CONFIG.database}@${DATABASE_CONFIG.host}:${DATABASE_CONFIG.port}
API Endpoint: ${BYBIT_CONFIG.baseUrl}
Test Timeout: ${TEST_CONFIG.timeout}ms
Max Workers: ${TEST_CONFIG.maxWorkers}
`;
}

/**
 * Safety Warning for Production Trading
 */
export function logSafetyWarning(): void {
  if (IS_PRODUCTION_TRADING) {
    console.warn('');
    console.warn('🚨🚨🚨 PRODUCTION TRADING MODE ENABLED 🚨🚨🚨');
    console.warn('═══════════════════════════════════════════════');
    console.warn('⚠️  BYBIT_TESTNET=false - REAL MONEY INVOLVED!');
    console.warn('⚠️  Tests will use LIVE TRADING API');
    console.warn('⚠️  Orders placed will use REAL FUNDS');
    console.warn('═══════════════════════════════════════════════');
    console.warn('🔧 To use safe testnet mode: BYBIT_TESTNET=true');
    console.warn('');
  }
}
