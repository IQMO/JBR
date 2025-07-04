/**
 * Unit Tests for Improved SMA Signal Processor
 */

import { ImprovedSMASignalProcessor } from '../../../../src/JabbrLabs/signals/sma/improved-sma-signal-processor';
import type { SMASignalConfig } from '../../../../src/JabbrLabs/signals/sma/models';
import type { Candle } from '../../../../src/JabbrLabs/target-reacher/interfaces';

describe('ImprovedSMASignalProcessor', () => {
  let processor: ImprovedSMASignalProcessor;
  let config: SMASignalConfig;
  
  beforeEach(() => {
    // Default test configuration
    config = {
      fastPeriod: 5,
      slowPeriod: 10,
      minChangePercent: 0.5,
      confidenceThreshold: 0.4,
      priceSource: 'close',
      signalMode: 'crossover',
      useEMA: false
    };
    
    processor = new ImprovedSMASignalProcessor(config);
  });
  
  // Helper function to create test candles
  const createTestCandles = (
    prices: number[],
    baseTimestamp = Date.now()
  ): Candle[] => {
    return prices.map((price, index) => ({
      timestamp: baseTimestamp + index * 60000,  // 1 minute intervals
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 100
    }));
  };
  
  test('should initialize with default config', () => {
    const defaultProcessor = new ImprovedSMASignalProcessor();
    expect(defaultProcessor.getConfig()).toMatchObject({
      fastPeriod: 9,
      slowPeriod: 21,
      priceSource: 'close',
      signalMode: 'crossover',
    });
  });
  
  test('should initialize with custom config', () => {
    expect(processor.getConfig()).toMatchObject(config);
  });
  
  test('should reject invalid configs', () => {
    expect(() => {
      new ImprovedSMASignalProcessor({
        fastPeriod: 15,
        slowPeriod: 10,
        priceSource: 'close',
        signalMode: 'crossover'
      });
    }).toThrow('Fast period must be less than slow period');
    
    expect(() => {
      new ImprovedSMASignalProcessor({
        fastPeriod: 1,
        slowPeriod: 10,
        priceSource: 'close',
        signalMode: 'crossover'
      });
    }).toThrow('Fast period must be at least 2');
  });
  
  test('should return null for insufficient data', () => {
    const candles = createTestCandles([100, 101, 102, 103, 104]);
    expect(processor.process(candles)).toBeNull();
  });
  
  test('should detect bullish crossover', () => {
    // Create price pattern for a clear bullish crossover
    const prices = [
      // First establish downtrend with slow MA above fast MA
      100, 99, 98, 97, 96, 95, 94, 93, 92, 91,
      // Now create a trend reversal with prices rising rapidly
      92, 93, 94, 95, 96, 97, 98, 99, 100, 101
    ];
    const candles = createTestCandles(prices);
    
    // Should generate a bullish signal at some point during the upturn
    let bullishSignalFound = false;
    
    for (let i = config.slowPeriod + 2; i <= prices.length; i++) {
      const windowCandles = candles.slice(0, i);
      const output = processor.process(windowCandles);
      
      if (output && output.signal > 0) {
        bullishSignalFound = true;
        expect(output.confidence).toBeGreaterThanOrEqual(config.confidenceThreshold!);
        break;
      }
    }
    
    expect(bullishSignalFound).toBe(true);
  });
  
  test('should detect bearish crossover', () => {
    // Create price pattern for a clear bearish crossover
    const prices = [
      // First establish uptrend with fast MA above slow MA
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 
      // Now create a trend reversal with prices falling rapidly
      108, 107, 106, 105, 104, 103, 102, 101, 100, 99
    ];
    const candles = createTestCandles(prices);
    
    // Should generate a bearish signal at some point during the downturn
    let bearishSignalFound = false;
    
    for (let i = config.slowPeriod + 2; i <= prices.length; i++) {
      const windowCandles = candles.slice(0, i);
      const output = processor.process(windowCandles);
      
      if (output && output.signal < 0) {
        bearishSignalFound = true;
        expect(output.confidence).toBeGreaterThanOrEqual(config.confidenceThreshold!);
        break;
      }
    }
    
    expect(bearishSignalFound).toBe(true);
  });
  
  test('should handle flat price patterns correctly', () => {
    // Create flat price pattern (no signals expected)
    const prices = Array(20).fill(100);
    const candles = createTestCandles(prices);
    
    for (let i = config.slowPeriod + 2; i <= prices.length; i++) {
      const windowCandles = candles.slice(0, i);
      const output = processor.process(windowCandles);
      
      // Should not generate any signals for flat prices
      expect(output).toBeNull();
    }
  });
  
  test('should update config correctly', () => {
    processor.updateConfig({
      fastPeriod: 3,
      slowPeriod: 7,
      useEMA: true
    });
    
    expect(processor.getConfig()).toMatchObject({
      fastPeriod: 3,
      slowPeriod: 7,
      useEMA: true,
      priceSource: 'close'
    });
  });
  
  test('should create valid trade signals', () => {
    const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 108, 107];
    const candles = createTestCandles(prices);
    
    // Find a valid signal to test with
    for (let i = config.slowPeriod + 2; i <= prices.length; i++) {
      const windowCandles = candles.slice(0, i);
      const output = processor.process(windowCandles);
      
      if (output && output.signal !== 0) {
        const tradeSignal = processor.createTradeSignal(output, 'test-bot', 'BTCUSDT');
        
        expect(tradeSignal).toMatchObject({
          botId: 'test-bot',
          symbol: 'BTCUSDT',
          side: output.signal > 0 ? 'buy' : 'sell',
          confidence: output.confidence,
          price: output.lastPrice
        });
        
        expect(tradeSignal.id).toContain('sma-');
        expect(typeof tradeSignal.timestamp).toBe('number');
        break;
      }
    }
  });
});
