# 🧪 Jabbr Trading Bot Platform - Test Organization Guide

## 📋 Introduction

This guide provides the official standard for organizing and structuring test files within the Jabbr Trading Bot Platform. Adherence to these standards is mandatory for all contributors to ensure consistency, maintainability, and proper integration with CI/CD pipelines.

## 🚨 Important Rules

1. **ALL TEST FILES MUST BE INSIDE DESIGNATED `tests/` DIRECTORIES, NOT AT ROOT LEVEL**
2. **Test file names must follow naming conventions (.test.ts, .spec.ts)**
3. **Test results must be stored in designated directories**
4. **Tests must be properly categorized (unit, integration, e2e)**

## 📁 Test Directory Structure

```
packages/
├── backend/
│   ├── tests/                     # Main backend test directory
│   │   ├── unit/                  # Unit tests for individual components
│   │   │   ├── services/          # Tests for service modules
│   │   │   ├── controllers/       # Tests for controllers
│   │   │   └── strategies/        # Tests for trading strategies
│   │   │
│   │   ├── integration/           # Integration tests between components
│   │   │   ├── api/               # API endpoint integration tests
│   │   │   ├── database/          # Database integration tests
│   │   │   └── websocket/         # WebSocket integration tests
│   │   │
│   │   ├── e2e/                   # End-to-end tests for full workflows
│   │   │   ├── trading/           # E2E trading workflow tests
│   │   │   ├── auth/              # E2E authentication workflow tests
│   │   │   └── bot-management/    # E2E bot management workflow tests
│   │   │
│   │   ├── fixtures/              # Test data and mock objects
│   │   │   ├── market-data/       # Mock market data for testing
│   │   │   ├── users/             # Mock user data
│   │   │   └── strategies/        # Mock strategy configurations
│   │   │
│   │   ├── results/               # Test results and reports (gitignored)
│   │   │   ├── coverage/          # Code coverage reports
│   │   │   ├── junit/             # JUnit XML test reports
│   │   │   └── snapshots/         # Snapshot test results
│   │   │
│   │   └── helpers/               # Test helper utilities
│   │       ├── setup.ts           # Test setup code
│   │       └── mocks.ts           # Common mock functions
│   │
├── frontend/
│   ├── tests/                     # Main frontend test directory
│   │   ├── unit/                  # Component tests
│   │   │   ├── components/        # UI component tests
│   │   │   ├── hooks/             # Custom hook tests
│   │   │   └── contexts/          # Context provider tests
│   │   │
│   │   ├── e2e/                   # End-to-end frontend tests
│   │   │   ├── pages/             # Page-level e2e tests
│   │   │   ├── workflows/         # User workflow tests
│   │   │   └── accessibility/     # Accessibility tests
│   │   │
│   │   ├── fixtures/              # Test data and mock API responses
│   │   ├── results/               # Test results (gitignored)
│   │   └── helpers/               # Test helper utilities
│   │
└── shared/
    └── tests/                     # Shared package tests
        ├── unit/                  # Unit tests for shared code
        ├── fixtures/              # Test data
        └── results/               # Test results (gitignored)
```

## 📝 Naming Conventions

### File Naming

- **Unit Tests**: `[filename].test.ts`
- **Integration Tests**: `[feature].integration.test.ts`
- **E2E Tests**: `[workflow].e2e.test.ts`
- **Test Helpers**: `[helper-name].helper.ts`
- **Test Fixtures**: `[fixture-name].fixture.ts`

### Test Suite Naming

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something specific when condition', () => {
      // Test code
    });
  });
});
```

## ⚙️ Test Configuration

### Jest Configuration (packages/backend/jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/tests/**/*.test.+(ts|tsx|js)',
    '**/tests/**/*.spec.+(ts|tsx|js)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  coverageDirectory: './tests/results/coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './tests/results/junit',
      outputName: 'junit.xml'
    }]
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts']
};
```

### React Testing Library (packages/frontend/jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
  testMatch: [
    '**/tests/**/*.test.+(ts|tsx|js)',
    '**/tests/**/*.spec.+(ts|tsx|js)'
  ],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/helpers/fileMock.ts',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx'
  ],
  coverageDirectory: './tests/results/coverage'
};
```

## 🚀 Running Tests

### Command Line Scripts

```bash
# Run all tests
npm test

# Run specific test category
npm run test:unit
npm run test:integration
npm run test:e2e

# Run package-specific tests
npm run test:backend
npm run test:frontend
npm run test:shared

# Run with coverage
npm run test:coverage
```

### CI/CD Integration

The CI/CD pipeline will automatically run tests using the standardized structure. Tests are configured to run on:
- Pull requests
- Merge to main branch
- Nightly builds

Test results are published as artifacts and used for code quality metrics.

## ⚠️ Common Issues and Solutions

### Test File Not Discovered

**Problem**: Test file not being discovered by the test runner.
**Solution**: Verify that the test file:
1. Is located in the `tests` directory or subdirectory
2. Has the correct file extension (.test.ts or .spec.ts)
3. Follows the proper import format for the test framework

### Mock Data Issues

**Problem**: Tests failing due to mock data issues.
**Solution**:
1. Store all mock data in `tests/fixtures` directory
2. Use typed interfaces for mock data to catch schema changes
3. Consider using snapshot testing for complex data structures

### CI/CD Pipeline Failures

**Problem**: Tests pass locally but fail in CI/CD.
**Solution**:
1. Ensure tests are not dependent on local environment variables
2. Use the same Node.js version locally as in CI/CD
3. Check for race conditions and timeout issues in asynchronous tests

## 📚 Best Practices

1. **Test One Thing Per Test**: Each test should focus on a single functionality
2. **Use Descriptive Names**: Test names should describe what's being tested
3. **Isolate Tests**: Tests should not depend on each other
4. **Clean Up After Tests**: Ensure tests clean up any resources they create
5. **Use Setup and Teardown**: Leverage before/after hooks for common setup
6. **Avoid Test Duplication**: Use helpers and fixtures for common test scenarios
7. **Keep Tests Fast**: Tests should execute quickly to encourage frequent running
8. **Test Edge Cases**: Include tests for boundary conditions and error scenarios

## 📝 Documentation

Each test directory should include a README.md file explaining:
1. What is being tested in that directory
2. Any special setup required
3. Common test patterns
4. How to run the specific test category

## 📅 Test Results Organization

Test results should be stored in the `tests/results` directory, which is gitignored.

```
tests/results/
├── coverage/           # Code coverage reports
│   ├── lcov-report/    # HTML coverage report
│   └── lcov.info       # LCOV format for tooling
├── junit/              # JUnit XML reports
│   └── junit.xml       # JUnit test results
└── snapshots/          # Jest snapshot test results
```

---

*This document serves as the official standard for test organization in the Jabbr Trading Bot Platform. All contributors must adhere to these standards to ensure consistent testing practices across the project.*
