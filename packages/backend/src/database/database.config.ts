import type { PoolClient, PoolConfig } from 'pg';
import { Pool } from 'pg';
import { z } from 'zod';

/**
 * Database Configuration Schema
 * Validates all database-related environment variables
 */
const DatabaseConfigSchema = z.object({
  // Primary database URL (takes precedence if provided)
  DATABASE_URL: z.string().optional(),
  
  // Individual connection parameters
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().default('jabbr_trading_bot'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true';
    }
    return Boolean(val);
  }, z.boolean().default(false)),
  
  // Connection pool settings
  DB_POOL_MIN: z.coerce.number().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().min(1).default(20),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(60000),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * Database Connection Manager
 * Handles PostgreSQL connections with connection pooling
 */
export class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private isConnected = false;

  constructor() {
    // Validate and parse environment configuration
    console.log('🔍 Raw DB_SSL env value:', process.env.DB_SSL, typeof process.env.DB_SSL);
    this.config = DatabaseConfigSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_SSL: process.env.DB_SSL,
      DB_POOL_MIN: process.env.DB_POOL_MIN,
      DB_POOL_MAX: process.env.DB_POOL_MAX,
      DB_POOL_IDLE_TIMEOUT: process.env.DB_POOL_IDLE_TIMEOUT,
      DB_POOL_CONNECTION_TIMEOUT: process.env.DB_POOL_CONNECTION_TIMEOUT,
      NODE_ENV: process.env.NODE_ENV
    });
    console.log('🔍 Parsed DB_SSL config value:', this.config.DB_SSL, typeof this.config.DB_SSL);
  }

  /**
   * Initialize database connection pool
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      console.log('📊 Database already connected');
      return;
    }

    try {
      const poolConfig: PoolConfig = this.createPoolConfig();
      console.log('🔍 Database config debug:', {
        host: poolConfig.host || 'using connectionString',
        database: poolConfig.database || 'from connectionString',
        ssl: poolConfig.ssl,
        hasConnectionString: !!poolConfig.connectionString
      });
      
      this.pool = new Pool(poolConfig);

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ Database connected successfully');
      console.log(`📊 Connected to: ${this.config.DB_HOST}:${this.config.DB_PORT}/${this.config.DB_NAME}`);
      
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('📊 Database disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
    }
  }

  /**
   * Get a database client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    return this.pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query and return a single result
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(text, params);
    return results.length > 0 ? results.at(0)! : null;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      poolSize: number;
      idleCount: number;
      waitingCount: number;
      responseTime?: number;
    };
  }> {
    if (!this.pool || !this.isConnected) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          poolSize: 0,
          idleCount: 0,
          waitingCount: 0
        }
      };
    }

    try {
      const start = Date.now();
      await this.query('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        details: {
          connected: true,
          poolSize: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
          responseTime
        }
      };
    } catch (_error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          poolSize: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        }
      };
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<DatabaseConfig, 'DB_PASSWORD'> {
    const safeConfig = { ...this.config };
    delete (safeConfig as any).DB_PASSWORD;
    return safeConfig;
  }

  /**
   * Check if database is connected
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Create pool configuration from environment
   */
  private createPoolConfig(): PoolConfig {
    // If DATABASE_URL is provided, use it (common in production/Heroku)
    if (this.config.DATABASE_URL) {
      return {
        connectionString: this.config.DATABASE_URL,
        ssl: this.config.DB_SSL ? { rejectUnauthorized: false } : false,
        min: this.config.DB_POOL_MIN,
        max: this.config.DB_POOL_MAX,
        idleTimeoutMillis: this.config.DB_POOL_IDLE_TIMEOUT,
        connectionTimeoutMillis: this.config.DB_POOL_CONNECTION_TIMEOUT
      };
    }

    // Otherwise use individual parameters
    return {
      host: this.config.DB_HOST,
      port: this.config.DB_PORT,
      database: this.config.DB_NAME,
      user: this.config.DB_USER,
      password: this.config.DB_PASSWORD,
      ssl: this.config.DB_SSL ? { rejectUnauthorized: false } : false,
      min: this.config.DB_POOL_MIN,
      max: this.config.DB_POOL_MAX,
      idleTimeoutMillis: this.config.DB_POOL_IDLE_TIMEOUT,
      connectionTimeoutMillis: this.config.DB_POOL_CONNECTION_TIMEOUT
    };
  }
}

// Export singleton instance
export const database = new DatabaseManager();

// Export types for use in other modules
export type { DatabaseConfig };

/**
 * Initialize database connection
 * Call this during application startup
 */
export async function initializeDatabase(): Promise<void> {
  await database.connect();
}

/**
 * Graceful database shutdown
 * Call this during application shutdown
 */
export async function shutdownDatabase(): Promise<void> {
  await database.disconnect();
} 