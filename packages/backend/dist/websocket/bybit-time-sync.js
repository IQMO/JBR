"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bybitTimeSync = exports.BybitTimeSync = void 0;
const events_1 = require("events");
const time_sync_service_1 = require("../services/time-sync.service");
class BybitTimeSync extends events_1.EventEmitter {
    syncInterval = null;
    isRunning = false;
    lastSync = null;
    syncCount = 0;
    errorCount = 0;
    BYBIT_API_URL = 'https://api.bybit.com';
    BYBIT_TESTNET_API_URL = 'https://api-testnet.bybit.com';
    SYNC_INTERVAL = 60000;
    REQUEST_TIMEOUT = 5000;
    isTestnet;
    constructor(isTestnet = true) {
        super();
        this.isTestnet = isTestnet;
    }
    async start() {
        if (this.isRunning) {
            console.log('📡 Bybit time sync already running');
            return;
        }
        console.log('🚀 Starting Bybit time synchronization...');
        try {
            await this.syncTime();
            this.syncInterval = setInterval(async () => {
                try {
                    await this.syncTime();
                }
                catch (error) {
                    console.error('❌ Periodic Bybit time sync failed:', error);
                    this.errorCount++;
                }
            }, this.SYNC_INTERVAL);
            this.isRunning = true;
            console.log('✅ Bybit time synchronization started');
            this.emit('started');
        }
        catch (error) {
            console.error('❌ Failed to start Bybit time sync:', error);
            this.emit('error', error);
            throw error;
        }
    }
    stop() {
        if (!this.isRunning) {
            console.log('📡 Bybit time sync not running');
            return;
        }
        console.log('🛑 Stopping Bybit time synchronization...');
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.isRunning = false;
        console.log('✅ Bybit time synchronization stopped');
        this.emit('stopped');
    }
    async fetchBybitTime() {
        const baseUrl = this.isTestnet ? this.BYBIT_TESTNET_API_URL : this.BYBIT_API_URL;
        const url = `${baseUrl}/v5/market/time`;
        try {
            console.log(`🕐 Fetching Bybit server time from: ${url}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Jabbr-Trading-Bot/1.0.0'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.retCode !== 0) {
                throw new Error(`Bybit API error: ${data.retMsg} (${data.retCode})`);
            }
            const timeSeconds = parseInt(data.result.timeSecond);
            const timeNanos = parseInt(data.result.timeNano);
            const timeMs = timeSeconds * 1000 + Math.floor(timeNanos / 1000000);
            const serverTime = new Date(timeMs);
            console.log(`✅ Bybit server time: ${serverTime.toISOString()}`);
            console.log(`📊 Response time: ${data.time}ms`);
            return serverTime;
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Bybit time request timeout');
            }
            throw error;
        }
    }
    async syncTime() {
        try {
            const requestStart = Date.now();
            const bybitServerTime = await this.fetchBybitTime();
            const requestEnd = Date.now();
            const networkLatency = (requestEnd - requestStart) / 2;
            const adjustedServerTime = new Date(bybitServerTime.getTime() + networkLatency);
            await time_sync_service_1.timeSyncService.syncWithExchange('bybit', adjustedServerTime);
            this.lastSync = new Date();
            this.syncCount++;
            console.log(`🔄 Bybit time sync complete:`);
            console.log(`   🕐 Server time: ${adjustedServerTime.toISOString()}`);
            console.log(`   📶 Network latency: ${networkLatency}ms`);
            console.log(`   📊 Sync count: ${this.syncCount}`);
            this.emit('sync', {
                serverTime: adjustedServerTime,
                networkLatency,
                syncCount: this.syncCount
            });
        }
        catch (error) {
            this.errorCount++;
            console.error('❌ Bybit time sync failed:', error);
            this.emit('syncError', error);
            throw error;
        }
    }
    async forceSync() {
        console.log('🔄 Forcing immediate Bybit time sync...');
        await this.syncTime();
    }
    getStats() {
        return {
            isRunning: this.isRunning,
            lastSync: this.lastSync,
            syncCount: this.syncCount,
            errorCount: this.errorCount,
            syncInterval: this.SYNC_INTERVAL,
            isTestnet: this.isTestnet
        };
    }
    isHealthy() {
        if (!this.isRunning)
            return false;
        if (!this.lastSync)
            return false;
        const now = Date.now();
        const timeSinceSync = now - this.lastSync.getTime();
        const maxAge = this.SYNC_INTERVAL * 3;
        return timeSinceSync < maxAge && this.errorCount < 10;
    }
    getBybitTime() {
        return time_sync_service_1.timeSyncService.getExchangeTime('bybit');
    }
    getBybitTradingTimestamp() {
        return time_sync_service_1.timeSyncService.getExchangeTradingTimestamp('bybit');
    }
    validateTradingTimestamp(timestamp, maxAgeMs = 30000) {
        const bybitTime = this.getBybitTradingTimestamp();
        const age = Math.abs(bybitTime - timestamp);
        return age <= maxAgeMs;
    }
}
exports.BybitTimeSync = BybitTimeSync;
exports.bybitTimeSync = new BybitTimeSync(true);
exports.default = BybitTimeSync;
//# sourceMappingURL=bybit-time-sync.js.map