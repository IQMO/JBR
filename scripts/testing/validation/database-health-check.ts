import { DatabaseManager } from '../database/database.config';

/**
 * Database Health Check Script
 * Validates database connectivity and basic functionality
 */
async function performDatabaseHealthCheck(): Promise<boolean> {
  console.log('🔍 Starting database health check...');
  
  try {
    // Initialize database connection
    const dbManager = new DatabaseManager();
    await dbManager.connect();
    
    console.log('✅ Database connection established');
    
    // Test basic query
    const timeResult = await dbManager.query<{ now: Date }>('SELECT NOW() as now');
    if (timeResult && timeResult.length > 0) {
      console.log('✅ Query test successful:', timeResult[0]?.now);
    } else {
      throw new Error('Query returned no results');
    }
    
    // Test database health and connection pool status
    const healthCheck = await dbManager.healthCheck();
    console.log('📊 Database health status:', {
      status: healthCheck.status,
      connected: healthCheck.details.connected,
      poolSize: healthCheck.details.poolSize,
      idleConnections: healthCheck.details.idleCount,
      waitingCount: healthCheck.details.waitingCount,
      responseTime: healthCheck.details.responseTime
    });
    
    // Cleanup
    await dbManager.disconnect();
    console.log('✅ Database health check completed successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Execute health check if run directly
if (require.main === module) {
  performDatabaseHealthCheck()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error during health check:', error);
      process.exit(1);
    });
}

export { performDatabaseHealthCheck };
