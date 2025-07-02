import { EventEmitter } from 'events';
import ntp from 'ntp-client';
import { z } from 'zod';
import type { TimeSyncMessage } from '@jabbr/shared';

/**
 * Time synchronization configuration schema
 */
const TimeSyncConfigSchema = z.object({
  NTP_SERVER: z.string().default('pool.ntp.org'),
  TIME_SYNC_INTERVAL: z.coerce.number().min(30000).default(300000), // 5 minutes
  MAX_TIME_DRIFT: z.coerce.number().min(100).default(30000), // 30 seconds (increased for tolerance)
  NTP_TIMEOUT: z.coerce.number().min(1000).default(10000), // 10 seconds
  ENABLE_TIME_SYNC: z.coerce.boolean().default(true)
});

type TimeSyncConfig = z.infer<typeof TimeSyncConfigSchema>;

/**
 * Time synchronization statistics
 */
interface TimeSyncStats {
  lastNtpSync: Date | null;
  lastExchangeSync: Date | null;
  ntpOffset: number; // milliseconds
  exchangeOffset: number; // milliseconds
  totalDrift: number; // milliseconds
  syncCount: number;
  errorCount: number;
  isHealthy: boolean;
  uptime: number; // seconds
}

/**
 * Exchange time information
 */
interface ExchangeTimeInfo {
  exchange: string;
  serverTime: Date;
  localTime: Date;
  offset: number; // milliseconds
  lastSync: Date;
}

/**
 * Time Synchronization Service
 * Handles NTP synchronization, exchange time alignment, and drift detection
 */
export class TimeSyncService extends EventEmitter {
  private config: TimeSyncConfig;
  private ntpSyncInterval: NodeJS.Timeout | null = null;
  private exchangeSyncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startTime: Date;

  // Time synchronization state
  private ntpOffset = 0; // milliseconds
  private exchangeOffsets: Map<string, number> = new Map(); // exchange -> offset in ms
  private lastNtpSync: Date | null = null;
  private lastExchangeSync: Date | null = null;
  private syncCount = 0;
  private errorCount = 0;

  // Exchange time tracking
  private exchangeTimeInfo: Map<string, ExchangeTimeInfo> = new Map();

  constructor() {
    super();
    this.startTime = new Date();
    
    // Validate and parse configuration
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

  /**
   * Start time synchronization service
   */
  async start(): Promise<void> {
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
      // Perform initial NTP synchronization
      await this.performNtpSync();

      // Start periodic NTP synchronization
      this.startNtpSync();

      // Start exchange time monitoring
      this.startExchangeTimeMonitoring();

      this.isRunning = true;
      console.log('✅ Time synchronization service started');
      
      this.emit('started');

    } catch (error) {
      console.error('❌ Failed to start time sync service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop time synchronization service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('🕐 Time sync service not running');
      return;
    }

    console.log('🛑 Stopping time synchronization service...');

    // Clear intervals
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

  /**
   * Get current synchronized time
   */
  now(): Date {
    const localTime = new Date();
    const adjustedTime = new Date(localTime.getTime() + this.ntpOffset);
    return adjustedTime;
  }

  /**
   * Get current timestamp in milliseconds (synchronized)
   */
  timestamp(): number {
    return this.now().getTime();
  }

  /**
   * Get current timestamp in ISO string format (synchronized)
   */
  toISOString(): string {
    return this.now().toISOString();
  }

  /**
   * Get exchange-synchronized time
   */
  getExchangeTime(exchange: string): Date {
    const baseTime = this.now();
    const exchangeOffset = this.exchangeOffsets.get(exchange) || 0;
    return new Date(baseTime.getTime() + exchangeOffset);
  }

  /**
   * Perform NTP synchronization
   */
  private async performNtpSync(): Promise<void> {
    try {
      console.log(`🕐 Syncing with NTP server: ${this.config.NTP_SERVER}`);

      const ntpData = await new Promise<any>((resolve, reject) => {
        ntp.getNetworkTime(this.config.NTP_SERVER, 123, (err: Error | null, date?: Date) => {
          if (err) {
            reject(err);
          } else if (date) {
            resolve({ date, offset: date.getTime() - Date.now() });
          } else {
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

      // Check for significant drift
      if (drift > this.config.MAX_TIME_DRIFT) {
        console.warn(`⚠️ High time drift detected: ${drift}ms (max: ${this.config.MAX_TIME_DRIFT}ms)`);
        this.emit('highDrift', { drift, offset: this.ntpOffset });
      }

      // Emit sync event
      this.emit('ntpSync', {
        offset: this.ntpOffset,
        drift,
        serverTime: ntpData.date,
        localTime: new Date()
      });

    } catch (error) {
      this.errorCount++;
      console.error('❌ NTP synchronization failed:', error);
      this.emit('ntpError', error);
      throw error;
    }
  }

  /**
   * Start periodic NTP synchronization
   */
  private startNtpSync(): void {
    this.ntpSyncInterval = setInterval(async () => {
      try {
        await this.performNtpSync();
      } catch (error) {
        console.error('❌ Periodic NTP sync failed:', error);
      }
    }, this.config.TIME_SYNC_INTERVAL);

    console.log(`⏰ NTP sync scheduled every ${this.config.TIME_SYNC_INTERVAL / 1000}s`);
  }

  /**
   * Start exchange time monitoring
   */
  private startExchangeTimeMonitoring(): void {
    // Monitor exchange time every 30 seconds
    this.exchangeSyncInterval = setInterval(() => {
      this.checkExchangeTimeHealth();
    }, 30000);

    console.log('📡 Exchange time monitoring started');
  }

  /**
   * Sync with exchange server time
   */
  async syncWithExchange(exchange: string, exchangeServerTime: Date): Promise<void> {
    try {
      const localTime = this.now();
      const offset = exchangeServerTime.getTime() - localTime.getTime();
      
      // Store exchange offset
      const previousOffset = this.exchangeOffsets.get(exchange) || 0;
      this.exchangeOffsets.set(exchange, offset);
      
      // Update exchange time info
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

      // Check for significant exchange drift
      if (Math.abs(offset) > this.config.MAX_TIME_DRIFT) {
        console.warn(`⚠️ High exchange drift detected (${exchange}): ${offset}ms`);
        this.emit('exchangeDrift', { exchange, offset, drift });
      }

      // Emit exchange sync event
      this.emit('exchangeSync', {
        exchange,
        offset,
        drift,
        exchangeTime: exchangeServerTime,
        localTime
      });

    } catch (error) {
      console.error(`❌ Exchange sync failed (${exchange}):`, error);
      this.emit('exchangeError', { exchange, error });
    }
  }

  /**
   * Check exchange time health
   */
  private checkExchangeTimeHealth(): void {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [exchange, info] of this.exchangeTimeInfo) {
      const timeSinceSync = Date.now() - info.lastSync.getTime();
      
      if (timeSinceSync > staleThreshold) {
        console.warn(`⚠️ Stale exchange time data (${exchange}): ${timeSinceSync / 1000}s old`);
        this.emit('staleExchangeTime', { exchange, timeSinceSync });
      }
    }
  }

  /**
   * Create time sync message for WebSocket broadcasting
   */
  createTimeSyncMessage(): TimeSyncMessage {
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

  /**
   * Get total time drift across all sources
   */
  getTotalDrift(): number {
    const exchangeDrifts = Array.from(this.exchangeOffsets.values());
    const maxExchangeDrift = exchangeDrifts.length > 0 ? Math.max(...exchangeDrifts.map(Math.abs)) : 0;
    return Math.max(Math.abs(this.ntpOffset), maxExchangeDrift);
  }

  /**
   * Get time synchronization statistics
   */
  getStats(): TimeSyncStats {
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

  /**
   * Check if time synchronization is healthy
   */
  isHealthy(): boolean {
    const now = Date.now();
    const ntpStale = this.lastNtpSync ? (now - this.lastNtpSync.getTime()) > (this.config.TIME_SYNC_INTERVAL * 2) : true;
    const highDrift = this.getTotalDrift() > this.config.MAX_TIME_DRIFT;
    const tooManyErrors = this.errorCount > 10;

    return !ntpStale && !highDrift && !tooManyErrors;
  }

  /**
   * Get exchange time information
   */
  getExchangeTimeInfo(): ExchangeTimeInfo[] {
    return Array.from(this.exchangeTimeInfo.values());
  }

  /**
   * Force immediate synchronization
   */
  async forcSync(): Promise<void> {
    console.log('🔄 Forcing immediate time synchronization...');
    await this.performNtpSync();
  }

  /**
   * Get configuration (without sensitive data)
   */
  getConfig(): Omit<TimeSyncConfig, 'NTP_SERVER'> {
    const safeConfig = { ...this.config };
    delete (safeConfig as any).NTP_SERVER;
    return safeConfig;
  }

  /**
   * Calculate precise trading timestamp
   * This is the timestamp that should be used for all trading operations
   */
  getTradingTimestamp(): number {
    return this.timestamp();
  }

  /**
   * Calculate precise trading timestamp for specific exchange
   */
  getExchangeTradingTimestamp(exchange: string): number {
    return this.getExchangeTime(exchange).getTime();
  }

  /**
   * Format timestamp for logging with microsecond precision
   */
  formatPreciseTimestamp(date?: Date): string {
    const timestamp = date || this.now();
    const microseconds = (timestamp.getTime() % 1000) * 1000;
    return `${timestamp.toISOString().slice(0, -1)}${microseconds.toString().padStart(6, '0')}Z`;
  }

  /**
   * Validate timestamp is within acceptable range
   */
  validateTimestamp(timestamp: number, maxAgeMs: number = 60000): boolean {
    const now = this.timestamp();
    const age = Math.abs(now - timestamp);
    return age <= maxAgeMs;
  }
}

// Export singleton instance
export const timeSyncService = new TimeSyncService();

// Export for dependency injection
export default TimeSyncService; 