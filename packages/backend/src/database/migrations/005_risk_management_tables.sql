-- ============================================================================
-- Jabbr Trading Bot Platform - Risk Management Tables
-- Migration: 005_risk_management_tables.sql
-- Description: Creates tables for per-bot risk management configuration
-- ============================================================================

-- ============================================================================
-- BOT RISK MANAGEMENT CONFIGURATION
-- ============================================================================

-- Per-bot risk management configuration table
CREATE TABLE bot_risk_management (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL UNIQUE,
    
    -- Full risk management configuration stored as JSON
    configuration TEXT NOT NULL,
    
    -- Indexed fields for quick queries and filtering
    risk_score DECIMAL(3,1) NOT NULL CHECK (risk_score >= 1 AND risk_score <= 10),
    max_daily_loss DECIMAL(15,2) NOT NULL CHECK (max_daily_loss >= 0),
    max_drawdown DECIMAL(5,2) NOT NULL CHECK (max_drawdown >= 0 AND max_drawdown <= 100),
    max_leverage DECIMAL(8,2) NOT NULL CHECK (max_leverage >= 1),
    emergency_stop BOOLEAN NOT NULL DEFAULT false,
    enable_risk_management BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_bot_risk_management_bot_id 
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_bot_risk_management_bot_id ON bot_risk_management(bot_id);
CREATE INDEX idx_bot_risk_management_risk_score ON bot_risk_management(risk_score);
CREATE INDEX idx_bot_risk_management_emergency_stop ON bot_risk_management(emergency_stop);
CREATE INDEX idx_bot_risk_management_enable_risk_management ON bot_risk_management(enable_risk_management);

-- ============================================================================
-- RISK MANAGEMENT TEMPLATES
-- ============================================================================

-- Risk management templates for quick setup
CREATE TABLE risk_management_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('conservative', 'moderate', 'aggressive', 'custom')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    -- Full risk management configuration stored as JSON
    configuration TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_risk_management_templates_name ON risk_management_templates(name);
CREATE INDEX idx_risk_management_templates_category ON risk_management_templates(category);
CREATE INDEX idx_risk_management_templates_is_default ON risk_management_templates(is_default);

-- Ensure only one default template per category
CREATE UNIQUE INDEX idx_risk_management_templates_default_category 
    ON risk_management_templates(category) 
    WHERE is_default = true;

-- ============================================================================
-- DEFAULT RISK MANAGEMENT TEMPLATES
-- ============================================================================

-- Insert default conservative template
INSERT INTO risk_management_templates (
    id, name, description, category, is_default, configuration
) VALUES (
    uuid_generate_v4(),
    'Conservative Trading',
    'Low-risk configuration suitable for beginners and capital preservation',
    'conservative',
    true,
    '{
        "maxPositionSize": 500,
        "maxPositionSizePercent": 2,
        "positionSizingMethod": "percentage",
        "stopLossType": "percentage",
        "stopLossValue": 1,
        "takeProfitType": "risk-reward-ratio",
        "takeProfitValue": 2,
        "maxDailyLoss": 50,
        "maxDailyLossPercent": 1,
        "maxDrawdown": 5,
        "maxConcurrentTrades": 2,
        "maxLeverage": 2,
        "maxExposure": 1000,
        "maxExposurePercent": 10,
        "riskScore": 2,
        "emergencyStop": false,
        "enableRiskManagement": true,
        "correlationLimit": 0.5,
        "volatilityAdjustment": true,
        "timeBasedLimits": {
            "enabled": true,
            "maxTradesPerHour": 5,
            "maxTradesPerDay": 20,
            "cooldownPeriodMinutes": 10
        },
        "riskMonitoring": {
            "enabled": true,
            "alertThresholds": {
                "dailyLossPercent": 0.8,
                "drawdownPercent": 4,
                "exposurePercent": 8
            },
            "autoReduceExposure": true,
            "autoStopTrading": true
        },
        "templateName": "Conservative Trading",
        "lastUpdated": "' || NOW()::text || '",
        "updatedBy": "system"
    }'
);

-- Insert default moderate template
INSERT INTO risk_management_templates (
    id, name, description, category, is_default, configuration
) VALUES (
    uuid_generate_v4(),
    'Moderate Trading',
    'Balanced risk configuration for experienced traders',
    'moderate',
    true,
    '{
        "maxPositionSize": 1000,
        "maxPositionSizePercent": 5,
        "positionSizingMethod": "percentage",
        "stopLossType": "percentage",
        "stopLossValue": 2,
        "takeProfitType": "risk-reward-ratio",
        "takeProfitValue": 2,
        "maxDailyLoss": 100,
        "maxDailyLossPercent": 2,
        "maxDrawdown": 10,
        "maxConcurrentTrades": 3,
        "maxLeverage": 5,
        "maxExposure": 5000,
        "maxExposurePercent": 25,
        "riskScore": 5,
        "emergencyStop": false,
        "enableRiskManagement": true,
        "correlationLimit": 0.7,
        "volatilityAdjustment": true,
        "timeBasedLimits": {
            "enabled": true,
            "maxTradesPerHour": 10,
            "maxTradesPerDay": 50,
            "cooldownPeriodMinutes": 5
        },
        "riskMonitoring": {
            "enabled": true,
            "alertThresholds": {
                "dailyLossPercent": 1.5,
                "drawdownPercent": 8,
                "exposurePercent": 20
            },
            "autoReduceExposure": true,
            "autoStopTrading": false
        },
        "templateName": "Moderate Trading",
        "lastUpdated": "' || NOW()::text || '",
        "updatedBy": "system"
    }'
);

-- Insert default aggressive template
INSERT INTO risk_management_templates (
    id, name, description, category, is_default, configuration
) VALUES (
    uuid_generate_v4(),
    'Aggressive Trading',
    'High-risk configuration for experienced traders seeking maximum returns',
    'aggressive',
    true,
    '{
        "maxPositionSize": 5000,
        "maxPositionSizePercent": 10,
        "positionSizingMethod": "volatility-adjusted",
        "stopLossType": "percentage",
        "stopLossValue": 5,
        "takeProfitType": "risk-reward-ratio",
        "takeProfitValue": 3,
        "maxDailyLoss": 500,
        "maxDailyLossPercent": 5,
        "maxDrawdown": 20,
        "maxConcurrentTrades": 5,
        "maxLeverage": 20,
        "maxExposure": 20000,
        "maxExposurePercent": 50,
        "riskScore": 8,
        "emergencyStop": false,
        "enableRiskManagement": true,
        "correlationLimit": 0.9,
        "volatilityAdjustment": true,
        "timeBasedLimits": {
            "enabled": true,
            "maxTradesPerHour": 20,
            "maxTradesPerDay": 100,
            "cooldownPeriodMinutes": 2
        },
        "riskMonitoring": {
            "enabled": true,
            "alertThresholds": {
                "dailyLossPercent": 4,
                "drawdownPercent": 15,
                "exposurePercent": 40
            },
            "autoReduceExposure": false,
            "autoStopTrading": false
        },
        "templateName": "Aggressive Trading",
        "lastUpdated": "' || NOW()::text || '",
        "updatedBy": "system"
    }'
);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for bot_risk_management table
CREATE TRIGGER update_bot_risk_management_updated_at 
    BEFORE UPDATE ON bot_risk_management 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for risk_management_templates table
CREATE TRIGGER update_risk_management_templates_updated_at 
    BEFORE UPDATE ON risk_management_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE bot_risk_management IS 'Per-bot risk management configuration with indexed fields for performance';
COMMENT ON COLUMN bot_risk_management.configuration IS 'Full PerBotRiskManagement JSON configuration';
COMMENT ON COLUMN bot_risk_management.risk_score IS 'Risk score from 1-10 for quick filtering';
COMMENT ON COLUMN bot_risk_management.max_daily_loss IS 'Maximum daily loss amount for quick queries';
COMMENT ON COLUMN bot_risk_management.max_drawdown IS 'Maximum drawdown percentage for quick queries';
COMMENT ON COLUMN bot_risk_management.max_leverage IS 'Maximum leverage for quick queries';

COMMENT ON TABLE risk_management_templates IS 'Predefined risk management templates for quick bot setup';
COMMENT ON COLUMN risk_management_templates.configuration IS 'Full PerBotRiskManagement JSON configuration template';
COMMENT ON COLUMN risk_management_templates.is_default IS 'Whether this is the default template for its category';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
