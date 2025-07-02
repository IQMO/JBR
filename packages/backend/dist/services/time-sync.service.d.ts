import { EventEmitter } from 'events';
import { z } from 'zod';
import { TimeSyncMessage } from '@jabbr/shared';
declare const TimeSyncConfigSchema: z.ZodObject<{
    NTP_SERVER: z.ZodDefault<z.ZodString>;
    TIME_SYNC_INTERVAL: z.ZodDefault<z.ZodNumber>;
    MAX_TIME_DRIFT: z.ZodDefault<z.ZodNumber>;
    NTP_TIMEOUT: z.ZodDefault<z.ZodNumber>;
    ENABLE_TIME_SYNC: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    NTP_SERVER: string;
    TIME_SYNC_INTERVAL: number;
    MAX_TIME_DRIFT: number;
    NTP_TIMEOUT: number;
    ENABLE_TIME_SYNC: boolean;
}, {
    NTP_SERVER?: string | undefined;
    TIME_SYNC_INTERVAL?: number | undefined;
    MAX_TIME_DRIFT?: number | undefined;
    NTP_TIMEOUT?: number | undefined;
    ENABLE_TIME_SYNC?: boolean | undefined;
}>;
type TimeSyncConfig = z.infer<typeof TimeSyncConfigSchema>;
interface TimeSyncStats {
    lastNtpSync: Date | null;
    lastExchangeSync: Date | null;
    ntpOffset: number;
    exchangeOffset: number;
    totalDrift: number;
    syncCount: number;
    errorCount: number;
    isHealthy: boolean;
    uptime: number;
}
interface ExchangeTimeInfo {
    exchange: string;
    serverTime: Date;
    localTime: Date;
    offset: number;
    lastSync: Date;
}
export declare class TimeSyncService extends EventEmitter {
    private config;
    private ntpSyncInterval;
    private exchangeSyncInterval;
    private isRunning;
    private startTime;
    private ntpOffset;
    private exchangeOffsets;
    private lastNtpSync;
    private lastExchangeSync;
    private syncCount;
    private errorCount;
    private exchangeTimeInfo;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    now(): Date;
    timestamp(): number;
    toISOString(): string;
    getExchangeTime(exchange: string): Date;
    private performNtpSync;
    private startNtpSync;
    private startExchangeTimeMonitoring;
    syncWithExchange(exchange: string, exchangeServerTime: Date): Promise<void>;
    private checkExchangeTimeHealth;
    createTimeSyncMessage(): TimeSyncMessage;
    getTotalDrift(): number;
    getStats(): TimeSyncStats;
    isHealthy(): boolean;
    getExchangeTimeInfo(): ExchangeTimeInfo[];
    forcSync(): Promise<void>;
    getConfig(): Omit<TimeSyncConfig, 'NTP_SERVER'>;
    getTradingTimestamp(): number;
    getExchangeTradingTimestamp(exchange: string): number;
    formatPreciseTimestamp(date?: Date): string;
    validateTimestamp(timestamp: number, maxAgeMs?: number): boolean;
}
export declare const timeSyncService: TimeSyncService;
export default TimeSyncService;
//# sourceMappingURL=time-sync.service.d.ts.map