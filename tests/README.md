# JBR Testing Infrastructure

This directory contains the root-level testing infrastructure and cross-package integration tests for the JBR Trading Bot Platform.

## 🏗️ Testing Architecture

```
Testing Layer Structure:
┌─────────────────────────────────────┐
│        End-to-End Tests             │ ← Full system workflows
├─────────────────────────────────────┤
│      Integration Tests              │ ← Cross-package interactions  
├─────────────────────────────────────┤
│         Unit Tests                  │ ← Individual components
└─────────────────────────────────────┘
```

## 📁 Directory Structure

```
tests/
├── global-setup.ts             # Global test environment setup
├── global-teardown.ts          # Global test cleanup
├── jest.setup.ts               # Jest configuration and globals
├── e2e/                        # End-to-end system tests
│   ├── trading/               # Trading workflow tests
│   ├── api/                   # API endpoint tests
│   └── ui/                    # User interface tests
├── integration/                # Cross-package integration tests
│   ├── backend-frontend/      # API-UI integration
│   ├── database/              # Database integration
│   └── external-apis/         # Third-party service integration
├── fixtures/                   # Test data and mocks
│   ├── market-data/           # Sample market data
│   ├── strategies/            # Test strategy configurations
│   └── users/                 # Test user data
├── utils/                      # Testing utilities and helpers
│   ├── test-helpers.ts        # Common test utilities
│   ├── mock-factories.ts      # Mock data generators
│   └── database-helpers.ts    # Database testing utilities
└── config/                     # Test configuration
    ├── jest.config.ts         # Jest configuration
    └── test-env.ts            # Test environment settings
```

## 🧪 Test Categories

### **Unit Tests** (Package-Specific)
Located in individual package directories:
- `packages/backend/tests/` - Backend unit tests
- `packages/frontend/tests/` - Frontend component tests  
- `packages/shared/tests/` - Shared utility tests

### **Integration Tests** (`./integration/`)
Cross-package and service integration:
- **API Integration** - Backend API with database
- **Frontend Integration** - UI components with API services
- **External Services** - Exchange APIs, WebSocket connections
- **Database Integration** - Data persistence and retrieval

### **End-to-End Tests** (`./e2e/`)
Complete user workflows and system scenarios:
- **Trading Workflows** - Complete trading operations
- **Strategy Management** - Strategy creation and execution
- **User Interface** - Complete UI user journeys
- **System Performance** - Load and stress testing

## 🔧 Testing Technologies

### **Core Testing Framework**
- **Jest** - Primary testing framework
- **TypeScript** - Type-safe test development
- **Supertest** - HTTP API testing
- **Testing Library** - Component testing utilities

### **Database Testing**
- **Test Containers** - Isolated database instances
- **Database Fixtures** - Consistent test data
- **Transaction Rollback** - Clean test state

### **API Testing**
- **Supertest** - Express API testing
- **Mock Service Worker** - API mocking
- **WebSocket Testing** - Real-time communication testing

### **UI Testing** (Future)
- **Playwright** - End-to-end browser testing
- **Storybook** - Component visual testing
- **Accessibility Testing** - WCAG compliance

## 🚀 Running Tests

### **All Tests**
```bash
# Run all tests across the platform
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### **Specific Test Categories**
```bash
# Run only unit tests
npm run test:unit

# Run only integration tests  
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run specific test file
npm test -- --testPathPattern=trading
```

### **Package-Specific Tests**
```bash
# Backend tests only
cd packages/backend && npm test

# Frontend tests only
cd packages/frontend && npm test

# Shared package tests only
cd packages/shared && npm test
```

## 🔧 Test Configuration

### **Jest Configuration** (`jest.config.ts`)
```typescript
export default {
  // Global test setup
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  setupFilesAfterEnv: ['./tests/jest.setup.ts'],
  
  // TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  
  // Module resolution
  moduleNameMapping: {
    '^@jbr/shared': '<rootDir>/packages/shared/src',
    '^@jbr/backend': '<rootDir>/packages/backend/src',
    '^@jbr/frontend': '<rootDir>/packages/frontend/src'
  }
};
```

### **Global Setup** (`global-setup.ts`)
```typescript
// Global test environment initialization
export default async function globalSetup() {
  // Start test database
  await startTestDatabase();
  
  // Initialize test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/jbr_test';
  
  // Set up test services
  await initializeTestServices();
}
```

## 📊 Test Data Management

### **Fixtures** (`./fixtures/`)
Reusable test data for consistent testing:

```typescript
// Market data fixtures
export const SAMPLE_MARKET_DATA = {
  BTCUSDT: {
    price: 45000,
    volume: 1234567,
    timestamp: new Date('2024-01-01T00:00:00Z')
  }
};

// Strategy fixtures
export const TEST_STRATEGIES = {
  SMA_STRATEGY: {
    name: 'Test SMA Strategy',
    parameters: { shortPeriod: 10, longPeriod: 20 }
  }
};
```

### **Mock Factories** (`packages/shared/src/test-utils/data-generators.ts`)
Dynamic test data generation:

```typescript
// Generate test trading signals
export function createMockTradingSignal(overrides = {}): TradingSignal {
  return {
    id: uuid(),
    symbol: 'BTCUSDT',
    signal: 'BUY',
    strength: 0.8,
    timestamp: new Date(),
    ...overrides
  };
}

// Generate test market data
export function createMockMarketData(symbol: string): MarketData {
  return {
    symbol,
    price: Math.random() * 50000,
    volume: Math.random() * 1000000,
    timestamp: new Date()
  };
}
```

## 🔍 Test Utilities

### **Database Helpers** (`packages/shared/src/test-utils/context-generators.ts`)
```typescript
// Clean database state between tests
export async function cleanDatabase() {
  await clearTables(['orders', 'positions', 'strategies']);
}

// Seed test data
export async function seedTestData() {
  await createTestUsers();
  await createTestStrategies();
  await createTestMarketData();
}
```

### **API Test Helpers** (`packages/shared/src/test-utils/context-generators.ts`)
```typescript
// Authenticated API requests
export function createAuthenticatedRequest(app: Express) {
  return request(app)
    .set('Authorization', `Bearer ${TEST_AUTH_TOKEN}`);
}

// Wait for async operations
export function waitForCondition(
  condition: () => Promise<boolean>,
  timeout = 5000
): Promise<void> {
  // Implementation
}
```

## 📋 Testing Guidelines

### **Test Structure Standards**
```typescript
describe('Feature/Component Name', () => {
  // Setup and teardown
  beforeEach(() => {
    // Test setup
  });
  
  afterEach(() => {
    // Test cleanup
  });
  
  describe('when condition X', () => {
    it('should do Y', async () => {
      // Arrange
      const input = createTestInput();
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

### **Naming Conventions**
- **Test files**: `*.test.ts` or `*.spec.ts`
- **Describe blocks**: Feature or component name
- **Test cases**: "should [expected behavior] when [condition]"
- **Variables**: Descriptive names (avoid `data`, use `userProfile`)

### **Best Practices**
- **Isolation** - Tests should not depend on each other
- **Determinism** - Tests should produce consistent results
- **Performance** - Keep tests fast and focused
- **Readability** - Tests should be self-documenting
- **Coverage** - Aim for 80%+ code coverage

## 🎯 Test Coverage Targets

| Package | Unit Tests | Integration | E2E | Overall Target |
|---------|------------|-------------|-----|----------------|
| Backend | 85%+ | 70%+ | 50%+ | 80%+ |
| Frontend | 80%+ | 60%+ | 40%+ | 75%+ |
| Shared | 90%+ | N/A | N/A | 90%+ |
| Overall | 85%+ | 65%+ | 45%+ | 80%+ |

## 🔄 Continuous Integration

### **CI/CD Pipeline Testing**
```yaml
# GitHub Actions workflow
test-suite:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:latest
      env:
        POSTGRES_PASSWORD: test
        
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm run test:coverage
    - run: npm run test:e2e
```

### **Pre-commit Testing**
```bash
# Husky pre-commit hook
#!/bin/sh
npm run test:unit:changed
npm run lint
npm run type-check
```

## 🐛 Debugging Tests

### **Debug Configuration**
```json
// VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--testPathPattern=${fileBasenameNoExtension}"],
  "console": "integratedTerminal"
}
```

### **Common Debugging Commands**
```bash
# Run single test with debugging
npm test -- --testPathPattern=strategy --verbose

# Run tests with specific timeout
npm test -- --testTimeout=10000

# Run tests with detailed output
npm test -- --verbose --no-coverage
```

## 📊 Test Metrics & Reporting

### **Coverage Reports**
- **HTML Report** - `coverage/lcov-report/index.html`
- **JSON Report** - `coverage/coverage-final.json`
- **Text Summary** - Console output during test runs

### **Performance Metrics**
- **Test Execution Time** - Individual and total test duration
- **Database Query Count** - Database interaction metrics
- **API Response Times** - Integration test performance

### **Quality Metrics**
- **Test-to-Code Ratio** - Number of tests per line of code
- **Assertion Density** - Assertions per test
- **Mock Usage** - Mocking patterns and coverage

## 🔮 Future Testing Enhancements

### **Planned Additions**
- **Visual Regression Testing** - Screenshot comparison for UI
- **Performance Testing** - Load testing with k6 or Artillery
- **Contract Testing** - API contract validation with Pact
- **Mutation Testing** - Code quality assessment with Stryker

### **Tool Upgrades**
- **Playwright Migration** - Enhanced E2E testing capabilities
- **Test Data Management** - Advanced fixture management
- **Parallel Testing** - Improved test execution speed
- **Cloud Testing** - Cross-browser and device testing

---

**Testing Framework Version**: Jest 29.x
**Node.js Requirement**: >=18.0.0
**Database**: PostgreSQL 14+ (test containers)
**Documentation Status**: ✅ Complete and stable
**Last Updated**: July 2025
