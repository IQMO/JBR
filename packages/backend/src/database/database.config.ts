import type { PoolClient, PoolConfig } from 'pg';
import { Pool } from 'pg';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

/**
 * Database Configuration Schema
 * Validates all database-related environment variables
 */
const DatabaseConfigSchema = z.object({
  // Primary database URL (takes precedence if provided)
  DATABASE_URL: z.string().optional(),
  
  // Individual connection parameters
  DB_HOST: z.string().min(1, 'Database host is required').default('localhost'),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1, 'Database name is required').default('jabbr_trading_bot'),
  DB_USER: z.string().min(1, 'Database user is required').default('postgres'),
  DB_PASSWORD: z.string().min(1, 'Database password is required'),
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
    try {
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
      
      // Log successful configuration (without sensitive data)
      console.log('� Database configuration loaded:', {
        host: this.config.DB_HOST,
        port: this.config.DB_PORT,
        database: this.config.DB_NAME,
        user: this.config.DB_USER,
        ssl: this.config.DB_SSL,
        poolMin: this.config.DB_POOL_MIN,
        poolMax: this.config.DB_POOL_MAX
      });
      
    } catch (error) {
      console.error('❌ Database configuration validation failed:', error);
      if (error instanceof z.ZodError) {
        console.error('📋 Configuration errors:');
        error.errors.forEach(err => {
          console.error(`   - ${err.path.join('.')}: ${err.message}`);
        });
      }
      throw new Error('Database configuration validation failed. Check environment variables.');
    }
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
      
      this.pool = new Pool(poolConfig);

      // Test the connection with timeout
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW() as current_time, version() as pg_version');
        this.isConnected = true;
        console.log('✅ Database connected successfully');
        console.log(`📊 Connected to: ${this.config.DB_HOST}:${this.config.DB_PORT}/${this.config.DB_NAME}`);
      } finally {
        client.release();
      }
      
    } catch (error) {
      this.isConnected = false;
      
      // Provide specific error messages for common issues
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('authentication failed') || errorMessage.includes('password')) {
          console.error('❌ Database authentication failed: Invalid username or password');
          console.error('💡 Check DB_USER and DB_PASSWORD environment variables');
        } else if (errorMessage.includes('connection refused') || errorMessage.includes('econnrefused')) {
          console.error('❌ Database connection refused: PostgreSQL server is not running or not accessible');
          console.error('� Check if PostgreSQL is running and DB_HOST/DB_PORT are correct');
        } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
          console.error('❌ Database does not exist');
          console.error('💡 Check DB_NAME environment variable or create the database');
        } else if (errorMessage.includes('timeout')) {
          console.error('❌ Database connection timeout');
          console.error('💡 Check network connectivity and database server performance');
        } else {
          console.error('❌ Database connection failed:', error.message);
        }
      }
      
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