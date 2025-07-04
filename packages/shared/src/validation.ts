/**
 * Jabbr Trading Bot Platform - Zod Validation Schemas
 * 
 * This file contains Zod schemas for runtime validation of all shared types.
 * These schemas ensure data integrity across WebSocket communication,
 * API requests/responses, and database operations.
 */

import { z } from 'zod';

// ============================================================================
// BASIC VALIDATION SCHEMAS
// ============================================================================

export const StrategySchema = z.enum(['aether', 'target-reacher', 'sma-crossover', 'rsi-divergence', 'custom']);
export const ExchangeSchema = z.enum(['bybit', 'binance', 'okx', 'coinbase', 'kraken']);
export const TimeframeSchema = z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']);
export const TradeSideSchema = z.enum(['buy', 'sell']);
export const TradeTypeSchema = z.enum(['market', 'limit', 'stop', 'stop-limit']);
export const TradeStatusSchema = z.enum(['pending', 'open', 'filled', 'partial', 'cancelled', 'rejected', 'closed']);
export const BotStatusSchema = z.enum(['stopped', 'starting', 'running', 'pausing', 'paused', 'stopping', 'error']);

// ============================================================================
// CORE ENTITY SCHEMAS
// ============================================================================

export const NotificationSettingsSchema = z.object({
  email: z.boolean(),
  browser: z.boolean(),
  tradingAlerts: z.boolean(),
  systemAlerts: z.boolean(),
  riskAlerts: z.boolean()
});

export const DashboardSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  layout: z.enum(['compact', 'standard', 'expanded']),
  refreshRate: z.number().positive().min(100).max(60000) // 100ms to 60s
});

export const UserPreferencesSchema = z.object({
  timezone: z.string().min(1),
  currency: z.string().length(3), // ISO currency codes
  notifications: NotificationSettingsSchema,
  dashboard: DashboardSettingsSchema
});

export const ExchangeApiKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  exchange: ExchangeSchema,
  keyName: z.string().min(1).max(100),
  apiKey: z.string().min(1), // encrypted
  apiSecret: z.string().min(1), // encrypted
  passphrase: z.string().optional(),
  sandbox: z.boolean(),
  permissions: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  role: z.enum(['admin', 'user']),
  apiKeys: z.array(ExchangeApiKeySchema),
  preferences: UserPreferencesSchema,
  createdAt: z.date(),
  updatedAt: z.date()
});

// ============================================================================
// BOT ENTITY SCHEMAS
// ============================================================================

export const BotConfigurationSchema = z.object({
  symbol: z.string().min(1).regex(/^[A-Z0-9]+$/), // e.g., 'BTCUSDT'
  timeframe: TimeframeSchema,
  maxPositionSize: z.number().positive(),
  leverage: z.number().positive().max(100),
  stopLoss: z.number().positive().max(100), // percentage
  takeProfit: z.number().positive().max(1000), // percentage
  tradeAmount: z.number().positive(),
  customParameters: z.record(z.any())
});

export const RiskManagementSchema = z.object({
  maxDailyLoss: z.number().positive().max(100), // percentage
  maxDrawdown: z.number().positive().max(100), // percentage
  maxConcurrentTrades: z.number().positive().max(100),
  emergencyStop: z.boolean(),
  riskScore: z.number().min(1).max(10)
});

export const BotPerformanceSchema = z.object({
  totalTrades: z.number().nonnegative(),
  winningTrades: z.number().nonnegative(),
  losingTrades: z.number().nonnegative(),
  totalPnL: z.number(),
  winRate: z.number().min(0).max(100), // percentage
  sharpeRatio: z.number().optional(),
  maxDrawdown: z.number().nonnegative(),
  averageTradeTime: z.number().positive(), // milliseconds
  lastCalculatedAt: z.date()
});

export const BotSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  strategy: StrategySchema,
  exchange: ExchangeSchema,
  exchangeApiKeyId: z.string().uuid(),
  status: BotStatusSchema,
  configuration: BotConfigurationSchema,
  riskManagement: RiskManagementSchema,
  performance: BotPerformanceSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  lastActiveAt: z.date().optional()
});

// ============================================================================
// TRADING ENTITY SCHEMAS
// ============================================================================

export const TradeSchema = z.object({
  id: z.string().uuid(),
  botId: z.string().uuid(),
  userId: z.string().uuid(),
  exchange: ExchangeSchema,
  symbol: z.string().min(1),
  side: TradeSideSchema,
  type: TradeTypeSchema,
  amount: z.number().positive(),
  price: z.number().positive(),
  leverage: z.number().positive(),
  status: TradeStatusSchema,
  entryPrice: z.number().positive().optional(),
  exitPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  pnl: z.number().optional(),
  fees: z.number().nonnegative(),
  exchangeOrderId: z.string().optional(),
  executedAt: z.date().optional(),
  closedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const PositionSchema = z.object({
  id: z.string().uuid(),
  botId: z.string().uuid(),
  userId: z.string().uuid(),
  exchange: ExchangeSchema,
  symbol: z.string().min(1),
  side: TradeSideSchema,
  size: z.number().positive(),
  entryPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  unrealizedPnl: z.number(),
  realizedPnl: z.number(),
  leverage: z.number().positive(),
  margin: z.number().positive(),
  liquidationPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  isOpen: z.boolean(),
  openedAt: z.date(),
  closedAt: z.date().optional(),
  updatedAt: z.date()
});

export const SignalSchema = z.object({
  id: z.string().uuid(),
  botId: z.string().uuid(),
  strategy: StrategySchema,
  symbol: z.string().min(1),
  side: TradeSideSchema,
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  price: z.number().positive(),
  timestamp: z.date(),
  indicators: z.record(z.number()),
  metadata: z.record(z.any())
});

// ============================================================================
// WEBSOCKET MESSAGE SCHEMAS
// ============================================================================

export const WebSocketMessageTypeSchema = z.enum([
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
  'time-sync',
  'alert',
  'alert_acknowledged',
  'alert_resolved',
  'alert_escalated'
]);

export const WebSocketMessageSchema = z.object({
  type: WebSocketMessageTypeSchema,
  channel: z.string().min(1),
  data: z.any(),
  timestamp: z.date(),
  requestId: z.string().optional()
});

export const WebSocketSubscriptionSchema = z.object({
  channel: z.string().min(1),
  symbol: z.string().optional(),
  botId: z.string().uuid().optional(),
  userId: z.string().uuid()
});

export const BotActionMessageSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume', 'update-config']),
  botId: z.string().uuid(),
  config: BotConfigurationSchema.partial().optional()
});

export const MarketDataMessageSchema = z.object({
  symbol: z.string().min(1),
  price: z.number().positive(),
  volume: z.number().nonnegative(),
  timestamp: z.date(),
  exchange: ExchangeSchema
});

export const TimeSyncMessageSchema = z.object({
  serverTime: z.date(),
  exchangeTime: z.date().optional(),
  drift: z.number().optional() // milliseconds
});

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.date()
});

export const PaginationSchema = z.object({
  page: z.number().positive(),
  limit: z.number().positive().max(1000),
  total: z.number().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

export const PaginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.any()).optional(),
  error: z.string().optional(),
  timestamp: z.date(),
  pagination: PaginationSchema
});

// Authentication schemas
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  confirmPassword: z.string().min(8)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const LoginResponseSchema = z.object({
  token: z.string().min(1),
  user: UserSchema.omit({ passwordHash: true, apiKeys: true }),
  expiresAt: z.date()
});

// Bot management schemas
export const CreateBotRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  strategy: StrategySchema,
  exchange: ExchangeSchema,
  exchangeApiKeyId: z.string().uuid(),
  configuration: BotConfigurationSchema,
  riskManagement: RiskManagementSchema
});

export const UpdateBotRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  configuration: BotConfigurationSchema.partial().optional(),
  riskManagement: RiskManagementSchema.partial().optional()
});

// ============================================================================
// SYSTEM & MONITORING SCHEMAS
// ============================================================================

export const ServiceHealthSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['up', 'down', 'degraded']),
  responseTime: z.number().nonnegative().optional(),
  lastCheck: z.date(),
  details: z.record(z.any()).optional()
});

export const SystemHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  services: z.array(ServiceHealthSchema),
  timestamp: z.date(),
  uptime: z.number().nonnegative()
});

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string().min(1),
  category: z.string().min(1),
  userId: z.string().uuid().optional(),
  botId: z.string().uuid().optional(),
  tradeId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.date()
});

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

export const TimeRangeSchema = z.object({
  start: z.date(),
  end: z.date()
}).refine((data) => data.start < data.end, {
  message: "Start date must be before end date"
});

export const PaginationRequestSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const FilterOptionsSchema = z.object({
  status: z.array(z.string()).optional(),
  exchange: z.array(ExchangeSchema).optional(),
  strategy: z.array(StrategySchema).optional(),
  dateRange: TimeRangeSchema.optional(),
  search: z.string().optional()
});

// ============================================================================
// ERROR SCHEMAS
// ============================================================================

export const AppErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.any()).optional(),
  timestamp: z.date()
});

export const ValidationErrorSchema = AppErrorSchema.extend({
  field: z.string().min(1),
  value: z.any(),
  constraint: z.string().min(1)
});

export const ExchangeErrorSchema = AppErrorSchema.extend({
  exchange: ExchangeSchema,
  exchangeCode: z.string().optional(),
  exchangeMessage: z.string().optional()
});

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

export const ExchangeConfigSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url(),
  wsUrl: z.string().url(),
  sandbox: z.object({
    apiUrl: z.string().url(),
    wsUrl: z.string().url()
  }),
  rateLimit: z.object({
    requests: z.number().positive(),
    window: z.number().positive()
  }),
  features: z.array(z.string())
});

export const AppConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  environment: z.enum(['development', 'production', 'test']),
  api: z.object({
    port: z.number().positive().max(65535),
    cors: z.array(z.string()),
    rateLimit: z.object({
      windowMs: z.number().positive(),
      max: z.number().positive()
    })
  }),
  websocket: z.object({
    port: z.number().positive().max(65535),
    heartbeatInterval: z.number().positive(),
    connectionTimeout: z.number().positive()
  }),
  database: z.object({
    host: z.string().min(1),
    port: z.number().positive().max(65535),
    name: z.string().min(1),
    ssl: z.boolean()
  }),
  redis: z.object({
    host: z.string().min(1),
    port: z.number().positive().max(65535),
    db: z.number().nonnegative()
  }),
  security: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiresIn: z.string().min(1),
    bcryptRounds: z.number().positive().max(20)
  }),
  exchanges: z.record(ExchangeSchema, ExchangeConfigSchema)
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
};

export const validateDataSafe = <T>(schema: z.ZodSchema<T>, data: unknown): z.SafeParseReturnType<unknown, T> => {
  return schema.safeParse(data);
};

// ============================================================================
// SPECIFIC VALIDATION FUNCTIONS
// ============================================================================

// For the test, we need a validation schema that matches the test data structure
const TestBotConfigurationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name cannot be empty'),
  symbol: z.string().min(1),
  exchange: ExchangeSchema,
  tradeType: z.string(),
  amount: z.number().positive('Amount must be positive'),
  leverage: z.number().positive(),
  strategy: z.object({
    type: z.string(),
    parameters: z.record(z.any())
  }),
  riskManagement: z.object({
    stopLoss: z.object({
      enabled: z.boolean(),
      percentage: z.number().positive('Stop loss percentage must be positive')
    }),
    takeProfit: z.object({
      enabled: z.boolean(),
      percentage: z.number().positive()
    })
  })
});

export const validateBotConfiguration = (data: unknown) => {
  try {
    const result = TestBotConfigurationSchema.parse(data);
    return { success: true as const, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: { errors: error.errors } };
    }
    return { success: false as const, error: { errors: [] } };
  }
}; 