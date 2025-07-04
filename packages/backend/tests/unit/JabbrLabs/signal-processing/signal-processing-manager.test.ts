/**
 * Signal Processing Manager Tests
 * 
 * Tests for signal processing coordination and management
 */

import { EventEmitter } from 'events';

import { SignalProcessingManager } from '../../../../src/JabbrLabs/signal-processing/signal-processing-manager';
import type { StandardSignal} from '../../../../src/JabbrLabs/signal-processing/signal-translator';
import { SignalSource } from '../../../../src/JabbrLabs/signal-processing/signal-translator';
import type { SignalOutput as AetherSignalOutput} from '../../../../src/JabbrLabs/signals/aether/models';
import { MarketRegime } from '../../../../src/JabbrLabs/signals/aether/models';
import { SMASignalProcessor } from '../../../../src/JabbrLabs/signals/sma/sma-signal-processor';
import type { StrategyResult } from '../../../../src/JabbrLabs/target-reacher/interfaces';

// Mock implementations
class MockAetherGenerator extends EventEmitter {
  async generateSignal(symbol: string): Promise<AetherSignalOutput> {
    return {
      value: 0.7,
      confidence: 0.8,
      regime: MarketRegime.BULLISH,
      timestamp: Date.now(),
      components: {
        fractionalPDE: 0.5,
        reflectedBSDE: 0.3,
        meanFieldGame: 0.2,
        malliavinDerivative: 0.4
      }
    };
  }
}

class MockTargetReacher extends EventEmitter {
  async executeStrategy(strategyId: string, context: any): Promise<StrategyResult> {
    return {
      success: true,
      action: 'buy',
      confidence: 0.8,
      reason: 'Mock strategy result'
    };
  }
}

class MockTradingEngine {
  processedSignals: StandardSignal[] = [];

  async processAdvancedSignals(signals: StandardSignal[]): Promise<void> {
    this.processedSignals.push(...signals);
  }
}

describe('SignalProcessingManager', () => {
  let manager: SignalProcessingManager;
  let mockAetherGenerator: MockAetherGenerator;
  let mockSMAProcessor: SMASignalProcessor;
  let mockTargetReacher: MockTargetReacher;
  let mockTradingEngine: MockTradingEngine;

  beforeEach(() => {
    manager = new SignalProcessingManager({
      batchSize: 5,
      maxSignalsPerMinute: 30,
      minConfidence: 0.3,
      minStrength: 0.2,
      maxHighRiskSignals: 3
    });

    mockAetherGenerator = new MockAetherGenerator();
    mockSMAProcessor = new SMASignalProcessor();
    mockTargetReacher = new MockTargetReacher();
    mockTradingEngine = new MockTradingEngine();
  });

  afterEach(async () => {
    manager.stop();
  });

  describe('Initialization', () => {
    it('should initialize with all sources successfully', async () => {
      const initPromise = new Promise((resolve) => {
        manager.once('initialized', resolve);
      });

      await manager.initialize({
        aetherGenerator: mockAetherGenerator,
        smaProcessor: mockSMAProcessor,
        targetReacher: mockTargetReacher,
        tradingEngine: mockTradingEngine
      });

      await initPromise;

      const health = manager.getHealthStatus();
      expect(health.healthy).toBe(true);
    });

    it('should initialize with partial sources', async () => {
      await manager.initialize({
        smaProcessor: mockSMAProcessor,
        tradingEngine: mockTradingEngine
      });

      const health = manager.getHealthStatus();
      expect(health.issues).toContain('No signal sources connected');
    });

    it('should emit initialization event with correct data', async () => {
      let initData: any;
      manager.once('initialized', (data) => {
        initData = data;
      });

      await manager.initialize({
        aetherGenerator: mockAetherGenerator,
        tradingEngine: mockTradingEngine
      });

      expect(initData).toBeDefined();
      expect(initData.sources.aether).toBe(true);
      expect(initData.sources.sma).toBe(false);
      expect(initData.tradingEngine).toBe(true);
    });
  });

  describe('Signal Processing', () => {
    beforeEach(async () => {
      await manager.initialize({
        aetherGenerator: mockAetherGenerator,
        smaProcessor: mockSMAProcessor,
        targetReacher: mockTargetReacher,
        tradingEngine: mockTradingEngine
      });
    });

    it('should process Aether signals automatically', (done) => {
      manager.once('signal-processed', (data) => {
        expect(data.signal.source).toBe(SignalSource.AETHER);
        expect(data.signal.action).toBe('buy');
        done();
      });

      // Emit Aether signal
      mockAetherGenerator.emit('signal', {
        value: 0.7,
        confidence: 0.8,
        regime: MarketRegime.BULLISH,
        timestamp: Date.now(),
        components: {
          fractionalPDE: 0.5,
          reflectedBSDE: 0.3,
          meanFieldGame: 0.2,
          malliavinDerivative: 0.4
        }
      }, {
        symbol: 'BTCUSDT',
        price: 50000
      });
    });

    it('should process SMA signals manually', async () => {
      const candles = [
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: Date.now() - 60000 },
        { open: 102, high: 108, low: 98, close: 106, volume: 1200, timestamp: Date.now() - 30000 },
        { open: 106, high: 110, low: 104, close: 108, volume: 1100, timestamp: Date.now() }
      ];

      // Generate enough candles for SMA calculation
      const extendedCandles: any[] = [];
      for (let i = 0; i < 25; i++) {
        extendedCandles.push({
          open: 100 + i,
          high: 105 + i,
          low: 95 + i,
          close: 102 + i,
          volume: 1000,
          timestamp: Date.now() - (25 - i) * 60000
        });
      }

      await manager.processSMASignals(extendedCandles, 'BTCUSDT');

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = manager.getStats();
      expect(stats.smaSignals).toBeGreaterThan(0);
    });

    it('should process Target Reacher signals automatically', (done) => {
      manager.once('signal-processed', (data) => {
        expect(data.signal.source).toBe(SignalSource.TARGET_REACHER);
        expect(data.signal.action).toBe('buy');
        done();
      });

      // Emit Target Reacher signal
      mockTargetReacher.emit('strategy-result', {
        success: true,
        action: 'buy',
        confidence: 0.8,
        reason: 'Strategy recommends buy'
      }, {
        symbol: 'ETHUSDT'
      });
    });

    it('should queue signals with correct priority', () => {
      const signal1: StandardSignal = {
        id: 'test-1',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'low',
        urgency: 'medium'
      };

      const signal2: StandardSignal = {
        id: 'test-2',
        source: SignalSource.TARGET_REACHER,
        action: 'sell',
        confidence: 0.9,
        strength: 0.8,
        symbol: 'ETHUSDT',
        timestamp: Date.now(),
        reason: 'High priority signal',
        metadata: {},
        riskLevel: 'low',
        urgency: 'high'
      };

      manager.addSignal(signal1, 2); // Medium priority
      manager.addSignal(signal2, 3); // High priority

      const queueStatus = manager.getQueueStatus();
      expect(queueStatus.size).toBe(2);
      expect(queueStatus.priorityDistribution[2]).toBe(1);
      expect(queueStatus.priorityDistribution[3]).toBe(1);
    });
  });

  describe('Quality Filtering', () => {
    beforeEach(async () => {
      await manager.initialize({
        tradingEngine: mockTradingEngine
      });
    });

    it('should filter signals below confidence threshold', () => {
      const lowConfidenceSignal: StandardSignal = {
        id: 'test-low-conf',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.1, // Below threshold (0.3)
        strength: 0.8,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Low confidence signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'low'
      };

      manager.addSignal(lowConfidenceSignal);

      const stats = manager.getStats();
      expect(stats.filtered).toBeGreaterThan(0);

      const queueStatus = manager.getQueueStatus();
      expect(queueStatus.size).toBe(0);
    });

    it('should filter signals below strength threshold', () => {
      const lowStrengthSignal: StandardSignal = {
        id: 'test-low-strength',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.1, // Below threshold (0.2)
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Low strength signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'low'
      };

      manager.addSignal(lowStrengthSignal);

      const stats = manager.getStats();
      expect(stats.filtered).toBeGreaterThan(0);
    });

    it('should limit high risk signals', () => {
      // Add signals up to the limit
      for (let i = 0; i < 4; i++) {
        const highRiskSignal: StandardSignal = {
          id: `test-high-risk-${i}`,
          source: SignalSource.SMA,
          action: 'buy',
          confidence: 0.8,
          strength: 0.7,
          symbol: 'BTCUSDT',
          timestamp: Date.now(),
          reason: 'High risk signal',
          metadata: {},
          riskLevel: 'high',
          urgency: 'medium'
        };

        manager.addSignal(highRiskSignal);
      }

      const stats = manager.getStats();
      expect(stats.filtered).toBeGreaterThan(0); // Last signal should be filtered
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await manager.initialize({
        tradingEngine: mockTradingEngine
      });
    });

    it('should track signal processing statistics', async () => {
      const signal: StandardSignal = {
        id: 'test-stats',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal for stats',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'medium'
      };

      manager.addSignal(signal);

      // Wait for processing with longer timeout
      await new Promise(resolve => setTimeout(resolve, 2500));

      const stats = manager.getStats();
      expect(stats.totalProcessed).toBeGreaterThan(0);
      expect(stats.successful).toBeGreaterThan(0);
      expect(stats.buySignals).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageStrength).toBeGreaterThan(0);
    });

    it('should track queue status correctly', () => {
      const signals = [
        { id: 'test-1', priority: 1 },
        { id: 'test-2', priority: 2 },
        { id: 'test-3', priority: 2 },
        { id: 'test-4', priority: 3 }
      ];

      signals.forEach(({ id, priority }) => {
        const signal: StandardSignal = {
          id,
          source: SignalSource.SMA,
          action: 'buy',
          confidence: 0.8,
          strength: 0.7,
          symbol: 'BTCUSDT',
          timestamp: Date.now(),
          reason: 'Test signal',
          metadata: {},
          riskLevel: 'medium',
          urgency: 'medium'
        };

        manager.addSignal(signal, priority);
      });

      const queueStatus = manager.getQueueStatus();
      expect(queueStatus.size).toBe(4);
      expect(queueStatus.priorityDistribution[1]).toBe(1);
      expect(queueStatus.priorityDistribution[2]).toBe(2);
      expect(queueStatus.priorityDistribution[3]).toBe(1);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        batchSize: 15,
        minConfidence: 0.5,
        maxHighRiskSignals: 10
      };

      let configUpdated = false;
      manager.once('config-updated', () => {
        configUpdated = true;
      });

      manager.updateConfig(newConfig);

      expect(configUpdated).toBe(true);
    });

    it('should clear queue when requested', () => {
      const signal: StandardSignal = {
        id: 'test-clear',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'medium'
      };

      manager.addSignal(signal);
      expect(manager.getQueueStatus().size).toBe(1);

      let queueCleared = false;
      manager.once('queue-cleared', () => {
        queueCleared = true;
      });

      manager.clearQueue();

      expect(manager.getQueueStatus().size).toBe(0);
      expect(queueCleared).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await manager.initialize({
        aetherGenerator: mockAetherGenerator,
        targetReacher: mockTargetReacher,
        tradingEngine: mockTradingEngine
      });
    });

    it('should handle source errors', (done) => {
      manager.once('source-error', (data) => {
        expect(data.source).toBe('aether');
        expect(data.error).toBeDefined();
        done();
      });

      mockAetherGenerator.emit('error', new Error('Aether error'));
    });

    it('should handle processing errors gracefully', (done) => {
      // Set a timeout for the test
      const timeout = setTimeout(() => {
        done(new Error('Test timed out waiting for signal-error event'));
      }, 3000);

      manager.once('signal-error', (data) => {
        clearTimeout(timeout);
        expect(data.error).toContain('processing failed');
        done();
      });

      // Create signal that will expire very soon 
      const invalidSignal: StandardSignal = {
        id: 'test-error',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'medium',
        validUntil: Date.now() + 500 // Expires in 500ms
      };

      manager.addSignal(invalidSignal);
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status when everything is working', async () => {
      await manager.initialize({
        aetherGenerator: mockAetherGenerator,
        smaProcessor: mockSMAProcessor,
        tradingEngine: mockTradingEngine
      });

      const health = manager.getHealthStatus();
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect missing trading engine', async () => {
      await manager.initialize({
        aetherGenerator: mockAetherGenerator
      });

      const health = manager.getHealthStatus();
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('Trading engine not connected');
    });

    it('should detect large queue size', () => {
      // Add many signals to create large queue
      for (let i = 0; i < 50; i++) {
        const signal: StandardSignal = {
          id: `test-${i}`,
          source: SignalSource.SMA,
          action: 'buy',
          confidence: 0.8,
          strength: 0.7,
          symbol: 'BTCUSDT',
          timestamp: Date.now(),
          reason: 'Test signal',
          metadata: {},
          riskLevel: 'medium',
          urgency: 'medium'
        };

        manager.addSignal(signal);
      }

      const health = manager.getHealthStatus();
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('Signal queue growing too large');
    });
  });

  describe('Lifecycle Management', () => {
    it('should stop processing correctly', async () => {
      await manager.initialize({
        tradingEngine: mockTradingEngine
      });

      let stopped = false;
      manager.once('stopped', () => {
        stopped = true;
      });

      manager.stop();

      expect(stopped).toBe(true);
      expect(manager.getQueueStatus().size).toBe(0);
    });
  });
});
