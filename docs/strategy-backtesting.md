# Strategy Backtesting Framework

The Strategy Backtesting Framework provides tools for testing trading strategies
against historical price data, allowing you to evaluate performance metrics and
optimize strategy parameters without risking real capital.

## Table of Contents

1. [Introduction](#introduction)
2. [Backtesting Components](#backtesting-components)
3. [Using the Backtester](#using-the-backtester)
4. [Performance Metrics](#performance-metrics)
5. [Advanced Usage](#advanced-usage)

## Introduction

Backtesting is a critical part of strategy development that allows traders and
developers to simulate how a strategy would have performed on historical data.
The Jabbr backtesting framework provides realistic simulations including:

- Historical price and market data processing
- Trade execution with slippage and fees
- Position management
- Detailed performance metrics
- Equity curve generation

## Backtesting Components

### StrategyBacktester

The main class that orchestrates the backtesting process. It:

- Loads historical price data
- Initializes and runs strategies
- Manages market data simulation
- Collects performance data

### BacktestMarketDataProvider

A mock implementation of the MarketDataProvider interface that serves historical
market data to the strategy as if it were real-time data, including:

- Current price
- Historical candles
- Order book data
- Ticker information

### BacktestTradeExecutor

Simulates a trading environment by:

- Processing trade signals
- Managing positions
- Calculating profit/loss
- Tracking equity changes
- Applying fees and slippage

## Using the Backtester

### Basic Usage

```typescript
import {
  StrategyBacktester,
  quickBacktest,
} from '../strategies/strategy-backtest';
import { loadHistoricalData } from './data-loader';

// Load historical data
const historicalCandles = await loadHistoricalData(
  'BTC/USDT',
  '1h',
  '2023-01-01',
  '2023-12-31'
);

// Option 1: Quick backtest (one-liner)
const results = await quickBacktest(
  'sma-strategy',
  {
    type: 'sma-strategy',
    parameters: {
      fastPeriod: 20,
      slowPeriod: 50,
    },
  },
  historicalCandles,
  { initialCapital: 10000 }
);

// Option 2: Full control over backtesting process
const backtester = new StrategyBacktester(historicalCandles, {
  initialCapital: 10000,
  fees: 0.001, // 0.1%
  slippage: 0.001, // 0.1%
  saveTradeDetails: true,
});

// Load strategy
await backtester.loadStrategy('sma-strategy', {
  type: 'sma-strategy',
  parameters: {
    fastPeriod: 20,
    slowPeriod: 50,
  },
});

// Run backtest
const results = await backtester.runBacktest();

// Analyze results
console.log(`Total PnL: ${results.totalPnl}`);
console.log(`Win Rate: ${results.winRate * 100}%`);
console.log(`Max Drawdown: ${results.maxDrawdown * 100}%`);
```

### Configuration Options

The backtester accepts several configuration options:

| Option           | Description                                  | Default |
| ---------------- | -------------------------------------------- | ------- |
| initialCapital   | Starting capital for the backtest            | 10000   |
| fees             | Trading fees as decimal (e.g., 0.001 = 0.1%) | 0.001   |
| slippage         | Simulated price slippage                     | 0.001   |
| enableLogs       | Output detailed logs during backtest         | true    |
| saveTradeDetails | Save individual trade details                | true    |
| commission       | Additional commission fees                   | 0       |

## Performance Metrics

The backtest results include comprehensive performance metrics:

| Metric        | Description                              |
| ------------- | ---------------------------------------- |
| totalTrades   | Total number of completed trades         |
| winningTrades | Number of profitable trades              |
| losingTrades  | Number of losing trades                  |
| totalPnl      | Total profit/loss in currency units      |
| winRate       | Percentage of winning trades             |
| profitFactor  | Ratio of gross profit to gross loss      |
| averageWin    | Average profit per winning trade         |
| averageLoss   | Average loss per losing trade            |
| maxDrawdown   | Maximum percentage drop from peak equity |
| sharpeRatio   | Risk-adjusted return ratio               |

Additionally, detailed trade history and equity curve data are provided for
further analysis.

## Advanced Usage

### Custom Market Data Providers

You can extend the BacktestMarketDataProvider to customize how historical data
is fed into the system:

```typescript
class CustomDataProvider extends BacktestMarketDataProvider {
  // Override methods to customize data behavior
  async getCurrentPrice(symbol: string): Promise<number> {
    // Custom implementation
  }
}
```

### Parameter Optimization

The backtesting framework can be used to optimize strategy parameters:

```typescript
async function optimizeParameters(
  paramRanges: Record<string, number[]>,
  candles: Candle[]
) {
  let bestPnl = -Infinity;
  let bestParams = {};

  // Iterate through parameter combinations
  for (const fastPeriod of paramRanges.fastPeriod) {
    for (const slowPeriod of paramRanges.slowPeriod) {
      // Skip invalid combinations
      if (fastPeriod >= slowPeriod) continue;

      const results = await quickBacktest(
        'sma-strategy',
        {
          type: 'sma-strategy',
          parameters: { fastPeriod, slowPeriod },
        },
        candles
      );

      if (results.totalPnl > bestPnl) {
        bestPnl = results.totalPnl;
        bestParams = { fastPeriod, slowPeriod };
      }
    }
  }

  return { bestParams, bestPnl };
}
```

### Walk-Forward Testing

To validate strategy robustness, implement walk-forward testing:

```typescript
async function walkForwardTest(candles: Candle[], periodLength: number) {
  const results = [];

  // Split data into training and testing periods
  for (let i = 0; i < candles.length - periodLength * 2; i += periodLength) {
    const trainingData = candles.slice(i, i + periodLength);
    const testingData = candles.slice(i + periodLength, i + periodLength * 2);

    // Optimize on training data
    const { bestParams } = await optimizeParameters(
      { fastPeriod: [10, 20, 30], slowPeriod: [40, 50, 60] },
      trainingData
    );

    // Test on unseen data
    const testResults = await quickBacktest(
      'sma-strategy',
      {
        type: 'sma-strategy',
        parameters: bestParams,
      },
      testingData
    );

    results.push(testResults);
  }

  return results;
}
```

### Monte Carlo Simulation

Implement Monte Carlo simulations to assess strategy robustness:

```typescript
function performMonteCarloSimulation(trades: any[], iterations: number) {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    // Shuffle trades to simulate different possible sequences
    const shuffledTrades = [...trades].sort(() => Math.random() - 0.5);

    // Recalculate equity curve
    let equity = 10000;
    const equityCurve = [{ equity, timestamp: 0 }];

    for (const trade of shuffledTrades) {
      if (trade.pnl) {
        equity += trade.pnl;
        equityCurve.push({ equity, timestamp: trade.timestamp });
      }
    }

    // Calculate drawdown for this simulation
    let peak = 10000;
    let maxDrawdown = 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const drawdown = (peak - point.equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    results.push({
      finalEquity: equity,
      maxDrawdown,
      return: (equity - 10000) / 10000,
    });
  }

  return results;
}
```

## Conclusion

The Strategy Backtesting Framework provides a powerful tool for developing and
testing trading strategies. By thoroughly backtesting strategies before
deploying them to live markets, you can gain confidence in your trading approach
and make data-driven decisions to improve performance.
