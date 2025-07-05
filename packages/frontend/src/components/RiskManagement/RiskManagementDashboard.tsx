"use client";

import React from 'react';
import Link from 'next/link';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  CogIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import type { PerBotRiskManagement, RiskMetrics } from '@jabbr/shared';

interface RiskManagementDashboardProps {
  botId: string;
  riskManagement?: PerBotRiskManagement;
  riskMetrics?: RiskMetrics;
  accountBalance: number;
  currentPnL: number;
  isTrading: boolean;
}

export default function RiskManagementDashboard({
  botId,
  riskManagement,
  riskMetrics,
  accountBalance,
  currentPnL,
  isTrading
}: RiskManagementDashboardProps) {
  
  if (!riskManagement) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 mr-3" />
          <div className="flex-1">
            <h3 className="text-lg font-medium text-yellow-800">
              Risk Management Not Configured
            </h3>
            <p className="text-yellow-700 mt-1">
              Set up risk management parameters to protect your trading capital.
            </p>
          </div>
          <Link
            href={`/bots/${botId}/risk-management`}
            className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            <CogIcon className="h-4 w-4 mr-2" />
            Configure
          </Link>
        </div>
      </div>
    );
  }

  const getRiskLevelColor = (level: number) => {
    if (level <= 3) return 'text-green-600 bg-green-50 border-green-200';
    if (level <= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (level <= 8) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusIcon = (isGood: boolean) => {
    return isGood ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <XCircleIcon className="h-5 w-5 text-red-500" />
    );
  };

  const dailyLossPercent = (Math.abs(currentPnL) / accountBalance) * 100;
  const exposurePercent = riskMetrics?.exposurePercentage || 0;
  const currentDrawdown = riskMetrics?.currentDrawdown || 0;

  const isWithinDailyLossLimit = dailyLossPercent <= riskManagement.maxDailyLossPercent;
  const isWithinDrawdownLimit = currentDrawdown <= riskManagement.maxDrawdown;
  const isWithinExposureLimit = exposurePercent <= riskManagement.maxExposurePercent;

  const riskAlerts = [];
  if (!isWithinDailyLossLimit) {
    riskAlerts.push(`Daily loss (${dailyLossPercent.toFixed(2)}%) exceeds limit (${riskManagement.maxDailyLossPercent}%)`);
  }
  if (!isWithinDrawdownLimit) {
    riskAlerts.push(`Drawdown (${currentDrawdown.toFixed(2)}%) exceeds limit (${riskManagement.maxDrawdown}%)`);
  }
  if (!isWithinExposureLimit) {
    riskAlerts.push(`Exposure (${exposurePercent.toFixed(2)}%) exceeds limit (${riskManagement.maxExposurePercent}%)`);
  }

  return (
    <div className="space-y-6">
      {/* Risk Status Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Risk Management Status</h3>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskLevelColor(riskManagement.riskScore)}`}>
              Risk Level: {riskManagement.riskScore}/10
            </span>
            <Link
              href={`/bots/${botId}/risk-management`}
              className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <CogIcon className="h-4 w-4 mr-1" />
              Configure
            </Link>
          </div>
        </div>

        {/* Risk Alerts */}
        {riskAlerts.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
              <h4 className="text-red-800 font-medium">Risk Alerts</h4>
            </div>
            <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
              {riskAlerts.map((alert, index) => (
                <li key={index}>{alert}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Daily Loss</span>
              {getStatusIcon(isWithinDailyLossLimit)}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dailyLossPercent.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-500">
              Limit: {riskManagement.maxDailyLossPercent}%
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Drawdown</span>
              {getStatusIcon(isWithinDrawdownLimit)}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {currentDrawdown.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-500">
              Limit: {riskManagement.maxDrawdown}%
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Exposure</span>
              {getStatusIcon(isWithinExposureLimit)}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {exposurePercent.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-500">
              Limit: {riskManagement.maxExposurePercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Risk Parameters Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Current Risk Parameters</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h5 className="font-medium text-gray-700">Position Sizing</h5>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Max Position Size:</span>
                <span className="font-medium">${riskManagement.maxPositionSize.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Position %:</span>
                <span className="font-medium">{riskManagement.maxPositionSizePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Method:</span>
                <span className="font-medium capitalize">{riskManagement.positionSizingMethod}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-medium text-gray-700">Stop Loss & Take Profit</h5>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Stop Loss:</span>
                <span className="font-medium">{riskManagement.stopLossValue}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Take Profit:</span>
                <span className="font-medium">{riskManagement.takeProfitValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium capitalize">{riskManagement.stopLossType}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-medium text-gray-700">Trading Limits</h5>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Max Leverage:</span>
                <span className="font-medium">{riskManagement.maxLeverage}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Concurrent Trades:</span>
                <span className="font-medium">{riskManagement.maxConcurrentTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Emergency Stop:</span>
                <span className={`font-medium ${riskManagement.emergencyStop ? 'text-red-600' : 'text-green-600'}`}>
                  {riskManagement.emergencyStop ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Time-Based Limits */}
        {riskManagement.timeBasedLimits.enabled && (
          <div className="mt-6 pt-6 border-t">
            <h5 className="font-medium text-gray-700 mb-3">Time-Based Limits</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Trades/Hour:</span>
                <span className="font-medium">{riskManagement.timeBasedLimits.maxTradesPerHour}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trades/Day:</span>
                <span className="font-medium">{riskManagement.timeBasedLimits.maxTradesPerDay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cooldown:</span>
                <span className="font-medium">{riskManagement.timeBasedLimits.cooldownPeriodMinutes}min</span>
              </div>
            </div>
          </div>
        )}

        {/* Risk Monitoring */}
        {riskManagement.riskMonitoring.enabled && (
          <div className="mt-6 pt-6 border-t">
            <h5 className="font-medium text-gray-700 mb-3">Risk Monitoring</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Alert Thresholds:</span>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Daily Loss:</span>
                    <span>{riskManagement.riskMonitoring.alertThresholds.dailyLossPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Drawdown:</span>
                    <span>{riskManagement.riskMonitoring.alertThresholds.drawdownPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Exposure:</span>
                    <span>{riskManagement.riskMonitoring.alertThresholds.exposurePercent}%</span>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Auto Actions:</span>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reduce Exposure:</span>
                    <span className={riskManagement.riskMonitoring.autoReduceExposure ? 'text-green-600' : 'text-gray-400'}>
                      {riskManagement.riskMonitoring.autoReduceExposure ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stop Trading:</span>
                    <span className={riskManagement.riskMonitoring.autoStopTrading ? 'text-green-600' : 'text-gray-400'}>
                      {riskManagement.riskMonitoring.autoStopTrading ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center space-x-4">
        <Link
          href={`/bots/${botId}/risk-management`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <CogIcon className="h-4 w-4 mr-2" />
          Edit Risk Settings
        </Link>
        <Link
          href={`/bots/${botId}/performance`}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          <ChartBarIcon className="h-4 w-4 mr-2" />
          View Performance
        </Link>
      </div>
    </div>
  );
}
