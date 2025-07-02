-- ============================================================================
-- Jabbr Trading Bot Platform - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates all core tables for the trading bot platform
-- ============================================================================

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing and encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS AND AUTHENTICATION
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    
    -- User preferences (stored as JSONB for flexibility)
    preferences JSONB NOT NULL DEFAULT '{
        "timezone": "UTC",
        "currency": "USD",
        "notifications": {
            "email": true,
            "browser": true,
            "tradingAlerts": true,
            "systemAlerts": true,
            "riskAlerts": true
        },
        "dashboard": {
            "theme": "dark",
            "layout": "standard",
            "refreshRate": 30000
        }
    }',
    
    -- Email verification and login tracking
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Password reset functionality
    password_reset_token VARCHAR(255),
    password_reset_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- EXCHANGE API KEYS
-- ============================================================================

-- Exchange API keys table (encrypted storage)
CREATE TABLE exchange_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Exchange information
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('bybit', 'binance', 'okx', 'coinbase', 'kraken')),
    key_name VARCHAR(100) NOT NULL, -- User-friendly name for the key
    
    -- Encrypted API credentials
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    passphrase_encrypted TEXT, -- For exchanges that require it (like OKX)
    
    -- Configuration
    sandbox BOOLEAN NOT NULL DEFAULT true,
    permissions TEXT[] NOT NULL DEFAULT '{}', -- Array of permissions
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure unique key names per user
    UNIQUE(user_id, key_name)
);

-- Indexes for exchange_api_keys table
CREATE INDEX idx_exchange_api_keys_user_id ON exchange_api_keys(user_id);
CREATE INDEX idx_exchange_api_keys_exchange ON exchange_api_keys(exchange);
CREATE INDEX idx_exchange_api_keys_active ON exchange_api_keys(is_active);

-- ============================================================================
-- BOTS AND CONFIGURATIONS
-- ============================================================================

-- Bots table
CREATE TABLE bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic bot information
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Strategy and exchange configuration
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('aether', 'target-reacher', 'sma-crossover', 'rsi-divergence', 'custom')),
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('bybit', 'binance', 'okx', 'coinbase', 'kraken')),
    exchange_api_key_id UUID NOT NULL REFERENCES exchange_api_keys(id) ON DELETE RESTRICT,
    
    -- Bot status
    status VARCHAR(20) NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped', 'starting', 'running', 'pausing', 'paused', 'stopping', 'error')),
    
    -- Configuration (stored as JSONB for flexibility)
    configuration JSONB NOT NULL DEFAULT '{}',
    risk_management JSONB NOT NULL DEFAULT '{}',
    
    -- Performance tracking
    performance JSONB NOT NULL DEFAULT '{
        "totalTrades": 0,
        "winningTrades": 0,
        "losingTrades": 0,
        "totalPnL": 0,
        "winRate": 0,
        "maxDrawdown": 0,
        "averageTradeTime": 0,
        "lastCalculatedAt": null
    }',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique bot names per user
    UNIQUE(user_id, name)
);

-- Indexes for bots table
CREATE INDEX idx_bots_user_id ON bots(user_id);
CREATE INDEX idx_bots_status ON bots(status);
CREATE INDEX idx_bots_strategy ON bots(strategy);
CREATE INDEX idx_bots_exchange ON bots(exchange);
CREATE INDEX idx_bots_last_active ON bots(last_active_at);

-- ============================================================================
-- TRADING DATA
-- ============================================================================

-- Trades table
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Trade identification
    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL, -- e.g., 'BTCUSDT'
    exchange_order_id VARCHAR(100), -- Exchange's order ID
    
    -- Trade details
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop-limit')),
    amount DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    leverage INTEGER NOT NULL DEFAULT 1,
    
    -- Trade status and execution
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'filled', 'partial', 'cancelled', 'rejected', 'closed')),
    entry_price DECIMAL(20, 8),
    exit_price DECIMAL(20, 8),
    
    -- Risk management
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    
    -- Financial results
    pnl DECIMAL(20, 8),
    fees DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Timestamps
    executed_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for trades table
CREATE INDEX idx_trades_bot_id ON trades(bot_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_executed_at ON trades(executed_at);
CREATE INDEX idx_trades_created_at ON trades(created_at);

-- Positions table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Position identification
    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    
    -- Position details
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    size DECIMAL(20, 8) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8) NOT NULL,
    
    -- PnL tracking
    unrealized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Risk and margin
    leverage INTEGER NOT NULL DEFAULT 1,
    margin DECIMAL(20, 8) NOT NULL,
    liquidation_price DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    
    -- Position status
    is_open BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for positions table
CREATE INDEX idx_positions_bot_id ON positions(bot_id);
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_is_open ON positions(is_open);
CREATE INDEX idx_positions_opened_at ON positions(opened_at);

-- ============================================================================
-- SIGNALS AND MARKET DATA
-- ============================================================================

-- Trading signals table
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    
    -- Signal details
    strategy VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    
    -- Signal strength and confidence
    strength DECIMAL(5, 4) NOT NULL CHECK (strength >= 0 AND strength <= 1),
    confidence DECIMAL(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    price DECIMAL(20, 8) NOT NULL,
    
    -- Technical indicators and metadata
    indicators JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for signals table
CREATE INDEX idx_signals_bot_id ON signals(bot_id);
CREATE INDEX idx_signals_symbol ON signals(symbol);
CREATE INDEX idx_signals_timestamp ON signals(timestamp);
CREATE INDEX idx_signals_strength ON signals(strength);

-- ============================================================================
-- SYSTEM MONITORING AND LOGS
-- ============================================================================

-- System health monitoring
CREATE TABLE system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Health status
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    services JSONB NOT NULL DEFAULT '[]',
    uptime BIGINT NOT NULL, -- seconds
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for system_health table
CREATE INDEX idx_system_health_status ON system_health(status);
CREATE INDEX idx_system_health_timestamp ON system_health(timestamp);

-- Application logs table
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Log details
    level VARCHAR(10) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    -- Related entities
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
    trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    
    -- Additional metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for logs table
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_category ON logs(category);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_bot_id ON logs(bot_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exchange_api_keys_updated_at BEFORE UPDATE ON exchange_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON bots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert initial system health record
INSERT INTO system_health (status, services, uptime) 
VALUES ('healthy', '[]', 0);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for active bots with their performance
CREATE VIEW active_bots_performance AS
SELECT 
    b.id,
    b.user_id,
    b.name,
    b.strategy,
    b.exchange,
    b.status,
    b.performance,
    b.last_active_at,
    u.email as user_email
FROM bots b
JOIN users u ON b.user_id = u.id
WHERE b.status IN ('running', 'starting', 'pausing');

-- View for recent trades with bot information
CREATE VIEW recent_trades_with_bots AS
SELECT 
    t.*,
    b.name as bot_name,
    b.strategy,
    u.email as user_email
FROM trades t
JOIN bots b ON t.bot_id = b.id
JOIN users u ON t.user_id = u.id
WHERE t.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC;

-- ============================================================================
-- PERMISSIONS AND SECURITY
-- ============================================================================

-- Create application user (for connection pooling)
-- Note: This should be run with appropriate credentials in production
-- CREATE USER jabbr_app WITH PASSWORD 'secure_password_here';
-- GRANT CONNECT ON DATABASE jabbr_trading_bot TO jabbr_app;
-- GRANT USAGE ON SCHEMA public TO jabbr_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jabbr_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jabbr_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
INSERT INTO logs (level, message, category, metadata)
VALUES ('info', 'Initial database schema migration completed', 'migration', '{"migration": "001_initial_schema"}'); 