/**
 * SMA Crossover Strategy Integration Tests
 * 
 * Tests that verify the SMA strategy works correctly with the strategy framework
 */

import { SMACrossoverStrategy } from '../../../../src/JabbrLabs/signals/sma/sma-crossover-strategy';
import type {
  Candle,
  StrategyContext,
  BotConfig,
  StrategyConfig
} from '../../../../src/JabbrLabs/target-reacher/interfaces';
import { generateBullishCandles, generateBearishCandles, generateMixedTrendCandles } from '../../../utils/test-helpers';

// Create a specialized context for SMA testing
const createMockContext = (candles: Candle[] = []): StrategyContext => {
  const config: StrategyConfig = {
    type: 'sma-crossover',
    parameters: {
      fastPeriod: 5,
      slowPeriod: 15,
      priceSource: 'close',
      signalMode: 'crossover',
      useEMA: false,
      minChangePercent: 0.5,
      confidenceThreshold: 0.6
    },
    execution: {
      timeframe: '1h',
      minimumConfidence: 0.6
    }
  };

  const botConfig: BotConfig = {
    id: 'test-bot-1',
    name: 'Test SMA Bot',
    symbol: 'BTC/USDT',
    tradeType: 'spot',
    amount: 0.01
  };

  const context: StrategyContext = {
    config,
    botConfig,
    symbol: 'BTC/USDT',
    marketData: {
      getCurrentPrice: jest.fn().mockResolvedValue(100),
      getOrderBook: jest.fn().mockResolvedValue({
        bids: [[99, 1], [98, 2]],
        asks: [[101, 1], [102, 2]],
        timestamp: Date.now()
      }),
      getCandles: jest.fn().mockResolvedValue(candles),
      getTicker: jest.fn().mockResolvedValue({
        symbol: 'BTC/USDT',
        last: 100,
        bid: 99.5,
        ask: 100.5,
        volume: 10000,
        timestamp: Date.now()
      })
    } as any,
    tradeExecutor: {
      executeSignal: jest.fn().mockResolvedValue({
        id: 'test-order-1',
        orderId: 'exchange-order-1',
        botId: 'test-bot-1',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.01,
        price: 100,
        status: 'filled',
        filled: 0.01,
        remaining: 0,
        timestamp: Date.now(),
        updatedAt: Date.now()
      }),
      getPosition: jest.fn().mockResolvedValue(null),
      closePosition: jest.fn().mockResolvedValue(undefined)
    } as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any,
    storage: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    } as any,
    eventEmitter: {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as any
  };

  return context;
};

describe('SMACrossoverStrategy Integration', () => {
  it('should initialize correctly with the strategy context', async () => {
    const strategy = new SMACrossoverStrategy();
    const context = createMockContext();
    
    await expect(strategy.initialize(context)).resolves.not.toThrow();
    
    const state = strategy.getState();
    expect(state.isRunning).toBe(true);
  });
  
  it('should validate configuration correctly', () => {
    const strategy = new SMACrossoverStrategy();
    
    // Valid config
    const validConfig = {
      fastPeriod: 9,
      slowPeriod: 21,
      priceSource: 'close',
      signalMode: 'crossover',
      useEMA: false
    };
    
    const validationResult = strategy.validateConfig(validConfig);
    expect(validationResult.valid).toBe(true);
    
    // Invalid config (fastPeriod >= slowPeriod)
    const invalidConfig = {
      ...validConfig,
      fastPeriod: 25,
      slowPeriod: 21
    };
    
    const invalidResult = strategy.validateConfig(invalidConfig);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0].field).toBe('fastPeriod');
  });
  
  it('should return hold signal with insufficient data', async () => {
    const strategy = new SMACrossoverStrategy();
    const context = createMockContext([]);
    
    await strategy.initialize(context);
    const result = await strategy.execute(context);
    
    expect(result.success).toBe(false);
    expect(result.action).toBe('hold');
    expect(result.error).toContain('Insufficient data');
  });
  
  it('should generate buy signal on bullish market', async () => {
    const strategy = new SMACrossoverStrategy();
    const bullishCandles = generateBullishCandles(30);
    const context = createMockContext(bullishCandles);
    
    await strategy.initialize(context);
    const result = await strategy.execute(context);
    
    expect(result.success).toBe(true);
    expect(result.action).toBe('buy');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    
    // Trade executor should be called
    expect(context.tradeExecutor.executeSignal).toHaveBeenCalled();
  });
  
  it('should generate sell signal on bearish market', async () => {
    const strategy = new SMACrossoverStrategy();
    const bearishCandles = generateBearishCandles(30);
    const context = createMockContext(bearishCandles);
    
    await strategy.initialize(context);
    const result = await strategy.execute(context);
    
    expect(result.success).toBe(true);
    expect(result.action).toBe('sell');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });
  
  it('should hold when already in position with same direction', async () => {
    const strategy = new SMACrossoverStrategy();
    const bullishCandles = generateBullishCandles(30);
    const context = createMockContext(bullishCandles);
    
    // Mock existing long position
    context.tradeExecutor.getPosition = jest.fn().mockResolvedValue({
      symbol: 'BTC/USDT',
      side: 'long',
      size: 0.01,
      entryPrice: 95,
      currentPrice: 100,
      unrealizedPnl: 0.05,
      timestamp: Date.now()
    });
    
    await strategy.initialize(context);
    const result = await strategy.execute(context);
    
    expect(result.success).toBe(true);
    expect(result.action).toBe('hold');
    expect(result.reason).toContain('Already have a long position');
    
    // Trade executor should NOT be called
    expect(context.tradeExecutor.executeSignal).not.toHaveBeenCalled();
  });
  
  it('should close position when signal direction changes', async () => {
    const strategy = new SMACrossoverStrategy();
    const bearishCandles = generateBearishCandles(30);
    const context = createMockContext(bearishCandles);
    
    // Mock existing long position
    context.tradeExecutor.getPosition = jest.fn().mockResolvedValue({
      symbol: 'BTC/USDT',
      side: 'long',
      size: 0.01,
      entryPrice: 105,
      currentPrice: 100,
      unrealizedPnl: -0.05,
      timestamp: Date.now()
    });
    
    await strategy.initialize(context);
    const result = await strategy.execute(context);
    
    expect(result.success).toBe(true);
    expect(result.action).toBe('sell');
    
    // Position should be closed before new order
    expect(context.tradeExecutor.closePosition).toHaveBeenCalled();
    expect(context.tradeExecutor.executeSignal).toHaveBeenCalled();
  });
  
  it('should handle errors gracefully', async () => {
    const strategy = new SMACrossoverStrategy();
    const context = createMockContext(generateBullishCandles(30));
    
    // Mock a failure in the trade executor
    context.tradeExecutor.executeSignal = jest.fn().mockRejectedValue(
      new Error('Exchange error')
    );
    
    await strategy.initialize(context);
    const result = await strategy.execute(context);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Exchange error');
    expect(context.logger.error).toHaveBeenCalled();
  });
  
  it('should emit events when signals are generated', async () => {
    const strategy = new SMACrossoverStrategy();
    const context = createMockContext(generateBullishCandles(30));
    
    await strategy.initialize(context);
    await strategy.execute(context);
    
    expect(context.eventEmitter.emit).toHaveBeenCalledWith(
      'strategy:signal',
      expect.objectContaining({
        type: 'signal',
        botId: 'test-bot-1',
        symbol: 'BTC/USDT',
        strategy: 'SMA Crossover Strategy'
      })
    );
  });
  
  it('should cleanup resources properly', async () => {
    const strategy = new SMACrossoverStrategy();
    const context = createMockContext();
    
    await strategy.initialize(context);
    await strategy.cleanup(context);
    
    const state = strategy.getState();
    expect(state.isRunning).toBe(false);
  });
});
