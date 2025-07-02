import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import our modules
import { initializeDatabase, shutdownDatabase } from './database/database.config';
import { runMigrations } from './database/migration-runner';
import JabbrWebSocketServer from './websocket/websocket-server';
import WebSocketBridge from './websocket/websocket-bridge';
import { timeSyncService } from './services/time-sync.service';
import { bybitTimeSync } from './websocket/bybit-time-sync';
import { CONSTANTS } from '@jabbr/shared';
import authRoutes from './auth/auth.routes';

// Load environment variables
dotenv.config();

/**
 * Main Jabbr Trading Bot Server
 * Integrates HTTP API, WebSocket server, database, and exchange connections
 */
class JabbrServer {
  private app: express.Application;
  private httpServer: http.Server;
  private wsServer: JabbrWebSocketServer | null = null;
  private wsBridge: WebSocketBridge | null = null;
  private isShuttingDown = false;

  // Configuration
  private readonly PORT = process.env.PORT || 3001;
  private readonly WS_PORT = process.env.WS_PORT || 3002;
  private readonly FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: [this.FRONTEND_URL, 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Compression and logging
    this.app.use(compression());
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    console.log('✅ Express middleware configured');
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: 'connected', // TODO: Add actual health check
          websocket: this.wsServer ? 'running' : 'stopped',
          bridge: this.wsBridge ? 'initialized' : 'stopped',
          timeSync: {
            ntp: timeSyncService.isHealthy() ? 'healthy' : 'unhealthy',
            bybit: bybitTimeSync.isHealthy() ? 'healthy' : 'unhealthy'
          }
        },
        time: {
          local: new Date().toISOString(),
          synchronized: timeSyncService.toISOString(),
          drift: timeSyncService.getTotalDrift()
        }
      });
    });

    // Time synchronization endpoints
    this.app.get('/time/stats', (req, res) => {
      res.json({
        ntp: timeSyncService.getStats(),
        bybit: bybitTimeSync.getStats(),
        currentTime: {
          local: new Date().toISOString(),
          synchronized: timeSyncService.toISOString(),
          bybit: bybitTimeSync.getBybitTime().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    });

    // Force time sync endpoint
    this.app.post('/time/sync', async (req, res) => {
      try {
        await Promise.all([
          timeSyncService.forcSync(),
          bybitTimeSync.forceSync()
        ]);
        
        res.json({
          success: true,
          message: 'Time synchronization completed',
          timestamp: timeSyncService.toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // WebSocket stats endpoint
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

    // Authentication routes
    this.app.use('/auth', authRoutes);

    // API version endpoint
    this.app.get('/api/version', (req, res) => {
      res.json({
        name: 'Jabbr Trading Bot API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
    });

    // Catch-all for undefined routes
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

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response) => {
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

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    // Handle shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });

    console.log('✅ Graceful shutdown handlers configured');
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Jabbr Trading Bot Server...');

    try {
      // 1. Initialize database
      console.log('📊 Initializing database...');
      await initializeDatabase();
      
      // 2. Run database migrations
      console.log('🔄 Running database migrations...');
      await runMigrations();

      // 3. Initialize time synchronization
      console.log('🕐 Initializing time synchronization...');
      await timeSyncService.start();
      await bybitTimeSync.start();

      // 4. Initialize WebSocket server
      console.log('🔌 Initializing WebSocket server...');
      this.wsServer = new JabbrWebSocketServer(this.httpServer);

      // 5. Initialize WebSocket bridge
      console.log('🌉 Initializing WebSocket bridge...');
      this.wsBridge = new WebSocketBridge(this.wsServer);
      await this.wsBridge.initialize();

      // 6. Subscribe to popular trading pairs for demo
      console.log('📺 Setting up demo market data...');
      await this.wsBridge.subscribeToPopularPairs();

      // 7. Setup time sync broadcasting
      console.log('📡 Setting up time sync broadcasting...');
      this.setupTimeSyncBroadcasting();

      console.log('✅ All services initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Initialize all services first
      await this.initialize();

      // Start HTTP server
      this.httpServer.listen(this.PORT, () => {
        console.log(`🚀 Jabbr Trading Bot Server running on port ${this.PORT}`);
        console.log(`📡 WebSocket server available at ws://localhost:${this.PORT}/ws`);
        console.log(`🌐 API available at http://localhost:${this.PORT}`);
        console.log(`🔗 Frontend URL: ${this.FRONTEND_URL}`);
        console.log(`📊 Health check: http://localhost:${this.PORT}/health`);
        console.log(`📈 WebSocket stats: http://localhost:${this.PORT}/ws/stats`);
        
        // Log some useful information
        if (this.wsBridge) {
          const stats = this.wsBridge.getStats();
          console.log(`📺 Bridge initialized with ${stats.subscriptions} subscriptions`);
          console.log(`📡 Exchange connections:`, stats.exchanges);
        }
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup time synchronization broadcasting
   */
  private setupTimeSyncBroadcasting(): void {
    if (!this.wsServer) return;

    // Broadcast time sync messages every 30 seconds
    setInterval(() => {
      if (this.wsServer) {
        const timeSyncMessage = timeSyncService.createTimeSyncMessage();
        this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.TIME_SYNC, {
          type: 'data',
          data: timeSyncMessage
        });
      }
    }, 30000);

    console.log('📡 Time sync broadcasting configured (30s interval)');
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⏳ Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log(`🛑 Received ${signal}. Starting graceful shutdown...`);

    try {
      // 1. Stop accepting new connections
      console.log('🔌 Closing HTTP server...');
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          console.log('✅ HTTP server closed');
          resolve();
        });
      });

      // 2. Shutdown WebSocket bridge
      if (this.wsBridge) {
        console.log('🌉 Shutting down WebSocket bridge...');
        await this.wsBridge.shutdown();
      }

      // 3. Shutdown WebSocket server
      if (this.wsServer) {
        console.log('📡 Shutting down WebSocket server...');
        await this.wsServer.shutdown();
      }

      // 4. Shutdown time synchronization services
      console.log('🕐 Shutting down time synchronization...');
      await timeSyncService.stop();
      bybitTimeSync.stop();

      // 5. Close database connections
      console.log('📊 Closing database connections...');
      await shutdownDatabase();

      console.log('✅ Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get server statistics
   */
  getStats(): any {
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

// Create and export server instance
const server = new JabbrServer();

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

export default server; 