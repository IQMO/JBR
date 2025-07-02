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

// Start the integrated server
server.start().catch((error) => {
  console.error('❌ Failed to start Jabbr Trading Bot Server:', error);
  process.exit(1);
}); 