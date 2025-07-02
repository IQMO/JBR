"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitWebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
class BybitWebSocketClient extends events_1.EventEmitter {
    ws = null;
    subscriptions = new Map();
    reconnectAttempts = 0;
    isConnecting = false;
    heartbeatInterval = null;
    reconnectTimeout = null;
    BYBIT_WS_URL = 'wss://stream.bybit.com/v5/public/spot';
    BYBIT_WS_URL_TESTNET = 'wss://stream-testnet.bybit.com/v5/public/spot';
    MAX_RECONNECT_ATTEMPTS = 10;
    RECONNECT_DELAY = 5000;
    HEARTBEAT_INTERVAL = 20000;
    CONNECTION_TIMEOUT = 10000;
    isTestnet;
    constructor(isTestnet = true) {
        super();
        this.isTestnet = isTestnet;
    }
    async connect() {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
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
            this.ws = new ws_1.default(wsUrl, {
                handshakeTimeout: this.CONNECTION_TIMEOUT
            });
            this.setupEventHandlers();
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.CONNECTION_TIMEOUT);
                this.ws.once('open', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                this.ws.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            console.log('✅ Connected to Bybit WebSocket');
            this.startHeartbeat();
            await this.resubscribeAll();
            this.emit('connected');
        }
        catch (error) {
            this.isConnecting = false;
            console.error('❌ Failed to connect to Bybit WebSocket:', error);
            this.emit('error', error);
            this.scheduleReconnect();
            throw error;
        }
    }
    disconnect() {
        console.log('📡 Disconnecting from Bybit WebSocket');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === ws_1.default.OPEN) {
                this.ws.close(1000, 'Client disconnecting');
            }
            this.ws = null;
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('✅ Disconnected from Bybit WebSocket');
        this.emit('disconnected');
    }
    async subscribe(topic, symbol) {
        const subscriptionKey = this.getSubscriptionKey(topic, symbol);
        const subscription = { topic, symbol };
        this.subscriptions.set(subscriptionKey, subscription);
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
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
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to ${subscriptionKey}:`, error);
            this.emit('error', error);
        }
    }
    async unsubscribe(topic, symbol) {
        const subscriptionKey = this.getSubscriptionKey(topic, symbol);
        this.subscriptions.delete(subscriptionKey);
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
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
        }
        catch (error) {
            console.error(`❌ Failed to unsubscribe from ${subscriptionKey}:`, error);
            this.emit('error', error);
        }
    }
    async subscribeToTicker(symbol) {
        await this.subscribe('tickers', symbol);
    }
    async subscribeToOrderbook(symbol, depth = 50) {
        await this.subscribe(`orderbook.${depth}`, symbol);
    }
    async subscribeToTrades(symbol) {
        await this.subscribe('publicTrade', symbol);
    }
    async subscribeToKline(symbol, interval = '1m') {
        await this.subscribe(`kline.${interval}`, symbol);
    }
    isConnected() {
        return this.ws?.readyState === ws_1.default.OPEN;
    }
    getSubscriptionCount() {
        return this.subscriptions.size;
    }
    getSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }
    setupEventHandlers() {
        if (!this.ws)
            return;
        this.ws.on('open', this.handleOpen.bind(this));
        this.ws.on('message', this.handleMessage.bind(this));
        this.ws.on('close', this.handleClose.bind(this));
        this.ws.on('error', this.handleError.bind(this));
        this.ws.on('ping', this.handlePing.bind(this));
        this.ws.on('pong', this.handlePong.bind(this));
    }
    handleOpen() {
        console.log('✅ Bybit WebSocket connection opened');
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.success !== undefined) {
                this.handleSubscriptionResponse(message);
            }
            else if (message.topic) {
                this.handleMarketData(message);
            }
            else if (message.type === 'pong') {
                console.log('💓 Received pong from Bybit');
            }
            else {
                console.log('📨 Unknown Bybit message:', message);
            }
        }
        catch (error) {
            console.error('❌ Failed to parse Bybit message:', error);
        }
    }
    handleSubscriptionResponse(message) {
        if (message.success) {
            console.log(`✅ Bybit subscription successful: ${message.req_id}`);
        }
        else {
            console.error(`❌ Bybit subscription failed: ${message.ret_msg}`);
        }
    }
    handleMarketData(message) {
        try {
            const topic = message.topic;
            const data = message.data;
            const timestamp = message.ts ? new Date(message.ts) : new Date();
            const [topicType, symbol] = this.parseTopic(topic);
            if (topicType === 'tickers' && data) {
                const tickerData = Array.isArray(data) ? data[0] : data;
                const marketData = {
                    symbol: tickerData.symbol || symbol,
                    price: parseFloat(tickerData.lastPrice || tickerData.price || '0'),
                    volume: parseFloat(tickerData.volume24h || tickerData.volume || '0'),
                    timestamp,
                    exchange: 'bybit'
                };
                this.emit('marketData', marketData);
                this.emit('ticker', { symbol: marketData.symbol, data: tickerData, timestamp });
            }
            else if (topicType === 'publicTrade' && data) {
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
            }
            else if (topicType.startsWith('orderbook') && data) {
                this.emit('orderbook', {
                    symbol: data.s || symbol,
                    bids: data.b || [],
                    asks: data.a || [],
                    timestamp: new Date(data.u || timestamp)
                });
            }
            else if (topicType.startsWith('kline') && data) {
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
        }
        catch (error) {
            console.error('❌ Failed to process market data:', error);
        }
    }
    handleClose(code, reason) {
        console.log(`❌ Bybit WebSocket closed: ${code} - ${reason.toString()}`);
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.emit('disconnected', { code, reason: reason.toString() });
        if (code !== 1000) {
            this.scheduleReconnect();
        }
    }
    handleError(error) {
        console.error('❌ Bybit WebSocket error:', error);
        this.emit('error', error);
    }
    handlePing(data) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.pong(data);
        }
    }
    handlePong() {
        console.log('💓 Received pong from Bybit');
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                const pingMessage = { op: 'ping' };
                this.ws.send(JSON.stringify(pingMessage));
                console.log('💓 Sent ping to Bybit');
            }
        }, this.HEARTBEAT_INTERVAL);
        console.log('💓 Bybit heartbeat started');
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error(`❌ Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`);
            this.emit('maxReconnectAttemptsReached');
            return;
        }
        this.reconnectAttempts++;
        const delay = this.RECONNECT_DELAY * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));
        console.log(`🔄 Scheduling Bybit reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(async () => {
            try {
                await this.connect();
            }
            catch (error) {
                console.error('❌ Reconnection attempt failed:', error);
            }
        }, delay);
    }
    async resubscribeAll() {
        if (this.subscriptions.size === 0)
            return;
        console.log(`📺 Re-subscribing to ${this.subscriptions.size} Bybit subscriptions`);
        for (const [key, subscription] of this.subscriptions) {
            try {
                await this.subscribe(subscription.topic, subscription.symbol);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                console.error(`❌ Failed to re-subscribe to ${key}:`, error);
            }
        }
    }
    getSubscriptionKey(topic, symbol) {
        return symbol ? `${topic}.${symbol}` : topic;
    }
    parseTopic(topic) {
        const parts = topic.split('.');
        if (parts.length >= 2) {
            return [parts[0] || '', parts[parts.length - 1] || ''];
        }
        return [topic, ''];
    }
}
exports.BybitWebSocketClient = BybitWebSocketClient;
exports.default = BybitWebSocketClient;
//# sourceMappingURL=bybit-websocket.client.js.map