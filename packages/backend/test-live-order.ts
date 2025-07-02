import { BybitExchange } from './src/exchanges/bybit-exchange';
import { MarketType } from './src/exchanges/base-exchange';

/**
 * 🔥 LIVE ORDER TEST - REAL TRADING ON TESTNET! 🔥
 * 
 * This demonstrates ACTUAL order placement and management
 * SAFE on testnet with fake money!
 */

async function testLiveOrder() {
  console.log('🚀 TESTING LIVE ORDER PLACEMENT');
  console.log('===============================');
  console.log('⚠️ TESTNET ONLY - FAKE MONEY!');

  // Real testnet credentials
  const apiKey = {
    id: 'test-key-1',
    userId: 'test-user',
    exchange: 'bybit' as const,
    keyName: 'Test Key',
    apiKey: 'DsBkIFhCCmPmfz8THD',
    apiSecret: 'swDPO6E2JVswGfVOQ1oyjcj5L8rWNJdO5EL9',
    sandbox: true,
    permissions: ['trade', 'read'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const exchange = new BybitExchange(apiKey, true); // testnet = true

  try {
    // Connect
    console.log('\n🔌 Connecting to Bybit testnet...');
    await exchange.connect();
    console.log('✅ Connected successfully!');

    // Get current market price
    console.log('\n📊 Getting current market data...');
    const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
    console.log(`   Current BTC Price: $${marketData.price.toFixed(2)}`);

    // Calculate a safe limit order price (5% below market)
    const limitPrice = marketData.price * 0.95;
    console.log(`   Limit Order Price: $${limitPrice.toFixed(2)} (5% below market)`);

    // Place a small test order
    console.log('\n📝 Placing test limit order...');
    console.log('   Order Details:');
    console.log(`     Symbol: BTCUSDT`);
    console.log(`     Side: BUY`);
    console.log(`     Type: LIMIT`);
    console.log(`     Amount: 0.001 BTC`);
    console.log(`     Price: $${limitPrice.toFixed(2)}`);
    console.log(`     Market: FUTURES`);

    try {
      const order = await exchange.placeOrder({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        amount: 0.001,
        price: limitPrice,
        marketType: MarketType.FUTURES
      });

      console.log('\n🎉 ORDER PLACED SUCCESSFULLY!');
      console.log(`   Order ID: ${order.orderId}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Amount: ${order.amount} BTC`);
      console.log(`   Price: $${order.price?.toFixed(2)}`);
      console.log(`   Filled: ${order.filled} BTC`);
      console.log(`   Remaining: ${order.remaining} BTC`);

      // Wait a moment then check order status
      console.log('\n⏳ Waiting 3 seconds then checking order status...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const orderStatus = await exchange.getOrder(order.orderId, 'BTCUSDT', MarketType.FUTURES);
      console.log('\n📊 Order Status Update:');
      console.log(`   Status: ${orderStatus.status}`);
      console.log(`   Filled: ${orderStatus.filled} BTC`);
      console.log(`   Remaining: ${orderStatus.remaining} BTC`);

      // Cancel the order (cleanup)
      console.log('\n🚫 Cancelling test order...');
      const cancelled = await exchange.cancelOrder(order.orderId, 'BTCUSDT', MarketType.FUTURES);
      if (cancelled) {
        console.log('✅ Order cancelled successfully');
      } else {
        console.log('⚠️ Order may have already been filled or cancelled');
      }

    } catch (orderError) {
      console.error('❌ Order placement failed:', orderError);
    }

    // Test getting open orders
    console.log('\n📋 Checking open orders...');
    const openOrders = await exchange.getOpenOrders('BTCUSDT', MarketType.FUTURES);
    console.log(`   Open Orders: ${openOrders.length}`);
    openOrders.forEach(order => {
      console.log(`     ${order.orderId}: ${order.side} ${order.amount} @ $${order.price?.toFixed(2)} (${order.status})`);
    });

    console.log('\n🎉 LIVE ORDER TEST COMPLETED!');
    console.log('💪 Your trading engine can EXECUTE REAL TRADES!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Disconnect
    await exchange.disconnect();
    console.log('\n🔌 Disconnected from exchange');
  }
}

// Run the test
if (require.main === module) {
  testLiveOrder().catch(console.error);
}

export default testLiveOrder; 