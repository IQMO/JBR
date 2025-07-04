/**
 * Trade Executor - Real Exchange Trade Execution Service
 * 
 * Handles the actual execution of trades on exchanges:
 * - Order placement with real exchanges
 * - Order tracking and status updates
 * - Order cancellation
 * - Error handling and retry logic
 * - Security validation
 * - Execution reporting
 */

import { EventEmitter } from 'events';

import type {
  TradeType,
  TradeSide,
  TradeStatus,
  BotStatus
} from '@jabbr/shared';
import { 
  MarketType
} from '@jabbr/shared';

import type { BaseExchange } from '../exchanges/base-exchange';
import type { 
  OrderRequest, 
  OrderResponse
} from '../exchanges/base-exchange';
import type { ExchangeManager } from '../exchanges/exchange-manager';
import type { TradeSignal } from '../JabbrLabs/target-reacher/interfaces';
import { database } from '../services/database.service';

import type { Bot } from './bots.service';

export interface TradeExecutorConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  orderTimeout: number; // milliseconds
  enableMockMode: boolean; // For testing without real execution
  validateBalance: boolean;
  maxSlippagePercent: number;
}

export interface ExecutionRequest {
  bot: Bot;
  signal: TradeSignal;
  orderType: TradeType;
  amount: number;
  price?: number;
  stopPrice?: number;
  leverage?: number;
  reduceOnly?: boolean;
}

export interface ExecutionResponse {
  success: boolean;
  orderId?: string;
  exchangeOrderId?: string;
  executedPrice?: number;
  executedAmount?: number;
  fee?: number;
  timestamp?: Date;
  error?: string;
  retries?: number;
}

export interface OrderUpdate {
  orderId: string;
  status: TradeStatus;
  filledAmount: number;
  remainingAmount: number;
  averagePrice?: number;
  fee?: number;
  lastUpdate: Date;
}

export class TradeExecutor extends EventEmitter {
  private config: TradeExecutorConfig;
  private exchangeManager: ExchangeManager;
  private activeOrders: Map<string, OrderTracking> = new Map();
  private executionStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalRetries: 0,
    averageExecutionTime: 0
  };

  constructor(
    exchangeManager: ExchangeManager,
    config?: Partial<TradeExecutorConfig>
  ) {
    super();
    
    this.exchangeManager = exchangeManager;
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      orderTimeout: 30000,
      enableMockMode: false,
      validateBalance: true,
      maxSlippagePercent: 0.5,
      ...config
    };

    // Set up order monitoring
    this.startOrderMonitoring();
  }

  /**
   * Execute a trade on the exchange
   */
  async executeTrade(request: ExecutionRequest): Promise<ExecutionResponse> {
    const startTime = Date.now();
    let retries = 0;

    try {
      console.log('🚀 Executing trade on exchange', {
        botId: request.bot.id,
        exchange: request.bot.exchange,
        symbol: request.signal.symbol,
        side: request.signal.side,
        amount: request.amount
      });

      this.executionStats.totalExecutions++;

      // Validate execution request
      await this.validateExecutionRequest(request);

      // Get exchange connection
      const exchange = await this.getExchangeForBot(request.bot);

      // Execute with retry logic
      let lastError: Error | null = null;
      
      while (retries <= this.config.maxRetries) {
        try {
          const response = await this.executeOnExchange(exchange, request);
          
          if (response.success) {
            this.executionStats.successfulExecutions++;
            this.updateAverageExecutionTime(Date.now() - startTime);
            
            console.log('✅ Trade executed successfully', {
              botId: request.bot.id,
              orderId: response.orderId,
              executedPrice: response.executedPrice,
              executionTime: Date.now() - startTime
            });

            this.emit('trade-executed', {
              botId: request.bot.id,
              response,
              executionTime: Date.now() - startTime
            });

            return response;
          }

          lastError = new Error(response.error || 'Unknown execution error');

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`⚠️ Execution attempt ${retries + 1} failed`, {
            botId: request.bot.id,
            error: lastError.message
          });
        }

        if (retries < this.config.maxRetries) {
          retries++;
          this.executionStats.totalRetries++;
          
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, retries - 1);
          console.log(`🔄 Retrying in ${delay}ms...`, {
            botId: request.bot.id,
            attempt: retries + 1
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }

      // All retries failed
      this.executionStats.failedExecutions++;
      
      const errorMessage = lastError?.message || 'Trade execution failed after all retries';
      console.error('❌ Trade execution failed', {
        botId: request.bot.id,
        error: errorMessage,
        retries
      });

      this.emit('trade-failed', {
        botId: request.bot.id,
        error: errorMessage,
        retries
      });

      return {
        success: false,
        error: errorMessage,
        retries
      };

    } catch (error) {
      this.executionStats.failedExecutions++;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Critical error in trade execution', {
        botId: request.bot.id,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    bot: Bot,
    orderId: string,
    symbol: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚫 Cancelling order', {
        botId: bot.id,
        orderId,
        symbol
      });

      // Get exchange connection
      const exchange = await this.getExchangeForBot(bot);

      // Determine market type from bot configuration
      const marketType = bot.configuration?.marketType || MarketType.SPOT;

      // Cancel on exchange
      const cancelled = await exchange.cancelOrder(orderId, symbol, marketType);

      if (cancelled) {
        // Remove from active orders
        this.activeOrders.delete(orderId);

        console.log('✅ Order cancelled successfully', {
          botId: bot.id,
          orderId
        });

        this.emit('order-cancelled', {
          botId: bot.id,
          orderId,
          symbol
        });

        return { success: true };
      } 
        throw new Error('Exchange returned false for order cancellation');
      

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('❌ Failed to cancel order', {
        botId: bot.id,
        orderId,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(
    bot: Bot,
    orderId: string,
    symbol: string
  ): Promise<OrderUpdate | null> {
    try {
      // Get exchange connection
      const exchange = await this.getExchangeForBot(bot);

      // Determine market type from bot configuration
      const marketType = bot.configuration?.marketType || MarketType.SPOT;

      // Get order from exchange
      const order = await exchange.getOrder(orderId, symbol, marketType);

      const update: OrderUpdate = {
        orderId: order.orderId,
        status: order.status,
        filledAmount: order.filled,
        remainingAmount: order.remaining,
        averagePrice: order.price,
        fee: order.fee,
        lastUpdate: new Date()
      };

      // Update tracking
      const tracking = this.activeOrders.get(orderId);
      if (tracking) {
        tracking.lastUpdate = update;
        tracking.lastChecked = new Date();
      }

      return update;

    } catch (error) {
      console.error('❌ Failed to get order status', {
        botId: bot.id,
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });

      return null;
    }
  }

  /**
   * Execute order on exchange
   */
  private async executeOnExchange(
    exchange: BaseExchange,
    request: ExecutionRequest
  ): Promise<ExecutionResponse> {
    try {
      // Mock mode for testing
      if (this.config.enableMockMode) {
        return this.mockExecution(request);
      }

      // Prepare order request
      const orderRequest: OrderRequest = {
        symbol: request.signal.symbol,
        side: request.signal.side as TradeSide,
        type: request.orderType,
        amount: request.amount,
        price: request.price,
        stopPrice: request.stopPrice,
        leverage: request.leverage,
        reduceOnly: request.reduceOnly,
        marketType: request.bot.configuration?.marketType || MarketType.SPOT,
        clientOrderId: `bot-${request.bot.id}-${Date.now()}`
      };

      console.log('📤 Sending order to exchange', {
        exchange: exchange.getName(),
        orderRequest
      });

      // Place order on exchange
      const orderResponse = await exchange.placeOrder(orderRequest);

      // Track the order
      this.trackOrder(request.bot.id, orderResponse);

      // Store order in database
      await this.storeOrderInDatabase(request.bot, orderResponse);

      return {
        success: true,
        orderId: orderResponse.clientOrderId || orderResponse.orderId,
        exchangeOrderId: orderResponse.orderId,
        executedPrice: orderResponse.price,
        executedAmount: orderResponse.amount,
        fee: orderResponse.fee,
        timestamp: orderResponse.timestamp
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('❌ Exchange execution failed', {
        exchange: exchange.getName(),
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Validate execution request
   */
  private async validateExecutionRequest(request: ExecutionRequest): Promise<void> {
    // Validate bot configuration
    if (!request.bot.configuration) {
      throw new Error('Bot configuration is missing');
    }

    // Validate exchange API key
    if (!request.bot.exchangeApiKeyId) {
      throw new Error('Exchange API key is not configured');
    }

    // Validate amount
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid order amount');
    }

    // Validate price for limit orders
    if (request.orderType === 'limit' && (!request.price || request.price <= 0)) {
      throw new Error('Price is required for limit orders');
    }

    // Additional security checks
    await this.performSecurityChecks(request);
  }

  /**
   * Perform security checks
   */
  private async performSecurityChecks(request: ExecutionRequest): Promise<void> {
    // Check if bot is active
    if (request.bot.status !== 'running') {
      throw new Error('Bot is not in running state');
    }

    // Check if trading is enabled for this bot
    const botStatus = request.bot.status as BotStatus;
    if (botStatus === 'stopped' || botStatus === 'paused') {
      throw new Error('Trading is disabled for this bot (bot is stopped or paused)');
    }

    // Validate against risk management rules
    if (request.bot.riskManagement) {
      const maxPositionSize = request.bot.riskManagement.maxPositionSize || Infinity;
      if (request.amount > maxPositionSize) {
        throw new Error(`Order amount exceeds maximum position size: ${maxPositionSize}`);
      }
    }

    // Additional checks can be added here
  }

  /**
   * Get exchange connection for bot
   */
  private async getExchangeForBot(bot: Bot): Promise<BaseExchange> {
    if (!bot.exchange || !bot.exchangeApiKeyId) {
      throw new Error('Bot exchange configuration is missing');
    }

    try {
      return await this.exchangeManager.getExchange(
        bot.exchange,
        bot.exchangeApiKeyId
      );
    } catch (error) {
      // Try to initialize if not connected
      console.log('🔌 Exchange not connected, attempting to initialize', {
        exchange: bot.exchange,
        apiKeyId: bot.exchangeApiKeyId
      });

      await this.exchangeManager.initializeExchange(
        bot.exchange,
        bot.exchangeApiKeyId,
        bot.configuration?.isTestnet || false
      );

      return await this.exchangeManager.getExchange(
        bot.exchange,
        bot.exchangeApiKeyId
      );
    }
  }

  /**
   * Mock execution for testing
   */
  private mockExecution(request: ExecutionRequest): ExecutionResponse {
    const mockOrderId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mockPrice = request.price || 100;
    const slippage = (Math.random() - 0.5) * 0.001; // ±0.05% slippage
    
    console.log('🧪 Mock execution completed', {
      botId: request.bot.id,
      orderId: mockOrderId
    });

    return {
      success: true,
      orderId: mockOrderId,
      exchangeOrderId: mockOrderId,
      executedPrice: mockPrice * (1 + slippage),
      executedAmount: request.amount,
      fee: request.amount * mockPrice * 0.001, // 0.1% fee
      timestamp: new Date()
    };
  }

  /**
   * Track active order
   */
  private trackOrder(botId: string, order: OrderResponse): void {
    const tracking: OrderTracking = {
      botId,
      order,
      createdAt: new Date(),
      lastChecked: new Date(),
      lastUpdate: {
        orderId: order.orderId,
        status: order.status,
        filledAmount: order.filled,
        remainingAmount: order.remaining,
        averagePrice: order.price,
        fee: order.fee,
        lastUpdate: new Date()
      }
    };

    this.activeOrders.set(order.orderId, tracking);
  }

  /**
   * Store order in database
   */
  private async storeOrderInDatabase(bot: Bot, order: OrderResponse): Promise<void> {
    try {
      await database.query(`
        INSERT INTO bot_orders (
          bot_id, order_id, exchange_order_id, symbol, side, type,
          amount, price, filled, remaining, status, fee,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [
        bot.id,
        order.clientOrderId || order.orderId,
        order.orderId,
        order.symbol,
        order.side,
        order.type,
        order.amount,
        order.price,
        order.filled,
        order.remaining,
        order.status,
        order.fee
      ]);

      console.log('💾 Order stored in database', {
        botId: bot.id,
        orderId: order.orderId
      });

    } catch (error) {
      console.warn('⚠️ Failed to store order in database', {
        botId: bot.id,
        orderId: order.orderId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Start order monitoring
   */
  private startOrderMonitoring(): void {
    // Monitor active orders every 5 seconds
    setInterval(() => this.monitorActiveOrders(), 5000);
  }

  /**
   * Monitor active orders
   */
  private async monitorActiveOrders(): Promise<void> {
    for (const [orderId, tracking] of this.activeOrders.entries()) {
      // Skip if recently checked
      const timeSinceLastCheck = Date.now() - tracking.lastChecked.getTime();
      if (timeSinceLastCheck < 5000) {continue;}

      // Skip if order is complete
      if (tracking.lastUpdate.status === 'filled' || 
          tracking.lastUpdate.status === 'cancelled' ||
          tracking.lastUpdate.status === 'rejected') {
        this.activeOrders.delete(orderId);
        continue;
      }

      // Check for timeout
      const orderAge = Date.now() - tracking.createdAt.getTime();
      if (orderAge > this.config.orderTimeout) {
        console.warn('⚠️ Order timeout detected', {
          orderId,
          age: orderAge
        });

        this.emit('order-timeout', {
          orderId,
          botId: tracking.botId,
          age: orderAge
        });

        this.activeOrders.delete(orderId);
        continue;
      }

      // Update order status (implementation would fetch from exchange)
      // This is simplified for the example
      tracking.lastChecked = new Date();
    }
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const totalTime = this.executionStats.averageExecutionTime * 
                     (this.executionStats.successfulExecutions - 1) + 
                     executionTime;
    
    this.executionStats.averageExecutionTime = 
      totalTime / this.executionStats.successfulExecutions;
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      ...this.executionStats,
      activeOrders: this.activeOrders.size
    };
  }

  /**
   * Get active orders
   */
  getActiveOrders(): OrderTracking[] {
    return Array.from(this.activeOrders.values());
  }
}

interface OrderTracking {
  botId: string;
  order: OrderResponse;
  createdAt: Date;
  lastChecked: Date;
  lastUpdate: OrderUpdate;
} 