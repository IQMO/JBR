import { Pool, PoolConfig } from 'pg';

interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Simple database connection test
async function testDatabaseConnection(): Promise<boolean> {
  console.log('Testing database connection...');
  
  const config: DatabaseConfig = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'jabbr',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query test successful:', result.rows[0]);
    
    client.release();
    await pool.end();
    console.log('✅ Database connection test completed');
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
  
  return true;
}

testDatabaseConnection().catch(console.error);
