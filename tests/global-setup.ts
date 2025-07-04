/**
 * Global Jest Setup
 * Initializes test environment and shared resources
 */

import { performance } from 'perf_hooks';
import dotenv from 'dotenv';
import { resolve } from 'path';

interface TestPerformance {
  suites: Map<string, number>;
  tests: Map<string, number>;
}

declare global {
  var __TEST_START_TIME__: number;
  var __TEST_PERFORMANCE__: TestPerformance;
}

export default async (): Promise<void> => {
  const startTime = performance.now();
  
  console.log('🚀 Initializing global test environment...');
  
  // Load environment variables from .env file
  const envPath = resolve(process.cwd(), '.env');
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.warn('⚠️ Failed to load .env file:', result.error.message);
    console.log('📍 Looking for .env file at:', envPath);
  } else {
    console.log('✅ Environment variables loaded from .env file');
    console.log('🔑 Bybit testnet keys configured:', {
      hasApiKey: !!process.env.BYBIT_TESTNET_API_KEY,
      hasApiSecret: !!process.env.BYBIT_TESTNET_API_SECRET,
      isTestnet: process.env.BYBIT_TESTNET
    });
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';
  
  // Initialize test database if needed
  if (process.env.INIT_TEST_DB === 'true') {
    console.log('📊 Initializing test database...');
    // Add database initialization logic here
  }
  
  // Setup test Redis instance if needed
  if (process.env.INIT_TEST_REDIS === 'true') {
    console.log('🔄 Initializing test Redis...');
    // Add Redis initialization logic here
  }
  
  // Setup performance monitoring for tests
  global.__TEST_START_TIME__ = startTime;
  global.__TEST_PERFORMANCE__ = {
    suites: new Map(),
    tests: new Map()
  };
  
  // Increase memory limit for Node.js in test environment
  if (process.env.NODE_OPTIONS && !process.env.NODE_OPTIONS.includes('--max-old-space-size')) {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS} --max-old-space-size=4096`;
  }
  
  const endTime = performance.now();
  console.log(`✅ Global test setup completed in ${Math.round(endTime - startTime)}ms`);
};
