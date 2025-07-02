// Unified Strategy System Interfaces
// Provides standardized interfaces for modular strategy development

export interface BotConfig {
  id: string
  name: string
  symbol: string
  tradeType: string
  leverage?: number
  amount: number
  metadata?: Record<string, unknown>
}

export interface StrategyContext {
  readonly config: StrategyConfig
  readonly botConfig: BotConfig
  readonly symbol: string
  readonly marketData: MarketDataProvider
  readonly tradeExecutor: TradeExecutorProvider
  readonly logger: LoggerProvider
  readonly storage: StorageProvider
  readonly eventEmitter: EventEmitterProvider
}

export interface IStrategy {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly supportedMarkets: readonly string[]
  initialize(context: StrategyContext): Promise<void>
  execute(context: StrategyContext): Promise<StrategyResult>
  cleanup(context: StrategyContext): Promise<void>
  validateConfig(config: Record<string, unknown>): ConfigValidationResult
  getDefaultConfig(): StrategyConfig
  getState(): StrategyState
  setState(state: Partial<StrategyState>): void
}

export interface StrategyResult {
  success: boolean
  action?: 'buy' | 'sell' | 'hold' | 'close'
  confidence?: number
  reason?: string
  metadata?: Record<string, unknown>
  error?: string
}

export interface StrategyConfig {
  readonly type: string
  readonly parameters: Record<string, unknown>
  readonly riskManagement?: RiskManagementConfig
  readonly execution?: ExecutionConfig
}

export interface RiskManagementConfig {
  readonly stopLossPercentage?: number
  readonly takeProfitPercentage?: number
  readonly maxPositionSize?: number
  readonly maxDailyLoss?: number
}

export interface ExecutionConfig {
  readonly timeframe: string
  readonly maxTrades?: number
  readonly minimumConfidence: number
  readonly executionDelay?: number
}

export interface ConfigValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

export interface MarketDataProvider {
  getCurrentPrice(symbol: string): Promise<number>
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>
  getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>
  getTicker(symbol: string): Promise<Ticker>
}

export interface TradeExecutorProvider {
  executeSignal(signal: TradeSignal, botConfig: BotConfig): Promise<TradeOrder>
  getPosition(botId: string, symbol: string): Promise<Position | null>
  closePosition(botId: string, symbol: string): Promise<void>
}

export interface LoggerProvider {
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
  debug(message: string, data?: Record<string, unknown>): void
}

export interface StorageProvider {
  storeStrategyEvent(botId: string, event: StrategyEvent): Promise<void>
  getStrategyState(botId: string): Promise<StrategyState | null>
  saveStrategyState(botId: string, state: StrategyState): Promise<void>
}

export interface EventEmitterProvider {
  emit(event: string, data: unknown): void
  on(event: string, handler: (data: unknown) => void): void
  off(event: string, handler: (data: unknown) => void): void
}

export interface StrategyEvent {
  type: 'trade' | 'signal' | 'error' | 'state_change'
  timestamp: number
  title: string
  description: string
  data?: Record<string, unknown>
  status: 'success' | 'warning' | 'error'
}

export interface StrategyState {
  isRunning: boolean
  totalProfit: number
  tradesExecuted: number
  currentPosition?: PositionState
  lastUpdate: Date
  customState?: Record<string, unknown>
}

export interface PositionState {
  side: 'buy' | 'sell'
  amount: number
  entryPrice: number
  timestamp: Date
  unrealizedPnl?: number
}

export interface OrderBook {
  bids: [number, number][]
  asks: [number, number][]
  timestamp: number
}

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Ticker {
  symbol: string
  last: number
  bid: number
  ask: number
  volume: number
  timestamp: number
}

export interface TradeSignal {
  id: string
  botId: string
  symbol: string
  side: 'buy' | 'sell'
  confidence: number
  price: number
  timestamp: number
  reason: string
}

export interface TradeOrder {
  id: string
  orderId?: string
  botId: string
  symbol: string
  type: string
  side: 'buy' | 'sell'
  amount: number
  price?: number
  status: string
  filled: number
  remaining: number
  timestamp: number
  updatedAt: number
}

export interface Position {
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  currentPrice?: number
  unrealizedPnl?: number
  timestamp: number
}
