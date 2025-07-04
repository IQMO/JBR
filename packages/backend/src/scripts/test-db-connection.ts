#!/usr/bin/env ts-node

import { database as dbInstance } from '../database/database.config';
import logger from '../services/logging.service';

interface DatabaseTestResult {
  connectionStatus: 'success' | 'failed';
  queryStatus: 'success' | 'failed';
  migrationStatus: 'success' | 'failed';
  details: {
    connectionTime?: number;
    serverVersion?: string;
    activeConnections?: number;
  };
  error?: string;
}

interface MonitoringTestResult {
  databaseMonitor: boolean;
  metricsCollector: boolean;
  healthCheck: boolean;
  error?: string;
}

interface TestSummary {
  database: DatabaseTestResult;
  monitoring: MonitoringTestResult;
  overall: 'success' | 'failed';
  timestamp: string;
}

// Use the database instance from config

async function testDatabaseConnection(): Promise<DatabaseTestResult> {
  const result: DatabaseTestResult = {
    connectionStatus: 'failed',
    queryStatus: 'failed', 
    migrationStatus: 'failed',
    details: {}
  };

  try {
    logger.info('🔌 Testing database connection...');
    
    const startTime = Date.now();
    
    // Test basic connection
    const testQuery = 'SELECT version() as server_version, current_timestamp as current_time';
    const queryResult = await dbInstance.query<{server_version: string; current_time: string}>(testQuery);
    
    const connectionTime = Date.now() - startTime;
    result.connectionStatus = 'success';
    result.details.connectionTime = connectionTime;
    
    if (queryResult && queryResult.length > 0 && queryResult[0]) {
      result.queryStatus = 'success';
      result.details.serverVersion = queryResult[0].server_version;
      logger.info(`✅ Database connection successful (${connectionTime}ms)`);
      logger.info(`📊 Server version: ${queryResult[0].server_version}`);
    }

    // Test connection pool status
    try {
      const poolQuery = 'SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'';
      const poolResult = await dbInstance.query<{active_connections: string}>(poolQuery);
      
      if (poolResult && poolResult.length > 0 && poolResult[0]) {
        result.details.activeConnections = parseInt(poolResult[0].active_connections);
        logger.info(`🔗 Active connections: ${result.details.activeConnections}`);
      }
    } catch (poolError) {
      logger.warn('⚠️  Could not retrieve connection pool status:', poolError);
    }

    // Test migration status
    try {
      const migrationQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        ) as users_table_exists
      `;
      const migrationResult = await dbInstance.query<{users_table_exists: boolean}>(migrationQuery);
      
      if (migrationResult && migrationResult.length > 0 && migrationResult[0]) {
        const tablesExist = migrationResult[0].users_table_exists;
        result.migrationStatus = tablesExist ? 'success' : 'failed';
        logger.info(`📋 Database migrations: ${tablesExist ? 'Applied' : 'Not Applied'}`);
      }
    } catch (migrationError) {
      logger.warn('⚠️  Could not check migration status:', migrationError);
    }

    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error('❌ Database connection failed:', error);
    return result;
  }
}

async function testMonitoringServices(): Promise<MonitoringTestResult> {
  const result: MonitoringTestResult = {
    databaseMonitor: false,
    metricsCollector: false,
    healthCheck: false
  };

  try {
    logger.info('📊 Testing monitoring services...');
    
    // Test if monitoring services can be imported
    try {
      const { DatabaseMonitorService } = await import('../services/database-monitor.service');
      result.databaseMonitor = true;
      logger.info('✅ Database monitor service available');
    } catch (error) {
      logger.warn('⚠️  Database monitor service not available:', (error as Error).message);
    }

    try {
      const { MetricsCollectorService } = await import('../services/metrics-collector.service');
      result.metricsCollector = true;
      logger.info('✅ Metrics collector service available');
    } catch (error) {
      logger.warn('⚠️  Metrics collector service not available:', (error as Error).message);
    }

    try {
      const { HealthCheckService } = await import('../services/health-check.service');
      result.healthCheck = true;
      logger.info('✅ Health check service available');
    } catch (error) {
      logger.warn('⚠️  Health check service not available:', (error as Error).message);
    }

    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error('❌ Monitoring services test failed:', error);
    return result;
  }
}

async function runTests(): Promise<TestSummary> {
  logger.info('🚀 Starting Database & Monitoring Services Test...\n');

  const summary: TestSummary = {
    database: await testDatabaseConnection(),
    monitoring: await testMonitoringServices(),
    overall: 'failed',
    timestamp: new Date().toISOString()
  };

  // Determine overall status
  const dbSuccess = summary.database.connectionStatus === 'success' && 
                   summary.database.queryStatus === 'success';
  const monitoringSuccess = summary.monitoring.databaseMonitor || 
                           summary.monitoring.metricsCollector || 
                           summary.monitoring.healthCheck;

  summary.overall = dbSuccess && monitoringSuccess ? 'success' : 'failed';

  // Print summary
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log(`Database Connection: ${summary.database.connectionStatus}`);
  console.log(`Database Queries: ${summary.database.queryStatus}`);
  console.log(`Database Migrations: ${summary.database.migrationStatus}`);
  console.log(`Monitoring Services: ${monitoringSuccess ? 'Available' : 'Unavailable'}`);
  console.log(`Overall Status: ${summary.overall}`);
  
  if (summary.database.details.connectionTime) {
    console.log(`Connection Time: ${summary.database.details.connectionTime}ms`);
  }
  
  if (summary.database.details.serverVersion) {
    console.log(`Database Version: ${summary.database.details.serverVersion}`);
  }

  // Save results to file
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const resultsDir = path.join(__dirname, '../../test-results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  const resultsFile = path.join(resultsDir, `db-monitoring-test-${Date.now()}.json`);
  await fs.writeFile(resultsFile, JSON.stringify(summary, null, 2));
  
  logger.info(`📝 Test results saved to: ${resultsFile}`);

  return summary;
}

// Handle both direct execution and module import
if (require.main === module) {
  runTests()
    .then((summary) => {
      const exitCode = summary.overall === 'success' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((error) => {
      logger.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { runTests, testDatabaseConnection, testMonitoringServices };
