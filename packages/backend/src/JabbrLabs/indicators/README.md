# JabbrLabs Indicators Library

A unified, extensible TypeScript library for technical analysis indicators, designed for use in trading strategies and signal processing within the Jabbr Trading Bot Platform.

## Overview

- **Consistent Interface:** All indicators implement a standard interface with metadata, parameter validation, and a `calculate` method.
- **Type Safety:** Written in TypeScript with strong typing for parameters and results.
- **Extensible:** Easily add new indicators by extending the base class and providing metadata.
- **Unified Exports:** Import any indicator from a single entry point (`index.ts`).
- **Robust Validation:** All indicators validate input data and parameters, handling edge cases gracefully.

## Usage Example

```typescript
import { SMAIndicator, EMAIndicator, ATRIndicator, RSIIndicator } from './index';

const sma = new SMAIndicator({ period: 10 });
const result = sma.calculate([1,2,3,4,5,6,7,8,9,10,11,12]);

const ema = new EMAIndicator({ period: 10, smoothing: 2 });
const emaResult = ema.calculate([1,2,3,4,5,6,7,8,9,10,11,12]);

const atr = new ATRIndicator({ period: 14 });
const atrResult = atr.calculate([
  10, 8, 9, 11, 9, 10, 12, 10, 11, 13, 11, 12, 14, 12, 13
]);

const rsi = new RSIIndicator({ period: 14 });
const rsiResult = rsi.calculate([44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00]);
```

---

## Indicator Reference

### SMAIndicator (Simple Moving Average)
- **Parameters:**
  - `period` (number, default: 14) — Number of periods for the moving average
- **Usage:**
  ```typescript
  const sma = new SMAIndicator({ period: 5 });
  sma.calculate([1,2,3,4,5,6,7]); // [3,4,5,6]
  ```
- **Formula:**
  \[
  SMA_t = \frac{1}{n} \sum_{i=0}^{n-1} P_{t-i}
  \]
- **Edge Cases:** Throws if insufficient data or invalid period.

### EMAIndicator (Exponential Moving Average)
- **Parameters:**
  - `period` (number, default: 14)
  - `smoothing` (number, default: 2)
- **Usage:**
  ```typescript
  const ema = new EMAIndicator({ period: 5, smoothing: 2 });
  ema.calculate([1,2,3,4,5,6,7]);
  ```
- **Formula:**
  \[
  EMA_t = (P_t - EMA_{t-1}) \times \frac{smoothing}{1+period} + EMA_{t-1}
  \]
- **Edge Cases:** Throws if insufficient data, invalid period, or smoothing <= 0.

### ATRIndicator (Average True Range)
- **Parameters:**
  - `period` (number, default: 14)
- **Usage:**
  ```typescript
  const atr = new ATRIndicator({ period: 14 });
  atr.calculate([
    10, 8, 9, 11, 9, 10, 12, 10, 11, 13, 11, 12, 14, 12, 13
  ]);
  // or use calculateRaw({ highs, lows, closes })
  ```
- **Formula:**
  \[
  TR = \max(High_t - Low_t, |High_t - Close_{t-1}|, |Low_t - Close_{t-1}|)\\
  ATR_t = \frac{1}{n} \sum_{i=0}^{n-1} TR_{t-i}
  \]
- **Edge Cases:** Throws if insufficient data, invalid period, or mismatched input arrays.

### RSIIndicator (Relative Strength Index)
- **Parameters:**
  - `period` (number, default: 14)
- **Usage:**
  ```typescript
  const rsi = new RSIIndicator({ period: 14 });
  rsi.calculate([44.34, 44.09, 44.15, ...]);
  ```
- **Formula:**
  \[
  RSI = 100 - \frac{100}{1 + RS}\\
  RS = \frac{Average\ Gain}{Average\ Loss}
  \]
- **Edge Cases:** Throws if insufficient data, invalid period, or non-numeric input.

### MACD (Moving Average Convergence Divergence)
- **Parameters:**
  - `fastPeriod` (number, default: 12)
  - `slowPeriod` (number, default: 26)
  - `signalPeriod` (number, default: 9)
- **Usage:**
  ```typescript
  import { MACD } from './index';
  const macd = new MACD({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  macd.calculate([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
  ```
- **Formula:**
  - MACD Line: EMA(fastPeriod) - EMA(slowPeriod)
  - Signal Line: EMA(signalPeriod) of MACD Line
  - Histogram: MACD Line - Signal Line
- **Edge Cases:** Throws if insufficient data or invalid parameters.

### Bollinger Bands
- **Parameters:**
  - `period` (number, default: 20)
  - `stdDev` (number, default: 2)
- **Usage:**
  ```typescript
  import { BollingerBands } from './index';
  const bb = new BollingerBands({ period: 20, stdDev: 2 });
  bb.calculate([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]);
  // Returns { upper: number[], middle: number[], lower: number[] }
  ```
- **Formula:**
  - Middle Band: SMA(period)
  - Upper Band: Middle + stdDev * StandardDeviation(period)
  - Lower Band: Middle - stdDev * StandardDeviation(period)
- **Edge Cases:** Throws if insufficient data or invalid parameters.

### StandardDeviation
- **Parameters:**
  - `period` (number, default: 14)
- **Usage:**
  ```typescript
  import { StandardDeviation } from './index';
  const std = new StandardDeviation({ period: 14 });
  std.calculate([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  ```
- **Formula:**
  \[
  \sigma = \sqrt{\frac{1}{n} \sum_{i=0}^{n-1} (P_{t-i} - \mu)^2}
  \]
- **Edge Cases:** Throws if insufficient data or invalid period.

### AveragePrice
- **Parameters:** None
- **Usage:**
  ```typescript
  import { AveragePrice } from './index';
  const avg = new AveragePrice();
  avg.calculate([1,2,3,4,5]); // Returns average of array
  ```
- **Formula:**
  \[
  AP = \frac{1}{n} \sum_{i=1}^{n} P_i
  \]
- **Edge Cases:** Throws if input is empty or not an array.

---

## Extending the Library

To add a new indicator:
1. Create a new file (e.g., `my-indicator.ts`) and extend `BaseIndicator`.
2. Define static `metadata` with name, description, parameters, and category.
3. Implement the `calculate` method and parameter validation.
4. Add your indicator to `index.ts` and the registry for unified exports.

## References
- [Investopedia: Technical Indicators](https://www.investopedia.com/terms/t/technicalindicator.asp)
- [TradingView: Pine Script Reference](https://www.tradingview.com/pine-script-docs/en/v5/)
- [Jabbr Trading Bot Platform Documentation](../../../../../docs/)

---

For questions or contributions, please see the main Jabbr repository or contact the JabbrLabs team.