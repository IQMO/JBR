/**
 * 🔥 STANDALONE JABBR SERVER - NO DATABASE REQUIRED! 🔥
 * 
 * This version runs without PostgreSQL for testing the trading engine
 * Perfect for proving the system works before setting up full infrastructure
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { BybitExchange } from './exchanges/bybit-exchange';
import { MarketType } from './exchanges/base-exchange';

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: '🔥 Jabbr Trading Engine - STANDALONE MODE! 🔥'
  });
});

// Trading engine test endpoint
app.get('/api/test-trading', async (req, res) => {
  try {
    console.log('🔥 Testing trading engine via API...');
    
    const apiKey = {
      id: 'api-test-key',
      userId: 'api-test-user',
      exchange: 'bybit' as const,
      keyName: 'API Test Key',
      apiKey: '3TZG3zGNOZBa5Fnuck',
      apiSecret: 'k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI',
      sandbox: false,
      permissions: ['trade', 'read'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const exchange = new BybitExchange(apiKey, false);
    
    // Connect and get market data
    await exchange.connect();
    const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
    const balance = await exchange.getBalance(MarketType.FUTURES);
    const openOrders = await exchange.getOpenOrders('BTCUSDT', MarketType.FUTURES);
    
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
    
  } catch (error) {
    console.error('❌ Trading test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '❌ Trading engine test failed'
    });
  }
});

// Market data endpoint
app.get('/api/market/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const marketType = req.query.type === 'spot' ? MarketType.SPOT : MarketType.FUTURES;
    
    const apiKey = {
      id: 'market-key',
      userId: 'market-user',
      exchange: 'bybit' as const,
      keyName: 'Market Key',
      apiKey: '3TZG3zGNOZBa5Fnuck',
      apiSecret: 'k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI',
      sandbox: false,
      permissions: ['read'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const exchange = new BybitExchange(apiKey, false);
    await exchange.connect();
    const marketData = await exchange.getMarketData(symbol.toUpperCase(), marketType);
    await exchange.disconnect();
    
    res.json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Market data failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ port: Number(WS_PORT) });

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
      
      // Echo back for now
      ws.send(JSON.stringify({
        type: 'echo',
        data: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// Start the server
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔌 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default { app, server }; 