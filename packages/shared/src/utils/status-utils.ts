/**
 * Consolidated Status and Color Utilities
 * 
 * This module provides shared utilities for status handling and color
 * mapping to eliminate duplication across frontend components.
 */

/**
 * Bot status enumeration
 */
export type BotStatus = 'running' | 'stopped' | 'paused' | 'error' | 'starting' | 'stopping';

/**
 * Connection status interface
 */
export interface ConnectionStatusState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError?: string | null;
}

/**
 * Risk level type
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Get status color for bot status
 */
export const getBotStatusColor = (status: BotStatus): string => {
  const colors: Record<BotStatus, string> = {
    running: 'text-green-600 bg-green-100',
    stopped: 'text-gray-600 bg-gray-100',
    paused: 'text-yellow-600 bg-yellow-100', 
    error: 'text-red-600 bg-red-100',
    starting: 'text-blue-600 bg-blue-100',
    stopping: 'text-orange-600 bg-orange-100'
  };
  return colors[status];
};

/**
 * Get status icon for bot status
 */
export const getBotStatusIcon = (status: BotStatus): string => {
  const icons: Record<BotStatus, string> = {
    running: '▶️',
    stopped: '⏹️',
    paused: '⏸️',
    error: '❌',
    starting: '🔄',
    stopping: '⏹️'
  };
  return icons[status];
};

/**
 * Get connection status color
 */
export const getConnectionStatusColor = ({ 
  isConnected, 
  isConnecting, 
  connectionError 
}: ConnectionStatusState): string => {
  if (connectionError) return 'text-red-600 bg-red-100';
  if (isConnecting) return 'text-yellow-600 bg-yellow-100';
  if (isConnected) return 'text-green-600 bg-green-100';
  return 'text-gray-600 bg-gray-100';
};

/**
 * Get connection status text
 */
export const getConnectionStatusText = ({ 
  isConnected, 
  isConnecting, 
  connectionError 
}: ConnectionStatusState): string => {
  if (connectionError) return `Error: ${connectionError}`;
  if (isConnecting) return 'Connecting...';
  if (isConnected) return 'Connected';
  return 'Disconnected';
};

/**
 * Get risk level color
 */
export const getRiskColor = (riskScore: number): string => {
  if (riskScore <= 2) return 'text-green-600 bg-green-100';
  if (riskScore <= 5) return 'text-yellow-600 bg-yellow-100';
  if (riskScore <= 8) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
};

/**
 * Get risk level from score
 */
export const getRiskLevel = (riskScore: number): RiskLevel => {
  if (riskScore <= 2) return 'low';
  if (riskScore <= 5) return 'medium';
  if (riskScore <= 8) return 'high';
  return 'critical';
};

/**
 * Get running status color (simplified)
 */
export const getRunningStatusColor = (isRunning: boolean): string => {
  return isRunning ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100';
};

/**
 * Check if bot action can be performed
 */
export const canPerformBotAction = (status: BotStatus, action: string): boolean => {
  const actionMap: Record<string, BotStatus[]> = {
    start: ['stopped', 'paused', 'error'],
    stop: ['running', 'starting', 'paused'],
    pause: ['running'],
    resume: ['paused'],
    restart: ['running', 'stopped', 'paused', 'error']
  };
  
  return actionMap[action]?.includes(status) ?? false;
};

/**
 * Format currency value
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage value
 */
export const formatPercentage = (value: number, decimals = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format uptime in human readable format
 */
export const formatUptime = (uptime: number): string => {
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Get status badge classes (for UI components)
 */
export const getStatusBadgeClasses = (status: BotStatus): string => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const statusClasses = getBotStatusColor(status);
  return `${baseClasses} ${statusClasses}`;
};
