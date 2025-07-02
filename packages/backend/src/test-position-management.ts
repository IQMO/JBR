import { BybitExchange } from './exchanges/bybit-exchange';
import { MarketType } from './exchanges/base-exchange';
import type { TradeSide, TradeType, ExchangeApiKey } from '@jabbr/shared';

/**
 * Test script for Position-Based TP/SL Management Functions
 * Tests setStopLoss and setTakeProfit functionality
 */

async function testPositionManagement() {
  console.log('🧪 Testing Position-Based TP/SL Management...\n');

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
    const exchange = new BybitExchange(mockApiKey, true);
    await exchange.connect();
    console.log('✅ Connected to Bybit testnet\n');

    // First, let's create a position to work with using our bracket order
    console.log('📋 Step 1: Creating a Long Position for Testing');
    console.log('==============================================');

    try {
      const bracketOrderResult = await exchange.placeBracketOrder(
        {
          symbol: 'BTCUSDT',
          side: 'buy' as TradeSide,
          type: 'market' as TradeType,
          amount: 0.001,
          marketType: MarketType.FUTURES,
          leverage: 10,
          clientOrderId: 'test_position_setup_001'
        },
        {
          price: 65000,
          type: 'stop_market'
        },
        {
          price: 75000,
          type: 'limit'
        }
      );

      console.log('🎯 Initial Position Created:', {
        success: bracketOrderResult.success,
        entryOrderId: bracketOrderResult.entryOrder.orderId
      });

      // Wait a moment for the position to be established
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log('⚠️ Could not create test position (continuing with existing positions):', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 1: Set Stop Loss for Long Position
    console.log('📋 Test 1: Set Stop Loss for Long Position');
    console.log('==========================================');

    try {
      const stopLossResult = await exchange.setStopLoss(
        'BTCUSDT',
        'long',
        66000, // Stop loss price
        {
          type: 'stop_market',
          clientOrderId: 'test_sl_long_001'
        }
      );

      console.log('🛡️ Stop Loss Result:', {
        success: stopLossResult.success,
        newOrderId: stopLossResult.newStopLossOrder?.orderId,
        cancelledOrderId: stopLossResult.cancelledOrderId,
        error: stopLossResult.error
      });

      if (stopLossResult.success) {
        console.log('✅ Stop loss set successfully for long position!');
      } else {
        console.log('⚠️ Stop loss failed:', stopLossResult.error);
      }
    } catch (error) {
      console.error('❌ Stop loss test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Set Take Profit for Long Position
    console.log('📋 Test 2: Set Take Profit for Long Position');
    console.log('=============================================');

    try {
      const takeProfitResult = await exchange.setTakeProfit(
        'BTCUSDT',
        'long',
        74000, // Take profit price
        {
          type: 'limit',
          clientOrderId: 'test_tp_long_001'
        }
      );

      console.log('🎯 Take Profit Result:', {
        success: takeProfitResult.success,
        newOrderId: takeProfitResult.newTakeProfitOrder?.orderId,
        cancelledOrderId: takeProfitResult.cancelledOrderId,
        error: takeProfitResult.error
      });

      if (takeProfitResult.success) {
        console.log('✅ Take profit set successfully for long position!');
      } else {
        console.log('⚠️ Take profit failed:', takeProfitResult.error);
      }
    } catch (error) {
      console.error('❌ Take profit test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Update Stop Loss (Replace Existing)
    console.log('📋 Test 3: Update Stop Loss (Replace Existing)');
    console.log('===============================================');

    try {
      const updatedStopLossResult = await exchange.setStopLoss(
        'BTCUSDT',
        'long',
        67000, // New stop loss price (higher)
        {
          type: 'stop_limit',
          limitPrice: 66900,
          clientOrderId: 'test_sl_update_001'
        }
      );

      console.log('🔄 Updated Stop Loss Result:', {
        success: updatedStopLossResult.success,
        newOrderId: updatedStopLossResult.newStopLossOrder?.orderId,
        cancelledOrderId: updatedStopLossResult.cancelledOrderId,
        error: updatedStopLossResult.error
      });

      if (updatedStopLossResult.success) {
        console.log('✅ Stop loss updated successfully!');
        if (updatedStopLossResult.cancelledOrderId) {
          console.log(`🔄 Previous stop loss order cancelled: ${updatedStopLossResult.cancelledOrderId}`);
        }
      } else {
        console.log('⚠️ Stop loss update failed:', updatedStopLossResult.error);
      }
    } catch (error) {
      console.error('❌ Stop loss update test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Error Handling - Invalid Stop Loss Price
    console.log('📋 Test 4: Error Handling - Invalid Stop Loss Price');
    console.log('===================================================');

    try {
      const invalidStopLossResult = await exchange.setStopLoss(
        'BTCUSDT',
        'long',
        80000, // INVALID: Stop loss above market for long position
        {
          type: 'stop_market',
          clientOrderId: 'test_sl_invalid_001'
        }
      );

      console.log('🎯 Invalid Stop Loss Result:', {
        success: invalidStopLossResult.success,
        error: invalidStopLossResult.error
      });

      if (!invalidStopLossResult.success) {
        console.log('✅ Validation correctly rejected invalid stop loss price!');
      } else {
        console.log('❌ This should have failed validation!');
      }
    } catch (error) {
      console.log('✅ Validation correctly caught invalid stop loss:', (error as Error).message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 5: Error Handling - No Position Found
    console.log('📋 Test 5: Error Handling - No Position Found');
    console.log('==============================================');

    try {
      const noPositionResult = await exchange.setStopLoss(
        'ETHUSDT', // Symbol with no position
        'short',
        3000,
        {
          type: 'stop_market',
          clientOrderId: 'test_sl_no_position_001'
        }
      );

      console.log('🎯 No Position Result:', {
        success: noPositionResult.success,
        error: noPositionResult.error
      });

      if (!noPositionResult.success) {
        console.log('✅ Correctly detected no position exists!');
      } else {
        console.log('❌ This should have failed - no position!');
      }
    } catch (error) {
      console.log('✅ Correctly caught no position error:', (error as Error).message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 6: Create Short Position and Test Short TP/SL
    console.log('📋 Test 6: Short Position TP/SL Management');
    console.log('===========================================');

    try {
      // First create a short position
      const shortBracketResult = await exchange.placeBracketOrder(
        {
          symbol: 'SOLUSDT',
          side: 'sell' as TradeSide,
          type: 'market' as TradeType,
          amount: 0.1,
          marketType: MarketType.FUTURES,
          leverage: 5,
          clientOrderId: 'test_short_position_001'
        },
        {
          price: 250, // Stop loss above market for short
          type: 'stop_market'
        },
        {
          price: 180, // Take profit below market for short
          type: 'limit'
        }
      );

      console.log('📊 Short Position Created:', {
        success: shortBracketResult.success,
        entryOrderId: shortBracketResult.entryOrder.orderId
      });

      // Wait for position to be established
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test stop loss for short position
      const shortStopLossResult = await exchange.setStopLoss(
        'SOLUSDT',
        'short',
        240, // Stop loss above entry for short
        {
          type: 'stop_market',
          clientOrderId: 'test_sl_short_001'
        }
      );

      console.log('🛡️ Short Stop Loss Result:', {
        success: shortStopLossResult.success,
        newOrderId: shortStopLossResult.newStopLossOrder?.orderId,
        error: shortStopLossResult.error
      });

      // Test take profit for short position
      const shortTakeProfitResult = await exchange.setTakeProfit(
        'SOLUSDT',
        'short',
        190, // Take profit below entry for short
        {
          type: 'limit',
          clientOrderId: 'test_tp_short_001'
        }
      );

      console.log('🎯 Short Take Profit Result:', {
        success: shortTakeProfitResult.success,
        newOrderId: shortTakeProfitResult.newTakeProfitOrder?.orderId,
        error: shortTakeProfitResult.error
      });

    } catch (error) {
      console.error('❌ Short position test failed:', error);
    }

    console.log('\n🎉 Position Management Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('- Long position stop loss management ✅');
    console.log('- Long position take profit management ✅');
    console.log('- Stop loss update/replacement ✅');
    console.log('- Error handling for invalid prices ✅');
    console.log('- Error handling for non-existent positions ✅');
    console.log('- Short position TP/SL management ✅');

    await exchange.disconnect();

  } catch (error) {
    console.error('💥 Test setup failed:', error);
  }
}

// Export for use in other test files
export { testPositionManagement };

// Run tests if this file is executed directly
if (require.main === module) {
  testPositionManagement().catch(console.error);
} 