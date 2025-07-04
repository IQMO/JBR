/**
 * Strategy Factory Integration Tests
 * 
 * Tests to verify that the strategy factory can properly create and manage SMA strategies
 */

import { SMACrossoverStrategy } from '../../../src/JabbrLabs/signals/sma/sma-crossover-strategy';
import type { StrategyContext } from '../../../src/JabbrLabs/target-reacher/interfaces';
import { strategyFactory } from '../../../src/strategies/strategy-factory';

// Mock a strategy context
const createMockContext = (): StrategyContext => {
  return {
    config: {
      type: 'sma-crossover',
      parameters: {
        fastPeriod: 9,
        slowPeriod: 21,
        priceSource: 'close',
        signalMode: 'crossover',
        useEMA: false
      }
    },
    botConfig: {
      id: 'test-bot-1',
      name: 'Test Bot',
      symbol: 'BTC/USDT',
      tradeType: 'spot',
      amount: 0.01
    },
    symbol: 'BTC/USDT',
    marketData: {
      getCurrentPrice: jest.fn().mockResolvedValue(100),
      getOrderBook: jest.fn().mockResolvedValue({
        bids: [[99, 1], [98, 2]],
        asks: [[101, 1], [102, 2]],
        timestamp: Date.now()
      }),
      getCandles: jest.fn().mockResolvedValue([]),
      getTicker: jest.fn().mockResolvedValue({
        symbol: 'BTC/USDT',
        last: 100,
        bid: 99.5,
        ask: 100.5,
        volume: 10000,
        timestamp: Date.now()
      })
    },
    tradeExecutor: {
      executeSignal: jest.fn().mockResolvedValue({}),
      getPosition: jest.fn().mockResolvedValue(null),
      closePosition: jest.fn().mockResolvedValue(undefined)
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    },
    storage: {
      storeStrategyEvent: jest.fn().mockResolvedValue(undefined),
      getStrategyState: jest.fn().mockResolvedValue(null),
      saveStrategyState: jest.fn().mockResolvedValue(undefined)
    },
    eventEmitter: {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }
  };
};

describe('Strategy Factory with SMA Strategy', () => {
  beforeAll(async () => {
    // Initialize the strategy factory
    await strategyFactory.initialize();
  });
  
  it('should properly register SMA Crossover strategy as a built-in strategy', async () => {
    const strategies = strategyFactory.getBuiltInStrategies();
    
    const smaStrategy = strategies.find(strategy => strategy.type === 'sma-crossover');
    expect(smaStrategy).toBeDefined();
  });
  
  it('should create an SMA strategy instance correctly', async () => {
    const context = createMockContext();
    
    const strategy = await strategyFactory.createStrategy(
      'sma-crossover', 
      context.config, 
      context
    );
    
    expect(strategy).toBeInstanceOf(SMACrossoverStrategy);
    expect(strategy.name).toBe('SMA Crossover Strategy');
  });
  
  it('should validate SMA configuration correctly', async () => {
    // Valid config
    const validConfig = {
      fastPeriod: 9,
      slowPeriod: 21,
      priceSource: 'close',
      signalMode: 'crossover',
      useEMA: false
    };
    
    const validResult = await strategyFactory.validateConfig('sma-crossover', validConfig);
    expect(validResult.valid).toBe(true);
    
    // Invalid config
    const invalidConfig = {
      fastPeriod: 30,  // Fast period > slow period
      slowPeriod: 21,
      priceSource: 'close',
      signalMode: 'crossover'
    };
    
    const invalidResult = await strategyFactory.validateConfig('sma-crossover', invalidConfig);
    expect(invalidResult.valid).toBe(false);
  });
  
  it('should get default SMA config', async () => {
    const config = await strategyFactory.getDefaultConfig('sma-crossover');
    
    expect(config.type).toBe('sma-crossover');
    expect(config.parameters).toHaveProperty('fastPeriod');
    expect(config.parameters).toHaveProperty('slowPeriod');
    expect(config.parameters).toHaveProperty('signalMode');
  });
});
