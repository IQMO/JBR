import { EventEmitter } from 'events';

import { MarketType } from '@jabbr/shared';
import type {
  Exchange,
  TradeSide,
  TradeType,
  TradeStatus,
  ExchangeApiKey
} from '@jabbr/shared';

/**
 * Order request interface
 */
export interface OrderRequest {
  symbol: string;
  side: TradeSide;
  type: TradeType;
  amount: number;
  price?: number;
  leverage?: number;
  reduceOnly?: boolean;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  clientOrderId?: string;
  stopPrice?: number;
  marketType: MarketType;
}

/**
 * Order response interface
 */
export interface OrderResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: TradeSide;
  type: TradeType;
  amount: number;
  price?: number;
  filled: number;
  remaining: number;
  status: TradeStatus;
  fee: number;
  timestamp: Date;
  marketType: MarketType;
}

/**
 * Market data interface
 */
export interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  change24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
  marketType: MarketType;
}

/**
 * Position information interface
 */
export interface PositionInfo {
  symbol: string;
  side: TradeSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage: number;
  margin: number;
  marginMode: 'isolated' | 'cross';
  liquidationPrice?: number;
  timestamp: Date;
  marketType: MarketType;
}

/**
 * Account balance interface
 */
export interface AccountBalance {
  currency: string;
  total: number;
  available: number;
  locked: number;
  marketType: MarketType;
}

/**
 * Exchange capabilities interface
 */
export interface ExchangeCapabilities {
  spot: boolean;
  futures: boolean;
  options: boolean;
  margin: boolean;
  maxLeverage: {
    spot: number;
    futures: number;
  };
  supportedOrderTypes: TradeType[];
  supportedTimeframes: string[];
  rateLimits: {
    requests: number;
    window: number; // milliseconds
  };
}

/**
 * Base Exchange Abstract Class
 * Defines the interface that all exchange implementations must follow
 */
export abstract class BaseExchange extends EventEmitter {
  protected apiKey: ExchangeApiKey;
  protected isTestnet: boolean;
  protected isConnected = false;
  protected rateLimitCounter: Map<string, number> = new Map();
  
  constructor(apiKey: ExchangeApiKey, isTestnet = true) {
    super();
    this.apiKey = apiKey;
    this.isTestnet = isTestnet;
  }

  /**
   * Get exchange name
   */
  abstract getName(): Exchange;

  /**
   * Get exchange capabilities
   */
  abstract getCapabilities(): ExchangeCapabilities;

  /**
   * Initialize connection to exchange
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from exchange
   */
  abstract disconnect(): Promise<void>;

  /**
   * Test API connectivity and permissions
   */
  abstract testConnection(): Promise<boolean>;

  // ============================================================================
  // MARKET DATA METHODS
  // ============================================================================

  /**
   * Get current market data for a symbol
   */
  abstract getMarketData(symbol: string, marketType: MarketType): Promise<MarketData>;

  /**
   * Get order book for a symbol
   */
  abstract getOrderBook(symbol: string, marketType: MarketType, depth?: number): Promise<{
    bids: [number, number][];
    asks: [number, number][];
    timestamp: Date;
  }>;

  /**
   * Get recent trades for a symbol
   */
  abstract getRecentTrades(symbol: string, marketType: MarketType, limit?: number): Promise<{
    id: string;
    price: number;
    amount: number;
    side: TradeSide;
    timestamp: Date;
  }[]>;

  /**
   * Get candlestick/kline data
   */
  abstract getKlines(
    symbol: string, 
    interval: string, 
    marketType: MarketType,
    startTime?: Date, 
    endTime?: Date, 
    limit?: number
  ): Promise<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[]>;

  // ============================================================================
  // TRADING METHODS
  // ============================================================================

  /**
   * Place a new order
   */
  abstract placeOrder(orderRequest: OrderRequest): Promise<OrderResponse>;

  /**
   * Cancel an existing order
   */
  abstract cancelOrder(orderId: string, symbol: string, marketType: MarketType): Promise<boolean>;

  /**
   * Cancel all orders for a symbol
   */
  abstract cancelAllOrders(symbol?: string, marketType?: MarketType): Promise<boolean>;

  /**
   * Get order status
   */
  abstract getOrder(orderId: string, symbol: string, marketType: MarketType): Promise<OrderResponse>;

  /**
   * Get open orders
   */
  abstract getOpenOrders(symbol?: string, marketType?: MarketType): Promise<OrderResponse[]>;

  /**
   * Get order history
   */
  abstract getOrderHistory(
    symbol?: string, 
    marketType?: MarketType,
    startTime?: Date, 
    endTime?: Date, 
    limit?: number
  ): Promise<OrderResponse[]>;

  // ============================================================================
  // POSITION METHODS (FUTURES)
  // ============================================================================

  /**
   * Get current positions
   */
  abstract getPositions(symbol?: string): Promise<PositionInfo[]>;

  /**
   * Set leverage for a symbol
   */
  abstract setLeverage(symbol: string, leverage: number): Promise<boolean>;

  /**
   * Set margin mode for a symbol
   */
  abstract setMarginMode(symbol: string, mode: 'isolated' | 'cross'): Promise<boolean>;

  /**
   * Set position mode (one-way or hedge)
   */
  abstract setPositionMode(mode: 'one-way' | 'hedge'): Promise<boolean>;

  // ============================================================================
  // ACCOUNT METHODS
  // ============================================================================

  /**
   * Get account balance
   */
  abstract getBalance(marketType?: MarketType): Promise<AccountBalance[]>;

  /**
   * Get trading fees
   */
  abstract getTradingFees(symbol?: string, marketType?: MarketType): Promise<{
    maker: number;
    taker: number;
  }>;

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if connected to exchange
   */
  isConnectedToExchange(): boolean {
    return this.isConnected;
  }

  /**
   * Get testnet status
   */
  isTestnetMode(): boolean {
    return this.isTestnet;
  }

  /**
   * Rate limit check
   */
  protected checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const windowStart = now - this.getCapabilities().rateLimits.window;
    const key = `${endpoint}_${Math.floor(now / this.getCapabilities().rateLimits.window)}`;
    const count = this.rateLimitCounter.get(key) || 0;
    if (count >= this.getCapabilities().rateLimits.requests) {
      return false;
    }
    this.rateLimitCounter.set(key, count + 1);
    // Clean up old entries
    for (const [k] of this.rateLimitCounter.entries()) {
      const keyParts = k.split('_');
      const timestampStr = keyParts.at(1);
      if (timestampStr && parseInt(timestampStr) < windowStart) {
        this.rateLimitCounter.delete(k);
      }
    }
    return true;
  }

  /**
   * Validate order request
   */
  protected validateOrderRequest(orderRequest: OrderRequest): void {
    if (!orderRequest.symbol) {
      throw new Error('Symbol is required');
    }
    
    if (!orderRequest.side) {
      throw new Error('Side is required');
    }
    
    if (!orderRequest.type) {
      throw new Error('Order type is required');
    }
    
    if (!orderRequest.amount || orderRequest.amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    if (orderRequest.type === 'limit' && (!orderRequest.price || orderRequest.price <= 0)) {
      throw new Error('Price is required for limit orders');
    }
    
    const capabilities = this.getCapabilities();
    
    // Check if market type is supported
    if (orderRequest.marketType === MarketType.SPOT && !capabilities.spot) {
      throw new Error('Spot trading not supported');
    }
    
    if (orderRequest.marketType === MarketType.FUTURES && !capabilities.futures) {
      throw new Error('Futures trading not supported');
    }
    
    // Check leverage limits
    if (orderRequest.leverage) {
      const maxLeverage = orderRequest.marketType === MarketType.SPOT 
        ? capabilities.maxLeverage.spot 
        : capabilities.maxLeverage.futures;
        
      if (orderRequest.leverage > maxLeverage) {
        throw new Error(`Leverage cannot exceed ${maxLeverage}x for ${orderRequest.marketType}`);
      }
    }
    
    // Check if order type is supported
    if (!capabilities.supportedOrderTypes.includes(orderRequest.type)) {
      throw new Error(`Order type ${orderRequest.type} not supported`);
    }
  }

  /**
   * Format symbol for exchange
   */
  protected abstract formatSymbol(symbol: string, marketType: MarketType): string;

  /**
   * Parse symbol from exchange format
   */
  protected abstract parseSymbol(exchangeSymbol: string, marketType: MarketType): string;

  /**
   * Get server time from exchange
   */
  abstract getServerTime(): Promise<Date>;

  /**
   * Subscribe to real-time data (WebSocket)
   */
  abstract subscribeToMarketData(symbol: string, marketType: MarketType): Promise<void>;

  /**
   * Unsubscribe from real-time data
   */
  abstract unsubscribeFromMarketData(symbol: string, marketType: MarketType): Promise<void>;

  /**
   * Subscribe to order updates
   */
  abstract subscribeToOrderUpdates(): Promise<void>;

  /**
   * Subscribe to position updates (futures)
   */
  abstract subscribeToPositionUpdates(): Promise<void>;
}

export default BaseExchange; 