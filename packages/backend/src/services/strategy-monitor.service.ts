/**
 * Strategy Monitor Service
 * 
 * Provides real-time monitoring of strategy performance, signals, and execution.
 * Integrates with the WebSocket system to broadcast real-time updates to the frontend.
 */

import type { SignalSummary, StrategyUpdateMessage, StrategyPerformanceMetrics, PositionSummary } from '@jabbr/shared';
import { CONSTANTS, RiskMetrics } from '@jabbr/shared';

import type { 
  IStrategy, 
  StrategyState, 
  StrategyEvent,
  StrategyResult,
  TradeSignal 
} from '../JabbrLabs/target-reacher/interfaces';
import type { JabbrWebSocketServer } from '../websocket/websocket-server';

import logger from './logging.service';


// Real-time strategy update messages

export class StrategyMonitorService {
  private wsServer: JabbrWebSocketServer;
  private activeStrategies: Map<string, IStrategy> = new Map();
  private strategyMetrics: Map<string, StrategyPerformanceMetrics> = new Map();
  private strategyStates: Map<string, StrategyState> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private signalHistory: Map<string, SignalSummary[]> = new Map();
  
  // Configuration
  private readonly MONITORING_INTERVAL = 5000; // 5 seconds
  private readonly SIGNAL_HISTORY_LIMIT = 50;
  private readonly PERFORMANCE_UPDATE_INTERVAL = 10000; // 10 seconds

  constructor(wsServer: JabbrWebSocketServer) {
    this.wsServer = wsServer;
    this.setupPerformanceMonitoring();
    logger.info('Strategy Monitor Service initialized');
  }

  /**
   * Register a strategy for monitoring
   */
  public registerStrategy(botId: string, strategy: IStrategy): void {
    try {
      this.activeStrategies.set(botId, strategy);
      
      // Initialize metrics
      const metrics: StrategyPerformanceMetrics = {
        botId,
        strategyName: strategy.name,
        strategyVersion: strategy.version,
        isRunning: false,
        uptime: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        dailyPnL: 0,
        winRate: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        averageTradeTime: 0,
        currentPositions: [],
        recentSignals: [],
        riskMetrics: {
          currentDrawdown: 0,
          maxDailyLoss: 0,
          riskScore: 1,
          leverageUtilization: 0,
          exposurePercentage: 0,
          stopLossDistance: 0
        },
        timestamp: new Date()
      };
      
      this.strategyMetrics.set(botId, metrics);
      this.strategyStates.set(botId, strategy.getState());
      this.signalHistory.set(botId, []);
      
      // Start monitoring this strategy
      this.startStrategyMonitoring(botId);
      
      logger.info(`Strategy registered for monitoring: ${strategy.name} (Bot: ${botId})`);
      
      // Broadcast registration
      this.broadcastStrategyUpdate({
        type: 'state_change',
        botId,
        strategyName: strategy.name,
        data: {
          action: 'registered',
          metrics
        },
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error(`Failed to register strategy for monitoring: ${botId}`, { error });
    }
  }

  /**
   * Unregister a strategy from monitoring
   */
  public unregisterStrategy(botId: string): void {
    try {
      // Stop monitoring
      this.stopStrategyMonitoring(botId);
      
      // Get strategy info for broadcast
      const strategy = this.activeStrategies.get(botId);
      const strategyName = strategy?.name || 'Unknown';
      
      // Clean up
      this.activeStrategies.delete(botId);
      this.strategyMetrics.delete(botId);
      this.strategyStates.delete(botId);
      this.signalHistory.delete(botId);
      
      logger.info(`Strategy unregistered from monitoring: ${strategyName} (Bot: ${botId})`);
      
      // Broadcast unregistration
      this.broadcastStrategyUpdate({
        type: 'state_change',
        botId,
        strategyName,
        data: {
          action: 'unregistered'
        },
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error(`Failed to unregister strategy from monitoring: ${botId}`, { error });
    }
  }

  /**
   * Update strategy state
   */
  public updateStrategyState(botId: string, newState: Partial<StrategyState>): void {
    try {
      const currentState = this.strategyStates.get(botId);
      if (!currentState) {
        logger.warn(`Strategy state not found for bot: ${botId}`);
        return;
      }

      const updatedState = { ...currentState, ...newState, lastUpdate: new Date() };
      this.strategyStates.set(botId, updatedState);
      
      // Update metrics
      const metrics = this.strategyMetrics.get(botId);
      if (metrics) {
        metrics.isRunning = updatedState.isRunning;
        metrics.totalPnL = updatedState.totalProfit;
        metrics.totalTrades = updatedState.tradesExecuted;
        metrics.timestamp = new Date();
        
        // Update positions if available
        if (updatedState.currentPosition) {
          const position: PositionSummary = {
            symbol: 'BTCUSDT', // This should come from bot config
            side: updatedState.currentPosition.side === 'buy' ? 'long' : 'short',
            size: updatedState.currentPosition.amount,
            entryPrice: updatedState.currentPosition.entryPrice,
            currentPrice: updatedState.currentPosition.entryPrice, // This should be updated with real current price
            unrealizedPnL: updatedState.currentPosition.unrealizedPnl || 0,
            leverage: 1, // This should come from bot config
            timestamp: updatedState.currentPosition.timestamp
          };
          metrics.currentPositions = [position];
        } else {
          metrics.currentPositions = [];
        }
      }

      const strategy = this.activeStrategies.get(botId);
      
      // Broadcast state change
      this.broadcastStrategyUpdate({
        type: 'state_change',
        botId,
        strategyName: strategy?.name || 'Unknown',
        data: {
          state: updatedState,
          metrics: this.strategyMetrics.get(botId)
        },
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error(`Failed to update strategy state: ${botId}`, { error });
    }
  }

  /**
   * Record a new trading signal
   */
  public recordSignal(botId: string, signal: TradeSignal): void {
    try {
      const signalSummary: SignalSummary = {
        id: signal.id,
        symbol: signal.symbol,
        side: signal.side,
        strength: signal.confidence, // Using confidence as strength
        confidence: signal.confidence,
        price: signal.price,
        timestamp: new Date(signal.timestamp),
        executed: false,
        result: 'pending'
      };

      // Add to history
      const history = this.signalHistory.get(botId) || [];
      history.unshift(signalSummary);
      
      // Limit history size
      if (history.length > this.SIGNAL_HISTORY_LIMIT) {
        history.splice(this.SIGNAL_HISTORY_LIMIT);
      }
      
      this.signalHistory.set(botId, history);

      // Update metrics
      const metrics = this.strategyMetrics.get(botId);
      if (metrics) {
        metrics.recentSignals = history.slice(0, 10); // Keep last 10 for metrics
        metrics.lastSignalTime = new Date();
        metrics.timestamp = new Date();
      }

      const strategy = this.activeStrategies.get(botId);
      
      // Broadcast signal
      this.broadcastStrategyUpdate({
        type: 'signal',
        botId,
        strategyName: strategy?.name || 'Unknown',
        data: {
          signal: signalSummary,
          recentSignals: history.slice(0, 5) // Last 5 signals
        },
        timestamp: new Date()
      });
      
      logger.info(`Signal recorded for bot ${botId}: ${signal.side} ${signal.symbol} @ ${signal.price}`);
      
    } catch (error) {
      logger.error(`Failed to record signal for bot: ${botId}`, { error });
    }
  }

  /**
   * Record a trade execution
   */
  public recordTrade(botId: string, trade: {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    pnl?: number;
    fees: number;
    signalId?: string;
  }): void {
    try {
      // Update signal execution status if signal ID provided
      if (trade.signalId) {
        const history = this.signalHistory.get(botId) || [];
        const signalIndex = history.findIndex(s => s.id === trade.signalId);
        if (signalIndex !== -1 && history.at(signalIndex)) {
          const signal = history.at(signalIndex);
          if (signal) {
            signal.executed = true;
            if (trade.pnl !== undefined) {
              signal.result = trade.pnl > 0 ? 'win' : 'loss';
            }
          }
        }
      }

      // Update metrics
      const metrics = this.strategyMetrics.get(botId);
      if (metrics) {
        metrics.totalTrades += 1;
        metrics.lastTradeTime = new Date();
        
        if (trade.pnl !== undefined) {
          metrics.totalPnL += trade.pnl;
          metrics.dailyPnL += trade.pnl; // Simplified daily calculation
          
          if (trade.pnl > 0) {
            metrics.winningTrades += 1;
          } else {
            metrics.losingTrades += 1;
          }
          
          // Update win rate
          metrics.winRate = (metrics.winningTrades / metrics.totalTrades) * 100;
        }
        
        metrics.timestamp = new Date();
      }

      const strategy = this.activeStrategies.get(botId);
      
      // Broadcast trade
      this.broadcastStrategyUpdate({
        type: 'trade',
        botId,
        strategyName: strategy?.name || 'Unknown',
        data: {
          trade,
          metrics: this.strategyMetrics.get(botId)
        },
        timestamp: new Date()
      });
      
      logger.info(`Trade recorded for bot ${botId}: ${trade.side} ${trade.amount} ${trade.symbol} @ ${trade.price}`);
      
    } catch (error) {
      logger.error(`Failed to record trade for bot: ${botId}`, { error });
    }
  }

  /**
   * Get strategy performance metrics
   */
  public getStrategyMetrics(botId: string): StrategyPerformanceMetrics | undefined {
    return this.strategyMetrics.get(botId);
  }

  /**
   * Get all active strategies
   */
  public getActiveStrategies(): Array<{ botId: string; strategy: IStrategy; metrics: StrategyPerformanceMetrics }> {
    const result: Array<{ botId: string; strategy: IStrategy; metrics: StrategyPerformanceMetrics }> = [];
    
    for (const [botId, strategy] of this.activeStrategies) {
      const metrics = this.strategyMetrics.get(botId);
      if (metrics) {
        result.push({ botId, strategy, metrics });
      }
    }
    
    return result;
  }

  /**
   * Start monitoring a specific strategy
   */
  private startStrategyMonitoring(botId: string): void {
    // Stop existing monitoring if any
    this.stopStrategyMonitoring(botId);
    
    const interval = setInterval(() => {
      this.updateStrategyMonitoring(botId);
    }, this.MONITORING_INTERVAL);
    
    this.monitoringIntervals.set(botId, interval);
  }

  /**
   * Stop monitoring a specific strategy
   */
  private stopStrategyMonitoring(botId: string): void {
    const interval = this.monitoringIntervals.get(botId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(botId);
    }
  }

  /**
   * Update strategy monitoring data
   */
  private updateStrategyMonitoring(botId: string): void {
    try {
      const strategy = this.activeStrategies.get(botId);
      const metrics = this.strategyMetrics.get(botId);
      
      if (!strategy || !metrics) {return;}

      // Get current state from strategy
      const currentState = strategy.getState();
      this.strategyStates.set(botId, currentState);
      
      // Update uptime if running
      if (currentState.isRunning) {
        metrics.uptime += this.MONITORING_INTERVAL;
      }
      
      // Update metrics timestamp
      metrics.timestamp = new Date();
      
      // Check for risk alerts
      this.checkRiskAlerts(botId, metrics);
      
    } catch (error) {
      logger.error(`Failed to update strategy monitoring for bot: ${botId}`, { error });
    }
  }

  /**
   * Check for risk alerts
   */
  private checkRiskAlerts(botId: string, metrics: StrategyPerformanceMetrics): void {
    const alerts: string[] = [];
    
    // Check drawdown
    if (metrics.currentDrawdown > 20) { // 20% drawdown alert
      alerts.push(`High drawdown: ${metrics.currentDrawdown.toFixed(2)}%`);
    }
    
    // Check daily loss
    if (metrics.dailyPnL < -1000) { // $1000 daily loss alert
      alerts.push(`High daily loss: $${Math.abs(metrics.dailyPnL).toFixed(2)}`);
    }
    
    // Check win rate
    if (metrics.totalTrades > 10 && metrics.winRate < 30) { // Low win rate alert
      alerts.push(`Low win rate: ${metrics.winRate.toFixed(1)}%`);
    }
    
    // Broadcast alerts if any
    if (alerts.length > 0) {
      this.broadcastStrategyUpdate({
        type: 'risk_alert',
        botId,
        strategyName: metrics.strategyName,
        data: {
          alerts,
          metrics
        },
        timestamp: new Date()
      });
    }
  }

  /**
   * Setup periodic performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    setInterval(() => {
      for (const [botId] of this.activeStrategies) {
        const metrics = this.strategyMetrics.get(botId);
        if (metrics) {
          this.broadcastStrategyUpdate({
            type: 'performance',
            botId,
            strategyName: metrics.strategyName,
            data: {
              metrics
            },
            timestamp: new Date()
          });
        }
      }
    }, this.PERFORMANCE_UPDATE_INTERVAL);
  }

  /**
   * Broadcast strategy update via WebSocket
   */
  private broadcastStrategyUpdate(update: StrategyUpdateMessage): void {
    try {
      this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.SIGNALS, {
        type: 'data',
        data: update,
        timestamp: new Date().toISOString()
      });
      
      // Also broadcast to bot status channel for general bot updates
      if (update.type === 'performance' || update.type === 'state_change') {
        this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.BOT_STATUS, {
          type: 'data',
          data: {
            botId: update.botId,
            strategy: update.data.metrics || update.data.state,
            timestamp: update.timestamp
          },
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      logger.error('Failed to broadcast strategy update', { error, update });
    }
  }

  /**
   * Get strategy summary for dashboard
   */
  public getStrategySummary(): {
    totalStrategies: number;
    runningStrategies: number;
    totalPnL: number;
    dailyPnL: number;
    totalTrades: number;
    averageWinRate: number;
  } {
    const allMetrics = Array.from(this.strategyMetrics.values());
    
    return {
      totalStrategies: allMetrics.length,
      runningStrategies: allMetrics.filter(m => m.isRunning).length,
      totalPnL: allMetrics.reduce((sum, m) => sum + m.totalPnL, 0),
      dailyPnL: allMetrics.reduce((sum, m) => sum + m.dailyPnL, 0),
      totalTrades: allMetrics.reduce((sum, m) => sum + m.totalTrades, 0),
      averageWinRate: allMetrics.length > 0 
        ? allMetrics.reduce((sum, m) => sum + m.winRate, 0) / allMetrics.length 
        : 0
    };
  }

  /**
   * Cleanup on shutdown
   */
  public shutdown(): void {
    // Stop all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    this.activeStrategies.clear();
    this.strategyMetrics.clear();
    this.strategyStates.clear();
    this.signalHistory.clear();
    
    logger.info('Strategy Monitor Service shut down');
  }
}

export default StrategyMonitorService;
