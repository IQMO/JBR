export interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: 'admin' | 'user';
    apiKeys: ExchangeApiKey[];
    preferences: UserPreferences;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserPreferences {
    timezone: string;
    currency: string;
    notifications: NotificationSettings;
    dashboard: DashboardSettings;
}
export interface NotificationSettings {
    email: boolean;
    browser: boolean;
    tradingAlerts: boolean;
    systemAlerts: boolean;
    riskAlerts: boolean;
}
export interface DashboardSettings {
    theme: 'light' | 'dark' | 'system';
    layout: 'compact' | 'standard' | 'expanded';
    refreshRate: number;
}
export interface ExchangeApiKey {
    id: string;
    userId: string;
    exchange: Exchange;
    keyName: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    sandbox: boolean;
    permissions: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Bot {
    id: string;
    userId: string;
    name: string;
    description?: string;
    strategy: Strategy;
    exchange: Exchange;
    exchangeApiKeyId: string;
    status: BotStatus;
    configuration: BotConfiguration;
    riskManagement: RiskManagement;
    performance: BotPerformance;
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;
}
export type BotStatus = 'stopped' | 'starting' | 'running' | 'pausing' | 'paused' | 'stopping' | 'error';
export interface BotConfiguration {
    symbol: string;
    timeframe: Timeframe;
    maxPositionSize: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    tradeAmount: number;
    customParameters: Record<string, any>;
}
export interface RiskManagement {
    maxDailyLoss: number;
    maxDrawdown: number;
    maxConcurrentTrades: number;
    emergencyStop: boolean;
    riskScore: number;
}
export interface BotPerformance {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    sharpeRatio?: number;
    maxDrawdown: number;
    averageTradeTime: number;
    lastCalculatedAt: Date;
}
export interface Trade {
    id: string;
    botId: string;
    userId: string;
    exchange: Exchange;
    symbol: string;
    side: TradeSide;
    type: TradeType;
    amount: number;
    price: number;
    leverage: number;
    status: TradeStatus;
    entryPrice?: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    pnl?: number;
    fees: number;
    exchangeOrderId?: string;
    executedAt?: Date;
    closedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export type TradeSide = 'buy' | 'sell';
export type TradeType = 'market' | 'limit' | 'stop' | 'stop-limit';
export type TradeStatus = 'pending' | 'open' | 'filled' | 'partial' | 'cancelled' | 'rejected' | 'closed';
export interface Position {
    id: string;
    botId: string;
    userId: string;
    exchange: Exchange;
    symbol: string;
    side: TradeSide;
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    leverage: number;
    margin: number;
    liquidationPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    isOpen: boolean;
    openedAt: Date;
    closedAt?: Date;
    updatedAt: Date;
}
export interface Signal {
    id: string;
    botId: string;
    strategy: Strategy;
    symbol: string;
    side: TradeSide;
    strength: number;
    confidence: number;
    price: number;
    timestamp: Date;
    indicators: Record<string, number>;
    metadata: Record<string, any>;
}
export type Strategy = 'aether' | 'target-reacher' | 'sma-crossover' | 'rsi-divergence' | 'custom';
export type Exchange = 'bybit' | 'binance' | 'okx' | 'coinbase' | 'kraken';
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';
export interface WebSocketMessage<T = any> {
    type: WebSocketMessageType;
    channel: string;
    data: T;
    timestamp?: Date;
    requestId?: string;
}
export interface WebSocketResponse<T = any> {
    type: WebSocketMessageType;
    channel: string;
    data: T;
    timestamp?: string;
    requestId?: string;
}
export type WebSocketMessageType = 'subscribe' | 'unsubscribe' | 'subscribed' | 'unsubscribed' | 'data' | 'error' | 'heartbeat' | 'ping' | 'pong' | 'connection' | 'auth' | 'bot_command' | 'bot_command_ack' | 'bot-action' | 'trade-update' | 'position-update' | 'signal' | 'time-sync';
export interface WebSocketSubscription {
    channel: string;
    symbol?: string;
    botId?: string;
    userId: string;
}
export interface BotActionMessage {
    action: 'start' | 'stop' | 'pause' | 'resume' | 'update-config';
    botId: string;
    config?: Partial<BotConfiguration>;
}
export interface MarketDataMessage {
    symbol: string;
    price: number;
    volume: number;
    timestamp: Date;
    exchange: Exchange;
}
export interface TimeSyncMessage {
    serverTime: Date;
    exchangeTime?: Date;
    drift?: number;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: Date;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: Omit<User, 'passwordHash' | 'apiKeys'>;
    expiresAt: Date;
}
export interface RegisterRequest {
    email: string;
    password: string;
    confirmPassword: string;
}
export interface CreateBotRequest {
    name: string;
    description?: string;
    strategy: Strategy;
    exchange: Exchange;
    exchangeApiKeyId: string;
    configuration: BotConfiguration;
    riskManagement: RiskManagement;
}
export interface UpdateBotRequest {
    name?: string;
    description?: string;
    configuration?: Partial<BotConfiguration>;
    riskManagement?: Partial<RiskManagement>;
}
export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealth[];
    timestamp: Date;
    uptime: number;
}
export interface ServiceHealth {
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastCheck: Date;
    details?: Record<string, any>;
}
export interface LogEntry {
    id: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    category: string;
    userId?: string;
    botId?: string;
    tradeId?: string;
    metadata?: Record<string, any>;
    timestamp: Date;
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface Pagination {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface FilterOptions {
    status?: string[];
    exchange?: Exchange[];
    strategy?: Strategy[];
    dateRange?: TimeRange;
    search?: string;
}
export interface AppError {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
}
export interface ValidationError extends AppError {
    field: string;
    value: any;
    constraint: string;
}
export interface ExchangeError extends AppError {
    exchange: Exchange;
    exchangeCode?: string;
    exchangeMessage?: string;
}
export interface AppConfig {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
    api: {
        port: number;
        cors: string[];
        rateLimit: {
            windowMs: number;
            max: number;
        };
    };
    websocket: {
        port: number;
        heartbeatInterval: number;
        connectionTimeout: number;
    };
    database: {
        host: string;
        port: number;
        name: string;
        ssl: boolean;
    };
    redis: {
        host: string;
        port: number;
        db: number;
    };
    security: {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
    };
    exchanges: Record<Exchange, ExchangeConfig>;
}
export interface ExchangeConfig {
    name: string;
    apiUrl: string;
    wsUrl: string;
    sandbox: {
        apiUrl: string;
        wsUrl: string;
    };
    rateLimit: {
        requests: number;
        window: number;
    };
    features: string[];
}
//# sourceMappingURL=types.d.ts.map