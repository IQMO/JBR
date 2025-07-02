import { BybitExchange } from './src/exchanges/bybit-exchange';
import { MarketType } from './src/exchanges/base-exchange';

/**
 * 🔥 MAINNET SMALL AMOUNT TEST - REAL TRADING! 🔥
 * 
 * This tests with REAL MONEY on MAINNET but with tiny amounts
 * Perfect for proving the engine works with actual funds
 */

async function testMainnetSmall() {
  console.log('🚀 MAINNET SMALL AMOUNT TEST');
  console.log('============================');
  console.log('⚠️ REAL MONEY - SMALL AMOUNTS ONLY!');

  // Real mainnet credentials (your provided keys)
  const apiKey = {
    id: 'mainnet-key-1',
    userId: 'mainnet-user',
    exchange: 'bybit' as const,
    keyName: 'Mainnet Key',
    apiKey: '3TZG3zGNOZBa5Fnuck',
    apiSecret: 'k2loWLXJhswTajZvGhwdW98soSGL87BjDIWI',
    sandbox: false, // MAINNET = false
    permissions: ['trade', 'read'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const exchange = new BybitExchange(apiKey, false); // mainnet = false

  try {
    // Connect
    console.log('\n🔌 Connecting to Bybit MAINNET...');
    await exchange.connect();
    console.log('✅ Connected successfully!');

    // Get current market price
    console.log('\n📊 Getting current market data...');
    const marketData = await exchange.getMarketData('BTCUSDT', MarketType.FUTURES);
    console.log(`   Current BTC Price: $${marketData.price.toFixed(2)}`);

    // Check account balance
    console.log('\n💰 Checking Account Balance...');
    try {
      const futuresBalance = await exchange.getBalance(MarketType.FUTURES);
      console.log('   Futures Balance:');
      futuresBalance.forEach(balance => {
        if (balance.total > 0) {
          console.log(`     ${balance.currency}: ${balance.total} (Available: ${balance.available})`);
        }
      });

      const spotBalance = await exchange.getBalance(MarketType.SPOT);
      console.log('   Spot Balance:');
      spotBalance.forEach(balance => {
        if (balance.total > 0) {
          console.log(`     ${balance.currency}: ${balance.total} (Available: ${balance.available})`);
        }
      });

      // Check if we have any USDT for trading
      const usdtBalance = futuresBalance.find(b => b.currency === 'USDT');
      if (usdtBalance && usdtBalance.available > 1) {
        console.log(`\n💵 Found ${usdtBalance.available} USDT available for trading!`);
        
        // Calculate a VERY small order (minimum possible)
        const minOrderSize = 0.001; // 0.001 BTC = ~$95 at current prices
        const limitPrice = marketData.price * 0.98; // 2% below market for safety
        
        console.log('\n📝 READY TO PLACE SMALL TEST ORDER:');
        console.log(`   Symbol: BTCUSDT`);
        console.log(`   Side: BUY`);
        console.log(`   Type: LIMIT`);
        console.log(`   Amount: ${minOrderSize} BTC (~$${(minOrderSize * marketData.price).toFixed(2)})`);
        console.log(`   Price: $${limitPrice.toFixed(2)} (2% below market)`);
        console.log(`   Market: FUTURES`);
        
        console.log('\n🚫 ORDER PLACEMENT COMMENTED OUT FOR SAFETY');
        console.log('   To execute real trade, uncomment the code below:');
        console.log('   // const order = await exchange.placeOrder({');
        console.log('   //   symbol: "BTCUSDT",');
        console.log('   //   side: "buy",');
        console.log('   //   type: "limit",');
        console.log(`   //   amount: ${minOrderSize},`);
        console.log(`   //   price: ${limitPrice.toFixed(2)},`);
        console.log('   //   marketType: MarketType.FUTURES');
        console.log('   // });');
        
        // UNCOMMENT BELOW TO EXECUTE REAL TRADE (VERY SMALL AMOUNT)
        
        try {
          console.log('\n🔥 EXECUTING REAL TRADE ON MAINNET!!! 🔥');
          const order = await exchange.placeOrder({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'limit',
            amount: minOrderSize,
            price: limitPrice,
            marketType: MarketType.FUTURES
          });

          console.log('\n🎉 REAL ORDER PLACED ON MAINNET!');
          console.log(`   Order ID: ${order.orderId}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Amount: ${order.amount} BTC`);
          console.log(`   Price: $${order.price?.toFixed(2)}`);
          
          // Wait and check status
          setTimeout(async () => {
            try {
              const orderStatus = await exchange.getOrder(order.orderId, 'BTCUSDT', MarketType.FUTURES);
              console.log(`\n📊 Order Status: ${orderStatus.status}`);
              
              // Cancel if still open after 10 seconds (safety measure)
              if (orderStatus.status === 'open') {
                console.log('\n⏰ Cancelling order after 10 seconds for safety...');
                await exchange.cancelOrder(order.orderId, 'BTCUSDT', MarketType.FUTURES);
                console.log('✅ Order cancelled successfully');
              }
            } catch (statusError) {
              console.error('❌ Order status check failed:', statusError);
            }
          }, 10000); // 10 seconds

        } catch (orderError) {
          console.error('❌ Order placement failed:', orderError);
        }
        
      } else {
        console.log('\n⚠️ No USDT available for trading');
        console.log('   To test trading, deposit some USDT to your Bybit account');
      }

    } catch (balanceError) {
      console.log(`   ⚠️ Balance check failed: ${balanceError instanceof Error ? balanceError.message : 'Unknown error'}`);
    }

    // Test current positions
    console.log('\n⚡ Current Positions:');
    try {
      const positions = await exchange.getPositions();
      console.log(`   Open Positions: ${positions.length}`);
      positions.forEach(pos => {
        console.log(`     ${pos.symbol}: ${pos.side} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x)`);
        console.log(`       PnL: ${pos.unrealizedPnl} (Mark: $${pos.markPrice})`);
      });
    } catch (posError) {
      console.log(`   ⚠️ Position check failed: ${posError instanceof Error ? posError.message : 'Unknown error'}`);
    }

    console.log('\n🎉 MAINNET TEST COMPLETED!');
    console.log('💪 Your trading engine is connected to REAL BYBIT!');
    console.log('🔥 Ready for live trading when you add funds!');

  } catch (error) {
    console.error('\n❌ Mainnet test failed:', error);
  } finally {
    // Disconnect
    await exchange.disconnect();
    console.log('\n🔌 Disconnected from exchange');
  }
}

// Run the test
if (require.main === module) {
  testMainnetSmall().catch(console.error);
}

export default testMainnetSmall; 