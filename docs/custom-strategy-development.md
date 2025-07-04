# Creating Custom Strategy Plugins

This guide walks through the process of developing and deploying custom trading strategy plugins for the Jabbr platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Strategy Plugin Structure](#strategy-plugin-structure)
3. [Implementing the IStrategy Interface](#implementing-the-istrategy-interface)
4. [Strategy Metadata](#strategy-metadata)
5. [Configuration Management](#configuration-management)
6. [Signal Generation](#signal-generation)
7. [Risk Management Integration](#risk-management-integration)
8. [Testing Your Plugin](#testing-your-plugin)
9. [Deploying Your Plugin](#deploying-your-plugin)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

## Getting Started

To create a custom strategy plugin, you'll need:

- TypeScript or JavaScript knowledge
- Understanding of the Jabbr Strategy Framework
- Development environment with Node.js

## Strategy Plugin Structure

A basic strategy plugin consists of a single TypeScript file that exports a class implementing the `IStrategy` interface. The file should be placed in the `plugins` directory.

```typescript
// plugins/my-custom-strategy.ts
import { 
  IStrategy, 
  StrategyContext, 
  StrategyConfig, 
  StrategyResult, 
  ConfigValidationResult,
  StrategyState
} from '../packages/backend/src/JabbrLabs/target-reacher/interfaces';
import { z } from 'zod';

class MyCustomStrategy implements IStrategy {
  // Implementation goes here
}

export default MyCustomStrategy;
```

## Implementing the IStrategy Interface

Your strategy must implement these methods:

1. **initialize**: Set up the strategy (load state, connect to services)
2. **execute**: Run the strategy logic and generate signals
3. **cleanup**: Clean up resources when strategy is stopped
4. **validateConfig**: Validate strategy configuration
5. **getDefaultConfig**: Provide default configuration values
6. **getState**: Get current strategy state
7. **setState**: Update strategy state

Example:

```typescript
class MyCustomStrategy implements IStrategy {
  // Required properties
  readonly name = 'My Custom Strategy';
  readonly version = '1.0.0';
  readonly description = 'Description of my strategy';
  readonly supportedMarkets = ['spot', 'futures'];

  // Strategy state
  private state: StrategyState = {
    isRunning: false,
    totalProfit: 0,
    tradesExecuted: 0,
    lastUpdate: new Date(),
    customState: {}
  };

  async initialize(context: StrategyContext): Promise<void> {
    // Setup code
    this.state.isRunning = true;
    context.logger.info('Strategy initialized');
  }

  async execute(context: StrategyContext): Promise<StrategyResult> {
    // Strategy logic
    return {
      success: true,
      action: 'hold',
      reason: 'No signal detected'
    };
  }

  async cleanup(context: StrategyContext): Promise<void> {
    // Cleanup code
    this.state.isRunning = false;
    context.logger.info('Strategy cleaned up');
  }

  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    // Configuration validation
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  getDefaultConfig(): StrategyConfig {
    // Default configuration
    return {
      type: 'custom',
      parameters: {
        // Custom parameters
      }
    };
  }

  getState(): StrategyState {
    return { ...this.state };
  }

  setState(state: Partial<StrategyState>): void {
    this.state = { ...this.state, ...state };
  }
}
```

## Strategy Metadata

Each plugin should include metadata to help with plugin management and user interface integration:

```typescript
static metadata = {
  name: 'My Custom Strategy',
  version: '1.0.0',
  description: 'A detailed description of my strategy',
  author: 'Your Name',
  supportedMarkets: ['spot', 'futures'],
  riskLevel: 'medium',
  category: 'technical',
  tags: ['indicator', 'momentum'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
```

## Configuration Management

Use [Zod](https://github.com/colinhacks/zod) for type-safe configuration validation:

```typescript
// Configuration schema
const MyStrategyConfigSchema = z.object({
  period: z.number().int().min(5).max(200).default(14),
  threshold: z.number().min(0).max(100).default(25),
  useFilter: z.boolean().default(true)
});

// In validateConfig method
validateConfig(config: Record<string, unknown>): ConfigValidationResult {
  const validation = MyStrategyConfigSchema.safeParse(config);
  
  if (validation.success) {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
  
  return {
    valid: false,
    errors: validation.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: 'VALIDATION_ERROR'
    })),
    warnings: []
  };
}
```

## Signal Generation

In the `execute` method, process market data and generate trading signals:

```typescript
async execute(context: StrategyContext): Promise<StrategyResult> {
  try {
    // Get market data
    const candles = await context.marketData.getCandles(
      context.symbol,
      '15m',
      50
    );
    
    // Process data and generate signal
    const signal = this.analyzeMarket(candles);
    
    if (signal > 0) {
      return {
        success: true,
        action: 'buy',
        confidence: 0.75,
        reason: 'Bullish signal detected'
      };
    } else if (signal < 0) {
      return {
        success: true,
        action: 'sell',
        confidence: 0.75,
        reason: 'Bearish signal detected'
      };
    }
    
    return {
      success: true,
      action: 'hold',
      reason: 'No signal detected'
    };
  } catch (error) {
    return {
      success: false,
      action: 'hold',
      error: error instanceof Error ? error.message : String(error),
      reason: 'Strategy execution error'
    };
  }
}

// Custom market analysis method
private analyzeMarket(candles: Candle[]): number {
  // Your analysis logic here
  return 0; // 1 for buy, -1 for sell, 0 for hold
}
```

## Risk Management Integration

Integrate with the platform's risk management system:

```typescript
async execute(context: StrategyContext): Promise<StrategyResult> {
  // Get risk parameters from config
  const maxPositionSize = context.config.riskManagement?.maxPositionSize || 100;
  const stopLossPercentage = context.config.riskManagement?.stopLossPercentage || 1.5;
  
  // Generate trading signal with risk parameters
  return {
    success: true,
    action: 'buy',
    confidence: 0.8,
    reason: 'Bullish signal confirmed',
    metadata: {
      positionSize: maxPositionSize,
      stopLoss: stopLossPercentage
    }
  };
}
```

## Testing Your Plugin

Test your strategy with the backtesting system:

```typescript
// backtesting-script.ts
import { Candle } from '../packages/backend/src/JabbrLabs/target-reacher/interfaces';
import MyCustomStrategy from './my-custom-strategy';

async function backtest() {
  const strategy = new MyCustomStrategy();
  const candles: Candle[] = loadTestData(); // Load test data
  
  // Create mock context
  const context = createMockContext(candles);
  
  // Initialize strategy
  await strategy.initialize(context);
  
  // Run strategy
  const result = await strategy.execute(context);
  console.log('Strategy result:', result);
  
  // Cleanup
  await strategy.cleanup(context);
}

backtest().catch(console.error);
```

## Deploying Your Plugin

To deploy your plugin:

1. Place your plugin file in the `plugins` directory
2. Register the plugin with the strategy factory:

```typescript
// Register plugin in system
import { strategyFactory } from '../packages/backend/src/strategies/strategy-factory';

async function registerPlugin() {
  const pluginId = await strategyFactory.registerPlugin('./plugins/my-custom-strategy.ts');
  console.log('Plugin registered with ID:', pluginId);
}
```

## Best Practices

1. **Error handling**: Use try/catch blocks and report errors properly
2. **Resource management**: Clean up resources in the `cleanup` method
3. **Performance**: Optimize calculations for real-time performance
4. **Validation**: Thoroughly validate configuration parameters
5. **Documentation**: Include clear documentation in your code
6. **Testing**: Test your strategy with different market conditions
7. **State management**: Properly track and persist strategy state

## Troubleshooting

Common issues and solutions:

1. **Plugin not loading**: Ensure your plugin implements all required methods
2. **Configuration validation errors**: Check Zod schema and validation logic
3. **Runtime errors**: Use proper error handling and logging
4. **Performance issues**: Optimize calculations and reduce API calls

For more help, see the complete [Strategy Framework Documentation](./strategy-framework.md).
