/**
 * Exchange Manager - Centralized Exchange Connection Management
 * 
 * Manages multiple exchange connections and provides a unified interface
 * for trading across different exchanges. Handles:
 * - Exchange connection lifecycle
 * - API key management
 * - Exchange selection based on trading pairs
 * - Connection health monitoring
 * - Automatic reconnection
 */

import { EventEmitter } from 'events';

import type { 
  Exchange, 
  ExchangeApiKey} from '@jabbr/shared';
import { 
  MarketType
} from '@jabbr/shared';

import { database } from '../services/database.service';

import type { BaseExchange } from './base-exchange';
import type { ExchangeCapabilities } from './base-exchange';
import { BybitExchange } from './bybit-exchange';
// import { BinanceExchange } from './binance-exchange'; // TODO: Implement BinanceExchange


export interface ExchangeConnection {
  exchange: Exchange;
  instance: BaseExchange;
  apiKeyId: string;
  isConnected: boolean;
  lastConnectedAt?: Date;
  lastError?: string;
  capabilities: ExchangeCapabilities;
}

export interface ExchangeManagerConfig {
  autoReconnect: boolean;
  reconnectInterval: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  maxReconnectAttempts: number;
}

export class ExchangeManager extends EventEmitter {
  private exchanges: Map<string, ExchangeConnection> = new Map();
  private config: ExchangeManagerConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private reconnectAttempts: Map<string, number> = new Map();

  constructor(config?: Partial<ExchangeManagerConfig>) {
    super();
    
    this.config = {
      autoReconnect: true,
      reconnectInterval: 30000, // 30 seconds
      healthCheckInterval: 60000, // 1 minute
      maxReconnectAttempts: 5,
      ...config
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize exchange connection
   */
  async initializeExchange(
    exchange: Exchange,
    apiKeyId: string,
    isTestnet = false
  ): Promise<ExchangeConnection> {
    try {
      console.log('🔌 Initializing exchange connection', {
        exchange,
        apiKeyId,
        isTestnet
      });

      // Load API key from database
      const apiKey = await this.loadApiKey(apiKeyId);
      if (!apiKey) {
        throw new Error(`API key ${apiKeyId} not found`);
      }

      // Create exchange instance
      const exchangeInstance = this.createExchangeInstance(exchange, apiKey, isTestnet);
      
      // Connect to exchange
      await exchangeInstance.connect();
      
      // Test connection
      const isConnected = await exchangeInstance.testConnection();
      if (!isConnected) {
        throw new Error('Failed to establish connection to exchange');
      }

      // Get exchange capabilities
      const capabilities = exchangeInstance.getCapabilities();

      // Create connection object
      const connection: ExchangeConnection = {
        exchange,
        instance: exchangeInstance,
        apiKeyId,
        isConnected: true,
        lastConnectedAt: new Date(),
        capabilities
      };

      // Store connection
      const connectionKey = this.getConnectionKey(exchange, apiKeyId);
      this.exchanges.set(connectionKey, connection);

      console.log('✅ Exchange connection established', {
        exchange,
        apiKeyId,
        capabilities
      });

      this.emit('exchange-connected', {
        exchange,
        apiKeyId,
        capabilities
      });

      return connection;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('❌ Failed to initialize exchange', {
        exchange,
        apiKeyId,
        error: errorMessage
      });

      // Store failed connection for retry
      const connectionKey = this.getConnectionKey(exchange, apiKeyId);
      this.exchanges.set(connectionKey, {
        exchange,
        instance: null as any,
        apiKeyId,
        isConnected: false,
        lastError: errorMessage,
        capabilities: {} as any
      });

      throw new Error(`Exchange initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Get exchange connection for trading
   */
  async getExchange(
    exchange: Exchange,
    apiKeyId?: string
  ): Promise<BaseExchange> {
    // If apiKeyId provided, get specific connection
    if (apiKeyId) {
      const connectionKey = this.getConnectionKey(exchange, apiKeyId);
      const connection = this.exchanges.get(connectionKey);
      
      if (!connection) {
        throw new Error(`No connection found for ${exchange} with API key ${apiKeyId}`);
      }

      if (!connection.isConnected) {
        throw new Error(`Exchange ${exchange} is not connected`);
      }

      return connection.instance;
    }

    // Otherwise, get any connected instance for the exchange
    for (const connection of this.exchanges.values()) {
      if (connection.exchange === exchange && connection.isConnected) {
        return connection.instance;
      }
    }

    throw new Error(`No connected instance found for ${exchange}`);
  }

  /**
   * Get all connected exchanges
   */
  getConnectedExchanges(): ExchangeConnection[] {
    return Array.from(this.exchanges.values()).filter(conn => conn.isConnected);
  }

  /**
   * Get exchange for a specific trading pair
   */
  async getExchangeForSymbol(
    symbol: string,
    marketType: MarketType
  ): Promise<BaseExchange | null> {
    // Find exchanges that support this symbol and market type
    const supportedExchanges: BaseExchange[] = [];

    for (const connection of this.exchanges.values()) {
      if (!connection.isConnected) {continue;}

      // Check if exchange supports the market type
      if (marketType === MarketType.SPOT && !connection.capabilities.spot) {continue;}
      if (marketType === MarketType.FUTURES && !connection.capabilities.futures) {continue;}

      try {
        // Test if symbol is available
        await connection.instance.getMarketData(symbol, marketType);
        supportedExchanges.push(connection.instance);
      } catch (error) {
        // Symbol not available on this exchange
        continue;
      }
    }

    // Return the first available exchange (could be enhanced with selection logic)
    return supportedExchanges.length > 0 ? supportedExchanges.at(0) || null : null;
  }

  /**
   * Disconnect from an exchange
   */
  async disconnectExchange(exchange: Exchange, apiKeyId: string): Promise<void> {
    const connectionKey = this.getConnectionKey(exchange, apiKeyId);
    const connection = this.exchanges.get(connectionKey);

    if (!connection) {
      console.warn('⚠️ No connection found to disconnect', {
        exchange,
        apiKeyId
      });
      return;
    }

    try {
      if (connection.instance && connection.isConnected) {
        await connection.instance.disconnect();
      }

      connection.isConnected = false;
      
      console.log('🔌 Exchange disconnected', {
        exchange,
        apiKeyId
      });

      this.emit('exchange-disconnected', {
        exchange,
        apiKeyId
      });

    } catch (error) {
      console.error('❌ Error disconnecting from exchange', {
        exchange,
        apiKeyId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Disconnect from all exchanges
   */
  async disconnectAll(): Promise<void> {
    console.log('🔌 Disconnecting from all exchanges');

    const disconnectPromises: Promise<void>[] = [];

    for (const connection of this.exchanges.values()) {
      if (connection.isConnected) {
        disconnectPromises.push(
          this.disconnectExchange(connection.exchange, connection.apiKeyId)
        );
      }
    }

    await Promise.all(disconnectPromises);

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    console.log('✅ All exchanges disconnected');
  }

  /**
   * Create exchange instance based on type
   */
  private createExchangeInstance(
    exchange: Exchange,
    apiKey: ExchangeApiKey,
    isTestnet: boolean
  ): BaseExchange {
    switch (exchange) {
      case 'bybit':
        return new BybitExchange(apiKey, isTestnet);
      
      case 'binance':
        // TODO: Implement BinanceExchange
        throw new Error('Binance exchange not yet implemented');
        // return new BinanceExchange(apiKey, isTestnet);
      
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  /**
   * Load API key from database
   */
  private async loadApiKey(apiKeyId: string): Promise<ExchangeApiKey | null> {
    try {
      const result = await database.query(
        'SELECT * FROM exchange_api_keys WHERE id = $1 AND is_active = true',
        [apiKeyId]
      );

      if (result.length === 0) {
        return null;
      }

      const row = result.at(0);
      
      return {
        id: row.id,
        userId: row.user_id,
        exchange: row.exchange,
        keyName: row.label,
        apiKey: row.api_key,
        apiSecret: row.api_secret,
        passphrase: row.passphrase,
        sandbox: row.is_testnet,
        permissions: row.permissions,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };

    } catch (error) {
      console.error('❌ Failed to load API key', {
        apiKeyId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Start health monitoring for all connections
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(
      () => this.checkConnectionHealth(),
      this.config.healthCheckInterval
    );
  }

  /**
   * Check health of all connections
   */
  private async checkConnectionHealth(): Promise<void> {
    for (const [key, connection] of this.exchanges.entries()) {
      if (!connection.instance) {continue;}

      try {
        const isHealthy = await connection.instance.testConnection();
        
        if (isHealthy && !connection.isConnected) {
          // Connection restored
          connection.isConnected = true;
          connection.lastConnectedAt = new Date();
          connection.lastError = undefined;
          
          console.log('✅ Exchange connection restored', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId
          });

          this.emit('exchange-reconnected', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId
          });

          // Reset reconnect attempts
          this.reconnectAttempts.delete(key);

        } else if (!isHealthy && connection.isConnected) {
          // Connection lost
          connection.isConnected = false;
          connection.lastError = 'Health check failed';
          
          console.warn('⚠️ Exchange connection lost', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId
          });

          this.emit('exchange-connection-lost', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId
          });

          // Attempt reconnection if enabled
          if (this.config.autoReconnect) {
            this.scheduleReconnect(connection);
          }
        }

      } catch (error) {
        if (connection.isConnected) {
          connection.isConnected = false;
          connection.lastError = error instanceof Error ? error.message : String(error);
          
          console.error('❌ Exchange health check failed', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId,
            error: connection.lastError
          });

          if (this.config.autoReconnect) {
            this.scheduleReconnect(connection);
          }
        }
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private async scheduleReconnect(connection: ExchangeConnection): Promise<void> {
    const key = this.getConnectionKey(connection.exchange, connection.apiKeyId);
    const attempts = this.reconnectAttempts.get(key) || 0;

    if (attempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached', {
        exchange: connection.exchange,
        apiKeyId: connection.apiKeyId,
        attempts
      });
      return;
    }

    this.reconnectAttempts.set(key, attempts + 1);

    setTimeout(async () => {
      try {
        console.log('🔄 Attempting to reconnect', {
          exchange: connection.exchange,
          apiKeyId: connection.apiKeyId,
          attempt: attempts + 1
        });

        await connection.instance.connect();
        const isConnected = await connection.instance.testConnection();

        if (isConnected) {
          connection.isConnected = true;
          connection.lastConnectedAt = new Date();
          connection.lastError = undefined;
          this.reconnectAttempts.delete(key);

          console.log('✅ Reconnection successful', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId
          });

          this.emit('exchange-reconnected', {
            exchange: connection.exchange,
            apiKeyId: connection.apiKeyId
          });
        } else {
          throw new Error('Connection test failed');
        }

      } catch (error) {
        console.error('❌ Reconnection failed', {
          exchange: connection.exchange,
          apiKeyId: connection.apiKeyId,
          attempt: attempts + 1,
          error: error instanceof Error ? error.message : String(error)
        });

        // Schedule next attempt
        this.scheduleReconnect(connection);
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Get connection key
   */
  private getConnectionKey(exchange: Exchange, apiKeyId: string): string {
    return `${exchange}:${apiKeyId}`;
  }

  /**
   * Get exchange manager statistics
   */
  getStats() {
    const connections = Array.from(this.exchanges.values());
    
    return {
      totalConnections: connections.length,
      connectedExchanges: connections.filter(c => c.isConnected).length,
      disconnectedExchanges: connections.filter(c => !c.isConnected).length,
      exchanges: connections.map(c => ({
        exchange: c.exchange,
        apiKeyId: c.apiKeyId,
        isConnected: c.isConnected,
        lastConnectedAt: c.lastConnectedAt,
        lastError: c.lastError
      }))
    };
  }
} 