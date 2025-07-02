"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const ws_1 = require("ws");
const bybit_exchange_1 = require("./exchanges/bybit-exchange");
const base_exchange_1 = require("./exchanges/base-exchange");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: '🔥 Jabbr Trading Engine - STANDALONE MODE! 🔥'
    });
});
app.get('/api/test-trading', async (req, res) => {
    try {
        console.log('🔥 Testing trading engine via API...');
        const apiKey = {
            id: 'api-test-key',
            userId: 'api-test-user',
            exchange: 'bybit',
            keyName: 'API Test Key',
            apiKey: '3TZG3zGNOZBa5Fnuck',
            apiSecret: 'k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI',
            sandbox: false,
            permissions: ['trade', 'read'],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const exchange = new bybit_exchange_1.BybitExchange(apiKey, false);
        await exchange.connect();
        const marketData = await exchange.getMarketData('BTCUSDT', base_exchange_1.MarketType.FUTURES);
        const balance = await exchange.getBalance(base_exchange_1.MarketType.FUTURES);
        const openOrders = await exchange.getOpenOrders('BTCUSDT', base_exchange_1.MarketType.FUTURES);
        await exchange.disconnect();
        res.json({
            success: true,
            data: {
                marketData: {
                    symbol: marketData.symbol,
                    price: marketData.price,
                    volume: marketData.volume
                },
                balance: balance.filter(b => b.total > 0),
                openOrders: openOrders.length,
                timestamp: new Date().toISOString()
            },
            message: '🚀 Trading engine working perfectly!'
        });
    }
    catch (error) {
        console.error('❌ Trading test failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: '❌ Trading engine test failed'
        });
    }
});
app.get('/api/market/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const marketType = req.query.type === 'spot' ? base_exchange_1.MarketType.SPOT : base_exchange_1.MarketType.FUTURES;
        const apiKey = {
            id: 'market-key',
            userId: 'market-user',
            exchange: 'bybit',
            keyName: 'Market Key',
            apiKey: '3TZG3zGNOZBa5Fnuck',
            apiSecret: 'k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI',
            sandbox: false,
            permissions: ['read'],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const exchange = new bybit_exchange_1.BybitExchange(apiKey, false);
        await exchange.connect();
        const marketData = await exchange.getMarketData(symbol.toUpperCase(), marketType);
        await exchange.disconnect();
        res.json({
            success: true,
            data: marketData,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Market data failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ port: Number(WS_PORT) });
wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    ws.send(JSON.stringify({
        type: 'welcome',
        message: '🔥 Connected to Jabbr Trading Engine! 🔥',
        timestamp: new Date().toISOString()
    }));
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('📨 WebSocket message received:', data);
            ws.send(JSON.stringify({
                type: 'echo',
                data: data,
                timestamp: new Date().toISOString()
            }));
        }
        catch (error) {
            console.error('❌ WebSocket message error:', error);
        }
    });
    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
    });
});
server.listen(PORT, () => {
    console.log('🚀🔥🔥🔥 JABBR TRADING ENGINE - STANDALONE MODE!!! 🔥🔥🔥🚀');
    console.log(`📊 HTTP Server: http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Server: ws://localhost:${WS_PORT}`);
    console.log('💪 Ready for trading operations!');
    console.log('');
    console.log('🎯 Test endpoints:');
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Trading Test: http://localhost:${PORT}/api/test-trading`);
    console.log(`   Market Data: http://localhost:${PORT}/api/market/BTCUSDT`);
    console.log('');
    console.log('🔥 SPARTAN MODE ACTIVATED!!! 🔥');
});
process.on('SIGTERM', () => {
    console.log('🔌 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
exports.default = { app, server };
//# sourceMappingURL=server-standalone.js.map