import { MarketType } from './src/exchanges/base-exchange';
import { BybitExchange } from './src/exchanges/bybit-exchange';

/**
 * 🔥 ORDER VERIFICATION - PROVE THE TRADE! 🔥
 * 
 * This script verifies our recent order and gets proof of execution
 */

async function verifyOrder() {
  console.log('🔍 VERIFYING RECENT ORDER');
  console.log('========================');

  // Real mainnet credentials
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

    // Get recent orders (last 50)
    console.log('\n📋 Getting Recent Orders...');
    try {
      const recentOrders = await exchange.getOrderHistory('BTCUSDT', MarketType.FUTURES);
      console.log(`   Found ${recentOrders.length} recent orders`);
      
      // Show the most recent orders
      console.log('\n🎯 RECENT ORDERS (PROOF):');
      recentOrders.slice(0, 5).forEach((order, index) => {
        console.log(`   ${index + 1}. Order ID: ${order.orderId}`);
        console.log(`      Symbol: ${order.symbol}`);
        console.log(`      Side: ${order.side.toUpperCase()}`);
        console.log(`      Type: ${order.type.toUpperCase()}`);
        console.log(`      Amount: ${order.amount} BTC`);
        console.log(`      Price: $${order.price?.toFixed(2) || 'Market'}`);
        console.log(`      Status: ${order.status.toUpperCase()}`);
        console.log(`      Created: ${order.timestamp ? new Date(order.timestamp).toLocaleString() : 'Unknown'}`);
        console.log(`      Filled: ${order.filled || 0} BTC`);
        console.log(`      Remaining: ${order.remaining || 0} BTC`);
        console.log('      ---');
      });

      // Check for our specific order ID
      const ourOrderId = 'aafa1480-42ea-4563-b017-59f2cc558521';
      const ourOrder = recentOrders.find(order => order.orderId === ourOrderId);
      
      if (ourOrder) {
        console.log('\n🎉 FOUND OUR ORDER!!! PROOF OF EXECUTION:');
        console.log(`   ✅ Order ID: ${ourOrder.orderId}`);
        console.log(`   ✅ Status: ${ourOrder.status.toUpperCase()}`);
        console.log(`   ✅ Amount: ${ourOrder.amount} BTC`);
        console.log(`   ✅ Price: $${ourOrder.price?.toFixed(2)}`);
        console.log(`   ✅ Filled: ${ourOrder.filled || 0} BTC`);
        console.log(`   ✅ Created: ${ourOrder.timestamp ? new Date(ourOrder.timestamp).toLocaleString() : 'Unknown'}`);
      } else {
        console.log('\n⚠️ Our specific order not found in recent history');
        console.log('   This could mean:');
        console.log('   - Order was cancelled automatically');
        console.log('   - Order is too old to appear in recent history');
        console.log('   - Order was executed and removed from active list');
      }

    } catch (historyError) {
      console.error('❌ Failed to get order history:', historyError);
    }

    // Check current open orders
    console.log('\n⚡ Current Open Orders:');
    try {
      const openOrders = await exchange.getOpenOrders('BTCUSDT', MarketType.FUTURES);
      console.log(`   Open Orders: ${openOrders.length}`);
      
      if (openOrders.length > 0) {
        openOrders.forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.orderId} - ${order.side.toUpperCase()} ${order.amount} BTC @ $${order.price?.toFixed(2)}`);
        });
      } else {
        console.log('   No open orders found');
      }
    } catch (openError) {
      console.error('❌ Failed to get open orders:', openError);
    }

    // Check current balance
    console.log('\n💰 Current Balance:');
    try {
      const balance = await exchange.getBalance(MarketType.FUTURES);
      const usdtBalance = balance.find(b => b.currency === 'USDT');
      if (usdtBalance) {
        console.log(`   USDT: ${usdtBalance.total} (Available: ${usdtBalance.available})`);
      }
    } catch (balanceError) {
      console.error('❌ Failed to get balance:', balanceError);
    }

    // Check current positions
    console.log('\n📊 Current Positions:');
    try {
      const positions = await exchange.getPositions();
      console.log(`   Open Positions: ${positions.length}`);
      
      if (positions.length > 0) {
        positions.forEach(pos => {
          console.log(`   ${pos.symbol}: ${pos.side} ${pos.size} @ $${pos.entryPrice} (${pos.leverage}x)`);
          console.log(`     PnL: ${pos.unrealizedPnl} (Mark: $${pos.markPrice})`);
        });
      } else {
        console.log('   No open positions');
      }
    } catch (posError) {
      console.error('❌ Failed to get positions:', posError);
    }

    console.log('\n🎉 VERIFICATION COMPLETED!');

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
  } finally {
    await exchange.disconnect();
    console.log('\n🔌 Disconnected from exchange');
  }
}

// Run the verification
if (require.main === module) {
  verifyOrder().catch(console.error);
}

export default verifyOrder; 