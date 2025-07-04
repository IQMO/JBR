/**
 * Jest Setup for Backend Tests
 * This file is executed before running backend tests
 */

// Load environment variables from root .env file
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

// Set test environment variables
(process.env as any).NODE_ENV = 'test';
(process.env as any).LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock external dependencies that shouldn't run during tests
jest.mock('ccxt', () => ({
  bybit: jest.fn().mockImplementation(() => ({
    options: {}, // Add options object to prevent 'Cannot set properties of undefined' errors
    loadMarkets: jest.fn(),
    fetchTicker: jest.fn().mockResolvedValue({
      last: 50000,
      bid: 49990,
      ask: 50010,
      baseVolume: 1000,
      change: 0.05,
      high: 51000,
      low: 49000,
      timestamp: Date.now()
    }),
    fetchOHLCV: jest.fn(),
    createOrder: jest.fn(),
    cancelOrder: jest.fn(),
    fetchOrder: jest.fn(),
    fetchBalance: jest.fn(),
  }))
}));

// Mock WebSocket connections
jest.mock('ws', () => ({
  WebSocket: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
  }))
}));

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn(),
    quit: jest.fn(),
  }));
});

// Global test timeout
jest.setTimeout(10000);

// Cleanup timers and intervals after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Force garbage collection if available
  if ((global as any).gc) {
    (global as any).gc();
  }
});

// Global teardown
afterAll(async () => {
  // Wait for any pending promises
  await new Promise(resolve => setImmediate(resolve));
  
  // Clear all timers and intervals
  jest.clearAllTimers();
  
  // Force process exit if needed
  if (process.env.FORCE_EXIT_TEST === 'true') {
    process.exit(0);
  }
});

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
