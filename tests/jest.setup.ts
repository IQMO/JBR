/**
 * Jest Setup File
 * Global test configuration and cleanup utilities
 */

// Increase timeout for integration tests
jest.setTimeout(15000);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless explicitly enabled
  if (process.env.JEST_VERBOSE !== 'true') {
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global cleanup for each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Cleanup function for tests with intervals/timeouts
export const cleanupTestResources = () => {
  // Clear all intervals and timeouts using a range approach
  const highestId = setTimeout(() => {}, 0);
  for (let i = 1; i <= 10000; i++) { // reasonable upper limit
    clearInterval(i);
    clearTimeout(i);
  }
  clearTimeout(highestId);
};

// Export test utilities
export const mockDelay = (ms: number = 10) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const waitForNextTick = () => 
  new Promise(resolve => process.nextTick(resolve));
