-- Bot Strategy Versions Migration
-- Supports dynamic strategy loading with versioning and rollback capabilities

CREATE TABLE IF NOT EXISTS bot_strategy_versions (
    bot_id VARCHAR(255) PRIMARY KEY,
    strategy_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_strategy_versions_bot_id ON bot_strategy_versions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_strategy_versions_updated_at ON bot_strategy_versions(updated_at);

-- Add foreign key constraint to bots table
ALTER TABLE bot_strategy_versions 
ADD CONSTRAINT fk_bot_strategy_versions_bot_id 
FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;

-- Example strategy_data structure:
-- [
--   {
--     "id": "bot123-aether-1704123456789",
--     "strategyType": "aether",
--     "pluginId": null,
--     "version": "1.0.0",
--     "config": {
--       "type": "aether",
--       "parameters": { ... },
--       "execution": { ... }
--     },
--     "createdAt": "2024-01-01T12:34:56.789Z",
--     "isActive": true,
--     "performance": {
--       "totalTrades": 0,
--       "successRate": 0,
--       "averageReturn": 0,
--       "maxDrawdown": 0,
--       "sharpeRatio": 0,
--       "lastUpdated": "2024-01-01T12:34:56.789Z",
--       "errorCount": 0
--     }
--   }
-- ] 