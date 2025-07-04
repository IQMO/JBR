-- Migration: Bot States Table for Production Bot Runtime
-- Description: Stores persistent state for bot runtime instances
-- Created: $(date)

-- Create bot_states table for storing bot runtime state
CREATE TABLE IF NOT EXISTS bot_states (
    bot_id VARCHAR(255) PRIMARY KEY,
    state JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint to bots table
    CONSTRAINT fk_bot_states_bot_id 
        FOREIGN KEY (bot_id) 
        REFERENCES bots(id) 
        ON DELETE CASCADE
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bot_states_updated_at ON bot_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_bot_states_bot_id ON bot_states(bot_id);

-- Add comments for documentation
COMMENT ON TABLE bot_states IS 'Stores persistent runtime state for trading bots';
COMMENT ON COLUMN bot_states.bot_id IS 'References the bot ID from the bots table';
COMMENT ON COLUMN bot_states.state IS 'JSON object containing bot runtime state (performance metrics, error counts, etc.)';
COMMENT ON COLUMN bot_states.updated_at IS 'Timestamp when the state was last updated';
COMMENT ON COLUMN bot_states.created_at IS 'Timestamp when the state record was created';

-- Example state structure (for documentation):
-- {
--   "performance": {
--     "tickCount": 1000,
--     "signalCount": 25,
--     "tradeCount": 12,
--     "errorCount": 2
--   },
--   "errorCount": 2,
--   "lastTickAt": "2024-01-01T12:00:00Z"
-- } 