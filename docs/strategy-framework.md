# Strategy Framework Documentation

## Overview

The Jabbr Strategy Framework is a comprehensive, modular system for developing and deploying trading strategies. It provides a pluggable architecture that allows developers to create custom trading strategies while leveraging the platform's core infrastructure for market data, order execution, risk management, and more.

## Architecture

The strategy framework consists of several key components:

### Core Components

1. **Strategy Interface**: Defines the contract that all trading strategies must implement.
2. **Strategy Factory**: Central factory for creating strategy instances, supporting both built-in and custom strategies.
3. **Plugin Manager**: Manages custom strategy plugins with security, validation, and hot-reloading capabilities.
4. **Signal Processors**: Specialized components for generating trading signals based on specific indicators or techniques.

### Key Classes

- `StrategyFactory`: Entry point for strategy creation and management
- `StrategyPluginManager`: Handles plugin lifecycle management, security, and loading
- `SMASignalProcessor`: Implementation of SMA-based signal generation
- `SMACrossoverStrategy`: Built-in strategy for SMA crossover trading

## Strategy Interface

All strategies (built-in or custom) must implement the `IStrategy` interface:

```typescript
interface IStrategy {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly supportedMarkets: readonly string[];
  
  initialize(context: StrategyContext): Promise<void>;
  execute(context: StrategyContext): Promise<StrategyResult>;
  cleanup(context: StrategyContext): Promise<void>;
  
  validateConfig(config: Record<string, unknown>): ConfigValidationResult;
  getDefaultConfig(): StrategyConfig;
  getState(): StrategyState;
  setState(state: Partial<StrategyState>): void;
}
```

## Built-in Strategies

The framework includes several built-in strategies:

1. **SMA Crossover Strategy**: Generates signals based on SMA crossovers (see [SMA Strategy Documentation](./sma-strategy.md))
2. **Target Reacher Strategy**: Generates signals based on price targets

## Creating Custom Strategies

### Plugin System

Custom strategies are implemented as plugins, which are TypeScript/JavaScript modules that export a class implementing the `IStrategy` interface. The plugin system provides:

1. **Security**: Plugins are validated and run in a secure environment
2. **Hot-reloading**: Plugins can be updated without restarting the application
3. **Metadata**: Plugins can include metadata like author, version, risk level, etc.

### Plugin Development

To create a custom strategy plugin:

1. Create a new TypeScript file in the `plugins` directory
2. Implement the `IStrategy` interface
3. Add required metadata using `static metadata` property
4. Implement the strategy logic in the `execute` method

See the [Example SMA Strategy Plugin](../../plugins/example-sma-strategy.ts) for a complete example.

## Strategy Context

Strategies receive a `StrategyContext` object that provides access to various platform services:

```typescript
interface StrategyContext {
  readonly config: StrategyConfig;
  readonly botConfig: BotConfig;
  readonly symbol: string;
  readonly marketData: MarketDataProvider;
  readonly tradeExecutor: TradeExecutorProvider;
  readonly logger: LoggerProvider;
  readonly storage: StorageProvider;
  readonly eventEmitter: EventEmitterProvider;
}
```

## Plugin Management

Plugins are managed through the `StrategyPluginManager`, which provides methods for:

- Registering new plugins
- Loading and unloading plugins
- Validating plugin configuration
- Searching for plugins by criteria

## Integration with Bot System

The strategy framework integrates with the bot management system, allowing users to:

1. Select a strategy type (built-in or custom)
2. Configure strategy parameters
3. View strategy state and performance

## Testing Strategies

Strategies can be tested using:

1. **Backtesting**: Running the strategy against historical data
2. **Paper trading**: Running the strategy in a simulated environment
3. **Unit testing**: Testing individual strategy components

## Error Handling

The framework includes robust error handling to prevent failed strategies from affecting the overall system:

- Strategy exceptions are caught and logged
- Strategies are automatically recovered when possible
- Configuration validation prevents invalid strategies from running

## Performance Considerations

- Strategies should minimize unnecessary calculations
- Consider caching frequently used values
- Use efficient data structures for better performance
- Limit the number of API calls by batching requests when possible

## Security Considerations

- Plugins are validated before execution
- Plugin dependencies are restricted to a whitelist
- Plugin execution is isolated from core system functionality

## Best Practices

1. Implement thorough validation for all configuration parameters
2. Use appropriate error handling within strategy code
3. Document strategy behavior and configuration options
4. Include unit tests for the strategy
5. Optimize resource usage for real-time performance
