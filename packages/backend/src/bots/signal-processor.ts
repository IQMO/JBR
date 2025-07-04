/**
 * Signal Processor - Comprehensive Signal Processing Pipeline
 * 
 * Handles the complete signal processing workflow:
 * - Strategy result validation and conversion
 * - Signal enrichment with market data
 * - Risk management validation
 * - Trade signal preparation
 * - Error handling and logging
 */

import { EventEmitter } from 'events';

import type { StrategyResult, TradeSignal, StrategyContext } from '../JabbrLabs/target-reacher/interfaces';

import type { Bot } from './bots.service';

export interface SignalProcessingConfig {
  enableRiskValidation: boolean;
  enableSignalEnrichment: boolean;
  minConfidenceThreshold: number;
  maxSignalsPerMinute: number;
  signalTimeoutMs: number;
}

export interface ProcessedSignal {
  original: StrategyResult;
  tradeSignal: TradeSignal;
  riskAssessment: RiskAssessment;
  marketContext: MarketContext;
  processingMetadata: ProcessingMetadata;
}

export interface RiskAssessment {
  approved: boolean;
  riskScore: number;
  warnings: string[];
  rejectionReason?: string;
  recommendedPositionSize?: number;
}

export interface MarketContext {
  currentPrice: number;
  spread: number;
  volume: number;
  volatility: number;
  marketHours: boolean;
  liquidityScore: number;
}

export interface ProcessingMetadata {
  processedAt: Date;
  processingTimeMs: number;
  signalId: string;
  validationsPassed: string[];
  validationsFailed: string[];
}

export class SignalProcessor extends EventEmitter {
  private config: SignalProcessingConfig;
  private signalHistory: Map<string, Date[]> = new Map();
  private processingStats = {
    totalProcessed: 0,
    approved: 0,
    rejected: 0,
    errors: 0
  };

  constructor(config?: Partial<SignalProcessingConfig>) {
    super();
    
    this.config = {
      enableRiskValidation: true,
      enableSignalEnrichment: true,
      minConfidenceThreshold: 0.6,
      maxSignalsPerMinute: 10,
      signalTimeoutMs: 5000,
      ...config
    };

    // Clean up old signal history every minute
    setInterval(() => this.cleanupSignalHistory(), 60000);
  }

  /**
   * Process a strategy result into a validated trade signal
   */
  async processSignal(
    strategyResult: StrategyResult,
    bot: Bot,
    context: StrategyContext
  ): Promise<ProcessedSignal | null> {
    const startTime = Date.now();
    const signalId = this.generateSignalId(bot.id);

    try {
      console.log('🔄 Processing strategy signal', {
        botId: bot.id,
        signalId,
        action: strategyResult.action,
        confidence: strategyResult.confidence
      });

      this.processingStats.totalProcessed++;

      // Step 1: Basic validation
      const basicValidation = this.validateBasicSignal(strategyResult, bot);
      if (!basicValidation.valid) {
        console.warn('⚠️ Basic signal validation failed', {
          botId: bot.id,
          signalId,
          reason: basicValidation.reason
        });
        this.processingStats.rejected++;
        return null;
      }

      // Step 2: Rate limiting check
      const rateLimitCheck = this.checkRateLimit(bot.id);
      if (!rateLimitCheck.allowed) {
        console.warn('⚠️ Signal rate limit exceeded', {
          botId: bot.id,
          signalId,
          reason: rateLimitCheck.reason
        });
        this.processingStats.rejected++;
        return null;
      }

      // Step 3: Convert to trade signal
      const tradeSignal = await this.convertToTradeSignal(strategyResult, bot, context);

      // Step 4: Enrich with market context
      let marketContext: MarketContext | null = null;
      if (this.config.enableSignalEnrichment) {
        marketContext = await this.enrichWithMarketData(tradeSignal, context);
      }

      // Step 5: Risk assessment
      let riskAssessment: RiskAssessment | null = null;
      if (this.config.enableRiskValidation) {
        riskAssessment = await this.assessRisk(tradeSignal, bot, marketContext);
        
        if (!riskAssessment.approved) {
          console.warn('⚠️ Signal rejected by risk assessment', {
            botId: bot.id,
            signalId,
            reason: riskAssessment.rejectionReason,
            warnings: riskAssessment.warnings
          });
          this.processingStats.rejected++;
          return null;
        }
      }

      // Step 6: Record signal for rate limiting
      this.recordSignal(bot.id);

      const processingTime = Date.now() - startTime;
      const processedSignal: ProcessedSignal = {
        original: strategyResult,
        tradeSignal,
        riskAssessment: riskAssessment || {
          approved: true,
          riskScore: 0.5,
          warnings: []
        },
        marketContext: marketContext || {
          currentPrice: tradeSignal.price,
          spread: 0,
          volume: 0,
          volatility: 0,
          marketHours: true,
          liquidityScore: 1
        },
        processingMetadata: {
          processedAt: new Date(),
          processingTimeMs: processingTime,
          signalId,
          validationsPassed: ['basic', 'rate-limit'],
          validationsFailed: []
        }
      };

      this.processingStats.approved++;

      console.log('✅ Signal processed successfully', {
        botId: bot.id,
        signalId,
        processingTimeMs: processingTime,
        riskScore: riskAssessment?.riskScore
      });

      this.emit('signal-processed', {
        botId: bot.id,
        signalId,
        approved: true,
        processingTime
      });

      return processedSignal;

    } catch (error) {
      this.processingStats.errors++;
      
      console.error('❌ Error processing signal', {
        botId: bot.id,
        signalId,
        error: error instanceof Error ? error.message : String(error)
      });

      this.emit('signal-error', {
        botId: bot.id,
        signalId,
        error: error instanceof Error ? error.message : String(error)
      });

      return null;
    }
  }

  /**
   * Basic signal validation
   */
  private validateBasicSignal(
    result: StrategyResult,
    bot: Bot
  ): { valid: boolean; reason?: string } {
    // Check if result is successful
    if (!result.success) {
      return { valid: false, reason: `Strategy execution failed: ${result.error}` };
    }

    // Check if action is valid
    if (!result.action || result.action === 'hold') {
      return { valid: false, reason: 'No actionable signal (hold or undefined)' };
    }

    // Check confidence threshold
    const confidence = result.confidence || 0;
    if (confidence < this.config.minConfidenceThreshold) {
      return { 
        valid: false, 
        reason: `Confidence ${confidence} below threshold ${this.config.minConfidenceThreshold}` 
      };
    }

    // Check bot configuration
    if (!bot.configuration) {
      return { valid: false, reason: 'Bot configuration missing' };
    }

    return { valid: true };
  }

  /**
   * Check rate limiting for signals
   */
  private checkRateLimit(botId: string): { allowed: boolean; reason?: string } {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    const recentSignals = this.signalHistory.get(botId) || [];
    const signalsInLastMinute = recentSignals.filter(time => time > oneMinuteAgo);

    if (signalsInLastMinute.length >= this.config.maxSignalsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${signalsInLastMinute.length}/${this.config.maxSignalsPerMinute} signals in last minute`
      };
    }

    return { allowed: true };
  }

  /**
   * Convert strategy result to trade signal
   */
  private async convertToTradeSignal(
    result: StrategyResult,
    bot: Bot,
    context: StrategyContext
  ): Promise<TradeSignal> {
    // Get current market price
    const currentPrice = await context.marketData.getCurrentPrice(context.symbol);

    const tradeSignal: TradeSignal = {
      id: this.generateSignalId(bot.id),
      botId: bot.id,
      symbol: context.symbol,
      side: result.action === 'buy' ? 'buy' : 'sell',
      confidence: result.confidence || 0.5,
      price: currentPrice,
      timestamp: Date.now(),
      reason: result.reason || 'Strategy generated signal'
    };

    return tradeSignal;
  }

  /**
   * Enrich signal with market data
   */
  private async enrichWithMarketData(
    signal: TradeSignal,
    context: StrategyContext
  ): Promise<MarketContext> {
    try {
      const [ticker, orderBook] = await Promise.all([
        context.marketData.getTicker(signal.symbol),
        context.marketData.getOrderBook(signal.symbol, 10)
      ]);

      const spread = ticker.ask - ticker.bid;
      const spreadPercent = (spread / ticker.last) * 100;

      return {
        currentPrice: ticker.last,
        spread: spreadPercent,
        volume: ticker.volume,
        volatility: this.calculateVolatility(ticker),
        marketHours: this.isMarketHours(),
        liquidityScore: this.calculateLiquidityScore(orderBook)
      };
    } catch (error) {
      console.warn('⚠️ Failed to enrich signal with market data', {
        signalId: signal.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        currentPrice: signal.price,
        spread: 0,
        volume: 0,
        volatility: 0,
        marketHours: true,
        liquidityScore: 1
      };
    }
  }

  /**
   * Assess risk for the signal
   */
  private async assessRisk(
    signal: TradeSignal,
    bot: Bot,
    marketContext: MarketContext | null
  ): Promise<RiskAssessment> {
    const warnings: string[] = [];
    let riskScore = 0;

    // Base risk from confidence (lower confidence = higher risk)
    riskScore += (1 - signal.confidence) * 0.3;

    // Market context risks
    if (marketContext) {
      // High spread risk
      if (marketContext.spread > 0.1) { // 0.1%
        riskScore += 0.2;
        warnings.push(`High spread: ${marketContext.spread.toFixed(3)}%`);
      }

      // Low liquidity risk
      if (marketContext.liquidityScore < 0.5) {
        riskScore += 0.15;
        warnings.push(`Low liquidity score: ${marketContext.liquidityScore}`);
      }

      // High volatility risk
      if (marketContext.volatility > 0.05) { // 5%
        riskScore += 0.25;
        warnings.push(`High volatility: ${marketContext.volatility.toFixed(3)}%`);
      }

      // After hours trading risk
      if (!marketContext.marketHours) {
        riskScore += 0.1;
        warnings.push('Trading outside market hours');
      }
    }

    // Bot-specific risk management
    const riskConfig = bot.riskManagement;
    if (riskConfig) {
      // Check position size limits
      const recommendedSize = this.calculatePositionSize(signal, riskConfig, marketContext);
      
      if (recommendedSize <= 0) {
        return {
          approved: false,
          riskScore: 1,
          warnings,
          rejectionReason: 'Position size calculation resulted in zero or negative size'
        };
      }
    }

    // Risk approval logic
    const maxAllowedRisk = 0.7;
    const approved = riskScore <= maxAllowedRisk;

    return {
      approved,
      riskScore,
      warnings,
      rejectionReason: approved ? undefined : `Risk score ${riskScore.toFixed(3)} exceeds maximum ${maxAllowedRisk}`,
      recommendedPositionSize: this.calculatePositionSize(signal, riskConfig, marketContext)
    };
  }

  /**
   * Calculate recommended position size
   */
  private calculatePositionSize(
    signal: TradeSignal,
    riskConfig?: any,
    marketContext?: MarketContext | null
  ): number {
    // Default position size
    let baseSize = 100; // Default $100

    // Apply risk management rules
    if (riskConfig?.maxPositionSize) {
      baseSize = Math.min(baseSize, riskConfig.maxPositionSize);
    }

    // Adjust for confidence
    const confidenceMultiplier = signal.confidence;
    baseSize *= confidenceMultiplier;

    // Adjust for market conditions
    if (marketContext) {
      // Reduce size for high volatility
      if (marketContext.volatility > 0.03) {
        baseSize *= 0.7;
      }

      // Reduce size for low liquidity
      if (marketContext.liquidityScore < 0.7) {
        baseSize *= marketContext.liquidityScore;
      }
    }

    return Math.max(1, Math.floor(baseSize));
  }

  /**
   * Helper methods
   */
  private generateSignalId(botId: string): string {
    return `${botId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordSignal(botId: string): void {
    const signals = this.signalHistory.get(botId) || [];
    signals.push(new Date());
    this.signalHistory.set(botId, signals);
  }

  private cleanupSignalHistory(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
    
    for (const [botId, signals] of this.signalHistory.entries()) {
      const recentSignals = signals.filter(time => time > fiveMinutesAgo);
      this.signalHistory.set(botId, recentSignals);
    }
  }

  private calculateVolatility(ticker: any): number {
    // Simple volatility estimation based on spread
    const spread = ticker.ask - ticker.bid;
    return (spread / ticker.last) * 100;
  }

  private isMarketHours(): boolean {
    // Simple check - in a real implementation, this would check actual market hours
    const hour = new Date().getHours();
    return hour >= 9 && hour <= 16; // 9 AM to 4 PM
  }

  private calculateLiquidityScore(orderBook: any): number {
    // Calculate liquidity based on order book depth
    const bidDepth = orderBook.bids.reduce((sum: number, bid: [number, number]) => sum + (bid.at(1) ?? 0), 0);
    const askDepth = orderBook.asks.reduce((sum: number, ask: [number, number]) => sum + (ask.at(1) ?? 0), 0);
    
    const totalDepth = bidDepth + askDepth;
    
    // Normalize to 0-1 scale (assuming 1000+ total volume is good liquidity)
    return Math.min(totalDepth / 1000, 1);
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return { ...this.processingStats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.processingStats = {
      totalProcessed: 0,
      approved: 0,
      rejected: 0,
      errors: 0
    };
  }
} 