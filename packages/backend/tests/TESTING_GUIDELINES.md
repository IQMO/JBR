# Testing Guidelines and Best Practices

## Overview

This document outlines the testing standards, conventions, and best practices for the JabbrLabs Trading Backend project. Following these guidelines ensures consistency, maintainability, and reliability across all test suites.

## Test Structure Organization

### Directory Structure

```
packages/backend/tests/
├── e2e/                    # End-to-end integration tests
│   └── trading/            # Trading system E2E tests
│       ├── engine/         # Trading engine specific tests
│       └── ...             # Other trading component tests
├── integration/            # Integration tests between components
│   └── strategies/         # Strategy integration tests
├── unit/                   # Unit tests for individual components
│   ├── indicators/         # Technical indicator tests
│   ├── signals/            # Signal processing tests
│   │   └── sma/           # SMA-specific signal tests
│   ├── strategies/         # Strategy component tests
│   ├── services/          # Service layer tests
│   ├── JabbrLabs/         # JabbrLabs specific tests
│   └── utils/             # Utility function tests
├── fixtures/              # Test data and mock fixtures
├── reports/               # Test execution reports
└── setup.js              # Global test setup configuration
```

### Test Type Guidelines

#### Unit Tests (`unit/`)
- **Purpose**: Test individual functions, classes, and methods in isolation
- **Scope**: Single component or function
- **Dependencies**: Should be mocked or stubbed
- **Naming**: `*.test.ts` files matching the source file structure
- **Location**: Mirror the `src/` directory structure

#### Integration Tests (`integration/`)
- **Purpose**: Test interactions between multiple components
- **Scope**: Multiple related components working together
- **Dependencies**: Real implementations with controlled environments
- **Examples**: Strategy factory with real strategies, signal processors with indicators

#### End-to-End Tests (`e2e/`)
- **Purpose**: Test complete workflows and user scenarios
- **Scope**: Full system behavior from input to output
- **Environment**: As close to production as possible (with appropriate mocking)
- **Examples**: Complete trading engine workflows, market data processing

## Testing Framework Configuration

### Jest Configuration

The project uses **Jest 29.7.0** with TypeScript support via `ts-jest`:

```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/tests", "<rootDir>/src"],
  "testMatch": ["**/*.test.ts"],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts"
  ]
}
```

### Key Configuration Features
- **TypeScript Support**: Full TypeScript compilation and type checking
- **Path Mapping**: Supports project path aliases and imports
- **Coverage Collection**: Automated code coverage reporting
- **Test Discovery**: Automatic detection of `*.test.ts` files

## Naming Conventions

### Test File Naming
- **Format**: `[component-name].test.ts`
- **Examples**: 
  - `rsi-indicator.test.ts`
  - `sma-signal-processor.test.ts`
  - `strategy-factory.test.ts`

### Test Suite Organization
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should behave correctly when condition', () => {
      // Test implementation
    });
  });
});
```

### Test Description Patterns
- **Unit Tests**: "should [expected behavior] when [condition]"
- **Integration Tests**: "should [workflow result] with [components involved]"
- **E2E Tests**: "Should [user scenario outcome]"

## Code Quality Standards

### Test Structure
```typescript
describe('RSIIndicator', () => {
  describe('constructor', () => {
    it('should create with default period', () => {
      const rsi = new RSIIndicator();
      expect(rsi.period).toBe(14);
    });

    it('should create with custom period', () => {
      const rsi = new RSIIndicator(21);
      expect(rsi.period).toBe(21);
    });

    it('should throw for invalid period', () => {
      expect(() => new RSIIndicator(-1)).toThrow('Period must be positive');
    });
  });

  describe('calculate', () => {
    it('should calculate RSI correctly for basic uptrend', () => {
      const rsi = new RSIIndicator(14);
      const result = rsi.calculate(bullishPrices);
      expect(result).toBeCloseTo(70.5, 1);
    });
  });
});
```

### Best Practices

#### 1. Test Isolation
- Each test should be independent and not rely on other tests
- Use `beforeEach`/`afterEach` for setup and cleanup
- Avoid shared mutable state between tests

#### 2. Descriptive Test Names
```typescript
// ✅ Good
it('should generate buy signal when fast SMA crosses above slow SMA', () => {});

// ❌ Bad
it('should work', () => {});
```

#### 3. Comprehensive Coverage
- **Happy Path**: Test expected behavior with valid inputs
- **Edge Cases**: Test boundary conditions and unusual inputs
- **Error Cases**: Test error handling and validation
- **Real Data**: Include tests with realistic market data

#### 4. Assertions
```typescript
// ✅ Specific assertions
expect(result.signal).toBe('BUY');
expect(result.confidence).toBeCloseTo(0.75, 2);
expect(result.timestamp).toBeInstanceOf(Date);

// ❌ Vague assertions
expect(result).toBeTruthy();
```

## Mocking and Test Data

### Mock Strategy
- **External APIs**: Always mock external service calls (exchanges, databases)
- **File System**: Mock file operations for consistent test environments
- **Time-dependent**: Mock Date/time for predictable test results
- **Random Values**: Mock random number generation for deterministic tests

### Test Data Organization
```typescript
// fixtures/candles.ts
export const bullishCandles = [
  { open: 100, high: 105, low: 98, close: 104, volume: 1000 },
  { open: 104, high: 108, low: 102, close: 107, volume: 1200 },
  // ... more data
];

export const bearishCandles = [
  { open: 100, high: 102, low: 95, close: 96, volume: 800 },
  // ... more data
];
```

### Mock Examples
```typescript
// Mocking external dependencies
jest.mock('ccxt', () => ({
  bybit: jest.fn().mockImplementation(() => ({
    fetchOHLCV: jest.fn().mockResolvedValue(mockCandles),
    fetchTicker: jest.fn().mockResolvedValue(mockTicker)
  }))
}));

// Mocking internal services
const mockExchange = {
  connect: jest.fn().mockResolvedValue(true),
  getMarketData: jest.fn().mockResolvedValue(mockMarketData)
};
```

## Performance Considerations

### Test Execution Speed
- **Unit Tests**: Should complete in milliseconds
- **Integration Tests**: Should complete within seconds
- **E2E Tests**: May take longer but should be optimized

### Memory Management
- Clean up resources in `afterEach` hooks
- Avoid memory leaks from unclosed connections or listeners
- Use `jest.clearAllMocks()` to reset mock state

### Parallel Execution
- Tests should be safe to run in parallel
- Avoid shared files or global state modifications
- Use unique identifiers for temporary resources

## Error Handling and Validation

### Testing Error Scenarios
```typescript
describe('error handling', () => {
  it('should throw for insufficient data', () => {
    const processor = new SMASignalProcessor();
    expect(() => processor.process([])).toThrow('Insufficient data');
  });

  it('should handle network errors gracefully', async () => {
    mockExchange.getMarketData.mockRejectedValue(new Error('Network error'));
    const result = await service.processMarketData();
    expect(result.error).toBe('Network error');
  });
});
```

### Input Validation Testing
- Test with null/undefined values
- Test with empty arrays/objects
- Test with invalid data types
- Test with boundary values (min/max)

## Continuous Integration

### Test Execution Pipeline
1. **Lint Check**: ESLint validation
2. **Type Check**: TypeScript compilation
3. **Unit Tests**: Fast feedback loop
4. **Integration Tests**: Component interaction validation
5. **E2E Tests**: Full workflow validation
6. **Coverage Report**: Code coverage analysis

### Success Criteria
- **Coverage**: Minimum 80% code coverage
- **All Tests Pass**: 100% test success rate
- **No Type Errors**: Clean TypeScript compilation
- **Performance**: Tests complete within reasonable time limits

## Test Maintenance

### Regular Maintenance Tasks
- Update test data with realistic market conditions
- Review and update mocks when dependencies change
- Refactor tests when source code structure changes
- Remove obsolete tests for deprecated features

### Code Review Guidelines
- Verify test coverage for new features
- Ensure test descriptions are clear and accurate
- Check for proper error handling test cases
- Validate mock configurations are appropriate

## Debugging Test Issues

### Common Issues and Solutions

#### 1. Mock Configuration Problems
```typescript
// ❌ Problem: Mock not properly configured
const mockFn = jest.fn();
expect(mockFn).toHaveBeenCalled(); // May fail

// ✅ Solution: Explicit mock setup
const mockFn = jest.fn().mockReturnValue('expected');
component.method(mockFn);
expect(mockFn).toHaveBeenCalledWith(expectedArgs);
```

#### 2. Async Test Issues
```typescript
// ❌ Problem: Not awaiting async operations
it('should process async data', () => {
  const result = service.processAsync(); // Missing await
  expect(result).toBeDefined(); // Will fail
});

// ✅ Solution: Proper async handling
it('should process async data', async () => {
  const result = await service.processAsync();
  expect(result).toBeDefined();
});
```

#### 3. Test Data Issues
- Ensure test data matches expected format
- Verify array lengths match algorithm requirements
- Check for proper data types and value ranges

### Debugging Tools
- **Jest Debug Mode**: Run with `--detectOpenHandles` to find resource leaks
- **Coverage Reports**: Identify untested code paths
- **Console Logging**: Strategic logging for complex test scenarios
- **Jest Watch Mode**: Continuous testing during development

## Migration and Upgrade Guidelines

### When Upgrading Dependencies
1. Update Jest and related packages together
2. Review breaking changes in release notes
3. Update mock configurations if needed
4. Run full test suite to identify issues
5. Update documentation for any new patterns

### Adding New Test Categories
1. Create appropriate directory structure
2. Update Jest configuration if needed
3. Document new testing patterns
4. Create example tests for reference
5. Update this documentation

## Examples and Templates

### Unit Test Template
```typescript
import { ComponentName } from '../src/path/to/component';

describe('ComponentName', () => {
  let component: ComponentName;

  beforeEach(() => {
    component = new ComponentName();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(component.property).toBe(expectedValue);
    });
  });

  describe('methodName', () => {
    it('should return expected result for valid input', () => {
      const result = component.methodName(validInput);
      expect(result).toEqual(expectedOutput);
    });

    it('should throw error for invalid input', () => {
      expect(() => component.methodName(invalidInput))
        .toThrow('Expected error message');
    });
  });
});
```

### Integration Test Template
```typescript
import { ServiceA } from '../src/services/serviceA';
import { ServiceB } from '../src/services/serviceB';

describe('ServiceA Integration with ServiceB', () => {
  let serviceA: ServiceA;
  let serviceB: ServiceB;

  beforeEach(() => {
    serviceB = new ServiceB();
    serviceA = new ServiceA(serviceB);
  });

  it('should process data through both services correctly', async () => {
    const input = createTestData();
    const result = await serviceA.processWithB(input);
    
    expect(result).toMatchObject({
      processed: true,
      data: expect.any(Object)
    });
  });
});
```

## Conclusion

Following these guidelines ensures that our test suite remains maintainable, reliable, and provides confidence in our trading system's functionality. Regular review and updates of these guidelines help maintain testing quality as the project evolves.

For questions or suggestions regarding these guidelines, please refer to the development team or create an issue in the project repository.

---

**Last Updated**: July 3, 2025  
**Version**: 1.0  
**Test Success Rate**: 100% (77/77 tests passing)
