/**
 * SMA Signal Processor Tests
 * 
 * Unit tests for the SMA signal processor module
 */

import { SMASignalConfig } from '../../../../src/JabbrLabs/signals/sma/models';
import { SMASignalProcessor } from '../../../../src/JabbrLabs/signals/sma/sma-signal-processor';
import type { Candle } from '../../../../src/JabbrLabs/target-reacher/interfaces';
import { generateBullishCandles, generateBearishCandles, generateMixedTrendCandles } from '../../../utils/test-helpers';

describe('SMASignalProcessor', () => {
  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const processor = new SMASignalProcessor();
      const config = processor.getConfig();
      
      expect(config.fastPeriod).toBe(9);
      expect(config.slowPeriod).toBe(21);
      expect(config.priceSource).toBe('close');
      expect(config.confidenceThreshold).toBe(0.4); // Updated default threshold
    });
    
    it('should update configuration', () => {
      const processor = new SMASignalProcessor();
      processor.updateConfig({
        fastPeriod: 5,
        slowPeriod: 15,
        priceSource: 'high'
      });
      
      const config = processor.getConfig();
      expect(config.fastPeriod).toBe(5);
      expect(config.slowPeriod).toBe(15);
      expect(config.priceSource).toBe('high');
    });
    
    it('should throw error when fast period >= slow period', () => {
      const processor = new SMASignalProcessor();
      
      expect(() => {
        processor.updateConfig({
          fastPeriod: 10,
          slowPeriod: 10
        });
      }).toThrow('Fast period must be less than slow period');
    });
  });
  
  describe('Signal Processing', () => {
    it('should return null on insufficient data', () => {
      const processor = new SMASignalProcessor({
        fastPeriod: 5,
        slowPeriod: 10
      });
      
      // Only 9 candles, need at least 11 (slowPeriod + 1)
      const candles = generateBullishCandles(9);
      
      const result = processor.process(candles);
      expect(result).toBeNull();
    });
    
    it('should not generate signal in a sideways market', () => {
      const processor = new SMASignalProcessor({
        fastPeriod: 3,
        slowPeriod: 5,
        confidenceThreshold: 0.5
      });
      
      // Generate flat market data
      const candles: Candle[] = [];
      for (let i = 0; i < 20; i++) {
        candles.push({
          timestamp: Date.now() - (20 - i) * 60 * 1000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000
        });
      }
      
      const signal = processor.process(candles);
      expect(signal).toBeNull();
    });
    
    it('should generate buy signal in trend mode', () => {
      const processor = new SMASignalProcessor({
        fastPeriod: 3,
        slowPeriod: 5,
        signalMode: 'trend', // Use trend mode instead of crossover
        confidenceThreshold: 0.2 // Lower threshold to ensure signal generation
      });
      
      // Generate strongly bullish candles
      const candles = generateBullishCandles(20, 100);
      
      // Process the candles
      const output = processor.process(candles);
      
      // We should get a bullish signal in trend mode
      expect(output).not.toBeNull();
      
      // If the output isn't null, verify its properties
      if (output) {
        expect(output.signal).toBe(1); // Buy signal
        expect(output.confidence).toBeGreaterThanOrEqual(0.2);
      }
    });
    
    it('should generate sell signal in a bearish market with trend mode', () => {
      const processor = new SMASignalProcessor({
        fastPeriod: 3,
        slowPeriod: 5,
        signalMode: 'trend',
        confidenceThreshold: 0.5
      });
      
      // Generate bearish market data
      const candles = generateBearishCandles(30);
      
      const signal = processor.process(candles);
      
      expect(signal).not.toBeNull();
      expect(signal?.signal).toBe(-1); // Sell signal
      expect(signal?.confidence).toBeGreaterThanOrEqual(0.5);
      expect(signal?.reason).toContain('bearish trend');
    });
    
    it('should not generate signal when confidence below threshold', () => {
      const processor = new SMASignalProcessor({
        fastPeriod: 3,
        slowPeriod: 5,
        confidenceThreshold: 0.9, // Very high threshold
        signalMode: 'crossover' // Ensure only crossover signals
      });
      
      // Generate mild bullish market data with no crossovers
      // All prices are consistently rising without crossing
      const candles: Candle[] = [];
      let price = 100;
      
      for (let i = 0; i < 30; i++) {
        const open = price;
        const close = price * 1.001; // Very small consistent increase
        
        candles.push({
          timestamp: Date.now() - (30 - i) * 60000,
          open,
          high: close * 1.001,
          low: open * 0.999,
          close,
          volume: 1000
        });
        
        price = close;
      }
      
      const signal = processor.process(candles);
      // There should be no signal because there's no crossover
      // and confidence is too high for trend signals
      expect(signal).toBeNull();
    });
    
    it('should use EMA calculation when useEMA is true', () => {
      const processor = new SMASignalProcessor({
        fastPeriod: 3,
        slowPeriod: 5,
        useEMA: true,
        confidenceThreshold: 0.5
      });
      
      // Generate strong bullish market
      const candles = generateBullishCandles(30, 100);
      
      const signal = processor.process(candles);
      expect(signal).not.toBeNull();
    });
  });
  
  describe('Trade Signal Creation', () => {
    it('should create valid trade signal from signal output', () => {
      const processor = new SMASignalProcessor();
      
      const signalOutput = {
        signal: 1,
        confidence: 0.75,
        lastPrice: 100,
        fastMA: 95,
        slowMA: 90,
        reason: 'Test reason',
        strength: 0.8,
        timestamp: Date.now(),
        metadata: {}
      };
      
      const tradeSignal = processor.createTradeSignal(
        signalOutput,
        'test-bot-id',
        'BTC/USDT'
      );
      
      expect(tradeSignal.botId).toBe('test-bot-id');
      expect(tradeSignal.symbol).toBe('BTC/USDT');
      expect(tradeSignal.side).toBe('buy');
      expect(tradeSignal.confidence).toBe(0.75);
      expect(tradeSignal.price).toBe(100);
      expect(tradeSignal.reason).toBe('Test reason');
      expect(tradeSignal.id).toContain('sma-');
      
      // For sell signal
      const bearishOutput = {
        ...signalOutput,
        signal: -1
      };
      
      const bearishSignal = processor.createTradeSignal(
        bearishOutput,
        'test-bot-id',
        'BTC/USDT'
      );
      
      expect(bearishSignal.side).toBe('sell');
    });
  });
});
