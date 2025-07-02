import { PoolClient } from 'pg';
import { z } from 'zod';
declare const DatabaseConfigSchema: z.ZodObject<{
    DATABASE_URL: z.ZodOptional<z.ZodString>;
    DB_HOST: z.ZodDefault<z.ZodString>;
    DB_PORT: z.ZodDefault<z.ZodNumber>;
    DB_NAME: z.ZodDefault<z.ZodString>;
    DB_USER: z.ZodDefault<z.ZodString>;
    DB_PASSWORD: z.ZodDefault<z.ZodString>;
    DB_SSL: z.ZodDefault<z.ZodBoolean>;
    DB_POOL_MIN: z.ZodDefault<z.ZodNumber>;
    DB_POOL_MAX: z.ZodDefault<z.ZodNumber>;
    DB_POOL_IDLE_TIMEOUT: z.ZodDefault<z.ZodNumber>;
    DB_POOL_CONNECTION_TIMEOUT: z.ZodDefault<z.ZodNumber>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    DB_HOST: string;
    DB_PORT: number;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_SSL: boolean;
    DB_POOL_MIN: number;
    DB_POOL_MAX: number;
    DB_POOL_IDLE_TIMEOUT: number;
    DB_POOL_CONNECTION_TIMEOUT: number;
    DATABASE_URL?: string | undefined;
}, {
    NODE_ENV?: "development" | "production" | "test" | undefined;
    DATABASE_URL?: string | undefined;
    DB_HOST?: string | undefined;
    DB_PORT?: number | undefined;
    DB_NAME?: string | undefined;
    DB_USER?: string | undefined;
    DB_PASSWORD?: string | undefined;
    DB_SSL?: boolean | undefined;
    DB_POOL_MIN?: number | undefined;
    DB_POOL_MAX?: number | undefined;
    DB_POOL_IDLE_TIMEOUT?: number | undefined;
    DB_POOL_CONNECTION_TIMEOUT?: number | undefined;
}>;
type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export declare class DatabaseManager {
    private pool;
    private config;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): Promise<PoolClient>;
    query<T = any>(text: string, params?: any[]): Promise<T[]>;
    queryOne<T = any>(text: string, params?: any[]): Promise<T | null>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: {
            connected: boolean;
            poolSize: number;
            idleCount: number;
            waitingCount: number;
            responseTime?: number;
        };
    }>;
    getConfig(): Omit<DatabaseConfig, 'DB_PASSWORD'>;
    isConnectionActive(): boolean;
    private createPoolConfig;
}
export declare const database: DatabaseManager;
export type { DatabaseConfig };
export declare function initializeDatabase(): Promise<void>;
export declare function shutdownDatabase(): Promise<void>;
//# sourceMappingURL=database.config.d.ts.map