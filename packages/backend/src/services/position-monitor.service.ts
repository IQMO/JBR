import { EventEmitter } from 'events';

import type { BybitExchange } from '../exchanges/bybit-exchange';

interface TP_SL_Config {
  symbol: string;
  side: 'buy' | 'sell';
  stopLossPercent: number; // e.g. 0.02 for 2%
  takeProfitPercent: number; // e.g. 0.05 for 5%
}

export class PositionMonitorService extends EventEmitter {
  private exchange: BybitExchange;
  private config: TP_SL_Config;
  private interval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 10000; // 10 seconds

  constructor(exchange: BybitExchange, config: TP_SL_Config) {
    super();
    this.exchange = exchange;
    this.config = config;
  }

  start() {
    if (this.interval) {return;}
    this.interval = setInterval(() => this.checkPositions(), this.CHECK_INTERVAL);
    console.log('🛡️ PositionMonitorService started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('🛡️ PositionMonitorService stopped');
    }
  }

  async checkPositions() {
    try {
      const positions = await this.exchange.getPositions(this.config.symbol);
      const pos = positions.find(p => p.symbol === this.config.symbol && p.side === this.config.side);
      if (!pos || pos.size === 0) {
        // No open position
        return;
      }
      // Calculate TP/SL prices
      const stopLoss = pos.side === 'buy'
        ? pos.entryPrice * (1 - this.config.stopLossPercent)
        : pos.entryPrice * (1 + this.config.stopLossPercent);
      const takeProfit = pos.side === 'buy'
        ? pos.entryPrice * (1 + this.config.takeProfitPercent)
        : pos.entryPrice * (1 - this.config.takeProfitPercent);
      // Check for existing TP/SL orders (not implemented in this example)
      // Place/modify TP/SL orders as needed
      console.log(`🛡️ Monitoring ${pos.symbol} ${pos.side} position: size=${pos.size} entry=${pos.entryPrice}`);
      console.log(`   Should have SL at $${stopLoss.toFixed(2)}, TP at $${takeProfit.toFixed(2)}`);
      // TODO: Place/modify stop-loss and take-profit orders using exchange.placeOrder()
      // Emit event for monitoring
      this.emit('positionMonitored', { pos, stopLoss, takeProfit });
    } catch (error) {
      console.error('❌ PositionMonitorService error:', error);
    }
  }
}

export default PositionMonitorService; 