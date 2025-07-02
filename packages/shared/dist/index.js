"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSTANTS = exports.utils = exports.validateDataSafe = exports.validateData = exports.AppConfigSchema = exports.ExchangeConfigSchema = exports.ExchangeErrorSchema = exports.ValidationErrorSchema = exports.AppErrorSchema = exports.FilterOptionsSchema = exports.PaginationRequestSchema = exports.TimeRangeSchema = exports.LogEntrySchema = exports.SystemHealthSchema = exports.ServiceHealthSchema = exports.UpdateBotRequestSchema = exports.CreateBotRequestSchema = exports.LoginResponseSchema = exports.RegisterRequestSchema = exports.LoginRequestSchema = exports.PaginatedResponseSchema = exports.PaginationSchema = exports.ApiResponseSchema = exports.TimeSyncMessageSchema = exports.MarketDataMessageSchema = exports.BotActionMessageSchema = exports.WebSocketSubscriptionSchema = exports.WebSocketMessageSchema = exports.WebSocketMessageTypeSchema = exports.SignalSchema = exports.PositionSchema = exports.TradeSchema = exports.BotSchema = exports.BotPerformanceSchema = exports.RiskManagementSchema = exports.BotConfigurationSchema = exports.UserSchema = exports.ExchangeApiKeySchema = exports.UserPreferencesSchema = exports.DashboardSettingsSchema = exports.NotificationSettingsSchema = exports.BotStatusSchema = exports.TradeStatusSchema = exports.TradeTypeSchema = exports.TradeSideSchema = exports.TimeframeSchema = exports.ExchangeSchema = exports.StrategySchema = void 0;
var validation_1 = require("./validation");
Object.defineProperty(exports, "StrategySchema", { enumerable: true, get: function () { return validation_1.StrategySchema; } });
Object.defineProperty(exports, "ExchangeSchema", { enumerable: true, get: function () { return validation_1.ExchangeSchema; } });
Object.defineProperty(exports, "TimeframeSchema", { enumerable: true, get: function () { return validation_1.TimeframeSchema; } });
Object.defineProperty(exports, "TradeSideSchema", { enumerable: true, get: function () { return validation_1.TradeSideSchema; } });
Object.defineProperty(exports, "TradeTypeSchema", { enumerable: true, get: function () { return validation_1.TradeTypeSchema; } });
Object.defineProperty(exports, "TradeStatusSchema", { enumerable: true, get: function () { return validation_1.TradeStatusSchema; } });
Object.defineProperty(exports, "BotStatusSchema", { enumerable: true, get: function () { return validation_1.BotStatusSchema; } });
var validation_2 = require("./validation");
Object.defineProperty(exports, "NotificationSettingsSchema", { enumerable: true, get: function () { return validation_2.NotificationSettingsSchema; } });
Object.defineProperty(exports, "DashboardSettingsSchema", { enumerable: true, get: function () { return validation_2.DashboardSettingsSchema; } });
Object.defineProperty(exports, "UserPreferencesSchema", { enumerable: true, get: function () { return validation_2.UserPreferencesSchema; } });
Object.defineProperty(exports, "ExchangeApiKeySchema", { enumerable: true, get: function () { return validation_2.ExchangeApiKeySchema; } });
Object.defineProperty(exports, "UserSchema", { enumerable: true, get: function () { return validation_2.UserSchema; } });
var validation_3 = require("./validation");
Object.defineProperty(exports, "BotConfigurationSchema", { enumerable: true, get: function () { return validation_3.BotConfigurationSchema; } });
Object.defineProperty(exports, "RiskManagementSchema", { enumerable: true, get: function () { return validation_3.RiskManagementSchema; } });
Object.defineProperty(exports, "BotPerformanceSchema", { enumerable: true, get: function () { return validation_3.BotPerformanceSchema; } });
Object.defineProperty(exports, "BotSchema", { enumerable: true, get: function () { return validation_3.BotSchema; } });
var validation_4 = require("./validation");
Object.defineProperty(exports, "TradeSchema", { enumerable: true, get: function () { return validation_4.TradeSchema; } });
Object.defineProperty(exports, "PositionSchema", { enumerable: true, get: function () { return validation_4.PositionSchema; } });
Object.defineProperty(exports, "SignalSchema", { enumerable: true, get: function () { return validation_4.SignalSchema; } });
var validation_5 = require("./validation");
Object.defineProperty(exports, "WebSocketMessageTypeSchema", { enumerable: true, get: function () { return validation_5.WebSocketMessageTypeSchema; } });
Object.defineProperty(exports, "WebSocketMessageSchema", { enumerable: true, get: function () { return validation_5.WebSocketMessageSchema; } });
Object.defineProperty(exports, "WebSocketSubscriptionSchema", { enumerable: true, get: function () { return validation_5.WebSocketSubscriptionSchema; } });
Object.defineProperty(exports, "BotActionMessageSchema", { enumerable: true, get: function () { return validation_5.BotActionMessageSchema; } });
Object.defineProperty(exports, "MarketDataMessageSchema", { enumerable: true, get: function () { return validation_5.MarketDataMessageSchema; } });
Object.defineProperty(exports, "TimeSyncMessageSchema", { enumerable: true, get: function () { return validation_5.TimeSyncMessageSchema; } });
var validation_6 = require("./validation");
Object.defineProperty(exports, "ApiResponseSchema", { enumerable: true, get: function () { return validation_6.ApiResponseSchema; } });
Object.defineProperty(exports, "PaginationSchema", { enumerable: true, get: function () { return validation_6.PaginationSchema; } });
Object.defineProperty(exports, "PaginatedResponseSchema", { enumerable: true, get: function () { return validation_6.PaginatedResponseSchema; } });
Object.defineProperty(exports, "LoginRequestSchema", { enumerable: true, get: function () { return validation_6.LoginRequestSchema; } });
Object.defineProperty(exports, "RegisterRequestSchema", { enumerable: true, get: function () { return validation_6.RegisterRequestSchema; } });
Object.defineProperty(exports, "LoginResponseSchema", { enumerable: true, get: function () { return validation_6.LoginResponseSchema; } });
Object.defineProperty(exports, "CreateBotRequestSchema", { enumerable: true, get: function () { return validation_6.CreateBotRequestSchema; } });
Object.defineProperty(exports, "UpdateBotRequestSchema", { enumerable: true, get: function () { return validation_6.UpdateBotRequestSchema; } });
var validation_7 = require("./validation");
Object.defineProperty(exports, "ServiceHealthSchema", { enumerable: true, get: function () { return validation_7.ServiceHealthSchema; } });
Object.defineProperty(exports, "SystemHealthSchema", { enumerable: true, get: function () { return validation_7.SystemHealthSchema; } });
Object.defineProperty(exports, "LogEntrySchema", { enumerable: true, get: function () { return validation_7.LogEntrySchema; } });
var validation_8 = require("./validation");
Object.defineProperty(exports, "TimeRangeSchema", { enumerable: true, get: function () { return validation_8.TimeRangeSchema; } });
Object.defineProperty(exports, "PaginationRequestSchema", { enumerable: true, get: function () { return validation_8.PaginationRequestSchema; } });
Object.defineProperty(exports, "FilterOptionsSchema", { enumerable: true, get: function () { return validation_8.FilterOptionsSchema; } });
var validation_9 = require("./validation");
Object.defineProperty(exports, "AppErrorSchema", { enumerable: true, get: function () { return validation_9.AppErrorSchema; } });
Object.defineProperty(exports, "ValidationErrorSchema", { enumerable: true, get: function () { return validation_9.ValidationErrorSchema; } });
Object.defineProperty(exports, "ExchangeErrorSchema", { enumerable: true, get: function () { return validation_9.ExchangeErrorSchema; } });
var validation_10 = require("./validation");
Object.defineProperty(exports, "ExchangeConfigSchema", { enumerable: true, get: function () { return validation_10.ExchangeConfigSchema; } });
Object.defineProperty(exports, "AppConfigSchema", { enumerable: true, get: function () { return validation_10.AppConfigSchema; } });
var validation_11 = require("./validation");
Object.defineProperty(exports, "validateData", { enumerable: true, get: function () { return validation_11.validateData; } });
Object.defineProperty(exports, "validateDataSafe", { enumerable: true, get: function () { return validation_11.validateDataSafe; } });
exports.utils = {
    formatTimestamp: (date) => {
        return date.toISOString();
    },
    generateId: () => {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    },
    isValidUUID: (str) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    },
    formatCurrency: (amount, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        }).format(amount);
    },
    formatPercentage: (value, decimals = 2) => {
        return `${value.toFixed(decimals)}%`;
    },
    calculatePnL: (entryPrice, currentPrice, quantity, side) => {
        const multiplier = side === 'buy' ? 1 : -1;
        return (currentPrice - entryPrice) * quantity * multiplier;
    },
    calculateWinRate: (winningTrades, totalTrades) => {
        if (totalTrades === 0)
            return 0;
        return (winningTrades / totalTrades) * 100;
    }
};
exports.CONSTANTS = {
    WS_CHANNELS: {
        MARKET_DATA: 'market-data',
        BOT_STATUS: 'bot-status',
        TRADES: 'trades',
        POSITIONS: 'positions',
        SIGNALS: 'signals',
        TIME_SYNC: 'time-sync',
        SYSTEM_HEALTH: 'system-health'
    },
    DEFAULTS: {
        PAGINATION_LIMIT: 20,
        MAX_PAGINATION_LIMIT: 1000,
        WEBSOCKET_HEARTBEAT_INTERVAL: 30000,
        WEBSOCKET_CONNECTION_TIMEOUT: 10000,
        DEFAULT_LEVERAGE: 1,
        DEFAULT_STOP_LOSS: 5,
        DEFAULT_TAKE_PROFIT: 10,
        MIN_TRADE_AMOUNT: 0.01,
        MAX_RISK_SCORE: 10
    },
    LIMITS: {
        BOT_NAME_MAX_LENGTH: 100,
        BOT_DESCRIPTION_MAX_LENGTH: 500,
        MAX_CONCURRENT_TRADES: 100,
        MAX_LEVERAGE: 100,
        MAX_DAILY_LOSS: 100,
        MAX_DRAWDOWN: 100,
        JWT_SECRET_MIN_LENGTH: 32,
        BCRYPT_MAX_ROUNDS: 20
    },
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
    TRADING: {
        SUPPORTED_EXCHANGES: ['bybit', 'binance', 'okx', 'coinbase', 'kraken'],
        SUPPORTED_STRATEGIES: ['aether', 'target-reacher', 'sma-crossover', 'rsi-divergence', 'custom'],
        SUPPORTED_TIMEFRAMES: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'],
        ORDER_TYPES: ['market', 'limit', 'stop', 'stop-limit'],
        POSITION_SIDES: ['buy', 'sell'],
        FUTURES: {
            MAX_LEVERAGE: 100,
            MIN_LEVERAGE: 1,
            SUPPORTED_MARGIN_MODES: ['isolated', 'cross'],
            POSITION_MODES: ['one-way', 'hedge']
        },
        SPOT: {
            MAX_LEVERAGE: 10,
            MIN_ORDER_SIZE: 0.00001
        }
    }
};
exports.default = {
    utils: exports.utils,
    CONSTANTS: exports.CONSTANTS
};
//# sourceMappingURL=index.js.map