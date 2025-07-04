/**
 * Jabbr Trading Bot Platform - Shared Package Entry Point
 * 
 * This file exports all shared TypeScript types, Zod validation schemas,
 * and utility functions for use across the platform.
 */

// Import types needed for utility functions
import type { TradeSide } from './types';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Core entity types
export type {
  User,
  UserPreferences,
  NotificationSettings,
  DashboardSettings,
  ExchangeApiKey
} from './types';

// Bot entity types
export type {
  Bot,
  BotStatus,
  BotConfiguration,
  RiskManagement,
  BotPerformance
} from './types';

// Test utility types
export type {
  Candle,
  CandleGenerationOptions
} from './test-utils/data-generators';
export type { 
  StrategyContext,
  TradingContext
} from './test-utils/context-generators';

// Status utility types
export type {
  BotStatus as SharedBotStatus,
  RiskLevel,
  ConnectionStatusState
} from './utils/status-utils';

// Trading entity types
export type {
  Trade,
  TradeSide,
  TradeType,
  TradeStatus,
  Position,
  Signal,
  StrategyPerformanceMetrics,
  PositionSummary,
  SignalSummary,
  RiskMetrics,
  StrategyUpdateMessage,
  StrategySummary
} from './types';

// Market type enum
export { MarketType } from './types';

// Strategy and exchange types
export type {
  Strategy,
  Exchange,
  Timeframe
} from './types';

// WebSocket message types
export type {
  WebSocketMessage,
  WebSocketMessageType,
  WebSocketResponse,
  WebSocketSubscription,
  BotActionMessage,
  MarketDataMessage,
  TimeSyncMessage
} from './types';

// API request/response types
export type {
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  CreateBotRequest,
  UpdateBotRequest
} from './types';

// System and monitoring types
export type {
  SystemHealth,
  ServiceHealth,
  LogEntry
} from './types';

// Utility types
export type {
  TimeRange,
  Pagination,
  FilterOptions
} from './types';

// Error types
export type {
  AppError,
  ValidationError,
  ExchangeError
} from './types';

// Configuration types
export type {
  AppConfig,
  ExchangeConfig
} from './types';

// ============================================================================
// VALIDATION SCHEMA EXPORTS
// ============================================================================

// Basic validation schemas
export {
  StrategySchema,
  ExchangeSchema,
  TimeframeSchema,
  TradeSideSchema,
  TradeTypeSchema,
  TradeStatusSchema,
  BotStatusSchema
} from './validation';

// Core entity schemas
export {
  NotificationSettingsSchema,
  DashboardSettingsSchema,
  UserPreferencesSchema,
  ExchangeApiKeySchema,
  UserSchema
} from './validation';

// Bot entity schemas
export {
  BotConfigurationSchema,
  RiskManagementSchema,
  BotPerformanceSchema,
  BotSchema
} from './validation';

// Trading entity schemas
export {
  TradeSchema,
  PositionSchema,
  SignalSchema
} from './validation';

// WebSocket message schemas
export {
  WebSocketMessageTypeSchema,
  WebSocketMessageSchema,
  WebSocketSubscriptionSchema,
  BotActionMessageSchema,
  MarketDataMessageSchema,
  TimeSyncMessageSchema
} from './validation';

// API request/response schemas
export {
  ApiResponseSchema,
  PaginationSchema,
  PaginatedResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  LoginResponseSchema,
  CreateBotRequestSchema,
  UpdateBotRequestSchema
} from './validation';

// System and monitoring schemas
export {
  ServiceHealthSchema,
  SystemHealthSchema,
  LogEntrySchema
} from './validation';

// Utility schemas
export {
  TimeRangeSchema,
  PaginationRequestSchema,
  FilterOptionsSchema
} from './validation';

// Error schemas
export {
  AppErrorSchema,
  ValidationErrorSchema,
  ExchangeErrorSchema
} from './validation';

// Configuration schemas
export {
  ExchangeConfigSchema,
  AppConfigSchema
} from './validation';

// Validation helper functions
export {
  validateData,
  validateDataSafe
} from './validation';

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

// Re-export the utility functions from the original index
export const utils = {
  formatTimestamp: (date: Date): string => {
    return date.toISOString();
  },
  
  generateId: (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  // Add more utility functions as needed
  isValidUUID: (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },

  formatCurrency: (amount: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(amount);
  },

  formatPercentage: (value: number, decimals = 2): string => {
    return `${value.toFixed(decimals)}%`;
  },

  calculatePnL: (entryPrice: number, currentPrice: number, quantity: number, side: TradeSide): number => {
    const multiplier = side === 'buy' ? 1 : -1;
    return (currentPrice - entryPrice) * quantity * multiplier;
  },

  calculateWinRate: (winningTrades: number, totalTrades: number): number => {
    if (totalTrades === 0) {return 0;}
    return (winningTrades / totalTrades) * 100;
  }
};

// ============================================================================
// UTILITY FUNCTION EXPORTS  
// ============================================================================

// Test data generation utilities
export {
  generateBullishCandles,
  generateBearishCandles,
  generateCrossoverCandles,
  generateMixedTrendCandles,
  generateSyntheticCandles,
  generateTestData,
  generateSampleData,
  generateCandlesWithTrends,
  timeframeToMs
} from './test-utils/data-generators';

// Test context utilities
export {
  createMockContext,
  createMockContextWithPosition,
  createBacktestContext,
  createTradingContext,
  loadHistoricalData
} from './test-utils/context-generators';

// Status and color utilities
export {
  getBotStatusColor,
  getBotStatusIcon,
  getConnectionStatusColor,
  getConnectionStatusText,
  getRiskColor,
  getRiskLevel,
  getRunningStatusColor,
  canPerformBotAction,
  formatCurrency,
  formatPercentage,
  formatUptime,
  getStatusBadgeClasses
} from './utils/status-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

export const CONSTANTS = {
  // WebSocket channels
  WS_CHANNELS: {
    MARKET_DATA: 'market-data',
    BOT_STATUS: 'bot-status',
    TRADES: 'trades',
    POSITIONS: 'positions',
    SIGNALS: 'signals',
    TIME_SYNC: 'time-sync',
    SYSTEM_HEALTH: 'system-health',
    STRATEGY_PERFORMANCE: 'strategy-performance',
    STRATEGY_SIGNALS: 'strategy-signals',
    RISK_ALERTS: 'risk-alerts',
    ALERTS: 'alerts'
  },

  // Default values
  DEFAULTS: {
    PAGINATION_LIMIT: 20,
    MAX_PAGINATION_LIMIT: 1000,
    WEBSOCKET_HEARTBEAT_INTERVAL: 30000, // 30 seconds
    WEBSOCKET_CONNECTION_TIMEOUT: 10000, // 10 seconds
    DEFAULT_LEVERAGE: 1,
    DEFAULT_STOP_LOSS: 5, // 5%
    DEFAULT_TAKE_PROFIT: 10, // 10%
    MIN_TRADE_AMOUNT: 0.01,
    MAX_RISK_SCORE: 10
  },

  // Validation limits
  LIMITS: {
    BOT_NAME_MAX_LENGTH: 100,
    BOT_DESCRIPTION_MAX_LENGTH: 500,
    MAX_CONCURRENT_TRADES: 100,
    MAX_LEVERAGE: 100,
    MAX_DAILY_LOSS: 100, // percentage
    MAX_DRAWDOWN: 100, // percentage
    JWT_SECRET_MIN_LENGTH: 32,
    BCRYPT_MAX_ROUNDS: 20
  },

  // Error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    EXCHANGE_ERROR: 'EXCHANGE_ERROR',
    BOT_ERROR: 'BOT_ERROR',
    WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    POSITION_NOT_FOUND: 'POSITION_NOT_FOUND',
    BOT_NOT_FOUND: 'BOT_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND'
  },

  // Trading specific constants
  TRADING: {
    SUPPORTED_EXCHANGES: ['bybit', 'binance', 'okx', 'coinbase', 'kraken'] as const,
    SUPPORTED_STRATEGIES: ['aether', 'target-reacher', 'sma-crossover', 'rsi-divergence', 'custom'] as const,
    SUPPORTED_TIMEFRAMES: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'] as const,
    ORDER_TYPES: ['market', 'limit', 'stop', 'stop-limit'] as const,
    POSITION_SIDES: ['buy', 'sell'] as const,
    
    // Futures specific
    FUTURES: {
      MAX_LEVERAGE: 100,
      MIN_LEVERAGE: 1,
      SUPPORTED_MARGIN_MODES: ['isolated', 'cross'] as const,
      POSITION_MODES: ['one-way', 'hedge'] as const
    },
    
    // Spot specific  
    SPOT: {
      MAX_LEVERAGE: 10, // Most exchanges limit spot margin to 10x
      MIN_ORDER_SIZE: 0.00001 // Minimum order size
    }
  }
} as const;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  utils,
  CONSTANTS
}; 