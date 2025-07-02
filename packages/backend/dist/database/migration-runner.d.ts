interface Migration {
    id: number;
    name: string;
    filename: string;
    executed_at: Date;
    checksum: string;
}
export declare class MigrationRunner {
    private migrationsPath;
    constructor(migrationsPath?: string);
    initializeMigrationTable(): Promise<void>;
    getExecutedMigrations(): Promise<Migration[]>;
    getMigrationFiles(): Promise<{
        name: string;
        filename: string;
        content: string;
        checksum: string;
    }[]>;
    runMigrations(): Promise<void>;
    private executeMigration;
    verifyMigrations(): Promise<{
        valid: boolean;
        issues: string[];
    }>;
    getStatus(): Promise<{
        executed: number;
        pending: number;
        total: number;
        migrations: Array<{
            name: string;
            status: 'executed' | 'pending';
            executed_at?: Date;
        }>;
    }>;
    private extractMigrationName;
    private calculateChecksum;
    createMigration(name: string): Promise<string>;
}
export declare const migrationRunner: MigrationRunner;
export declare function runMigrations(): Promise<void>;
export declare function getMigrationStatus(): Promise<{
    executed: number;
    pending: number;
    total: number;
    migrations: Array<{
        name: string;
        status: "executed" | "pending";
        executed_at?: Date;
    }>;
}>;
export declare function verifyMigrations(): Promise<{
    valid: boolean;
    issues: string[];
}>;
export {};
//# sourceMappingURL=migration-runner.d.ts.map