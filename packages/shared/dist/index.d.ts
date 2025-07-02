import type { TradeSide } from './types';
export type { User, UserPreferences, NotificationSettings, DashboardSettings, ExchangeApiKey } from './types';
export type { Bot, BotStatus, BotConfiguration, RiskManagement, BotPerformance } from './types';
export type { Trade, TradeSide, TradeType, TradeStatus, Position, Signal } from './types';
export type { Strategy, Exchange, Timeframe } from './types';
export type { WebSocketMessage, WebSocketMessageType, WebSocketResponse, WebSocketSubscription, BotActionMessage, MarketDataMessage, TimeSyncMessage } from './types';
export type { ApiResponse, PaginatedResponse, LoginRequest, LoginResponse, RegisterRequest, CreateBotRequest, UpdateBotRequest } from './types';
export type { SystemHealth, ServiceHealth, LogEntry } from './types';
export type { TimeRange, Pagination, FilterOptions } from './types';
export type { AppError, ValidationError, ExchangeError } from './types';
export type { AppConfig, ExchangeConfig } from './types';
export { StrategySchema, ExchangeSchema, TimeframeSchema, TradeSideSchema, TradeTypeSchema, TradeStatusSchema, BotStatusSchema } from './validation';
export { NotificationSettingsSchema, DashboardSettingsSchema, UserPreferencesSchema, ExchangeApiKeySchema, UserSchema } from './validation';
export { BotConfigurationSchema, RiskManagementSchema, BotPerformanceSchema, BotSchema } from './validation';
export { TradeSchema, PositionSchema, SignalSchema } from './validation';
export { WebSocketMessageTypeSchema, WebSocketMessageSchema, WebSocketSubscriptionSchema, BotActionMessageSchema, MarketDataMessageSchema, TimeSyncMessageSchema } from './validation';
export { ApiResponseSchema, PaginationSchema, PaginatedResponseSchema, LoginRequestSchema, RegisterRequestSchema, LoginResponseSchema, CreateBotRequestSchema, UpdateBotRequestSchema } from './validation';
export { ServiceHealthSchema, SystemHealthSchema, LogEntrySchema } from './validation';
export { TimeRangeSchema, PaginationRequestSchema, FilterOptionsSchema } from './validation';
export { AppErrorSchema, ValidationErrorSchema, ExchangeErrorSchema } from './validation';
export { ExchangeConfigSchema, AppConfigSchema } from './validation';
export { validateData, validateDataSafe } from './validation';
export declare const utils: {
    formatTimestamp: (date: Date) => string;
    generateId: () => string;
    isValidUUID: (str: string) => boolean;
    formatCurrency: (amount: number, currency?: string) => string;
    formatPercentage: (value: number, decimals?: number) => string;
    calculatePnL: (entryPrice: number, currentPrice: number, quantity: number, side: TradeSide) => number;
    calculateWinRate: (winningTrades: number, totalTrades: number) => number;
};
export declare const CONSTANTS: {
    readonly WS_CHANNELS: {
        readonly MARKET_DATA: "market-data";
        readonly BOT_STATUS: "bot-status";
        readonly TRADES: "trades";
        readonly POSITIONS: "positions";
        readonly SIGNALS: "signals";
        readonly TIME_SYNC: "time-sync";
        readonly SYSTEM_HEALTH: "system-health";
    };
    readonly DEFAULTS: {
        readonly PAGINATION_LIMIT: 20;
        readonly MAX_PAGINATION_LIMIT: 1000;
        readonly WEBSOCKET_HEARTBEAT_INTERVAL: 30000;
        readonly WEBSOCKET_CONNECTION_TIMEOUT: 10000;
        readonly DEFAULT_LEVERAGE: 1;
        readonly DEFAULT_STOP_LOSS: 5;
        readonly DEFAULT_TAKE_PROFIT: 10;
        readonly MIN_TRADE_AMOUNT: 0.01;
        readonly MAX_RISK_SCORE: 10;
    };
    readonly LIMITS: {
        readonly BOT_NAME_MAX_LENGTH: 100;
        readonly BOT_DESCRIPTION_MAX_LENGTH: 500;
        readonly MAX_CONCURRENT_TRADES: 100;
        readonly MAX_LEVERAGE: 100;
        readonly MAX_DAILY_LOSS: 100;
        readonly MAX_DRAWDOWN: 100;
        readonly JWT_SECRET_MIN_LENGTH: 32;
        readonly BCRYPT_MAX_ROUNDS: 20;
    };
    readonly ERROR_CODES: {
        readonly VALIDATION_ERROR: "VALIDATION_ERROR";
        readonly AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR";
        readonly AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR";
        readonly EXCHANGE_ERROR: "EXCHANGE_ERROR";
        readonly BOT_ERROR: "BOT_ERROR";
        readonly WEBSOCKET_ERROR: "WEBSOCKET_ERROR";
        readonly DATABASE_ERROR: "DATABASE_ERROR";
        readonly NETWORK_ERROR: "NETWORK_ERROR";
        readonly RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR";
        readonly INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS";
        readonly POSITION_NOT_FOUND: "POSITION_NOT_FOUND";
        readonly BOT_NOT_FOUND: "BOT_NOT_FOUND";
        readonly USER_NOT_FOUND: "USER_NOT_FOUND";
    };
    readonly TRADING: {
        readonly SUPPORTED_EXCHANGES: readonly ["bybit", "binance", "okx", "coinbase", "kraken"];
        readonly SUPPORTED_STRATEGIES: readonly ["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"];
        readonly SUPPORTED_TIMEFRAMES: readonly ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];
        readonly ORDER_TYPES: readonly ["market", "limit", "stop", "stop-limit"];
        readonly POSITION_SIDES: readonly ["buy", "sell"];
        readonly FUTURES: {
            readonly MAX_LEVERAGE: 100;
            readonly MIN_LEVERAGE: 1;
            readonly SUPPORTED_MARGIN_MODES: readonly ["isolated", "cross"];
            readonly POSITION_MODES: readonly ["one-way", "hedge"];
        };
        readonly SPOT: {
            readonly MAX_LEVERAGE: 10;
            readonly MIN_ORDER_SIZE: 0.00001;
        };
    };
};
declare const _default: {
    utils: {
        formatTimestamp: (date: Date) => string;
        generateId: () => string;
        isValidUUID: (str: string) => boolean;
        formatCurrency: (amount: number, currency?: string) => string;
        formatPercentage: (value: number, decimals?: number) => string;
        calculatePnL: (entryPrice: number, currentPrice: number, quantity: number, side: TradeSide) => number;
        calculateWinRate: (winningTrades: number, totalTrades: number) => number;
    };
    CONSTANTS: {
        readonly WS_CHANNELS: {
            readonly MARKET_DATA: "market-data";
            readonly BOT_STATUS: "bot-status";
            readonly TRADES: "trades";
            readonly POSITIONS: "positions";
            readonly SIGNALS: "signals";
            readonly TIME_SYNC: "time-sync";
            readonly SYSTEM_HEALTH: "system-health";
        };
        readonly DEFAULTS: {
            readonly PAGINATION_LIMIT: 20;
            readonly MAX_PAGINATION_LIMIT: 1000;
            readonly WEBSOCKET_HEARTBEAT_INTERVAL: 30000;
            readonly WEBSOCKET_CONNECTION_TIMEOUT: 10000;
            readonly DEFAULT_LEVERAGE: 1;
            readonly DEFAULT_STOP_LOSS: 5;
            readonly DEFAULT_TAKE_PROFIT: 10;
            readonly MIN_TRADE_AMOUNT: 0.01;
            readonly MAX_RISK_SCORE: 10;
        };
        readonly LIMITS: {
            readonly BOT_NAME_MAX_LENGTH: 100;
            readonly BOT_DESCRIPTION_MAX_LENGTH: 500;
            readonly MAX_CONCURRENT_TRADES: 100;
            readonly MAX_LEVERAGE: 100;
            readonly MAX_DAILY_LOSS: 100;
            readonly MAX_DRAWDOWN: 100;
            readonly JWT_SECRET_MIN_LENGTH: 32;
            readonly BCRYPT_MAX_ROUNDS: 20;
        };
        readonly ERROR_CODES: {
            readonly VALIDATION_ERROR: "VALIDATION_ERROR";
            readonly AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR";
            readonly AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR";
            readonly EXCHANGE_ERROR: "EXCHANGE_ERROR";
            readonly BOT_ERROR: "BOT_ERROR";
            readonly WEBSOCKET_ERROR: "WEBSOCKET_ERROR";
            readonly DATABASE_ERROR: "DATABASE_ERROR";
            readonly NETWORK_ERROR: "NETWORK_ERROR";
            readonly RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR";
            readonly INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS";
            readonly POSITION_NOT_FOUND: "POSITION_NOT_FOUND";
            readonly BOT_NOT_FOUND: "BOT_NOT_FOUND";
            readonly USER_NOT_FOUND: "USER_NOT_FOUND";
        };
        readonly TRADING: {
            readonly SUPPORTED_EXCHANGES: readonly ["bybit", "binance", "okx", "coinbase", "kraken"];
            readonly SUPPORTED_STRATEGIES: readonly ["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"];
            readonly SUPPORTED_TIMEFRAMES: readonly ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];
            readonly ORDER_TYPES: readonly ["market", "limit", "stop", "stop-limit"];
            readonly POSITION_SIDES: readonly ["buy", "sell"];
            readonly FUTURES: {
                readonly MAX_LEVERAGE: 100;
                readonly MIN_LEVERAGE: 1;
                readonly SUPPORTED_MARGIN_MODES: readonly ["isolated", "cross"];
                readonly POSITION_MODES: readonly ["one-way", "hedge"];
            };
            readonly SPOT: {
                readonly MAX_LEVERAGE: 10;
                readonly MIN_ORDER_SIZE: 0.00001;
            };
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map