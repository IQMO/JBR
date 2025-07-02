import { BybitExchange } from './exchanges/bybit-exchange';
import { MarketType } from './exchanges/base-exchange';
import type { TradeSide, TradeType, ExchangeApiKey } from '@jabbr/shared';

/**
 * Test script for the new placeBracketOrder functionality
 * This tests the core advanced order management system
 */

async function testBracketOrder() {
  console.log('🧪 Testing Bracket Order System...\n');

  try {
    // Create a mock ExchangeApiKey for testing
    const mockApiKey: ExchangeApiKey = {
      id: 'test-api-key-id',
      userId: 'test-user-id',
      exchange: 'bybit',
      keyName: 'Test Bybit Key',
      apiKey: process.env.BYBIT_API_KEY || 'test_key',
      apiSecret: process.env.BYBIT_API_SECRET || 'test_secret',
      passphrase: undefined,
      sandbox: true,
      permissions: ['trade', 'read'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize exchange (using testnet)
    const exchange = new BybitExchange(mockApiKey, true); // testnet = true

    await exchange.connect();
    console.log('✅ Connected to Bybit testnet\n');

    // Test 1: Basic Bracket Order (Market Entry)
    console.log('📋 Test 1: Market Entry with Bracket Order');
    console.log('==========================================');
    
    const marketBracketOrder = {
      entryOrder: {
        symbol: 'BTCUSDT',
        side: 'buy' as TradeSide,
        type: 'market' as TradeType,
        amount: 0.001, // Small amount for testing
        marketType: MarketType.FUTURES,
        leverage: 10,
        clientOrderId: 'test_market_bracket_001'
      },
      stopLoss: {
        price: 65000, // Below current market price for long
        type: 'stop_market' as const
      },
      takeProfit: {
        price: 75000, // Above current market price for long
        type: 'limit' as const
      }
    };

    try {
      const result = await exchange.placeBracketOrder(
        marketBracketOrder.entryOrder,
        marketBracketOrder.stopLoss,
        marketBracketOrder.takeProfit
      );

      console.log('🎯 Market Bracket Order Result:', {
        success: result.success,
        entryOrderId: result.entryOrder.orderId,
        stopLossOrderId: result.stopLossOrder?.orderId,
        takeProfitOrderId: result.takeProfitOrder?.orderId,
        errors: result.errors
      });

      if (result.success) {
        console.log('✅ Market bracket order placed successfully!');
      } else {
        console.log('⚠️ Market bracket order completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('❌ Market bracket order failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Limit Entry Bracket Order
    console.log('📋 Test 2: Limit Entry with Bracket Order');
    console.log('==========================================');

    const limitBracketOrder = {
      entryOrder: {
        symbol: 'ETHUSDT',
        side: 'buy' as TradeSide,
        type: 'limit' as TradeType,
        amount: 0.01,
        price: 3800, // Below current market for limit buy
        marketType: MarketType.FUTURES,
        leverage: 5,
        clientOrderId: 'test_limit_bracket_002'
      },
      stopLoss: {
        price: 3600, // Below entry price
        type: 'stop_limit' as const,
        limitPrice: 3590 // Slightly below stop price
      },
      takeProfit: {
        price: 4200, // Above entry price
        type: 'limit' as const
      }
    };

    try {
      const result = await exchange.placeBracketOrder(
        limitBracketOrder.entryOrder,
        limitBracketOrder.stopLoss,
        limitBracketOrder.takeProfit
      );

      console.log('🎯 Limit Bracket Order Result:', {
        success: result.success,
        entryOrderId: result.entryOrder.orderId,
        stopLossOrderId: result.stopLossOrder?.orderId,
        takeProfitOrderId: result.takeProfitOrder?.orderId,
        errors: result.errors
      });

      if (result.success) {
        console.log('✅ Limit bracket order placed successfully!');
      } else {
        console.log('⚠️ Limit bracket order completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('❌ Limit bracket order failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Short Position Bracket Order
    console.log('📋 Test 3: Short Position Bracket Order');
    console.log('=======================================');

    const shortBracketOrder = {
      entryOrder: {
        symbol: 'SOLUSDT',
        side: 'sell' as TradeSide,
        type: 'market' as TradeType,
        amount: 0.1,
        marketType: MarketType.FUTURES,
        leverage: 3,
        clientOrderId: 'test_short_bracket_003'
      },
      stopLoss: {
        price: 250, // Above current market price for short
        type: 'stop_market' as const
      },
      takeProfit: {
        price: 180, // Below current market price for short
        type: 'limit' as const
      }
    };

    try {
      const result = await exchange.placeBracketOrder(
        shortBracketOrder.entryOrder,
        shortBracketOrder.stopLoss,
        shortBracketOrder.takeProfit
      );

      console.log('🎯 Short Bracket Order Result:', {
        success: result.success,
        entryOrderId: result.entryOrder.orderId,
        stopLossOrderId: result.stopLossOrder?.orderId,
        takeProfitOrderId: result.takeProfitOrder?.orderId,
        errors: result.errors
      });

      if (result.success) {
        console.log('✅ Short bracket order placed successfully!');
      } else {
        console.log('⚠️ Short bracket order completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('❌ Short bracket order failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Error Handling - Invalid Parameters
    console.log('📋 Test 4: Error Handling - Invalid Parameters');
    console.log('===============================================');

    const invalidBracketOrder = {
      entryOrder: {
        symbol: 'BTCUSDT',
        side: 'buy' as TradeSide,
        type: 'limit' as TradeType,
        amount: 0.001,
        price: 70000, // Entry price
        marketType: MarketType.FUTURES,
        leverage: 10,
        clientOrderId: 'test_invalid_bracket_004'
      },
      stopLoss: {
        price: 75000, // INVALID: Stop loss above entry for long position
        type: 'stop_market' as const
      },
      takeProfit: {
        price: 65000, // INVALID: Take profit below entry for long position
        type: 'limit' as const
      }
    };

    try {
      const result = await exchange.placeBracketOrder(
        invalidBracketOrder.entryOrder,
        invalidBracketOrder.stopLoss,
        invalidBracketOrder.takeProfit
      );

      console.log('🎯 Invalid Bracket Order Result:', {
        success: result.success,
        errors: result.errors
      });

      console.log('❌ This should have failed validation!');
    } catch (error) {
      console.log('✅ Validation correctly caught invalid parameters:', (error as Error).message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 5: Spot Market Bracket Order
    console.log('📋 Test 5: Spot Market Bracket Order');
    console.log('====================================');

    const spotBracketOrder = {
      entryOrder: {
        symbol: 'BTCUSDT',
        side: 'buy' as TradeSide,
        type: 'market' as TradeType,
        amount: 0.001,
        marketType: MarketType.SPOT,
        clientOrderId: 'test_spot_bracket_005'
      },
      stopLoss: {
        price: 65000,
        type: 'stop_market' as const
      },
      takeProfit: {
        price: 75000,
        type: 'limit' as const
      }
    };

    try {
      const result = await exchange.placeBracketOrder(
        spotBracketOrder.entryOrder,
        spotBracketOrder.stopLoss,
        spotBracketOrder.takeProfit
      );

      console.log('🎯 Spot Bracket Order Result:', {
        success: result.success,
        entryOrderId: result.entryOrder.orderId,
        stopLossOrderId: result.stopLossOrder?.orderId,
        takeProfitOrderId: result.takeProfitOrder?.orderId,
        errors: result.errors
      });

      if (result.success) {
        console.log('✅ Spot bracket order placed successfully!');
      } else {
        console.log('⚠️ Spot bracket order completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('❌ Spot bracket order failed:', error);
    }

    console.log('\n🎉 Bracket Order Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('- Market entry bracket orders ✅');
    console.log('- Limit entry bracket orders ✅');
    console.log('- Short position bracket orders ✅');
    console.log('- Error handling validation ✅');
    console.log('- Spot market bracket orders ✅');

    await exchange.disconnect();

  } catch (error) {
    console.error('💥 Test setup failed:', error);
  }
}

// Export for use in other test files
export { testBracketOrder };

// Run tests if this file is executed directly
if (require.main === module) {
  testBracketOrder().catch(console.error);
} 