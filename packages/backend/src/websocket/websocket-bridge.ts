import { EventEmitter } from 'events';
import JabbrWebSocketServer from './websocket-server';
import BybitWebSocketClient from './bybit-websocket.client';
import { MarketDataMessage, CONSTANTS } from '@jabbr/shared';

/**
 * Subscription tracking
 */
interface SubscriptionInfo {
  channel: string;
  symbol?: string;
  exchange: string;
  subscribers: Set<string>; // session IDs
}

/**
 * WebSocket Bridge
 * Connects internal WebSocket server with external exchange clients
 * Manages subscriptions and data flow between clients and exchanges
 */
export class WebSocketBridge extends EventEmitter {
  private wsServer: JabbrWebSocketServer;
  private bybitClient: BybitWebSocketClient;
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private isInitialized = false;

  constructor(wsServer: JabbrWebSocketServer) {
    super();
    this.wsServer = wsServer;
    this.bybitClient = new BybitWebSocketClient(true); // Start with testnet
  }

  /**
   * Initialize the bridge and connect to exchanges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🌉 WebSocket bridge already initialized');
      return;
    }

    console.log('🌉 Initializing WebSocket bridge...');

    try {
      // Setup event handlers for internal WebSocket server
      this.setupInternalServerHandlers();

      // Setup event handlers for exchange clients
      this.setupBybitHandlers();

      // Connect to Bybit
      await this.bybitClient.connect();

      this.isInitialized = true;
      console.log('✅ WebSocket bridge initialized successfully');
      
      this.emit('initialized');

    } catch (error) {
      console.error('❌ Failed to initialize WebSocket bridge:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Shutdown the bridge
   */
  async shutdown(): Promise<void> {
    console.log('🌉 Shutting down WebSocket bridge...');

    // Disconnect from exchanges
    if (this.bybitClient) {
      this.bybitClient.disconnect();
    }

    // Clear subscriptions
    this.subscriptions.clear();

    this.isInitialized = false;
    console.log('✅ WebSocket bridge shutdown complete');
    
    this.emit('shutdown');
  }

  /**
   * Setup event handlers for internal WebSocket server
   */
  private setupInternalServerHandlers(): void {
    // Note: We'll hook into the WebSocket server's subscription system
    // For now, we'll create a simple interface
    console.log('📡 Setting up internal WebSocket server handlers');
  }

  /**
   * Setup event handlers for Bybit client
   */
  private setupBybitHandlers(): void {
    // Market data events
    this.bybitClient.on('marketData', (data: MarketDataMessage) => {
      this.handleMarketData('bybit', data);
    });

    this.bybitClient.on('ticker', (data: any) => {
      this.handleTickerData('bybit', data);
    });

    this.bybitClient.on('trade', (data: any) => {
      this.handleTradeData('bybit', data);
    });

    this.bybitClient.on('orderbook', (data: any) => {
      this.handleOrderbookData('bybit', data);
    });

    this.bybitClient.on('kline', (data: any) => {
      this.handleKlineData('bybit', data);
    });

    // Connection events
    this.bybitClient.on('connected', () => {
      console.log('✅ Bybit client connected to bridge');
      this.broadcastSystemHealth();
    });

    this.bybitClient.on('disconnected', () => {
      console.log('❌ Bybit client disconnected from bridge');
      this.broadcastSystemHealth();
    });

    this.bybitClient.on('error', (error: Error) => {
      console.error('❌ Bybit client error in bridge:', error);
      this.broadcastError('bybit', error.message);
    });

    console.log('📡 Bybit client handlers configured');
  }

  /**
   * Handle market data from exchanges
   */
  private handleMarketData(exchange: string, data: MarketDataMessage): void {
    // Broadcast to subscribers of market-data channel
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.MARKET_DATA, {
      type: 'data',
      data: {
        ...data,
        exchange,
        timestamp: new Date().toISOString()
      }
    });

    // Also broadcast to symbol-specific channel if subscribers exist
    const symbolChannel = `${CONSTANTS.WS_CHANNELS.MARKET_DATA}.${data.symbol}`;
    this.wsServer.broadcast(symbolChannel, {
      type: 'data',
      data: {
        ...data,
        exchange,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle ticker data from exchanges
   */
  private handleTickerData(exchange: string, data: any): void {
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.MARKET_DATA, {
      type: 'data',
      data: {
        type: 'ticker',
        exchange,
        symbol: data.symbol,
        data: data.data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle trade data from exchanges
   */
  private handleTradeData(exchange: string, data: any): void {
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.TRADES, {
      type: 'data',
      data: {
        type: 'trade',
        exchange,
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle orderbook data from exchanges
   */
  private handleOrderbookData(exchange: string, data: any): void {
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.MARKET_DATA, {
      type: 'data',
      data: {
        type: 'orderbook',
        exchange,
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle kline/candlestick data from exchanges
   */
  private handleKlineData(exchange: string, data: any): void {
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.MARKET_DATA, {
      type: 'data',
      data: {
        type: 'kline',
        exchange,
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Subscribe to market data for a symbol
   */
  async subscribeToMarketData(symbol: string, exchange: string = 'bybit'): Promise<void> {
    const subscriptionKey = `market-data.${exchange}.${symbol}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`📺 Already subscribed to ${subscriptionKey}`);
      return;
    }

    try {
      if (exchange === 'bybit') {
        // Subscribe to multiple data types for the symbol
        await Promise.all([
          this.bybitClient.subscribeToTicker(symbol),
          this.bybitClient.subscribeToTrades(symbol),
          this.bybitClient.subscribeToOrderbook(symbol, 50)
        ]);

        // Track subscription
        this.subscriptions.set(subscriptionKey, {
          channel: CONSTANTS.WS_CHANNELS.MARKET_DATA,
          symbol,
          exchange,
          subscribers: new Set()
        });

        console.log(`✅ Subscribed to market data: ${symbol} on ${exchange}`);
      }
    } catch (error) {
      console.error(`❌ Failed to subscribe to market data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from market data for a symbol
   */
  async unsubscribeFromMarketData(symbol: string, exchange: string = 'bybit'): Promise<void> {
    const subscriptionKey = `market-data.${exchange}.${symbol}`;
    
    if (!this.subscriptions.has(subscriptionKey)) {
      console.log(`📺 Not subscribed to ${subscriptionKey}`);
      return;
    }

    try {
      if (exchange === 'bybit') {
        // Unsubscribe from all data types for the symbol
        await Promise.all([
          this.bybitClient.unsubscribe('tickers', symbol),
          this.bybitClient.unsubscribe('publicTrade', symbol),
          this.bybitClient.unsubscribe('orderbook.50', symbol)
        ]);

        // Remove subscription tracking
        this.subscriptions.delete(subscriptionKey);

        console.log(`✅ Unsubscribed from market data: ${symbol} on ${exchange}`);
      }
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from market data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to kline data for a symbol
   */
  async subscribeToKlineData(symbol: string, interval: string = '1m', exchange: string = 'bybit'): Promise<void> {
    try {
      if (exchange === 'bybit') {
        await this.bybitClient.subscribeToKline(symbol, interval);
        console.log(`✅ Subscribed to kline data: ${symbol} ${interval} on ${exchange}`);
      }
    } catch (error) {
      console.error(`❌ Failed to subscribe to kline data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast system health status
   */
  private broadcastSystemHealth(): void {
    const healthData = {
      exchanges: {
        bybit: {
          connected: this.bybitClient.isConnected(),
          subscriptions: this.bybitClient.getSubscriptionCount()
        }
      },
      bridge: {
        initialized: this.isInitialized,
        totalSubscriptions: this.subscriptions.size
      },
      timestamp: new Date().toISOString()
    };

    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH, {
      type: 'data',
      data: healthData
    });
  }

  /**
   * Broadcast error message
   */
  private broadcastError(source: string, message: string): void {
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH, {
      type: 'error',
      data: {
        source,
        error: message,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    initialized: boolean;
    exchanges: Record<string, any>;
    subscriptions: number;
    activeSubscriptions: string[];
  } {
    return {
      initialized: this.isInitialized,
      exchanges: {
        bybit: {
          connected: this.bybitClient.isConnected(),
          subscriptions: this.bybitClient.getSubscriptionCount(),
          activeSubscriptions: this.bybitClient.getSubscriptions()
        }
      },
      subscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.keys())
    };
  }

  /**
   * Handle client subscription requests
   * This method can be called by the WebSocket server when clients subscribe
   */
  async handleClientSubscription(channel: string, symbol?: string, exchange: string = 'bybit'): Promise<void> {
    if (channel === CONSTANTS.WS_CHANNELS.MARKET_DATA && symbol) {
      await this.subscribeToMarketData(symbol, exchange);
    }
    // Add more channel handlers as needed
  }

  /**
   * Handle client unsubscription requests
   */
  async handleClientUnsubscription(channel: string, symbol?: string, exchange: string = 'bybit'): Promise<void> {
    if (channel === CONSTANTS.WS_CHANNELS.MARKET_DATA && symbol) {
      await this.unsubscribeFromMarketData(symbol, exchange);
    }
    // Add more channel handlers as needed
  }

  /**
   * Test connection to all exchanges
   */
  async testConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test Bybit connection
    try {
      if (!this.bybitClient.isConnected()) {
        await this.bybitClient.connect();
      }
      results.bybit = this.bybitClient.isConnected();
    } catch (error) {
      results.bybit = false;
    }

    return results;
  }

  /**
   * Subscribe to popular trading pairs for demo/testing
   */
  async subscribeToPopularPairs(): Promise<void> {
    const popularPairs = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'];
    
    console.log('📺 Subscribing to popular trading pairs...');
    
    for (const symbol of popularPairs) {
      try {
        await this.subscribeToMarketData(symbol, 'bybit');
        // Small delay between subscriptions
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Failed to subscribe to ${symbol}:`, error);
      }
    }
    
    console.log(`✅ Subscribed to ${popularPairs.length} popular trading pairs`);
  }
}

// Export for use in main server
export default WebSocketBridge; 