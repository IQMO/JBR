/**
 * Risk Management Service Unit Tests
 * Tests for per-bot risk management configuration functionality
 */

import { RiskManagementService } from '../../../src/risk-management/risk-management.service';
import { DatabaseManager } from '../../../src/database/database.config';
import { PerBotRiskManagement, RiskManagementValidationResult } from '@jabbr/shared';

// Mock the DatabaseManager
jest.mock('../../../src/database/database.config');

describe('RiskManagementService', () => {
  let service: RiskManagementService;
  let mockDb: jest.Mocked<DatabaseManager>;

  const mockBotId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '987fcdeb-51a2-43d1-9f12-123456789abc';

  const mockRiskManagement: PerBotRiskManagement = {
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
    templateName: 'Custom Template',
    lastUpdated: '2025-01-01T00:00:00.000Z',
    updatedBy: mockUserId
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock database manager
    mockDb = {
      query: jest.fn(),
      queryOne: jest.fn(),
      transaction: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getClient: jest.fn(),
      healthCheck: jest.fn(),
      getConfig: jest.fn(),
      isConnectionActive: jest.fn()
    } as any;

    // Mock the DatabaseManager constructor
    (DatabaseManager as jest.MockedClass<typeof DatabaseManager>).mockImplementation(() => mockDb);

    service = new RiskManagementService();
  });

  describe('getBotRiskManagement', () => {
    it('should return existing risk management configuration', async () => {
      // Mock bot exists
      mockDb.query.mockResolvedValueOnce([
        { id: mockBotId, user_id: mockUserId }
      ]);

      // Mock risk management configuration exists
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'risk-config-id',
          bot_id: mockBotId,
          configuration: JSON.stringify(mockRiskManagement),
          risk_score: 5,
          max_daily_loss: 100,
          max_drawdown: 10,
          max_leverage: 5,
          emergency_stop: false,
          enable_risk_management: true
        }
      ]);

      const result = await service.getBotRiskManagement(mockBotId);

      expect(result).toEqual(mockRiskManagement);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1, 'SELECT id, user_id FROM bots WHERE id = $1', [mockBotId]);
      expect(mockDb.query).toHaveBeenNthCalledWith(2, 'SELECT * FROM bot_risk_management WHERE bot_id = $1', [mockBotId]);
    });

    it('should return default configuration when no risk management exists', async () => {
      // Mock bot exists
      mockDb.query.mockResolvedValueOnce([
        { id: mockBotId, user_id: mockUserId }
      ]);

      // Mock no risk management configuration
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getBotRiskManagement(mockBotId);

      expect(result).toBeDefined();
      expect(result.riskScore).toBe(3); // Default conservative score
      expect(result.maxPositionSizePercent).toBe(5); // Default conservative percentage
      expect(result.enableRiskManagement).toBe(true);
      expect(result.updatedBy).toBe(mockUserId);
    });

    it('should throw error when bot does not exist', async () => {
      // Mock bot does not exist
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getBotRiskManagement(mockBotId)).rejects.toThrow(
        `Bot with ID ${mockBotId} not found`
      );

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateBotRiskManagement', () => {
    it('should update existing risk management configuration', async () => {
      // Mock bot exists
      mockDb.query.mockResolvedValueOnce([
        { id: mockBotId, user_id: mockUserId, account_balance: 10000 }
      ]);

      // Mock existing configuration
      mockDb.query.mockResolvedValueOnce([
        { id: 'existing-config-id' }
      ]);

      // Mock successful update
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'existing-config-id',
          bot_id: mockBotId,
          configuration: JSON.stringify(mockRiskManagement),
          risk_score: 5,
          max_daily_loss: 100,
          max_drawdown: 10,
          max_leverage: 5,
          emergency_stop: false,
          enable_risk_management: true
        }
      ]);

      const result = await service.updateBotRiskManagement(mockBotId, mockRiskManagement, mockUserId);

      expect(result.riskManagement).toMatchObject({
        ...mockRiskManagement,
        lastUpdated: expect.any(String),
        updatedBy: mockUserId
      });
      expect(result.validation.isValid).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should create new risk management configuration when none exists', async () => {
      // Mock bot exists
      mockDb.query.mockResolvedValueOnce([
        { id: mockBotId, user_id: mockUserId, account_balance: 10000 }
      ]);

      // Mock no existing configuration
      mockDb.query.mockResolvedValueOnce([]);

      // Mock successful insert
      mockDb.query.mockResolvedValueOnce([
        {
          id: 'new-config-id',
          bot_id: mockBotId,
          configuration: JSON.stringify(mockRiskManagement),
          risk_score: 5,
          max_daily_loss: 100,
          max_drawdown: 10,
          max_leverage: 5,
          emergency_stop: false,
          enable_risk_management: true
        }
      ]);

      const result = await service.updateBotRiskManagement(mockBotId, mockRiskManagement, mockUserId);

      expect(result.riskManagement).toMatchObject({
        ...mockRiskManagement,
        lastUpdated: expect.any(String),
        updatedBy: mockUserId
      });
      expect(result.validation.isValid).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error when validation fails', async () => {
      // Mock bot exists
      mockDb.query.mockResolvedValueOnce([
        { id: mockBotId, user_id: mockUserId, account_balance: 10000 }
      ]);

      // Create invalid risk management (position size too high)
      const invalidRiskManagement = {
        ...mockRiskManagement,
        maxPositionSizePercent: 60 // Invalid: > 50%
      };

      await expect(
        service.updateBotRiskManagement(mockBotId, invalidRiskManagement, mockUserId)
      ).rejects.toThrow('Risk management validation failed');

      expect(mockDb.query).toHaveBeenCalledTimes(1); // Only bot lookup
    });

    it('should throw error when bot does not exist', async () => {
      // Mock bot does not exist
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.updateBotRiskManagement(mockBotId, mockRiskManagement, mockUserId)
      ).rejects.toThrow(`Bot with ID ${mockBotId} not found`);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateRiskManagement', () => {
    it('should validate valid risk management configuration', async () => {
      const result = await service.validateRiskManagement({
        riskManagement: mockRiskManagement,
        botId: mockBotId,
        accountBalance: 10000
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.riskLevel).toBe('medium');
    });

    it('should detect high position size errors', async () => {
      const highRiskConfig = {
        ...mockRiskManagement,
        maxPositionSizePercent: 60 // > 50%
      };

      const result = await service.validateRiskManagement({
        riskManagement: highRiskConfig
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('maxPositionSizePercent');
      expect(result.errors[0].severity).toBe('error');
    });

    it('should detect high leverage warnings', async () => {
      const highLeverageConfig = {
        ...mockRiskManagement,
        maxLeverage: 150 // > 100x
      };

      const result = await service.validateRiskManagement({
        riskManagement: highLeverageConfig
      });

      expect(result.isValid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].field).toBe('maxLeverage');
      expect(result.warnings[0].impact).toBe('high');
    });

    it('should classify risk levels correctly', async () => {
      // Test extreme risk
      const extremeRiskConfig = {
        ...mockRiskManagement,
        riskScore: 9,
        maxLeverage: 100,
        maxPositionSizePercent: 40
      };

      const extremeResult = await service.validateRiskManagement({
        riskManagement: extremeRiskConfig
      });

      expect(extremeResult.riskLevel).toBe('extreme');

      // Test low risk
      const lowRiskConfig = {
        ...mockRiskManagement,
        riskScore: 2,
        maxLeverage: 2,
        maxPositionSizePercent: 3
      };

      const lowResult = await service.validateRiskManagement({
        riskManagement: lowRiskConfig
      });

      expect(lowResult.riskLevel).toBe('low');
    });

    it('should provide recommendations for extreme risk', async () => {
      const extremeRiskConfig = {
        ...mockRiskManagement,
        riskScore: 10,
        maxLeverage: 200,
        maxPositionSizePercent: 45
      };

      const result = await service.validateRiskManagement({
        riskManagement: extremeRiskConfig
      });

      expect(result.riskLevel).toBe('extreme');
      expect(result.recommendations).toContain(
        'Consider reducing leverage and position sizes for better risk management'
      );
      expect(result.recommendations).toContain(
        'Enable automatic stop trading when risk limits are exceeded'
      );
    });
  });

  describe('getRiskManagementTemplates', () => {
    it('should return all risk management templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Conservative',
          description: 'Low risk template',
          category: 'conservative',
          is_default: true,
          configuration: JSON.stringify(mockRiskManagement),
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        },
        {
          id: 'template-2',
          name: 'Aggressive',
          description: 'High risk template',
          category: 'aggressive',
          is_default: false,
          configuration: JSON.stringify(mockRiskManagement),
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        }
      ];

      mockDb.query.mockResolvedValueOnce(mockTemplates);

      const result = await service.getRiskManagementTemplates();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Conservative');
      expect(result[0].isDefault).toBe(true);
      expect(result[1].name).toBe('Aggressive');
      expect(result[1].isDefault).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM risk_management_templates')
      );
    });

    it('should return empty array when no templates exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getRiskManagementTemplates();

      expect(result).toHaveLength(0);
    });
  });

  describe('createRiskManagementTemplate', () => {
    const templateRequest = {
      name: 'Custom Template',
      description: 'Custom risk management template',
      category: 'custom' as const,
      configuration: mockRiskManagement
    };

    it('should create new risk management template', async () => {
      const mockCreatedTemplate = {
        id: 'new-template-id',
        name: templateRequest.name,
        description: templateRequest.description,
        category: templateRequest.category,
        is_default: false,
        configuration: JSON.stringify(mockRiskManagement),
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      };

      mockDb.query.mockResolvedValueOnce([mockCreatedTemplate]);

      const result = await service.createRiskManagementTemplate(templateRequest, mockUserId);

      expect(result.name).toBe(templateRequest.name);
      expect(result.description).toBe(templateRequest.description);
      expect(result.category).toBe(templateRequest.category);
      expect(result.isDefault).toBe(false);
      expect(result.configuration).toMatchObject({
        ...mockRiskManagement,
        lastUpdated: expect.any(String),
        updatedBy: mockUserId,
        templateName: templateRequest.name
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO risk_management_templates'),
        expect.arrayContaining([
          expect.any(String), // UUID
          templateRequest.name,
          templateRequest.description,
          templateRequest.category,
          false,
          expect.any(String) // JSON configuration
        ])
      );
    });

    it('should throw error when template configuration is invalid', async () => {
      const invalidTemplateRequest = {
        ...templateRequest,
        configuration: {
          ...mockRiskManagement,
          maxPositionSizePercent: 70 // Invalid
        }
      };

      await expect(
        service.createRiskManagementTemplate(invalidTemplateRequest, mockUserId)
      ).rejects.toThrow('Template configuration validation failed');

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
