import { validateBotConfiguration } from '../../src/validation';

describe('Bot Configuration Validation', () => {
  test('should validate a valid bot configuration', () => {
    const validConfig = {
      id: 'test-bot-1',
      name: 'Test Bot',
      symbol: 'BTC/USDT',
      exchange: 'bybit',
      tradeType: 'futures',
      amount: 0.01,
      leverage: 3,
      strategy: {
        type: 'sma-crossover',
        parameters: {
          fastPeriod: 9,
          slowPeriod: 21,
          priceSource: 'close',
          signalMode: 'crossover',
          useEMA: false
        }
      },
      riskManagement: {
        stopLoss: {
          enabled: true,
          percentage: 2
        },
        takeProfit: {
          enabled: true,
          percentage: 4
        }
      }
    };

    const result = validateBotConfiguration(validConfig);
    expect(result.success).toBe(true);
  });

  test('should reject invalid bot configuration', () => {
    const invalidConfig = {
      id: 'test-bot-1',
      name: '', // Empty name is invalid
      symbol: 'BTC/USDT',
      exchange: 'bybit',
      tradeType: 'futures',
      amount: 0, // Zero amount is invalid
      leverage: 3,
      strategy: {
        type: 'sma-crossover',
        parameters: {
          fastPeriod: 9,
          slowPeriod: 21,
          priceSource: 'close',
          signalMode: 'crossover',
          useEMA: false
        }
      },
      riskManagement: {
        stopLoss: {
          enabled: true,
          percentage: -2 // Negative percentage is invalid
        },
        takeProfit: {
          enabled: true,
          percentage: 4
        }
      }
    };

    const result = validateBotConfiguration(invalidConfig);
    expect(result.success).toBe(false);
    
    // Check that the error contains the specific field errors
    if (!result.success) {
      expect(result.error.errors).toHaveLength(3);
      // Zod returns paths as arrays, so we need to check for array inclusion or convert to string
      const error1Path = Array.isArray(result.error.errors[0].path) ? result.error.errors[0].path : [result.error.errors[0].path];
      const error2Path = Array.isArray(result.error.errors[1].path) ? result.error.errors[1].path : [result.error.errors[1].path];
      const error3Path = Array.isArray(result.error.errors[2].path) ? result.error.errors[2].path : [result.error.errors[2].path];
      
      expect(error1Path).toContain('name');
      expect(error2Path).toContain('amount');
      expect(error3Path).toEqual(['riskManagement', 'stopLoss', 'percentage']);
    }
  });
});
