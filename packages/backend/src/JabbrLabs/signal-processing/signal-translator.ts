/**
 * Signal Translator Module
 * 
 * Translates signals from various sources (Aether Signal Generator, Target Reacher, SMA) 
 * into a standardized format for the trading engine.
 */

import logger from '../../services/logging.service';
import type { SignalOutput as AetherSignalOutput} from '../signals/aether/models';
import { AetherParameters, MarketRegime } from '../signals/aether/models';
import type { SMASignalOutput } from '../signals/sma/models';
import type { StrategyResult } from '../target-reacher/interfaces';

/**
 * Standard Signal Format for the Trading Engine
 */
export interface StandardSignal {
  // Core signal properties
  id: string;
  source: SignalSource;
  action: 'buy' | 'sell' | 'hold' | 'close';
  confidence: number; // 0-1
  strength: number; // 0-1
  
  // Market context
  symbol: string;
  price?: number;
  timestamp: number;
  
  // Signal metadata
  reason: string;
  metadata: Record<string, unknown>;
  
  // Risk and execution hints
  riskLevel: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  validUntil?: number; // Timestamp when signal expires
}

/**
 * Supported signal sources
 */
export enum SignalSource {
  AETHER = 'aether',
  SMA = 'sma',
  TARGET_REACHER = 'target-reacher',
  STRATEGY = 'strategy',
  MANUAL = 'manual'
}

/**
 * Signal translation result
 */
export interface SignalTranslationResult {
  success: boolean;
  signal?: StandardSignal;
  error?: string;
  warnings?: string[];
}

/**
 * Signal Translator Class
 * Converts various signal formats into standardized signals
 */
export class SignalTranslator {
  private signalCounter = 0;

  /**
   * Generate unique signal ID
   */
  private generateSignalId(source: SignalSource): string {
    this.signalCounter++;
    return `${source}_${Date.now()}_${this.signalCounter}`;
  }

  /**
   * Translate Aether Signal Generator output to standard format
   */
  translateAetherSignal(
    aetherSignal: AetherSignalOutput,
    symbol: string,
    price?: number
  ): SignalTranslationResult {
    try {
      logger.info('🔄 Translating Aether signal to standard format', {
        value: aetherSignal.value,
        confidence: aetherSignal.confidence,
        regime: aetherSignal.regime
      });

      // Determine action based on signal value
      let action: 'buy' | 'sell' | 'hold';
      if (aetherSignal.value > 0.2) {
        action = 'buy';
      } else if (aetherSignal.value < -0.2) {
        action = 'sell';
      } else {
        action = 'hold';
      }

      // Calculate signal strength from absolute value
      const strength = Math.abs(aetherSignal.value);

      // Determine risk level based on market regime and confidence
      let riskLevel: 'low' | 'medium' | 'high';
      if (aetherSignal.regime === MarketRegime.VOLATILE || aetherSignal.confidence < 0.4) {
        riskLevel = 'high';
      } else if (aetherSignal.confidence > 0.7) {
        riskLevel = 'low';
      } else {
        riskLevel = 'medium';
      }

      // Determine urgency based on signal strength and regime
      let urgency: 'low' | 'medium' | 'high';
      if (strength >= 0.7 && aetherSignal.regime !== MarketRegime.SIDEWAYS) {
        urgency = 'high';
      } else if (strength > 0.4) {
        urgency = 'medium';
      } else {
        urgency = 'low';
      }

      const standardSignal: StandardSignal = {
        id: this.generateSignalId(SignalSource.AETHER),
        source: SignalSource.AETHER,
        action,
        confidence: aetherSignal.confidence,
        strength,
        symbol,
        price,
        timestamp: aetherSignal.timestamp,
        reason: `Aether signal: ${action} with ${Math.round(aetherSignal.confidence * 100)}% confidence in ${aetherSignal.regime} market`,
        metadata: {
          originalValue: aetherSignal.value,
          regime: aetherSignal.regime,
          components: aetherSignal.components
        },
        riskLevel,
        urgency,
        validUntil: aetherSignal.timestamp + (5 * 60 * 1000) // Valid for 5 minutes
      };

      return {
        success: true,
        signal: standardSignal
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to translate Aether signal', { error: errorMessage });
      
      return {
        success: false,
        error: `Aether signal translation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Translate SMA signal to standard format
   */
  translateSMASignal(
    smaSignal: SMASignalOutput,
    symbol: string,
    price?: number
  ): SignalTranslationResult {
    try {
      logger.info('🔄 Translating SMA signal to standard format', {
        signal: smaSignal.signal,
        confidence: smaSignal.confidence,
        reason: smaSignal.reason
      });

      // Determine action from SMA signal value
      let action: 'buy' | 'sell' | 'hold';
      if (smaSignal.signal > 0.5) {
        action = 'buy';
      } else if (smaSignal.signal < -0.5) {
        action = 'sell';
      } else {
        action = 'hold';
      }

      // Use SMA strength directly
      const strength = Math.abs(smaSignal.strength);

      // Determine risk level based on confidence and signal strength
      let riskLevel: 'low' | 'medium' | 'high';
      if (smaSignal.confidence >= 0.7 && strength >= 0.6) {
        riskLevel = 'low';
      } else if (smaSignal.confidence < 0.4 || strength < 0.3) {
        riskLevel = 'high';
      } else {
        riskLevel = 'medium';
      }

      // Determine urgency based on signal strength
      let urgency: 'low' | 'medium' | 'high';
      if (strength > 0.8) {
        urgency = 'high';
      } else if (strength > 0.5) {
        urgency = 'medium';
      } else {
        urgency = 'low';
      }

      const standardSignal: StandardSignal = {
        id: this.generateSignalId(SignalSource.SMA),
        source: SignalSource.SMA,
        action,
        confidence: smaSignal.confidence,
        strength,
        symbol,
        price: price || smaSignal.lastPrice,
        timestamp: smaSignal.timestamp,
        reason: smaSignal.reason,
        metadata: {
          originalSignal: smaSignal.signal,
          fastMA: smaSignal.fastMA,
          slowMA: smaSignal.slowMA,
          lastPrice: smaSignal.lastPrice,
          ...(smaSignal.metadata || {})
        },
        riskLevel,
        urgency,
        validUntil: smaSignal.timestamp + (3 * 60 * 1000) // Valid for 3 minutes
      };

      return {
        success: true,
        signal: standardSignal
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to translate SMA signal', { error: errorMessage });
      
      return {
        success: false,
        error: `SMA signal translation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Translate Target Reacher strategy result to standard format
   */
  translateStrategyResult(
    strategyResult: StrategyResult,
    symbol: string,
    source: SignalSource = SignalSource.TARGET_REACHER,
    price?: number
  ): SignalTranslationResult {
    try {
      logger.info('🔄 Translating strategy result to standard format', {
        action: strategyResult.action,
        confidence: strategyResult.confidence,
        success: strategyResult.success
      });

      if (!strategyResult.success) {
        return {
          success: false,
          error: `Strategy execution failed: ${strategyResult.error || 'Unknown error'}`
        };
      }

      if (!strategyResult.action || strategyResult.action === 'hold') {
        // For hold signals, create a low-urgency hold signal
        const standardSignal: StandardSignal = {
          id: this.generateSignalId(source),
          source,
          action: 'hold',
          confidence: strategyResult.confidence || 0.5,
          strength: 0.1,
          symbol,
          price,
          timestamp: Date.now(),
          reason: strategyResult.reason || 'Strategy recommends holding position',
          metadata: strategyResult.metadata || {},
          riskLevel: 'low',
          urgency: 'low'
        };

        return {
          success: true,
          signal: standardSignal
        };
      }

      const confidence = strategyResult.confidence || 0.5;
      const strength = confidence; // Use confidence as strength for strategies

      // Determine risk level based on confidence
      let riskLevel: 'low' | 'medium' | 'high';
      if (confidence > 0.8) {
        riskLevel = 'low';
      } else if (confidence < 0.4) {
        riskLevel = 'high';
      } else {
        riskLevel = 'medium';
      }

      // Determine urgency based on confidence and action
      let urgency: 'low' | 'medium' | 'high';
      if (strategyResult.action === 'close' || confidence > 0.8) {
        urgency = 'high';
      } else if (confidence > 0.6) {
        urgency = 'medium';
      } else {
        urgency = 'low';
      }

      const standardSignal: StandardSignal = {
        id: this.generateSignalId(source),
        source,
        action: strategyResult.action,
        confidence,
        strength,
        symbol,
        price,
        timestamp: Date.now(),
        reason: strategyResult.reason || `Strategy signal: ${strategyResult.action}`,
        metadata: strategyResult.metadata || {},
        riskLevel,
        urgency,
        validUntil: Date.now() + (2 * 60 * 1000) // Valid for 2 minutes
      };

      return {
        success: true,
        signal: standardSignal
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to translate strategy result', { error: errorMessage });
      
      return {
        success: false,
        error: `Strategy result translation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Validate and sanitize a standard signal
   */
  validateSignal(signal: StandardSignal): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!signal.id) {errors.push('Signal ID is required');}
    if (!signal.source) {errors.push('Signal source is required');}
    if (!signal.action) {errors.push('Signal action is required');}
    if (!signal.symbol) {errors.push('Symbol is required');}
    if (!signal.timestamp) {errors.push('Timestamp is required');}

    // Validate ranges
    if (signal.confidence < 0 || signal.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }
    if (signal.strength < 0 || signal.strength > 1) {
      errors.push('Strength must be between 0 and 1');
    }

    // Validate enums
    const validActions = ['buy', 'sell', 'hold', 'close'];
    if (!validActions.includes(signal.action)) {
      errors.push(`Action must be one of: ${validActions.join(', ')}`);
    }

    const validRiskLevels = ['low', 'medium', 'high'];
    if (!validRiskLevels.includes(signal.riskLevel)) {
      errors.push(`Risk level must be one of: ${validRiskLevels.join(', ')}`);
    }

    const validUrgencyLevels = ['low', 'medium', 'high'];
    if (!validUrgencyLevels.includes(signal.urgency)) {
      errors.push(`Urgency must be one of: ${validUrgencyLevels.join(', ')}`);
    }

    // Check expiration
    if (signal.validUntil && signal.validUntil <= Date.now()) {
      errors.push('Signal has expired');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Batch translate multiple signals
   */
  async translateBatch(
    signals: Array<{
      type: 'aether' | 'sma' | 'strategy';
      data: AetherSignalOutput | SMASignalOutput | StrategyResult;
      symbol: string;
      price?: number;
      source?: SignalSource;
    }>
  ): Promise<{
    successful: StandardSignal[];
    failed: Array<{ error: string; originalData: any }>;
  }> {
    const successful: StandardSignal[] = [];
    const failed: Array<{ error: string; originalData: any }> = [];

    for (const signalInput of signals) {
      try {
        let result: SignalTranslationResult;

        switch (signalInput.type) {
          case 'aether':
            result = this.translateAetherSignal(
              signalInput.data as AetherSignalOutput,
              signalInput.symbol,
              signalInput.price
            );
            break;
          
          case 'sma':
            result = this.translateSMASignal(
              signalInput.data as SMASignalOutput,
              signalInput.symbol,
              signalInput.price
            );
            break;
          
          case 'strategy':
            result = this.translateStrategyResult(
              signalInput.data as StrategyResult,
              signalInput.symbol,
              signalInput.source || SignalSource.STRATEGY,
              signalInput.price
            );
            break;
          
          default:
            failed.push({
              error: `Unsupported signal type: ${signalInput.type}`,
              originalData: signalInput.data
            });
            continue;
        }

        if (result.success && result.signal) {
          const validation = this.validateSignal(result.signal);
          if (validation.valid) {
            successful.push(result.signal);
          } else {
            failed.push({
              error: `Signal validation failed: ${validation.errors.join(', ')}`,
              originalData: signalInput.data
            });
          }
        } else {
          failed.push({
            error: result.error || 'Translation failed',
            originalData: signalInput.data
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({
          error: `Batch translation error: ${errorMessage}`,
          originalData: signalInput.data
        });
      }
    }

    logger.info('📊 Signal batch translation completed', {
      successful: successful.length,
      failed: failed.length,
      total: signals.length
    });

    return { successful, failed };
  }
}

/**
 * Default signal translator instance
 */
export const signalTranslator = new SignalTranslator();
