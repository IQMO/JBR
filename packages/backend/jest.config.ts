/**
 * Optimized Jest Configuration for Backend Tests
 * Performance-optimized configuration for faster backend test execution
 */

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  displayName: 'Backend Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  
  // Test File Patterns (optimized for faster discovery)
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts'
  ],
  
  // TypeScript Configuration (optimized for speed)
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { 
      tsconfig: 'tsconfig.json',
      useESM: false
    }]
  },
  
  // Performance Optimizations
  maxWorkers: parseInt(process.env.JEST_MAX_WORKERS || '4'),
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  clearMocks: true,
  restoreMocks: true,
  workerIdleMemoryLimit: process.env.JEST_WORKER_IDLE_MEMORY_LIMIT || '512MB',
  
  // Module Configuration
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.jest-cache/'
  ],
  
  // Module Name Mapping for faster resolution
  moduleNameMapper: {
    '^@jabbr/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@jabbr/backend/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Coverage Configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}',
    '!src/types/**/*',
    '!src/**/__tests__/**/*',
    '!src/**/__mocks__/**/*'
  ],
  
  // Test Environment Setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testEnvironmentOptions: {
    node: {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large test outputs
    }
  },
  
  // Test Execution Configuration
  testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000'), // Increased from 15000
  detectOpenHandles: true,
  detectLeaks: false,
  forceExit: false, // Changed from true to allow proper cleanup
  
  // Error Handling
  errorOnDeprecated: true
};

export default config;
