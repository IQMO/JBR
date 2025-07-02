import { BybitExchange } from './src/exchanges/bybit-exchange';
import { MarketType } from './src/exchanges/base-exchange';
import PositionMonitorService from './src/services/position-monitor.service';

async function testFuturesBeast() {
  console.log('🔥 SPARTAN BEAST MODE: FULL FUTURES TRADING ENGINE TEST');
  console.log('======================================================');

  // Mainnet credentials (safe for small test)
  const apiKey = {
    id: 'mainnet-key-1',
    userId: 'mainnet-user',
    exchange: 'bybit' as const,
    keyName: 'Mainnet Key',
    apiKey: '3TZG3zGNOZBa5Fnuck',
    apiSecret: 'k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI',
    sandbox: false,
    permissions: ['trade', 'read'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const exchange = new BybitExchange(apiKey, false);

  try {
    // Connect
    console.log('\n🔌 Connecting to Bybit MAINNET...');
    await exchange.connect();
    console.log('✅ Connected successfully!');

    // Set leverage and margin mode
    console.log('\n⚡ Setting leverage and margin mode...');
    await exchange.setLeverage('BTCUSDT', 10);
    await exchange.setMarginMode('BTCUSDT', 'isolated');
    console.log('✅ Leverage set to 10x, margin mode set to isolated');

    // Place a market order (open position)
    console.log('\n📝 Placing market order (BUY 0.001 BTCUSDT)...');
    let marketOrder;
    try {
      marketOrder = await exchange.placeOrder({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        amount: 0.001,
        marketType: MarketType.FUTURES
      });
      console.log('✅ Market order placed:', marketOrder);
    } catch (error) {
      console.error('❌ Market order failed:', error);
    }

    // Place a limit order (pending)
    console.log('\n📝 Placing limit order (SELL 0.001 BTCUSDT 2% above market)...');
    let limitOrder;
    try {
      const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
      const limitPrice = marketData.price * 1.02;
      limitOrder = await exchange.placeOrder({
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'limit',
        amount: 0.001,
        price: limitPrice,
        marketType: MarketType.FUTURES
      });
      console.log('✅ Limit order placed:', limitOrder);
    } catch (error) {
      console.error('❌ Limit order failed:', error);
    }

    // Place a stop order (pending)
    console.log('\n📝 Placing stop order (SELL 0.001 BTCUSDT 2% below market)...');
    let stopOrder;
    try {
      const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
      const stopPrice = marketData.price * 0.98;
      stopOrder = await exchange.placeOrder({
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'stop',
        amount: 0.001,
        stopPrice,
        marketType: MarketType.FUTURES
      });
      console.log('✅ Stop order placed:', stopOrder);
    } catch (error) {
      console.error('❌ Stop order failed:', error);
    }

    // Check open positions
    console.log('\n📊 Checking open positions...');
    try {
      const positions = await exchange.getPositions();
      if (positions.length > 0) {
        positions.forEach(pos => {
          console.log(`   ${pos.symbol}: ${pos.side} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x)`);
          console.log(`     PnL: ${pos.unrealizedPnl} (Mark: $${pos.markPrice})`);
        });
      } else {
        console.log('   No open positions');
      }
    } catch (error) {
      console.error('❌ Failed to get positions:', error);
    }

    // Cancel all open orders
    console.log('\n🚫 Cancelling all open orders...');
    try {
      await exchange.cancelAllOrders('BTCUSDT', MarketType.FUTURES);
      console.log('✅ All open orders cancelled');
    } catch (error) {
      console.error('❌ Failed to cancel all orders:', error);
    }

    // Final positions and balance
    console.log('\n📊 Final positions and balance:');
    try {
      const positions = await exchange.getPositions();
      const balance = await exchange.getBalance(MarketType.FUTURES);
      console.log('   Positions:', positions);
      console.log('   Balance:', balance);
    } catch (error) {
      console.error('❌ Final check failed:', error);
    }

    // 4. Switch position mode to hedge
    console.log('\n🔄 Switching position mode to hedge...');
    try {
      await exchange.setPositionMode('hedge');
      console.log('✅ Position mode switched to hedge');
    } catch (error) {
      console.error('❌ Failed to switch position mode:', error);
    }

    // 5. Add stop-loss and take-profit (manual simulation)
    console.log('\n🛡️ Adding stop-loss and take-profit (manual simulation)...');
    try {
      const positionsNow = await exchange.getPositions();
      const pos = positionsNow[0];
      if (pos) {
        const stopLoss = pos.entryPrice * 0.98;
        const takeProfit = pos.entryPrice * 1.05;
        console.log(`   Would set stop-loss at $${stopLoss.toFixed(2)} and take-profit at $${takeProfit.toFixed(2)}`);
      } else {
        console.log('   No open positions to set stop-loss/take-profit');
      }
    } catch (error) {
      console.error('❌ Failed to add stop-loss/take-profit:', error);
    }

    // 6. Close the position (market order)
    console.log('\n🚪 Closing open position (market order)...');
    try {
      const positionsNow = await exchange.getPositions();
      const pos = positionsNow[0];
      if (pos && pos.size > 0) {
        const closeOrder = await exchange.placeOrder({
          symbol: pos.symbol,
          side: pos.side === 'buy' ? 'sell' : 'buy',
          type: 'market',
          amount: pos.size,
          marketType: MarketType.FUTURES,
          reduceOnly: true
        });
        console.log('✅ Close order placed:', closeOrder);
      } else if (pos) {
        console.log('   No position to close');
      } else {
        console.log('   No open positions to close');
      }
    } catch (error) {
      console.error('❌ Failed to close position:', error);
    }

    // Start position monitor for TP/SL automation
    console.log('\n🛡️ Starting PositionMonitorService for TP/SL automation...');
    const monitor = new PositionMonitorService(exchange, {
      symbol: 'BTCUSDT',
      side: 'buy',
      stopLossPercent: 0.02, // 2% SL
      takeProfitPercent: 0.05 // 5% TP
    });
    monitor.start();
    // Let it run for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));
    monitor.stop();
    console.log('🛡️ PositionMonitorService stopped');

  } catch (error) {
    console.error('\n❌ Beast mode test failed:', error);
  } finally {
    await exchange.disconnect();
    console.log('\n🔌 Disconnected from exchange');
  }
}

if (require.main === module) {
  testFuturesBeast().catch(console.error);
}

export default testFuturesBeast; 