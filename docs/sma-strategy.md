# SMA Crossover Strategy Documentation

## Overview

The SMA Crossover Strategy is a technical trading strategy based on Simple Moving Average (SMA) crossovers. It generates buy and sell signals when the fast-moving average crosses above or below the slow-moving average.

## Components

### SMA Signal Processor

The `SMASignalProcessor` class is responsible for:
- Calculating moving averages (simple or exponential)
- Detecting crossover events
- Generating trade signals with confidence levels
- Supporting different signal modes (crossover, trend, combined)

### Signal Modes

1. **Crossover Mode**: Generates signals only on MA crossover events
2. **Trend Mode**: Generates signals based on price and MA relationship
3. **Combined Mode**: Uses both crossover and trend signals

## Configuration

The SMA strategy accepts the following configuration parameters:

| Parameter            | Type                                 | Default    | Description                                               |
|---------------------|--------------------------------------|------------|-----------------------------------------------------------|
| fastPeriod          | number                               | 9          | Period for the fast moving average                        |
| slowPeriod          | number                               | 21         | Period for the slow moving average                        |
| minChangePercent    | number                               | 0.5        | Minimum price change percentage to consider signal valid   |
| confidenceThreshold | number                               | 0.4        | Minimum confidence level required to generate a signal    |
| priceSource         | 'close' \| 'open' \| 'high' \| 'low' | 'close'    | Price data source for calculations                        |
| signalMode          | 'crossover' \| 'trend' \| 'combined' | 'crossover'| Signal generation mode                                    |
| useEMA              | boolean                              | false      | Whether to use Exponential Moving Average instead of SMA   |

## Signal Generation

Signals are generated based on the following conditions:

### Crossover Signals

- **Bullish Signal (1)**: Generated when the fast MA crosses above the slow MA
- **Bearish Signal (-1)**: Generated when the fast MA crosses below the slow MA

### Trend Signals

- **Bullish Signal (1)**: Generated when price is above both MAs and fast MA is rising
- **Bearish Signal (-1)**: Generated when price is below both MAs and fast MA is falling

## Confidence Calculation

The confidence level (0-1) is calculated based on:
- The distance between the fast and slow MAs (as percentage of price)
- The price distance from the slow MA (for trend signals)

## Trade Signal Creation

The processor generates trade signals with the following attributes:
- **ID**: Unique identifier for the signal
- **Side**: 'buy' for bullish signals, 'sell' for bearish signals
- **Confidence**: Confidence level (0-1)
- **Price**: Current price at signal generation
- **Timestamp**: Signal generation time
- **Reason**: Explanation of why the signal was generated

## Usage Example

```typescript
import { SMASignalProcessor } from './signals/sma';
import { Candle } from './interfaces';

// Create processor with custom configuration
const smaProcessor = new SMASignalProcessor({
  fastPeriod: 12,
  slowPeriod: 26,
  confidenceThreshold: 0.4,
  signalMode: 'combined'
});

// Process candle data
function processCandles(candles: Candle[]) {
  const signal = smaProcessor.process(candles);
  
  if (signal) {
    // Generate trade signal
    const tradeSignal = smaProcessor.createTradeSignal(
      signal,
      'bot-id',
      'BTC/USDT'
    );
    
    // Execute trade based on signal
    console.log(`Trade signal: ${tradeSignal.side}, Confidence: ${tradeSignal.confidence}`);
  }
}
```

## Implementation Notes

- Always ensure sufficient data points (at least slowPeriod + 1 candles)
- Adjust confidenceThreshold based on market conditions
- For best results, use combined mode for more signal opportunities
- Consider using EMA instead of SMA for faster response in volatile markets

## Performance Considerations

The SMA Crossover strategy performs best in trending markets and may generate false signals in ranging or highly volatile conditions. Consider adding filters like:

- Minimum confidence threshold adjustment based on volatility
- Volume confirmation for signals
- Additional technical indicators for confirmation
