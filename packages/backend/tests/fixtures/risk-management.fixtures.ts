/**
 * Risk Management Test Fixtures
 * Provides test data for risk management testing
 */

import { PerBotRiskManagement, RiskManagementTemplate, RiskManagementValidationResult } from '@jabbr/shared';

/**
 * Conservative risk management configuration
 */
export const conservativeRiskManagement: PerBotRiskManagement = {
  maxPositionSize: 500,
  maxPositionSizePercent: 2,
  positionSizingMethod: 'percentage',
  stopLossType: 'percentage',
  stopLossValue: 1,
  takeProfitType: 'risk-reward-ratio',
  takeProfitValue: 2,
  maxDailyLoss: 50,
  maxDailyLossPercent: 1,
  maxDrawdown: 5,
  maxConcurrentTrades: 2,
  maxLeverage: 2,
  maxExposure: 1000,
  maxExposurePercent: 10,
  riskScore: 2,
  emergencyStop: false,
  enableRiskManagement: true,
  correlationLimit: 0.5,
  volatilityAdjustment: true,
  timeBasedLimits: {
    enabled: true,
    maxTradesPerHour: 5,
    maxTradesPerDay: 20,
    cooldownPeriodMinutes: 10
  },
  riskMonitoring: {
    enabled: true,
    alertThresholds: {
      dailyLossPercent: 0.8,
      drawdownPercent: 4,
      exposurePercent: 8
    },
    autoReduceExposure: true,
    autoStopTrading: true
  },
  templateName: 'Conservative Trading',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  updatedBy: 'test-user'
};

/**
 * Moderate risk management configuration
 */
export const moderateRiskManagement: PerBotRiskManagement = {
  maxPositionSize: 1000,
  maxPositionSizePercent: 5,
  positionSizingMethod: 'percentage',
  stopLossType: 'percentage',
  stopLossValue: 2,
  takeProfitType: 'risk-reward-ratio',
  takeProfitValue: 2,
  maxDailyLoss: 100,
  maxDailyLossPercent: 2,
  maxDrawdown: 10,
  maxConcurrentTrades: 3,
  maxLeverage: 5,
  maxExposure: 5000,
  maxExposurePercent: 25,
  riskScore: 5,
  emergencyStop: false,
  enableRiskManagement: true,
  correlationLimit: 0.7,
  volatilityAdjustment: true,
  timeBasedLimits: {
    enabled: true,
    maxTradesPerHour: 10,
    maxTradesPerDay: 50,
    cooldownPeriodMinutes: 5
  },
  riskMonitoring: {
    enabled: true,
    alertThresholds: {
      dailyLossPercent: 1.5,
      drawdownPercent: 8,
      exposurePercent: 20
    },
    autoReduceExposure: true,
    autoStopTrading: false
  },
  templateName: 'Moderate Trading',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  updatedBy: 'test-user'
};

/**
 * Aggressive risk management configuration
 */
export const aggressiveRiskManagement: PerBotRiskManagement = {
  maxPositionSize: 5000,
  maxPositionSizePercent: 10,
  positionSizingMethod: 'volatility-adjusted',
  stopLossType: 'percentage',
  stopLossValue: 5,
  takeProfitType: 'risk-reward-ratio',
  takeProfitValue: 3,
  maxDailyLoss: 500,
  maxDailyLossPercent: 5,
  maxDrawdown: 20,
  maxConcurrentTrades: 5,
  maxLeverage: 20,
  maxExposure: 20000,
  maxExposurePercent: 50,
  riskScore: 8,
  emergencyStop: false,
  enableRiskManagement: true,
  correlationLimit: 0.9,
  volatilityAdjustment: true,
  timeBasedLimits: {
    enabled: true,
    maxTradesPerHour: 20,
    maxTradesPerDay: 100,
    cooldownPeriodMinutes: 2
  },
  riskMonitoring: {
    enabled: true,
    alertThresholds: {
      dailyLossPercent: 4,
      drawdownPercent: 15,
      exposurePercent: 40
    },
    autoReduceExposure: false,
    autoStopTrading: false
  },
  templateName: 'Aggressive Trading',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  updatedBy: 'test-user'
};

/**
 * Invalid risk management configuration (for testing validation)
 */
export const invalidRiskManagement: PerBotRiskManagement = {
  maxPositionSize: 1000,
  maxPositionSizePercent: 60, // Invalid: > 50%
  positionSizingMethod: 'percentage',
  stopLossType: 'percentage',
  stopLossValue: 25, // Invalid: > 20%
  takeProfitType: 'risk-reward-ratio',
  takeProfitValue: 2,
  maxDailyLoss: 100,
  maxDailyLossPercent: 15, // Invalid: > 10%
  maxDrawdown: 10,
  maxConcurrentTrades: 3,
  maxLeverage: 500, // Warning: > 100x
  maxExposure: 5000,
  maxExposurePercent: 25,
  riskScore: 2, // Inconsistent with high leverage
  emergencyStop: false,
  enableRiskManagement: true,
  correlationLimit: 0.7,
  volatilityAdjustment: true,
  timeBasedLimits: {
    enabled: true,
    maxTradesPerHour: 10,
    maxTradesPerDay: 50,
    cooldownPeriodMinutes: 5
  },
  riskMonitoring: {
    enabled: true,
    alertThresholds: {
      dailyLossPercent: 1.5,
      drawdownPercent: 8,
      exposurePercent: 20
    },
    autoReduceExposure: true,
    autoStopTrading: false
  },
  templateName: 'Invalid Configuration',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  updatedBy: 'test-user'
};

/**
 * Risk management templates
 */
export const riskManagementTemplates: RiskManagementTemplate[] = [
  {
    id: 'template-conservative',
    name: 'Conservative Trading',
    description: 'Low-risk configuration suitable for beginners and capital preservation',
    category: 'conservative',
    isDefault: true,
    configuration: conservativeRiskManagement,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'template-moderate',
    name: 'Moderate Trading',
    description: 'Balanced risk configuration for experienced traders',
    category: 'moderate',
    isDefault: true,
    configuration: moderateRiskManagement,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'template-aggressive',
    name: 'Aggressive Trading',
    description: 'High-risk configuration for experienced traders seeking maximum returns',
    category: 'aggressive',
    isDefault: true,
    configuration: aggressiveRiskManagement,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  }
];

/**
 * Validation results for different configurations
 */
export const validationResults = {
  conservative: {
    isValid: true,
    errors: [],
    warnings: [],
    riskLevel: 'low' as const,
    recommendations: []
  } as RiskManagementValidationResult,

  moderate: {
    isValid: true,
    errors: [],
    warnings: [],
    riskLevel: 'medium' as const,
    recommendations: []
  } as RiskManagementValidationResult,

  aggressive: {
    isValid: true,
    errors: [],
    warnings: [
      {
        field: 'maxLeverage',
        message: 'Leverage above 10x is considered high risk',
        code: 'HIGH_LEVERAGE',
        impact: 'medium' as const
      }
    ],
    riskLevel: 'high' as const,
    recommendations: [
      'Consider implementing volatility-based position sizing',
      'Enable risk monitoring alerts'
    ]
  } as RiskManagementValidationResult,

  invalid: {
    isValid: false,
    errors: [
      {
        field: 'maxPositionSizePercent',
        message: 'Maximum position size percentage cannot exceed 50%',
        code: 'POSITION_SIZE_TOO_HIGH',
        severity: 'error' as const
      },
      {
        field: 'stopLossValue',
        message: 'Stop loss above 20% may result in significant losses',
        code: 'HIGH_STOP_LOSS',
        severity: 'error' as const
      },
      {
        field: 'maxDailyLossPercent',
        message: 'Daily loss limit above 10% is very aggressive',
        code: 'HIGH_DAILY_LOSS_LIMIT',
        severity: 'error' as const
      }
    ],
    warnings: [
      {
        field: 'maxLeverage',
        message: 'Leverage above 100x is extremely risky',
        code: 'EXTREME_LEVERAGE',
        impact: 'high' as const
      },
      {
        field: 'riskScore',
        message: 'Low risk score with high leverage is inconsistent',
        code: 'INCONSISTENT_RISK_PROFILE',
        impact: 'medium' as const
      }
    ],
    riskLevel: 'extreme' as const,
    recommendations: [
      'Consider reducing leverage and position sizes for better risk management',
      'Enable automatic stop trading when risk limits are exceeded'
    ]
  } as RiskManagementValidationResult
};

/**
 * Database row fixtures for testing
 */
export const databaseFixtures = {
  bot: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '987fcdeb-51a2-43d1-9f12-123456789abc',
    name: 'Test Bot',
    strategy: 'sma-crossover',
    exchange: 'bybit',
    status: 'stopped',
    account_balance: 10000,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },

  user: {
    id: '987fcdeb-51a2-43d1-9f12-123456789abc',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: 'user',
    is_email_verified: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },

  riskManagementConfig: {
    id: 'risk-config-id',
    bot_id: '123e4567-e89b-12d3-a456-426614174000',
    configuration: JSON.stringify(moderateRiskManagement),
    risk_score: 5,
    max_daily_loss: 100,
    max_drawdown: 10,
    max_leverage: 5,
    emergency_stop: false,
    enable_risk_management: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },

  riskManagementTemplate: {
    id: 'template-id',
    name: 'Test Template',
    description: 'Template for testing',
    category: 'custom',
    is_default: false,
    configuration: JSON.stringify(moderateRiskManagement),
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
};

/**
 * Helper functions for creating test data
 */
export const createTestRiskManagement = (overrides: Partial<PerBotRiskManagement> = {}): PerBotRiskManagement => ({
  ...moderateRiskManagement,
  ...overrides,
  lastUpdated: new Date().toISOString()
});

export const createTestTemplate = (overrides: Partial<RiskManagementTemplate> = {}): RiskManagementTemplate => ({
  id: crypto.randomUUID(),
  name: 'Test Template',
  description: 'Template for testing',
  category: 'custom',
  isDefault: false,
  configuration: moderateRiskManagement,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestValidationResult = (
  isValid: boolean = true,
  riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'medium'
): RiskManagementValidationResult => ({
  isValid,
  errors: isValid ? [] : [
    {
      field: 'testField',
      message: 'Test error message',
      code: 'TEST_ERROR',
      severity: 'error'
    }
  ],
  warnings: [],
  riskLevel,
  recommendations: riskLevel === 'extreme' ? [
    'Consider reducing risk parameters'
  ] : []
});
