import { BybitExchange } from './exchanges/bybit-exchange';
import { MarketType } from './exchanges/base-exchange';
import type { TradeSide, TradeType, ExchangeApiKey } from '@jabbr/shared';

/**
 * MINIMAL & SAFE MAINNET TEST SCRIPT
 *
 * WARNING: This script places a REAL order on Bybit mainnet with a very small amount.
 * Double-check your API key, permissions, and account balance before running.
 *
 * The script will:
 * 1. Connect to Bybit mainnet
 * 2. Place a small market buy order for BTCUSDT (0.0001 BTC)
 * 3. Print the order result
 * 4. Attempt to cancel the order (if possible)
 * 5. Disconnect
 */

async function testMainnetSafe() {
  console.log('⚠️  WARNING: This test will place a REAL order on Bybit mainnet!');
  console.log('⚠️  Use at your own risk. Only a very small amount will be traded.');

  // Support both mainnet and testnet env variable names
  const apiKey = process.env.api_key || process.env.BYBIT_API_KEY;
  const apiSecret = process.env.api_secret || process.env.BYBIT_API_SECRET;

  if (process.env.api_key && process.env.api_secret) {
    console.log('🔑 Using mainnet/private Bybit API keys from api_key/api_secret');
  } else if (process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
    console.log('🔑 Using Bybit API keys from BYBIT_API_KEY/BYBIT_API_SECRET');
  } else {
    console.error('❌ BYBIT_API_KEY/api_key and BYBIT_API_SECRET/api_secret must be set in your environment. Aborting.');
    process.exit(1);
  }

  const mainnetApiKey: ExchangeApiKey = {
    id: 'mainnet-test',
    userId: 'mainnet-test',
    exchange: 'bybit',
    keyName: 'Mainnet Test Key',
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    passphrase: undefined,
    sandbox: false,
    permissions: ['trade', 'read'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Use mainnet (isTestnet = false)
  const exchange = new BybitExchange(mainnetApiKey, false);

  try {
    await exchange.connect();
    console.log('✅ Connected to Bybit mainnet');

    // Place a very small market buy order
    const orderRequest = {
      symbol: 'BTCUSDT',
      side: 'buy' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.0001, // Smallest safe amount
      marketType: MarketType.SPOT,
      clientOrderId: 'mainnet_safe_test_' + Date.now()
    };

    console.log('📝 Placing small market buy order:', orderRequest);
    const orderResult = await exchange.placeOrder(orderRequest);
    console.log('✅ Order placed:', orderResult);

    // Attempt to cancel (should be filled instantly, but for safety)
    try {
      const cancelResult = await exchange.cancelOrder(orderResult.orderId, orderRequest.symbol, MarketType.SPOT);
      console.log('🚫 Cancel order result:', cancelResult);
    } catch (cancelError: any) {
      console.log('ℹ️ Cancel not needed or already filled:', cancelError?.message || cancelError);
    }

  } catch (error) {
    console.error('❌ Error during mainnet test:', error);
  } finally {
    await exchange.disconnect();
    console.log('✅ Disconnected from Bybit mainnet');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testMainnetSafe().catch(console.error);
} 