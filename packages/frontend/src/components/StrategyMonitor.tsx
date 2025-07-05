/**
 * Strategy Monitor Component
 * 
 * Real-time monitoring component for strategy performance, signals, and execution.
 * Integrates with WebSocket to display live strategy data.
 */

"use client";

import React, { useState } from 'react';
import type { StrategyPerformanceMetrics, SignalSummary} from '@jabbr/shared/src';
import { CONSTANTS } from '@jabbr/shared/src';

import useWebSocket from '../hooks/useWebSocket';

// Temporary type definitions until shared types are fully available
interface StrategyUpdateMessage {
  type: 'performance' | 'signal' | 'trade' | 'position' | 'risk_alert' | 'state_change';
  botId: string;
  strategyName: string;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  timestamp: Date;
}

interface StrategyMonitorProps {
  botId?: string; // If provided, monitor specific bot, otherwise monitor all
  className?: string;
}

interface StrategyData {
  [botId: string]: StrategyPerformanceMetrics;
}

export const StrategyMonitor: React.FC<StrategyMonitorProps> = ({ 
  botId, 
  className = "" 
}) => {
  const [strategies, setStrategies] = useState<StrategyData>({});
  const [recentSignals, setRecentSignals] = useState<SignalSummary[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<Array<{ botId: string; alerts: string[]; timestamp: Date }>>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(botId || null);

  const {
    isConnected,
    subscribe
  } = useWebSocket({
    url: 'ws://localhost:3002/ws',
    onOpen: () => {
      // Subscribe to strategy monitoring channels
      subscribe(CONSTANTS.WS_CHANNELS.SIGNALS);
      subscribe(CONSTANTS.WS_CHANNELS.BOT_STATUS);
      subscribe(CONSTANTS.WS_CHANNELS.POSITIONS);
      subscribe(CONSTANTS.WS_CHANNELS.TRADES);
    },
    onMessage: (message: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      handleWebSocketMessage(message);
    }
  });

  const handleWebSocketMessage = (message: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (message.channel === CONSTANTS.WS_CHANNELS.SIGNALS && message.data) {
      const update: StrategyUpdateMessage = message.data;
      handleStrategyUpdate(update);
    } else if (message.channel === CONSTANTS.WS_CHANNELS.BOT_STATUS && message.data) {
      handleBotStatusUpdate(message.data);
    }
  };

  const handleStrategyUpdate = (update: StrategyUpdateMessage) => {
    const { type, botId: updateBotId, data, timestamp } = update;

    // Filter by specific bot if specified
    if (botId && updateBotId !== botId) {return;}

    switch (type) {
      case 'performance':
        if (data.metrics) {
          setStrategies(prev => ({
            ...prev,
            [updateBotId]: data.metrics
          }));
        }
        break;

      case 'signal':
        if (data.signal) {
          setRecentSignals(prev => {
            // Keep last 20 signals
            return [data.signal, ...prev].slice(0, 20);
          });
        }
        break;

      case 'trade':
        // Update strategy metrics if trade data includes metrics
        if (data.metrics) {
          setStrategies(prev => ({
            ...prev,
            [updateBotId]: data.metrics
          }));
        }
        break;

      case 'state_change':
        if (data.metrics) {
          setStrategies(prev => ({
            ...prev,
            [updateBotId]: data.metrics
          }));
        }
        break;

      case 'risk_alert':
        if (data.alerts) {
          setRiskAlerts(prev => {
            const newAlert = {
              botId: updateBotId,
              alerts: data.alerts,
              timestamp: new Date(timestamp)
            };
            return [newAlert, ...prev].slice(0, 10); // Keep last 10 alerts
          });
        }
        break;
    }
  };

  const handleBotStatusUpdate = (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (data.botId && data.strategy) {
      // Filter by specific bot if specified
      if (botId && data.botId !== botId) {return;}

      setStrategies(prev => ({
        ...prev,
        [data.botId]: {
          ...prev[data.botId],
          ...data.strategy,
          timestamp: new Date()
        }
      }));
    }
  };

  const getStrategyMetrics = (botId: string): StrategyPerformanceMetrics | null => {
    return strategies[botId] || null;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatUptime = (uptime: number): string => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } 
      return `${seconds}s`;
    
  };

  const getRiskColor = (riskScore: number): string => {
    if (riskScore <= 3) {return 'text-green-600 bg-green-100';}
    if (riskScore <= 6) {return 'text-yellow-600 bg-yellow-100';}
    return 'text-red-600 bg-red-100';
  };

  const getStatusColor = (isRunning: boolean): string => {
    return isRunning ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100';
  };

  const selectedStrategy = selectedBotId ? getStrategyMetrics(selectedBotId) : null;
  const allStrategies = Object.entries(strategies);

  return (
    <div className={`strategy-monitor ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            📊 Strategy Monitor
          </h2>
          <p className="text-gray-600">
            Real-time strategy performance and signal monitoring
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className={`text-sm font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </span>
          
          {allStrategies.length > 1 && (
            <select
              value={selectedBotId || ''}
              onChange={(e) => setSelectedBotId(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Strategies</option>
              {allStrategies.map(([botId, strategy]) => (
                <option key={botId} value={botId}>
                  {strategy.strategyName} ({botId})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">⚠️ Risk Alerts</h3>
          <div className="space-y-2">
            {riskAlerts.slice(0, 3).map((alert, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-red-700">Bot {alert.botId}:</span>
                  <span className="ml-2 text-red-600">{alert.alerts.join(', ')}</span>
                </div>
                <span className="text-xs text-red-500">
                  {alert.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Performance Overview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Strategy Performance</h3>
            
            {allStrategies.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-600">No active strategies found</p>
                <p className="text-sm text-gray-500 mt-2">
                  Start a bot to see real-time strategy monitoring
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(selectedStrategy ? [[selectedBotId!, selectedStrategy]] : allStrategies)
                  .filter(([, strategy]) => typeof strategy === 'object' && strategy !== null)
                  .map(([strategyBotId, strategyData]) => {
                    const strategy = strategyData as StrategyPerformanceMetrics;
                    return (
                  <div key={String(strategyBotId)} className="border border-gray-200 rounded-lg p-4">
                    {/* Strategy Header */}
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {strategy.strategyName} v{strategy.strategyVersion}
                        </h4>
                        <p className="text-sm text-gray-600">Bot ID: {String(strategyBotId)}</p>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(strategy.isRunning)}`}>
                          {strategy.isRunning ? '🟢 Running' : '⚫ Stopped'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(strategy.riskMetrics.riskScore)}`}>
                          Risk: {strategy.riskMetrics.riskScore}/10
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className={`text-xl font-bold ${strategy.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(strategy.totalPnL)}
                        </div>
                        <div className="text-xs text-gray-600">Total P&L</div>
                      </div>
                      
                      <div className="text-center">
                        <div className={`text-xl font-bold ${strategy.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(strategy.dailyPnL)}
                        </div>
                        <div className="text-xs text-gray-600">Daily P&L</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-900">
                          {strategy.winRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">Win Rate</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-900">
                          {strategy.totalTrades}
                        </div>
                        <div className="text-xs text-gray-600">Total Trades</div>
                      </div>
                    </div>

                    {/* Detailed Stats */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Uptime:</span>
                        <span className="ml-2 font-medium">{formatUptime(strategy.uptime)}</span>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">Max Drawdown:</span>
                        <span className="ml-2 font-medium text-red-600">
                          {formatPercentage(strategy.maxDrawdown)}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">Current Drawdown:</span>
                        <span className="ml-2 font-medium text-orange-600">
                          {formatPercentage(strategy.currentDrawdown)}
                        </span>
                      </div>
                    </div>

                    {/* Current Positions */}
                    {strategy.currentPositions && strategy.currentPositions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="font-medium text-gray-900 mb-2">Current Positions</h5>
                        <div className="space-y-2">
                          {strategy.currentPositions.map((position: any, index: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span className="font-medium">
                                {position.symbol} {position.side.toUpperCase()}
                              </span>
                              <span className="text-gray-600">
                                Size: {position.size} @ {formatCurrency(position.entryPrice)}
                              </span>
                              <span className={`font-medium ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(position.unrealizedPnL)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Signals */}
        <div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Signals</h3>
            
            {recentSignals.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📡</div>
                <p className="text-gray-600 text-sm">No signals yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="border border-gray-200 rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">
                        {signal.symbol}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        signal.side === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {signal.side.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Price:</span>
                        <span className="font-medium">{formatCurrency(signal.price)}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Confidence:</span>
                        <span className="font-medium">{(signal.confidence * 100).toFixed(1)}%</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="font-medium">
                          {signal.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className={`font-medium ${
                          signal.executed 
                            ? signal.result === 'win' 
                              ? 'text-green-600' 
                              : signal.result === 'loss' 
                                ? 'text-red-600' 
                                : 'text-blue-600'
                            : 'text-yellow-600'
                        }`}>
                          {signal.executed 
                            ? signal.result?.toUpperCase() || 'EXECUTED' 
                            : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {allStrategies.length > 1 && !selectedBotId && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Portfolio Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{allStrategies.length}</div>
              <div className="text-sm text-gray-600">Active Strategies</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {allStrategies.filter(([, strategy]) => strategy.isRunning).length}
              </div>
              <div className="text-sm text-gray-600">Running</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                allStrategies.reduce((sum, [, strategy]) => sum + strategy.totalPnL, 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(allStrategies.reduce((sum, [, strategy]) => sum + strategy.totalPnL, 0))}
              </div>
              <div className="text-sm text-gray-600">Total P&L</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {allStrategies.reduce((sum, [, strategy]) => sum + strategy.totalTrades, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Trades</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {allStrategies.length > 0 
                  ? (allStrategies.reduce((sum, [, strategy]) => sum + strategy.winRate, 0) / allStrategies.length).toFixed(1)
                  : '0.0'
                }%
              </div>
              <div className="text-sm text-gray-600">Avg Win Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyMonitor;
