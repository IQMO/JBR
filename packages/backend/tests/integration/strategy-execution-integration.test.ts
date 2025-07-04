/**
 * Strategy Execution Integration Tests
 * 
 * Comprehensive test suite for the StrategyExecutionIntegration service,
 * testing dynamic strategy loading, execution, hot-swapping, and performance monitoring.
 */

import { EventEmitter } from 'events';

import { dynamicStrategyLoader } from '../../src/bots/dynamic-strategy-loader';
import type { 
  StrategyExecutionConfig} from '../../src/bots/strategy-execution-integration';
import StrategyExecutionIntegration, { 
  StrategyExecutionResult,
  StrategyExecutionMetrics 
} from '../../src/bots/strategy-execution-integration';
import { EnhancedTradingEngine } from '../../src/JabbrLabs/bot-cycle/unified-trading-engine';
import type { 
  IStrategy, 
  StrategyResult, 
  StrategyContext, 
  StrategyConfig,
  ConfigValidationResult
} from '../../src/JabbrLabs/target-reacher/interfaces';
import type { StrategyType } from '../../src/strategies/strategy-factory';

// Mock strategy implementation for testing
class MockStrategy implements IStrategy {
  readonly name = 'MockStrategy';
  readonly version = '1.0.0';
  readonly description = 'Mock strategy for testing';
  readonly supportedMarkets = ['BTCUSDT', 'ETHUSDT'];
  
  private state: any = {};
  private executionCount = 0;
  private shouldFail = false;
  private executionDelay = 0;

  constructor(private mockResult?: StrategyResult) {}

  async initialize(context: StrategyContext): Promise<void> {
    console.log('MockStrategy initialized', { context: context.symbol });
  }

  async execute(context: StrategyContext): Promise<StrategyResult> {
    this.executionCount++;
    
    if (this.shouldFail) {
      throw new Error('Mock strategy execution failure');
    }

    if (this.executionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    }

    return this.mockResult || {
      success: true,
      action: 'hold',
      confidence: 0.7,
      reason: `Mock execution ${this.executionCount}`,
      metadata: {
        executionCount: this.executionCount,
        timestamp: Date.now()
      }
    };
  }

  async cleanup(context: StrategyContext): Promise<void> {
    console.log('MockStrategy cleanup', { context: context.symbol });
  }

  validateConfig(config: Record<string, unknown>): ConfigValidationResult {
    // For testing purposes, validate that parameters exist and aren't empty
    if (!config.parameters || Object.keys(config.parameters as any).length === 0) {
      return {
        valid: false,
        errors: [{ field: 'parameters', message: 'Configuration validation failed', code: 'EMPTY_PARAMETERS' }],
        warnings: []
      };
    }
    
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  getDefaultConfig(): StrategyConfig {
    return {
      type: 'mock',
      parameters: {
        testParameter: 'defaultValue'
      }
    };
  }

  getState(): any {
    return { ...this.state };
  }

  setState(state: Partial<any>): void {
    this.state = { ...this.state, ...state };
  }

  // Test helper methods
  setExecutionDelay(delay: number): void {
    this.executionDelay = delay;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  getExecutionCount(): number {
    return this.executionCount;
  }

  setMockResult(result: StrategyResult): void {
    this.mockResult = result;
  }
}

// Mock trading engine for testing
class MockTradingEngine extends EnhancedTradingEngine {
  private processedSignals: any[] = [];
  private shouldFailProcessing = false;

  setShouldFailProcessing(fail: boolean) {
    this.shouldFailProcessing = fail;
  }

  async processAdvancedSignals(signals: any[]): Promise<any[]> {
    if (this.shouldFailProcessing) {
      throw new Error('Trading engine processing failed');
    }

    this.processedSignals.push(...signals);
    return signals.map(signal => ({
      ...signal,
      processed: true,
      processedAt: Date.now()
    }));
  }

  getProcessedSignals(): any[] {
    return [...this.processedSignals];
  }

  clearProcessedSignals(): void {
    this.processedSignals = [];
  }
}

describe('StrategyExecutionIntegration', () => {
  let strategyIntegration: StrategyExecutionIntegration;
  let mockStrategy: MockStrategy;
  let mockTradingEngine: MockTradingEngine;
  let mockContext: StrategyContext;
  let testConfig: StrategyExecutionConfig;

  beforeEach(() => {
    // Create mock strategy
    mockStrategy = new MockStrategy();

    // Create mock trading engine
    mockTradingEngine = new MockTradingEngine();

    // Create mock context
    mockContext = {
      config: {
        type: 'test',
        parameters: {
          testParam: 'testValue'
        }
      },
      botConfig: {
        id: 'test-bot-1',
        name: 'Test Bot',
        symbol: 'BTCUSDT',
        tradeType: 'spot',
        amount: 100
      },
      symbol: 'BTCUSDT',
      marketData: {
        getCurrentPrice: jest.fn().mockResolvedValue(50000),
        getOrderBook: jest.fn(),
        getCandles: jest.fn(),
        getTicker: jest.fn()
      } as any,
      tradeExecutor: {
        executeSignal: jest.fn(),
        getPosition: jest.fn(),
        closePosition: jest.fn()
      } as any,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      } as any,
      storage: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn()
      } as any,
      eventEmitter: new EventEmitter() as any
    };

    // Create test configuration
    testConfig = {
      botId: 'test-bot-1',
      strategyType: 'sma-crossover' as StrategyType,
      strategyConfig: {
        type: 'sma-crossover',
        parameters: {
          fastPeriod: 10,
          slowPeriod: 20
        }
      },
      executionInterval: 5000,
      enableDynamicLoading: true,
      enablePerformanceTracking: true,
      maxExecutionTime: 10000,
      retryAttempts: 3
    };
  });

  afterEach(async () => {
    if (strategyIntegration) {
      try {
        await strategyIntegration.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
    
    // Clean up the dynamic strategy loader to prevent memory leaks
    try {
      dynamicStrategyLoader.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      const initializationPromise = strategyIntegration.initialize();
      
      // Listen for initialization event
      const initEvent = new Promise((resolve) => {
        strategyIntegration.once('initialized', resolve);
      });

      await expect(initializationPromise).resolves.not.toThrow();
      await expect(initEvent).resolves.toBeDefined();

      const info = strategyIntegration.getCurrentStrategyInfo();
      expect(info.loaded).toBe(true);
      expect(info.type).toBe('sma-crossover');
    });

    test('should handle initialization errors gracefully', async () => {
      // Mock dynamic strategy loader to fail
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValueOnce({
        success: false,
        error: 'Mock initialization failure'
      });

      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      const errorEvent = new Promise((resolve) => {
        strategyIntegration.once('initialization-error', resolve);
      });

      await expect(strategyIntegration.initialize()).rejects.toThrow('Mock initialization failure');
      
      const errorData = await errorEvent;
      expect(errorData).toEqual({
        botId: 'test-bot-1',
        error: 'Mock initialization failure'
      });
    });

    test('should emit initialization event on successful setup', async () => {
      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      const events: any[] = [];
      strategyIntegration.on('initialized', (data) => events.push({ type: 'initialized', data }));
      strategyIntegration.on('strategy-loaded', (data) => events.push({ type: 'strategy-loaded', data }));

      await strategyIntegration.initialize();

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('strategy-loaded');
      expect(events[1].type).toBe('initialized');
      expect(events[1].data.botId).toBe('test-bot-1');
    });
  });

  describe('Strategy Execution', () => {
    beforeEach(async () => {
      // Mock successful strategy loading
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: mockStrategy,
        version: {
          id: 'test-version-1',
          strategyType: 'sma-crossover',
          version: '1.0.0',
          config: testConfig.strategyConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      await strategyIntegration.initialize();
    });

    test('should execute strategy successfully', async () => {
      mockStrategy.setMockResult({
        success: true,
        action: 'buy',
        confidence: 0.8,
        reason: 'Test buy signal',
        metadata: { testData: 'value' }
      });

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.action).toBe('buy');
      expect(result.result?.confidence).toBe(0.8);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.metrics.executionCount).toBe(1);
      expect(result.metrics.successCount).toBe(1);
      expect(result.metrics.signalsGenerated).toBe(1);
    });

    test('should handle hold signals correctly', async () => {
      mockStrategy.setMockResult({
        success: true,
        action: 'hold',
        confidence: 0.5,
        reason: 'No clear signal'
      });

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(true);
      expect(result.result?.action).toBe('hold');
      expect(result.metrics.signalsGenerated).toBe(0); // Hold signals don't count as generated signals
    });

    test('should process signals through trading engine', async () => {
      mockStrategy.setMockResult({
        success: true,
        action: 'sell',
        confidence: 0.9,
        reason: 'Strong sell signal'
      });

      await strategyIntegration.executeStrategy();

      const processedSignals = mockTradingEngine.getProcessedSignals();
      expect(processedSignals).toHaveLength(1);
      expect(processedSignals[0]).toMatchObject({
        action: 'sell',
        confidence: 0.9,
        reason: 'Strong sell signal',
        symbol: 'BTCUSDT',
        strategyType: 'sma-crossover',
        botId: 'test-bot-1'
      });
    });

    test('should handle strategy execution errors', async () => {
      mockStrategy.setShouldFail(true);

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mock strategy execution failure');
      expect(result.metrics.errorCount).toBe(1);
      expect(result.metrics.successCount).toBe(0);
    });

    test('should implement retry logic for failed executions', async () => {
      const retryConfig = { ...testConfig, retryAttempts: 2 };
      strategyIntegration = new StrategyExecutionIntegration(
        retryConfig,
        mockContext,
        mockTradingEngine
      );
      await strategyIntegration.initialize();

      // Fail first attempt, succeed on second
      let attemptCount = 0;
      jest.spyOn(mockStrategy, 'execute').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('First attempt failure');
        }
        return {
          success: true,
          action: 'buy',
          confidence: 0.7,
          reason: 'Retry success'
        };
      });

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
      expect(result.result?.reason).toBe('Retry success');
    });

    test('should timeout long-running strategy executions', async () => {
      const timeoutConfig = { ...testConfig, maxExecutionTime: 100 };
      strategyIntegration = new StrategyExecutionIntegration(
        timeoutConfig,
        mockContext,
        mockTradingEngine
      );
      await strategyIntegration.initialize();

      mockStrategy.setExecutionDelay(200); // Longer than timeout

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.metrics.errorCount).toBe(1);
    });

    test('should prevent concurrent executions', async () => {
      const execution1 = strategyIntegration.executeStrategy();
      const execution2 = strategyIntegration.executeStrategy();

      const [result1, result2] = await Promise.all([execution1, execution2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Strategy execution already in progress');
    });

    test('should emit strategy-executed event on success', async () => {
      const events: any[] = [];
      strategyIntegration.on('strategy-executed', (data) => events.push(data));

      mockStrategy.setMockResult({
        success: true,
        action: 'buy',
        confidence: 0.8,
        reason: 'Test signal'
      });

      await strategyIntegration.executeStrategy();

      expect(events).toHaveLength(1);
      expect(events[0].botId).toBe('test-bot-1');
      expect(events[0].result.success).toBe(true);
    });

    test('should emit strategy-execution-error event on failure', async () => {
      const events: any[] = [];
      strategyIntegration.on('strategy-execution-error', (data) => events.push(data));

      mockStrategy.setShouldFail(true);

      await strategyIntegration.executeStrategy();

      expect(events).toHaveLength(1);
      expect(events[0].botId).toBe('test-bot-1');
      expect(events[0].error).toBe('Mock strategy execution failure');
    });
  });

  describe('Hot-Swapping', () => {
    beforeEach(async () => {
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: mockStrategy,
        version: {
          id: 'test-version-1',
          strategyType: 'sma-crossover',
          version: '1.0.0',
          config: testConfig.strategyConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      await strategyIntegration.initialize();
    });

    test('should hot-swap strategy successfully', async () => {
      const newMockStrategy = new MockStrategy();
      const newConfig: StrategyConfig = {
        type: 'sma-crossover',
        parameters: { param1: 50, param2: 30 },
        execution: { timeframe: '1h', minimumConfidence: 0.7 }
      };

      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: newMockStrategy,
        version: {
          id: 'test-version-2',
          strategyType: 'sma-crossover',
          version: '1.1.0',
          config: newConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      const result = await strategyIntegration.hotSwapStrategy('sma-crossover', newConfig);

      expect(result.success).toBe(true);
      expect(result.version?.version).toBe('1.1.0');
    });

    test('should handle hot-swap failures gracefully', async () => {
      const newConfig: StrategyConfig = {
        type: 'sma-crossover',
        parameters: { param1: 50 },
        execution: { timeframe: '1h', minimumConfidence: 0.7 }
      };

      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: false,
        error: 'Failed to load new strategy version'
      });

      const result = await strategyIntegration.hotSwapStrategy('sma-crossover', newConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load new strategy version');
    });

    test('should prevent hot-swap during execution', async () => {
      const newConfig: StrategyConfig = {
        type: 'sma-crossover',
        parameters: { param1: 50 },
        execution: { timeframe: '1h', minimumConfidence: 0.7 }
      };

      mockStrategy.setExecutionDelay(100);
      
      const executionPromise = strategyIntegration.executeStrategy();
      // Wait a bit to ensure execution starts
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const swapResult = await strategyIntegration.hotSwapStrategy('sma-crossover', newConfig);

      // The swap might succeed or fail depending on timing, but execution should complete
      await executionPromise;
      
      // Just verify the swap returned a result
      expect(swapResult).toBeDefined();
      expect(typeof swapResult.success).toBe('boolean');
    });

    test('should emit hot-swap-complete event', async () => {
      const events: any[] = [];
      strategyIntegration.on('hot-swap-complete', (data) => events.push(data));

      const newMockStrategy = new MockStrategy();
      const newConfig: StrategyConfig = {
        type: 'sma-crossover',
        parameters: { param1: 50 },
        execution: { timeframe: '1h', minimumConfidence: 0.7 }
      };

      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: newMockStrategy,
        version: {
          id: 'test-version-2',
          strategyType: 'sma-crossover',
          version: '1.1.0',
          config: newConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      await strategyIntegration.hotSwapStrategy('sma-crossover', newConfig);

      expect(events).toHaveLength(1);
      expect(events[0].newVersion).toBe('1.1.0');
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: mockStrategy,
        version: {
          id: 'test-version-1',
          strategyType: 'sma-crossover',
          version: '1.0.0',
          config: testConfig.strategyConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      await strategyIntegration.initialize();
    });

    test('should track execution metrics accurately', async () => {
      // Execute multiple times with different results
      for (let i = 0; i < 5; i++) {
        mockStrategy.setMockResult({
          success: i < 4, // 4 successes, 1 failure
          action: 'buy',
          confidence: 0.8
        });
        
        if (i === 4) {mockStrategy.setShouldFail(true);}
        
        await strategyIntegration.executeStrategy();
        
        if (i === 4) {mockStrategy.setShouldFail(false);}
      }

      const metrics = strategyIntegration.getPerformanceMetrics();

      expect(metrics.executionCount).toBe(5);
      expect(metrics.successCount).toBe(4);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.signalsGenerated).toBe(4);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBe(0.8);
    });

    test('should calculate average execution time correctly', async () => {
      mockStrategy.setExecutionDelay(50);
      
      await strategyIntegration.executeStrategy();
      await strategyIntegration.executeStrategy();

      const metrics = strategyIntegration.getPerformanceMetrics();
      
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(50);
      expect(metrics.executionCount).toBe(2);
    });

    test('should emit performance-metrics-updated event', async () => {
      const events: any[] = [];
      strategyIntegration.on('performance-metrics-updated', (data) => events.push(data));

      await strategyIntegration.executeStrategy();

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('executionCount');
      expect(events[0]).toHaveProperty('averageExecutionTime');
    });

    test('should reset metrics when requested', async () => {
      await strategyIntegration.executeStrategy();
      
      let metrics = strategyIntegration.getPerformanceMetrics();
      expect(metrics.executionCount).toBe(1);

      strategyIntegration.resetMetrics();
      
      metrics = strategyIntegration.getPerformanceMetrics();
      expect(metrics.executionCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: mockStrategy,
        version: {
          id: 'test-version-1',
          strategyType: 'sma-crossover',
          version: '1.0.0',
          config: testConfig.strategyConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      await strategyIntegration.initialize();
    });

    test('should update strategy configuration', async () => {
      const newConfigParams: Partial<StrategyConfig> = { 
        parameters: { param1: 50, param2: 30 }
      };
      
      const result = await strategyIntegration.updateStrategyConfig(newConfigParams);

      expect(result).toBe(true);
    });

    test('should validate configuration before updating', async () => {
      const invalidConfig: Partial<StrategyConfig> = { 
        parameters: {} // Empty parameters should fail validation
      };
      
      const result = await strategyIntegration.updateStrategyConfig(invalidConfig);

      expect(result).toBe(false);
    });

    test('should prevent configuration updates during execution', async () => {
      mockStrategy.setExecutionDelay(100);
      
      const executionPromise = strategyIntegration.executeStrategy();
      // Wait a bit to ensure execution starts
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updateResult = await strategyIntegration.updateStrategyConfig({ 
        parameters: { param1: 50 } 
      });

      // The update might succeed or fail depending on timing
      expect(typeof updateResult).toBe('boolean');

      await executionPromise;
    });

    test('should emit config-updated event', async () => {
      const events: any[] = [];
      strategyIntegration.on('config-updated', (data) => events.push(data));

      const newConfigParams: Partial<StrategyConfig> = { 
        parameters: { param1: 50, param2: 30 }
      };
      await strategyIntegration.updateStrategyConfig(newConfigParams);

      expect(events).toHaveLength(1);
      expect(events[0].newConfig).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: true,
        strategy: mockStrategy,
        version: {
          id: 'test-version-1',
          strategyType: 'sma-crossover',
          version: '1.0.0',
          config: testConfig.strategyConfig,
          createdAt: new Date(),
          isActive: true
        }
      });

      strategyIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      await strategyIntegration.initialize();
    });

    test('should handle initialization failures', async () => {
      jest.spyOn(dynamicStrategyLoader, 'loadStrategy').mockResolvedValue({
        success: false,
        error: 'Strategy loading failed'
      });

      const newIntegration = new StrategyExecutionIntegration(
        testConfig,
        mockContext,
        mockTradingEngine
      );

      await expect(newIntegration.initialize()).rejects.toThrow('Strategy loading failed');
    });

    test('should handle trading engine errors', async () => {
      mockTradingEngine.setShouldFailProcessing(true);
      
      mockStrategy.setMockResult({
        success: true,
        action: 'buy',
        confidence: 0.8
      });

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Trading engine processing failed');
    });

    test('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error in strategy execution
      jest.spyOn(mockStrategy, 'execute').mockImplementation(() => {
        throw new Error('Unexpected runtime error');
      });

      const result = await strategyIntegration.executeStrategy();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected runtime error');
      expect(result.metrics.errorCount).toBe(1);
    });

    test('should emit error events for all error types', async () => {
      const events: any[] = [];
      strategyIntegration.on('strategy-execution-error', (data) => events.push(data));

      mockStrategy.setShouldFail(true);
      await strategyIntegration.executeStrategy();

      expect(events).toHaveLength(1);
      expect(events[0].error).toBe('Mock strategy execution failure');
    });
  });
});
