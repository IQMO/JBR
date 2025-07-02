import { Server as HTTPServer } from 'http';
import { WebSocketResponse } from '@jabbr/shared';
export declare class JabbrWebSocketServer {
    private wss;
    private authService;
    private connections;
    private channels;
    private heartbeatInterval;
    private cleanupInterval;
    private readonly HEARTBEAT_INTERVAL;
    private readonly CONNECTION_TIMEOUT;
    private readonly MAX_CONNECTIONS_PER_USER;
    constructor(httpServer: HTTPServer);
    private verifyClient;
    private setupEventHandlers;
    private handleConnection;
    private handleMessage;
    private handleSubscription;
    private handleUnsubscription;
    private handlePing;
    private handlePong;
    private handleBotCommand;
    private handleDisconnection;
    private handleConnectionError;
    private handleServerError;
    private sendToConnection;
    private sendError;
    broadcast(channel: string, message: Omit<WebSocketResponse, 'channel'>): void;
    sendToUser(userId: string, message: WebSocketResponse): void;
    private startHeartbeat;
    private startCleanup;
    private generateSessionId;
    private logConnectionEvent;
    getStats(): {
        connections: number;
        channels: number;
        connectionsByChannel: Record<string, number>;
        connectionsByUser: Record<string, number>;
    };
    shutdown(): Promise<void>;
    private isValidChannel;
}
export default JabbrWebSocketServer;
//# sourceMappingURL=websocket-server.d.ts.map