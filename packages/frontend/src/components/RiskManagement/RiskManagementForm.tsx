"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { 
  PerBotRiskManagement, 
  RiskManagementValidationResult,
  RiskManagementTemplate 
} from '@jabbr/shared';

// Form validation schema
const riskManagementSchema = z.object({
  maxPositionSize: z.number().min(0, "Position size must be positive"),
  maxPositionSizePercent: z.number().min(0.1).max(50, "Position size percentage must be between 0.1% and 50%"),
  positionSizingMethod: z.enum(['fixed', 'percentage', 'kelly', 'volatility-adjusted']),
  
  stopLossType: z.enum(['percentage', 'fixed', 'atr', 'dynamic']),
  stopLossValue: z.number().min(0.1).max(20, "Stop loss must be between 0.1% and 20%"),
  takeProfitType: z.enum(['percentage', 'fixed', 'risk-reward-ratio', 'dynamic']),
  takeProfitValue: z.number().min(0.1).max(100, "Take profit must be positive"),
  
  maxDailyLoss: z.number().min(0, "Daily loss limit must be positive"),
  maxDailyLossPercent: z.number().min(0.1).max(10, "Daily loss percentage must be between 0.1% and 10%"),
  maxDrawdown: z.number().min(1).max(50, "Max drawdown must be between 1% and 50%"),
  maxConcurrentTrades: z.number().min(1).max(20, "Concurrent trades must be between 1 and 20"),
  
  maxLeverage: z.number().min(1).max(100, "Leverage must be between 1x and 100x"),
  maxExposure: z.number().min(0, "Max exposure must be positive"),
  maxExposurePercent: z.number().min(1).max(100, "Exposure percentage must be between 1% and 100%"),
  
  riskScore: z.number().min(1).max(10, "Risk score must be between 1 and 10"),
  emergencyStop: z.boolean(),
  enableRiskManagement: z.boolean(),
  
  correlationLimit: z.number().min(0).max(1, "Correlation limit must be between 0 and 1"),
  volatilityAdjustment: z.boolean(),
  
  timeBasedLimits: z.object({
    enabled: z.boolean(),
    maxTradesPerHour: z.number().min(1).max(100, "Trades per hour must be between 1 and 100"),
    maxTradesPerDay: z.number().min(1).max(1000, "Trades per day must be between 1 and 1000"),
    cooldownPeriodMinutes: z.number().min(0).max(60, "Cooldown period must be between 0 and 60 minutes"),
  }),
  
  riskMonitoring: z.object({
    enabled: z.boolean(),
    alertThresholds: z.object({
      dailyLossPercent: z.number().min(0.1).max(10, "Alert threshold must be between 0.1% and 10%"),
      drawdownPercent: z.number().min(1).max(50, "Drawdown alert must be between 1% and 50%"),
      exposurePercent: z.number().min(1).max(100, "Exposure alert must be between 1% and 100%"),
    }),
    autoReduceExposure: z.boolean(),
    autoStopTrading: z.boolean(),
  }),
});

type RiskManagementFormData = z.infer<typeof riskManagementSchema>;

interface RiskManagementFormProps {
  botId: string;
  initialData?: PerBotRiskManagement;
  templates?: RiskManagementTemplate[];
  onSave: (data: PerBotRiskManagement) => Promise<void>;
  onValidate?: (data: PerBotRiskManagement) => Promise<RiskManagementValidationResult>;
  loading?: boolean;
  accountBalance?: number;
}

export default function RiskManagementForm({
  botId,
  initialData,
  templates = [],
  onSave,
  onValidate,
  loading = false,
  accountBalance = 10000
}: RiskManagementFormProps) {
  const [validation, setValidation] = useState<RiskManagementValidationResult | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
    getValues
  } = useForm<RiskManagementFormData>({
    resolver: zodResolver(riskManagementSchema),
    defaultValues: initialData ? {
      maxPositionSize: initialData.maxPositionSize,
      maxPositionSizePercent: initialData.maxPositionSizePercent,
      positionSizingMethod: initialData.positionSizingMethod,
      stopLossType: initialData.stopLossType,
      stopLossValue: initialData.stopLossValue,
      takeProfitType: initialData.takeProfitType,
      takeProfitValue: initialData.takeProfitValue,
      maxDailyLoss: initialData.maxDailyLoss,
      maxDailyLossPercent: initialData.maxDailyLossPercent,
      maxDrawdown: initialData.maxDrawdown,
      maxConcurrentTrades: initialData.maxConcurrentTrades,
      maxLeverage: initialData.maxLeverage,
      maxExposure: initialData.maxExposure,
      maxExposurePercent: initialData.maxExposurePercent,
      riskScore: initialData.riskScore,
      emergencyStop: initialData.emergencyStop,
      enableRiskManagement: initialData.enableRiskManagement,
      correlationLimit: initialData.correlationLimit,
      volatilityAdjustment: initialData.volatilityAdjustment,
      timeBasedLimits: initialData.timeBasedLimits,
      riskMonitoring: initialData.riskMonitoring,
    } : undefined
  });

  // Watch form values for real-time validation
  const formValues = watch();

  // Load template when selected
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        const config = template.configuration;
        Object.keys(config).forEach(key => {
          if (key in formValues) {
            setValue(key as keyof RiskManagementFormData, (config as any)[key]);
          }
        });
      }
    }
  };

  // Real-time validation
  useEffect(() => {
    if (onValidate && isDirty) {
      const validateForm = async () => {
        try {
          setValidating(true);
          const currentValues = getValues();
          const riskManagement: PerBotRiskManagement = {
            ...currentValues,
            templateName: selectedTemplate ? templates.find(t => t.id === selectedTemplate)?.name : undefined,
            lastUpdated: new Date().toISOString(),
            updatedBy: 'current-user' // This should come from auth context
          };
          
          const result = await onValidate(riskManagement);
          setValidation(result);
        } catch (error) {
          console.error('Validation error:', error);
        } finally {
          setValidating(false);
        }
      };

      const timeoutId = setTimeout(validateForm, 500); // Debounce validation
      return () => clearTimeout(timeoutId);
    }
  }, [formValues, onValidate, isDirty, getValues, selectedTemplate, templates]);

  const onSubmit = async (data: RiskManagementFormData) => {
    try {
      setSaving(true);
      
      const riskManagement: PerBotRiskManagement = {
        ...data,
        templateName: selectedTemplate ? templates.find(t => t.id === selectedTemplate)?.name : undefined,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'current-user' // This should come from auth context
      };

      await onSave(riskManagement);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const getRiskLevelColor = (level?: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'extreme': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Risk Management Configuration</h2>
        <p className="text-gray-600">Configure risk parameters for your trading bot</p>
      </div>

      {/* Template Selection */}
      {templates.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Setup Templates
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a template...</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Validation Results */}
      {validation && (
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">Validation Results</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(validation.riskLevel)}`}>
              {validation.riskLevel.toUpperCase()} RISK
            </span>
          </div>
          
          {validation.errors.length > 0 && (
            <div className="mb-3">
              <h4 className="text-red-600 font-medium mb-2">Errors:</h4>
              <ul className="list-disc list-inside text-red-600 text-sm">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div className="mb-3">
              <h4 className="text-yellow-600 font-medium mb-2">Warnings:</h4>
              <ul className="list-disc list-inside text-yellow-600 text-sm">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.recommendations.length > 0 && (
            <div>
              <h4 className="text-blue-600 font-medium mb-2">Recommendations:</h4>
              <ul className="list-disc list-inside text-blue-600 text-sm">
                {validation.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Position Sizing Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Position Sizing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Position Size (USD)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('maxPositionSize', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxPositionSize && (
                <p className="text-red-500 text-sm mt-1">{errors.maxPositionSize.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Position Size (% of Balance)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('maxPositionSizePercent', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxPositionSizePercent && (
                <p className="text-red-500 text-sm mt-1">{errors.maxPositionSizePercent.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position Sizing Method
              </label>
              <select
                {...register('positionSizingMethod')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage of Balance</option>
                <option value="kelly">Kelly Criterion</option>
                <option value="volatility-adjusted">Volatility Adjusted</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stop Loss & Take Profit Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Stop Loss & Take Profit</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stop Loss Type
              </label>
              <select
                {...register('stopLossType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Price</option>
                <option value="atr">ATR Based</option>
                <option value="dynamic">Dynamic</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stop Loss Value (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('stopLossValue', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.stopLossValue && (
                <p className="text-red-500 text-sm mt-1">{errors.stopLossValue.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Take Profit Type
              </label>
              <select
                {...register('takeProfitType')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Price</option>
                <option value="risk-reward-ratio">Risk/Reward Ratio</option>
                <option value="dynamic">Dynamic</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Take Profit Value
              </label>
              <input
                type="number"
                step="0.1"
                {...register('takeProfitValue', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.takeProfitValue && (
                <p className="text-red-500 text-sm mt-1">{errors.takeProfitValue.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Risk Limits Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Limits</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Daily Loss (USD)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('maxDailyLoss', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxDailyLoss && (
                <p className="text-red-500 text-sm mt-1">{errors.maxDailyLoss.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Daily Loss (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('maxDailyLossPercent', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxDailyLossPercent && (
                <p className="text-red-500 text-sm mt-1">{errors.maxDailyLossPercent.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Drawdown (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('maxDrawdown', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxDrawdown && (
                <p className="text-red-500 text-sm mt-1">{errors.maxDrawdown.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Concurrent Trades
              </label>
              <input
                type="number"
                {...register('maxConcurrentTrades', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxConcurrentTrades && (
                <p className="text-red-500 text-sm mt-1">{errors.maxConcurrentTrades.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Leverage & Exposure Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Leverage & Exposure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Leverage
              </label>
              <input
                type="number"
                step="0.1"
                {...register('maxLeverage', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxLeverage && (
                <p className="text-red-500 text-sm mt-1">{errors.maxLeverage.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Exposure (USD)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('maxExposure', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxExposure && (
                <p className="text-red-500 text-sm mt-1">{errors.maxExposure.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Exposure (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('maxExposurePercent', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.maxExposurePercent && (
                <p className="text-red-500 text-sm mt-1">{errors.maxExposurePercent.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Risk Controls Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Controls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Score (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                {...register('riskScore', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.riskScore && (
                <p className="text-red-500 text-sm mt-1">{errors.riskScore.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correlation Limit (0-1)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                {...register('correlationLimit', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.correlationLimit && (
                <p className="text-red-500 text-sm mt-1">{errors.correlationLimit.message}</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('emergencyStop')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Emergency Stop
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('enableRiskManagement')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Enable Risk Management
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('volatilityAdjustment')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Volatility Adjustment
              </label>
            </div>
          </div>
        </div>

        {/* Time-Based Limits Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Time-Based Limits</h3>
          <div className="mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('timeBasedLimits.enabled')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Enable Time-Based Limits
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Trades Per Hour
              </label>
              <input
                type="number"
                {...register('timeBasedLimits.maxTradesPerHour', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Trades Per Day
              </label>
              <input
                type="number"
                {...register('timeBasedLimits.maxTradesPerDay', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cooldown Period (minutes)
              </label>
              <input
                type="number"
                {...register('timeBasedLimits.cooldownPeriodMinutes', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Risk Monitoring Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Monitoring</h3>
          <div className="mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('riskMonitoring.enabled')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Enable Risk Monitoring
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Loss Alert (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('riskMonitoring.alertThresholds.dailyLossPercent', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Drawdown Alert (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('riskMonitoring.alertThresholds.drawdownPercent', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exposure Alert (%)
              </label>
              <input
                type="number"
                step="0.1"
                {...register('riskMonitoring.alertThresholds.exposurePercent', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('riskMonitoring.autoReduceExposure')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Auto Reduce Exposure
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('riskMonitoring.autoStopTrading')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Auto Stop Trading
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => reset()}
            disabled={loading || saving}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Reset
          </button>
          
          <button
            type="submit"
            disabled={loading || saving || !isDirty || (validation && !validation.isValid)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
      
      {validating && (
        <div className="mt-4 text-center text-gray-500">
          Validating configuration...
        </div>
      )}
    </div>
  );
}
