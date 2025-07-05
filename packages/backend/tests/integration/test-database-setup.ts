/**
 * Test Database Setup
 * Provides utilities for setting up and tearing down test database
 */

import { DatabaseManager } from '../../src/database/database.config';

export class TestDatabaseSetup {
  private static db: DatabaseManager;
  private static originalEnv: any = {};

  /**
   * Setup test database with isolated environment
   */
  static async setupTestDatabase(): Promise<DatabaseManager> {
    // Store original environment
    this.originalEnv = {
      DB_NAME: process.env.DB_NAME,
      DB_HOST: process.env.DB_HOST,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_PORT: process.env.DB_PORT
    };

    // Set test database environment
    process.env.DB_NAME = `${process.env.DB_NAME || 'trading_bot_platform'}_test`;
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.DB_PORT || '5432';
    process.env.DB_USER = process.env.DB_USER || 'postgres';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres123';

    // Create new database manager with test config
    this.db = new DatabaseManager();
    
    try {
      await this.db.connect();
      console.log(`✅ Connected to test database: ${process.env.DB_NAME}`);
      
      // Ensure we have required tables
      await this.createRequiredTables();
      
      return this.db;
    } catch (error) {
      console.error('❌ Failed to setup test database:', error);
      throw error;
    }
  }

  /**
   * Create required tables for testing
   */
  private static async createRequiredTables(): Promise<void> {
    const tables = [
      // Bots table
      `CREATE TABLE IF NOT EXISTS bots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        exchange VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      // Bot risk management table
      `CREATE TABLE IF NOT EXISTS bot_risk_management (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
        max_position_size DECIMAL,
        max_position_size_percent DECIMAL,
        position_sizing_method VARCHAR(50),
        stop_loss_type VARCHAR(50),
        stop_loss_value DECIMAL,
        take_profit_type VARCHAR(50),
        take_profit_value DECIMAL,
        max_daily_loss DECIMAL,
        max_daily_loss_percent DECIMAL,
        max_drawdown DECIMAL,
        max_concurrent_trades INTEGER,
        max_leverage DECIMAL,
        max_exposure DECIMAL,
        max_exposure_percent DECIMAL,
        risk_score INTEGER,
        emergency_stop BOOLEAN DEFAULT false,
        enable_risk_management BOOLEAN DEFAULT true,
        correlation_limit DECIMAL,
        volatility_adjustment BOOLEAN DEFAULT false,
        time_based_limits JSONB,
        risk_monitoring JSONB,
        template_name VARCHAR(255),
        last_updated TIMESTAMP DEFAULT NOW(),
        updated_by UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      
      // Risk management templates table
      `CREATE TABLE IF NOT EXISTS risk_management_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        configuration JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`
    ];

    for (const table of tables) {
      await this.db.query(table);
    }
  }

  /**
   * Clear all test data (but keep tables)
   */
  static async clearTestData(): Promise<void> {
    if (this.db) {
      await this.db.query('DELETE FROM bot_risk_management');
      await this.db.query('DELETE FROM risk_management_templates');
      await this.db.query('DELETE FROM bots');
    }
  }

  /**
   * Restore original environment and disconnect
   */
  static async teardownTestDatabase(): Promise<void> {
    if (this.db) {
      await this.clearTestData();
      await this.db.disconnect();
    }

    // Restore original environment
    Object.assign(process.env, this.originalEnv);
  }

  /**
   * Get the test database instance
   */
  static getDatabase(): DatabaseManager {
    return this.db;
  }
}
