import { EventEmitter } from 'events';
export declare class BybitTimeSync extends EventEmitter {
    private syncInterval;
    private isRunning;
    private lastSync;
    private syncCount;
    private errorCount;
    private readonly BYBIT_API_URL;
    private readonly BYBIT_TESTNET_API_URL;
    private readonly SYNC_INTERVAL;
    private readonly REQUEST_TIMEOUT;
    private isTestnet;
    constructor(isTestnet?: boolean);
    start(): Promise<void>;
    stop(): void;
    private fetchBybitTime;
    private syncTime;
    forceSync(): Promise<void>;
    getStats(): {
        isRunning: boolean;
        lastSync: Date | null;
        syncCount: number;
        errorCount: number;
        syncInterval: number;
        isTestnet: boolean;
    };
    isHealthy(): boolean;
    getBybitTime(): Date;
    getBybitTradingTimestamp(): number;
    validateTradingTimestamp(timestamp: number, maxAgeMs?: number): boolean;
}
export declare const bybitTimeSync: BybitTimeSync;
export default BybitTimeSync;
//# sourceMappingURL=bybit-time-sync.d.ts.map