# JabbrLabs Trading Backend Tests

## Quick Start

```bash
# Run all tests
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

## Test Structure

- **`unit/`** - Unit tests for individual components
- **`integration/`** - Integration tests between components  
- **`e2e/`** - End-to-end workflow tests
- **`fixtures/`** - Test data and mock fixtures
- **`setup.js`** - Global test configuration

## Current Status

✅ **100% Test Success Rate** (77/77 tests passing)  
✅ **Organized Structure** - Clear separation by test type  
✅ **TypeScript Support** - Full type checking in tests  
✅ **Modern Jest** - Version 29.7.0 with latest features  

## Key Features

- **Comprehensive Coverage**: Unit, integration, and E2E tests
- **Real Market Data**: Tests include realistic trading scenarios
- **Proper Mocking**: External APIs and services are properly mocked
- **Error Handling**: Extensive testing of edge cases and error conditions
- **Performance**: Fast test execution with parallel support

## Testing Categories

### Technical Indicators
- RSI (Relative Strength Index)
- SMA (Simple Moving Average) 
- EMA (Exponential Moving Average)
- ATR (Average True Range)

### Signal Processing
- SMA Signal Processor
- Improved SMA Signal Processor
- Signal crossover detection
- Confidence scoring

### Trading Strategies
- SMA Crossover Strategy
- Strategy factory patterns
- Strategy validation

### Trading Engine
- Market data processing
- Order execution simulation
- Risk management
- Position tracking

## Guidelines

For detailed testing guidelines and best practices, see [`TESTING_GUIDELINES.md`](./TESTING_GUIDELINES.md).

## Contributing

When adding new tests:

1. Follow the established directory structure
2. Use descriptive test names
3. Include edge cases and error scenarios
4. Add realistic test data
5. Update documentation as needed

## Troubleshooting

### Common Issues

**Tests failing after changes?**
- Check mock configurations
- Verify test data format
- Ensure async operations are properly awaited

**Coverage issues?**
- Add tests for untested code paths
- Check for skipped or disabled tests
- Verify test file naming conventions

**Performance issues?**
- Review test data size
- Check for memory leaks
- Optimize heavy computations in tests

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
```

---

**Last Updated**: July 3, 2025  
**Maintained by**: JabbrLabs Development Team
