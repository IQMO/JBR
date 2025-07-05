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
  if (isConnected) {return 'text-status-success';}
  if (isConnecting) {return 'text-status-warning';}
  if (connectionError) {return 'text-status-error';}
  return 'text-muted';
};

export const getStatusText = ({ isConnected, isConnecting, connectionError }: ConnectionStatusState): string => {
  if (isConnected) {return '🟢 Connected';}
  if (isConnecting) {return '🟡 Connecting...';}
  if (connectionError) {return '🔴 Error';}
  return '⚫ Disconnected';
};
