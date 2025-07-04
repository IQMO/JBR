/**
 * Jest Setup for Shared Package Tests
 * This file is executed before running shared package tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(10000);

// Suppress console.log during tests unless explicitly needed
const originalConsoleLog = console.log;
(global as any).console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: originalConsoleLog, // Keep warnings
  error: originalConsoleLog, // Keep errors
};
