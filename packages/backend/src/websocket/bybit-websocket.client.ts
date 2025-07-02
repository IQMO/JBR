import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { MarketDataMessage, Exchange } from '@jabbr/shared';

/**
 * Bybit WebSocket message types
 */
interface BybitWebSocketMessage {
  topic?: string;
  type?: string;
  data?: any;
  ts?: number;
  success?: boolean;
  ret_msg?: string;
  conn_id?: string;
  req_id?: string;
}

/**
 * Subscription configuration
 */
interface SubscriptionConfig {
  topic: string;
  symbol?: string;
  interval?: string;
}

/**
 * Bybit WebSocket Client
 * Handles real-time market data from Bybit exchange
 */
export class BybitWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Configuration
  private readonly BYBIT_WS_URL = 'wss://stream.bybit.com/v5/public/spot';
  private readonly BYBIT_WS_URL_TESTNET = 'wss://stream-testnet.bybit.com/v5/public/spot';
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private readonly HEARTBEAT_INTERVAL = 20000; // 20 seconds
  private readonly CONNECTION_TIMEOUT = 10000; // 10 seconds

  private isTestnet: boolean;

  constructor(isTestnet: boolean = true) {
    super();
    this.isTestnet = isTestnet;
  }

  /**
   * Connect to Bybit WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📡 Already connected to Bybit WebSocket');
      return;
    }

    if (this.isConnecting) {
      console.log('📡 Connection to Bybit WebSocket already in progress');
      return;
    }

    this.isConnecting = true;
    const wsUrl = this.isTestnet ? this.BYBIT_WS_URL_TESTNET : this.BYBIT_WS_URL;

    try {
      console.log(`📡 Connecting to Bybit WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl, {
        handshakeTimeout: this.CONNECTION_TIMEOUT
      });

      this.setupEventHandlers();

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.CONNECTION_TIMEOUT);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.isConnecting = false;
      this.reconnectAttempts = 0;
      console.log('✅ Connected to Bybit WebSocket');
      
      // Start heartbeat
      this.startHeartbeat();

      // Re-subscribe to previous subscriptions
      await this.resubscribeAll();

      this.emit('connected');

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Failed to connect to Bybit WebSocket:', error);
      this.emit('error', error);
      
      // Schedule reconnection
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from Bybit WebSocket
   */
  disconnect(): void {
    console.log('📡 Disconnecting from Bybit WebSocket');

    // Clear intervals and timeouts
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnecting');
      }
      this.ws = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    console.log('✅ Disconnected from Bybit WebSocket');
    this.emit('disconnected');
  }

  /**
   * Subscribe to market data
   */
  async subscribe(topic: string, symbol?: string): Promise<void> {
    const subscriptionKey = this.getSubscriptionKey(topic, symbol);
    const subscription: SubscriptionConfig = { topic, symbol };

    // Store subscription for reconnection
    this.subscriptions.set(subscriptionKey, subscription);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`📺 Queued subscription: ${subscriptionKey} (not connected)`);
      return;
    }

    try {
      const subscribeMessage = {
        op: 'subscribe',
        args: symbol ? [`${topic}.${symbol}`] : [topic]
      };

      console.log(`📺 Subscribing to Bybit: ${subscriptionKey}`);
      this.ws.send(JSON.stringify(subscribeMessage));

    } catch (error) {
      console.error(`❌ Failed to subscribe to ${subscriptionKey}:`, error);
      this.emit('error', error);
    }
  }

  /**
   * Unsubscribe from market data
   */
  async unsubscribe(topic: string, symbol?: string): Promise<void> {
    const subscriptionKey = this.getSubscriptionKey(topic, symbol);
    
    // Remove from stored subscriptions
    this.subscriptions.delete(subscriptionKey);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`📺 Queued unsubscription: ${subscriptionKey} (not connected)`);
      return;
    }

    try {
      const unsubscribeMessage = {
        op: 'unsubscribe',
        args: symbol ? [`${topic}.${symbol}`] : [topic]
      };

      console.log(`📺 Unsubscribing from Bybit: ${subscriptionKey}`);
      this.ws.send(JSON.stringify(unsubscribeMessage));

    } catch (error) {
      console.error(`❌ Failed to unsubscribe from ${subscriptionKey}:`, error);
      this.emit('error', error);
    }
  }

  /**
   * Subscribe to ticker data for a symbol
   */
  async subscribeToTicker(symbol: string): Promise<void> {
    await this.subscribe('tickers', symbol);
  }

  /**
   * Subscribe to orderbook data for a symbol
   */
  async subscribeToOrderbook(symbol: string, depth: number = 50): Promise<void> {
    await this.subscribe(`orderbook.${depth}`, symbol);
  }

  /**
   * Subscribe to trade data for a symbol
   */
  async subscribeToTrades(symbol: string): Promise<void> {
    await this.subscribe('publicTrade', symbol);
  }

  /**
   * Subscribe to kline/candlestick data
   */
  async subscribeToKline(symbol: string, interval: string = '1m'): Promise<void> {
    await this.subscribe(`kline.${interval}`, symbol);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', this.handleOpen.bind(this));
    this.ws.on('message', this.handleMessage.bind(this));
    this.ws.on('close', this.handleClose.bind(this));
    this.ws.on('error', this.handleError.bind(this));
    this.ws.on('ping', this.handlePing.bind(this));
    this.ws.on('pong', this.handlePong.bind(this));
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('✅ Bybit WebSocket connection opened');
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: Buffer): void {
    try {
      const message: BybitWebSocketMessage = JSON.parse(data.toString());

      // Handle different message types
      if (message.success !== undefined) {
        // Subscription response
        this.handleSubscriptionResponse(message);
      } else if (message.topic) {
        // Market data update
        this.handleMarketData(message);
      } else if (message.type === 'pong') {
        // Pong response
        console.log('💓 Received pong from Bybit');
      } else {
        console.log('📨 Unknown Bybit message:', message);
      }

    } catch (error) {
      console.error('❌ Failed to parse Bybit message:', error);
    }
  }

  /**
   * Handle subscription response
   */
  private handleSubscriptionResponse(message: BybitWebSocketMessage): void {
    if (message.success) {
      console.log(`✅ Bybit subscription successful: ${message.req_id}`);
    } else {
      console.error(`❌ Bybit subscription failed: ${message.ret_msg}`);
    }
  }

  /**
   * Handle market data updates
   */
  private handleMarketData(message: BybitWebSocketMessage): void {
    try {
      const topic = message.topic!;
      const data = message.data;
      const timestamp = message.ts ? new Date(message.ts) : new Date();

      // Parse topic to get type and symbol
      const [topicType, symbol] = this.parseTopic(topic);

      if (topicType === 'tickers' && data) {
        // Handle ticker data
        const tickerData = Array.isArray(data) ? data[0] : data;
        const marketData: MarketDataMessage = {
          symbol: tickerData.symbol || symbol,
          price: parseFloat(tickerData.lastPrice || tickerData.price || '0'),
          volume: parseFloat(tickerData.volume24h || tickerData.volume || '0'),
          timestamp,
          exchange: 'bybit' as Exchange
        };

        this.emit('marketData', marketData);
        this.emit('ticker', { symbol: marketData.symbol, data: tickerData, timestamp });

      } else if (topicType === 'publicTrade' && data) {
        // Handle trade data
        const trades = Array.isArray(data) ? data : [data];
        for (const trade of trades) {
          this.emit('trade', {
            symbol: trade.s || symbol,
            price: parseFloat(trade.p || '0'),
            quantity: parseFloat(trade.v || '0'),
            side: trade.S || 'unknown',
            timestamp: new Date(trade.T || timestamp),
            tradeId: trade.i
          });
        }

      } else if (topicType.startsWith('orderbook') && data) {
        // Handle orderbook data
        this.emit('orderbook', {
          symbol: data.s || symbol,
          bids: data.b || [],
          asks: data.a || [],
          timestamp: new Date(data.u || timestamp)
        });

      } else if (topicType.startsWith('kline') && data) {
        // Handle kline/candlestick data
        const klines = Array.isArray(data) ? data : [data];
        for (const kline of klines) {
          this.emit('kline', {
            symbol: kline.symbol || symbol,
            interval: topicType.split('.')[1],
            open: parseFloat(kline.open || '0'),
            high: parseFloat(kline.high || '0'),
            low: parseFloat(kline.low || '0'),
            close: parseFloat(kline.close || '0'),
            volume: parseFloat(kline.volume || '0'),
            timestamp: new Date(kline.start || timestamp)
          });
        }
      }

    } catch (error) {
      console.error('❌ Failed to process market data:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
    console.log(`❌ Bybit WebSocket closed: ${code} - ${reason.toString()}`);
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.emit('disconnected', { code, reason: reason.toString() });

    // Schedule reconnection if not intentional disconnect
    if (code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Error): void {
    console.error('❌ Bybit WebSocket error:', error);
    this.emit('error', error);
  }

  /**
   * Handle ping from server
   */
  private handlePing(data: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong(data);
    }
  }

  /**
   * Handle pong from server
   */
  private handlePong(): void {
    console.log('💓 Received pong from Bybit');
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const pingMessage = { op: 'ping' };
        this.ws.send(JSON.stringify(pingMessage));
        console.log('💓 Sent ping to Bybit');
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log('💓 Bybit heartbeat started');
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5)); // Exponential backoff

    console.log(`🔄 Scheduling Bybit reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('❌ Reconnection attempt failed:', error);
      }
    }, delay);
  }

  /**
   * Re-subscribe to all stored subscriptions
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) return;

    console.log(`📺 Re-subscribing to ${this.subscriptions.size} Bybit subscriptions`);

    for (const [key, subscription] of this.subscriptions) {
      try {
        await this.subscribe(subscription.topic, subscription.symbol);
        // Small delay between subscriptions
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to re-subscribe to ${key}:`, error);
      }
    }
  }

  /**
   * Generate subscription key
   */
  private getSubscriptionKey(topic: string, symbol?: string): string {
    return symbol ? `${topic}.${symbol}` : topic;
  }

  /**
   * Parse topic string to extract type and symbol
   */
  private parseTopic(topic: string): [string, string] {
    const parts = topic.split('.');
    if (parts.length >= 2) {
      return [parts[0] || '', parts[parts.length - 1] || ''];
    }
    return [topic, ''];
  }
}

// Export for use in other modules
export default BybitWebSocketClient; 