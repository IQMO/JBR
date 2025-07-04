/**
 * Global Jest Teardown
 * Cleans up test environment and shared resources
 */

import { performance } from 'perf_hooks';

export default async (): Promise<void> => {
  const startTime = performance.now();
  
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up test database if needed
  if (process.env.CLEANUP_TEST_DB === 'true') {
    console.log('📊 Cleaning up test database...');
    // Add database cleanup logic here
  }
  
  // Clean up test Redis instance if needed
  if (process.env.CLEANUP_TEST_REDIS === 'true') {
    console.log('🔄 Cleaning up test Redis...');
    // Add Redis cleanup logic here
  }
  
  // Generate performance report
  if (global.__TEST_PERFORMANCE__ && global.__TEST_START_TIME__) {
    const totalTime = startTime - global.__TEST_START_TIME__;
    console.log(`📊 Total test execution time: ${Math.round(totalTime)}ms`);
    
    // Log slow tests if any
    const slowTests = Array.from(global.__TEST_PERFORMANCE__.tests.entries())
      .filter(([, time]) => time > 5000)
      .sort(([, a], [, b]) => b - a);
    
    if (slowTests.length > 0) {
      console.log('⚠️  Slow tests detected:');
      slowTests.slice(0, 5).forEach(([test, time]) => {
        console.log(`   ${test}: ${Math.round(time)}ms`);
      });
    }
  }
  
  // Force garbage collection if available
  if ((global as any).gc) {
    (global as any).gc();
  }
  
  const endTime = performance.now();
  console.log(`✅ Global test teardown completed in ${Math.round(endTime - startTime)}ms`);
};
