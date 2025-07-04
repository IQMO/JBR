/**
 * WebSocket Connection Status Utilities
 * 
 * Shared utilities for displaying WebSocket connection status across components
 */

export interface ConnectionStatusState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

export const getStatusColor = ({ isConnected, isConnecting, connectionError }: ConnectionStatusState): string => {
  if (isConnected) {return 'text-green-600';}
  if (isConnecting) {return 'text-yellow-600';}
  if (connectionError) {return 'text-red-600';}
  return 'text-gray-600';
};

export const getStatusText = ({ isConnected, isConnecting, connectionError }: ConnectionStatusState): string => {
  if (isConnected) {return '🟢 Connected';}
  if (isConnecting) {return '🟡 Connecting...';}
  if (connectionError) {return '🔴 Error';}
  return '⚫ Disconnected';
};
