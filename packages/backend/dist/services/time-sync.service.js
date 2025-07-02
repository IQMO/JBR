"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeSyncService = exports.TimeSyncService = void 0;
const events_1 = require("events");
const ntp_client_1 = __importDefault(require("ntp-client"));
const zod_1 = require("zod");
const TimeSyncConfigSchema = zod_1.z.object({
    NTP_SERVER: zod_1.z.string().default('pool.ntp.org'),
    TIME_SYNC_INTERVAL: zod_1.z.coerce.number().min(30000).default(300000),
    MAX_TIME_DRIFT: zod_1.z.coerce.number().min(100).default(30000),
    NTP_TIMEOUT: zod_1.z.coerce.number().min(1000).default(10000),
    ENABLE_TIME_SYNC: zod_1.z.coerce.boolean().default(true)
});
class TimeSyncService extends events_1.EventEmitter {
    config;
    ntpSyncInterval = null;
    exchangeSyncInterval = null;
    isRunning = false;
    startTime;
    ntpOffset = 0;
    exchangeOffsets = new Map();
    lastNtpSync = null;
    lastExchangeSync = null;
    syncCount = 0;
    errorCount = 0;
    exchangeTimeInfo = new Map();
    constructor() {
        super();
        this.startTime = new Date();
        this.config = TimeSyncConfigSchema.parse({
            NTP_SERVER: process.env.NTP_SERVER || 'pool.ntp.org',
            TIME_SYNC_INTERVAL: process.env.TIME_SYNC_INTERVAL || '300000',
            MAX_TIME_DRIFT: process.env.MAX_TIME_DRIFT || '30000',
            NTP_TIMEOUT: process.env.NTP_TIMEOUT || '10000',
            ENABLE_TIME_SYNC: process.env.ENABLE_TIME_SYNC || 'true'
        });
        console.log('🕐 Time Synchronization Service initialized');
        console.log(`📡 NTP Server: ${this.config.NTP_SERVER}`);
        console.log(`⏱️ Sync Interval: ${this.config.TIME_SYNC_INTERVAL}ms`);
        console.log(`⚠️ Max Drift: ${this.config.MAX_TIME_DRIFT}ms`);
    }
    async start() {
        if (this.isRunning) {
            console.log('🕐 Time sync service already running');
            return;
        }
        if (!this.config.ENABLE_TIME_SYNC) {
            console.log('⏸️ Time synchronization disabled by configuration');
            return;
        }
        console.log('🚀 Starting time synchronization service...');
        try {
            await this.performNtpSync();
            this.startNtpSync();
            this.startExchangeTimeMonitoring();
            this.isRunning = true;
            console.log('✅ Time synchronization service started');
            this.emit('started');
        }
        catch (error) {
            console.error('❌ Failed to start time sync service:', error);
            this.emit('error', error);
            throw error;
        }
    }
    async stop() {
        if (!this.isRunning) {
            console.log('🕐 Time sync service not running');
            return;
        }
        console.log('🛑 Stopping time synchronization service...');
        if (this.ntpSyncInterval) {
            clearInterval(this.ntpSyncInterval);
            this.ntpSyncInterval = null;
        }
        if (this.exchangeSyncInterval) {
            clearInterval(this.exchangeSyncInterval);
            this.exchangeSyncInterval = null;
        }
        this.isRunning = false;
        console.log('✅ Time synchronization service stopped');
        this.emit('stopped');
    }
    now() {
        const localTime = new Date();
        const adjustedTime = new Date(localTime.getTime() + this.ntpOffset);
        return adjustedTime;
    }
    timestamp() {
        return this.now().getTime();
    }
    toISOString() {
        return this.now().toISOString();
    }
    getExchangeTime(exchange) {
        const baseTime = this.now();
        const exchangeOffset = this.exchangeOffsets.get(exchange) || 0;
        return new Date(baseTime.getTime() + exchangeOffset);
    }
    async performNtpSync() {
        try {
            console.log(`🕐 Syncing with NTP server: ${this.config.NTP_SERVER}`);
            const ntpData = await new Promise((resolve, reject) => {
                ntp_client_1.default.getNetworkTime(this.config.NTP_SERVER, 123, (err, date) => {
                    if (err) {
                        reject(err);
                    }
                    else if (date) {
                        resolve({ date, offset: date.getTime() - Date.now() });
                    }
                    else {
                        reject(new Error('No date received from NTP server'));
                    }
                });
            });
            const previousOffset = this.ntpOffset;
            this.ntpOffset = ntpData.offset;
            this.lastNtpSync = new Date();
            this.syncCount++;
            const drift = Math.abs(this.ntpOffset - previousOffset);
            console.log(`✅ NTP sync complete:`);
            console.log(`   📊 Offset: ${this.ntpOffset}ms`);
            console.log(`   🔄 Drift: ${drift}ms`);
            console.log(`   🕐 Server time: ${ntpData.date.toISOString()}`);
            if (drift > this.config.MAX_TIME_DRIFT) {
                console.warn(`⚠️ High time drift detected: ${drift}ms (max: ${this.config.MAX_TIME_DRIFT}ms)`);
                this.emit('highDrift', { drift, offset: this.ntpOffset });
            }
            this.emit('ntpSync', {
                offset: this.ntpOffset,
                drift,
                serverTime: ntpData.date,
                localTime: new Date()
            });
        }
        catch (error) {
            this.errorCount++;
            console.error('❌ NTP synchronization failed:', error);
            this.emit('ntpError', error);
            throw error;
        }
    }
    startNtpSync() {
        this.ntpSyncInterval = setInterval(async () => {
            try {
                await this.performNtpSync();
            }
            catch (error) {
                console.error('❌ Periodic NTP sync failed:', error);
            }
        }, this.config.TIME_SYNC_INTERVAL);
        console.log(`⏰ NTP sync scheduled every ${this.config.TIME_SYNC_INTERVAL / 1000}s`);
    }
    startExchangeTimeMonitoring() {
        this.exchangeSyncInterval = setInterval(() => {
            this.checkExchangeTimeHealth();
        }, 30000);
        console.log('📡 Exchange time monitoring started');
    }
    async syncWithExchange(exchange, exchangeServerTime) {
        try {
            const localTime = this.now();
            const offset = exchangeServerTime.getTime() - localTime.getTime();
            const previousOffset = this.exchangeOffsets.get(exchange) || 0;
            this.exchangeOffsets.set(exchange, offset);
            this.exchangeTimeInfo.set(exchange, {
                exchange,
                serverTime: exchangeServerTime,
                localTime,
                offset,
                lastSync: new Date()
            });
            this.lastExchangeSync = new Date();
            const drift = Math.abs(offset - previousOffset);
            console.log(`🔄 Exchange sync (${exchange}):`);
            console.log(`   📊 Offset: ${offset}ms`);
            console.log(`   🔄 Drift: ${drift}ms`);
            console.log(`   🕐 Exchange time: ${exchangeServerTime.toISOString()}`);
            if (Math.abs(offset) > this.config.MAX_TIME_DRIFT) {
                console.warn(`⚠️ High exchange drift detected (${exchange}): ${offset}ms`);
                this.emit('exchangeDrift', { exchange, offset, drift });
            }
            this.emit('exchangeSync', {
                exchange,
                offset,
                drift,
                exchangeTime: exchangeServerTime,
                localTime
            });
        }
        catch (error) {
            console.error(`❌ Exchange sync failed (${exchange}):`, error);
            this.emit('exchangeError', { exchange, error });
        }
    }
    checkExchangeTimeHealth() {
        const now = new Date();
        const staleThreshold = 5 * 60 * 1000;
        for (const [exchange, info] of this.exchangeTimeInfo) {
            const timeSinceSync = now.getTime() - info.lastSync.getTime();
            if (timeSinceSync > staleThreshold) {
                console.warn(`⚠️ Stale exchange time data (${exchange}): ${timeSinceSync / 1000}s old`);
                this.emit('staleExchangeTime', { exchange, timeSinceSync });
            }
        }
    }
    createTimeSyncMessage() {
        const now = new Date();
        const syncedTime = this.now();
        const exchangeKeys = Array.from(this.exchangeTimeInfo.keys());
        const firstExchange = exchangeKeys[0];
        return {
            serverTime: syncedTime,
            exchangeTime: firstExchange
                ? this.getExchangeTime(firstExchange)
                : syncedTime,
            drift: this.getTotalDrift()
        };
    }
    getTotalDrift() {
        const exchangeDrifts = Array.from(this.exchangeOffsets.values());
        const maxExchangeDrift = exchangeDrifts.length > 0 ? Math.max(...exchangeDrifts.map(Math.abs)) : 0;
        return Math.max(Math.abs(this.ntpOffset), maxExchangeDrift);
    }
    getStats() {
        const exchangeOffsetValues = Array.from(this.exchangeOffsets.values());
        const firstExchangeOffset = exchangeOffsetValues[0];
        return {
            lastNtpSync: this.lastNtpSync,
            lastExchangeSync: this.lastExchangeSync,
            ntpOffset: this.ntpOffset,
            exchangeOffset: firstExchangeOffset !== undefined
                ? firstExchangeOffset
                : 0,
            totalDrift: this.getTotalDrift(),
            syncCount: this.syncCount,
            errorCount: this.errorCount,
            isHealthy: this.isHealthy(),
            uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000)
        };
    }
    isHealthy() {
        const now = Date.now();
        const ntpStale = this.lastNtpSync ? (now - this.lastNtpSync.getTime()) > (this.config.TIME_SYNC_INTERVAL * 2) : true;
        const highDrift = this.getTotalDrift() > this.config.MAX_TIME_DRIFT;
        const tooManyErrors = this.errorCount > 10;
        return !ntpStale && !highDrift && !tooManyErrors;
    }
    getExchangeTimeInfo() {
        return Array.from(this.exchangeTimeInfo.values());
    }
    async forcSync() {
        console.log('🔄 Forcing immediate time synchronization...');
        await this.performNtpSync();
    }
    getConfig() {
        const { NTP_SERVER, ...safeConfig } = this.config;
        return safeConfig;
    }
    getTradingTimestamp() {
        return this.timestamp();
    }
    getExchangeTradingTimestamp(exchange) {
        return this.getExchangeTime(exchange).getTime();
    }
    formatPreciseTimestamp(date) {
        const timestamp = date || this.now();
        const microseconds = (timestamp.getTime() % 1000) * 1000;
        return `${timestamp.toISOString().slice(0, -1)}${microseconds.toString().padStart(6, '0')}Z`;
    }
    validateTimestamp(timestamp, maxAgeMs = 60000) {
        const now = this.timestamp();
        const age = Math.abs(now - timestamp);
        return age <= maxAgeMs;
    }
}
exports.TimeSyncService = TimeSyncService;
exports.timeSyncService = new TimeSyncService();
exports.default = TimeSyncService;
//# sourceMappingURL=time-sync.service.js.map