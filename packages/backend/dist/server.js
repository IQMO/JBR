"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_config_1 = require("./database/database.config");
const migration_runner_1 = require("./database/migration-runner");
const websocket_server_1 = __importDefault(require("./websocket/websocket-server"));
const websocket_bridge_1 = __importDefault(require("./websocket/websocket-bridge"));
const time_sync_service_1 = require("./services/time-sync.service");
const bybit_time_sync_1 = require("./websocket/bybit-time-sync");
const shared_1 = require("@jabbr/shared");
const auth_routes_1 = __importDefault(require("./auth/auth.routes"));
dotenv_1.default.config();
class JabbrServer {
    app;
    httpServer;
    wsServer = null;
    wsBridge = null;
    isShuttingDown = false;
    PORT = process.env.PORT || 3001;
    WS_PORT = process.env.WS_PORT || 3002;
    FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = http_1.default.createServer(this.app);
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.setupGracefulShutdown();
    }
    setupMiddleware() {
        this.app.use((0, helmet_1.default)({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));
        this.app.use((0, cors_1.default)({
            origin: [this.FRONTEND_URL, 'http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        this.app.use((0, compression_1.default)());
        this.app.use((0, morgan_1.default)('combined'));
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        console.log('✅ Express middleware configured');
    }
    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: {
                    database: 'connected',
                    websocket: this.wsServer ? 'running' : 'stopped',
                    bridge: this.wsBridge ? 'initialized' : 'stopped',
                    timeSync: {
                        ntp: time_sync_service_1.timeSyncService.isHealthy() ? 'healthy' : 'unhealthy',
                        bybit: bybit_time_sync_1.bybitTimeSync.isHealthy() ? 'healthy' : 'unhealthy'
                    }
                },
                time: {
                    local: new Date().toISOString(),
                    synchronized: time_sync_service_1.timeSyncService.toISOString(),
                    drift: time_sync_service_1.timeSyncService.getTotalDrift()
                }
            });
        });
        this.app.get('/time/stats', (req, res) => {
            res.json({
                ntp: time_sync_service_1.timeSyncService.getStats(),
                bybit: bybit_time_sync_1.bybitTimeSync.getStats(),
                currentTime: {
                    local: new Date().toISOString(),
                    synchronized: time_sync_service_1.timeSyncService.toISOString(),
                    bybit: bybit_time_sync_1.bybitTimeSync.getBybitTime().toISOString()
                },
                timestamp: new Date().toISOString()
            });
        });
        this.app.post('/time/sync', async (req, res) => {
            try {
                await Promise.all([
                    time_sync_service_1.timeSyncService.forcSync(),
                    bybit_time_sync_1.bybitTimeSync.forceSync()
                ]);
                res.json({
                    success: true,
                    message: 'Time synchronization completed',
                    timestamp: time_sync_service_1.timeSyncService.toISOString()
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
            }
        });
        this.app.get('/ws/stats', (req, res) => {
            if (!this.wsServer || !this.wsBridge) {
                return res.status(503).json({ error: 'WebSocket services not available' });
            }
            return res.json({
                server: this.wsServer.getStats(),
                bridge: this.wsBridge.getStats(),
                timestamp: new Date().toISOString()
            });
        });
        this.app.use('/auth', auth_routes_1.default);
        this.app.get('/api/version', (req, res) => {
            res.json({
                name: 'Jabbr Trading Bot API',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            });
        });
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
        console.log('✅ API routes configured');
    }
    setupErrorHandling() {
        this.app.use((error, req, res, _next) => {
            console.error('❌ Unhandled error:', error);
            res.status(error.status || 500).json({
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
                timestamp: new Date().toISOString(),
                path: req.originalUrl,
                method: req.method
            });
        });
        console.log('✅ Error handling configured');
    }
    setupGracefulShutdown() {
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught exception:', error);
            this.gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown('unhandledRejection');
        });
        console.log('✅ Graceful shutdown handlers configured');
    }
    async initialize() {
        console.log('🚀 Initializing Jabbr Trading Bot Server...');
        try {
            console.log('📊 Initializing database...');
            await (0, database_config_1.initializeDatabase)();
            console.log('🔄 Running database migrations...');
            await (0, migration_runner_1.runMigrations)();
            console.log('🕐 Initializing time synchronization...');
            await time_sync_service_1.timeSyncService.start();
            await bybit_time_sync_1.bybitTimeSync.start();
            console.log('🔌 Initializing WebSocket server...');
            this.wsServer = new websocket_server_1.default(this.httpServer);
            console.log('🌉 Initializing WebSocket bridge...');
            this.wsBridge = new websocket_bridge_1.default(this.wsServer);
            await this.wsBridge.initialize();
            console.log('📺 Setting up demo market data...');
            await this.wsBridge.subscribeToPopularPairs();
            console.log('📡 Setting up time sync broadcasting...');
            this.setupTimeSyncBroadcasting();
            console.log('✅ All services initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize services:', error);
            throw error;
        }
    }
    async start() {
        try {
            await this.initialize();
            this.httpServer.listen(this.PORT, () => {
                console.log(`🚀 Jabbr Trading Bot Server running on port ${this.PORT}`);
                console.log(`📡 WebSocket server available at ws://localhost:${this.PORT}/ws`);
                console.log(`🌐 API available at http://localhost:${this.PORT}`);
                console.log(`🔗 Frontend URL: ${this.FRONTEND_URL}`);
                console.log(`📊 Health check: http://localhost:${this.PORT}/health`);
                console.log(`📈 WebSocket stats: http://localhost:${this.PORT}/ws/stats`);
                if (this.wsBridge) {
                    const stats = this.wsBridge.getStats();
                    console.log(`📺 Bridge initialized with ${stats.subscriptions} subscriptions`);
                    console.log(`📡 Exchange connections:`, stats.exchanges);
                }
            });
        }
        catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
    setupTimeSyncBroadcasting() {
        if (!this.wsServer)
            return;
        setInterval(() => {
            if (this.wsServer) {
                const timeSyncMessage = time_sync_service_1.timeSyncService.createTimeSyncMessage();
                this.wsServer.broadcast(shared_1.CONSTANTS.WS_CHANNELS.TIME_SYNC, {
                    type: 'data',
                    data: timeSyncMessage
                });
            }
        }, 30000);
        console.log('📡 Time sync broadcasting configured (30s interval)');
    }
    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            console.log('⏳ Shutdown already in progress...');
            return;
        }
        this.isShuttingDown = true;
        console.log(`🛑 Received ${signal}. Starting graceful shutdown...`);
        try {
            console.log('🔌 Closing HTTP server...');
            await new Promise((resolve) => {
                this.httpServer.close(() => {
                    console.log('✅ HTTP server closed');
                    resolve();
                });
            });
            if (this.wsBridge) {
                console.log('🌉 Shutting down WebSocket bridge...');
                await this.wsBridge.shutdown();
            }
            if (this.wsServer) {
                console.log('📡 Shutting down WebSocket server...');
                await this.wsServer.shutdown();
            }
            console.log('🕐 Shutting down time synchronization...');
            await time_sync_service_1.timeSyncService.stop();
            bybit_time_sync_1.bybitTimeSync.stop();
            console.log('📊 Closing database connections...');
            await (0, database_config_1.shutdownDatabase)();
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
        }
        catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }
    getStats() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'development',
            websocket: this.wsServer?.getStats(),
            bridge: this.wsBridge?.getStats(),
            timestamp: new Date().toISOString()
        };
    }
}
const server = new JabbrServer();
if (require.main === module) {
    server.start().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}
exports.default = server;
//# sourceMappingURL=server.js.map