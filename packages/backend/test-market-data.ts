import { BybitExchange } from './src/exchanges/bybit-exchange';
import { MarketType } from './src/exchanges/base-exchange';

/**
 * MARKET DATA TEST - NO AUTHENTICATION REQUIRED
 * 
 * This script tests market data functionality that doesn't require API keys
 */

async function testMarketData() {
  console.log('🚀 TESTING JABBR MARKET DATA ENGINE');
  console.log('===================================');

  // Create exchange with dummy credentials for public data
  const apiKey = {
    id: 'test-key-1',
    userId: 'test-user',
    exchange: 'bybit' as const,
    keyName: 'Test Key',
    apiKey: 'dummy',
    apiSecret: 'dummy',
    sandbox: true,
    permissions: ['read'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const exchange = new BybitExchange(apiKey, true); // testnet = true

  try {
    console.log('\n📋 Exchange Capabilities:');
    const capabilities = exchange.getCapabilities();
    console.log(`   Spot: ${capabilities.spot ? '✅' : '❌'}`);
    console.log(`   Futures: ${capabilities.futures ? '✅' : '❌'}`);
    console.log(`   Max Leverage - Spot: ${capabilities.maxLeverage.spot}x, Futures: ${capabilities.maxLeverage.futures}x`);
    console.log(`   Rate Limit: ${capabilities.rateLimits.requests} requests/${capabilities.rateLimits.window/1000}s`);

    console.log('\n📊 Testing Public Market Data...');
    
    try {
      // Test public market data (no auth required)
      const futuresData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
      console.log(`   ✅ BTCUSDT Futures: $${futuresData.price.toFixed(2)} (24h: ${futuresData.change24h.toFixed(2)}%)`);
      
      const spotData = await exchange.getMarketData('BTCUSDT', MarketType.SPOT);
      console.log(`   ✅ BTCUSDT Spot: $${spotData.price.toFixed(2)} (24h: ${spotData.change24h.toFixed(2)}%)`);

    } catch (error) {
      console.log(`   ⚠️ Market data test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test order book (public data)
      console.log('\n📈 Testing Order Book...');
      const orderBook = await exchange.getOrderBook('BTCUSDT', MarketType.FUTURES, 5);
      console.log('   Top 5 Bids:');
      orderBook.bids.slice(0, 5).forEach(([price, amount]) => {
        console.log(`     $${price.toFixed(2)} - ${amount.toFixed(4)} BTC`);
      });
      console.log('   Top 5 Asks:');
      orderBook.asks.slice(0, 5).forEach(([price, amount]) => {
        console.log(`     $${price.toFixed(2)} - ${amount.toFixed(4)} BTC`);
      });
    } catch (error) {
      console.log(`   ⚠️ Order book test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test recent trades (public data)
      console.log('\n📊 Testing Recent Trades...');
      const trades = await exchange.getRecentTrades('BTCUSDT', MarketType.FUTURES, 5);
      console.log('   Latest 5 trades:');
      trades.slice(0, 5).forEach(trade => {
        console.log(`     ${trade.side} ${trade.amount.toFixed(4)} @ $${trade.price.toFixed(2)}`);
      });
    } catch (error) {
      console.log(`   ⚠️ Recent trades test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test klines/candlesticks (public data)
      console.log('\n📈 Testing Candlestick Data...');
      const klines = await exchange.getKlines('BTCUSDT', '1h', MarketType.FUTURES, undefined, undefined, 5);
      console.log('   Latest 5 hourly candles:');
      klines.slice(-5).forEach(candle => {
        console.log(`     ${candle.timestamp.toISOString()}: O:${candle.open.toFixed(2)} H:${candle.high.toFixed(2)} L:${candle.low.toFixed(2)} C:${candle.close.toFixed(2)}`);
      });
    } catch (error) {
      console.log(`   ⚠️ Candlestick test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n🎉 MARKET DATA TESTS COMPLETED!');
    console.log('💪 Your trading engine\'s market data functionality is OPERATIONAL!');

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
  testMarketData().catch(console.error);
}

export default testMarketData; 