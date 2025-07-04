import BybitWebSocketClient from '../../../src/websocket/bybit-websocket.client';

// Mock ws with proper default export structure
jest.mock('ws', () => {
  const mockWebSocket = jest.fn().mockImplementation(() => ({
    readyState: 1, // OPEN
    on: jest.fn(),
    once: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    removeAllListeners: jest.fn(),
  }));
  
  // Set static properties properly
  Object.assign(mockWebSocket, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  });
  
  return {
    __esModule: true,
    default: mockWebSocket,
    WebSocket: mockWebSocket,
  };
});

describe('BybitWebSocketClient', () => {
  let client: BybitWebSocketClient;
  let MockWebSocket: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Get the mocked WebSocket constructor
    MockWebSocket = require('ws').default;
    MockWebSocket.mockClear();
    
    client = new BybitWebSocketClient(true);
  });

  afterEach(async () => {
    // Ensure proper cleanup
    if (client) {
      client.disconnect();
      client.removeAllListeners();
    }
    // Clear all timers to prevent "Cannot log after tests are done"
    jest.clearAllTimers();
    jest.useRealTimers();
    // Wait for any pending operations
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  it('should construct without error', () => {
    expect(client).toBeInstanceOf(BybitWebSocketClient);
  });

  it('should emit connected event on successful connect', async () => {
    // Mock WebSocket open event
    MockWebSocket.mockImplementation(() => {
      const ws = {
        readyState: 1, // OPEN
        on: jest.fn(),
        once: jest.fn((event: string, cb: Function) => {
          if (event === 'open') setTimeout(() => cb(), 10);
        }),
        send: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      return ws;
    });
    const onConnected = jest.fn();
    client.on('connected', onConnected);
    
    const connectPromise = client.connect();
    // Fast-forward timers
    jest.advanceTimersByTime(20);
    await connectPromise;
    
    expect(onConnected).toHaveBeenCalled();
  });

  it('should emit error event on connection failure', async () => {
    MockWebSocket.mockImplementation(() => {
      const ws = {
        readyState: 0, // CONNECTING
        on: jest.fn(),
        once: jest.fn((event: string, cb: Function) => {
          if (event === 'error') setTimeout(() => cb(new Error('fail')), 10);
        }),
        send: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      return ws;
    });
    const onError = jest.fn();
    client.on('error', onError);
    
    const connectPromise = client.connect();
    // Fast-forward timers to trigger the error
    jest.advanceTimersByTime(20);
    
    await expect(connectPromise).rejects.toThrow('fail');
    expect(onError).toHaveBeenCalled();
  });

  it('should clean up on disconnect', () => {
    // @ts-ignore - accessing private properties for testing
    client.ws = {
      readyState: 1, // OPEN
      removeAllListeners: jest.fn(),
      close: jest.fn(),
    };
    // @ts-ignore - accessing private properties for testing
    client.heartbeatInterval = setInterval(() => {}, 1000);
    // @ts-ignore - accessing private properties for testing
    client.reconnectTimeout = setTimeout(() => {}, 1000);
    client.disconnect();
    expect(client['ws']).toBeNull();
    expect(client['heartbeatInterval']).toBeNull();
    expect(client['reconnectTimeout']).toBeNull();
  });
}); 