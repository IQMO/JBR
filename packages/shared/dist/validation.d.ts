import { z } from 'zod';
export declare const StrategySchema: z.ZodEnum<["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"]>;
export declare const ExchangeSchema: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
export declare const TimeframeSchema: z.ZodEnum<["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]>;
export declare const TradeSideSchema: z.ZodEnum<["buy", "sell"]>;
export declare const TradeTypeSchema: z.ZodEnum<["market", "limit", "stop", "stop-limit"]>;
export declare const TradeStatusSchema: z.ZodEnum<["pending", "open", "filled", "partial", "cancelled", "rejected", "closed"]>;
export declare const BotStatusSchema: z.ZodEnum<["stopped", "starting", "running", "pausing", "paused", "stopping", "error"]>;
export declare const NotificationSettingsSchema: z.ZodObject<{
    email: z.ZodBoolean;
    browser: z.ZodBoolean;
    tradingAlerts: z.ZodBoolean;
    systemAlerts: z.ZodBoolean;
    riskAlerts: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    email: boolean;
    browser: boolean;
    tradingAlerts: boolean;
    systemAlerts: boolean;
    riskAlerts: boolean;
}, {
    email: boolean;
    browser: boolean;
    tradingAlerts: boolean;
    systemAlerts: boolean;
    riskAlerts: boolean;
}>;
export declare const DashboardSettingsSchema: z.ZodObject<{
    theme: z.ZodEnum<["light", "dark", "system"]>;
    layout: z.ZodEnum<["compact", "standard", "expanded"]>;
    refreshRate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    theme: "light" | "dark" | "system";
    layout: "compact" | "standard" | "expanded";
    refreshRate: number;
}, {
    theme: "light" | "dark" | "system";
    layout: "compact" | "standard" | "expanded";
    refreshRate: number;
}>;
export declare const UserPreferencesSchema: z.ZodObject<{
    timezone: z.ZodString;
    currency: z.ZodString;
    notifications: z.ZodObject<{
        email: z.ZodBoolean;
        browser: z.ZodBoolean;
        tradingAlerts: z.ZodBoolean;
        systemAlerts: z.ZodBoolean;
        riskAlerts: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        email: boolean;
        browser: boolean;
        tradingAlerts: boolean;
        systemAlerts: boolean;
        riskAlerts: boolean;
    }, {
        email: boolean;
        browser: boolean;
        tradingAlerts: boolean;
        systemAlerts: boolean;
        riskAlerts: boolean;
    }>;
    dashboard: z.ZodObject<{
        theme: z.ZodEnum<["light", "dark", "system"]>;
        layout: z.ZodEnum<["compact", "standard", "expanded"]>;
        refreshRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        theme: "light" | "dark" | "system";
        layout: "compact" | "standard" | "expanded";
        refreshRate: number;
    }, {
        theme: "light" | "dark" | "system";
        layout: "compact" | "standard" | "expanded";
        refreshRate: number;
    }>;
}, "strip", z.ZodTypeAny, {
    timezone: string;
    currency: string;
    notifications: {
        email: boolean;
        browser: boolean;
        tradingAlerts: boolean;
        systemAlerts: boolean;
        riskAlerts: boolean;
    };
    dashboard: {
        theme: "light" | "dark" | "system";
        layout: "compact" | "standard" | "expanded";
        refreshRate: number;
    };
}, {
    timezone: string;
    currency: string;
    notifications: {
        email: boolean;
        browser: boolean;
        tradingAlerts: boolean;
        systemAlerts: boolean;
        riskAlerts: boolean;
    };
    dashboard: {
        theme: "light" | "dark" | "system";
        layout: "compact" | "standard" | "expanded";
        refreshRate: number;
    };
}>;
export declare const ExchangeApiKeySchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
    keyName: z.ZodString;
    apiKey: z.ZodString;
    apiSecret: z.ZodString;
    passphrase: z.ZodOptional<z.ZodString>;
    sandbox: z.ZodBoolean;
    permissions: z.ZodArray<z.ZodString, "many">;
    isActive: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    keyName: string;
    apiKey: string;
    apiSecret: string;
    sandbox: boolean;
    permissions: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    passphrase?: string | undefined;
}, {
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    keyName: string;
    apiKey: string;
    apiSecret: string;
    sandbox: boolean;
    permissions: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    passphrase?: string | undefined;
}>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    passwordHash: z.ZodString;
    role: z.ZodEnum<["admin", "user"]>;
    apiKeys: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
        keyName: z.ZodString;
        apiKey: z.ZodString;
        apiSecret: z.ZodString;
        passphrase: z.ZodOptional<z.ZodString>;
        sandbox: z.ZodBoolean;
        permissions: z.ZodArray<z.ZodString, "many">;
        isActive: z.ZodBoolean;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        id: string;
        userId: string;
        exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
        keyName: string;
        apiKey: string;
        apiSecret: string;
        sandbox: boolean;
        permissions: string[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        passphrase?: string | undefined;
    }, {
        id: string;
        userId: string;
        exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
        keyName: string;
        apiKey: string;
        apiSecret: string;
        sandbox: boolean;
        permissions: string[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        passphrase?: string | undefined;
    }>, "many">;
    preferences: z.ZodObject<{
        timezone: z.ZodString;
        currency: z.ZodString;
        notifications: z.ZodObject<{
            email: z.ZodBoolean;
            browser: z.ZodBoolean;
            tradingAlerts: z.ZodBoolean;
            systemAlerts: z.ZodBoolean;
            riskAlerts: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            email: boolean;
            browser: boolean;
            tradingAlerts: boolean;
            systemAlerts: boolean;
            riskAlerts: boolean;
        }, {
            email: boolean;
            browser: boolean;
            tradingAlerts: boolean;
            systemAlerts: boolean;
            riskAlerts: boolean;
        }>;
        dashboard: z.ZodObject<{
            theme: z.ZodEnum<["light", "dark", "system"]>;
            layout: z.ZodEnum<["compact", "standard", "expanded"]>;
            refreshRate: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            theme: "light" | "dark" | "system";
            layout: "compact" | "standard" | "expanded";
            refreshRate: number;
        }, {
            theme: "light" | "dark" | "system";
            layout: "compact" | "standard" | "expanded";
            refreshRate: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
        currency: string;
        notifications: {
            email: boolean;
            browser: boolean;
            tradingAlerts: boolean;
            systemAlerts: boolean;
            riskAlerts: boolean;
        };
        dashboard: {
            theme: "light" | "dark" | "system";
            layout: "compact" | "standard" | "expanded";
            refreshRate: number;
        };
    }, {
        timezone: string;
        currency: string;
        notifications: {
            email: boolean;
            browser: boolean;
            tradingAlerts: boolean;
            systemAlerts: boolean;
            riskAlerts: boolean;
        };
        dashboard: {
            theme: "light" | "dark" | "system";
            layout: "compact" | "standard" | "expanded";
            refreshRate: number;
        };
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    email: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    passwordHash: string;
    role: "admin" | "user";
    apiKeys: {
        id: string;
        userId: string;
        exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
        keyName: string;
        apiKey: string;
        apiSecret: string;
        sandbox: boolean;
        permissions: string[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        passphrase?: string | undefined;
    }[];
    preferences: {
        timezone: string;
        currency: string;
        notifications: {
            email: boolean;
            browser: boolean;
            tradingAlerts: boolean;
            systemAlerts: boolean;
            riskAlerts: boolean;
        };
        dashboard: {
            theme: "light" | "dark" | "system";
            layout: "compact" | "standard" | "expanded";
            refreshRate: number;
        };
    };
}, {
    email: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    passwordHash: string;
    role: "admin" | "user";
    apiKeys: {
        id: string;
        userId: string;
        exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
        keyName: string;
        apiKey: string;
        apiSecret: string;
        sandbox: boolean;
        permissions: string[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        passphrase?: string | undefined;
    }[];
    preferences: {
        timezone: string;
        currency: string;
        notifications: {
            email: boolean;
            browser: boolean;
            tradingAlerts: boolean;
            systemAlerts: boolean;
            riskAlerts: boolean;
        };
        dashboard: {
            theme: "light" | "dark" | "system";
            layout: "compact" | "standard" | "expanded";
            refreshRate: number;
        };
    };
}>;
export declare const BotConfigurationSchema: z.ZodObject<{
    symbol: z.ZodString;
    timeframe: z.ZodEnum<["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]>;
    maxPositionSize: z.ZodNumber;
    leverage: z.ZodNumber;
    stopLoss: z.ZodNumber;
    takeProfit: z.ZodNumber;
    tradeAmount: z.ZodNumber;
    customParameters: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
    maxPositionSize: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    tradeAmount: number;
    customParameters: Record<string, any>;
}, {
    symbol: string;
    timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
    maxPositionSize: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    tradeAmount: number;
    customParameters: Record<string, any>;
}>;
export declare const RiskManagementSchema: z.ZodObject<{
    maxDailyLoss: z.ZodNumber;
    maxDrawdown: z.ZodNumber;
    maxConcurrentTrades: z.ZodNumber;
    emergencyStop: z.ZodBoolean;
    riskScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    maxDailyLoss: number;
    maxDrawdown: number;
    maxConcurrentTrades: number;
    emergencyStop: boolean;
    riskScore: number;
}, {
    maxDailyLoss: number;
    maxDrawdown: number;
    maxConcurrentTrades: number;
    emergencyStop: boolean;
    riskScore: number;
}>;
export declare const BotPerformanceSchema: z.ZodObject<{
    totalTrades: z.ZodNumber;
    winningTrades: z.ZodNumber;
    losingTrades: z.ZodNumber;
    totalPnL: z.ZodNumber;
    winRate: z.ZodNumber;
    sharpeRatio: z.ZodOptional<z.ZodNumber>;
    maxDrawdown: z.ZodNumber;
    averageTradeTime: z.ZodNumber;
    lastCalculatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    maxDrawdown: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    averageTradeTime: number;
    lastCalculatedAt: Date;
    sharpeRatio?: number | undefined;
}, {
    maxDrawdown: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    averageTradeTime: number;
    lastCalculatedAt: Date;
    sharpeRatio?: number | undefined;
}>;
export declare const BotSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    strategy: z.ZodEnum<["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"]>;
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
    exchangeApiKeyId: z.ZodString;
    status: z.ZodEnum<["stopped", "starting", "running", "pausing", "paused", "stopping", "error"]>;
    configuration: z.ZodObject<{
        symbol: z.ZodString;
        timeframe: z.ZodEnum<["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]>;
        maxPositionSize: z.ZodNumber;
        leverage: z.ZodNumber;
        stopLoss: z.ZodNumber;
        takeProfit: z.ZodNumber;
        tradeAmount: z.ZodNumber;
        customParameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    }, {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    }>;
    riskManagement: z.ZodObject<{
        maxDailyLoss: z.ZodNumber;
        maxDrawdown: z.ZodNumber;
        maxConcurrentTrades: z.ZodNumber;
        emergencyStop: z.ZodBoolean;
        riskScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    }, {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    }>;
    performance: z.ZodObject<{
        totalTrades: z.ZodNumber;
        winningTrades: z.ZodNumber;
        losingTrades: z.ZodNumber;
        totalPnL: z.ZodNumber;
        winRate: z.ZodNumber;
        sharpeRatio: z.ZodOptional<z.ZodNumber>;
        maxDrawdown: z.ZodNumber;
        averageTradeTime: z.ZodNumber;
        lastCalculatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        maxDrawdown: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalPnL: number;
        winRate: number;
        averageTradeTime: number;
        lastCalculatedAt: Date;
        sharpeRatio?: number | undefined;
    }, {
        maxDrawdown: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalPnL: number;
        winRate: number;
        averageTradeTime: number;
        lastCalculatedAt: Date;
        sharpeRatio?: number | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastActiveAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    status: "stopped" | "starting" | "running" | "pausing" | "paused" | "stopping" | "error";
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    createdAt: Date;
    updatedAt: Date;
    name: string;
    strategy: "aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom";
    exchangeApiKeyId: string;
    configuration: {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    };
    riskManagement: {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    };
    performance: {
        maxDrawdown: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalPnL: number;
        winRate: number;
        averageTradeTime: number;
        lastCalculatedAt: Date;
        sharpeRatio?: number | undefined;
    };
    description?: string | undefined;
    lastActiveAt?: Date | undefined;
}, {
    status: "stopped" | "starting" | "running" | "pausing" | "paused" | "stopping" | "error";
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    createdAt: Date;
    updatedAt: Date;
    name: string;
    strategy: "aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom";
    exchangeApiKeyId: string;
    configuration: {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    };
    riskManagement: {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    };
    performance: {
        maxDrawdown: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalPnL: number;
        winRate: number;
        averageTradeTime: number;
        lastCalculatedAt: Date;
        sharpeRatio?: number | undefined;
    };
    description?: string | undefined;
    lastActiveAt?: Date | undefined;
}>;
export declare const TradeSchema: z.ZodObject<{
    id: z.ZodString;
    botId: z.ZodString;
    userId: z.ZodString;
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
    symbol: z.ZodString;
    side: z.ZodEnum<["buy", "sell"]>;
    type: z.ZodEnum<["market", "limit", "stop", "stop-limit"]>;
    amount: z.ZodNumber;
    price: z.ZodNumber;
    leverage: z.ZodNumber;
    status: z.ZodEnum<["pending", "open", "filled", "partial", "cancelled", "rejected", "closed"]>;
    entryPrice: z.ZodOptional<z.ZodNumber>;
    exitPrice: z.ZodOptional<z.ZodNumber>;
    stopLoss: z.ZodOptional<z.ZodNumber>;
    takeProfit: z.ZodOptional<z.ZodNumber>;
    pnl: z.ZodOptional<z.ZodNumber>;
    fees: z.ZodNumber;
    exchangeOrderId: z.ZodOptional<z.ZodString>;
    executedAt: z.ZodOptional<z.ZodDate>;
    closedAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    type: "market" | "limit" | "stop" | "stop-limit";
    status: "pending" | "open" | "filled" | "partial" | "cancelled" | "rejected" | "closed";
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    createdAt: Date;
    updatedAt: Date;
    leverage: number;
    botId: string;
    side: "buy" | "sell";
    amount: number;
    price: number;
    fees: number;
    stopLoss?: number | undefined;
    takeProfit?: number | undefined;
    entryPrice?: number | undefined;
    exitPrice?: number | undefined;
    pnl?: number | undefined;
    exchangeOrderId?: string | undefined;
    executedAt?: Date | undefined;
    closedAt?: Date | undefined;
}, {
    symbol: string;
    type: "market" | "limit" | "stop" | "stop-limit";
    status: "pending" | "open" | "filled" | "partial" | "cancelled" | "rejected" | "closed";
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    createdAt: Date;
    updatedAt: Date;
    leverage: number;
    botId: string;
    side: "buy" | "sell";
    amount: number;
    price: number;
    fees: number;
    stopLoss?: number | undefined;
    takeProfit?: number | undefined;
    entryPrice?: number | undefined;
    exitPrice?: number | undefined;
    pnl?: number | undefined;
    exchangeOrderId?: string | undefined;
    executedAt?: Date | undefined;
    closedAt?: Date | undefined;
}>;
export declare const PositionSchema: z.ZodObject<{
    id: z.ZodString;
    botId: z.ZodString;
    userId: z.ZodString;
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
    symbol: z.ZodString;
    side: z.ZodEnum<["buy", "sell"]>;
    size: z.ZodNumber;
    entryPrice: z.ZodNumber;
    currentPrice: z.ZodNumber;
    unrealizedPnl: z.ZodNumber;
    realizedPnl: z.ZodNumber;
    leverage: z.ZodNumber;
    margin: z.ZodNumber;
    liquidationPrice: z.ZodOptional<z.ZodNumber>;
    stopLoss: z.ZodOptional<z.ZodNumber>;
    takeProfit: z.ZodOptional<z.ZodNumber>;
    isOpen: z.ZodBoolean;
    openedAt: z.ZodDate;
    closedAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    updatedAt: Date;
    leverage: number;
    botId: string;
    side: "buy" | "sell";
    entryPrice: number;
    size: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    margin: number;
    isOpen: boolean;
    openedAt: Date;
    stopLoss?: number | undefined;
    takeProfit?: number | undefined;
    closedAt?: Date | undefined;
    liquidationPrice?: number | undefined;
}, {
    symbol: string;
    id: string;
    userId: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    updatedAt: Date;
    leverage: number;
    botId: string;
    side: "buy" | "sell";
    entryPrice: number;
    size: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    margin: number;
    isOpen: boolean;
    openedAt: Date;
    stopLoss?: number | undefined;
    takeProfit?: number | undefined;
    closedAt?: Date | undefined;
    liquidationPrice?: number | undefined;
}>;
export declare const SignalSchema: z.ZodObject<{
    id: z.ZodString;
    botId: z.ZodString;
    strategy: z.ZodEnum<["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"]>;
    symbol: z.ZodString;
    side: z.ZodEnum<["buy", "sell"]>;
    strength: z.ZodNumber;
    confidence: z.ZodNumber;
    price: z.ZodNumber;
    timestamp: z.ZodDate;
    indicators: z.ZodRecord<z.ZodString, z.ZodNumber>;
    metadata: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    id: string;
    strategy: "aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom";
    botId: string;
    side: "buy" | "sell";
    price: number;
    strength: number;
    confidence: number;
    timestamp: Date;
    indicators: Record<string, number>;
    metadata: Record<string, any>;
}, {
    symbol: string;
    id: string;
    strategy: "aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom";
    botId: string;
    side: "buy" | "sell";
    price: number;
    strength: number;
    confidence: number;
    timestamp: Date;
    indicators: Record<string, number>;
    metadata: Record<string, any>;
}>;
export declare const WebSocketMessageTypeSchema: z.ZodEnum<["subscribe", "unsubscribe", "data", "error", "heartbeat", "auth", "bot-action", "trade-update", "position-update", "signal", "time-sync"]>;
export declare const WebSocketMessageSchema: z.ZodObject<{
    type: z.ZodEnum<["subscribe", "unsubscribe", "data", "error", "heartbeat", "auth", "bot-action", "trade-update", "position-update", "signal", "time-sync"]>;
    channel: z.ZodString;
    data: z.ZodAny;
    timestamp: z.ZodDate;
    requestId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "error" | "subscribe" | "unsubscribe" | "data" | "heartbeat" | "auth" | "bot-action" | "trade-update" | "position-update" | "signal" | "time-sync";
    timestamp: Date;
    channel: string;
    data?: any;
    requestId?: string | undefined;
}, {
    type: "error" | "subscribe" | "unsubscribe" | "data" | "heartbeat" | "auth" | "bot-action" | "trade-update" | "position-update" | "signal" | "time-sync";
    timestamp: Date;
    channel: string;
    data?: any;
    requestId?: string | undefined;
}>;
export declare const WebSocketSubscriptionSchema: z.ZodObject<{
    channel: z.ZodString;
    symbol: z.ZodOptional<z.ZodString>;
    botId: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
    channel: string;
    symbol?: string | undefined;
    botId?: string | undefined;
}, {
    userId: string;
    channel: string;
    symbol?: string | undefined;
    botId?: string | undefined;
}>;
export declare const BotActionMessageSchema: z.ZodObject<{
    action: z.ZodEnum<["start", "stop", "pause", "resume", "update-config"]>;
    botId: z.ZodString;
    config: z.ZodOptional<z.ZodObject<{
        symbol: z.ZodOptional<z.ZodString>;
        timeframe: z.ZodOptional<z.ZodEnum<["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]>>;
        maxPositionSize: z.ZodOptional<z.ZodNumber>;
        leverage: z.ZodOptional<z.ZodNumber>;
        stopLoss: z.ZodOptional<z.ZodNumber>;
        takeProfit: z.ZodOptional<z.ZodNumber>;
        tradeAmount: z.ZodOptional<z.ZodNumber>;
        customParameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    }, {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    botId: string;
    action: "stop" | "start" | "pause" | "resume" | "update-config";
    config?: {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    } | undefined;
}, {
    botId: string;
    action: "stop" | "start" | "pause" | "resume" | "update-config";
    config?: {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    } | undefined;
}>;
export declare const MarketDataMessageSchema: z.ZodObject<{
    symbol: z.ZodString;
    price: z.ZodNumber;
    volume: z.ZodNumber;
    timestamp: z.ZodDate;
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    price: number;
    timestamp: Date;
    volume: number;
}, {
    symbol: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    price: number;
    timestamp: Date;
    volume: number;
}>;
export declare const TimeSyncMessageSchema: z.ZodObject<{
    serverTime: z.ZodDate;
    exchangeTime: z.ZodOptional<z.ZodDate>;
    drift: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    serverTime: Date;
    exchangeTime?: Date | undefined;
    drift?: number | undefined;
}, {
    serverTime: Date;
    exchangeTime?: Date | undefined;
    drift?: number | undefined;
}>;
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    success: boolean;
    error?: string | undefined;
    data?: any;
}, {
    timestamp: Date;
    success: boolean;
    error?: string | undefined;
    data?: any;
}>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodNumber;
    limit: z.ZodNumber;
    total: z.ZodNumber;
    hasNext: z.ZodBoolean;
    hasPrev: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
}, {
    limit: number;
    page: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
}>;
export declare const PaginatedResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    error: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
    pagination: z.ZodObject<{
        page: z.ZodNumber;
        limit: z.ZodNumber;
        total: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    }, {
        limit: number;
        page: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    success: boolean;
    pagination: {
        limit: number;
        page: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    error?: string | undefined;
    data?: any[] | undefined;
}, {
    timestamp: Date;
    success: boolean;
    pagination: {
        limit: number;
        page: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    error?: string | undefined;
    data?: any[] | undefined;
}>;
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RegisterRequestSchema: z.ZodEffects<z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    confirmPassword: string;
}, {
    email: string;
    password: string;
    confirmPassword: string;
}>, {
    email: string;
    password: string;
    confirmPassword: string;
}, {
    email: string;
    password: string;
    confirmPassword: string;
}>;
export declare const LoginResponseSchema: z.ZodObject<{
    token: z.ZodString;
    user: z.ZodObject<Omit<{
        id: z.ZodString;
        email: z.ZodString;
        passwordHash: z.ZodString;
        role: z.ZodEnum<["admin", "user"]>;
        apiKeys: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            userId: z.ZodString;
            exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
            keyName: z.ZodString;
            apiKey: z.ZodString;
            apiSecret: z.ZodString;
            passphrase: z.ZodOptional<z.ZodString>;
            sandbox: z.ZodBoolean;
            permissions: z.ZodArray<z.ZodString, "many">;
            isActive: z.ZodBoolean;
            createdAt: z.ZodDate;
            updatedAt: z.ZodDate;
        }, "strip", z.ZodTypeAny, {
            id: string;
            userId: string;
            exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
            keyName: string;
            apiKey: string;
            apiSecret: string;
            sandbox: boolean;
            permissions: string[];
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            passphrase?: string | undefined;
        }, {
            id: string;
            userId: string;
            exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
            keyName: string;
            apiKey: string;
            apiSecret: string;
            sandbox: boolean;
            permissions: string[];
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            passphrase?: string | undefined;
        }>, "many">;
        preferences: z.ZodObject<{
            timezone: z.ZodString;
            currency: z.ZodString;
            notifications: z.ZodObject<{
                email: z.ZodBoolean;
                browser: z.ZodBoolean;
                tradingAlerts: z.ZodBoolean;
                systemAlerts: z.ZodBoolean;
                riskAlerts: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            }, {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            }>;
            dashboard: z.ZodObject<{
                theme: z.ZodEnum<["light", "dark", "system"]>;
                layout: z.ZodEnum<["compact", "standard", "expanded"]>;
                refreshRate: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            }, {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            timezone: string;
            currency: string;
            notifications: {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            };
            dashboard: {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            };
        }, {
            timezone: string;
            currency: string;
            notifications: {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            };
            dashboard: {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            };
        }>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "passwordHash" | "apiKeys">, "strip", z.ZodTypeAny, {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        role: "admin" | "user";
        preferences: {
            timezone: string;
            currency: string;
            notifications: {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            };
            dashboard: {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            };
        };
    }, {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        role: "admin" | "user";
        preferences: {
            timezone: string;
            currency: string;
            notifications: {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            };
            dashboard: {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            };
        };
    }>;
    expiresAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user: {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        role: "admin" | "user";
        preferences: {
            timezone: string;
            currency: string;
            notifications: {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            };
            dashboard: {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            };
        };
    };
    token: string;
    expiresAt: Date;
}, {
    user: {
        email: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        role: "admin" | "user";
        preferences: {
            timezone: string;
            currency: string;
            notifications: {
                email: boolean;
                browser: boolean;
                tradingAlerts: boolean;
                systemAlerts: boolean;
                riskAlerts: boolean;
            };
            dashboard: {
                theme: "light" | "dark" | "system";
                layout: "compact" | "standard" | "expanded";
                refreshRate: number;
            };
        };
    };
    token: string;
    expiresAt: Date;
}>;
export declare const CreateBotRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    strategy: z.ZodEnum<["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"]>;
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
    exchangeApiKeyId: z.ZodString;
    configuration: z.ZodObject<{
        symbol: z.ZodString;
        timeframe: z.ZodEnum<["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]>;
        maxPositionSize: z.ZodNumber;
        leverage: z.ZodNumber;
        stopLoss: z.ZodNumber;
        takeProfit: z.ZodNumber;
        tradeAmount: z.ZodNumber;
        customParameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    }, {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    }>;
    riskManagement: z.ZodObject<{
        maxDailyLoss: z.ZodNumber;
        maxDrawdown: z.ZodNumber;
        maxConcurrentTrades: z.ZodNumber;
        emergencyStop: z.ZodBoolean;
        riskScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    }, {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    }>;
}, "strip", z.ZodTypeAny, {
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    name: string;
    strategy: "aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom";
    exchangeApiKeyId: string;
    configuration: {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    };
    riskManagement: {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    };
    description?: string | undefined;
}, {
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    name: string;
    strategy: "aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom";
    exchangeApiKeyId: string;
    configuration: {
        symbol: string;
        timeframe: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M";
        maxPositionSize: number;
        leverage: number;
        stopLoss: number;
        takeProfit: number;
        tradeAmount: number;
        customParameters: Record<string, any>;
    };
    riskManagement: {
        maxDailyLoss: number;
        maxDrawdown: number;
        maxConcurrentTrades: number;
        emergencyStop: boolean;
        riskScore: number;
    };
    description?: string | undefined;
}>;
export declare const UpdateBotRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    configuration: z.ZodOptional<z.ZodObject<{
        symbol: z.ZodOptional<z.ZodString>;
        timeframe: z.ZodOptional<z.ZodEnum<["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]>>;
        maxPositionSize: z.ZodOptional<z.ZodNumber>;
        leverage: z.ZodOptional<z.ZodNumber>;
        stopLoss: z.ZodOptional<z.ZodNumber>;
        takeProfit: z.ZodOptional<z.ZodNumber>;
        tradeAmount: z.ZodOptional<z.ZodNumber>;
        customParameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    }, {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    }>>;
    riskManagement: z.ZodOptional<z.ZodObject<{
        maxDailyLoss: z.ZodOptional<z.ZodNumber>;
        maxDrawdown: z.ZodOptional<z.ZodNumber>;
        maxConcurrentTrades: z.ZodOptional<z.ZodNumber>;
        emergencyStop: z.ZodOptional<z.ZodBoolean>;
        riskScore: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxDailyLoss?: number | undefined;
        maxDrawdown?: number | undefined;
        maxConcurrentTrades?: number | undefined;
        emergencyStop?: boolean | undefined;
        riskScore?: number | undefined;
    }, {
        maxDailyLoss?: number | undefined;
        maxDrawdown?: number | undefined;
        maxConcurrentTrades?: number | undefined;
        emergencyStop?: boolean | undefined;
        riskScore?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    configuration?: {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    } | undefined;
    riskManagement?: {
        maxDailyLoss?: number | undefined;
        maxDrawdown?: number | undefined;
        maxConcurrentTrades?: number | undefined;
        emergencyStop?: boolean | undefined;
        riskScore?: number | undefined;
    } | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    configuration?: {
        symbol?: string | undefined;
        timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1M" | undefined;
        maxPositionSize?: number | undefined;
        leverage?: number | undefined;
        stopLoss?: number | undefined;
        takeProfit?: number | undefined;
        tradeAmount?: number | undefined;
        customParameters?: Record<string, any> | undefined;
    } | undefined;
    riskManagement?: {
        maxDailyLoss?: number | undefined;
        maxDrawdown?: number | undefined;
        maxConcurrentTrades?: number | undefined;
        emergencyStop?: boolean | undefined;
        riskScore?: number | undefined;
    } | undefined;
}>;
export declare const ServiceHealthSchema: z.ZodObject<{
    name: z.ZodString;
    status: z.ZodEnum<["up", "down", "degraded"]>;
    responseTime: z.ZodOptional<z.ZodNumber>;
    lastCheck: z.ZodDate;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    status: "up" | "down" | "degraded";
    name: string;
    lastCheck: Date;
    responseTime?: number | undefined;
    details?: Record<string, any> | undefined;
}, {
    status: "up" | "down" | "degraded";
    name: string;
    lastCheck: Date;
    responseTime?: number | undefined;
    details?: Record<string, any> | undefined;
}>;
export declare const SystemHealthSchema: z.ZodObject<{
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    services: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        status: z.ZodEnum<["up", "down", "degraded"]>;
        responseTime: z.ZodOptional<z.ZodNumber>;
        lastCheck: z.ZodDate;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        status: "up" | "down" | "degraded";
        name: string;
        lastCheck: Date;
        responseTime?: number | undefined;
        details?: Record<string, any> | undefined;
    }, {
        status: "up" | "down" | "degraded";
        name: string;
        lastCheck: Date;
        responseTime?: number | undefined;
        details?: Record<string, any> | undefined;
    }>, "many">;
    timestamp: z.ZodDate;
    uptime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "degraded" | "healthy" | "unhealthy";
    timestamp: Date;
    services: {
        status: "up" | "down" | "degraded";
        name: string;
        lastCheck: Date;
        responseTime?: number | undefined;
        details?: Record<string, any> | undefined;
    }[];
    uptime: number;
}, {
    status: "degraded" | "healthy" | "unhealthy";
    timestamp: Date;
    services: {
        status: "up" | "down" | "degraded";
        name: string;
        lastCheck: Date;
        responseTime?: number | undefined;
        details?: Record<string, any> | undefined;
    }[];
    uptime: number;
}>;
export declare const LogEntrySchema: z.ZodObject<{
    id: z.ZodString;
    level: z.ZodEnum<["debug", "info", "warn", "error"]>;
    message: z.ZodString;
    category: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    botId: z.ZodOptional<z.ZodString>;
    tradeId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    message: string;
    id: string;
    timestamp: Date;
    level: "error" | "debug" | "info" | "warn";
    category: string;
    userId?: string | undefined;
    botId?: string | undefined;
    metadata?: Record<string, any> | undefined;
    tradeId?: string | undefined;
}, {
    message: string;
    id: string;
    timestamp: Date;
    level: "error" | "debug" | "info" | "warn";
    category: string;
    userId?: string | undefined;
    botId?: string | undefined;
    metadata?: Record<string, any> | undefined;
    tradeId?: string | undefined;
}>;
export declare const TimeRangeSchema: z.ZodEffects<z.ZodObject<{
    start: z.ZodDate;
    end: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    start: Date;
    end: Date;
}, {
    start: Date;
    end: Date;
}>, {
    start: Date;
    end: Date;
}, {
    start: Date;
    end: Date;
}>;
export declare const PaginationRequestSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    limit?: number | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const FilterOptionsSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exchange: z.ZodOptional<z.ZodArray<z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>, "many">>;
    strategy: z.ZodOptional<z.ZodArray<z.ZodEnum<["aether", "target-reacher", "sma-crossover", "rsi-divergence", "custom"]>, "many">>;
    dateRange: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        start: z.ZodDate;
        end: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        start: Date;
        end: Date;
    }, {
        start: Date;
        end: Date;
    }>, {
        start: Date;
        end: Date;
    }, {
        start: Date;
        end: Date;
    }>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: string[] | undefined;
    exchange?: ("bybit" | "binance" | "okx" | "coinbase" | "kraken")[] | undefined;
    strategy?: ("aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom")[] | undefined;
    dateRange?: {
        start: Date;
        end: Date;
    } | undefined;
    search?: string | undefined;
}, {
    status?: string[] | undefined;
    exchange?: ("bybit" | "binance" | "okx" | "coinbase" | "kraken")[] | undefined;
    strategy?: ("aether" | "target-reacher" | "sma-crossover" | "rsi-divergence" | "custom")[] | undefined;
    dateRange?: {
        start: Date;
        end: Date;
    } | undefined;
    search?: string | undefined;
}>;
export declare const AppErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    timestamp: Date;
    details?: Record<string, any> | undefined;
}, {
    code: string;
    message: string;
    timestamp: Date;
    details?: Record<string, any> | undefined;
}>;
export declare const ValidationErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodDate;
} & {
    field: z.ZodString;
    value: z.ZodAny;
    constraint: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    timestamp: Date;
    field: string;
    constraint: string;
    value?: any;
    details?: Record<string, any> | undefined;
}, {
    code: string;
    message: string;
    timestamp: Date;
    field: string;
    constraint: string;
    value?: any;
    details?: Record<string, any> | undefined;
}>;
export declare const ExchangeErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodDate;
} & {
    exchange: z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>;
    exchangeCode: z.ZodOptional<z.ZodString>;
    exchangeMessage: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    timestamp: Date;
    details?: Record<string, any> | undefined;
    exchangeCode?: string | undefined;
    exchangeMessage?: string | undefined;
}, {
    code: string;
    message: string;
    exchange: "bybit" | "binance" | "okx" | "coinbase" | "kraken";
    timestamp: Date;
    details?: Record<string, any> | undefined;
    exchangeCode?: string | undefined;
    exchangeMessage?: string | undefined;
}>;
export declare const ExchangeConfigSchema: z.ZodObject<{
    name: z.ZodString;
    apiUrl: z.ZodString;
    wsUrl: z.ZodString;
    sandbox: z.ZodObject<{
        apiUrl: z.ZodString;
        wsUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        apiUrl: string;
        wsUrl: string;
    }, {
        apiUrl: string;
        wsUrl: string;
    }>;
    rateLimit: z.ZodObject<{
        requests: z.ZodNumber;
        window: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        requests: number;
        window: number;
    }, {
        requests: number;
        window: number;
    }>;
    features: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    sandbox: {
        apiUrl: string;
        wsUrl: string;
    };
    name: string;
    apiUrl: string;
    wsUrl: string;
    rateLimit: {
        requests: number;
        window: number;
    };
    features: string[];
}, {
    sandbox: {
        apiUrl: string;
        wsUrl: string;
    };
    name: string;
    apiUrl: string;
    wsUrl: string;
    rateLimit: {
        requests: number;
        window: number;
    };
    features: string[];
}>;
export declare const AppConfigSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    environment: z.ZodEnum<["development", "production", "test"]>;
    api: z.ZodObject<{
        port: z.ZodNumber;
        cors: z.ZodArray<z.ZodString, "many">;
        rateLimit: z.ZodObject<{
            windowMs: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            windowMs: number;
            max: number;
        }, {
            windowMs: number;
            max: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        rateLimit: {
            windowMs: number;
            max: number;
        };
        port: number;
        cors: string[];
    }, {
        rateLimit: {
            windowMs: number;
            max: number;
        };
        port: number;
        cors: string[];
    }>;
    websocket: z.ZodObject<{
        port: z.ZodNumber;
        heartbeatInterval: z.ZodNumber;
        connectionTimeout: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        port: number;
        heartbeatInterval: number;
        connectionTimeout: number;
    }, {
        port: number;
        heartbeatInterval: number;
        connectionTimeout: number;
    }>;
    database: z.ZodObject<{
        host: z.ZodString;
        port: z.ZodNumber;
        name: z.ZodString;
        ssl: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        port: number;
        host: string;
        ssl: boolean;
    }, {
        name: string;
        port: number;
        host: string;
        ssl: boolean;
    }>;
    redis: z.ZodObject<{
        host: z.ZodString;
        port: z.ZodNumber;
        db: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        port: number;
        host: string;
        db: number;
    }, {
        port: number;
        host: string;
        db: number;
    }>;
    security: z.ZodObject<{
        jwtSecret: z.ZodString;
        jwtExpiresIn: z.ZodString;
        bcryptRounds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
    }, {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
    }>;
    exchanges: z.ZodRecord<z.ZodEnum<["bybit", "binance", "okx", "coinbase", "kraken"]>, z.ZodObject<{
        name: z.ZodString;
        apiUrl: z.ZodString;
        wsUrl: z.ZodString;
        sandbox: z.ZodObject<{
            apiUrl: z.ZodString;
            wsUrl: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            apiUrl: string;
            wsUrl: string;
        }, {
            apiUrl: string;
            wsUrl: string;
        }>;
        rateLimit: z.ZodObject<{
            requests: z.ZodNumber;
            window: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            requests: number;
            window: number;
        }, {
            requests: number;
            window: number;
        }>;
        features: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        sandbox: {
            apiUrl: string;
            wsUrl: string;
        };
        name: string;
        apiUrl: string;
        wsUrl: string;
        rateLimit: {
            requests: number;
            window: number;
        };
        features: string[];
    }, {
        sandbox: {
            apiUrl: string;
            wsUrl: string;
        };
        name: string;
        apiUrl: string;
        wsUrl: string;
        rateLimit: {
            requests: number;
            window: number;
        };
        features: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    environment: "development" | "production" | "test";
    api: {
        rateLimit: {
            windowMs: number;
            max: number;
        };
        port: number;
        cors: string[];
    };
    websocket: {
        port: number;
        heartbeatInterval: number;
        connectionTimeout: number;
    };
    database: {
        name: string;
        port: number;
        host: string;
        ssl: boolean;
    };
    redis: {
        port: number;
        host: string;
        db: number;
    };
    security: {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
    };
    exchanges: Partial<Record<"bybit" | "binance" | "okx" | "coinbase" | "kraken", {
        sandbox: {
            apiUrl: string;
            wsUrl: string;
        };
        name: string;
        apiUrl: string;
        wsUrl: string;
        rateLimit: {
            requests: number;
            window: number;
        };
        features: string[];
    }>>;
}, {
    name: string;
    version: string;
    environment: "development" | "production" | "test";
    api: {
        rateLimit: {
            windowMs: number;
            max: number;
        };
        port: number;
        cors: string[];
    };
    websocket: {
        port: number;
        heartbeatInterval: number;
        connectionTimeout: number;
    };
    database: {
        name: string;
        port: number;
        host: string;
        ssl: boolean;
    };
    redis: {
        port: number;
        host: string;
        db: number;
    };
    security: {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
    };
    exchanges: Partial<Record<"bybit" | "binance" | "okx" | "coinbase" | "kraken", {
        sandbox: {
            apiUrl: string;
            wsUrl: string;
        };
        name: string;
        apiUrl: string;
        wsUrl: string;
        rateLimit: {
            requests: number;
            window: number;
        };
        features: string[];
    }>>;
}>;
export declare const validateData: <T>(schema: z.ZodSchema<T>, data: unknown) => {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
export declare const validateDataSafe: <T>(schema: z.ZodSchema<T>, data: unknown) => z.SafeParseReturnType<unknown, T>;
//# sourceMappingURL=validation.d.ts.map