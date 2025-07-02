"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BybitExchange = void 0;
const ccxt = __importStar(require("ccxt"));
const base_exchange_1 = require("./base-exchange");
const time_sync_service_1 = require("../services/time-sync.service");
class BybitExchange extends base_exchange_1.BaseExchange {
    client;
    wsConnections = new Map();
    subscriptions = new Set();
    constructor(apiKey, isTestnet = true) {
        super(apiKey, isTestnet);
        this.client = new ccxt.bybit({
            apiKey: this.apiKey.apiKey,
            secret: this.apiKey.apiSecret,
            sandbox: this.isTestnet,
            enableRateLimit: true,
            rateLimit: 120,
            options: {
                defaultType: 'swap',
                recvWindow: 60000,
                timeDifference: 0
            }
        });
        console.log(`🏦 Bybit Exchange initialized (${isTestnet ? 'TESTNET' : 'MAINNET'})`);
    }
    getName() {
        return 'bybit';
    }
    getCapabilities() {
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
                requests: 120,
                window: 60000
            }
        };
    }
    async connect() {
        try {
            console.log('🔌 Connecting to Bybit...');
            console.log('⏰ Synchronizing time with Bybit...');
            try {
                const serverTime = await this.client.fetchTime();
                const bybitServerTime = new Date(serverTime || Date.now());
                await time_sync_service_1.timeSyncService.syncWithExchange('bybit', bybitServerTime);
                const totalDrift = time_sync_service_1.timeSyncService.getTotalDrift();
                console.log(`✅ Time synchronized (drift: ${totalDrift}ms)`);
                this.client.options.timeDifference = -totalDrift;
                console.log(`🔧 Applied time correction: ${-totalDrift}ms to CCXT client`);
            }
            catch (timeError) {
                console.warn('⚠️ Time sync failed, proceeding with system time:', timeError);
            }
            await this.client.loadMarkets();
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
        }
        catch (error) {
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
    async disconnect() {
        try {
            console.log('🔌 Disconnecting from Bybit...');
            for (const [key, ws] of this.wsConnections) {
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
        }
        catch (error) {
            console.error('❌ Error disconnecting from Bybit:', error);
            throw error;
        }
    }
    async testConnection() {
        try {
            const [spotBalance, futuresBalance] = await Promise.allSettled([
                this.client.fetchBalance({ type: 'spot' }),
                this.client.fetchBalance({ type: 'swap' })
            ]);
            const spotOk = spotBalance.status === 'fulfilled';
            const futuresOk = futuresBalance.status === 'fulfilled';
            console.log(`📊 API Test Results:`);
            console.log(`   Spot API: ${spotOk ? '✅' : '❌'}`);
            console.log(`   Futures API: ${futuresOk ? '✅' : '❌'}`);
            return spotOk || futuresOk;
        }
        catch (error) {
            console.error('❌ Connection test failed:', error);
            return false;
        }
    }
    async getMarketData(symbol, marketType) {
        try {
            if (!this.checkRateLimit('getMarketData')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, marketType);
            this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
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
        }
        catch (error) {
            console.error(`❌ Failed to get market data for ${symbol}:`, error);
            throw error;
        }
    }
    async getOrderBook(symbol, marketType, depth = 50) {
        try {
            if (!this.checkRateLimit('getOrderBook')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, marketType);
            this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            const orderBook = await this.client.fetchOrderBook(formattedSymbol, depth);
            return {
                bids: orderBook.bids.map((bid) => [bid[0], bid[1]]),
                asks: orderBook.asks.map((ask) => [ask[0], ask[1]]),
                timestamp: new Date(orderBook.timestamp || Date.now())
            };
        }
        catch (error) {
            console.error(`❌ Failed to get order book for ${symbol}:`, error);
            throw error;
        }
    }
    async getRecentTrades(symbol, _marketType, limit = 50) {
        try {
            if (!this.checkRateLimit('getRecentTrades')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, _marketType);
            this.client.options.defaultType = _marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            const trades = await this.client.fetchTrades(formattedSymbol, undefined, limit);
            return trades.map((trade) => ({
                id: trade.id || '',
                price: trade.price,
                amount: trade.amount,
                side: trade.side,
                timestamp: new Date(trade.timestamp || Date.now())
            }));
        }
        catch (error) {
            console.error(`❌ Failed to get recent trades for ${symbol}:`, error);
            throw error;
        }
    }
    async getKlines(symbol, interval, _marketType, startTime, endTime, limit) {
        try {
            if (!this.checkRateLimit('getKlines')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, _marketType);
            this.client.options.defaultType = _marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            const since = startTime ? startTime.getTime() : undefined;
            const ohlcv = await this.client.fetchOHLCV(formattedSymbol, interval, since, limit);
            return ohlcv.map((candle) => ({
                timestamp: new Date(candle[0]),
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5]
            }));
        }
        catch (error) {
            console.error(`❌ Failed to get klines for ${symbol}:`, error);
            throw error;
        }
    }
    async getServerTime() {
        try {
            return time_sync_service_1.timeSyncService.getExchangeTime('bybit');
        }
        catch (error) {
            console.error('❌ Failed to get server time:', error);
            return new Date();
        }
    }
    formatSymbol(symbol, marketType) {
        if (marketType === base_exchange_1.MarketType.SPOT) {
            return symbol.toUpperCase();
        }
        else {
            return symbol.toUpperCase();
        }
    }
    parseSymbol(exchangeSymbol, marketType) {
        return exchangeSymbol.toUpperCase();
    }
    async placeOrder(orderRequest) {
        try {
            this.validateOrderRequest(orderRequest);
            if (!this.checkRateLimit('placeOrder')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(orderRequest.symbol, orderRequest.marketType);
            this.client.options.defaultType = orderRequest.marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            const orderParams = {
                symbol: formattedSymbol,
                type: orderRequest.type,
                side: orderRequest.side,
                amount: orderRequest.amount,
                price: orderRequest.price,
                params: {}
            };
            if (orderRequest.marketType === base_exchange_1.MarketType.FUTURES) {
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
            if (orderRequest.clientOrderId) {
                orderParams.params.clientOrderId = orderRequest.clientOrderId;
            }
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
            const order = await this.client.createOrder(orderParams.symbol, orderParams.type, orderParams.side, orderParams.amount, orderParams.price, orderParams.params);
            const response = {
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
            this.emit('orderPlaced', response);
            return response;
        }
        catch (error) {
            console.error(`❌ Failed to place order:`, error);
            this.emit('orderError', {
                type: 'place_order_failed',
                orderRequest,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async cancelOrder(orderId, symbol, marketType) {
        try {
            if (!this.checkRateLimit('cancelOrder')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, marketType);
            this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
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
        }
        catch (error) {
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
    async cancelAllOrders(symbol, marketType) {
        try {
            if (!this.checkRateLimit('cancelAllOrders')) {
                throw new Error('Rate limit exceeded');
            }
            console.log(`🚫 Cancelling all orders${symbol ? ` for ${symbol}` : ''}`);
            if (symbol && marketType) {
                const formattedSymbol = this.formatSymbol(symbol, marketType);
                this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
                await this.client.cancelAllOrders(formattedSymbol);
            }
            else {
                await this.client.cancelAllOrders();
            }
            console.log(`✅ All orders cancelled successfully`);
            this.emit('allOrdersCancelled', {
                symbol,
                marketType,
                timestamp: new Date()
            });
            return true;
        }
        catch (error) {
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
    async getOrder(orderId, symbol, marketType) {
        try {
            if (!this.checkRateLimit('getOrder')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, marketType);
            this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            const order = await this.client.fetchOrder(orderId, formattedSymbol);
            return {
                orderId: order.id || '',
                clientOrderId: order.clientOrderId || undefined,
                symbol,
                side: order.side,
                type: order.type,
                amount: order.amount,
                price: order.price,
                filled: order.filled || 0,
                remaining: order.remaining || 0,
                status: this.mapOrderStatus(order.status || 'pending'),
                fee: order.fee?.cost || 0,
                timestamp: new Date(order.timestamp || Date.now()),
                marketType
            };
        }
        catch (error) {
            console.error(`❌ Failed to get order ${orderId}:`, error);
            throw error;
        }
    }
    async getOpenOrders(symbol, marketType) {
        try {
            if (!this.checkRateLimit('getOpenOrders')) {
                throw new Error('Rate limit exceeded');
            }
            let formattedSymbol;
            if (symbol && marketType) {
                formattedSymbol = this.formatSymbol(symbol, marketType);
                this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            }
            const orders = await this.client.fetchOpenOrders(formattedSymbol);
            return orders.map((order) => ({
                orderId: order.id || '',
                clientOrderId: order.clientOrderId || undefined,
                symbol: this.parseSymbol(order.symbol, marketType || base_exchange_1.MarketType.FUTURES),
                side: order.side,
                type: order.type,
                amount: order.amount,
                price: order.price,
                filled: order.filled || 0,
                remaining: order.remaining || 0,
                status: this.mapOrderStatus(order.status || 'pending'),
                fee: order.fee?.cost || 0,
                timestamp: new Date(order.timestamp || Date.now()),
                marketType: marketType || base_exchange_1.MarketType.FUTURES
            }));
        }
        catch (error) {
            console.error(`❌ Failed to get open orders:`, error);
            throw error;
        }
    }
    async getOrderHistory(symbol, marketType, since) {
        try {
            console.log(`📋 Fetching order history for ${symbol} (${marketType})`);
            this.client.options.defaultType = marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            const [closedOrders, canceledOrders] = await Promise.all([
                this.client.fetchClosedOrders(symbol, since?.getTime()),
                this.client.fetchCanceledOrders(symbol, since?.getTime())
            ]);
            const allOrders = [...closedOrders, ...canceledOrders]
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            console.log(`✅ Retrieved ${allOrders.length} historical orders`);
            return allOrders.map((order) => ({
                orderId: order.id || '',
                clientOrderId: order.clientOrderId || undefined,
                symbol: order.symbol ? this.parseSymbol(order.symbol, marketType) : '',
                side: order.side,
                type: order.type,
                amount: order.amount,
                price: order.price,
                filled: order.filled || 0,
                remaining: order.remaining || 0,
                status: this.mapOrderStatus(order.status || 'pending'),
                fee: order.fee?.cost || 0,
                timestamp: new Date(order.timestamp || Date.now()),
                marketType: marketType
            }));
        }
        catch (error) {
            console.error('❌ Failed to fetch order history:', error);
            throw error;
        }
    }
    async getPositions(symbol) {
        try {
            if (!this.checkRateLimit('getPositions')) {
                throw new Error('Rate limit exceeded');
            }
            this.client.options.defaultType = 'swap';
            const positions = await this.client.fetchPositions(symbol ? [this.formatSymbol(symbol, base_exchange_1.MarketType.FUTURES)] : undefined);
            return positions
                .filter((pos) => pos.size > 0)
                .map((pos) => ({
                symbol: pos.symbol ? this.parseSymbol(pos.symbol, base_exchange_1.MarketType.FUTURES) : '',
                side: pos.side,
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
                marketType: base_exchange_1.MarketType.FUTURES
            }));
        }
        catch (error) {
            console.error(`❌ Failed to get positions:`, error);
            throw error;
        }
    }
    async setLeverage(symbol, leverage, _marketType) {
        try {
            if (!this.checkRateLimit('setLeverage')) {
                throw new Error('Rate limit exceeded');
            }
            if (leverage < 1 || leverage > 100) {
                throw new Error('Leverage must be between 1 and 100');
            }
            const formattedSymbol = this.formatSymbol(symbol, base_exchange_1.MarketType.FUTURES);
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
        }
        catch (error) {
            console.error(`❌ Failed to set leverage for ${symbol}:`, error);
            this.emit('leverageError', {
                symbol,
                leverage,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async setMarginMode(symbol, mode) {
        try {
            if (!this.checkRateLimit('setMarginMode')) {
                throw new Error('Rate limit exceeded');
            }
            const formattedSymbol = this.formatSymbol(symbol, base_exchange_1.MarketType.FUTURES);
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
        }
        catch (error) {
            console.error(`❌ Failed to set margin mode for ${symbol}:`, error);
            this.emit('marginModeError', {
                symbol,
                mode,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async setPositionMode(mode) {
        try {
            if (!this.checkRateLimit('setPositionMode')) {
                throw new Error('Rate limit exceeded');
            }
            this.client.options.defaultType = 'swap';
            console.log(`🔄 Setting position mode to ${mode}`);
            const bybitMode = mode === 'hedge';
            await this.client.setPositionMode(bybitMode);
            console.log(`✅ Position mode set to ${mode}`);
            this.emit('positionModeChanged', {
                mode,
                timestamp: new Date()
            });
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to set position mode:`, error);
            this.emit('positionModeError', {
                mode,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getBalance(_marketType) {
        try {
            if (!this.checkRateLimit('getBalance')) {
                throw new Error('Rate limit exceeded');
            }
            const balanceType = _marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
            this.client.options.defaultType = balanceType;
            console.log(`💰 Fetching ${balanceType} balance...`);
            const balance = await this.client.fetchBalance();
            if (!balance.total) {
                return [];
            }
            const balances = Object.entries(balance.total)
                .filter(([currency, total]) => typeof total === 'number' && total > 0)
                .map(([currency, total]) => ({
                currency,
                total: total,
                available: (balance.free && balance.free[currency]) || 0,
                locked: (balance.used && balance.used[currency]) || 0,
                marketType: _marketType || base_exchange_1.MarketType.FUTURES
            }));
            console.log(`✅ Retrieved ${balances.length} non-zero balances`);
            return balances;
        }
        catch (error) {
            console.error(`❌ Failed to get balance:`, error);
            throw error;
        }
    }
    async getTradingFees(symbol, _marketType) {
        try {
            if (!this.checkRateLimit('getTradingFees')) {
                throw new Error('Rate limit exceeded');
            }
            if (symbol && _marketType) {
                const formattedSymbol = this.formatSymbol(symbol, _marketType);
                this.client.options.defaultType = _marketType === base_exchange_1.MarketType.SPOT ? 'spot' : 'swap';
                console.log(`📊 Fetching trading fees for ${symbol}`);
                const fees = await this.client.fetchTradingFee(formattedSymbol);
                return {
                    maker: fees.maker || 0.0001,
                    taker: fees.taker || 0.0006
                };
            }
            else {
                console.log(`📊 Using default Bybit trading fees`);
                return {
                    maker: 0.0001,
                    taker: 0.0006
                };
            }
        }
        catch (error) {
            console.error(`❌ Failed to get trading fees:`, error);
            return {
                maker: 0.0001,
                taker: 0.0006
            };
        }
    }
    async subscribeToMarketData(symbol, marketType) {
        try {
            const formattedSymbol = this.formatSymbol(symbol, marketType);
            const subscriptionKey = `${marketType}_${formattedSymbol}`;
            if (this.subscriptions.has(subscriptionKey)) {
                console.log(`📡 Already subscribed to ${symbol} ${marketType} market data`);
                return;
            }
            console.log(`📡 Subscribing to ${symbol} ${marketType} market data...`);
            this.subscriptions.add(subscriptionKey);
            console.log(`✅ Subscribed to ${symbol} ${marketType} market data`);
            this.emit('marketDataSubscribed', {
                symbol,
                marketType,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to market data for ${symbol}:`, error);
            throw error;
        }
    }
    async unsubscribeFromMarketData(symbol, marketType) {
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
        }
        catch (error) {
            console.error(`❌ Failed to unsubscribe from market data for ${symbol}:`, error);
            throw error;
        }
    }
    async subscribeToOrderUpdates() {
        try {
            const subscriptionKey = 'order_updates';
            if (this.subscriptions.has(subscriptionKey)) {
                console.log(`📡 Already subscribed to order updates`);
                return;
            }
            console.log(`📡 Subscribing to order updates...`);
            this.subscriptions.add(subscriptionKey);
            console.log(`✅ Subscribed to order updates`);
            this.emit('orderUpdatesSubscribed', {
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to order updates:`, error);
            throw error;
        }
    }
    async subscribeToPositionUpdates() {
        try {
            const subscriptionKey = 'position_updates';
            if (this.subscriptions.has(subscriptionKey)) {
                console.log(`📡 Already subscribed to position updates`);
                return;
            }
            console.log(`📡 Subscribing to position updates...`);
            this.subscriptions.add(subscriptionKey);
            console.log(`✅ Subscribed to position updates`);
            this.emit('positionUpdatesSubscribed', {
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Failed to subscribe to position updates:`, error);
            throw error;
        }
    }
    mapOrderStatus(ccxtStatus) {
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
exports.BybitExchange = BybitExchange;
exports.default = BybitExchange;
//# sourceMappingURL=bybit-exchange.js.map