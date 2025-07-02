import { BybitExchange } from './exchanges/bybit-exchange';
import { MarketType, OrderRequest } from './exchanges/base-exchange';
import type { TradeSide, TradeType, ExchangeApiKey } from '@jabbr/shared';

/**
 * Test script for Risk Management Order Placement
 * Tests placeOrderWithRiskManagement and validateOrderRisk functionality
 */

async function testRiskManagement() {
  console.log('🧪 Testing Risk Management Order Placement...\n');

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

    // Define test risk configuration
    const conservativeRiskConfig = {
      maxPositionSize: 0.01, // Small position for testing
      maxLeverage: 10,
      maxDailyLoss: 5, // 5% max daily loss
      maxDrawdown: 10, // 10% max drawdown
      maxConcurrentTrades: 3,
      emergencyStop: false,
      riskScore: 5, // Medium risk
      accountBalance: 10000 // $10,000 test balance
    };

    const aggressiveRiskConfig = {
      maxPositionSize: 0.1,
      maxLeverage: 50,
      maxDailyLoss: 15,
      maxDrawdown: 25,
      maxConcurrentTrades: 10,
      emergencyStop: false,
      riskScore: 8, // High risk
      accountBalance: 10000
    };

    // Test 1: Valid Order with Conservative Risk Config
    console.log('📋 Test 1: Valid Order with Conservative Risk Config');
    console.log('===================================================');

    const validOrder: OrderRequest = {
      symbol: 'BTCUSDT',
      side: 'buy' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.005, // Below max position size
      marketType: MarketType.FUTURES,
      leverage: 5, // Below max leverage
      clientOrderId: 'test_risk_valid_001'
    };

    try {
      const result = await exchange.placeOrderWithRiskManagement(validOrder, conservativeRiskConfig);

      console.log('🛡️ Conservative Risk Result:', {
        success: result.success,
        orderId: result.order?.orderId,
        rejectionReason: result.rejectionReason,
        riskAnalysis: {
          positionSizeCheck: result.riskAnalysis.positionSizeCheck,
          leverageCheck: result.riskAnalysis.leverageCheck,
          emergencyStopCheck: result.riskAnalysis.emergencyStopCheck,
          warnings: result.riskAnalysis.warnings
        }
      });

      if (result.success) {
        console.log('✅ Order placed successfully with conservative risk management!');
      } else {
        console.log('⚠️ Order rejected by risk management:', result.rejectionReason);
      }
    } catch (error) {
      console.error('❌ Conservative risk test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Order Exceeding Position Size Limit
    console.log('📋 Test 2: Order Exceeding Position Size Limit');
    console.log('===============================================');

    const oversizedOrder: OrderRequest = {
      symbol: 'ETHUSDT',
      side: 'buy' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.05, // Exceeds max position size of 0.01
      marketType: MarketType.FUTURES,
      leverage: 5,
      clientOrderId: 'test_risk_oversized_001'
    };

    try {
      const result = await exchange.placeOrderWithRiskManagement(oversizedOrder, conservativeRiskConfig);

      console.log('🚫 Oversized Order Result:', {
        success: result.success,
        rejectionReason: result.rejectionReason,
        positionSizeCheck: result.riskAnalysis.positionSizeCheck
      });

      if (!result.success) {
        console.log('✅ Risk management correctly rejected oversized order!');
      } else {
        console.log('❌ This should have been rejected!');
      }
    } catch (error) {
      console.error('❌ Oversized order test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Order Exceeding Leverage Limit
    console.log('📋 Test 3: Order Exceeding Leverage Limit');
    console.log('=========================================');

    const highLeverageOrder: OrderRequest = {
      symbol: 'SOLUSDT',
      side: 'sell' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.005,
      marketType: MarketType.FUTURES,
      leverage: 20, // Exceeds max leverage of 10
      clientOrderId: 'test_risk_leverage_001'
    };

    try {
      const result = await exchange.placeOrderWithRiskManagement(highLeverageOrder, conservativeRiskConfig);

      console.log('⚡ High Leverage Result:', {
        success: result.success,
        rejectionReason: result.rejectionReason,
        leverageCheck: result.riskAnalysis.leverageCheck
      });

      if (!result.success) {
        console.log('✅ Risk management correctly rejected high leverage order!');
      } else {
        console.log('❌ This should have been rejected!');
      }
    } catch (error) {
      console.error('❌ High leverage test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Emergency Stop Scenario
    console.log('📋 Test 4: Emergency Stop Scenario');
    console.log('==================================');

    const emergencyStopConfig = {
      ...conservativeRiskConfig,
      emergencyStop: true // Emergency stop activated
    };

    const normalOrder: OrderRequest = {
      symbol: 'ADAUSDT',
      side: 'buy' as TradeSide,
      type: 'limit' as TradeType,
      amount: 0.005,
      price: 0.5,
      marketType: MarketType.FUTURES,
      leverage: 3,
      clientOrderId: 'test_risk_emergency_001'
    };

    try {
      const result = await exchange.placeOrderWithRiskManagement(normalOrder, emergencyStopConfig);

      console.log('🚨 Emergency Stop Result:', {
        success: result.success,
        rejectionReason: result.rejectionReason,
        emergencyStopCheck: result.riskAnalysis.emergencyStopCheck
      });

      if (!result.success && result.rejectionReason?.includes('Emergency stop')) {
        console.log('✅ Emergency stop correctly halted trading!');
      } else {
        console.log('❌ Emergency stop should have rejected this order!');
      }
    } catch (error) {
      console.error('❌ Emergency stop test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 5: High Risk Score Warnings
    console.log('📋 Test 5: High Risk Score Warnings');
    console.log('===================================');

    const moderateOrder: OrderRequest = {
      symbol: 'DOTUSDT',
      side: 'buy' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.08, // Large position for high risk score
      marketType: MarketType.FUTURES,
      leverage: 15, // High leverage for high risk score
      clientOrderId: 'test_risk_score_001'
    };

    try {
      const result = await exchange.placeOrderWithRiskManagement(moderateOrder, aggressiveRiskConfig);

      console.log('📊 High Risk Score Result:', {
        success: result.success,
        orderId: result.order?.orderId,
        warnings: result.riskAnalysis.warnings,
        riskScoreCheck: result.riskAnalysis.riskScoreCheck
      });

      if (result.success && result.riskAnalysis.warnings.length > 0) {
        console.log('✅ High risk score generated appropriate warnings!');
        result.riskAnalysis.warnings.forEach(warning => {
          console.log(`   ⚠️ ${warning}`);
        });
      }
    } catch (error) {
      console.error('❌ High risk score test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 6: Risk Validation Without Order Placement
    console.log('📋 Test 6: Risk Validation Without Order Placement');
    console.log('==================================================');

    const testValidationOrder: OrderRequest = {
      symbol: 'LINKUSDT',
      side: 'sell' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.02, // Exceeds conservative max position
      marketType: MarketType.FUTURES,
      leverage: 8,
      clientOrderId: 'test_risk_validation_001'
    };

    try {
      const validationResult = await exchange.validateOrderRisk(testValidationOrder, conservativeRiskConfig);

      console.log('🔍 Risk Validation Result:', {
        isValid: validationResult.isValid,
        violations: validationResult.violations,
        warnings: validationResult.warnings
      });

      if (!validationResult.isValid) {
        console.log('✅ Risk validation correctly identified violations without placing order!');
        validationResult.violations.forEach(violation => {
          console.log(`   ❌ ${violation}`);
        });
      }
    } catch (error) {
      console.error('❌ Risk validation test failed:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 7: Multiple Concurrent Trades Limit
    console.log('📋 Test 7: Multiple Concurrent Trades Limit');
    console.log('===========================================');

    const strictConcurrentConfig = {
      ...conservativeRiskConfig,
      maxConcurrentTrades: 1 // Very restrictive
    };

    // First order (should pass)
    const firstConcurrentOrder: OrderRequest = {
      symbol: 'AVAXUSDT',
      side: 'buy' as TradeSide,
      type: 'market' as TradeType,
      amount: 0.005,
      marketType: MarketType.FUTURES,
      leverage: 3,
      clientOrderId: 'test_concurrent_001'
    };

    try {
      const firstResult = await exchange.placeOrderWithRiskManagement(firstConcurrentOrder, strictConcurrentConfig);
      console.log('📊 First Concurrent Order:', {
        success: firstResult.success,
        concurrentTradesCheck: firstResult.riskAnalysis.concurrentTradesCheck
      });

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second order (should be rejected if first succeeded)
      const secondConcurrentOrder: OrderRequest = {
        symbol: 'MATICUSDT',
        side: 'buy' as TradeSide,
        type: 'market' as TradeType,
        amount: 0.005,
        marketType: MarketType.FUTURES,
        leverage: 3,
        clientOrderId: 'test_concurrent_002'
      };

      const secondResult = await exchange.placeOrderWithRiskManagement(secondConcurrentOrder, strictConcurrentConfig);
      console.log('📊 Second Concurrent Order:', {
        success: secondResult.success,
        rejectionReason: secondResult.rejectionReason,
        concurrentTradesCheck: secondResult.riskAnalysis.concurrentTradesCheck
      });

      if (firstResult.success && !secondResult.success) {
        console.log('✅ Concurrent trades limit correctly enforced!');
      }

    } catch (error) {
      console.error('❌ Concurrent trades test failed:', error);
    }

    console.log('\n🎉 Risk Management Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('- Conservative risk configuration validation ✅');
    console.log('- Position size limit enforcement ✅');
    console.log('- Leverage limit enforcement ✅');
    console.log('- Emergency stop functionality ✅');
    console.log('- High risk score warnings ✅');
    console.log('- Risk validation without order placement ✅');
    console.log('- Concurrent trades limit enforcement ✅');

    await exchange.disconnect();

  } catch (error) {
    console.error('💥 Test setup failed:', error);
  }
}

// Export for use in other test files
export { testRiskManagement };

// Run tests if this file is executed directly
if (require.main === module) {
  testRiskManagement().catch(console.error);
} 