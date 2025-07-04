import type { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';

import type { 
  WebSocketMessage, 
  WebSocketResponse} from '@jabbr/shared';
import { 
  CONSTANTS 
} from '@jabbr/shared';
import { WebSocketServer, WebSocket } from 'ws';

import { AuthService } from '../auth/auth.service';
import { database } from '../database/database.config';
import BotStatusService from '../services/bot-status.service';

/**
 * WebSocket Connection with user context
 */
interface AuthenticatedConnection {
  ws: WebSocket;
  userId: string;
  email: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  subscribedChannels: Set<string>;
  sessionId: string;
}

/**
 * WebSocket Server for real-time trading bot communication
 * Handles authentication, channel subscriptions, and message routing
 */
export class JabbrWebSocketServer {
  private wss: WebSocketServer;
  private authService: AuthService;
  private botStatusService: BotStatusService;
  private connections: Map<string, AuthenticatedConnection> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // channel -> sessionIds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_CONNECTIONS_PER_USER = 5;

  constructor(httpServer: HTTPServer) {
    this.authService = new AuthService();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.botStatusService = new BotStatusService(this);

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startCleanup();

    console.log('🔌 WebSocket server initialized on /ws');
  }

  public getBotStatusService(): BotStatusService {
    return this.botStatusService;
  }

  /**
   * Verify client connection during WebSocket handshake
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const url = parseUrl(info.req.url || '', true);
      const token = url.query.token as string;

      if (!token) {
        console.log('❌ WebSocket connection rejected: No token provided');
        return false;
      }

      // Verify JWT token
      const decoded = this.authService.verifyAccessToken(token);
      if (!decoded) {
        console.log('❌ WebSocket connection rejected: Invalid token');
        return false;
      }

      // Store user info for connection setup
      (info.req as any).user = decoded;
      return true;
    } catch (error) {
      console.error('❌ WebSocket verification error:', error);
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));

    console.log('📡 WebSocket event handlers configured');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    try {
      const user = (req as any).user;
      if (!user) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Check connection limits
      const existingConnections = Array.from(this.connections.values())
        .filter(conn => conn.userId === user.userId);
      
      if (existingConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
        ws.close(1008, 'Too many connections');
        return;
      }

      // Create authenticated connection
      const sessionId = this.generateSessionId();
      const connection: AuthenticatedConnection = {
        ws,
        userId: user.userId,
        email: user.email,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        subscribedChannels: new Set(),
        sessionId
      };

      // Store connection
      this.connections.set(sessionId, connection);

      // Setup connection event handlers
      ws.on('message', (data) => this.handleMessage(sessionId, data));
      ws.on('close', () => this.handleDisconnection(sessionId));
      ws.on('error', (error) => this.handleConnectionError(sessionId, error));
      ws.on('pong', () => this.handlePong(sessionId));

      // Send welcome message
      this.sendToConnection(sessionId, {
        type: 'connection',
        channel: CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
        data: {
          status: 'connected',
          sessionId,
          timestamp: new Date().toISOString(),
          availableChannels: Object.values(CONSTANTS.WS_CHANNELS)
        }
      });

      console.log(`✅ WebSocket connected: ${user.email} (${sessionId})`);
      
      // Log connection to database
      this.logConnectionEvent(user.userId, 'connected', sessionId);

    } catch (error) {
      console.error('❌ Connection setup error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(sessionId: string, data: any): void {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {return;}

      // Convert data to string if it's a Buffer
      const messageString = data instanceof Buffer ? data.toString() : data.toString();
      const message: WebSocketMessage = JSON.parse(messageString);
      
      // Update heartbeat
      connection.lastHeartbeat = new Date();

      // Route message based on type
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(sessionId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(sessionId, message);
          break;
        case 'ping':
          this.handlePing(sessionId);
          break;
        case 'bot_command':
          this.handleBotCommand(sessionId, message);
          break;
        default:
          this.sendError(sessionId, `Unknown message type: ${message.type}`);
      }

    } catch (error) {
      console.error(`❌ Message handling error for ${sessionId}:`, error);
      this.sendError(sessionId, 'Invalid message format');
    }
  }

  /**
   * Handle channel subscription
   */
  private handleSubscription(sessionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(sessionId);
    if (!connection) {return;}

    const channel = message.channel;
    if (!channel || !this.isValidChannel(channel)) {
      this.sendError(sessionId, `Invalid channel: ${channel}`);
      return;
    }

    // Add to connection's subscribed channels
    connection.subscribedChannels.add(channel);

    // Add to global channel mapping
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(sessionId);

    // Send confirmation
    this.sendToConnection(sessionId, {
      type: 'subscribed',
      channel,
      data: {
        status: 'subscribed',
        channel,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📺 ${connection.email} subscribed to ${channel}`);
  }

  /**
   * Handle channel unsubscription
   */
  private handleUnsubscription(sessionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(sessionId);
    if (!connection) {return;}

    const channel = message.channel;
    if (!channel) {return;}

    // Remove from connection's subscribed channels
    connection.subscribedChannels.delete(channel);

    // Remove from global channel mapping
    const channelSessions = this.channels.get(channel);
    if (channelSessions) {
      channelSessions.delete(sessionId);
      if (channelSessions.size === 0) {
        this.channels.delete(channel);
      }
    }

    // Send confirmation
    this.sendToConnection(sessionId, {
      type: 'unsubscribed',
      channel,
      data: {
        status: 'unsubscribed',
        channel,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📺 ${connection.email} unsubscribed from ${channel}`);
  }

  /**
   * Handle ping message
   */
  private handlePing(sessionId: string): void {
    this.sendToConnection(sessionId, {
      type: 'pong',
      channel: CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
      data: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle pong response
   */
  private handlePong(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }
  }

  /**
   * Handle bot command messages
   */
  private handleBotCommand(sessionId: string, message: WebSocketMessage): void {
    // This will be expanded when we implement bot management
    console.log(`🤖 Bot command from ${sessionId}:`, message.data);
    
    // For now, just acknowledge
    this.sendToConnection(sessionId, {
      type: 'bot_command_ack',
      channel: CONSTANTS.WS_CHANNELS.BOT_STATUS,
      data: {
        status: 'received',
        command: message.data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) {return;}

    // Remove from all channels
    for (const channel of connection.subscribedChannels) {
      const channelSessions = this.channels.get(channel);
      if (channelSessions) {
        channelSessions.delete(sessionId);
        if (channelSessions.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    // Remove connection
    this.connections.delete(sessionId);

    console.log(`❌ WebSocket disconnected: ${connection.email} (${sessionId})`);
    
    // Log disconnection to database
    this.logConnectionEvent(connection.userId, 'disconnected', sessionId);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(sessionId: string, error: Error): void {
    console.error(`❌ WebSocket connection error for ${sessionId}:`, error);
    
    const connection = this.connections.get(sessionId);
    if (connection) {
      this.logConnectionEvent(connection.userId, 'error', sessionId, error.message);
    }
  }

  /**
   * Handle server error
   */
  private handleServerError(error: Error): void {
    console.error('❌ WebSocket server error:', error);
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(sessionId: string, message: WebSocketResponse): void {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Failed to send message to ${sessionId}:`, error);
    }
  }

  /**
   * Send error message to connection
   */
  private sendError(sessionId: string, error: string): void {
    this.sendToConnection(sessionId, {
      type: 'error',
      channel: CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
      data: {
        error,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast message to all subscribers of a channel
   */
  public broadcast(channel: string, message: Omit<WebSocketResponse, 'channel'>): void {
    const sessionIds = this.channels.get(channel);
    if (!sessionIds || sessionIds.size === 0) {return;}

    const fullMessage: WebSocketResponse = {
      ...message,
      channel
    };

    for (const sessionId of sessionIds) {
      this.sendToConnection(sessionId, fullMessage);
    }

    console.log(`📡 Broadcasted to ${sessionIds.size} subscribers on ${channel}`);
  }

  /**
   * Send message to specific user (all their connections)
   */
  public sendToUser(userId: string, message: WebSocketResponse): void {
    const userConnections = Array.from(this.connections.values())
      .filter(conn => conn.userId === userId);

    for (const connection of userConnections) {
      this.sendToConnection(connection.sessionId, message);
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log('💓 WebSocket heartbeat started');
  }

  /**
   * Start connection cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const expiredConnections: string[] = [];

      for (const connection of this.connections.values()) {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > this.CONNECTION_TIMEOUT) {
          expiredConnections.push(connection.sessionId);
        }
      }

      // Clean up expired connections
      for (const sessionId of expiredConnections) {
        const connection = this.connections.get(sessionId);
        if (connection) {
          console.log(`🧹 Cleaning up expired connection: ${connection.email} (${sessionId})`);
          connection.ws.terminate();
          this.handleDisconnection(sessionId);
        }
      }

    }, this.HEARTBEAT_INTERVAL);

    console.log('🧹 WebSocket cleanup started');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Log connection event to database
   */
  private async logConnectionEvent(
    userId: string, 
    event: string, 
    sessionId: string, 
    details?: string
  ): Promise<void> {
    try {
      await database.query(`
        INSERT INTO logs (level, message, category, user_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        'info',
        `WebSocket ${event}`,
        'websocket',
        userId,
        JSON.stringify({
          event,
          sessionId,
          details,
          timestamp: new Date().toISOString()
        })
      ]);
    } catch (error) {
      console.error('❌ Failed to log connection event:', error);
    }
  }

  /**
   * Get server statistics
   */
  public getStats(): {
    connections: number;
    channels: number;
    connectionsByChannel: Record<string, number>;
    connectionsByUser: Record<string, number>;
  } {
    const connectionsByChannel: Record<string, number> = {};
    const connectionsByUser: Record<string, number> = {};

    // Count connections by channel
    for (const [channel, sessions] of this.channels) {
      if (typeof channel === 'string') {
        connectionsByChannel[channel] = sessions.size;
      }
    }

    // Count connections by user
    for (const connection of this.connections.values()) {
      connectionsByUser[connection.userId] = (connectionsByUser[connection.userId] || 0) + 1;
    }

    return {
      connections: this.connections.size,
      channels: this.channels.size,
      connectionsByChannel,
      connectionsByUser
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🔌 Shutting down WebSocket server...');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutting down');
    }

    // Close server
    this.wss.close();

    console.log('✅ WebSocket server shutdown complete');
  }

  /**
   * Check if channel is valid
   */
  private isValidChannel(channel: string): boolean {
    return Object.values(CONSTANTS.WS_CHANNELS).includes(channel as any);
  }
}

// Export for use in main server
export default JabbrWebSocketServer; 