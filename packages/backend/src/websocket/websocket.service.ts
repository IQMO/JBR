/**
 * WebSocket service entry point
 * Re-exports JabbrWebSocketServer for backward compatibility
 */

import type { JabbrWebSocketServer } from './websocket-server';
export { JabbrWebSocketServer } from './websocket-server';

// Create a singleton instance for use across the application
let webSocketServiceInstance: JabbrWebSocketServer | null = null;

export const webSocketService = {
  getInstance(): JabbrWebSocketServer | null {
    return webSocketServiceInstance;
  },
  
  setInstance(instance: JabbrWebSocketServer): void {
    webSocketServiceInstance = instance;
  },
  
  broadcast(event: string, data: any): void {
    if (webSocketServiceInstance) {
      webSocketServiceInstance.broadcast(event, data);
    }
  }
};
