"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrationRunner = exports.MigrationRunner = void 0;
exports.runMigrations = runMigrations;
exports.getMigrationStatus = getMigrationStatus;
exports.verifyMigrations = verifyMigrations;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const database_config_1 = require("./database.config");
class MigrationRunner {
    migrationsPath;
    constructor(migrationsPath) {
        this.migrationsPath = migrationsPath || path_1.default.join(__dirname, 'migrations');
    }
    async initializeMigrationTable() {
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
      CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON migrations(executed_at);
    `;
        try {
            await database_config_1.database.query(createTableSQL);
            console.log('✅ Migration tracking table initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize migration table:', error);
            throw error;
        }
    }
    async getExecutedMigrations() {
        try {
            const migrations = await database_config_1.database.query(`
        SELECT id, name, filename, executed_at, checksum 
        FROM migrations 
        ORDER BY id ASC
      `);
            return migrations;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('relation "migrations" does not exist')) {
                return [];
            }
            throw error;
        }
    }
    async getMigrationFiles() {
        try {
            const files = await promises_1.default.readdir(this.migrationsPath);
            const migrationFiles = files
                .filter(file => file.endsWith('.sql'))
                .sort();
            const migrations = [];
            for (const filename of migrationFiles) {
                const filePath = path_1.default.join(this.migrationsPath, filename);
                const content = await promises_1.default.readFile(filePath, 'utf-8');
                const name = this.extractMigrationName(filename);
                const checksum = this.calculateChecksum(content);
                migrations.push({
                    name,
                    filename,
                    content,
                    checksum
                });
            }
            return migrations;
        }
        catch (error) {
            console.error('❌ Failed to read migration files:', error);
            throw error;
        }
    }
    async runMigrations() {
        console.log('🔄 Starting database migrations...');
        if (!database_config_1.database.isConnectionActive()) {
            await database_config_1.database.connect();
        }
        await this.initializeMigrationTable();
        const [executedMigrations, migrationFiles] = await Promise.all([
            this.getExecutedMigrations(),
            this.getMigrationFiles()
        ]);
        const executedNames = new Set(executedMigrations.map(m => m.name));
        const pendingMigrations = migrationFiles.filter(m => !executedNames.has(m.name));
        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }
        console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
        pendingMigrations.forEach(m => console.log(`   - ${m.name}`));
        for (const migration of pendingMigrations) {
            await this.executeMigration(migration);
        }
        console.log('✅ All migrations completed successfully');
    }
    async executeMigration(migration) {
        console.log(`🔄 Executing migration: ${migration.name}`);
        try {
            await database_config_1.database.transaction(async (client) => {
                await client.query(migration.content);
                await client.query(`
          INSERT INTO migrations (name, filename, checksum)
          VALUES ($1, $2, $3)
        `, [migration.name, migration.filename, migration.checksum]);
            });
            console.log(`✅ Migration completed: ${migration.name}`);
        }
        catch (error) {
            console.error(`❌ Migration failed: ${migration.name}`, error);
            throw error;
        }
    }
    async verifyMigrations() {
        const issues = [];
        try {
            const [executedMigrations, migrationFiles] = await Promise.all([
                this.getExecutedMigrations(),
                this.getMigrationFiles()
            ]);
            for (const executed of executedMigrations) {
                const file = migrationFiles.find(f => f.name === executed.name);
                if (!file) {
                    issues.push(`Migration file missing: ${executed.filename}`);
                    continue;
                }
                if (file.checksum !== executed.checksum) {
                    issues.push(`Migration checksum mismatch: ${executed.name} (file may have been modified)`);
                }
            }
            const executedNames = executedMigrations.map(m => m.name);
            const fileNames = migrationFiles.map(f => f.name);
            for (let i = 0; i < executedNames.length; i++) {
                const executedName = executedNames[i];
                const expectedName = fileNames[i];
                if (executedName !== expectedName) {
                    issues.push(`Migration order mismatch at position ${i}: expected ${expectedName}, found ${executedName}`);
                }
            }
            return {
                valid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            issues.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { valid: false, issues };
        }
    }
    async getStatus() {
        const [executedMigrations, migrationFiles] = await Promise.all([
            this.getExecutedMigrations(),
            this.getMigrationFiles()
        ]);
        const executedMap = new Map(executedMigrations.map(m => [m.name, m]));
        const migrations = migrationFiles.map(file => {
            const executed = executedMap.get(file.name);
            return {
                name: file.name,
                status: executed ? 'executed' : 'pending',
                executed_at: executed?.executed_at
            };
        });
        return {
            executed: executedMigrations.length,
            pending: migrationFiles.length - executedMigrations.length,
            total: migrationFiles.length,
            migrations
        };
    }
    extractMigrationName(filename) {
        return filename.replace(/\.sql$/, '');
    }
    calculateChecksum(content) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    async createMigration(name) {
        const timestamp = new Date().toISOString().replace(/[:\-T]/g, '').split('.')[0];
        const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
        const filepath = path_1.default.join(this.migrationsPath, filename);
        const template = `-- ============================================================================
-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString()}
-- ============================================================================

-- Add your SQL statements here

-- Example:
-- CREATE TABLE example (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
-- );

-- Log migration completion
INSERT INTO logs (level, message, category, metadata)
VALUES ('info', 'Migration ${filename} completed', 'migration', '{"migration": "${filename}"}');
`;
        await promises_1.default.writeFile(filepath, template, 'utf-8');
        console.log(`✅ Created migration file: ${filename}`);
        return filepath;
    }
}
exports.MigrationRunner = MigrationRunner;
exports.migrationRunner = new MigrationRunner();
async function runMigrations() {
    await exports.migrationRunner.runMigrations();
}
async function getMigrationStatus() {
    return exports.migrationRunner.getStatus();
}
async function verifyMigrations() {
    return exports.migrationRunner.verifyMigrations();
}
//# sourceMappingURL=migration-runner.js.map