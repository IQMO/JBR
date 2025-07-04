/**
 * Test Runner Script for Strategy Framework
 * 
 * This script runs all tests for the strategy framework
 */

import { execSync } from 'child_process';
import * as path from 'path';

// Configure paths
const backendDir = path.join(__dirname, '..', '..');

// Function to run tests with nice formatting
function runTests(testPattern?: string): boolean {
  console.log(`\n🧪 Running tests: ${testPattern || 'all tests'}\n`);
  try {
    // Run Jest with the specified pattern
    const command = testPattern 
      ? `jest ${testPattern} --colors` 
      : `jest --colors`;
    
    execSync(command, { 
      cwd: backendDir, 
      stdio: 'inherit' 
    });
    
    console.log(`\n✅ Tests completed successfully\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ Tests failed with error:\n`);
    return false;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const testPattern = args[0];

// Run all tests or specific tests based on command line arguments
if (testPattern) {
  runTests(testPattern);
} else {
  console.log('🚀 Running Strategy Framework Tests');
  
  // Run tests in specific order
  const allPassed = 
    runTests('tests/unit/signals/sma/sma-signal-processor.test.ts') &&
    runTests('tests/unit/signals/sma/sma-crossover-strategy.test.ts') &&
    runTests('tests/integration/strategies/strategy-factory.test.ts');
  
  if (allPassed) {
    console.log('\n🎉 All Strategy Framework tests passed!');
  } else {
    console.error('\n❌ Some tests failed. See above for details.');
    process.exit(1);
  }
}
