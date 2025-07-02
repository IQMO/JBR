"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JabbrWebSocketServer = void 0;
const ws_1 = require("ws");
const url_1 = require("url");
const auth_service_1 = require("../auth/auth.service");
const database_config_1 = require("../database/database.config");
const shared_1 = require("@jabbr/shared");
class JabbrWebSocketServer {
    wss;
    authService;
    connections = new Map();
    channels = new Map();
    heartbeatInterval = null;
    cleanupInterval = null;
    HEARTBEAT_INTERVAL = 30000;
    CONNECTION_TIMEOUT = 60000;
    MAX_CONNECTIONS_PER_USER = 5;
    constructor(httpServer) {
        this.authService = new auth_service_1.AuthService();
        this.wss = new ws_1.WebSocketServer({
            server: httpServer,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });
        this.setupEventHandlers();
        this.startHeartbeat();
        this.startCleanup();
        console.log('🔌 WebSocket server initialized on /ws');
    }
    verifyClient(info) {
        try {
            const url = (0, url_1.parse)(info.req.url || '', true);
            const token = url.query.token;
            if (!token) {
                console.log('❌ WebSocket connection rejected: No token provided');
                return false;
            }
            const decoded = this.authService.verifyAccessToken(token);
            if (!decoded) {
                console.log('❌ WebSocket connection rejected: Invalid token');
                return false;
            }
            info.req.user = decoded;
            return true;
        }
        catch (error) {
            console.error('❌ WebSocket verification error:', error);
            return false;
        }
    }
    setupEventHandlers() {
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('error', this.handleServerError.bind(this));
        console.log('📡 WebSocket event handlers configured');
    }
    handleConnection(ws, req) {
        try {
            const user = req.user;
            if (!user) {
                ws.close(1008, 'Authentication required');
                return;
            }
            const existingConnections = Array.from(this.connections.values())
                .filter(conn => conn.userId === user.userId);
            if (existingConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
                ws.close(1008, 'Too many connections');
                return;
            }
            const sessionId = this.generateSessionId();
            const connection = {
                ws,
                userId: user.userId,
                email: user.email,
                connectedAt: new Date(),
                lastHeartbeat: new Date(),
                subscribedChannels: new Set(),
                sessionId
            };
            this.connections.set(sessionId, connection);
            ws.on('message', (data) => this.handleMessage(sessionId, data));
            ws.on('close', () => this.handleDisconnection(sessionId));
            ws.on('error', (error) => this.handleConnectionError(sessionId, error));
            ws.on('pong', () => this.handlePong(sessionId));
            this.sendToConnection(sessionId, {
                type: 'connection',
                channel: shared_1.CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
                data: {
                    status: 'connected',
                    sessionId,
                    timestamp: new Date().toISOString(),
                    availableChannels: Object.values(shared_1.CONSTANTS.WS_CHANNELS)
                }
            });
            console.log(`✅ WebSocket connected: ${user.email} (${sessionId})`);
            this.logConnectionEvent(user.userId, 'connected', sessionId);
        }
        catch (error) {
            console.error('❌ Connection setup error:', error);
            ws.close(1011, 'Internal server error');
        }
    }
    handleMessage(sessionId, data) {
        try {
            const connection = this.connections.get(sessionId);
            if (!connection)
                return;
            const messageString = data instanceof Buffer ? data.toString() : data.toString();
            const message = JSON.parse(messageString);
            connection.lastHeartbeat = new Date();
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
        }
        catch (error) {
            console.error(`❌ Message handling error for ${sessionId}:`, error);
            this.sendError(sessionId, 'Invalid message format');
        }
    }
    handleSubscription(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection)
            return;
        const channel = message.channel;
        if (!channel || !this.isValidChannel(channel)) {
            this.sendError(sessionId, `Invalid channel: ${channel}`);
            return;
        }
        connection.subscribedChannels.add(channel);
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel).add(sessionId);
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
    handleUnsubscription(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection)
            return;
        const channel = message.channel;
        if (!channel)
            return;
        connection.subscribedChannels.delete(channel);
        const channelSessions = this.channels.get(channel);
        if (channelSessions) {
            channelSessions.delete(sessionId);
            if (channelSessions.size === 0) {
                this.channels.delete(channel);
            }
        }
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
    handlePing(sessionId) {
        this.sendToConnection(sessionId, {
            type: 'pong',
            channel: shared_1.CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
            data: {
                timestamp: new Date().toISOString()
            }
        });
    }
    handlePong(sessionId) {
        const connection = this.connections.get(sessionId);
        if (connection) {
            connection.lastHeartbeat = new Date();
        }
    }
    handleBotCommand(sessionId, message) {
        console.log(`🤖 Bot command from ${sessionId}:`, message.data);
        this.sendToConnection(sessionId, {
            type: 'bot_command_ack',
            channel: shared_1.CONSTANTS.WS_CHANNELS.BOT_STATUS,
            data: {
                status: 'received',
                command: message.data,
                timestamp: new Date().toISOString()
            }
        });
    }
    handleDisconnection(sessionId) {
        const connection = this.connections.get(sessionId);
        if (!connection)
            return;
        for (const channel of connection.subscribedChannels) {
            const channelSessions = this.channels.get(channel);
            if (channelSessions) {
                channelSessions.delete(sessionId);
                if (channelSessions.size === 0) {
                    this.channels.delete(channel);
                }
            }
        }
        this.connections.delete(sessionId);
        console.log(`❌ WebSocket disconnected: ${connection.email} (${sessionId})`);
        this.logConnectionEvent(connection.userId, 'disconnected', sessionId);
    }
    handleConnectionError(sessionId, error) {
        console.error(`❌ WebSocket connection error for ${sessionId}:`, error);
        const connection = this.connections.get(sessionId);
        if (connection) {
            this.logConnectionEvent(connection.userId, 'error', sessionId, error.message);
        }
    }
    handleServerError(error) {
        console.error('❌ WebSocket server error:', error);
    }
    sendToConnection(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection || connection.ws.readyState !== ws_1.WebSocket.OPEN) {
            return;
        }
        try {
            connection.ws.send(JSON.stringify(message));
        }
        catch (error) {
            console.error(`❌ Failed to send message to ${sessionId}:`, error);
        }
    }
    sendError(sessionId, error) {
        this.sendToConnection(sessionId, {
            type: 'error',
            channel: shared_1.CONSTANTS.WS_CHANNELS.SYSTEM_HEALTH,
            data: {
                error,
                timestamp: new Date().toISOString()
            }
        });
    }
    broadcast(channel, message) {
        const sessionIds = this.channels.get(channel);
        if (!sessionIds || sessionIds.size === 0)
            return;
        const fullMessage = {
            ...message,
            channel
        };
        for (const sessionId of sessionIds) {
            this.sendToConnection(sessionId, fullMessage);
        }
        console.log(`📡 Broadcasted to ${sessionIds.size} subscribers on ${channel}`);
    }
    sendToUser(userId, message) {
        const userConnections = Array.from(this.connections.values())
            .filter(conn => conn.userId === userId);
        for (const connection of userConnections) {
            this.sendToConnection(connection.sessionId, message);
        }
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const [sessionId, connection] of this.connections) {
                if (connection.ws.readyState === ws_1.WebSocket.OPEN) {
                    connection.ws.ping();
                }
            }
        }, this.HEARTBEAT_INTERVAL);
        console.log('💓 WebSocket heartbeat started');
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = new Date();
            const expiredConnections = [];
            for (const [sessionId, connection] of this.connections) {
                const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
                if (timeSinceHeartbeat > this.CONNECTION_TIMEOUT) {
                    expiredConnections.push(sessionId);
                }
            }
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
    generateSessionId() {
        return `ws_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
    async logConnectionEvent(userId, event, sessionId, details) {
        try {
            await database_config_1.database.query(`
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
        }
        catch (error) {
            console.error('❌ Failed to log connection event:', error);
        }
    }
    getStats() {
        const connectionsByChannel = {};
        const connectionsByUser = {};
        for (const [channel, sessions] of this.channels) {
            connectionsByChannel[channel] = sessions.size;
        }
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
    async shutdown() {
        console.log('🔌 Shutting down WebSocket server...');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        for (const [sessionId, connection] of this.connections) {
            connection.ws.close(1001, 'Server shutting down');
        }
        this.wss.close();
        console.log('✅ WebSocket server shutdown complete');
    }
    isValidChannel(channel) {
        return Object.values(shared_1.CONSTANTS.WS_CHANNELS).includes(channel);
    }
}
exports.JabbrWebSocketServer = JabbrWebSocketServer;
exports.default = JabbrWebSocketServer;
//# sourceMappingURL=websocket-server.js.map