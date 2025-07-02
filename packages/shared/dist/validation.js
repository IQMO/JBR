"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDataSafe = exports.validateData = exports.AppConfigSchema = exports.ExchangeConfigSchema = exports.ExchangeErrorSchema = exports.ValidationErrorSchema = exports.AppErrorSchema = exports.FilterOptionsSchema = exports.PaginationRequestSchema = exports.TimeRangeSchema = exports.LogEntrySchema = exports.SystemHealthSchema = exports.ServiceHealthSchema = exports.UpdateBotRequestSchema = exports.CreateBotRequestSchema = exports.LoginResponseSchema = exports.RegisterRequestSchema = exports.LoginRequestSchema = exports.PaginatedResponseSchema = exports.PaginationSchema = exports.ApiResponseSchema = exports.TimeSyncMessageSchema = exports.MarketDataMessageSchema = exports.BotActionMessageSchema = exports.WebSocketSubscriptionSchema = exports.WebSocketMessageSchema = exports.WebSocketMessageTypeSchema = exports.SignalSchema = exports.PositionSchema = exports.TradeSchema = exports.BotSchema = exports.BotPerformanceSchema = exports.RiskManagementSchema = exports.BotConfigurationSchema = exports.UserSchema = exports.ExchangeApiKeySchema = exports.UserPreferencesSchema = exports.DashboardSettingsSchema = exports.NotificationSettingsSchema = exports.BotStatusSchema = exports.TradeStatusSchema = exports.TradeTypeSchema = exports.TradeSideSchema = exports.TimeframeSchema = exports.ExchangeSchema = exports.StrategySchema = void 0;
const zod_1 = require("zod");
exports.StrategySchema = zod_1.z.enum(['aether', 'target-reacher', 'sma-crossover', 'rsi-divergence', 'custom']);
exports.ExchangeSchema = zod_1.z.enum(['bybit', 'binance', 'okx', 'coinbase', 'kraken']);
exports.TimeframeSchema = zod_1.z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']);
exports.TradeSideSchema = zod_1.z.enum(['buy', 'sell']);
exports.TradeTypeSchema = zod_1.z.enum(['market', 'limit', 'stop', 'stop-limit']);
exports.TradeStatusSchema = zod_1.z.enum(['pending', 'open', 'filled', 'partial', 'cancelled', 'rejected', 'closed']);
exports.BotStatusSchema = zod_1.z.enum(['stopped', 'starting', 'running', 'pausing', 'paused', 'stopping', 'error']);
exports.NotificationSettingsSchema = zod_1.z.object({
    email: zod_1.z.boolean(),
    browser: zod_1.z.boolean(),
    tradingAlerts: zod_1.z.boolean(),
    systemAlerts: zod_1.z.boolean(),
    riskAlerts: zod_1.z.boolean()
});
exports.DashboardSettingsSchema = zod_1.z.object({
    theme: zod_1.z.enum(['light', 'dark', 'system']),
    layout: zod_1.z.enum(['compact', 'standard', 'expanded']),
    refreshRate: zod_1.z.number().positive().min(100).max(60000)
});
exports.UserPreferencesSchema = zod_1.z.object({
    timezone: zod_1.z.string().min(1),
    currency: zod_1.z.string().length(3),
    notifications: exports.NotificationSettingsSchema,
    dashboard: exports.DashboardSettingsSchema
});
exports.ExchangeApiKeySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    exchange: exports.ExchangeSchema,
    keyName: zod_1.z.string().min(1).max(100),
    apiKey: zod_1.z.string().min(1),
    apiSecret: zod_1.z.string().min(1),
    passphrase: zod_1.z.string().optional(),
    sandbox: zod_1.z.boolean(),
    permissions: zod_1.z.array(zod_1.z.string()),
    isActive: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    passwordHash: zod_1.z.string().min(1),
    role: zod_1.z.enum(['admin', 'user']),
    apiKeys: zod_1.z.array(exports.ExchangeApiKeySchema),
    preferences: exports.UserPreferencesSchema,
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.BotConfigurationSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).regex(/^[A-Z0-9]+$/),
    timeframe: exports.TimeframeSchema,
    maxPositionSize: zod_1.z.number().positive(),
    leverage: zod_1.z.number().positive().max(100),
    stopLoss: zod_1.z.number().positive().max(100),
    takeProfit: zod_1.z.number().positive().max(1000),
    tradeAmount: zod_1.z.number().positive(),
    customParameters: zod_1.z.record(zod_1.z.any())
});
exports.RiskManagementSchema = zod_1.z.object({
    maxDailyLoss: zod_1.z.number().positive().max(100),
    maxDrawdown: zod_1.z.number().positive().max(100),
    maxConcurrentTrades: zod_1.z.number().positive().max(100),
    emergencyStop: zod_1.z.boolean(),
    riskScore: zod_1.z.number().min(1).max(10)
});
exports.BotPerformanceSchema = zod_1.z.object({
    totalTrades: zod_1.z.number().nonnegative(),
    winningTrades: zod_1.z.number().nonnegative(),
    losingTrades: zod_1.z.number().nonnegative(),
    totalPnL: zod_1.z.number(),
    winRate: zod_1.z.number().min(0).max(100),
    sharpeRatio: zod_1.z.number().optional(),
    maxDrawdown: zod_1.z.number().nonnegative(),
    averageTradeTime: zod_1.z.number().positive(),
    lastCalculatedAt: zod_1.z.date()
});
exports.BotSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    strategy: exports.StrategySchema,
    exchange: exports.ExchangeSchema,
    exchangeApiKeyId: zod_1.z.string().uuid(),
    status: exports.BotStatusSchema,
    configuration: exports.BotConfigurationSchema,
    riskManagement: exports.RiskManagementSchema,
    performance: exports.BotPerformanceSchema,
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastActiveAt: zod_1.z.date().optional()
});
exports.TradeSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    botId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    exchange: exports.ExchangeSchema,
    symbol: zod_1.z.string().min(1),
    side: exports.TradeSideSchema,
    type: exports.TradeTypeSchema,
    amount: zod_1.z.number().positive(),
    price: zod_1.z.number().positive(),
    leverage: zod_1.z.number().positive(),
    status: exports.TradeStatusSchema,
    entryPrice: zod_1.z.number().positive().optional(),
    exitPrice: zod_1.z.number().positive().optional(),
    stopLoss: zod_1.z.number().positive().optional(),
    takeProfit: zod_1.z.number().positive().optional(),
    pnl: zod_1.z.number().optional(),
    fees: zod_1.z.number().nonnegative(),
    exchangeOrderId: zod_1.z.string().optional(),
    executedAt: zod_1.z.date().optional(),
    closedAt: zod_1.z.date().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.PositionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    botId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    exchange: exports.ExchangeSchema,
    symbol: zod_1.z.string().min(1),
    side: exports.TradeSideSchema,
    size: zod_1.z.number().positive(),
    entryPrice: zod_1.z.number().positive(),
    currentPrice: zod_1.z.number().positive(),
    unrealizedPnl: zod_1.z.number(),
    realizedPnl: zod_1.z.number(),
    leverage: zod_1.z.number().positive(),
    margin: zod_1.z.number().positive(),
    liquidationPrice: zod_1.z.number().positive().optional(),
    stopLoss: zod_1.z.number().positive().optional(),
    takeProfit: zod_1.z.number().positive().optional(),
    isOpen: zod_1.z.boolean(),
    openedAt: zod_1.z.date(),
    closedAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date()
});
exports.SignalSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    botId: zod_1.z.string().uuid(),
    strategy: exports.StrategySchema,
    symbol: zod_1.z.string().min(1),
    side: exports.TradeSideSchema,
    strength: zod_1.z.number().min(0).max(1),
    confidence: zod_1.z.number().min(0).max(1),
    price: zod_1.z.number().positive(),
    timestamp: zod_1.z.date(),
    indicators: zod_1.z.record(zod_1.z.number()),
    metadata: zod_1.z.record(zod_1.z.any())
});
exports.WebSocketMessageTypeSchema = zod_1.z.enum([
    'subscribe',
    'unsubscribe',
    'data',
    'error',
    'heartbeat',
    'auth',
    'bot-action',
    'trade-update',
    'position-update',
    'signal',
    'time-sync'
]);
exports.WebSocketMessageSchema = zod_1.z.object({
    type: exports.WebSocketMessageTypeSchema,
    channel: zod_1.z.string().min(1),
    data: zod_1.z.any(),
    timestamp: zod_1.z.date(),
    requestId: zod_1.z.string().optional()
});
exports.WebSocketSubscriptionSchema = zod_1.z.object({
    channel: zod_1.z.string().min(1),
    symbol: zod_1.z.string().optional(),
    botId: zod_1.z.string().uuid().optional(),
    userId: zod_1.z.string().uuid()
});
exports.BotActionMessageSchema = zod_1.z.object({
    action: zod_1.z.enum(['start', 'stop', 'pause', 'resume', 'update-config']),
    botId: zod_1.z.string().uuid(),
    config: exports.BotConfigurationSchema.partial().optional()
});
exports.MarketDataMessageSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1),
    price: zod_1.z.number().positive(),
    volume: zod_1.z.number().nonnegative(),
    timestamp: zod_1.z.date(),
    exchange: exports.ExchangeSchema
});
exports.TimeSyncMessageSchema = zod_1.z.object({
    serverTime: zod_1.z.date(),
    exchangeTime: zod_1.z.date().optional(),
    drift: zod_1.z.number().optional()
});
exports.ApiResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.any().optional(),
    error: zod_1.z.string().optional(),
    timestamp: zod_1.z.date()
});
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.number().positive(),
    limit: zod_1.z.number().positive().max(1000),
    total: zod_1.z.number().nonnegative(),
    hasNext: zod_1.z.boolean(),
    hasPrev: zod_1.z.boolean()
});
exports.PaginatedResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.array(zod_1.z.any()).optional(),
    error: zod_1.z.string().optional(),
    timestamp: zod_1.z.date(),
    pagination: exports.PaginationSchema
});
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8)
});
exports.RegisterRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    confirmPassword: zod_1.z.string().min(8)
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
});
exports.LoginResponseSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    user: exports.UserSchema.omit({ passwordHash: true, apiKeys: true }),
    expiresAt: zod_1.z.date()
});
exports.CreateBotRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    strategy: exports.StrategySchema,
    exchange: exports.ExchangeSchema,
    exchangeApiKeyId: zod_1.z.string().uuid(),
    configuration: exports.BotConfigurationSchema,
    riskManagement: exports.RiskManagementSchema
});
exports.UpdateBotRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(500).optional(),
    configuration: exports.BotConfigurationSchema.partial().optional(),
    riskManagement: exports.RiskManagementSchema.partial().optional()
});
exports.ServiceHealthSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    status: zod_1.z.enum(['up', 'down', 'degraded']),
    responseTime: zod_1.z.number().nonnegative().optional(),
    lastCheck: zod_1.z.date(),
    details: zod_1.z.record(zod_1.z.any()).optional()
});
exports.SystemHealthSchema = zod_1.z.object({
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    services: zod_1.z.array(exports.ServiceHealthSchema),
    timestamp: zod_1.z.date(),
    uptime: zod_1.z.number().nonnegative()
});
exports.LogEntrySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    level: zod_1.z.enum(['debug', 'info', 'warn', 'error']),
    message: zod_1.z.string().min(1),
    category: zod_1.z.string().min(1),
    userId: zod_1.z.string().uuid().optional(),
    botId: zod_1.z.string().uuid().optional(),
    tradeId: zod_1.z.string().uuid().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    timestamp: zod_1.z.date()
});
exports.TimeRangeSchema = zod_1.z.object({
    start: zod_1.z.date(),
    end: zod_1.z.date()
}).refine((data) => data.start < data.end, {
    message: "Start date must be before end date"
});
exports.PaginationRequestSchema = zod_1.z.object({
    page: zod_1.z.number().positive().default(1),
    limit: zod_1.z.number().positive().max(1000).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc')
});
exports.FilterOptionsSchema = zod_1.z.object({
    status: zod_1.z.array(zod_1.z.string()).optional(),
    exchange: zod_1.z.array(exports.ExchangeSchema).optional(),
    strategy: zod_1.z.array(exports.StrategySchema).optional(),
    dateRange: exports.TimeRangeSchema.optional(),
    search: zod_1.z.string().optional()
});
exports.AppErrorSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    message: zod_1.z.string().min(1),
    details: zod_1.z.record(zod_1.z.any()).optional(),
    timestamp: zod_1.z.date()
});
exports.ValidationErrorSchema = exports.AppErrorSchema.extend({
    field: zod_1.z.string().min(1),
    value: zod_1.z.any(),
    constraint: zod_1.z.string().min(1)
});
exports.ExchangeErrorSchema = exports.AppErrorSchema.extend({
    exchange: exports.ExchangeSchema,
    exchangeCode: zod_1.z.string().optional(),
    exchangeMessage: zod_1.z.string().optional()
});
exports.ExchangeConfigSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    apiUrl: zod_1.z.string().url(),
    wsUrl: zod_1.z.string().url(),
    sandbox: zod_1.z.object({
        apiUrl: zod_1.z.string().url(),
        wsUrl: zod_1.z.string().url()
    }),
    rateLimit: zod_1.z.object({
        requests: zod_1.z.number().positive(),
        window: zod_1.z.number().positive()
    }),
    features: zod_1.z.array(zod_1.z.string())
});
exports.AppConfigSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    version: zod_1.z.string().min(1),
    environment: zod_1.z.enum(['development', 'production', 'test']),
    api: zod_1.z.object({
        port: zod_1.z.number().positive().max(65535),
        cors: zod_1.z.array(zod_1.z.string()),
        rateLimit: zod_1.z.object({
            windowMs: zod_1.z.number().positive(),
            max: zod_1.z.number().positive()
        })
    }),
    websocket: zod_1.z.object({
        port: zod_1.z.number().positive().max(65535),
        heartbeatInterval: zod_1.z.number().positive(),
        connectionTimeout: zod_1.z.number().positive()
    }),
    database: zod_1.z.object({
        host: zod_1.z.string().min(1),
        port: zod_1.z.number().positive().max(65535),
        name: zod_1.z.string().min(1),
        ssl: zod_1.z.boolean()
    }),
    redis: zod_1.z.object({
        host: zod_1.z.string().min(1),
        port: zod_1.z.number().positive().max(65535),
        db: zod_1.z.number().nonnegative()
    }),
    security: zod_1.z.object({
        jwtSecret: zod_1.z.string().min(32),
        jwtExpiresIn: zod_1.z.string().min(1),
        bcryptRounds: zod_1.z.number().positive().max(20)
    }),
    exchanges: zod_1.z.record(exports.ExchangeSchema, exports.ExchangeConfigSchema)
});
const validateData = (schema, data) => {
    try {
        const result = schema.parse(data);
        return { success: true, data: result };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return { success: false, error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
        }
        return { success: false, error: 'Validation failed' };
    }
};
exports.validateData = validateData;
const validateDataSafe = (schema, data) => {
    return schema.safeParse(data);
};
exports.validateDataSafe = validateDataSafe;
//# sourceMappingURL=validation.js.map