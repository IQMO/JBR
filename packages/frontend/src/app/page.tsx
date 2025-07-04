/**
 * Jabbr Trading Bot Platform - Frontend Main Page
 * 
 * This will become the main dashboard for the trading bot platform.
 */

'use client';

import { CONSTANTS } from '@jabbr/shared';
import type { MarketDataMessage } from '@jabbr/shared/src/types';
import { useState, useEffect } from 'react';

import useWebSocket from '../hooks/useWebSocket';
import { getStatusColor, getStatusText } from '../utils/connectionStatus';


export default function HomePage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketDataMessage>>({});

  const {
    isConnected,
    isConnecting,
    connectionError,
    sessionId,
    subscribe,
    reconnect
  } = useWebSocket({
    url: 'ws://localhost:3002/ws',
    // For now, we'll test without authentication
    // token: 'your-jwt-token-here',
    onOpen: () => {
      console.log('🚀 WebSocket connected');
      setMessages((prev: string[]) => [...prev, '✅ Connected to WebSocket server']);
      // Subscribe to essential channels
      subscribe(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH);
      subscribe(CONSTANTS.WS_CHANNELS.BOT_STATUS);
    },
    onMessage: (message) => {
      console.log('📡 Message received:', message);
      setMessages((prev: string[]) => [...prev, `📡 ${message.type}: ${message.channel}`]);
      
      // Handle market data
      if (message.channel === CONSTANTS.WS_CHANNELS.MARKET_DATA && message.data) {
        setMarketData((prev) => ({
          ...prev,
          [message.data.symbol]: message.data as MarketDataMessage
        }));
      }
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
      setMessages((prev: string[]) => [...prev, '❌ Connection error occurred']);
    },
    onClose: (event) => {
      console.log('🔌 WebSocket disconnected:', event);
      setMessages((prev: string[]) => [...prev, `🔌 Disconnected (${event.code})`]);
    }
  });

  // Keep only last 10 messages
  useEffect(() => {
    if (messages.length > 10) {
      setMessages((prev: string[]) => prev.slice(-10));
    }
  }, [messages]);

  const connectionState = { isConnected, isConnecting, connectionError };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🚀 Jabbr Trading Bot Platform
          </h1>
          <p className="text-lg text-gray-600">
            Real-time cryptocurrency trading dashboard with WebSocket integration
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* WebSocket Status Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">WebSocket Status</h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <span className={`text-sm font-semibold ${getStatusColor(connectionState)}`}>
                  {getStatusText(connectionState)}
                </span>
              </div>
              
              {sessionId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Session:</span>
                  <span className="text-xs text-gray-600 font-mono">
                    {sessionId.slice(0, 8)}...
                  </span>
                </div>
              )}
              
              {connectionError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {connectionError}
                </div>
              )}
              
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={reconnect}
                  disabled={isConnecting}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  Reconnect
                </button>
                
                <button
                  onClick={() => subscribe(CONSTANTS.WS_CHANNELS.MARKET_DATA, 'BTCUSDT')}
                  disabled={!isConnected}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  Sub Market
                </button>
              </div>
            </div>
          </div>

          {/* Market Data Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Market Data</h3>
            
            {Object.keys(marketData).length === 0 ? (
              <p className="text-sm text-gray-500">No market data yet...</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(marketData).map(([symbol, data]: [string, MarketDataMessage]) => (
                  <div key={symbol} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{symbol}</span>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${data.price}</div>
                      <div className="text-xs text-gray-500">{new Date(data.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">System Info</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Backend:</span>
                <span className="text-sm text-green-600">✅ Operational</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Trading Engine:</span>
                <span className="text-sm text-green-600">✅ Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">WebSocket Server:</span>
                <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">WebSocket Activity Log</h3>
          
          <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">No activity yet...</p>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="text-sm text-gray-700 mb-1 font-mono">
                  {new Date().toLocaleTimeString()} - {msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.MARKET_DATA, 'BTCUSDT')}
              disabled={!isConnected}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Subscribe BTC
            </button>
            
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.MARKET_DATA, 'ETHUSDT')}
              disabled={!isConnected}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Subscribe ETH
            </button>
            
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.TRADES)}
              disabled={!isConnected}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Subscribe Trades
            </button>
            
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.POSITIONS)}
              disabled={!isConnected}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Subscribe Positions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 