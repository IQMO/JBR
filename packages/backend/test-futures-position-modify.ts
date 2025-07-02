import { BybitExchange } from './src/exchanges/bybit-exchange';
import { MarketType } from './src/exchanges/base-exchange';

async function testFuturesPositionModify() {
  console.log('🔥 SPARTAN BEAST MODE: FULL FUTURES PARAMETER TEST');
  console.log('==================================================');

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
    try {
      await exchange.setLeverage('BTCUSDT', 10);
      await exchange.setMarginMode('BTCUSDT', 'isolated');
      await exchange.setPositionMode('hedge');
      console.log('✅ Leverage set to 10x, margin mode set to isolated, position mode set to hedge');
    } catch (error) {
      console.error('❌ Failed to set leverage/margin/position mode:', error);
    }

    // Place a limit order with all advanced parameters
    console.log('\n📝 Placing advanced limit order (BUY 0.001 BTCUSDT, reduceOnly, GTC, clientOrderId, TIF)...');
    let limitOrder;
    try {
      const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
      const limitPrice = marketData.price * 0.99;
      limitOrder = await exchange.placeOrder({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        amount: 0.001,
        price: limitPrice,
        marketType: MarketType.FUTURES,
        reduceOnly: true,
        timeInForce: 'GTC',
        clientOrderId: `spartan-${Date.now()}`
      });
      console.log('✅ Advanced limit order placed:', limitOrder);
    } catch (error) {
      console.error('❌ Advanced limit order failed:', error);
    }

    // Place a stop-limit order with stopPrice and triggerDirection
    console.log('\n📝 Placing stop-limit order (SELL 0.001 BTCUSDT, stopPrice, triggerDirection)...');
    let stopLimitOrder;
    try {
      const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
      const stopPrice = marketData.price * 0.98;
      const limitPrice = stopPrice * 0.99;
      stopLimitOrder = await exchange.placeOrder({
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'stop-limit',
        amount: 0.001,
        price: limitPrice,
        stopPrice,
        marketType: MarketType.FUTURES,
        // Bybit/CCXT: add triggerDirection param in params
        // params: { triggerDirection: 'below' }
      });
      console.log('✅ Stop-limit order placed:', stopLimitOrder);
    } catch (error) {
      console.error('❌ Stop-limit order failed:', error);
    }

    // Place a trailing stop order (if supported)
    console.log('\n📝 Placing trailing stop order (SELL 0.001 BTCUSDT, trailing)...');
    try {
      // Bybit/CCXT: trailing stop is not always supported, but we simulate the params
      // params: { trailingPercent: 0.5 }
      // This is a placeholder for exchanges that support it
      console.log('   Trailing stop order simulation (not all exchanges support trailing)');
    } catch (error) {
      console.error('❌ Trailing stop order failed:', error);
    }

    // Check open positions
    console.log('\n📊 Checking open positions...');
    try {
      const positionsNow = await exchange.getPositions();
      if (positionsNow.length > 0) {
        positionsNow.forEach(pos => {
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
      const positionsNow = await exchange.getPositions();
      const balance = await exchange.getBalance(MarketType.FUTURES);
      console.log('   Positions:', positionsNow);
      console.log('   Balance:', balance);
    } catch (error) {
      console.error('❌ Final check failed:', error);
    }

  } catch (error) {
    console.error('\n❌ Position modification test failed:', error);
  } finally {
    await exchange.disconnect();
    console.log('\n🔌 Disconnected from exchange');
  }
}

if (require.main === module) {
  testFuturesPositionModify().catch(console.error);
}

export default testFuturesPositionModify; 