'use client';

import type { WebSocketResponse} from '@jabbr/shared/src';
import { CONSTANTS } from '@jabbr/shared/src';
import React, { createContext, useContext, useState, useCallback } from 'react';

import useWebSocket from '../hooks/useWebSocket';

interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  change24h?: number;
  changePercent24h?: number;
}

interface BotStatus {
  botId: string;
  status: string;
  performance?: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
  };
  timestamp: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
  }>;
  timestamp: string;
}

interface WebSocketContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  sessionId: string | null;
  
  // Data state
  marketData: Record<string, MarketData>;
  botStatuses: Record<string, BotStatus>;
  systemHealth: SystemHealth | null;
  
  // Actions
  subscribe: (channel: string, symbol?: string) => void;
  unsubscribe: (channel: string, symbol?: string) => void;
  reconnect: () => void;
  
  // Bot actions
  startBot: (botId: string) => void;
  stopBot: (botId: string) => void;
  pauseBot: (botId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  wsUrl?: string;
  token?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  wsUrl = 'ws://localhost:3002/ws',
  token 
}) => {
  // Data state
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [botStatuses, setBotStatuses] = useState<Record<string, BotStatus>>({});
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  // Message handler
  const handleMessage = useCallback((message: WebSocketResponse) => {
    console.log('📡 Received WebSocket message:', message);

    switch (message.channel) {
      case CONSTANTS.WS_CHANNELS.MARKET_DATA:
        if (message.type === 'data' && message.data) {
          const data = message.data as MarketData;
          setMarketData((prev: Record<string, MarketData>) => ({
            ...prev,
            [data.symbol]: data
          }));
        }
        break;

      case CONSTANTS.WS_CHANNELS.BOT_STATUS:
        if (message.type === 'data' && message.data) {
          const data = message.data as BotStatus;
          setBotStatuses((prev: Record<string, BotStatus>) => ({
            ...prev,
            [data.botId]: data
          }));
        }
        break;

      case CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH:
        if (message.type === 'data' && message.data) {
          setSystemHealth(message.data as SystemHealth);
        }
        break;

      case CONSTANTS.WS_CHANNELS.TRADES:
        // Handle trade updates
        console.log('📈 Trade update:', message.data);
        break;

      case CONSTANTS.WS_CHANNELS.POSITIONS:
        // Handle position updates
        console.log('📊 Position update:', message.data);
        break;

      case CONSTANTS.WS_CHANNELS.SIGNALS:
        // Handle trading signals
        console.log('🎯 Signal received:', message.data);
        break;

      case CONSTANTS.WS_CHANNELS.TIME_SYNC:
        // Handle time synchronization
        console.log('🕐 Time sync:', message.data);
        break;

      default:
        console.log('❓ Unknown channel:', message.channel, message.data);
    }
  }, []);

  // Initialize WebSocket connection
  const {
    isConnected,
    isConnecting,
    connectionError,
    sessionId,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect
  } = useWebSocket({
    url: wsUrl,
    token,
    onMessage: handleMessage,
    onOpen: () => {
      console.log('🚀 WebSocket connected - subscribing to default channels');
      // Auto-subscribe to essential channels
      subscribe(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH);
      subscribe(CONSTANTS.WS_CHANNELS.BOT_STATUS);
      subscribe(CONSTANTS.WS_CHANNELS.TIME_SYNC);
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
    },
    onClose: (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      // Clear data on disconnect
      setMarketData({});
      setBotStatuses({});
      setSystemHealth(null);
    }
  });

  // Bot control actions
  const startBot = useCallback((botId: string) => {
    sendMessage({
      type: 'bot_command',
      channel: CONSTANTS.WS_CHANNELS.BOT_STATUS,
      data: {
        action: 'start',
        botId
      }
    });
  }, [sendMessage]);

  const stopBot = useCallback((botId: string) => {
    sendMessage({
      type: 'bot_command',
      channel: CONSTANTS.WS_CHANNELS.BOT_STATUS,
      data: {
        action: 'stop',
        botId
      }
    });
  }, [sendMessage]);

  const pauseBot = useCallback((botId: string) => {
    sendMessage({
      type: 'bot_command',
      channel: CONSTANTS.WS_CHANNELS.BOT_STATUS,
      data: {
        action: 'pause',
        botId
      }
    });
  }, [sendMessage]);

  const contextValue: WebSocketContextValue = {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    sessionId,
    
    // Data state
    marketData,
    botStatuses,
    systemHealth,
    
    // Actions
    subscribe,
    unsubscribe,
    reconnect,
    
    // Bot actions
    startBot,
    stopBot,
    pauseBot
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext; 