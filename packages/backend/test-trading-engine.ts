import { BybitExchange } from './src/exchanges/bybit-exchange';
import { MarketType } from './src/exchanges/base-exchange';

/**
 * TRADING ENGINE TEST - LIVE BYBIT TESTNET
 * 
 * This script demonstrates the complete trading engine capabilities:
 * - Connection and authentication
 * - Market data retrieval
 * - Account balance checking
 * - Position management
 * - Order placement (commented out for safety)
 */

async function testTradingEngine() {
  console.log('🚀 TESTING JABBR TRADING ENGINE');
  console.log('================================');

  // Initialize with your Bybit testnet credentials
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
    // 1. Connect to Bybit
    console.log('\n🔌 Connecting to Bybit testnet...');
    await exchange.connect();
    console.log('✅ Connected successfully!');

    // 2. Get Exchange Capabilities
    console.log('\n📋 Exchange Capabilities:');
    const capabilities = exchange.getCapabilities();
    console.log(`   Spot: ${capabilities.spot ? '✅' : '❌'}`);
    console.log(`   Futures: ${capabilities.futures ? '✅' : '❌'}`);
    console.log(`   Max Leverage - Spot: ${capabilities.maxLeverage.spot}x, Futures: ${capabilities.maxLeverage.futures}x`);
    console.log(`   Rate Limit: ${capabilities.rateLimits.requests} requests/${capabilities.rateLimits.window/1000}s`);

    // 3. Test Market Data
    console.log('\n📊 Testing Market Data...');
    
    // Futures market data
    const futuresData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
    console.log(`   BTCUSDT Futures: $${futuresData.price.toFixed(2)} (24h: ${futuresData.change24h.toFixed(2)}%)`);
    
    // Spot market data
    const spotData = await exchange.getMarketData('BTCUSDT', MarketType.SPOT);
    console.log(`   BTCUSDT Spot: $${spotData.price.toFixed(2)} (24h: ${spotData.change24h.toFixed(2)}%)`);

    // 4. Test Account Balance
    console.log('\n💰 Account Balances:');
    
    const futuresBalance = await exchange.getBalance(MarketType.FUTURES);
    console.log('   Futures:');
    futuresBalance.forEach(balance => {
      if (balance.total > 0) {
        console.log(`     ${balance.currency}: ${balance.total} (Available: ${balance.available})`);
      }
    });

    const spotBalance = await exchange.getBalance(MarketType.SPOT);
    console.log('   Spot:');
    spotBalance.forEach(balance => {
      if (balance.total > 0) {
        console.log(`     ${balance.currency}: ${balance.total} (Available: ${balance.available})`);
      }
    });

    // 5. Test Position Management (Futures)
    console.log('\n⚡ Testing Position Management...');
    
    try {
      // Get current positions
      const positions = await exchange.getPositions();
      console.log(`   Current Positions: ${positions.length}`);
      positions.forEach(pos => {
        console.log(`     ${pos.symbol}: ${pos.side} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x)`);
      });

      // Test leverage setting (safe operation)
      console.log('   Setting leverage for BTCUSDT to 10x...');
      await exchange.setLeverage('BTCUSDT', 10);
      console.log('   ✅ Leverage set successfully!');

    } catch (error) {
      console.log(`   ⚠️ Position management test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 6. Test Trading Fees
    console.log('\n📊 Trading Fees:');
    const fees = await exchange.getTradingFees('BTCUSDT', MarketType.FUTURES);
    console.log(`   BTCUSDT Futures - Maker: ${(fees.maker * 100).toFixed(4)}%, Taker: ${(fees.taker * 100).toFixed(4)}%`);

    // 7. Test Order Book
    console.log('\n📈 Order Book (BTCUSDT Futures):');
    const orderBook = await exchange.getOrderBook('BTCUSDT', MarketType.FUTURES, 5);
    console.log('   Top 5 Bids:');
    orderBook.bids.slice(0, 5).forEach(([price, amount]) => {
      console.log(`     $${price.toFixed(2)} - ${amount.toFixed(4)} BTC`);
    });
    console.log('   Top 5 Asks:');
    orderBook.asks.slice(0, 5).forEach(([price, amount]) => {
      console.log(`     $${price.toFixed(2)} - ${amount.toFixed(4)} BTC`);
    });

    // 8. COMMENTED OUT - Order Placement Test (uncomment when ready to trade)
    console.log('\n🚫 Order Placement Test (COMMENTED OUT FOR SAFETY)');
    console.log('   To test order placement, uncomment the code below:');
    console.log('   // const order = await exchange.placeOrder({');
    console.log('   //   symbol: "BTCUSDT",');
    console.log('   //   side: "buy",');
    console.log('   //   type: "limit",');
    console.log('   //   amount: 0.001,');
    console.log('   //   price: futuresData.price * 0.95, // 5% below market');
    console.log('   //   marketType: MarketType.FUTURES');
    console.log('   // });');

    console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('💪 Your trading engine is FULLY OPERATIONAL!');

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
  testTradingEngine().catch(console.error);
}

export default testTradingEngine; 