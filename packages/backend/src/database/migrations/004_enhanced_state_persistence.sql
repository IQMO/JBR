-- Enhanced State Persistence Tables
-- Migration for comprehensive bot state management

-- Enhanced bot_states table
DROP TABLE IF EXISTS bot_states CASCADE;
CREATE TABLE bot_states (
    id SERIAL PRIMARY KEY,
    bot_id VARCHAR(255) NOT NULL UNIQUE,
    state JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    checksum VARCHAR(64) NOT NULL,
    compressed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- State backups table
CREATE TABLE bot_state_backups (
    id VARCHAR(255) PRIMARY KEY,
    bot_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('scheduled', 'manual', 'pre-restart', 'emergency')),
    reason TEXT NOT NULL,
    snapshot_data JSONB NOT NULL,
    compressed BOOLEAN DEFAULT false,
    size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (bot_id) REFERENCES bot_states(bot_id) ON DELETE CASCADE
);

-- State persistence metadata
CREATE TABLE state_persistence_metadata (
    bot_id VARCHAR(255) PRIMARY KEY,
    last_backup_at TIMESTAMP WITH TIME ZONE,
    backup_count INTEGER DEFAULT 0,
    total_backup_size BIGINT DEFAULT 0,
    recovery_count INTEGER DEFAULT 0,
    last_recovery_at TIMESTAMP WITH TIME ZONE,
    integrity_check_count INTEGER DEFAULT 0,
    integrity_failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (bot_id) REFERENCES bot_states(bot_id) ON DELETE CASCADE
);

-- Shutdown audit log
CREATE TABLE bot_shutdown_log (
    id SERIAL PRIMARY KEY,
    bot_id VARCHAR(255) NOT NULL,
    shutdown_type VARCHAR(50) NOT NULL CHECK (shutdown_type IN ('graceful', 'emergency', 'forced')),
    reason TEXT NOT NULL,
    signal VARCHAR(20),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    steps_completed TEXT[], -- Array of completed step names
    steps_failed TEXT[], -- Array of failed step names
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recovery audit log
CREATE TABLE bot_recovery_log (
    id SERIAL PRIMARY KEY,
    bot_id VARCHAR(255) NOT NULL,
    recovery_type VARCHAR(50) NOT NULL CHECK (recovery_type IN ('backup', 'snapshot', 'emergency')),
    backup_id VARCHAR(255),
    target_timestamp TIMESTAMP WITH TIME ZONE,
    restore_options JSONB NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    recovered_state_version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (backup_id) REFERENCES bot_state_backups(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_bot_states_bot_id ON bot_states(bot_id);
CREATE INDEX idx_bot_states_version ON bot_states(bot_id, version DESC);
CREATE INDEX idx_bot_states_updated_at ON bot_states(updated_at DESC);

CREATE INDEX idx_bot_state_backups_bot_id ON bot_state_backups(bot_id);
CREATE INDEX idx_bot_state_backups_created_at ON bot_state_backups(bot_id, created_at DESC);
CREATE INDEX idx_bot_state_backups_type ON bot_state_backups(type);

CREATE INDEX idx_state_metadata_bot_id ON state_persistence_metadata(bot_id);
CREATE INDEX idx_state_metadata_last_backup ON state_persistence_metadata(last_backup_at DESC);

CREATE INDEX idx_shutdown_log_bot_id ON bot_shutdown_log(bot_id);
CREATE INDEX idx_shutdown_log_started_at ON bot_shutdown_log(started_at DESC);
CREATE INDEX idx_shutdown_log_success ON bot_shutdown_log(success);

CREATE INDEX idx_recovery_log_bot_id ON bot_recovery_log(bot_id);
CREATE INDEX idx_recovery_log_started_at ON bot_recovery_log(started_at DESC);
CREATE INDEX idx_recovery_log_success ON bot_recovery_log(success);

-- Triggers for automatic metadata updates
CREATE OR REPLACE FUNCTION update_state_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO state_persistence_metadata (bot_id)
        VALUES (NEW.bot_id)
        ON CONFLICT (bot_id) DO NOTHING;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE state_persistence_metadata
        SET updated_at = NOW()
        WHERE bot_id = NEW.bot_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_state_metadata
    AFTER INSERT OR UPDATE ON bot_states
    FOR EACH ROW
    EXECUTE FUNCTION update_state_metadata();

-- Function to update backup metadata
CREATE OR REPLACE FUNCTION update_backup_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE state_persistence_metadata
        SET 
            last_backup_at = NEW.created_at,
            backup_count = backup_count + 1,
            total_backup_size = total_backup_size + NEW.size,
            updated_at = NOW()
        WHERE bot_id = NEW.bot_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_backup_metadata
    AFTER INSERT ON bot_state_backups
    FOR EACH ROW
    EXECUTE FUNCTION update_backup_metadata();

-- Function to cleanup old backups automatically
CREATE OR REPLACE FUNCTION cleanup_old_backups(
    p_bot_id VARCHAR(255),
    p_max_backups INTEGER DEFAULT 48
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH backups_to_delete AS (
        SELECT id
        FROM bot_state_backups
        WHERE bot_id = p_bot_id
        ORDER BY created_at DESC
        OFFSET p_max_backups
    )
    DELETE FROM bot_state_backups
    WHERE id IN (SELECT id FROM backups_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get bot state statistics
CREATE OR REPLACE FUNCTION get_bot_state_stats(p_bot_id VARCHAR(255))
RETURNS TABLE (
    bot_id VARCHAR(255),
    current_version INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE,
    backup_count INTEGER,
    total_backup_size_mb DECIMAL,
    last_backup_at TIMESTAMP WITH TIME ZONE,
    recovery_count INTEGER,
    last_recovery_at TIMESTAMP WITH TIME ZONE,
    graceful_shutdowns INTEGER,
    emergency_shutdowns INTEGER,
    successful_recoveries INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bs.bot_id,
        bs.version as current_version,
        bs.updated_at as last_updated,
        COALESCE(spm.backup_count, 0) as backup_count,
        ROUND(COALESCE(spm.total_backup_size, 0)::DECIMAL / 1024 / 1024, 2) as total_backup_size_mb,
        spm.last_backup_at,
        COALESCE(spm.recovery_count, 0) as recovery_count,
        spm.last_recovery_at,
        COALESCE(graceful_count.count, 0) as graceful_shutdowns,
        COALESCE(emergency_count.count, 0) as emergency_shutdowns,
        COALESCE(recovery_success.count, 0) as successful_recoveries
    FROM bot_states bs
    LEFT JOIN state_persistence_metadata spm ON bs.bot_id = spm.bot_id
    LEFT JOIN (
        SELECT bot_id, COUNT(*) as count
        FROM bot_shutdown_log
        WHERE shutdown_type = 'graceful' AND success = true
        GROUP BY bot_id
    ) graceful_count ON bs.bot_id = graceful_count.bot_id
    LEFT JOIN (
        SELECT bot_id, COUNT(*) as count
        FROM bot_shutdown_log
        WHERE shutdown_type = 'emergency'
        GROUP BY bot_id
    ) emergency_count ON bs.bot_id = emergency_count.bot_id
    LEFT JOIN (
        SELECT bot_id, COUNT(*) as count
        FROM bot_recovery_log
        WHERE success = true
        GROUP BY bot_id
    ) recovery_success ON bs.bot_id = recovery_success.bot_id
    WHERE bs.bot_id = p_bot_id;
END;
$$ LANGUAGE plpgsql;

-- Function to find optimal recovery point
CREATE OR REPLACE FUNCTION find_optimal_recovery_point(
    p_bot_id VARCHAR(255),
    p_target_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    backup_id VARCHAR(255),
    backup_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    time_diff_minutes INTEGER,
    size_mb DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bsb.id as backup_id,
        bsb.type as backup_type,
        bsb.created_at,
        EXTRACT(EPOCH FROM (p_target_time - bsb.created_at))::INTEGER / 60 as time_diff_minutes,
        ROUND(bsb.size::DECIMAL / 1024 / 1024, 2) as size_mb
    FROM bot_state_backups bsb
    WHERE bsb.bot_id = p_bot_id
        AND bsb.created_at <= p_target_time
    ORDER BY bsb.created_at DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Sample data and comments
COMMENT ON TABLE bot_states IS 'Enhanced bot state storage with versioning and integrity checks';
COMMENT ON TABLE bot_state_backups IS 'Comprehensive backup storage with metadata and compression support';
COMMENT ON TABLE state_persistence_metadata IS 'Metadata tracking for state persistence operations';
COMMENT ON TABLE bot_shutdown_log IS 'Audit log for bot shutdown procedures';
COMMENT ON TABLE bot_recovery_log IS 'Audit log for state recovery operations';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bot_service;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bot_service;
