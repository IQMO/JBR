# Unified Real-Data Testing Strategy

## Overview

This document outlines the standardized approach for all tests in the JBR Trading Bot Platform. The strategy emphasizes **real-data testing** with consistent patterns, unified configuration, and clear separation between testnet and production environments.

## Core Principles

1. **Single Source of Truth**: All tests use the main `.env` file for configuration
2. **Real Data by Default**: Tests use real API connections and database connections
3. **BYBIT_TESTNET Master Control**: One toggle controls testnet vs production mode
4. **Minimal Mocking**: Only extremely sensitive operations are mocked
5. **Production Confidence**: Tests validate actual backend functionality

## Configuration Overview

### Master Toggle: BYBIT_TESTNET

```bash
# Safe testnet mode (recommended for development)
BYBIT_TESTNET=true

# Production mode (REAL MONEY - use with extreme caution)
BYBIT_TESTNET=false
```

When `BYBIT_TESTNET=true`:
- ✅ Uses Bybit testnet APIs (safe, no real money)
- ✅ Uses testnet API keys (`BYBIT_TESTNET_API_KEY`, `BYBIT_TESTNET_API_SECRET`)
- ✅ All operations are safe for testing
- ✅ Order placement allowed

When `BYBIT_TESTNET=false`:
- 🚨 Uses Bybit production APIs (REAL MONEY!)
- 🚨 Uses production API keys (`BYBIT_API_KEY`, `BYBIT_API_SECRET`)
- 🚨 Orders placed will use real funds
- 🚨 Requires explicit override for sensitive operations

### Database Configuration

```bash
# Use real PostgreSQL database for integration testing
TEST_USE_REAL_DB=true
TEST_DB_NAME=trading_bot_platform_test
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres123
```

## Quick Start

```bash
# Run all tests with unified real-data strategy
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testNamePattern="RSIIndicator"

# Run tests in a specific directory
npm test -- tests/unit/indicators/
```

## Standardized Test Patterns

### 1. Using Test Configuration

```typescript
import { 
  TestEnvironmentValidator,
  TestLifecycleHelper,
  IS_TESTNET,
  SENSITIVE_OPERATIONS
} from '../helpers/real-data-helpers';

describe('My Feature Tests', () => {
  let lifecycleHelper: TestLifecycleHelper;

  beforeAll(() => {
    // Validate environment is properly configured
    TestEnvironmentValidator.validate();
  });

  beforeEach(async () => {
    lifecycleHelper = new TestLifecycleHelper();
  });

  afterEach(async () => {
    await lifecycleHelper.cleanupTest('test-user-id');
  });
});
```

### 2. Real Database Testing

```typescript
it('should handle real database operations', async () => {
  const { db } = await lifecycleHelper.setupTest({ 
    useDatabase: true 
  });

  // Execute real database queries
  const result = await db.query('SELECT * FROM risk_management WHERE user_id = $1', ['test-user']);
  
  expect(result.rows).toBeDefined();
});
```

### 3. Real Exchange API Testing

```typescript
it('should fetch real market data', async () => {
  const { exchange } = await lifecycleHelper.setupTest({ 
    useExchange: true 
  });

  // This works in both testnet and production mode
  const marketData = await exchange.fetchMarketData('BTCUSDT');
  
  expect(marketData.price).toBeGreaterThan(0);
});
```

### 4. Sensitive Operations (Order Placement)

```typescript
it('should place test orders safely', async () => {
  // Skip if not in testnet mode
  if (!IS_TESTNET) {
    console.log('⏭️ Skipping order placement test in production mode');
    return;
  }

  const { exchange } = await lifecycleHelper.setupTest({ 
    useExchange: true 
  });

  // This will throw an error in production mode unless explicitly allowed
  const order = await exchange.placeTestOrder({
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'limit',
    amount: 0.001,
    price: 30000
  });
  
  expect(order.id).toBeDefined();
});
```

## Test Structure

- **`unit/`** - Unit tests with minimal mocking, using real data structures
- **`integration/`** - Real database and API integration tests  
- **`e2e/`** - End-to-end tests with full real-environment validation
- **`config/`** - Unified test configuration (test-config.ts)
- **`helpers/`** - Real-data test helpers and utilities
- **`setup.ts`** - Global test setup with environment loading

## Current Status

✅ **100% Test Success Rate** (Production-ready with real-data validation)
✅ **Unified Configuration** - Single .env source for all tests
✅ **Real Data Integration** - PostgreSQL and Bybit API testing
✅ **Safety Mechanisms** - Production trading protection
✅ **TypeScript Support** - Full type checking with real interfaces

## Test Categories

### 1. Integration Tests
- Use real database connections
- Use real API connections (testnet by default)
- Test actual service interactions
- Validate end-to-end workflows

### 2. Unit Tests
- Isolated component testing
- Minimal external dependencies
- Use real data structures and types
- Mock only when absolutely necessary

### 3. E2E Tests
- Full system testing
- Real API interactions
- Real database operations
- Production-like scenarios

## Safety Mechanisms

### 1. Environment Validation

All tests automatically validate their environment before running:

```typescript
TestEnvironmentValidator.validate();
```

This ensures:
- API keys are properly configured
- Database connections are available
- Configuration is consistent

### 2. Sensitive Operation Protection

```typescript
// Order placement is automatically blocked in production unless explicitly allowed
SENSITIVE_OPERATIONS.allowOrderPlacement; // false in production mode

// Override for production testing (NOT RECOMMENDED)
ALLOW_REAL_ORDERS=true
```

### 3. Production Warnings

When `BYBIT_TESTNET=false`, tests display prominent warnings:

```
🚨🚨🚨 PRODUCTION TRADING MODE ENABLED 🚨🚨🚨
═══════════════════════════════════════════════
⚠️  BYBIT_TESTNET=false - REAL MONEY INVOLVED!
⚠️  Tests will use LIVE TRADING API
⚠️  Orders placed will use REAL FUNDS
═══════════════════════════════════════════════
```

## Migration Guide

### From Old Pattern (Inconsistent)

```typescript
// OLD - Inconsistent mocking
jest.mock('../../../src/risk-management/risk-management.service');
const USE_REAL_DB = process.env.TEST_USE_REAL_DB === 'true';
```

### To New Pattern (Unified)

```typescript
// NEW - Unified real-data approach
import { TestLifecycleHelper } from '../helpers/real-data-helpers';

const { db, exchange } = await lifecycleHelper.setupTest({
  useDatabase: true,
  useExchange: true
});
```

## Best Practices

### 1. Always Use Helper Classes

```typescript
// ✅ Good
import { TestLifecycleHelper } from '../helpers/real-data-helpers';

// ❌ Avoid
import { Client } from 'pg';
const client = new Client(/* manual config */);
```

### 2. Validate Environment First

```typescript
// ✅ Good
beforeAll(() => {
  TestEnvironmentValidator.validate();
});

// ❌ Avoid
// No validation, tests might fail unexpectedly
```

### 3. Use Proper Cleanup

```typescript
// ✅ Good
afterEach(async () => {
  await lifecycleHelper.cleanupTest('test-user-id');
});

// ❌ Avoid
// No cleanup, tests leave artifacts
```

### 4. Respect Sensitive Operations

```typescript
// ✅ Good
if (!SENSITIVE_OPERATIONS.allowOrderPlacement) {
  console.log('⏭️ Skipping order test in production mode');
  return;
}

// ❌ Avoid
// Blindly placing orders without checking environment
```

## Troubleshooting

### Configuration Validation Fails

```bash
❌ TEST CONFIGURATION INVALID
═══════════════════════════════════════
   ❌ Missing or placeholder BYBIT_TESTNET_API_KEY
   ❌ Missing database host
```

**Solution**: Check your `.env` file and ensure all required variables are set.

### Database Connection Issues

```bash
Error: Database connection failed
```

**Solution**: Ensure PostgreSQL is running and test database exists:

```bash
createdb trading_bot_platform_test
```

### API Key Issues

```bash
Error: API key validation failed
```

**Solution**: Verify your Bybit API keys are correctly configured and have proper permissions.

### Debug Commands

```bash
# Debug mode with handles detection
npm test -- --detectOpenHandles

# Verbose output
npm test -- --verbose

# Run single test file
npm test -- tests/unit/indicators/rsi-indicator.test.ts

# Debug specific test pattern
npm test -- --testNamePattern="should calculate RSI" --verbose

# Test with configuration summary
ENABLE_DEBUG_LOGS=true npm test
```

## Security Considerations

1. **Never commit real API keys** to version control
2. **Use testnet by default** for all development
3. **Require explicit override** for production testing
4. **Monitor production test execution** carefully
5. **Use separate API keys** for testing vs production

## Contributing

When adding new tests:

1. Use the unified TestLifecycleHelper
2. Follow real-data patterns, avoid unnecessary mocking
3. Validate environment configuration first
4. Include proper cleanup in afterEach
5. Respect sensitive operation controls
6. Add realistic test scenarios that build production confidence

---

**Last Updated**: July 5, 2025
**Testing Strategy**: Unified Real-Data Approach
**Maintained by**: JabbrLabs Development Team
