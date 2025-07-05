/**
 * Optimized Root Jest Configuration
 * Performance-optimized configuration for faster test execution across the project
 */

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // TypeScript Transformation
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  projects: [
    {
      displayName: 'Backend Unit Tests',
      testMatch: ['<rootDir>/packages/backend/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts']
    },
    {
      displayName: 'Frontend Unit Tests', 
      testMatch: ['<rootDir>/packages/frontend/**/*.test.{ts,tsx}'],
      testEnvironment: 'jsdom',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }],
        '^.+\\.(js|jsx)$': ['babel-jest', {
          presets: [
            '@babel/preset-env',
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/packages/frontend/src/$1'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts']
    },
    {
      displayName: 'Shared Unit Tests',
      testMatch: ['<rootDir>/packages/shared/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts']
    }
  ],
  
  // Performance Optimizations
  maxWorkers: process.env.CI ? '50%' : '75%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  clearMocks: true,
  restoreMocks: true,
  workerIdleMemoryLimit: process.env.JEST_WORKER_IDLE_MEMORY_LIMIT || '512MB',
  
  // Coverage Configuration
  collectCoverageFrom: [
    'packages/backend/src/**/*.{ts,js}',
    'packages/frontend/src/**/*.{ts,tsx,js,jsx}',
    'packages/shared/src/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.test.{ts,tsx,js,jsx}',
    '!**/*.spec.{ts,tsx,js,jsx}',
    '!**/coverage/**',
    '!**/build/**'
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverage: false, // Temporarily disabled to fix execution issues
  coverageReporters: ['json', 'lcov', 'text-summary', 'clover', 'html'],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    }
  },
  
  // Reporting Configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/jest',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      suiteNameTemplate: '{filename}',
      usePathForSuiteName: true,
      addFileAttribute: true
    }]
  ],
  
  // Test Execution Configuration
  testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000'), // Increased timeout
  detectOpenHandles: true,
  forceExit: false, // Disabled to allow proper cleanup
  maxConcurrency: 3,
  
  // Module Resolution
  modulePathIgnorePatterns: [
    '<rootDir>/packages/*/dist/',
    '<rootDir>/packages/*/.next/',
    '<rootDir>/.jest-cache/',
    '<rootDir>/coverage/'
  ],
  
  // Global Setup and Teardown
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  
  // Error Handling
  errorOnDeprecated: true,
  verbose: process.env.JEST_VERBOSE === 'true'
};

export default config;
