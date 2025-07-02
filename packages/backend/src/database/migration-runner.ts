import fs from 'fs/promises';
import path from 'path';
import { database } from './database.config';

/**
 * Migration record interface
 */
interface Migration {
  id: number;
  name: string;
  filename: string;
  executed_at: Date;
  checksum: string;
}

/**
 * Database Migration Runner
 * Handles executing SQL migration files and tracking migration history
 */
export class MigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath?: string) {
    this.migrationsPath = migrationsPath || path.join(__dirname, 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
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
      await database.query(createTableSQL);
      console.log('✅ Migration tracking table initialized');
    } catch (error) {
      console.error('❌ Failed to initialize migration table:', error);
      throw error;
    }
  }

  /**
   * Get all executed migrations from database
   */
  async getExecutedMigrations(): Promise<Migration[]> {
    try {
      const migrations = await database.query<Migration>(`
        SELECT id, name, filename, executed_at, checksum 
        FROM migrations 
        ORDER BY id ASC
      `);
      return migrations;
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('relation "migrations" does not exist')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all migration files from filesystem
   */
  async getMigrationFiles(): Promise<{ name: string; filename: string; content: string; checksum: string }[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure consistent ordering

      const migrations = [];
      for (const filename of migrationFiles) {
        const filePath = path.join(this.migrationsPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
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
    } catch (error) {
      console.error('❌ Failed to read migration files:', error);
      throw error;
    }
  }

  /**
   * Execute pending migrations
   */
  async runMigrations(): Promise<void> {
    console.log('🔄 Starting database migrations...');

    // Ensure database is connected
    if (!database.isConnectionActive()) {
      await database.connect();
    }

    // Initialize migration table
    await this.initializeMigrationTable();

    // Get executed migrations and available migration files
    const [executedMigrations, migrationFiles] = await Promise.all([
      this.getExecutedMigrations(),
      this.getMigrationFiles()
    ]);

    // Find pending migrations
    const executedNames = new Set(executedMigrations.map(m => m.name));
    const pendingMigrations = migrationFiles.filter(m => !executedNames.has(m.name));

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach(m => console.log(`   - ${m.name}`));

    // Execute pending migrations
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('✅ All migrations completed successfully');
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: { name: string; filename: string; content: string; checksum: string }): Promise<void> {
    console.log(`🔄 Executing migration: ${migration.name}`);

    try {
      await database.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migration.content);

        // Record the migration in the tracking table
        await client.query(`
          INSERT INTO migrations (name, filename, checksum)
          VALUES ($1, $2, $3)
        `, [migration.name, migration.filename, migration.checksum]);
      });

      console.log(`✅ Migration completed: ${migration.name}`);
    } catch (error) {
      console.error(`❌ Migration failed: ${migration.name}`, error);
      throw error;
    }
  }

  /**
   * Verify migration integrity
   */
  async verifyMigrations(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const [executedMigrations, migrationFiles] = await Promise.all([
        this.getExecutedMigrations(),
        this.getMigrationFiles()
      ]);

      // Check for missing migration files
      for (const executed of executedMigrations) {
        const file = migrationFiles.find(f => f.name === executed.name);
        if (!file) {
          issues.push(`Migration file missing: ${executed.filename}`);
          continue;
        }

        // Check checksum integrity
        if (file.checksum !== executed.checksum) {
          issues.push(`Migration checksum mismatch: ${executed.name} (file may have been modified)`);
        }
      }

      // Check for out-of-order migrations
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
    } catch (error) {
      issues.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, issues };
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    executed: number;
    pending: number;
    total: number;
    migrations: Array<{
      name: string;
      status: 'executed' | 'pending';
      executed_at?: Date;
    }>;
  }> {
    const [executedMigrations, migrationFiles] = await Promise.all([
      this.getExecutedMigrations(),
      this.getMigrationFiles()
    ]);

    const executedMap = new Map(executedMigrations.map(m => [m.name, m]));
    
    const migrations = migrationFiles.map(file => {
      const executed = executedMap.get(file.name);
      return {
        name: file.name,
        status: executed ? 'executed' as const : 'pending' as const,
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

  /**
   * Extract migration name from filename
   */
  private extractMigrationName(filename: string): string {
    // Remove .sql extension and use the filename as the name
    return filename.replace(/\.sql$/, '');
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:\-T]/g, '').split('.')[0];
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

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

    await fs.writeFile(filepath, template, 'utf-8');
    console.log(`✅ Created migration file: ${filename}`);
    return filepath;
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();

/**
 * Convenience function to run migrations
 */
export async function runMigrations(): Promise<void> {
  await migrationRunner.runMigrations();
}

/**
 * Convenience function to check migration status
 */
export async function getMigrationStatus() {
  return migrationRunner.getStatus();
}

/**
 * Convenience function to verify migrations
 */
export async function verifyMigrations() {
  return migrationRunner.verifyMigrations();
} 