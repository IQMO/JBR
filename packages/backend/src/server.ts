import http from 'http';


// Import our modules
import { timeSyncService } from './services/time-sync.service';
import { bybitTimeSync } from './websocket/bybit-time-sync';
import { CONSTANTS } from '@jabbr/shared';
import compression from 'compression';
import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import authRoutes from './auth/auth.routes';
import botRoutes from './bots/bots.routes';
import { botRiskManagementRoutes, globalRiskManagementRoutes } from './risk-management/risk-management.routes';
import { initializeDatabase, shutdownDatabase } from './database/database.config';
import { runMigrations } from './database/migration-runner';
import { appMonitoringMiddleware } from './middleware/app-monitoring.middleware';
import alertsRoutes, { initializeAlertsRoutes } from './routes/alerts.routes';
import healthRoutes from './routes/health.routes';
import logsRoutes from './routes/logs.routes';
import performanceRoutes from './routes/performance.routes';
import type BotStatusService from './services/bot-status.service';
import DatabaseMonitorService from './services/database-monitor.service';
import ExchangeMonitorService from './services/exchange-monitor.service';
import MetricsCollectorService from './services/metrics-collector.service';
import MonitoringService from './services/monitoring.service';
import RiskManagementService from './services/risk-management.service';
import StrategyMonitorService from './services/strategy-monitor.service';
import WebSocketBridge from './websocket/websocket-bridge';
import JabbrWebSocketServer from './websocket/websocket-server';

/**
 * Main Jabbr Trading Bot Server
 * Integrates HTTP API, WebSocket server, database, and exchange connections
 */
class JabbrServer {
  private app: express.Application;
  private httpServer: http.Server;
  private wsServer: JabbrWebSocketServer | null = null;
  private wsBridge: WebSocketBridge | null = null;
  private metricsCollectorService: MetricsCollectorService | null = null;
  private botStatusService: BotStatusService | null = null;
  private strategyMonitorService: StrategyMonitorService | null = null;
  private riskManagementService: RiskManagementService | null = null;
  private databaseMonitorService: DatabaseMonitorService | null = null;
  private exchangeMonitorService: ExchangeMonitorService | null = null;
  private monitoringService: MonitoringService | null = null;
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

    // Performance monitoring middleware
    this.app.use(appMonitoringMiddleware.trackRequests());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    console.log('✅ Express middleware configured');
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Comprehensive health monitoring routes
    this.app.use('/health', healthRoutes);

    // Performance monitoring routes
    this.app.use('/performance', performanceRoutes);

    // Logs API routes
    this.app.use('/api/logs', logsRoutes);

    // Alerts API routes
    this.app.use('/api/alerts', alertsRoutes);

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

    // Bot management routes
    this.app.use('/api/bots', botRoutes);

    // Risk management routes
    this.app.use('/api/bots/:botId/risk-management', botRiskManagementRoutes);
    this.app.use('/api/risk-management', globalRiskManagementRoutes);

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
    // Global error handler with performance monitoring
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Track error in monitoring
      appMonitoringMiddleware.trackErrors()(error, req, res, () => {});
      
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
      void this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      void this.gracefulShutdown('unhandledRejection');
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
      this.botStatusService = this.wsServer.getBotStatusService();

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

      // 8. Setup bot status monitoring
      console.log('🤖 Setting up bot status monitoring...');
      this.setupBotStatusMonitoring();

      // 9. Initialize strategy monitor service
      console.log('📊 Initializing strategy monitor service...');
      this.strategyMonitorService = new StrategyMonitorService(this.wsServer);

      // 10. Initialize risk management service
      console.log('🛡️ Initializing risk management service...');
      this.riskManagementService = new RiskManagementService();

      // 11. Initialize performance monitoring
      console.log('📈 Initializing performance monitoring...');
      appMonitoringMiddleware.initialize();

      // 12. Initialize database monitoring
      console.log('🗄️ Initializing database monitoring...');
      this.databaseMonitorService = new DatabaseMonitorService({}, this.wsServer || undefined);
      this.databaseMonitorService.start();

      // 13. Initialize exchange monitoring
      console.log('🔗 Initializing exchange monitoring...');
      this.exchangeMonitorService = new ExchangeMonitorService({}, this.wsServer || undefined);
      
      // Start monitoring for common exchanges (can be configured per bot later)
      const commonExchanges = ['bybit', 'binance', 'okx', 'coinbase', 'kraken'];
      for (const exchange of commonExchanges) {
        this.exchangeMonitorService.startMonitoring(exchange);
      }

      // 14. Initialize centralized metrics collection
      console.log('📊 Initializing centralized metrics collection...');
      this.metricsCollectorService = new MetricsCollectorService({
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        maxMetricsPerSeries: 10000,
        aggregationInterval: 60 * 1000, // 1 minute
        enablePersistence: true,
        persistenceInterval: 60 * 60 * 1000 // 1 hour
      });

      // Start the metrics collector
      this.metricsCollectorService.start();

      // 15. Initialize centralized monitoring service with alert manager
      console.log('🔔 Initializing monitoring service with alert manager...');
      this.monitoringService = new MonitoringService({
        enableSystemMonitoring: true,
        enableApplicationMonitoring: true,
        enableDatabaseMonitoring: true,
        enableExchangeMonitoring: true,
        enableHealthChecks: true,
        enableMetricsCollection: true,
        enableAlerting: true,
        metricsRetentionHours: 24,
        alertingEnabled: true,
        broadcastMetrics: true
      });

      // Start monitoring service
      this.monitoringService.start();

      // Initialize alerts routes with the alert manager
      const services = this.monitoringService.getServices();
      if (services.alerts) {
        initializeAlertsRoutes(services.alerts);
        console.log('✅ Alerts API routes initialized');
      }

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
    if (!this.wsServer) {return;}

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
   * Setup bot status monitoring
   */
  private setupBotStatusMonitoring(): void {
    if (!this.botStatusService) {return;}

    // Broadcast bot status messages every 10 seconds
    setInterval(() => {
      if (this.botStatusService) {
        this.botStatusService.broadcastBotStatus('bot-1', {
          state: 'running',
          pnl: Math.random() * 100 - 50,
          openPositions: Math.floor(Math.random() * 5),
        });
      }
    }, 10000);

    console.log('🤖 Bot status monitoring configured (10s interval)');
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

      // 4. Shutdown strategy monitor service
      if (this.strategyMonitorService) {
        console.log('📊 Shutting down strategy monitor service...');
        this.strategyMonitorService.shutdown();
      }

      // 5. Shutdown time synchronization services
      console.log('🕐 Shutting down time synchronization...');
      await timeSyncService.stop();
      bybitTimeSync.stop();

      // 6. Shutdown performance monitoring
      console.log('📈 Shutting down performance monitoring...');
      appMonitoringMiddleware.shutdown();

      // 7. Shutdown database monitoring
      if (this.databaseMonitorService) {
        console.log('🗄️ Shutting down database monitoring...');
        this.databaseMonitorService.shutdown();
      }

      // 8. Shutdown exchange monitoring
      if (this.exchangeMonitorService) {
        console.log('🔗 Shutting down exchange monitoring...');
        this.exchangeMonitorService.shutdown();
      }

      // 9. Shutdown metrics collection
      if (this.metricsCollectorService) {
        console.log('📊 Shutting down metrics collection...');
        this.metricsCollectorService.stop();
      }

      // 10. Shutdown monitoring service
      if (this.monitoringService) {
        console.log('🔔 Shutting down monitoring service...');
        await this.monitoringService.shutdown();
      }

      // 11. Close database connections
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
   * Get strategy monitor service
   */
  public getStrategyMonitorService(): StrategyMonitorService | null {
    return this.strategyMonitorService;
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