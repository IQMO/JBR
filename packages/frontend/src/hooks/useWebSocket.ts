import type { WebSocketMessage, WebSocketResponse} from '@jabbr/shared/src';
import { CONSTANTS } from '@jabbr/shared/src';
import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketOptions {
  url: string;
  token?: string;
  onOpen?: () => void;
  onMessage?: (message: WebSocketResponse) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  sessionId: string | null;
  sendMessage: (message: WebSocketMessage) => void;
  subscribe: (channel: string, symbol?: string) => void;
  unsubscribe: (channel: string, symbol?: string) => void;
  reconnect: () => void;
}

const useWebSocket = (options: WebSocketOptions): UseWebSocketReturn => {
  const {
    url,
    token,
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const reconnectAttempts = useRef(0);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isManualClose = useRef(false);

  const clearTimers = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatTimer.current = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          type: 'ping',
          channel: CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
          data: { timestamp: new Date().toISOString() }
        };
        socket.send(JSON.stringify(pingMessage));
      }
    }, heartbeatInterval);
  }, [socket, heartbeatInterval, clearTimers]);

  const connect = useCallback(() => {
    if (isConnecting || (socket && socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    isManualClose.current = false;

    try {
      const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
      const ws = new WebSocket(wsUrl);
      
      setSocket(ws);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        startHeartbeat();
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketResponse = JSON.parse(event.data);
          
          // Handle system messages
          if (message.type === 'connection' && message.channel === CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH) {
            if (message.data?.sessionId) {
              setSessionId(message.data.sessionId);
            }
          } else if (message.type === 'pong') {
            // Handle pong response - connection is alive
            console.log('📡 Received pong from server');
          } else if (message.type === 'error') {
            console.error('❌ WebSocket error message:', message.data);
            setConnectionError(message.data?.error || 'Unknown error');
          } else {
            // Pass other messages to the handler
            onMessage?.(message);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setConnectionError('Connection error occurred');
        setIsConnecting(false);
        onError?.(event);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        setSocket(null);
        clearTimers();
        
        onClose?.(event);

        // Auto-reconnect unless it was a manual close
        if (!isManualClose.current && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimer.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.warn('❌ Max reconnect attempts reached');
          setConnectionError('Failed to reconnect after multiple attempts');
        }
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create connection');
      setIsConnecting(false);
    }
  }, [url, token, onOpen, onMessage, onError, onClose, reconnectInterval, maxReconnectAttempts, startHeartbeat, clearTimers, isConnecting, socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: new Date()
        };
        socket.send(JSON.stringify(messageWithTimestamp));
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not connected. Message not sent:', message);
    }
  }, [socket]);

  const subscribe = useCallback((channel: string, symbol?: string) => {
    const subscribeMessage: WebSocketMessage = {
      type: 'subscribe',
      channel,
      data: symbol ? { symbol } : {}
    };
    sendMessage(subscribeMessage);
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string, symbol?: string) => {
    const unsubscribeMessage: WebSocketMessage = {
      type: 'unsubscribe',
      channel,
      data: symbol ? { symbol } : {}
    };
    sendMessage(unsubscribeMessage);
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    if (socket) {
      isManualClose.current = true;
      socket.close();
    }
    reconnectAttempts.current = 0;
    connect();
  }, [socket, connect]);

  const disconnect = useCallback(() => {
    isManualClose.current = true;
    clearTimers();
    if (socket) {
      socket.close();
    }
  }, [socket, clearTimers]);

  // Initialize connection
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    socket,
    isConnected,
    isConnecting,
    connectionError,
    sessionId,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect
  };
};

export default useWebSocket; 