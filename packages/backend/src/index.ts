/**
 * Jabbr Trading Bot Platform - Backend Entry Point
 * 
 * Main entry point for the backend server that integrates:
 * - HTTP API server with authentication
 * - WebSocket server for real-time communication
 * - Database with PostgreSQL
 * - WebSocket bridge for exchange connections
 * - Real-time market data from Bybit
 */

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import server from './server';
import { initializeDatabase } from './services/database.service';
import logger from './services/logging.service';
import redis from './services/redis.service';

// Start the integrated server
initializeDatabase()
  .then(() => {
    redis.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });
    server.start().catch((error) => {
      logger.error('❌ Failed to start Jabbr Trading Bot Server:', error);
      process.exit(1);
    });
  })
  .catch((error) => {
    logger.error('❌ Failed to initialize database:', error);
    process.exit(1);
  });

logger.info('Jabbr Trading Bot Server started successfully.'); 