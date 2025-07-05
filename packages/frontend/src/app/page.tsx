/**
 * Jabbr Trading Bot Platform - Frontend Main Page
 * 
 * This will become the main dashboard for the trading bot platform.
 */

'use client';

import { CONSTANTS } from '@jabbr/shared/src';
import type { MarketDataMessage } from '@jabbr/shared/src/types';
import { useState, useEffect } from 'react';

import config from '../config/app';
import useWebSocket from '../hooks/useWebSocket';
import { getStatusColor, getStatusText } from '../utils/connectionStatus';
import { componentClasses } from '../utils/theme';


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
    url: config.api.websocketUrl,
    // For now, we'll test without authentication
    // token: 'your-jwt-token-here',
    onOpen: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 WebSocket connected');
      }
      setMessages((prev: string[]) => [...prev, '✅ Connected to WebSocket server']);
      // Subscribe to essential channels
      subscribe(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH);
      subscribe(CONSTANTS.WS_CHANNELS.BOT_STATUS);
    },
    onMessage: (message) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('📡 Message received:', message);
      }
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
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ WebSocket error:', error);
      }
      setMessages((prev: string[]) => [...prev, '❌ Connection error occurred']);
    },
    onClose: (event) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 WebSocket disconnected:', event);
      }
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
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">
            🚀 Jabbr Trading Bot Platform
          </h1>
          <p className="text-lg text-secondary">
            Real-time cryptocurrency trading dashboard with WebSocket integration
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* WebSocket Status Card */}
          <div className={componentClasses.card}>
            <h3 className="text-lg font-semibold mb-4 text-primary">WebSocket Status</h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-secondary">Status:</span>
                <span className={`text-sm font-semibold ${getStatusColor(connectionState)}`}>
                  {getStatusText(connectionState)}
                </span>
              </div>
              
              {sessionId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary">Session:</span>
                  <span className="text-xs text-muted font-mono">
                    {sessionId.slice(0, 8)}...
                  </span>
                </div>
              )}
              
              {connectionError && (
                <div className="text-sm text-status-error bg-status-error/10 p-2 rounded-lg border border-status-error/20">
                  {connectionError}
                </div>
              )}
              
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={reconnect}
                  disabled={isConnecting}
                  className={`${componentClasses.button.primary} text-xs`}
                >
                  Reconnect
                </button>
                
                <button
                  onClick={() => subscribe(CONSTANTS.WS_CHANNELS.MARKET_DATA, 'BTCUSDT')}
                  disabled={!isConnected}
                  className={`${componentClasses.button.success} text-xs`}
                >
                  Sub Market
                </button>
              </div>
            </div>
          </div>

          {/* Market Data Card */}
          <div className={componentClasses.card}>
            <h3 className="text-lg font-semibold mb-4 text-primary">Market Data</h3>
            
            {Object.keys(marketData).length === 0 ? (
              <p className="text-sm text-muted">No market data yet...</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(marketData).map(([symbol, data]: [string, MarketDataMessage]) => (
                  <div key={symbol} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-primary">{symbol}</span>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary">${data.price}</div>
                      <div className="text-xs text-muted">{new Date(data.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Info Card */}
          <div className={componentClasses.card}>
            <h3 className="text-lg font-semibold mb-4 text-primary">System Info</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-secondary">Backend:</span>
                <span className="text-sm text-status-success">✅ Operational</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-secondary">Trading Engine:</span>
                <span className="text-sm text-status-success">✅ Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-secondary">WebSocket Server:</span>
                <span className={`text-sm ${isConnected ? 'text-status-success' : 'text-status-error'}`}>
                  {isConnected ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className={componentClasses.card}>
          <h3 className="text-lg font-semibold mb-4 text-primary">WebSocket Activity Log</h3>
          
          <div className="bg-surface-secondary rounded-lg p-4 max-h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted">No activity yet...</p>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="text-sm text-secondary mb-1 font-mono">
                  {new Date().toLocaleTimeString()} - {msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className={`mt-8 ${componentClasses.card}`}>
          <h3 className="text-lg font-semibold mb-4 text-primary">Quick Actions</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.MARKET_DATA, 'BTCUSDT')}
              disabled={!isConnected}
              className={componentClasses.button.primary}
            >
              Subscribe BTC
            </button>
            
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.MARKET_DATA, 'ETHUSDT')}
              disabled={!isConnected}
              className={componentClasses.button.primary}
            >
              Subscribe ETH
            </button>
            
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.TRADES)}
              disabled={!isConnected}
              className={componentClasses.button.success}
            >
              Subscribe Trades
            </button>
            
            <button
              onClick={() => subscribe(CONSTANTS.WS_CHANNELS.POSITIONS)}
              disabled={!isConnected}
              className={componentClasses.button.secondary}
            >
              Subscribe Positions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 