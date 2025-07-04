/**
 * Strategy Backtesting Framework
 * 
 * Provides utilities for backtesting trading strategies against historical data
 */

import type { 
  IStrategy,
  StrategyContext, 
  StrategyConfig, 
  Candle,
  TradeOrder,
  TradeSignal,
  Position
} from '../JabbrLabs/target-reacher/interfaces';
import logger from '../services/logging.service';

import { strategyFactory } from './strategy-factory';
import { createBasicContext } from './strategy-utils';

/**
 * Backtesting results structure
 */
export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Array<{
    type: 'ENTRY' | 'EXIT';
    side: 'BUY' | 'SELL';
    price: number;
    amount: number;
    timestamp: number;
    pnl?: number;
  }>;
  equityCurve: Array<{
    timestamp: number;
    equity: number;
  }>;
  strategyState: Record<string, unknown>;
}

/**
 * Backtesting options
 */
export interface BacktestOptions {
  initialCapital?: number;
  fees?: number;
  slippage?: number;
  enableLogs?: boolean;
  saveTradeDetails?: boolean;
  commission?: number;
}

/**
 * Mock market data provider for backtesting
 */
class BacktestMarketDataProvider {
  private candles: Candle[];
  private currentIndex = 0;
  
  constructor(candles: Candle[]) {
    this.candles = candles;
  }
  
  async getCurrentPrice(symbol: string): Promise<number> {
    if (this.currentIndex >= this.candles.length) {
      throw new Error('No more data available');
    }
    const candle = this.candles[this.currentIndex];
    if (!candle) {
      throw new Error('Invalid candle data');
    }
    return candle.close;
  }
  
  async getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]> {
    if (this.currentIndex >= this.candles.length) {
      throw new Error('No more data available');
    }
    
    const endIndex = this.currentIndex + 1;
    const startIndex = Math.max(0, endIndex - (limit || this.candles.length));
    
    return this.candles.slice(startIndex, endIndex);
  }
  
  async getOrderBook(symbol: string, limit?: number): Promise<any> {
    if (this.currentIndex >= this.candles.length) {
      throw new Error('No more data available');
    }
    
    const currentCandle = this.candles[this.currentIndex];
    if (!currentCandle) {
      throw new Error('Invalid candle data');
    }
    
    return {
      bids: [[currentCandle.close * 0.999, 10]],
      asks: [[currentCandle.close * 1.001, 10]],
      timestamp: currentCandle.timestamp
    };
  }
  
  async getTicker(symbol: string): Promise<any> {
    if (this.currentIndex >= this.candles.length) {
      throw new Error('No more data available');
    }
    
    const currentCandle = this.candles[this.currentIndex];
    if (!currentCandle) {
      throw new Error('Invalid candle data');
    }
    
    return {
      symbol,
      last: currentCandle.close,
      bid: currentCandle.close * 0.999,
      ask: currentCandle.close * 1.001,
      volume: currentCandle.volume,
      timestamp: currentCandle.timestamp
    };
  }
  
  setCurrentIndex(index: number): void {
    if (index < 0 || index >= this.candles.length) {
      throw new Error(`Invalid candle index: ${index}`);
    }
    this.currentIndex = index;
  }
  
  getCurrentCandle(): Candle {
    const candle = this.candles[this.currentIndex];
    if (!candle) {
      throw new Error('Invalid candle index or data');
    }
    return candle;
  }
  
  hasMoreData(): boolean {
    return this.currentIndex < this.candles.length - 1;
  }
  
  advanceToNextCandle(): boolean {
    if (this.hasMoreData()) {
      this.currentIndex++;
      return true;
    }
    return false;
  }
}

/**
 * Mock trade executor for backtesting
 */
class BacktestTradeExecutor {
  private position: Position | null = null;
  private orders: TradeOrder[] = [];
  private trades: any[] = [];
  private equity: number;
  private initialCapital: number;
  private fees: number;
  private slippage: number;
  private pnl = 0;
  
  constructor(options: BacktestOptions) {
    this.initialCapital = options.initialCapital || 10000;
    this.equity = this.initialCapital;
    this.fees = options.fees || 0.001; // 0.1%
    this.slippage = options.slippage || 0.001; // 0.1%
  }
  
  async executeSignal(signal: TradeSignal, botConfig?: any): Promise<TradeOrder> {
    // Apply slippage
    const price = signal.side === 'buy' 
      ? signal.price * (1 + this.slippage)
      : signal.price * (1 - this.slippage);
      
    // Calculate position size (simple for backtesting)
    const amount = 1; // Fixed position size for now
    
    // Create an order
    const order: TradeOrder = {
      id: `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: `ord-${Date.now()}`,
      botId: signal.botId,
      symbol: signal.symbol,
      type: 'market',
      side: signal.side,
      amount,
      price,
      status: 'filled',
      filled: amount,
      remaining: 0,
      timestamp: signal.timestamp,
      updatedAt: signal.timestamp
    };
    
    this.orders.push(order);
    
    // Update position
    if (this.position === null) {
      // Opening a new position
      this.position = {
        symbol: signal.symbol,
        side: signal.side === 'buy' ? 'long' : 'short',
        size: amount,
        entryPrice: price,
        timestamp: signal.timestamp
      };
      
      this.trades.push({
        type: 'ENTRY',
        side: signal.side === 'buy' ? 'BUY' : 'SELL',
        price,
        amount,
        timestamp: signal.timestamp
      });
      
      // Apply fees
      this.equity -= price * amount * this.fees;
    } else {
      // Closing existing position
      const exitPrice = price;
      const entryPrice = this.position.entryPrice;
      let profit = 0;
      
      if (this.position.side === 'long' && signal.side === 'sell') {
        profit = (exitPrice - entryPrice) * this.position.size;
      } else if (this.position.side === 'short' && signal.side === 'buy') {
        profit = (entryPrice - exitPrice) * this.position.size;
      }
      
      // Apply fees
      profit -= price * amount * this.fees;
      
      this.pnl += profit;
      this.equity += profit;
      
      this.trades.push({
        type: 'EXIT',
        side: signal.side === 'buy' ? 'BUY' : 'SELL',
        price,
        amount,
        timestamp: signal.timestamp,
        pnl: profit
      });
      
      // Reset position
      const oldPosition = this.position;
      this.position = null;
      
      // Open new position if opposite direction
      if ((signal.side === 'buy' && oldPosition.side === 'short') ||
          (signal.side === 'sell' && oldPosition.side === 'long')) {
        this.position = {
          symbol: signal.symbol,
          side: signal.side === 'buy' ? 'long' : 'short',
          size: amount,
          entryPrice: price,
          timestamp: signal.timestamp
        };
        
        this.trades.push({
          type: 'ENTRY',
          side: signal.side === 'buy' ? 'BUY' : 'SELL',
          price,
          amount,
          timestamp: signal.timestamp
        });
        
        // Apply fees again for new position
        this.equity -= price * amount * this.fees;
      }
    }
    
    return order;
  }
  
  async getPosition(botId: string, symbol: string): Promise<Position | null> {
    return this.position;
  }
  
  async closePosition(botId: string, symbol: string): Promise<void> {
    if (!this.position) {return;}
    
    // Simulate market close at current price
    const signal: TradeSignal = {
      id: `close-${Date.now()}`,
      botId,
      symbol,
      side: this.position.side === 'long' ? 'sell' : 'buy',
      confidence: 1,
      price: this.position.entryPrice, // Just for initialization, will be updated
      timestamp: Date.now(),
      reason: 'Position close requested'
    };
    
    await this.executeSignal(signal);
  }
  
  getEquity(): number {
    return this.equity;
  }
  
  getPnL(): number {
    return this.pnl;
  }
  
  getTrades(): any[] {
    return this.trades;
  }
  
  reset(): void {
    this.position = null;
    this.orders = [];
    this.trades = [];
    this.equity = this.initialCapital;
    this.pnl = 0;
  }
}

/**
 * Strategy Backtester class
 */
export class StrategyBacktester {
  private strategy: IStrategy | null = null;
  private candles: Candle[];
  private marketData: BacktestMarketDataProvider;
  private tradeExecutor: BacktestTradeExecutor;
  private options: BacktestOptions;
  private context: StrategyContext;
  private equityCurve: Array<{ timestamp: number; equity: number }> = [];
  
  constructor(candles: Candle[], options: BacktestOptions = {}) {
    this.candles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    this.options = {
      initialCapital: 10000,
      fees: 0.001,
      slippage: 0.001,
      enableLogs: true,
      saveTradeDetails: true,
      commission: 0,
      ...options
    };
    
    this.marketData = new BacktestMarketDataProvider(this.candles);
    this.tradeExecutor = new BacktestTradeExecutor(this.options);
    
    // Create basic context with our backtesting trade executor already set
    this.context = {
      ...createBasicContext(
        'BTC/USDT',
        this.marketData,
        { type: 'backtest', parameters: {} }
      ),
      tradeExecutor: this.tradeExecutor
    };
  }
  
  /**
   * Load a strategy for backtesting
   */
  async loadStrategy(
    strategyType: string, 
    config: StrategyConfig
  ): Promise<void> {
    this.strategy = await strategyFactory.createStrategy(
      strategyType as any, 
      config, 
      this.context
    );
    
    // Initialize strategy
    await this.strategy.initialize(this.context);
  }
  
  /**
   * Run backtest on all candles
   */
  async runBacktest(): Promise<BacktestResult> {
    if (!this.strategy) {
      throw new Error('Strategy not loaded. Call loadStrategy() first.');
    }
    
    // Reset state
    this.tradeExecutor.reset();
    this.equityCurve = [];
    
    // Start from beginning
    this.marketData.setCurrentIndex(0);
    
    // Process each candle
    let candleCount = 0;
    
    while (this.marketData.hasMoreData()) {
      const candle = this.marketData.getCurrentCandle();
      
      try {
        // Execute strategy
        const result = await this.strategy.execute(this.context);
        
        // Record equity
        this.equityCurve.push({
          timestamp: candle.timestamp,
          equity: this.tradeExecutor.getEquity()
        });
        
        // Optional logging
        if (this.options.enableLogs && result.action && result.action !== 'hold') {
          logger.info(`Backtest [${new Date(candle.timestamp).toISOString()}]: ${result.action.toUpperCase()} signal generated`, {
            price: candle.close,
            confidence: result.confidence,
            reason: result.reason
          });
        }
      } catch (error) {
        logger.error(`Backtest error at candle ${candleCount}:`, { error });
      }
      
      // Move to next candle
      this.marketData.advanceToNextCandle();
      candleCount++;
    }
    
    // Ensure last position is closed
    await this.tradeExecutor.closePosition('backtest', 'BTC/USDT');
    
    // Calculate metrics
    return this.calculateResults();
  }
  
  /**
   * Calculate backtest results and metrics
   */
  private calculateResults(): BacktestResult {
    const trades = this.tradeExecutor.getTrades();
    const exitTrades = trades.filter(t => t.type === 'EXIT');
    
    const totalTrades = exitTrades.length;
    const winningTrades = exitTrades.filter(t => t.pnl > 0).length;
    const losingTrades = exitTrades.filter(t => t.pnl <= 0).length;
    
    const totalPnl = this.tradeExecutor.getPnL();
    const totalProfit = exitTrades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = exitTrades
      .filter(t => t.pnl <= 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const profitFactor = Math.abs(totalLoss) > 0 ? totalProfit / Math.abs(totalLoss) : totalProfit > 0 ? Infinity : 0;
    const averageWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    
    // Calculate drawdown
    let maxDrawdown = 0;
    let peak = this.options.initialCapital || 10000;
    
    this.equityCurve.forEach(point => {
      if (point.equity > peak) {
        peak = point.equity;
      }
      
      const drawdown = peak > 0 ? (peak - point.equity) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    // Calculate Sharpe Ratio (simplified)
    const returns = this.equityCurve.map((point, i) => {
      if (i === 0) {return 0;}
      const prevPoint = this.equityCurve[i-1];
      if (!prevPoint || prevPoint.equity === 0) {return 0;}
      return (point.equity - prevPoint.equity) / prevPoint.equity;
    });
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      maxDrawdown,
      sharpeRatio,
      trades: this.options.saveTradeDetails ? trades : [],
      equityCurve: this.options.saveTradeDetails ? this.equityCurve : [],
      strategyState: this.strategy ? { ...this.strategy.getState() } : {}
    };
  }
}

/**
 * Helper function to quickly backtest a strategy
 */
export async function quickBacktest(
  strategyType: string,
  config: StrategyConfig,
  candles: Candle[],
  options: BacktestOptions = {}
): Promise<BacktestResult> {
  const backtester = new StrategyBacktester(candles, options);
  await backtester.loadStrategy(strategyType, config);
  return await backtester.runBacktest();
}
