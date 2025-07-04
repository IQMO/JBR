/**
 * Signal Processing Manager
 * 
 * Coordinates signal processing from multiple sources and feeds standardized
 * signals to the trading engine.
 */

import { EventEmitter } from 'events';

import logger from '../../services/logging.service';
import type { SignalOutput as AetherSignalOutput } from '../signals/aether/models';
import { SMASignalOutput } from '../signals/sma/models';
import type { SMASignalProcessor } from '../signals/sma/sma-signal-processor';
import type { StrategyResult } from '../target-reacher/interfaces';

import type { StandardSignal} from './signal-translator';
import { SignalTranslator, SignalSource, SignalTranslationResult } from './signal-translator';


/**
 * Generic signal source interface for event emission
 */
interface SignalEmitter extends EventEmitter {
  // Common interface for signal sources
}

/**
 * Aether Signal Generator interface (placeholder until implementation)
 */
interface IAetherSignalGenerator extends SignalEmitter {
  generateSignal(symbol: string): Promise<AetherSignalOutput>;
}

/**
 * Target Reacher Service interface (placeholder until implementation)
 */
interface ITargetReacherService extends SignalEmitter {
  executeStrategy(strategyId: string, context: any): Promise<StrategyResult>;
}

/**
 * Trading Engine interface for processing signals
 */
interface ITradingEngine {
  processAdvancedSignals(signals: StandardSignal[]): Promise<void>;
}

/**
 * Signal processing configuration
 */
export interface SignalProcessingConfig {
  // Source configurations
  aetherEnabled: boolean;
  smaEnabled: boolean;
  targetReacherEnabled: boolean;
  
  // Processing options
  batchSize: number;
  maxSignalsPerMinute: number;
  signalExpirationMs: number;
  
  // Quality filters
  minConfidence: number;
  minStrength: number;
  
  // Risk management
  maxHighRiskSignals: number;
  riskTimeout: number;
}

/**
 * Signal processing statistics
 */
export interface SignalProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  filtered: number;
  
  // By source
  aetherSignals: number;
  smaSignals: number;
  strategySignals: number;
  
  // By action
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  closeSignals: number;
  
  // Quality metrics
  averageConfidence: number;
  averageStrength: number;
  
  // Performance
  processingTimeMs: number;
  lastProcessed: number;
}

/**
 * Signal queue item
 */
interface QueuedSignal {
  id: string;
  signal: StandardSignal;
  addedAt: number;
  priority: number;
}

/**
 * Signal Processing Manager Class
 */
export class SignalProcessingManager extends EventEmitter {
  private signalTranslator: SignalTranslator;
  private config: SignalProcessingConfig;
  private stats: SignalProcessingStats;
  
  // Signal sources
  private aetherGenerator?: IAetherSignalGenerator;
  private smaProcessor?: SMASignalProcessor;
  private targetReacher?: ITargetReacherService;
  private tradingEngine?: ITradingEngine;
  
  // Processing state
  private signalQueue: QueuedSignal[] = [];
  private processingInterval?: NodeJS.Timeout;
  private highRiskSignalCount = 0;
  private lastRiskReset = Date.now();
  
  constructor(config: Partial<SignalProcessingConfig> = {}) {
    super();
    
    this.signalTranslator = new SignalTranslator();
    this.config = {
      aetherEnabled: true,
      smaEnabled: true,
      targetReacherEnabled: true,
      batchSize: 10,
      maxSignalsPerMinute: 60,
      signalExpirationMs: 5 * 60 * 1000, // 5 minutes
      minConfidence: 0.2,
      minStrength: 0.1,
      maxHighRiskSignals: 5,
      riskTimeout: 60 * 1000, // 1 minute
      ...config
    };
    
    this.stats = this.initializeStats();
    
    logger.info('🎯 Signal Processing Manager initialized', {
      config: this.config
    });
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): SignalProcessingStats {
    return {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      filtered: 0,
      aetherSignals: 0,
      smaSignals: 0,
      strategySignals: 0,
      buySignals: 0,
      sellSignals: 0,
      holdSignals: 0,
      closeSignals: 0,
      averageConfidence: 0,
      averageStrength: 0,
      processingTimeMs: 0,
      lastProcessed: 0
    };
  }

  /**
   * Initialize signal sources
   */
  async initialize(options: {
    aetherGenerator?: IAetherSignalGenerator;
    smaProcessor?: SMASignalProcessor;
    targetReacher?: ITargetReacherService;
    tradingEngine?: ITradingEngine;
  }): Promise<void> {
    try {
      logger.info('🚀 Initializing Signal Processing Manager...');

      // Set up signal sources
      if (options.aetherGenerator && this.config.aetherEnabled) {
        this.aetherGenerator = options.aetherGenerator;
        this.setupAetherListeners();
        logger.info('✅ Aether Signal Generator connected');
      }

      if (options.smaProcessor && this.config.smaEnabled) {
        this.smaProcessor = options.smaProcessor;
        this.setupSMAListeners();
        logger.info('✅ SMA Signal Processor connected');
      }

      if (options.targetReacher && this.config.targetReacherEnabled) {
        this.targetReacher = options.targetReacher;
        this.setupTargetReacherListeners();
        logger.info('✅ Target Reacher Service connected');
      }

      if (options.tradingEngine) {
        this.tradingEngine = options.tradingEngine;
        logger.info('✅ Trading Engine connected');
      }

      // Start processing
      this.startProcessing();
      
      this.emit('initialized', {
        sources: {
          aether: !!this.aetherGenerator,
          sma: !!this.smaProcessor,
          targetReacher: !!this.targetReacher
        },
        tradingEngine: !!this.tradingEngine
      });

      logger.info('🎯 Signal Processing Manager fully initialized');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to initialize Signal Processing Manager', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Set up Aether signal listeners
   */
  private setupAetherListeners(): void {
    if (!this.aetherGenerator) {return;}

    this.aetherGenerator.on('signal', (signal: AetherSignalOutput, marketData: any) => {
      logger.debug('📡 Received Aether signal', { 
        value: signal.value, 
        confidence: signal.confidence,
        symbol: marketData?.symbol || 'unknown'
      });

      const result = this.signalTranslator.translateAetherSignal(
        signal,
        marketData?.symbol || 'UNKNOWN',
        marketData?.price
      );

      if (result.success && result.signal) {
        this.queueSignal(result.signal, 2); // Medium priority
        this.stats.aetherSignals++;
      } else {
        logger.warn('⚠️ Failed to translate Aether signal', { error: result.error });
        this.stats.failed++;
      }
    });

    this.aetherGenerator.on('error', (error: any) => {
      logger.error('❌ Aether Signal Generator error', { error });
      this.emit('source-error', { source: 'aether', error });
    });
  }

  /**
   * Set up SMA signal listeners (manual polling since SMASignalProcessor doesn't extend EventEmitter)
   */
  private setupSMAListeners(): void {
    if (!this.smaProcessor) {return;}

    // Since SMASignalProcessor doesn't emit events, we'll need to implement polling or modify it
    // For now, we'll create a simple wrapper that can be called manually
    logger.info('✅ SMA Signal Processor connected (manual processing mode)');
  }

  /**
   * Manually process SMA signals
   */
  async processSMASignals(candles: any[], symbol: string): Promise<void> {
    if (!this.smaProcessor) {return;}

    try {
      const signal = this.smaProcessor.process(candles);
      if (signal) {
        logger.debug('📊 Generated SMA signal', { 
          signal: signal.signal, 
          confidence: signal.confidence,
          symbol 
        });

        const result = this.signalTranslator.translateSMASignal(signal, symbol);

        if (result.success && result.signal) {
          this.queueSignal(result.signal, 2); // Medium priority
          this.stats.smaSignals++;
        } else {
          logger.warn('⚠️ Failed to translate SMA signal', { error: result.error });
          this.stats.failed++;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ SMA Signal Processor error', { error: errorMessage });
      this.emit('source-error', { source: 'sma', error: errorMessage });
    }
  }

  /**
   * Set up Target Reacher listeners
   */
  private setupTargetReacherListeners(): void {
    if (!this.targetReacher) {return;}

    this.targetReacher.on('strategy-result', (result: StrategyResult, context: any) => {
      logger.debug('🎯 Received Target Reacher signal', { 
        action: result.action, 
        confidence: result.confidence,
        symbol: context?.symbol || 'unknown' 
      });

      const result2 = this.signalTranslator.translateStrategyResult(
        result,
        context?.symbol || 'UNKNOWN',
        SignalSource.TARGET_REACHER
      );

      if (result2.success && result2.signal) {
        this.queueSignal(result2.signal, 3); // High priority for strategy results
        this.stats.strategySignals++;
      } else {
        logger.warn('⚠️ Failed to translate strategy result', { error: result2.error });
        this.stats.failed++;
      }
    });

    this.targetReacher.on('error', (error: any) => {
      logger.error('❌ Target Reacher Service error', { error });
      this.emit('source-error', { source: 'target-reacher', error });
    });
  }

  /**
   * Queue a signal for processing
   */
  private queueSignal(signal: StandardSignal, priority = 1): void {
    // Check if signal passes quality filters
    if (!this.passesQualityFilter(signal)) {
      logger.debug('🔍 Signal filtered out', { 
        id: signal.id, 
        confidence: signal.confidence, 
        strength: signal.strength 
      });
      this.stats.filtered++;
      return;
    }

    // Check risk limits
    if (!this.passesRiskFilter(signal)) {
      logger.warn('⚠️ Signal blocked by risk filter', { 
        id: signal.id, 
        riskLevel: signal.riskLevel 
      });
      this.stats.filtered++;
      return;
    }

    const queuedSignal: QueuedSignal = {
      id: signal.id,
      signal,
      addedAt: Date.now(),
      priority
    };

    this.signalQueue.push(queuedSignal);
    
    // Sort by priority (higher first) then by timestamp (older first)
    this.signalQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.addedAt - b.addedAt;
    });

    logger.debug('📝 Signal queued', { 
      id: signal.id, 
      priority, 
      queueSize: this.signalQueue.length 
    });

    this.emit('signal-queued', { signal, priority, queueSize: this.signalQueue.length });
  }

  /**
   * Check if signal passes quality filters
   */
  private passesQualityFilter(signal: StandardSignal): boolean {
    return signal.confidence >= this.config.minConfidence && 
           signal.strength >= this.config.minStrength;
  }

  /**
   * Check if signal passes risk filters
   */
  private passesRiskFilter(signal: StandardSignal): boolean {
    // Reset high risk counter if timeout passed
    if (Date.now() - this.lastRiskReset > this.config.riskTimeout) {
      this.highRiskSignalCount = 0;
      this.lastRiskReset = Date.now();
    }

    // Check high risk signal limit
    if (signal.riskLevel === 'high') {
      if (this.highRiskSignalCount >= this.config.maxHighRiskSignals) {
        return false;
      }
      this.highRiskSignalCount++;
    }

    return true;
  }

  /**
   * Start signal processing
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process signals every second
    this.processingInterval = setInterval(() => {
      this.processSignalQueue();
    }, 1000);

    logger.info('🔄 Signal processing started');
  }

  /**
   * Process queued signals
   */
  private async processSignalQueue(): Promise<void> {
    if (this.signalQueue.length === 0 || !this.tradingEngine) {
      return;
    }

    const startTime = Date.now();
    const batchSize = Math.min(this.config.batchSize, this.signalQueue.length);
    const batch = this.signalQueue.splice(0, batchSize);

    try {
      logger.debug('⚡ Processing signal batch', { size: batch.length });

      for (const queuedSignal of batch) {
        await this.processSignal(queuedSignal.signal);
      }

      this.stats.processingTimeMs = Date.now() - startTime;
      this.stats.lastProcessed = Date.now();

      this.emit('batch-processed', {
        processed: batch.length,
        remaining: this.signalQueue.length,
        processingTime: this.stats.processingTimeMs
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Signal batch processing failed', { error: errorMessage });
      
      this.emit('processing-error', { error: errorMessage, batchSize });
    }
  }

  /**
   * Process individual signal
   */
  private async processSignal(signal: StandardSignal): Promise<void> {
    try {
      // Check if signal has expired
      if (signal.validUntil && signal.validUntil <= Date.now()) {
        logger.debug('⏰ Signal expired, skipping', { id: signal.id });
        this.stats.failed++;
        this.emit('signal-error', { signal, error: 'Signal processing failed: signal expired' });
        return;
      }

      // Validate signal before processing
      const validation = this.signalTranslator.validateSignal(signal);
      if (!validation.valid) {
        logger.warn('⚠️ Invalid signal skipped', { 
          id: signal.id, 
          errors: validation.errors 
        });
        this.stats.failed++;
        this.emit('signal-error', { signal, error: `Validation failed: ${validation.errors?.join(', ')}` });
        return;
      }

      logger.info('🎯 Processing signal', {
        id: signal.id,
        source: signal.source,
        action: signal.action,
        confidence: signal.confidence,
        symbol: signal.symbol
      });

      // Send to trading engine
      if (this.tradingEngine) {
        await this.tradingEngine.processAdvancedSignals([signal]);
        logger.debug('✅ Signal sent to trading engine', { id: signal.id });
      }

      // Update statistics
      this.updateStats(signal);
      this.stats.successful++;

      this.emit('signal-processed', { signal });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to process signal', { 
        id: signal.id, 
        error: errorMessage 
      });
      
      this.stats.failed++;
      this.emit('signal-error', { signal, error: errorMessage });
    }
  }

  /**
   * Update processing statistics
   */
  private updateStats(signal: StandardSignal): void {
    this.stats.totalProcessed++;

    // Update action counts
    switch (signal.action) {
      case 'buy':
        this.stats.buySignals++;
        break;
      case 'sell':
        this.stats.sellSignals++;
        break;
      case 'hold':
        this.stats.holdSignals++;
        break;
      case 'close':
        this.stats.closeSignals++;
        break;
    }

    // Update averages
    const total = this.stats.successful + 1;
    this.stats.averageConfidence = 
      (this.stats.averageConfidence * this.stats.successful + signal.confidence) / total;
    this.stats.averageStrength = 
      (this.stats.averageStrength * this.stats.successful + signal.strength) / total;
  }

  /**
   * Get current statistics
   */
  getStats(): SignalProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    size: number;
    oldestSignalAge: number;
    priorityDistribution: Record<number, number>;
  } {
    const priorityDistribution: Record<number, number> = {};
    let oldestSignalAge = 0;

    for (const queuedSignal of this.signalQueue) {
      priorityDistribution[queuedSignal.priority] = 
        (priorityDistribution[queuedSignal.priority] || 0) + 1;
      
      const age = Date.now() - queuedSignal.addedAt;
      if (age > oldestSignalAge) {
        oldestSignalAge = age;
      }
    }

    return {
      size: this.signalQueue.length,
      oldestSignalAge,
      priorityDistribution
    };
  }

  /**
   * Manually add signal to processing queue
   */
  addSignal(signal: StandardSignal, priority = 1): void {
    logger.info('➕ Manually adding signal to queue', { 
      id: signal.id, 
      source: signal.source,
      priority 
    });
    
    this.queueSignal(signal, priority);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SignalProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('⚙️ Signal processing configuration updated', { 
      config: this.config 
    });
    
    this.emit('config-updated', this.config);
  }

  /**
   * Clear signal queue
   */
  clearQueue(): void {
    const clearedCount = this.signalQueue.length;
    this.signalQueue = [];
    
    logger.info('🗑️ Signal queue cleared', { clearedCount });
    this.emit('queue-cleared', { clearedCount });
  }

  /**
   * Stop signal processing
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    this.clearQueue();
    
    logger.info('⏹️ Signal Processing Manager stopped');
    this.emit('stopped');
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    uptime: number;
    lastActivity: number;
  } {
    const issues: string[] = [];
    const now = Date.now();

    // Check if we have any primary signal sources (aether and target reacher)
    // SMA processor is a supporting component, not a primary signal source
    if (!this.aetherGenerator && !this.targetReacher) {
      issues.push('No signal sources connected');
    }

    // Check if trading engine is connected
    if (!this.tradingEngine) {
      issues.push('Trading engine not connected');
    }

    // Check if processing is stuck
    if (this.stats.lastProcessed > 0 && now - this.stats.lastProcessed > 60000) {
      issues.push('No signals processed in last minute');
    }

    // Check queue size
    if (this.signalQueue.length > this.config.batchSize * 5) {
      issues.push('Signal queue growing too large');
    }

    return {
      healthy: issues.length === 0,
      issues,
      uptime: now - this.lastRiskReset,
      lastActivity: this.stats.lastProcessed
    };
  }
}

/**
 * Default signal processing manager instance
 */
export const signalProcessingManager = new SignalProcessingManager();
