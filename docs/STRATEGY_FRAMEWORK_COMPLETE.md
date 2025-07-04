# Strategy Framework Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Components](#components)
   - [Strategy Interface](#strategy-interface)
   - [Plugin System](#plugin-system)
   - [Signal Processing](#signal-processing)
   - [Backtesting Framework](#backtesting-framework)
   - [Indicators](#indicators)
4. [Developing Custom Strategies](#developing-custom-strategies)
5. [Backtesting Strategies](#backtesting-strategies)
6. [Integration with Trading Engine](#integration-with-trading-engine)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

## Introduction

The Jabbr Strategy Framework provides a flexible, modular system for creating and executing trading strategies. It supports both built-in strategies and custom user-developed plugins, allowing traders to implement their own algorithmic trading ideas while leveraging the platform's infrastructure for execution, risk management, and performance tracking.

Key features:

- Pluggable architecture for easy extension
- Standardized interface for all strategies
- Comprehensive backtesting capabilities
- Secure plugin loading mechanism
- Integration with trading engine and bot management

## Architecture Overview

The Strategy Framework consists of several interconnected components:

```
┌──────────────────────┐     ┌───────────────────────┐
│   Strategy Factory   │────>│   Strategy Interface  │
└──────────────────────┘     └───────────────────────┘
           │                           ▲
           │                           │
           ▼                           │
┌──────────────────────┐     ┌───────────────────────┐
│    Plugin Manager    │────>│   Custom Strategies   │
└──────────────────────┘     └───────────────────────┘
           │                           │
           │                           │
           ▼                           ▼
┌──────────────────────┐     ┌───────────────────────┐
│   Market Data API    │<────│    Signal Processor   │
└──────────────────────┘     └───────────────────────┘
           ▲                           │
           │                           │
           │                           ▼
┌──────────────────────┐     ┌───────────────────────┐
│  Backtesting Engine  │<────│   Trade Executor API  │
└──────────────────────┘     └───────────────────────┘
```

- **Strategy Factory**: Central registry for creating strategy instances
- **Plugin Manager**: Handles loading and validation of custom strategy plugins
- **Strategy Interface**: Standardized contract that all strategies implement
- **Market Data API**: Provides access to price data and market information
- **Signal Processor**: Processes market data to generate trading signals
- **Trade Executor API**: Executes trades based on strategy signals
- **Backtesting Engine**: Simulates strategy execution against historical data

## Components

### Strategy Interface

The core of the framework is the `IStrategy` interface, which all strategies must implement:

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

Key methods:

- **initialize**: Called when the strategy is first loaded
- **execute**: Main entry point, called on each execution cycle
- **cleanup**: Called when the strategy is being unloaded
- **validateConfig**: Validates user-provided configuration
- **getDefaultConfig**: Returns default strategy configuration
- **getState**: Returns current strategy state (for persistence)
- **setState**: Restores strategy state (after reload)

The `StrategyContext` provides access to all required dependencies:

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

### Plugin System

The plugin system allows users to create and load custom strategies:

```typescript
// Example plugin registration
pluginManager.registerPlugin('path/to/plugin.js', {
  id: 'my-custom-strategy',
  name: 'My Custom Strategy',
  version: '1.0.0',
  author: 'Trader Name',
  description: 'My custom trading strategy',
  supportedMarkets: ['spot', 'futures'],
  riskLevel: 'medium',
  category: 'trend-following',
  tags: ['SMA', 'momentum']
});
```

Plugin security features:

- File extension validation (.ts/.js only)
- Metadata validation
- Configuration validation
- Dependency whitelisting
- Sandbox execution environment

### Signal Processing

The Signal Processing module provides tools for generating trading signals:

- **SMA Signal Processor**: Generates signals based on Simple Moving Average crossovers
- **Unified Signals**: Standardized signal format for strategy outputs
- **Signal Strength**: Signal confidence scoring (0.0-1.0)

```typescript
interface TradeSignal {
  id: string;
  botId: string;
  symbol: string;
  side: 'buy' | 'sell';
  confidence: number;
  price: number;
  timestamp: number;
  reason: string;
}
```

### Backtesting Framework

The Backtesting Framework allows testing strategies against historical data:

```typescript
const backtester = new StrategyBacktester(historicalCandles, {
  initialCapital: 10000,
  fees: 0.001,
  slippage: 0.001
});

await backtester.loadStrategy('sma-strategy', {
  type: 'sma-strategy',
  parameters: { fastPeriod: 20, slowPeriod: 50 }
});

const results = await backtester.runBacktest();
```

Performance metrics:

- Total P&L
- Win rate
- Profit factor
- Maximum drawdown
- Sharpe ratio
- Trade statistics
- Equity curve

### Indicators

The framework includes a library of technical indicators:

- **SMA (Simple Moving Average)**: Calculates arithmetic mean of prices
- **EMA (Exponential Moving Average)**: Weighted moving average with more weight to recent prices
- **MACD**: Moving Average Convergence Divergence
- **RSI**: Relative Strength Index
- **Bollinger Bands**: Price volatility bands

## Developing Custom Strategies

Creating a custom strategy involves implementing the `IStrategy` interface:

1. Create a new TypeScript file in the `plugins` directory
2. Implement the required interface methods
3. Export your strategy class
4. Register the plugin with the Plugin Manager

Example:

```typescript
import { IStrategy, StrategyContext, StrategyResult } from '../interfaces';

export default class MyCustomStrategy implements IStrategy {
  name = 'My Custom Strategy';
  version = '1.0.0';
  description = 'A simple custom strategy';
  supportedMarkets = ['spot', 'futures'];
  
  private state = {
    isRunning: false,
    totalProfit: 0,
    tradesExecuted: 0,
    lastUpdate: new Date()
  };
  
  async initialize(context: StrategyContext): Promise<void> {
    context.logger.info(`Initializing ${this.name} v${this.version}`);
    this.state.isRunning = true;
  }
  
  async execute(context: StrategyContext): Promise<StrategyResult> {
    const { symbol, marketData } = context;
    
    // Get recent candles
    const candles = await marketData.getCandles(symbol, '1h', 100);
    
    // Implement your strategy logic here
    // ...
    
    return {
      success: true,
      action: 'hold', // or 'buy', 'sell'
      confidence: 0.7,
      reason: 'No signal detected'
    };
  }
  
  async cleanup(context: StrategyContext): Promise<void> {
    context.logger.info(`Cleaning up ${this.name}`);
    this.state.isRunning = false;
  }
  
  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    // Validate config parameters
    return { valid: true, errors: [], warnings: [] };
  }
  
  getDefaultConfig(): StrategyConfig {
    return {
      type: 'my-custom-strategy',
      parameters: {
        // Default parameters
      }
    };
  }
  
  getState(): StrategyState {
    return {
      isRunning: this.state.isRunning,
      totalProfit: this.state.totalProfit,
      tradesExecuted: this.state.tradesExecuted,
      lastUpdate: this.state.lastUpdate
    };
  }
  
  setState(state: Partial<StrategyState>): void {
    this.state = { ...this.state, ...state };
  }
}
```

## Backtesting Strategies

The Backtesting Framework provides tools for testing strategies against historical data:

```typescript
// Option 1: Quick backtest
const results = await quickBacktest(
  'sma-strategy', 
  {
    type: 'sma-strategy',
    parameters: {
      fastPeriod: 20,
      slowPeriod: 50
    }
  }, 
  historicalCandles,
  { initialCapital: 10000 }
);

// Option 2: Full control
const backtester = new StrategyBacktester(historicalCandles, {
  initialCapital: 10000,
  fees: 0.001,
  slippage: 0.001
});

await backtester.loadStrategy('sma-strategy', {
  type: 'sma-strategy',
  parameters: {
    fastPeriod: 20,
    slowPeriod: 50
  }
});

const results = await backtester.runBacktest();
```

## Integration with Trading Engine

The Strategy Framework integrates with the Trading Engine:

```typescript
// Load strategy for a bot
const botStrategy = await strategyFactory.createStrategy(
  bot.strategyType, 
  bot.strategyConfig,
  createContext(bot)
);

// Execute strategy on schedule
setInterval(async () => {
  const result = await botStrategy.execute(context);
  
  if (result.action !== 'hold') {
    const signal = createSignalFromResult(result);
    await tradeExecutor.executeSignal(signal, bot.config);
  }
}, bot.executionInterval);
```

## Best Practices

1. **Separation of Concerns**
   - Keep signal generation separate from trade execution
   - Use dependency injection for testability

2. **Error Handling**
   - Implement comprehensive error handling
   - Use try/catch blocks for async operations

3. **Configuration Validation**
   - Validate all user inputs
   - Provide clear error messages

4. **Backtesting**
   - Test strategies with different market conditions
   - Consider transaction costs and slippage

5. **State Management**
   - Properly manage strategy state for persistence
   - Handle recovery from interruptions

## FAQ

**Q: How do I install a custom strategy plugin?**
A: Place your strategy file in the `plugins` directory and register it using the Plugin Manager API.

**Q: Can I use third-party libraries in my strategy?**
A: Yes, but they must be added to the dependency whitelist for security reasons.

**Q: How do I debug my strategy?**
A: Use the `context.logger` methods to log debug information, and run your strategy in the backtesting engine.

**Q: Are there performance limits for strategies?**
A: Strategies should complete execution within a reasonable time frame (< 5 seconds recommended).

**Q: Can I update a strategy while it's running?**
A: Yes, use hot-reloading by updating the plugin file and calling the reload method.
