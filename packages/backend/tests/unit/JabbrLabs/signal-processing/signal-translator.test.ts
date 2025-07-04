/**
 * Signal Translator Tests
 * 
 * Comprehensive tests for signal translation functionality
 */

import type { StandardSignal } from '../../../../src/JabbrLabs/signal-processing/signal-translator';
import { SignalTranslator, SignalSource } from '../../../../src/JabbrLabs/signal-processing/signal-translator';
import type { SignalOutput as AetherSignalOutput} from '../../../../src/JabbrLabs/signals/aether/models';
import { MarketRegime } from '../../../../src/JabbrLabs/signals/aether/models';
import type { SMASignalOutput } from '../../../../src/JabbrLabs/signals/sma/models';
import type { StrategyResult } from '../../../../src/JabbrLabs/target-reacher/interfaces';

describe('SignalTranslator', () => {
  let translator: SignalTranslator;

  beforeEach(() => {
    translator = new SignalTranslator();
  });

  describe('Aether Signal Translation', () => {
    it('should translate strong bullish Aether signal correctly', () => {
      const aetherSignal: AetherSignalOutput = {
        value: 0.8,
        confidence: 0.9,
        regime: MarketRegime.BULLISH,
        timestamp: Date.now(),
        components: {
          fractionalPDE: 0.5,
          reflectedBSDE: 0.3,
          meanFieldGame: 0.2,
          malliavinDerivative: 0.4
        }
      };

      const result = translator.translateAetherSignal(aetherSignal, 'BTCUSDT', 50000);

      expect(result.success).toBe(true);
      expect(result.signal).toBeDefined();
      expect(result.signal!.action).toBe('buy');
      expect(result.signal!.source).toBe(SignalSource.AETHER);
      expect(result.signal!.confidence).toBe(0.9);
      expect(result.signal!.strength).toBe(0.8);
      expect(result.signal!.symbol).toBe('BTCUSDT');
      expect(result.signal!.price).toBe(50000);
      expect(result.signal!.riskLevel).toBe('low');
      expect(result.signal!.urgency).toBe('high');
    });

    it('should translate strong bearish Aether signal correctly', () => {
      const aetherSignal: AetherSignalOutput = {
        value: -0.7,
        confidence: 0.8,
        regime: MarketRegime.BEARISH,
        timestamp: Date.now(),
        components: {
          fractionalPDE: 0.2,
          reflectedBSDE: 0.1,
          meanFieldGame: 0.3,
          malliavinDerivative: 0.2
        }
      };

      const result = translator.translateAetherSignal(aetherSignal, 'ETHUSDT', 3000);

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('sell');
      expect(result.signal!.strength).toBe(0.7);
      expect(result.signal!.riskLevel).toBe('low');
      expect(result.signal!.urgency).toBe('high');
    });

    it('should translate hold signal for weak Aether signal', () => {
      const aetherSignal: AetherSignalOutput = {
        value: 0.1,
        confidence: 0.5,
        regime: MarketRegime.SIDEWAYS,
        timestamp: Date.now(),
        components: {
          fractionalPDE: 0.3,
          reflectedBSDE: 0.3,
          meanFieldGame: 0.3,
          malliavinDerivative: 0.3
        }
      };

      const result = translator.translateAetherSignal(aetherSignal, 'ADAUSDT', 1.5);

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('hold');
      expect(result.signal!.strength).toBe(0.1);
      expect(result.signal!.urgency).toBe('low');
    });

    it('should handle volatile market with high risk', () => {
      const aetherSignal: AetherSignalOutput = {
        value: 0.6,
        confidence: 0.3,
        regime: MarketRegime.VOLATILE,
        timestamp: Date.now(),
        components: {
          fractionalPDE: 0.1,
          reflectedBSDE: 0.9,
          meanFieldGame: 0.2,
          malliavinDerivative: 0.8
        }
      };

      const result = translator.translateAetherSignal(aetherSignal, 'BTCUSDT', 50000);

      expect(result.success).toBe(true);
      expect(result.signal!.riskLevel).toBe('high');
    });

    it('should handle translation errors gracefully', () => {
      const invalidSignal = null as any;

      const result = translator.translateAetherSignal(invalidSignal, 'BTCUSDT', 50000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('translation failed');
    });
  });

  describe('SMA Signal Translation', () => {
    it('should translate bullish SMA signal correctly', () => {
      const smaSignal: SMASignalOutput = {
        signal: 0.8,
        confidence: 0.7,
        lastPrice: 50000,
        fastMA: 49800,
        slowMA: 49500,
        reason: 'Bullish crossover detected',
        strength: 0.6,
        timestamp: Date.now(),
        metadata: {
          fastPeriod: 9,
          slowPeriod: 21
        }
      };

      const result = translator.translateSMASignal(smaSignal, 'BTCUSDT', 50000);

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('buy');
      expect(result.signal!.source).toBe(SignalSource.SMA);
      expect(result.signal!.confidence).toBe(0.7);
      expect(result.signal!.strength).toBe(0.6);
      expect(result.signal!.riskLevel).toBe('low');
    });

    it('should translate bearish SMA signal correctly', () => {
      const smaSignal: SMASignalOutput = {
        signal: -0.9,
        confidence: 0.8,
        lastPrice: 48000,
        fastMA: 48200,
        slowMA: 48500,
        reason: 'Bearish crossover detected',
        strength: 0.9,
        timestamp: Date.now()
      };

      const result = translator.translateSMASignal(smaSignal, 'BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('sell');
      expect(result.signal!.urgency).toBe('high');
    });

    it('should translate hold signal for weak SMA signal', () => {
      const smaSignal: SMASignalOutput = {
        signal: 0.3,
        confidence: 0.4,
        lastPrice: 50000,
        fastMA: 49950,
        slowMA: 49900,
        reason: 'Weak signal detected',
        strength: 0.2,
        timestamp: Date.now()
      };

      const result = translator.translateSMASignal(smaSignal, 'BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('hold');
      expect(result.signal!.riskLevel).toBe('high');
    });
  });

  describe('Strategy Result Translation', () => {
    it('should translate successful buy strategy result', () => {
      const strategyResult: StrategyResult = {
        success: true,
        action: 'buy',
        confidence: 0.85,
        reason: 'Technical indicators align for buy',
        metadata: {
          indicators: ['RSI', 'MACD', 'BB'],
          score: 8.5
        }
      };

      const result = translator.translateStrategyResult(strategyResult, 'ETHUSDT', SignalSource.STRATEGY, 3000);

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('buy');
      expect(result.signal!.source).toBe(SignalSource.STRATEGY);
      expect(result.signal!.confidence).toBe(0.85);
      expect(result.signal!.riskLevel).toBe('low');
      expect(result.signal!.urgency).toBe('high');
    });

    it('should translate close strategy result with high urgency', () => {
      const strategyResult: StrategyResult = {
        success: true,
        action: 'close',
        confidence: 0.6,
        reason: 'Stop loss triggered',
        metadata: {
          trigger: 'stop_loss',
          loss: -5.2
        }
      };

      const result = translator.translateStrategyResult(strategyResult, 'BTCUSDT', SignalSource.TARGET_REACHER);

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('close');
      expect(result.signal!.urgency).toBe('high');
    });

    it('should handle failed strategy execution', () => {
      const strategyResult: StrategyResult = {
        success: false,
        error: 'Strategy execution failed',
        action: 'buy',
        confidence: 0.5
      };

      const result = translator.translateStrategyResult(strategyResult, 'BTCUSDT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Strategy execution failed');
    });

    it('should handle hold action appropriately', () => {
      const strategyResult: StrategyResult = {
        success: true,
        action: 'hold',
        confidence: 0.7,
        reason: 'Market conditions unclear'
      };

      const result = translator.translateStrategyResult(strategyResult, 'ADAUSDT');

      expect(result.success).toBe(true);
      expect(result.signal!.action).toBe('hold');
      expect(result.signal!.urgency).toBe('low');
      expect(result.signal!.riskLevel).toBe('low');
    });
  });

  describe('Signal Validation', () => {
    it('should validate correct signal', () => {
      const validSignal: StandardSignal = {
        id: 'test-123',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        price: 50000,
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'high',
        validUntil: Date.now() + 300000
      };

      const validation = translator.validateSignal(validSignal);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSignal = {
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT'
        // Missing id, timestamp, reason, metadata, riskLevel, urgency
      } as StandardSignal;

      const validation = translator.validateSignal(invalidSignal);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Signal ID is required');
      expect(validation.errors).toContain('Timestamp is required');
    });

    it('should detect invalid ranges', () => {
      const invalidSignal: StandardSignal = {
        id: 'test-123',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 1.5, // Invalid - > 1
        strength: -0.1, // Invalid - < 0
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'high'
      };

      const validation = translator.validateSignal(invalidSignal);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Confidence must be between 0 and 1');
      expect(validation.errors).toContain('Strength must be between 0 and 1');
    });

    it('should detect expired signals', () => {
      const expiredSignal: StandardSignal = {
        id: 'test-123',
        source: SignalSource.SMA,
        action: 'buy',
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'medium',
        urgency: 'high',
        validUntil: Date.now() - 1000 // Expired
      };

      const validation = translator.validateSignal(expiredSignal);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Signal has expired');
    });

    it('should detect invalid enum values', () => {
      const invalidSignal: StandardSignal = {
        id: 'test-123',
        source: SignalSource.SMA,
        action: 'invalid' as any,
        confidence: 0.8,
        strength: 0.7,
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        reason: 'Test signal',
        metadata: {},
        riskLevel: 'invalid' as any,
        urgency: 'invalid' as any
      };

      const validation = translator.validateSignal(invalidSignal);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Action must be one of: buy, sell, hold, close');
      expect(validation.errors).toContain('Risk level must be one of: low, medium, high');
      expect(validation.errors).toContain('Urgency must be one of: low, medium, high');
    });
  });

  describe('Batch Translation', () => {
    it('should translate multiple signals successfully', async () => {
      const signals = [
        {
          type: 'aether' as const,
          data: {
            value: 0.7,
            confidence: 0.8,
            regime: MarketRegime.BULLISH,
            timestamp: Date.now(),
            components: {
              fractionalPDE: 0.5,
              reflectedBSDE: 0.3,
              meanFieldGame: 0.2,
              malliavinDerivative: 0.6
            }
          } as AetherSignalOutput,
          symbol: 'BTCUSDT',
          price: 50000
        },
        {
          type: 'sma' as const,
          data: {
            signal: 0.6,
            confidence: 0.7,
            lastPrice: 3000,
            fastMA: 2980,
            slowMA: 2950,
            reason: 'Bullish signal',
            strength: 0.6,
            timestamp: Date.now()
          } as SMASignalOutput,
          symbol: 'ETHUSDT'
        }
      ];

      const result = await translator.translateBatch(signals);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].source).toBe(SignalSource.AETHER);
      expect(result.successful[1].source).toBe(SignalSource.SMA);
    });

    it('should handle mixed success and failure in batch', async () => {
      const signals = [
        {
          type: 'aether' as const,
          data: null as any, // Invalid data
          symbol: 'BTCUSDT'
        },
        {
          type: 'strategy' as const,
          data: {
            success: true,
            action: 'buy',
            confidence: 0.8,
            reason: 'Good signal'
          } as StrategyResult,
          symbol: 'ETHUSDT'
        }
      ];

      const result = await translator.translateBatch(signals);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.successful[0].source).toBe(SignalSource.STRATEGY);
      expect(result.failed[0].error).toContain('translation failed');
    });

    it('should handle unsupported signal types', async () => {
      const signals = [
        {
          type: 'unsupported' as any,
          data: {} as any,
          symbol: 'BTCUSDT'
        }
      ];

      const result = await translator.translateBatch(signals);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Unsupported signal type');
    });
  });

  describe('Signal ID Generation', () => {
    it('should generate unique signal IDs', () => {
      const aetherSignal: AetherSignalOutput = {
        value: 0.5,
        confidence: 0.6,
        regime: MarketRegime.BULLISH,
        timestamp: Date.now(),
        components: {
          fractionalPDE: 0.5,
          reflectedBSDE: 0.5,
          meanFieldGame: 0.5,
          malliavinDerivative: 0.5
        }
      };

      const result1 = translator.translateAetherSignal(aetherSignal, 'BTCUSDT');
      const result2 = translator.translateAetherSignal(aetherSignal, 'BTCUSDT');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.signal!.id).not.toBe(result2.signal!.id);
      expect(result1.signal!.id).toContain('aether_');
      expect(result2.signal!.id).toContain('aether_');
    });
  });
});
