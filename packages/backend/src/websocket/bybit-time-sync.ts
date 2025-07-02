import { EventEmitter } from 'events';
import { timeSyncService } from '../services/time-sync.service';

/**
 * Bybit server time response
 */
interface BybitTimeResponse {
  retCode: number;
  retMsg: string;
  result: {
    timeSecond: string;
    timeNano: string;
  };
  time: number;
}

/**
 * Bybit Time Synchronization
 * Fetches server time from Bybit API and syncs with our time service
 */
export class BybitTimeSync extends EventEmitter {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSync: Date | null = null;
  private syncCount = 0;
  private errorCount = 0;

  // Configuration
  private readonly BYBIT_API_URL = 'https://api.bybit.com';
  private readonly BYBIT_TESTNET_API_URL = 'https://api-testnet.bybit.com';
  private readonly SYNC_INTERVAL = 60000; // 1 minute
  private readonly REQUEST_TIMEOUT = 5000; // 5 seconds

  private isTestnet: boolean;

  constructor(isTestnet: boolean = true) {
    super();
    this.isTestnet = isTestnet;
  }

  /**
   * Start Bybit time synchronization
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📡 Bybit time sync already running');
      return;
    }

    console.log('🚀 Starting Bybit time synchronization...');

    try {
      // Perform initial sync
      await this.syncTime();

      // Start periodic sync
      this.syncInterval = setInterval(async () => {
        try {
          await this.syncTime();
        } catch (error) {
          console.error('❌ Periodic Bybit time sync failed:', error);
          this.errorCount++;
        }
      }, this.SYNC_INTERVAL);

      this.isRunning = true;
      console.log('✅ Bybit time synchronization started');
      
      this.emit('started');

    } catch (error) {
      console.error('❌ Failed to start Bybit time sync:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop Bybit time synchronization
   */
  stop(): void {
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

  /**
   * Fetch server time from Bybit API
   */
  private async fetchBybitTime(): Promise<Date> {
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

      const data = await response.json() as BybitTimeResponse;

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg} (${data.retCode})`);
      }

      // Convert Bybit time to Date object
      const timeSeconds = parseInt(data.result.timeSecond);
      const timeNanos = parseInt(data.result.timeNano);
      const timeMs = timeSeconds * 1000 + Math.floor(timeNanos / 1000000);
      
      const serverTime = new Date(timeMs);
      
      console.log(`✅ Bybit server time: ${serverTime.toISOString()}`);
      console.log(`📊 Response time: ${data.time}ms`);

      return serverTime;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Bybit time request timeout');
      }
      throw error;
    }
  }

  /**
   * Perform time synchronization with Bybit
   */
  private async syncTime(): Promise<void> {
    try {
      const requestStart = Date.now();
      const bybitServerTime = await this.fetchBybitTime();
      const requestEnd = Date.now();
      
      // Adjust for network latency (estimate half of round-trip time)
      const networkLatency = (requestEnd - requestStart) / 2;
      const adjustedServerTime = new Date(bybitServerTime.getTime() + networkLatency);

      // Sync with our time service
      await timeSyncService.syncWithExchange('bybit', adjustedServerTime);

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

    } catch (error) {
      this.errorCount++;
      console.error('❌ Bybit time sync failed:', error);
      this.emit('syncError', error);
      throw error;
    }
  }

  /**
   * Force immediate time synchronization
   */
  async forceSync(): Promise<void> {
    console.log('🔄 Forcing immediate Bybit time sync...');
    await this.syncTime();
  }

  /**
   * Get Bybit time sync statistics
   */
  getStats(): {
    isRunning: boolean;
    lastSync: Date | null;
    syncCount: number;
    errorCount: number;
    syncInterval: number;
    isTestnet: boolean;
  } {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      syncCount: this.syncCount,
      errorCount: this.errorCount,
      syncInterval: this.SYNC_INTERVAL,
      isTestnet: this.isTestnet
    };
  }

  /**
   * Check if time sync is healthy
   */
  isHealthy(): boolean {
    if (!this.isRunning) return false;
    if (!this.lastSync) return false;
    
    const now = Date.now();
    const timeSinceSync = now - this.lastSync.getTime();
    const maxAge = this.SYNC_INTERVAL * 3; // Allow 3 missed syncs
    
    return timeSinceSync < maxAge && this.errorCount < 10;
  }

  /**
   * Get current Bybit-synchronized time
   */
  getBybitTime(): Date {
    return timeSyncService.getExchangeTime('bybit');
  }

  /**
   * Get Bybit trading timestamp
   */
  getBybitTradingTimestamp(): number {
    return timeSyncService.getExchangeTradingTimestamp('bybit');
  }

  /**
   * Validate if a timestamp is recent enough for trading
   */
  validateTradingTimestamp(timestamp: number, maxAgeMs: number = 30000): boolean {
    const bybitTime = this.getBybitTradingTimestamp();
    const age = Math.abs(bybitTime - timestamp);
    return age <= maxAgeMs;
  }
}

// Export singleton instance
export const bybitTimeSync = new BybitTimeSync(true); // Start with testnet

// Export class for dependency injection
export default BybitTimeSync; 