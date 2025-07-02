"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.DatabaseManager = void 0;
exports.initializeDatabase = initializeDatabase;
exports.shutdownDatabase = shutdownDatabase;
const pg_1 = require("pg");
const zod_1 = require("zod");
const DatabaseConfigSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().optional(),
    DB_HOST: zod_1.z.string().default('localhost'),
    DB_PORT: zod_1.z.coerce.number().min(1).max(65535).default(5432),
    DB_NAME: zod_1.z.string().default('jabbr_trading_bot'),
    DB_USER: zod_1.z.string().default('postgres'),
    DB_PASSWORD: zod_1.z.string().default(''),
    DB_SSL: zod_1.z.coerce.boolean().default(false),
    DB_POOL_MIN: zod_1.z.coerce.number().min(0).default(2),
    DB_POOL_MAX: zod_1.z.coerce.number().min(1).default(20),
    DB_POOL_IDLE_TIMEOUT: zod_1.z.coerce.number().min(1000).default(30000),
    DB_POOL_CONNECTION_TIMEOUT: zod_1.z.coerce.number().min(1000).default(60000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development')
});
class DatabaseManager {
    pool = null;
    config;
    isConnected = false;
    constructor() {
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
    }
    async connect() {
        if (this.isConnected && this.pool) {
            console.log('📊 Database already connected');
            return;
        }
        try {
            const poolConfig = this.createPoolConfig();
            this.pool = new pg_1.Pool(poolConfig);
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            this.isConnected = true;
            console.log('✅ Database connected successfully');
            console.log(`📊 Connected to: ${this.config.DB_HOST}:${this.config.DB_PORT}/${this.config.DB_NAME}`);
        }
        catch (error) {
            console.error('❌ Database connection failed:', error);
            throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async disconnect() {
        if (!this.pool) {
            return;
        }
        try {
            await this.pool.end();
            this.pool = null;
            this.isConnected = false;
            console.log('📊 Database disconnected');
        }
        catch (error) {
            console.error('❌ Error disconnecting from database:', error);
        }
    }
    async getClient() {
        if (!this.pool || !this.isConnected) {
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.pool.connect();
    }
    async query(text, params) {
        const client = await this.getClient();
        try {
            const result = await client.query(text, params);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    async queryOne(text, params) {
        const results = await this.query(text, params);
        return results.length > 0 ? results[0] : null;
    }
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async healthCheck() {
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
        }
        catch (error) {
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
    getConfig() {
        const { DB_PASSWORD, ...safeConfig } = this.config;
        return safeConfig;
    }
    isConnectionActive() {
        return this.isConnected && this.pool !== null;
    }
    createPoolConfig() {
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
exports.DatabaseManager = DatabaseManager;
exports.database = new DatabaseManager();
async function initializeDatabase() {
    await exports.database.connect();
}
async function shutdownDatabase() {
    await exports.database.disconnect();
}
//# sourceMappingURL=database.config.js.map