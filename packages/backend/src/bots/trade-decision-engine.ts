/**
 * Trade Decision Engine - Comprehensive Trade Execution System
 * 
 * Handles the complete trade execution workflow:
 * - Trade signal validation and enrichment
 * - Order creation and execution
 * - Position management and tracking
 * - Risk management enforcement
 * - Stop-loss and take-profit management
 * - Order lifecycle management
 */

import { EventEmitter } from 'events';

import type { TradeSignal, TradeOrder, Position, StrategyContext } from '../JabbrLabs/target-reacher/interfaces';

import type { Bot } from './bots.service';
import type { ProcessedSignal } from './signal-processor';
import type { TradeExecutor, ExecutionRequest} from './trade-executor';
import { ExecutionResponse } from './trade-executor';

export interface TradeDecisionConfig {
  enablePositionManagement: boolean;
  enableStopLoss: boolean;
  enableTakeProfit: boolean;
  maxPositionsPerBot: number;
  orderTimeoutMs: number;
  retryAttempts: number;
  slippageTolerance: number; // percentage
}

export interface TradeDecision {
  approved: boolean;
  action: 'execute' | 'reject' | 'defer';
  reason: string;
  modifiedSignal?: TradeSignal;
  riskAdjustments?: RiskAdjustments;
  estimatedCost?: number;
}

export interface RiskAdjustments {
  adjustedPositionSize?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  maxSlippage?: number;
}

export interface ExecutionResult {
  success: boolean;
  order?: TradeOrder;
  position?: Position;
  error?: string;
  warnings?: string[];
  executionTime: number;
}

export interface PositionUpdate {
  positionId: string;
  botId: string;
  symbol: string;
  status: 'opening' | 'open' | 'closing' | 'closed' | 'failed';
  currentPrice: number;
  unrealizedPnl: number;
  stopLossTriggered?: boolean;
  takeProfitTriggered?: boolean;
}

export class TradeDecisionEngine extends EventEmitter {
  private config: TradeDecisionConfig;
  private activePositions: Map<string, Position> = new Map();
  private pendingOrders: Map<string, TradeOrder> = new Map();
  private tradeExecutor?: TradeExecutor;
  private executionStats = {
    totalDecisions: 0,
    approved: 0,
    rejected: 0,
    executed: 0,
    failed: 0
  };

  constructor(config?: Partial<TradeDecisionConfig>, tradeExecutor?: TradeExecutor) {
    super();
    
    this.config = {
      enablePositionManagement: true,
      enableStopLoss: true,
      enableTakeProfit: true,
      maxPositionsPerBot: 3,
      orderTimeoutMs: 30000,
      retryAttempts: 3,
      slippageTolerance: 0.1, // 0.1%
      ...config
    };

    this.tradeExecutor = tradeExecutor;

    // Set up periodic position monitoring
    setInterval(() => this.monitorPositions(), 10000); // Every 10 seconds
  }

  /**
   * Set trade executor
   */
  setTradeExecutor(tradeExecutor: TradeExecutor): void {
    this.tradeExecutor = tradeExecutor;
  }

  /**
   * Make a trade decision based on processed signal
   */
  async makeTradeDecision(
    processedSignal: ProcessedSignal,
    bot: Bot,
    context: StrategyContext
  ): Promise<TradeDecision> {
    try {
      console.log('🎯 Making trade decision', {
        botId: bot.id,
        signalId: processedSignal.processingMetadata.signalId,
        action: processedSignal.tradeSignal.side,
        confidence: processedSignal.tradeSignal.confidence
      });

      this.executionStats.totalDecisions++;

      // Step 1: Check position limits
      const positionCheck = await this.checkPositionLimits(bot.id, processedSignal.tradeSignal);
      if (!positionCheck.allowed) {
        this.executionStats.rejected++;
        return {
          approved: false,
          action: 'reject',
          reason: positionCheck.reason || 'Position limit check failed'
        };
      }

      // Step 2: Validate market conditions
      const marketValidation = await this.validateMarketConditions(
        processedSignal.tradeSignal,
        processedSignal.marketContext,
        context
      );
      if (!marketValidation.valid) {
        this.executionStats.rejected++;
        return {
          approved: false,
          action: 'reject',
          reason: marketValidation.reason || 'Market conditions unfavorable'
        };
      }

      // Step 3: Calculate risk adjustments
      const riskAdjustments = await this.calculateRiskAdjustments(
        processedSignal,
        bot,
        context
      );

      // Step 4: Estimate execution cost
      const estimatedCost = await this.estimateExecutionCost(
        processedSignal.tradeSignal,
        riskAdjustments,
        processedSignal.marketContext
      );

      // Step 5: Final approval logic
      const finalApproval = this.makeFinalDecision(
        processedSignal,
        riskAdjustments,
        estimatedCost,
        bot
      );

      if (finalApproval.approved) {
        this.executionStats.approved++;
        
        console.log('✅ Trade decision approved', {
          botId: bot.id,
          signalId: processedSignal.processingMetadata.signalId,
          estimatedCost,
          riskAdjustments
        });

        return {
          approved: true,
          action: 'execute',
          reason: 'Trade approved by decision engine',
          modifiedSignal: this.applySignalModifications(processedSignal.tradeSignal, riskAdjustments),
          riskAdjustments,
          estimatedCost
        };
      } 
        this.executionStats.rejected++;
        return {
          approved: false,
          action: 'reject',
          reason: finalApproval.reason || 'Final approval failed'
        };
      

    } catch (error) {
      this.executionStats.rejected++;
      
      console.error('❌ Error making trade decision', {
        botId: bot.id,
        signalId: processedSignal.processingMetadata.signalId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        approved: false,
        action: 'reject',
        reason: `Decision engine error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Execute a trade based on approved decision
   */
  async executeTrade(
    decision: TradeDecision,
    processedSignal: ProcessedSignal,
    bot: Bot,
    context: StrategyContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      if (!decision.approved || !decision.modifiedSignal) {
        throw new Error('Cannot execute unapproved trade decision');
      }

      console.log('🚀 Executing trade', {
        botId: bot.id,
        signalId: processedSignal.processingMetadata.signalId,
        signal: decision.modifiedSignal
      });

      // Use real trade executor if available
      if (this.tradeExecutor) {
        // Prepare execution request
        const executionRequest: ExecutionRequest = {
          bot,
          signal: decision.modifiedSignal,
          orderType: 'market', // Default to market order, can be enhanced
          amount: decision.riskAdjustments?.adjustedPositionSize || 100,
          price: decision.modifiedSignal.price,
          leverage: bot.configuration?.leverage
        };

        // Execute on real exchange
        const executionResponse = await this.tradeExecutor.executeTrade(executionRequest);

        if (!executionResponse.success) {
          throw new Error(executionResponse.error || 'Trade execution failed');
        }

        // Create trade order record
        const order: TradeOrder = {
          id: executionResponse.orderId!,
          orderId: executionResponse.exchangeOrderId!,
          botId: bot.id,
          symbol: decision.modifiedSignal.symbol,
          type: 'market',
          side: decision.modifiedSignal.side,
          amount: executionRequest.amount,
          price: executionResponse.executedPrice,
          filled: executionResponse.executedAmount || executionRequest.amount,
          remaining: 0,
          status: 'filled',
          timestamp: executionResponse.timestamp?.getTime() || Date.now(),
          updatedAt: Date.now()
        };

        // Store order in pending orders
        this.pendingOrders.set(order.id, order);

        // Set up position management
        let position: Position | null = null;
        if (this.config.enablePositionManagement) {
          position = await this.createPosition(order, decision, bot);
          if (position) {
            this.activePositions.set(position.symbol, position);
          }
        }

        // Set up stop-loss and take-profit if enabled
        if (position && (this.config.enableStopLoss || this.config.enableTakeProfit)) {
          await this.setupRiskManagementOrders(position, decision, bot, context);
        }

        const executionTime = Date.now() - startTime;
        this.executionStats.executed++;

        console.log('✅ Trade executed successfully', {
          botId: bot.id,
          orderId: order.id,
          executionTime,
          positionCreated: !!position
        });

        this.emit('trade-executed', {
          botId: bot.id,
          order,
          position,
          executionTime
        });

        return {
          success: true,
          order,
          position: position || undefined,
          executionTime
        };

      } 
        // Fallback to mock execution if no trade executor
        console.warn('⚠️ No trade executor configured, using mock execution');
        
        // Mock execution logic (existing code)
        const mockOrderId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const mockPrice = decision.modifiedSignal.price;
        
        const order: TradeOrder = {
          id: mockOrderId,
          orderId: mockOrderId,
          botId: bot.id,
          symbol: decision.modifiedSignal.symbol,
          type: 'market',
          side: decision.modifiedSignal.side,
          amount: decision.riskAdjustments?.adjustedPositionSize || 100,
          price: mockPrice,
          filled: decision.riskAdjustments?.adjustedPositionSize || 100,
          remaining: 0,
          status: 'filled',
          timestamp: Date.now(),
          updatedAt: Date.now()
        };

        this.pendingOrders.set(order.id, order);

        let position: Position | null = null;
        if (this.config.enablePositionManagement) {
          position = await this.createPosition(order, decision, bot);
          if (position) {
            this.activePositions.set(position.symbol, position);
          }
        }

        const executionTime = Date.now() - startTime;
        this.executionStats.executed++;

        console.log('🧪 Mock trade executed', {
          botId: bot.id,
          orderId: order.id,
          executionTime
        });

        return {
          success: true,
          order,
          position: position || undefined,
          executionTime
        };
      

    } catch (error) {
      this.executionStats.failed++;
      const executionTime = Date.now() - startTime;

      console.error('❌ Trade execution failed', {
        botId: bot.id,
        signalId: processedSignal.processingMetadata.signalId,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      this.emit('trade-failed', {
        botId: bot.id,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      };
    }
  }

  /**
   * Check position limits for the bot
   */
  private async checkPositionLimits(
    botId: string,
    signal: TradeSignal
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Count current positions for this bot
    const botPositions = Array.from(this.activePositions.values())
      .filter(pos => pos.symbol.includes(botId)); // Simple check, would be more sophisticated in real implementation

    if (botPositions.length >= this.config.maxPositionsPerBot) {
      return {
        allowed: false,
        reason: `Maximum positions reached: ${botPositions.length}/${this.config.maxPositionsPerBot}`
      };
    }

    // Check if there's already a position for this symbol
    const existingPosition = this.activePositions.get(signal.symbol);
    if (existingPosition) {
      return {
        allowed: false,
        reason: `Position already exists for ${signal.symbol}`
      };
    }

    return { allowed: true };
  }

  /**
   * Validate market conditions for execution
   */
  private async validateMarketConditions(
    signal: TradeSignal,
    marketContext: any,
    _context: StrategyContext
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check if market is open
    if (!marketContext.marketHours) {
      return {
        valid: false,
        reason: 'Market is closed'
      };
    }

    // Check for excessive spread
    if (marketContext.spread > this.config.slippageTolerance) {
      return {
        valid: false,
        reason: `Spread too high: ${marketContext.spread}% > ${this.config.slippageTolerance}%`
      };
    }

    // Check liquidity
    if (marketContext.liquidityScore < 0.3) {
      return {
        valid: false,
        reason: `Low liquidity: ${marketContext.liquidityScore}`
      };
    }

    return { valid: true };
  }

  /**
   * Calculate risk adjustments for the trade
   */
  private async calculateRiskAdjustments(
    processedSignal: ProcessedSignal,
    bot: Bot,
    _context: StrategyContext
  ): Promise<RiskAdjustments> {
    const signal = processedSignal.tradeSignal;
    const riskConfig = bot.riskManagement;
    const adjustments: RiskAdjustments = {};

    // Adjust position size
    adjustments.adjustedPositionSize = processedSignal.riskAssessment.recommendedPositionSize || 100;

    // Calculate stop-loss price
    if (this.config.enableStopLoss && riskConfig?.stopLossPercentage) {
      const stopLossPercent = riskConfig.stopLossPercentage / 100;
      if (signal.side === 'buy') {
        adjustments.stopLossPrice = signal.price * (1 - stopLossPercent);
      } else {
        adjustments.stopLossPrice = signal.price * (1 + stopLossPercent);
      }
    }

    // Calculate take-profit price
    if (this.config.enableTakeProfit && riskConfig?.takeProfitPercentage) {
      const takeProfitPercent = riskConfig.takeProfitPercentage / 100;
      if (signal.side === 'buy') {
        adjustments.takeProfitPrice = signal.price * (1 + takeProfitPercent);
      } else {
        adjustments.takeProfitPrice = signal.price * (1 - takeProfitPercent);
      }
    }

    // Set slippage tolerance
    adjustments.maxSlippage = this.config.slippageTolerance;

    return adjustments;
  }

  /**
   * Estimate execution cost
   */
  private async estimateExecutionCost(
    signal: TradeSignal,
    _riskAdjustments: RiskAdjustments,
    marketContext: any
  ): Promise<number> {
    const positionSize = _riskAdjustments.adjustedPositionSize || 100;
    const price = signal.price;
    
    // Base cost
    const baseCost = positionSize * price;
    
    // Add spread cost
    const spreadCost = baseCost * (marketContext.spread / 100);
    
    // Add potential slippage cost
    const slippageCost = baseCost * (_riskAdjustments.maxSlippage || 0) / 100;
    
    return baseCost + spreadCost + slippageCost;
  }

  /**
   * Make final trade approval decision
   */
  private makeFinalDecision(
    processedSignal: ProcessedSignal,
    _riskAdjustments: RiskAdjustments,
    estimatedCost: number,
    bot: Bot
  ): { approved: boolean; reason?: string } {
    // Check if estimated cost is within bot's limits
    const maxCost = bot.configuration?.maxTradeAmount || 1000;
    if (estimatedCost > maxCost) {
      return {
        approved: false,
        reason: `Estimated cost ${estimatedCost} exceeds maximum ${maxCost}`
      };
    }

    // Check overall risk score
    if (processedSignal.riskAssessment.riskScore > 0.8) {
      return {
        approved: false,
        reason: `Risk score too high: ${processedSignal.riskAssessment.riskScore}`
      };
    }

    return { approved: true };
  }

  /**
   * Apply signal modifications based on risk adjustments
   */
  private applySignalModifications(
    originalSignal: TradeSignal,
    _riskAdjustments: RiskAdjustments
  ): TradeSignal {
    return {
      ...originalSignal,
      // Apply any modifications needed
      id: `${originalSignal.id}-modified`,
      timestamp: Date.now()
    };
  }

  /**
   * Create position record
   */
  private async createPosition(
    order: TradeOrder,
    decision: TradeDecision,
    bot: Bot
  ): Promise<Position> {
    const position: Position = {
      symbol: order.symbol,
      side: order.side === 'buy' ? 'long' : 'short',
      size: order.amount,
      entryPrice: order.price || 0,
      unrealizedPnl: 0,
      timestamp: Date.now()
    };

    console.log('📊 Position created', {
      botId: bot.id,
      position
    });

    return position;
  }

  /**
   * Store trade execution in database
   */
  private async storeTradeExecution(
    order: TradeOrder,
    processedSignal: ProcessedSignal,
    decision: TradeDecision,
    bot: Bot
  ): Promise<void> {
    try {
      // This would store the trade execution details in the database
      // For now, we'll just log it
      console.log('💾 Storing trade execution', {
        botId: bot.id,
        orderId: order.id,
        signalId: processedSignal.processingMetadata.signalId
      });
    } catch (error) {
      console.warn('⚠️ Failed to store trade execution', {
        botId: bot.id,
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Set up stop-loss and take-profit orders
   */
  private async setupRiskManagementOrders(
    position: Position,
    decision: TradeDecision,
    bot: Bot,
    _context: StrategyContext
  ): Promise<void> {
    try {
      const adjustments = decision.riskAdjustments;
      if (!adjustments) {return;}

      // Set up stop-loss
      if (this.config.enableStopLoss && adjustments.stopLossPrice) {
        console.log('🛡️ Setting up stop-loss order', {
          botId: bot.id,
          symbol: position.symbol,
          stopLossPrice: adjustments.stopLossPrice
        });
        // Implementation would create actual stop-loss order
      }

      // Set up take-profit
      if (this.config.enableTakeProfit && adjustments.takeProfitPrice) {
        console.log('🎯 Setting up take-profit order', {
          botId: bot.id,
          symbol: position.symbol,
          takeProfitPrice: adjustments.takeProfitPrice
        });
        // Implementation would create actual take-profit order
      }
    } catch (error) {
      console.warn('⚠️ Failed to set up risk management orders', {
        botId: bot.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Monitor active positions
   */
  private async monitorPositions(): Promise<void> {
    try {
      for (const [symbol, position] of this.activePositions.entries()) {
        // This would check current prices and update P&L
        // For now, we'll just log
        console.debug('📊 Monitoring position', {
          symbol,
          side: position.side,
          size: position.size
        });
      }
    } catch (error) {
      console.warn('⚠️ Error monitoring positions', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return { ...this.executionStats };
  }

  /**
   * Get active positions
   */
  getActivePositions(): Position[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Get pending orders
   */
  getPendingOrders(): TradeOrder[] {
    return Array.from(this.pendingOrders.values());
  }
} 