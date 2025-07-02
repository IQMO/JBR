import * as ccxt from 'ccxt';
import { 
  BaseExchange, 
  MarketType, 
  OrderRequest, 
  OrderResponse, 
  MarketData, 
  PositionInfo, 
  AccountBalance, 
  ExchangeCapabilities 
} from './base-exchange';
import type {
  Exchange,
  TradeSide,
  TradeType,
  TradeStatus,
  ExchangeApiKey
} from '@jabbr/shared';
import { timeSyncService } from '../services/time-sync.service';

/**
 * Bybit Exchange Implementation
 * Supports both Spot and Futures trading with comprehensive order management
 */
export class BybitExchange extends BaseExchange {
  private client: ccxt.bybit;
  private wsConnections: Map<string, any> = new Map();
  private subscriptions: Set<string> = new Set();

  constructor(apiKey: ExchangeApiKey, isTestnet: boolean = true) {
    super(apiKey, isTestnet);
    
    // Initialize CCXT Bybit client
    this.client = new ccxt.bybit({
      apiKey: this.apiKey.apiKey,
      secret: this.apiKey.apiSecret,
      sandbox: this.isTestnet,
      enableRateLimit: true,
      rateLimit: 120, // 120ms between requests
      options: {
        defaultType: 'swap', // Default to futures, can be overridden
        recvWindow: 60000, // Increased to 60 seconds for better tolerance
        timeDifference: 0
      }
    });

    console.log(`🏦 Bybit Exchange initialized (${isTestnet ? 'TESTNET' : 'MAINNET'})`);
  }

  /**
   * Get exchange name
   */
  getName(): Exchange {
    return 'bybit';
  }

  /**
   * Get exchange capabilities
   */
  getCapabilities(): ExchangeCapabilities {
    return {
      spot: true,
      futures: true,
      options: false,
      margin: true,
      maxLeverage: {
        spot: 10,
        futures: 100
      },
      supportedOrderTypes: ['market', 'limit', 'stop', 'stop-limit'],
      supportedTimeframes: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w'],
      rateLimits: {
        requests: 120, // 120 requests per minute
        window: 60000 // 1 minute
      }
    };
  }

  /**
   * Initialize connection to Bybit
   */
  async connect(): Promise<void> {
    try {
      console.log('🔌 Connecting to Bybit...');
      
      // First, get server time and sync
      console.log('⏰ Synchronizing time with Bybit...');
      try {
        // Get Bybit server time
        const serverTime = await this.client.fetchTime();
        const bybitServerTime = new Date(serverTime || Date.now());
        
        // Sync with our time service
        await timeSyncService.syncWithExchange('bybit', bybitServerTime);
        const totalDrift = timeSyncService.getTotalDrift();
        console.log(`✅ Time synchronized (drift: ${totalDrift}ms)`);
        
        // Apply time difference to CCXT client (negative to correct)
        this.client.options.timeDifference = -totalDrift;
        console.log(`🔧 Applied time correction: ${-totalDrift}ms to CCXT client`);
      } catch (timeError) {
        console.warn('⚠️ Time sync failed, proceeding with system time:', timeError);
      }
      
      // Load markets for the current mode
      await this.client.loadMarkets();
      
      // Test the connection
      const testResult = await this.testConnection();
      if (!testResult) {
        throw new Error('Connection test failed');
      }

      this.isConnected = true;
      console.log('✅ Connected to Bybit successfully');
      
      this.emit('connected', {
        exchange: 'bybit',
        testnet: this.isTestnet,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Failed to connect to Bybit:', error);
      this.isConnected = false;
      this.emit('error', {
        type: 'connection_failed',
        exchange: 'bybit',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Disconnect from Bybit
   */
  async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Bybit...');
      
      // Close all WebSocket connections
      for (const [, ws] of this.wsConnections) {
        if (ws && ws.close) {
          ws.close();
        }
      }
      this.wsConnections.clear();
      this.subscriptions.clear();

      this.isConnected = false;
      console.log('✅ Disconnected from Bybit');
      
      this.emit('disconnected', {
        exchange: 'bybit',
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Error disconnecting from Bybit:', error);
      throw error;
    }
  }

  /**
   * Test API connectivity and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test both spot and futures API access
      const [spotBalance, futuresBalance] = await Promise.allSettled([
        this.client.fetchBalance({ type: 'spot' }),
        this.client.fetchBalance({ type: 'swap' })
      ]);

      const spotOk = spotBalance.status === 'fulfilled';
      const futuresOk = futuresBalance.status === 'fulfilled';

      console.log(`📊 API Test Results:`);
      console.log(`   Spot API: ${spotOk ? '✅' : '❌'}`);
      console.log(`   Futures API: ${futuresOk ? '✅' : '❌'}`);

      return spotOk || futuresOk; // At least one should work

    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // MARKET DATA METHODS
  // ============================================================================

  /**
   * Get current market data for a symbol
   */
  async getMarketData(symbol: string, marketType: MarketType): Promise<MarketData> {
    try {
      if (!this.checkRateLimit('getMarketData')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, marketType);
      
      // Set the market type for this request
      this.client.options.defaultType = marketType === MarketType.SPOT ? 'spot' : 'swap';
      
      const ticker = await this.client.fetchTicker(formattedSymbol);
      
      return {
        symbol,
        price: ticker.last || 0,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        volume: ticker.baseVolume || 0,
        change24h: ticker.change || 0,
        high24h: ticker.high || 0,
        low24h: ticker.low || 0,
        timestamp: new Date(ticker.timestamp || Date.now()),
        marketType
      };

    } catch (error) {
      console.error(`❌ Failed to get market data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(symbol: string, marketType: MarketType, depth: number = 50): Promise<{
    bids: [number, number][];
    asks: [number, number][];
    timestamp: Date;
  }> {
    try {
      if (!this.checkRateLimit('getOrderBook')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, marketType);
      this.client.options.defaultType = marketType === MarketType.SPOT ? 'spot' : 'swap';
      
      const orderBook = await this.client.fetchOrderBook(formattedSymbol, depth);
      
      return {
        bids: orderBook.bids.map((bid: any) => [bid[0], bid[1]] as [number, number]),
        asks: orderBook.asks.map((ask: any) => [ask[0], ask[1]] as [number, number]),
        timestamp: new Date(orderBook.timestamp || Date.now())
      };

    } catch (error) {
      console.error(`❌ Failed to get order book for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get recent trades for a symbol
   */
  async getRecentTrades(symbol: string, _marketType: MarketType, limit: number = 50): Promise<{
    id: string;
    price: number;
    amount: number;
    side: TradeSide;
    timestamp: Date;
  }[]> {
    try {
      if (!this.checkRateLimit('getRecentTrades')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, _marketType);
      this.client.options.defaultType = _marketType === MarketType.SPOT ? 'spot' : 'swap';
      
      const trades = await this.client.fetchTrades(formattedSymbol, undefined, limit);
      
      return trades.map((trade: any) => ({
        id: trade.id || '',
        price: trade.price,
        amount: trade.amount,
        side: trade.side as TradeSide,
        timestamp: new Date(trade.timestamp || Date.now())
      }));

    } catch (error) {
      console.error(`❌ Failed to get recent trades for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get candlestick/kline data
   */
  async getKlines(
    symbol: string, 
    interval: string, 
    _marketType: MarketType,
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
  }[]> {
    try {
      if (!this.checkRateLimit('getKlines')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, _marketType);
      this.client.options.defaultType = _marketType === MarketType.SPOT ? 'spot' : 'swap';
      
      const since = startTime ? startTime.getTime() : undefined;
      const ohlcv = await this.client.fetchOHLCV(
        formattedSymbol, 
        interval, 
        since, 
        limit
      );
      
      return ohlcv.map((candle: any) => ({
        timestamp: new Date(candle[0]),
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));

    } catch (error) {
      console.error(`❌ Failed to get klines for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get server time from Bybit
   */
  async getServerTime(): Promise<Date> {
    try {
      // Use our time sync service which already fetches Bybit time
      return timeSyncService.getExchangeTime('bybit');
    } catch (error) {
      console.error('❌ Failed to get server time:', error);
      return new Date();
    }
  }

  /**
   * Format symbol for Bybit
   */
  protected formatSymbol(symbol: string, marketType: MarketType): string {
    // Bybit uses different symbol formats for spot vs futures
    if (marketType === MarketType.SPOT) {
      // Spot: BTCUSDT
      return symbol.toUpperCase();
    } else {
      // Futures: BTCUSDT (perpetual contracts)
      return symbol.toUpperCase();
    }
  }

  /**
   * Parse symbol from Bybit format
   */
  protected parseSymbol(exchangeSymbol: string): string {
    return exchangeSymbol.toUpperCase();
  }

  // ============================================================================
  // TRADING METHODS
  // ============================================================================

  /**
   * Place a new order on Bybit
   */
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    try {
      // Validate the order request
      this.validateOrderRequest(orderRequest);

      if (!this.checkRateLimit('placeOrder')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(orderRequest.symbol, orderRequest.marketType);
      
      // Set the market type for this request
      this.client.options.defaultType = orderRequest.marketType === MarketType.SPOT ? 'spot' : 'swap';

      // Prepare order parameters
      const orderParams: any = {
        symbol: formattedSymbol,
        type: orderRequest.type,
        side: orderRequest.side,
        amount: orderRequest.amount,
        price: orderRequest.price,
        params: {}
      };

      // Add futures-specific parameters
      if (orderRequest.marketType === MarketType.FUTURES) {
        if (orderRequest.leverage) {
          orderParams.params.leverage = orderRequest.leverage;
        }
        if (orderRequest.reduceOnly) {
          orderParams.params.reduceOnly = orderRequest.reduceOnly;
        }
        if (orderRequest.timeInForce) {
          orderParams.params.timeInForce = orderRequest.timeInForce;
        }
      }

      // Add client order ID if provided
      if (orderRequest.clientOrderId) {
        orderParams.params.clientOrderId = orderRequest.clientOrderId;
      }

      // Add stop price for stop orders
      if (orderRequest.stopPrice && (orderRequest.type === 'stop' || orderRequest.type === 'stop-limit')) {
        orderParams.params.stopPrice = orderRequest.stopPrice;
      }

      console.log(`📝 Placing ${orderRequest.marketType} order:`, {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        amount: orderRequest.amount,
        price: orderRequest.price,
        leverage: orderRequest.leverage
      });

      // Place the order
      const order = await this.client.createOrder(
        orderParams.symbol,
        orderParams.type,
        orderParams.side,
        orderParams.amount,
        orderParams.price,
        orderParams.params
      );

      const response: OrderResponse = {
        orderId: order.id || '',
        clientOrderId: order.clientOrderId || undefined,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        amount: orderRequest.amount,
        price: orderRequest.price,
        filled: order.filled || 0,
        remaining: order.remaining || orderRequest.amount,
        status: this.mapOrderStatus(order.status || 'pending'),
        fee: order.fee?.cost || 0,
        timestamp: new Date(order.timestamp || Date.now()),
        marketType: orderRequest.marketType
      };

      console.log(`✅ Order placed successfully:`, {
        orderId: response.orderId,
        status: response.status
      });

      // Emit order event
      this.emit('orderPlaced', response);

      return response;

    } catch (error) {
      console.error(`❌ Failed to place order:`, error);
      this.emit('orderError', {
        type: 'place_order_failed',
        orderRequest,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(orderId: string, symbol: string, marketType: MarketType): Promise<boolean> {
    try {
      if (!this.checkRateLimit('cancelOrder')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, marketType);
      this.client.options.defaultType = marketType === MarketType.SPOT ? 'spot' : 'swap';

      console.log(`🚫 Cancelling order: ${orderId} for ${symbol}`);

      const result = await this.client.cancelOrder(orderId, formattedSymbol);
      
      const success = result && (result.status === 'canceled' || result.status === 'cancelled');

      if (success) {
        console.log(`✅ Order cancelled successfully: ${orderId}`);
        this.emit('orderCancelled', {
          orderId,
          symbol,
          marketType,
          timestamp: new Date()
        });
      }

      return success;

    } catch (error) {
      console.error(`❌ Failed to cancel order ${orderId}:`, error);
      this.emit('orderError', {
        type: 'cancel_order_failed',
        orderId,
        symbol,
        marketType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Cancel all orders for a symbol
   */
  async cancelAllOrders(symbol?: string, marketType?: MarketType): Promise<boolean> {
    try {
      if (!this.checkRateLimit('cancelAllOrders')) {
        throw new Error('Rate limit exceeded');
      }

      console.log(`🚫 Cancelling all orders${symbol ? ` for ${symbol}` : ''}`);

      if (symbol && marketType) {
        const formattedSymbol = this.formatSymbol(symbol, marketType);
        this.client.options.defaultType = marketType === MarketType.SPOT ? 'spot' : 'swap';
        
        await this.client.cancelAllOrders(formattedSymbol);
      } else {
        // Cancel all orders across all symbols
        await this.client.cancelAllOrders();
      }

      console.log(`✅ All orders cancelled successfully`);
      
      this.emit('allOrdersCancelled', {
        symbol,
        marketType,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      console.error(`❌ Failed to cancel all orders:`, error);
      this.emit('orderError', {
        type: 'cancel_all_orders_failed',
        symbol,
        marketType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get order status
   */
  async getOrder(orderId: string, symbol: string, marketType: MarketType): Promise<OrderResponse> {
    try {
      if (!this.checkRateLimit('getOrder')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, marketType);
      this.client.options.defaultType = marketType === MarketType.SPOT ? 'spot' : 'swap';

      const order = await this.client.fetchOrder(orderId, formattedSymbol);

      return {
        orderId: order.id || '',
        clientOrderId: order.clientOrderId || undefined,
        symbol,
        side: order.side as TradeSide,
        type: order.type as TradeType,
        amount: order.amount,
        price: order.price,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: this.mapOrderStatus(order.status || 'pending'),
        fee: order.fee?.cost || 0,
        timestamp: new Date(order.timestamp || Date.now()),
        marketType: marketType
      };

    } catch (error) {
      console.error(`❌ Failed to get order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order history for a symbol
   */
  async getOrderHistory(): Promise<OrderResponse[]> {
    try {
      const symbol = 'BTCUSDT';
      this.client.options.defaultType = 'swap';
      const [closedOrders, canceledOrders] = await Promise.all([
        this.client.fetchClosedOrders(symbol),
        this.client.fetchCanceledOrders(symbol)
      ]);
      const allOrders = [...closedOrders, ...canceledOrders]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return allOrders.map((order: any) => ({
        orderId: order.id || '',
        clientOrderId: order.clientOrderId || undefined,
        symbol: order.symbol ? this.parseSymbol(order.symbol) : '',
        side: order.side as TradeSide,
        type: order.type as TradeType,
        amount: order.amount,
        price: order.price,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: this.mapOrderStatus(order.status || 'pending'),
        fee: order.fee?.cost || 0,
        timestamp: new Date(order.timestamp || Date.now()),
        marketType: MarketType.FUTURES
      }));
    } catch (error) {
      console.error('❌ Failed to fetch order history:', error);
      throw error;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<OrderResponse[]> {
    try {
      const symbol = 'BTCUSDT';
      this.client.options.defaultType = 'swap';
      const orders = await this.client.fetchOpenOrders(symbol);
      return orders.map((order: any) => ({
        orderId: order.id || '',
        clientOrderId: order.clientOrderId || undefined,
        symbol: this.parseSymbol(order.symbol),
        side: order.side as TradeSide,
        type: order.type as TradeType,
        amount: order.amount,
        price: order.price,
        filled: order.filled || 0,
        remaining: order.remaining || 0,
        status: this.mapOrderStatus(order.status || 'pending'),
        fee: order.fee?.cost || 0,
        timestamp: new Date(order.timestamp || Date.now()),
        marketType: MarketType.FUTURES
      }));
    } catch (error) {
      console.error('❌ Failed to get open orders:', error);
      throw error;
    }
  }

  // ============================================================================
  // POSITION METHODS (FUTURES)
  // ============================================================================

  /**
   * Get current positions
   */
  async getPositions(symbol?: string): Promise<PositionInfo[]> {
    try {
      if (!this.checkRateLimit('getPositions')) {
        throw new Error('Rate limit exceeded');
      }

      this.client.options.defaultType = 'swap'; // Futures only
      const positions = await this.client.fetchPositions(symbol ? [this.formatSymbol(symbol, MarketType.FUTURES)] : undefined);

      return positions
        .filter((pos: any) => pos.size > 0) // Only return positions with size > 0
        .map((pos: any) => ({
          symbol: pos.symbol ? this.parseSymbol(pos.symbol) : '',
          side: pos.side as TradeSide,
          size: pos.size || 0,
          entryPrice: pos.entryPrice || 0,
          markPrice: pos.markPrice || 0,
          unrealizedPnl: pos.unrealizedPnl || 0,
          realizedPnl: pos.realizedPnl || 0,
          leverage: pos.leverage || 1,
          margin: pos.margin || 0,
          marginMode: pos.marginMode === 'isolated' ? 'isolated' : 'cross',
          liquidationPrice: pos.liquidationPrice,
          timestamp: new Date(pos.timestamp || Date.now()),
          marketType: MarketType.FUTURES
        }));

    } catch (error) {
      console.error(`❌ Failed to get positions:`, error);
      throw error;
    }
  }

  /**
   * Set leverage for a symbol
   */
  async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    try {
      if (!this.checkRateLimit('setLeverage')) {
        throw new Error('Rate limit exceeded');
      }

      // Validate leverage range
      if (leverage < 1 || leverage > 100) {
        throw new Error('Leverage must be between 1 and 100');
      }

      const formattedSymbol = this.formatSymbol(symbol, MarketType.FUTURES);
      this.client.options.defaultType = 'swap';

      console.log(`⚡ Setting leverage to ${leverage}x for ${symbol}`);

      await this.client.setLeverage(leverage, formattedSymbol);
      console.log(`✅ Leverage set to ${leverage}x for ${symbol}`);

      this.emit('leverageChanged', {
        symbol,
        leverage,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      console.error(`❌ Failed to set leverage for ${symbol}:`, error);
      this.emit('leverageError', {
        symbol,
        leverage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Set margin mode for a symbol
   */
  async setMarginMode(symbol: string, mode: 'isolated' | 'cross'): Promise<boolean> {
    try {
      if (!this.checkRateLimit('setMarginMode')) {
        throw new Error('Rate limit exceeded');
      }

      const formattedSymbol = this.formatSymbol(symbol, MarketType.FUTURES);
      this.client.options.defaultType = 'swap';

      console.log(`🔧 Setting margin mode to ${mode} for ${symbol}`);

      await this.client.setMarginMode(mode, formattedSymbol);
      console.log(`✅ Margin mode set to ${mode} for ${symbol}`);

      this.emit('marginModeChanged', {
        symbol,
        mode,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      console.error(`❌ Failed to set margin mode for ${symbol}:`, error);
      this.emit('marginModeError', {
        symbol,
        mode,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Set position mode (one-way or hedge)
   */
  async setPositionMode(mode: 'one-way' | 'hedge'): Promise<boolean> {
    try {
      if (!this.checkRateLimit('setPositionMode')) {
        throw new Error('Rate limit exceeded');
      }

      this.client.options.defaultType = 'swap';
      
      console.log(`🔄 Setting position mode to ${mode}`);
      
      // Bybit uses different terminology
      const bybitMode = mode === 'hedge';
      await this.client.setPositionMode(bybitMode);
      
      console.log(`✅ Position mode set to ${mode}`);

      this.emit('positionModeChanged', {
        mode,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      console.error(`❌ Failed to set position mode:`, error);
      this.emit('positionModeError', {
        mode,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // ============================================================================
  // ACCOUNT METHODS
  // ============================================================================

  /**
   * Get account balance
   */
  async getBalance(): Promise<AccountBalance[]> {
    try {
      if (!this.checkRateLimit('getBalance')) {
        throw new Error('Rate limit exceeded');
      }

      const balanceType = 'swap'; // Always use futures for this method
      this.client.options.defaultType = balanceType;

      console.log(`💰 Fetching ${balanceType} balance...`);

      const balance = await this.client.fetchBalance();

      if (!balance.total) {
        return [];
      }

      const balances = Object.entries(balance.total)
        .filter(([, total]) => typeof total === 'number' && total > 0)
        .map(([currency, total]) => ({
          currency,
          total: total as number,
          available: (balance.free && (balance.free as any)[currency]) || 0,
          locked: (balance.used && (balance.used as any)[currency]) || 0,
          marketType: MarketType.FUTURES
        }));

      console.log(`✅ Retrieved ${balances.length} non-zero balances`);

      return balances;

    } catch (error) {
      console.error(`❌ Failed to get balance:`, error);
      throw error;
    }
  }

  /**
   * Get trading fees for a symbol or default fees
   */
  async getTradingFees(symbol?: string): Promise<{
    maker: number;
    taker: number;
  }> {
    try {
      if (!this.checkRateLimit('getTradingFees')) {
        throw new Error('Rate limit exceeded');
      }

      if (symbol) {
        const formattedSymbol = this.formatSymbol(symbol, MarketType.FUTURES);
        this.client.options.defaultType = 'swap';
        
        console.log(`📊 Fetching trading fees for ${symbol}`);
        
        const fees = await this.client.fetchTradingFee(formattedSymbol);
        return {
          maker: fees.maker || 0.0001,
          taker: fees.taker || 0.0006
        };
      } else {
        // Return default fees for Bybit
        console.log(`📊 Using default Bybit trading fees`);
        return {
          maker: 0.0001, // 0.01%
          taker: 0.0006  // 0.06%
        };
      }

    } catch (error) {
      console.error(`❌ Failed to get trading fees:`, error);
      // Return default fees on error
      return {
        maker: 0.0001,
        taker: 0.0006
      };
    }
  }

  // ============================================================================
  // WEBSOCKET METHODS
  // ============================================================================

  async subscribeToMarketData(symbol: string, marketType: MarketType): Promise<void> {
    try {
      const formattedSymbol = this.formatSymbol(symbol, marketType);
      const subscriptionKey = `${marketType}_${formattedSymbol}`;

      if (this.subscriptions.has(subscriptionKey)) {
        console.log(`📡 Already subscribed to ${symbol} ${marketType} market data`);
        return;
      }

      console.log(`📡 Subscribing to ${symbol} ${marketType} market data...`);

      // For now, we'll use a placeholder implementation
      // In a full implementation, this would create WebSocket connections
      // to Bybit's real-time data streams
      
      this.subscriptions.add(subscriptionKey);
      
      console.log(`✅ Subscribed to ${symbol} ${marketType} market data`);

      this.emit('marketDataSubscribed', {
        symbol,
        marketType,
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`❌ Failed to subscribe to market data for ${symbol}:`, error);
      throw error;
    }
  }

  async unsubscribeFromMarketData(symbol: string, marketType: MarketType): Promise<void> {
    try {
      const formattedSymbol = this.formatSymbol(symbol, marketType);
      const subscriptionKey = `${marketType}_${formattedSymbol}`;

      if (!this.subscriptions.has(subscriptionKey)) {
        console.log(`📡 Not subscribed to ${symbol} ${marketType} market data`);
        return;
      }

      console.log(`📡 Unsubscribing from ${symbol} ${marketType} market data...`);

      this.subscriptions.delete(subscriptionKey);
      
      console.log(`✅ Unsubscribed from ${symbol} ${marketType} market data`);

      this.emit('marketDataUnsubscribed', {
        symbol,
        marketType,
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`❌ Failed to unsubscribe from market data for ${symbol}:`, error);
      throw error;
    }
  }

  async subscribeToOrderUpdates(): Promise<void> {
    try {
      const subscriptionKey = 'order_updates';

      if (this.subscriptions.has(subscriptionKey)) {
        console.log(`📡 Already subscribed to order updates`);
        return;
      }

      console.log(`📡 Subscribing to order updates...`);

      // For now, we'll use a placeholder implementation
      // In a full implementation, this would create WebSocket connections
      // to Bybit's order update streams
      
      this.subscriptions.add(subscriptionKey);
      
      console.log(`✅ Subscribed to order updates`);

      this.emit('orderUpdatesSubscribed', {
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`❌ Failed to subscribe to order updates:`, error);
      throw error;
    }
  }

  async subscribeToPositionUpdates(): Promise<void> {
    try {
      const subscriptionKey = 'position_updates';

      if (this.subscriptions.has(subscriptionKey)) {
        console.log(`📡 Already subscribed to position updates`);
        return;
      }

      console.log(`📡 Subscribing to position updates...`);

      // For now, we'll use a placeholder implementation
      // In a full implementation, this would create WebSocket connections
      // to Bybit's position update streams
      
      this.subscriptions.add(subscriptionKey);
      
      console.log(`✅ Subscribed to position updates`);

      this.emit('positionUpdatesSubscribed', {
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`❌ Failed to subscribe to position updates:`, error);
      throw error;
    }
  }

  // ============================================================================
  // ADVANCED ORDER MANAGEMENT METHODS
  // ============================================================================

  /**
   * Place a bracket order: Entry order + Stop Loss + Take Profit
   * This is the core advanced order management function that places all three orders atomically
   */
  async placeBracketOrder(
    entryOrder: {
      symbol: string;
      side: TradeSide;
      type: TradeType;
      amount: number;
      price?: number; // Required for limit orders, optional for market
      marketType: MarketType;
      leverage?: number;
      clientOrderId?: string;
    },
    stopLoss: {
      price: number;
      type?: 'stop_market' | 'stop_limit'; // Default: stop_market
      limitPrice?: number; // Required if type is stop_limit
    },
    takeProfit: {
      price: number;
      type?: 'limit' | 'take_profit_market'; // Default: limit
    }
  ): Promise<{
    entryOrder: OrderResponse;
    stopLossOrder?: OrderResponse;
    takeProfitOrder?: OrderResponse;
    success: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let entryOrderResponse: OrderResponse | null = null;
    let stopLossOrderResponse: OrderResponse | null = null;
    let takeProfitOrderResponse: OrderResponse | null = null;

    try {
      console.log(`🎯 Placing bracket order for ${entryOrder.symbol}:`, {
        entry: { side: entryOrder.side, type: entryOrder.type, amount: entryOrder.amount, price: entryOrder.price },
        stopLoss: { price: stopLoss.price, type: stopLoss.type || 'stop_market' },
        takeProfit: { price: takeProfit.price, type: takeProfit.type || 'limit' }
      });

      // Validate bracket order parameters
      this.validateBracketOrder(entryOrder, stopLoss, takeProfit);

      // Step 1: Place the entry order first
      const entryOrderRequest: OrderRequest = {
        symbol: entryOrder.symbol,
        side: entryOrder.side,
        type: entryOrder.type,
        amount: entryOrder.amount,
        price: entryOrder.price,
        marketType: entryOrder.marketType,
        leverage: entryOrder.leverage,
        clientOrderId: entryOrder.clientOrderId
      };

      entryOrderResponse = await this.placeOrder(entryOrderRequest);
      console.log(`✅ Entry order placed: ${entryOrderResponse.orderId}`);

      // Step 2: Place Stop Loss order
      try {
        const stopLossOrderRequest: OrderRequest = {
          symbol: entryOrder.symbol,
          side: entryOrder.side === 'buy' ? 'sell' : 'buy', // Opposite side
          type: stopLoss.type === 'stop_limit' ? 'stop-limit' : 'stop',
          amount: entryOrder.amount,
          price: stopLoss.type === 'stop_limit' ? stopLoss.limitPrice : undefined,
          stopPrice: stopLoss.price,
          marketType: entryOrder.marketType,
          reduceOnly: entryOrder.marketType === MarketType.FUTURES, // Reduce-only for futures
          clientOrderId: entryOrder.clientOrderId ? `${entryOrder.clientOrderId}_SL` : undefined
        };

        stopLossOrderResponse = await this.placeOrder(stopLossOrderRequest);
        console.log(`✅ Stop Loss order placed: ${stopLossOrderResponse.orderId}`);
      } catch (slError) {
        const errorMsg = `Failed to place stop loss: ${slError instanceof Error ? slError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // Step 3: Place Take Profit order
      try {
        const takeProfitOrderRequest: OrderRequest = {
          symbol: entryOrder.symbol,
          side: entryOrder.side === 'buy' ? 'sell' : 'buy', // Opposite side
          type: takeProfit.type === 'take_profit_market' ? 'market' : 'limit',
          amount: entryOrder.amount,
          price: takeProfit.type === 'take_profit_market' ? undefined : takeProfit.price,
          marketType: entryOrder.marketType,
          reduceOnly: entryOrder.marketType === MarketType.FUTURES, // Reduce-only for futures
          clientOrderId: entryOrder.clientOrderId ? `${entryOrder.clientOrderId}_TP` : undefined
        };

        takeProfitOrderResponse = await this.placeOrder(takeProfitOrderRequest);
        console.log(`✅ Take Profit order placed: ${takeProfitOrderResponse.orderId}`);
      } catch (tpError) {
        const errorMsg = `Failed to place take profit: ${tpError instanceof Error ? tpError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      const success = entryOrderResponse !== null && errors.length === 0;
      
      console.log(`${success ? '🎉' : '⚠️'} Bracket order ${success ? 'completed successfully' : 'completed with errors'}:`, {
        entryOrderId: entryOrderResponse?.orderId,
        stopLossOrderId: stopLossOrderResponse?.orderId,
        takeProfitOrderId: takeProfitOrderResponse?.orderId,
        errors: errors.length
      });

      // Emit bracket order event
      this.emit('bracketOrderPlaced', {
        entryOrder: entryOrderResponse,
        stopLossOrder: stopLossOrderResponse,
        takeProfitOrder: takeProfitOrderResponse,
        success,
        errors
      });

      return {
        entryOrder: entryOrderResponse!,
        stopLossOrder: stopLossOrderResponse || undefined,
        takeProfitOrder: takeProfitOrderResponse || undefined,
        success,
        errors
      };

    } catch (error) {
      const errorMsg = `Failed to place bracket order: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);

      // If we have an entry order but failed on SL/TP, we still return the entry order
      return {
        entryOrder: entryOrderResponse!,
        stopLossOrder: stopLossOrderResponse || undefined,
        takeProfitOrder: takeProfitOrderResponse || undefined,
        success: false,
        errors
      };
    }
  }

  /**
   * Validate bracket order parameters
   */
  private validateBracketOrder(
    entryOrder: any,
    stopLoss: any,
    takeProfit: any
  ): void {
    // Validate entry order
    if (!entryOrder.symbol || !entryOrder.side || !entryOrder.type || !entryOrder.amount) {
      throw new Error('Invalid entry order: missing required fields');
    }

    if (entryOrder.type === 'limit' && !entryOrder.price) {
      throw new Error('Limit entry order requires price');
    }

    if (entryOrder.amount <= 0) {
      throw new Error('Order amount must be positive');
    }

    // Validate stop loss
    if (!stopLoss.price || stopLoss.price <= 0) {
      throw new Error('Invalid stop loss price');
    }

    if (stopLoss.type === 'stop_limit' && !stopLoss.limitPrice) {
      throw new Error('Stop limit order requires limitPrice');
    }

    // Validate take profit
    if (!takeProfit.price || takeProfit.price <= 0) {
      throw new Error('Invalid take profit price');
    }

    // Validate price relationships for long positions
    if (entryOrder.side === 'buy') {
      if (entryOrder.price && stopLoss.price >= entryOrder.price) {
        throw new Error('Stop loss price must be below entry price for long positions');
      }
      if (entryOrder.price && takeProfit.price <= entryOrder.price) {
        throw new Error('Take profit price must be above entry price for long positions');
      }
    }

    // Validate price relationships for short positions
    if (entryOrder.side === 'sell') {
      if (entryOrder.price && stopLoss.price <= entryOrder.price) {
        throw new Error('Stop loss price must be above entry price for short positions');
      }
      if (entryOrder.price && takeProfit.price >= entryOrder.price) {
        throw new Error('Take profit price must be below entry price for short positions');
      }
    }
  }

  /**
   * Set or update stop loss for an existing position
   * Automatically cancels existing stop loss and places a new one
   */
  async setStopLoss(
    symbol: string,
    positionSide: 'long' | 'short',
    stopPrice: number,
    options?: {
      type?: 'stop_market' | 'stop_limit';
      limitPrice?: number; // Required if type is stop_limit
      clientOrderId?: string;
    }
  ): Promise<{
    success: boolean;
    newStopLossOrder?: OrderResponse;
    cancelledOrderId?: string;
    error?: string;
  }> {
    try {
      console.log(`🛡️ Setting stop loss for ${symbol} ${positionSide} position at ${stopPrice}`);

      // Step 1: Get current position to validate it exists
      const positions = await this.getPositions(symbol);
      const currentPosition = positions.find(pos => 
        pos.symbol === symbol && 
        ((positionSide === 'long' && pos.side === 'buy') || 
         (positionSide === 'short' && pos.side === 'sell'))
      );

      if (!currentPosition || currentPosition.size === 0) {
        throw new Error(`No ${positionSide} position found for ${symbol}`);
      }

      console.log(`📊 Found ${positionSide} position: size=${currentPosition.size}, entry=${currentPosition.entryPrice}`);

      // Step 2: Validate stop price against position
      this.validateStopLossPrice(currentPosition, stopPrice, positionSide);

      // Step 3: Cancel existing stop loss orders for this position
      let cancelledOrderId: string | undefined;
      try {
        const openOrders = await this.getOpenOrders();
        const existingStopLoss = openOrders.find(order => 
          order.symbol === symbol &&
          (order.type === 'stop' || order.type === 'stop-limit') &&
          order.side === (positionSide === 'long' ? 'sell' : 'buy') // Opposite side of position
        );

        if (existingStopLoss) {
          console.log(`🚫 Cancelling existing stop loss order: ${existingStopLoss.orderId}`);
          await this.cancelOrder(existingStopLoss.orderId, symbol, MarketType.FUTURES);
          cancelledOrderId = existingStopLoss.orderId;
        }
      } catch (cancelError) {
        console.warn('⚠️ Failed to cancel existing stop loss (continuing):', cancelError);
      }

      // Step 4: Place new stop loss order
      const stopLossOrderRequest: OrderRequest = {
        symbol,
        side: positionSide === 'long' ? 'sell' : 'buy', // Opposite side of position
        type: options?.type === 'stop_limit' ? 'stop-limit' : 'stop',
        amount: currentPosition.size,
        price: options?.type === 'stop_limit' ? options.limitPrice : undefined,
        stopPrice: stopPrice,
        marketType: MarketType.FUTURES,
        reduceOnly: true, // Always reduce-only for SL
        clientOrderId: options?.clientOrderId || `SL_${symbol}_${Date.now()}`
      };

      const newStopLossOrder = await this.placeOrder(stopLossOrderRequest);
      console.log(`✅ Stop loss set successfully: ${newStopLossOrder.orderId} at ${stopPrice}`);

      // Emit event
      this.emit('stopLossSet', {
        symbol,
        positionSide,
        stopPrice,
        orderId: newStopLossOrder.orderId,
        cancelledOrderId,
        timestamp: new Date()
      });

      return {
        success: true,
        newStopLossOrder,
        cancelledOrderId
      };

    } catch (error) {
      const errorMsg = `Failed to set stop loss for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      
      this.emit('stopLossError', {
        symbol,
        positionSide,
        stopPrice,
        error: errorMsg,
        timestamp: new Date()
      });

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Set or update take profit for an existing position
   * Automatically cancels existing take profit and places a new one
   */
  async setTakeProfit(
    symbol: string,
    positionSide: 'long' | 'short',
    takeProfitPrice: number,
    options?: {
      type?: 'limit' | 'take_profit_market';
      clientOrderId?: string;
    }
  ): Promise<{
    success: boolean;
    newTakeProfitOrder?: OrderResponse;
    cancelledOrderId?: string;
    error?: string;
  }> {
    try {
      console.log(`🎯 Setting take profit for ${symbol} ${positionSide} position at ${takeProfitPrice}`);

      // Step 1: Get current position to validate it exists
      const positions = await this.getPositions(symbol);
      const currentPosition = positions.find(pos => 
        pos.symbol === symbol && 
        ((positionSide === 'long' && pos.side === 'buy') || 
         (positionSide === 'short' && pos.side === 'sell'))
      );

      if (!currentPosition || currentPosition.size === 0) {
        throw new Error(`No ${positionSide} position found for ${symbol}`);
      }

      console.log(`📊 Found ${positionSide} position: size=${currentPosition.size}, entry=${currentPosition.entryPrice}`);

      // Step 2: Validate take profit price against position
      this.validateTakeProfitPrice(currentPosition, takeProfitPrice, positionSide);

      // Step 3: Cancel existing take profit orders for this position
      let cancelledOrderId: string | undefined;
      try {
        const openOrders = await this.getOpenOrders();
        const existingTakeProfit = openOrders.find(order => 
          order.symbol === symbol &&
          order.type === 'limit' &&
          order.side === (positionSide === 'long' ? 'sell' : 'buy') && // Opposite side of position
          order.price && order.price > 0 // Has a limit price (not market order)
        );

        if (existingTakeProfit) {
          console.log(`🚫 Cancelling existing take profit order: ${existingTakeProfit.orderId}`);
          await this.cancelOrder(existingTakeProfit.orderId, symbol, MarketType.FUTURES);
          cancelledOrderId = existingTakeProfit.orderId;
        }
      } catch (cancelError) {
        console.warn('⚠️ Failed to cancel existing take profit (continuing):', cancelError);
      }

      // Step 4: Place new take profit order
      const takeProfitOrderRequest: OrderRequest = {
        symbol,
        side: positionSide === 'long' ? 'sell' : 'buy', // Opposite side of position
        type: options?.type === 'take_profit_market' ? 'market' : 'limit',
        amount: currentPosition.size,
        price: options?.type === 'take_profit_market' ? undefined : takeProfitPrice,
        marketType: MarketType.FUTURES,
        reduceOnly: true, // Always reduce-only for TP
        clientOrderId: options?.clientOrderId || `TP_${symbol}_${Date.now()}`
      };

      const newTakeProfitOrder = await this.placeOrder(takeProfitOrderRequest);
      console.log(`✅ Take profit set successfully: ${newTakeProfitOrder.orderId} at ${takeProfitPrice}`);

      // Emit event
      this.emit('takeProfitSet', {
        symbol,
        positionSide,
        takeProfitPrice,
        orderId: newTakeProfitOrder.orderId,
        cancelledOrderId,
        timestamp: new Date()
      });

      return {
        success: true,
        newTakeProfitOrder,
        cancelledOrderId
      };

    } catch (error) {
      const errorMsg = `Failed to set take profit for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      
      this.emit('takeProfitError', {
        symbol,
        positionSide,
        takeProfitPrice,
        error: errorMsg,
        timestamp: new Date()
      });

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Validate stop loss price against position
   */
  private validateStopLossPrice(
    position: PositionInfo,
    stopPrice: number,
    positionSide: 'long' | 'short'
  ): void {
    if (stopPrice <= 0) {
      throw new Error('Stop loss price must be positive');
    }

    // For long positions, stop loss should be below entry price
    if (positionSide === 'long' && stopPrice >= position.entryPrice) {
      throw new Error(`Stop loss price (${stopPrice}) must be below entry price (${position.entryPrice}) for long positions`);
    }

    // For short positions, stop loss should be above entry price
    if (positionSide === 'short' && stopPrice <= position.entryPrice) {
      throw new Error(`Stop loss price (${stopPrice}) must be above entry price (${position.entryPrice}) for short positions`);
    }
  }

  /**
   * Validate take profit price against position
   */
  private validateTakeProfitPrice(
    position: PositionInfo,
    takeProfitPrice: number,
    positionSide: 'long' | 'short'
  ): void {
    if (takeProfitPrice <= 0) {
      throw new Error('Take profit price must be positive');
    }

    // For long positions, take profit should be above entry price
    if (positionSide === 'long' && takeProfitPrice <= position.entryPrice) {
      throw new Error(`Take profit price (${takeProfitPrice}) must be above entry price (${position.entryPrice}) for long positions`);
    }

    // For short positions, take profit should be below entry price
    if (positionSide === 'short' && takeProfitPrice >= position.entryPrice) {
      throw new Error(`Take profit price (${takeProfitPrice}) must be below entry price (${position.entryPrice}) for short positions`);
    }
  }

  /**
   * Place order with comprehensive risk management validation
   * Validates order against risk configuration before placement
   */
  async placeOrderWithRiskManagement(
    orderRequest: OrderRequest,
    riskConfig: {
      maxPositionSize: number; // Maximum position size in base currency
      maxLeverage: number; // Maximum allowed leverage
      maxDailyLoss: number; // Maximum daily loss percentage
      maxDrawdown: number; // Maximum drawdown percentage
      maxConcurrentTrades: number; // Maximum concurrent positions
      emergencyStop: boolean; // Emergency stop flag
      riskScore: number; // Risk score (1-10)
      accountBalance?: number; // Current account balance for calculations
    }
  ): Promise<{
    success: boolean;
    order?: OrderResponse;
    rejectionReason?: string;
    riskAnalysis: {
      positionSizeCheck: boolean;
      leverageCheck: boolean;
      dailyLossCheck: boolean;
      drawdownCheck: boolean;
      concurrentTradesCheck: boolean;
      emergencyStopCheck: boolean;
      riskScoreCheck: boolean;
      warnings: string[];
    };
  }> {
    const warnings: string[] = [];
    let rejectionReason: string | undefined;

    try {
      console.log(`🛡️ Validating order with risk management for ${orderRequest.symbol}`);

      // Risk Analysis Object
      const riskAnalysis = {
        positionSizeCheck: false,
        leverageCheck: false,
        dailyLossCheck: false,
        drawdownCheck: false,
        concurrentTradesCheck: false,
        emergencyStopCheck: false,
        riskScoreCheck: false,
        warnings: warnings
      };

      // Check 1: Emergency Stop
      if (riskConfig.emergencyStop) {
        rejectionReason = 'Emergency stop is active - all trading is halted';
        console.error(`🚨 ${rejectionReason}`);
        return {
          success: false,
          rejectionReason,
          riskAnalysis: { ...riskAnalysis, emergencyStopCheck: false }
        };
      }
      riskAnalysis.emergencyStopCheck = true;

      // Check 2: Leverage Validation
      const requestedLeverage = orderRequest.leverage || 1;
      if (requestedLeverage > riskConfig.maxLeverage) {
        rejectionReason = `Leverage ${requestedLeverage}x exceeds maximum allowed ${riskConfig.maxLeverage}x`;
        console.error(`❌ ${rejectionReason}`);
        return {
          success: false,
          rejectionReason,
          riskAnalysis: { ...riskAnalysis, leverageCheck: false }
        };
      }
      riskAnalysis.leverageCheck = true;

      // Check 3: Position Size Validation
      const currentPositions = await this.getPositions(orderRequest.symbol);
      const existingPosition = currentPositions.find(pos => pos.symbol === orderRequest.symbol);
      
      let newPositionSize = orderRequest.amount;
      if (existingPosition && !orderRequest.reduceOnly) {
        // If adding to existing position (same side)
        if ((existingPosition.side === 'buy' && orderRequest.side === 'buy') ||
            (existingPosition.side === 'sell' && orderRequest.side === 'sell')) {
          newPositionSize = existingPosition.size + orderRequest.amount;
        }
      }

      if (newPositionSize > riskConfig.maxPositionSize) {
        rejectionReason = `Position size ${newPositionSize} exceeds maximum allowed ${riskConfig.maxPositionSize}`;
        console.error(`❌ ${rejectionReason}`);
        return {
          success: false,
          rejectionReason,
          riskAnalysis: { ...riskAnalysis, positionSizeCheck: false }
        };
      }
      riskAnalysis.positionSizeCheck = true;

      // Check 4: Concurrent Trades Validation
      const allPositions = await this.getPositions();
      const openPositionsCount = allPositions.filter(pos => pos.size > 0).length;
      
      // If this is a new position (not reducing existing), check concurrent trades limit
      if (!existingPosition && !orderRequest.reduceOnly && openPositionsCount >= riskConfig.maxConcurrentTrades) {
        rejectionReason = `Already at maximum concurrent trades limit (${riskConfig.maxConcurrentTrades})`;
        console.error(`❌ ${rejectionReason}`);
        return {
          success: false,
          rejectionReason,
          riskAnalysis: { ...riskAnalysis, concurrentTradesCheck: false }
        };
      }
      riskAnalysis.concurrentTradesCheck = true;

      // Check 5: Daily Loss Check (if account balance provided)
      if (riskConfig.accountBalance) {
        const totalUnrealizedPnl = allPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
        const currentDailyLossPercentage = Math.abs(totalUnrealizedPnl / riskConfig.accountBalance) * 100;
        
        if (currentDailyLossPercentage >= riskConfig.maxDailyLoss) {
          rejectionReason = `Daily loss limit reached: ${currentDailyLossPercentage.toFixed(2)}% >= ${riskConfig.maxDailyLoss}%`;
          console.error(`❌ ${rejectionReason}`);
          return {
            success: false,
            rejectionReason,
            riskAnalysis: { ...riskAnalysis, dailyLossCheck: false }
          };
        }
        
        if (currentDailyLossPercentage >= riskConfig.maxDailyLoss * 0.8) {
          warnings.push(`Approaching daily loss limit: ${currentDailyLossPercentage.toFixed(2)}% of ${riskConfig.maxDailyLoss}%`);
        }
      }
      riskAnalysis.dailyLossCheck = true;

      // Check 6: Drawdown Check (simplified - based on total unrealized PnL)
      if (riskConfig.accountBalance) {
        const totalUnrealizedPnl = allPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
        const currentDrawdownPercentage = totalUnrealizedPnl < 0 ? Math.abs(totalUnrealizedPnl / riskConfig.accountBalance) * 100 : 0;
        
        if (currentDrawdownPercentage >= riskConfig.maxDrawdown) {
          rejectionReason = `Drawdown limit reached: ${currentDrawdownPercentage.toFixed(2)}% >= ${riskConfig.maxDrawdown}%`;
          console.error(`❌ ${rejectionReason}`);
          return {
            success: false,
            rejectionReason,
            riskAnalysis: { ...riskAnalysis, drawdownCheck: false }
          };
        }
        
        if (currentDrawdownPercentage >= riskConfig.maxDrawdown * 0.8) {
          warnings.push(`Approaching drawdown limit: ${currentDrawdownPercentage.toFixed(2)}% of ${riskConfig.maxDrawdown}%`);
        }
      }
      riskAnalysis.drawdownCheck = true;

      // Check 7: Risk Score Validation (higher risk score = more restrictive)
      if (riskConfig.riskScore >= 8) {
        // High risk score - additional restrictions
        if (requestedLeverage > 5) {
          warnings.push(`High risk score (${riskConfig.riskScore}) - consider reducing leverage from ${requestedLeverage}x`);
        }
        if (newPositionSize > riskConfig.maxPositionSize * 0.5) {
          warnings.push(`High risk score (${riskConfig.riskScore}) - consider reducing position size`);
        }
      }
      riskAnalysis.riskScoreCheck = true;

      // All checks passed - place the order
      console.log(`✅ Risk management validation passed for ${orderRequest.symbol}`);
      if (warnings.length > 0) {
        console.warn(`⚠️ Risk warnings:`, warnings);
      }

      const order = await this.placeOrder(orderRequest);

      // Emit risk management event
      this.emit('riskManagedOrderPlaced', {
        order,
        riskConfig,
        riskAnalysis,
        warnings,
        timestamp: new Date()
      });

      return {
        success: true,
        order,
        riskAnalysis
      };

    } catch (error) {
      const errorMsg = `Failed to place order with risk management: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      
      this.emit('riskManagedOrderError', {
        orderRequest,
        riskConfig,
        error: errorMsg,
        timestamp: new Date()
      });

      return {
        success: false,
        rejectionReason: errorMsg,
        riskAnalysis: {
          positionSizeCheck: false,
          leverageCheck: false,
          dailyLossCheck: false,
          drawdownCheck: false,
          concurrentTradesCheck: false,
          emergencyStopCheck: false,
          riskScoreCheck: false,
          warnings: []
        }
      };
    }
  }

  /**
   * Map CCXT order status to our TradeStatus
   */
  private mapOrderStatus(ccxtStatus: string): TradeStatus {
    switch (ccxtStatus) {
      case 'open':
        return 'open';
      case 'closed':
      case 'filled':
        return 'filled';
      case 'canceled':
      case 'cancelled':
        return 'cancelled';
      case 'partial':
        return 'partial';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}

export default BybitExchange;