"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketBridge = void 0;
const events_1 = require("events");
const bybit_websocket_client_1 = __importDefault(require("./bybit-websocket.client"));
const shared_1 = require("@jabbr/shared");
class WebSocketBridge extends events_1.EventEmitter {
    wsServer;
    bybitClient;
    subscriptions = new Map();
    isInitialized = false;
    constructor(wsServer) {
        super();
        this.wsServer = wsServer;
        this.bybitClient = new bybit_websocket_client_1.default(true);
    }
    async initialize() {
        if (this.isInitialized) {
            console.log('🌉 WebSocket bridge already initialized');
            return;
        }
        console.log('🌉 Initializing WebSocket bridge...');
        try {
            this.setupInternalServerHandlers();
            this.setupBybitHandlers();
            await this.bybitClient.connect();
            this.isInitialized = true;
            console.log('✅ WebSocket bridge initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize WebSocket bridge:', error);
            this.emit('error', error);
            throw error;
        }
    }
    async shutdown() {
        console.log('🌉 Shutting down WebSocket bridge...');
        if (this.bybitClient) {
            this.bybitClient.disconnect();
        }
        this.subscriptions.clear();
        this.isInitialized = false;
        console.log('✅ WebSocket bridge shutdown complete');
        this.emit('shutdown');
    }
    setupInternalServerHandlers() {
        console.log('📡 Setting up internal WebSocket server handlers');
    }
    setupBybitHandlers() {
        this.bybitClient.on('marketData', (data) => {
            this.handleMarketData('bybit', data);
        });
        this.bybitClient.on('ticker', (data) => {
            this.handleTickerData('bybit', data);
        });
        this.bybitClient.on('trade', (data) => {
            this.handleTradeData('bybit', data);
        });
        this.bybitClient.on('orderbook', (data) => {
            this.handleOrderbookData('bybit', data);
        });
        this.bybitClient.on('kline', (data) => {
            this.handleKlineData('bybit', data);
        });
        this.bybitClient.on('connected', () => {
            console.log('✅ Bybit client connected to bridge');
            this.broadcastSystemHealth();
        });
        this.bybitClient.on('disconnected', () => {
            console.log('❌ Bybit client disconnected from bridge');
            this.broadcastSystemHealth();
        });
        this.bybitClient.on('error', (error) => {
            console.error('❌ Bybit client error in bridge:', error);
            this.broadcastError('bybit', error.message);
        });
        console.log('📡 Bybit client handlers configured');
    }
    handleMarketData(exchange, data) {
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA, {
            type: 'data',
            data: {
                ...data,
                exchange,
                timestamp: new Date().toISOString()
            }
        });
        const symbolChannel = `${shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA}.${data.symbol}`;
        this.wsServer.broadcast(symbolChannel, {
            type: 'data',
            data: {
                ...data,
                exchange,
                timestamp: new Date().toISOString()
            }
        });
    }
    handleTickerData(exchange, data) {
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA, {
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
    handleTradeData(exchange, data) {
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.TRADES, {
            type: 'data',
            data: {
                type: 'trade',
                exchange,
                ...data,
                timestamp: new Date().toISOString()
            }
        });
    }
    handleOrderbookData(exchange, data) {
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA, {
            type: 'data',
            data: {
                type: 'orderbook',
                exchange,
                ...data,
                timestamp: new Date().toISOString()
            }
        });
    }
    handleKlineData(exchange, data) {
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA, {
            type: 'data',
            data: {
                type: 'kline',
                exchange,
                ...data,
                timestamp: new Date().toISOString()
            }
        });
    }
    async subscribeToMarketData(symbol, exchange = 'bybit') {
        const subscriptionKey = `market-data.${exchange}.${symbol}`;
        if (this.subscriptions.has(subscriptionKey)) {
            console.log(`📺 Already subscribed to ${subscriptionKey}`);
            return;
        }
        try {
            if (exchange === 'bybit') {
                await Promise.all([
                    this.bybitClient.subscribeToTicker(symbol),
                    this.bybitClient.subscribeToTrades(symbol),
                    this.bybitClient.subscribeToOrderbook(symbol, 50)
                ]);
                this.subscriptions.set(subscriptionKey, {
                    channel: shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA,
                    symbol,
                    exchange,
                    subscribers: new Set()
                });
                console.log(`✅ Subscribed to market data: ${symbol} on ${exchange}`);
            }
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to market data for ${symbol}:`, error);
            throw error;
        }
    }
    async unsubscribeFromMarketData(symbol, exchange = 'bybit') {
        const subscriptionKey = `market-data.${exchange}.${symbol}`;
        if (!this.subscriptions.has(subscriptionKey)) {
            console.log(`📺 Not subscribed to ${subscriptionKey}`);
            return;
        }
        try {
            if (exchange === 'bybit') {
                await Promise.all([
                    this.bybitClient.unsubscribe('tickers', symbol),
                    this.bybitClient.unsubscribe('publicTrade', symbol),
                    this.bybitClient.unsubscribe('orderbook.50', symbol)
                ]);
                this.subscriptions.delete(subscriptionKey);
                console.log(`✅ Unsubscribed from market data: ${symbol} on ${exchange}`);
            }
        }
        catch (error) {
            console.error(`❌ Failed to unsubscribe from market data for ${symbol}:`, error);
            throw error;
        }
    }
    async subscribeToKlineData(symbol, interval = '1m', exchange = 'bybit') {
        try {
            if (exchange === 'bybit') {
                await this.bybitClient.subscribeToKline(symbol, interval);
                console.log(`✅ Subscribed to kline data: ${symbol} ${interval} on ${exchange}`);
            }
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to kline data for ${symbol}:`, error);
            throw error;
        }
    }
    broadcastSystemHealth() {
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
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH, {
            type: 'data',
            data: healthData
        });
    }
    broadcastError(source, message) {
        this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH, {
            type: 'error',
            data: {
                source,
                error: message,
                timestamp: new Date().toISOString()
            }
        });
    }
    getStats() {
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
    async handleClientSubscription(channel, symbol, exchange = 'bybit') {
        if (channel === shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA && symbol) {
            await this.subscribeToMarketData(symbol, exchange);
        }
    }
    async handleClientUnsubscription(channel, symbol, exchange = 'bybit') {
        if (channel === shared_1.CONSTANTS.WS_CHANNELS.MARKET_DATA && symbol) {
            await this.unsubscribeFromMarketData(symbol, exchange);
        }
    }
    async testConnections() {
        const results = {};
        try {
            if (!this.bybitClient.isConnected()) {
                await this.bybitClient.connect();
            }
            results.bybit = this.bybitClient.isConnected();
        }
        catch (error) {
            results.bybit = false;
        }
        return results;
    }
    async subscribeToPopularPairs() {
        const popularPairs = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'];
        console.log('📺 Subscribing to popular trading pairs...');
        for (const symbol of popularPairs) {
            try {
                await this.subscribeToMarketData(symbol, 'bybit');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                console.error(`❌ Failed to subscribe to ${symbol}:`, error);
            }
        }
        console.log(`✅ Subscribed to ${popularPairs.length} popular trading pairs`);
    }
}
exports.WebSocketBridge = WebSocketBridge;
exports.default = WebSocketBridge;
//# sourceMappingURL=websocket-bridge.js.map