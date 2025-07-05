import { DatabaseManager } from '../database/database.config';
import { 
  PerBotRiskManagement, 
  RiskManagementTemplate, 
  RiskManagementValidationResult,
  RiskValidationError,
  RiskValidationWarning,
  CreateRiskManagementTemplateRequest,
  ValidateRiskManagementRequest
} from '@jabbr/shared';
export class RiskManagementService {
  private db: DatabaseManager;

  constructor() {
    this.db = new DatabaseManager();
  }

  /**
   * Ensure database connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.db.isConnectionActive()) {
      await this.db.connect();
    }
  }

  /**
   * Get risk management configuration for a specific bot
   */
  async getBotRiskManagement(botId: string): Promise<PerBotRiskManagement> {
    console.log(`Getting risk management for bot: ${botId}`);
    await this.ensureConnection();

    // Check if bot exists
    const botQuery = 'SELECT id, user_id FROM bots WHERE id = $1';
    const botResult = await this.db.query(botQuery, [botId]);

    if (botResult.length === 0) {
      throw new Error(`Bot with ID ${botId} not found`);
    }

    const bot = botResult[0];

    // Get risk management configuration
    const riskQuery = 'SELECT * FROM bot_risk_management WHERE bot_id = $1';
    const riskResult = await this.db.query(riskQuery, [botId]);

    if (riskResult.length === 0) {
      // Return default risk management configuration
      return this.getDefaultRiskManagement(bot.user_id);
    }

    return this.mapRowToRiskManagement(riskResult[0]);
  }

  /**
   * Update risk management configuration for a specific bot
   */
  async updateBotRiskManagement(
    botId: string,
    riskManagement: PerBotRiskManagement,
    userId: string
  ): Promise<{ riskManagement: PerBotRiskManagement; validation: RiskManagementValidationResult }> {
    console.log(`Updating risk management for bot: ${botId}`);
    await this.ensureConnection();

    // Check if bot exists and get account balance
    const botQuery = 'SELECT id, user_id, account_balance FROM bots WHERE id = $1';
    const botResult = await this.db.query(botQuery, [botId]);

    if (botResult.length === 0) {
      throw new Error(`Bot with ID ${botId} not found`);
    }

    const bot = botResult[0];

    // Validate the risk management configuration
    const validation = await this.validateRiskManagement({
      riskManagement,
      botId,
      accountBalance: bot.account_balance
    });

    if (!validation.isValid) {
      const errorMessages = validation.errors
        .filter(e => e.severity === 'error')
        .map(e => e.message);
      throw new Error(`Risk management validation failed: ${errorMessages.join(', ')}`);
    }

    // Update metadata
    riskManagement.lastUpdated = new Date().toISOString();
    riskManagement.updatedBy = userId;

    // Check if configuration exists
    const existingQuery = 'SELECT id FROM bot_risk_management WHERE bot_id = $1';
    const existingResult = await this.db.query(existingQuery, [botId]);

    const configData = this.mapRiskManagementToDbFields(riskManagement);

    if (existingResult.length > 0) {
      // Update existing configuration
      const updateQuery = `
        UPDATE bot_risk_management
        SET configuration = $1, risk_score = $2, max_daily_loss = $3,
            max_drawdown = $4, max_leverage = $5, emergency_stop = $6,
            enable_risk_management = $7, updated_at = NOW()
        WHERE bot_id = $8
        RETURNING *
      `;
      const updateResult = await this.db.query(updateQuery, [
        configData.configuration, configData.riskScore, configData.maxDailyLoss,
        configData.maxDrawdown, configData.maxLeverage, configData.emergencyStop,
        configData.enableRiskManagement, botId
      ]);

      console.log(`Risk management updated successfully for bot: ${botId}`);

      return {
        riskManagement: this.mapRowToRiskManagement(updateResult[0]),
        validation
      };
    } else {
      // Create new configuration
      const insertQuery = `
        INSERT INTO bot_risk_management
        (id, bot_id, configuration, risk_score, max_daily_loss, max_drawdown,
         max_leverage, emergency_stop, enable_risk_management, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `;
      const insertResult = await this.db.query(insertQuery, [
        crypto.randomUUID(), botId, configData.configuration, configData.riskScore,
        configData.maxDailyLoss, configData.maxDrawdown, configData.maxLeverage,
        configData.emergencyStop, configData.enableRiskManagement
      ]);

      console.log(`Risk management created successfully for bot: ${botId}`);

      return {
        riskManagement: this.mapRowToRiskManagement(insertResult[0]),
        validation
      };
    }
  }

  /**
   * Validate risk management configuration
   */
  async validateRiskManagement(request: ValidateRiskManagementRequest): Promise<RiskManagementValidationResult> {
    const { riskManagement, botId, accountBalance } = request;
    const errors: RiskValidationError[] = [];
    const warnings: RiskValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate position sizing
    if (riskManagement.maxPositionSizePercent > 50) {
      errors.push({
        field: 'maxPositionSizePercent',
        message: 'Maximum position size percentage cannot exceed 50%',
        code: 'POSITION_SIZE_TOO_HIGH',
        severity: 'error'
      });
    }

    if (riskManagement.maxPositionSizePercent > 25) {
      warnings.push({
        field: 'maxPositionSizePercent',
        message: 'Position size above 25% is considered high risk',
        code: 'HIGH_POSITION_SIZE',
        impact: 'high'
      });
    }

    // Validate leverage
    if (riskManagement.maxLeverage > 100) {
      warnings.push({
        field: 'maxLeverage',
        message: 'Leverage above 100x is extremely risky',
        code: 'EXTREME_LEVERAGE',
        impact: 'high'
      });
    }

    // Validate stop loss
    if (riskManagement.stopLossValue > 20 && riskManagement.stopLossType === 'percentage') {
      warnings.push({
        field: 'stopLossValue',
        message: 'Stop loss above 20% may result in significant losses',
        code: 'HIGH_STOP_LOSS',
        impact: 'medium'
      });
    }

    // Validate risk score consistency
    if (riskManagement.riskScore <= 3 && riskManagement.maxLeverage > 10) {
      warnings.push({
        field: 'riskScore',
        message: 'Low risk score with high leverage is inconsistent',
        code: 'INCONSISTENT_RISK_PROFILE',
        impact: 'medium'
      });
    }

    // Validate daily loss limits
    if (riskManagement.maxDailyLossPercent > 10) {
      warnings.push({
        field: 'maxDailyLossPercent',
        message: 'Daily loss limit above 10% is very aggressive',
        code: 'HIGH_DAILY_LOSS_LIMIT',
        impact: 'high'
      });
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';
    
    if (riskManagement.riskScore >= 8 || riskManagement.maxLeverage > 50 || riskManagement.maxPositionSizePercent > 30) {
      riskLevel = 'extreme';
    } else if (riskManagement.riskScore >= 6 || riskManagement.maxLeverage > 20 || riskManagement.maxPositionSizePercent > 20) {
      riskLevel = 'high';
    } else if (riskManagement.riskScore >= 4 || riskManagement.maxLeverage > 5 || riskManagement.maxPositionSizePercent > 10) {
      riskLevel = 'medium';
    }

    // Generate recommendations based on risk level
    if (riskLevel === 'extreme') {
      recommendations.push('Consider reducing leverage and position sizes for better risk management');
      recommendations.push('Enable automatic stop trading when risk limits are exceeded');
    } else if (riskLevel === 'high') {
      recommendations.push('Consider implementing volatility-based position sizing');
      recommendations.push('Enable risk monitoring alerts');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskLevel,
      recommendations
    };
  }

  /**
   * Get all risk management templates
   */
  async getRiskManagementTemplates(): Promise<RiskManagementTemplate[]> {
    console.log('Getting all risk management templates');
    await this.ensureConnection();

    const query = `
      SELECT * FROM risk_management_templates
      ORDER BY is_default DESC, category ASC, name ASC
    `;
    const result = await this.db.query(query);

    return result.map(row => this.mapTemplateRowToTemplate(row));
  }

  /**
   * Create a new risk management template
   */
  async createRiskManagementTemplate(
    request: CreateRiskManagementTemplateRequest,
    userId: string
  ): Promise<RiskManagementTemplate> {
    console.log(`Creating risk management template: ${request.name}`);
    await this.ensureConnection();

    // Validate the configuration
    const validation = await this.validateRiskManagement({
      riskManagement: request.configuration
    });

    if (!validation.isValid) {
      const errorMessages = validation.errors
        .filter(e => e.severity === 'error')
        .map(e => e.message);
      throw new Error(`Template configuration validation failed: ${errorMessages.join(', ')}`);
    }

    // Set metadata for the configuration
    request.configuration.lastUpdated = new Date().toISOString();
    request.configuration.updatedBy = userId;
    request.configuration.templateName = request.name;

    const templateId = crypto.randomUUID();
    const insertQuery = `
      INSERT INTO risk_management_templates
      (id, name, description, category, is_default, configuration, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;

    const result = await this.db.query(insertQuery, [
      templateId,
      request.name,
      request.description,
      request.category,
      false,
      JSON.stringify(request.configuration)
    ]);

    console.log(`Risk management template created: ${templateId}`);

    return this.mapTemplateRowToTemplate(result[0]);
  }

  /**
   * Get default risk management configuration
   */
  private getDefaultRiskManagement(userId: string): PerBotRiskManagement {
    return {
      // Position sizing
      maxPositionSize: 1000,
      maxPositionSizePercent: 5,
      positionSizingMethod: 'percentage',
      
      // Stop loss and take profit
      stopLossType: 'percentage',
      stopLossValue: 2,
      takeProfitType: 'risk-reward-ratio',
      takeProfitValue: 2,
      
      // Risk limits
      maxDailyLoss: 100,
      maxDailyLossPercent: 2,
      maxDrawdown: 10,
      maxConcurrentTrades: 3,
      
      // Leverage and exposure
      maxLeverage: 5,
      maxExposure: 5000,
      maxExposurePercent: 25,
      
      // Risk scoring and controls
      riskScore: 3,
      emergencyStop: false,
      enableRiskManagement: true,
      
      // Advanced settings
      correlationLimit: 0.7,
      volatilityAdjustment: true,
      timeBasedLimits: {
        enabled: true,
        maxTradesPerHour: 10,
        maxTradesPerDay: 50,
        cooldownPeriodMinutes: 5
      },
      
      // Risk monitoring
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
      
      // Metadata
      templateName: 'Default Conservative',
      lastUpdated: new Date().toISOString(),
      updatedBy: userId
    };
  }

  /**
   * Map database row to risk management interface
   */
  private mapRowToRiskManagement(row: any): PerBotRiskManagement {
    return JSON.parse(row.configuration);
  }

  /**
   * Map risk management interface to database fields
   */
  private mapRiskManagementToDbFields(riskManagement: PerBotRiskManagement): any {
    return {
      configuration: JSON.stringify(riskManagement),
      riskScore: riskManagement.riskScore,
      maxDailyLoss: riskManagement.maxDailyLoss,
      maxDrawdown: riskManagement.maxDrawdown,
      maxLeverage: riskManagement.maxLeverage,
      emergencyStop: riskManagement.emergencyStop,
      enableRiskManagement: riskManagement.enableRiskManagement
    };
  }

  /**
   * Map template database row to template interface
   */
  private mapTemplateRowToTemplate(row: any): RiskManagementTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category as RiskManagementTemplate['category'],
      isDefault: row.is_default,
      configuration: JSON.parse(row.configuration),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Create and export service instance
export const riskManagementService = new RiskManagementService();
