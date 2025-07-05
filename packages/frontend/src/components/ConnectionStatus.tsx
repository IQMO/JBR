'use client';

import { CONSTANTS } from '@jabbr/shared/src';
import { useState, useEffect } from 'react';

import useWebSocket from '../hooks/useWebSocket';
import { getStatusColor, getStatusText } from '../utils/connectionStatus';

interface ConnectionStatusProps {
  wsUrl?: string;
  token?: string;
}

const ConnectionStatus = ({ 
  wsUrl = 'ws://localhost:3002/ws', 
  token 
}: ConnectionStatusProps) => {
  const [messages, setMessages] = useState<string[]>([]);

  const {
    isConnected,
    isConnecting,
    connectionError,
    sessionId,
    subscribe,
    reconnect
  } = useWebSocket({
    url: wsUrl,
    token,
    onOpen: () => {
      console.log('🚀 WebSocket connected in ConnectionStatus');
      setMessages(prev => [...prev, '✅ Connected to WebSocket server']);
      // Subscribe to system health for basic testing
      subscribe(CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH);
    },
    onMessage: (message) => {
      console.log('📡 Message received:', message);
      setMessages(prev => [...prev, `📡 ${message.type}: ${message.channel}`]);
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
      setMessages(prev => [...prev, '❌ Connection error occurred']);
    },
    onClose: (event) => {
      console.log('🔌 WebSocket disconnected:', event);
      setMessages(prev => [...prev, `🔌 Disconnected (${event.code})`]);
    }
  });

  // Keep only last 10 messages
  useEffect(() => {
    if (messages.length > 10) {
      setMessages(prev => prev.slice(-10));
    }
  }, [messages]);

  const connectionState = { isConnected, isConnecting, connectionError };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
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
      
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Recent Activity:</h4>
        <div className="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500">No activity yet...</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="text-xs text-gray-700 mb-1">
                {msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus; 