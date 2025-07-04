"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import type { Bot } from '@jabbr/shared/src/types';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Form validation schema
const editBotSchema = z.object({
  name: z.string().min(3, "Bot name must be at least 3 characters"),
  description: z.string().optional(),
  configuration: z.object({
    symbol: z.string().min(1, "Symbol is required"),
    timeframe: z.string().min(1, "Timeframe is required"),
    maxPositionSize: z.number().min(0, "Position size must be positive"),
    leverage: z.number().min(1).max(100, "Leverage must be between 1-100"),
    stopLoss: z.number().min(0).max(100, "Stop loss must be between 0-100%"),
    takeProfit: z.number().min(0).max(100, "Take profit must be between 0-100%"),
    tradeAmount: z.number().min(1, "Trade amount must be positive"),
  }),
  riskManagement: z.object({
    maxDailyLoss: z.number().min(0).max(100, "Max daily loss must be between 0-100%"),
    maxDrawdown: z.number().min(0).max(100, "Max drawdown must be between 0-100%"),
    maxConcurrentTrades: z.number().min(1, "Must allow at least 1 concurrent trade"),
    emergencyStop: z.boolean(),
    riskScore: z.number().min(1).max(10, "Risk score must be between 1-10"),
  }),
});

type EditBotFormData = z.infer<typeof editBotSchema>;

const TIMEFRAMES = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
];

export default function EditBotPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.id as string;
  
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditBotFormData>({
    resolver: zodResolver(editBotSchema),
  });

  // Load bot data
  useEffect(() => {
    const fetchBot = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/bots/${botId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch bot: ${response.statusText}`);
        }

        const data = await response.json();
        const botData = data.data;
        setBot(botData);

        // Populate form with bot data
        reset({
          name: botData.name,
          description: botData.description || '',
          configuration: {
            symbol: botData.configuration.symbol,
            timeframe: botData.configuration.timeframe,
            maxPositionSize: botData.configuration.maxPositionSize,
            leverage: botData.configuration.leverage,
            stopLoss: botData.configuration.stopLoss,
            takeProfit: botData.configuration.takeProfit,
            tradeAmount: botData.configuration.tradeAmount,
          },
          riskManagement: {
            maxDailyLoss: botData.riskManagement.maxDailyLoss,
            maxDrawdown: botData.riskManagement.maxDrawdown,
            maxConcurrentTrades: botData.riskManagement.maxConcurrentTrades,
            emergencyStop: botData.riskManagement.emergencyStop,
            riskScore: botData.riskManagement.riskScore,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bot');
        console.error('Error fetching bot:', err);
      } finally {
        setLoading(false);
      }
    };

    if (botId) {
      fetchBot();
    }
  }, [botId, reset]);

  const onSubmit = async (data: EditBotFormData) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/bots/${botId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to update bot: ${response.statusText}`);
      }

      // Redirect back to bots page
      router.push('/bots');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bot');
      console.error('Error updating bot:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading bot configuration...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !bot) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
          <div className="mt-4">
            <Link href="/bots" className="text-blue-600 hover:text-blue-800">
              ← Back to Bots
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Edit Bot: {bot?.name}
            </h1>
            <p className="text-gray-600">
              Modify bot configuration and risk management settings
            </p>
          </div>
          <Link
            href="/bots"
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            ← Back to Bots
          </Link>
        </div>

        {/* Bot Status Warning */}
        {bot && bot.status !== 'stopped' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <strong>Warning:</strong> This bot is currently {bot.status}. Stop the bot before making configuration changes for safety.
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bot Name *
                </label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter bot name"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  {...register('description')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter bot description"
                />
              </div>
            </div>
          </div>

          {/* Trading Configuration */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Trading Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol *
                </label>
                <input
                  {...register('configuration.symbol')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="BTCUSDT"
                />
                {errors.configuration?.symbol && (
                  <p className="text-red-500 text-sm mt-1">{errors.configuration.symbol.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe *
                </label>
                <select
                  {...register('configuration.timeframe')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEFRAMES.map(tf => (
                    <option key={tf.value} value={tf.value}>{tf.label}</option>
                  ))}
                </select>
                {errors.configuration?.timeframe && (
                  <p className="text-red-500 text-sm mt-1">{errors.configuration.timeframe.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leverage *
                </label>
                <input
                  type="number"
                  {...register('configuration.leverage', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="100"
                />
                {errors.configuration?.leverage && (
                  <p className="text-red-500 text-sm mt-1">{errors.configuration.leverage.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trade Amount (USDT) *
                </label>
                <input
                  type="number"
                  {...register('configuration.tradeAmount', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  step="0.01"
                />
                {errors.configuration?.tradeAmount && (
                  <p className="text-red-500 text-sm mt-1">{errors.configuration.tradeAmount.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Loss (%) *
                </label>
                <input
                  type="number"
                  {...register('configuration.stopLoss', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
                {errors.configuration?.stopLoss && (
                  <p className="text-red-500 text-sm mt-1">{errors.configuration.stopLoss.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Take Profit (%) *
                </label>
                <input
                  type="number"
                  {...register('configuration.takeProfit', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
                {errors.configuration?.takeProfit && (
                  <p className="text-red-500 text-sm mt-1">{errors.configuration.takeProfit.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Risk Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Daily Loss (%) *
                </label>
                <input
                  type="number"
                  {...register('riskManagement.maxDailyLoss', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
                {errors.riskManagement?.maxDailyLoss && (
                  <p className="text-red-500 text-sm mt-1">{errors.riskManagement.maxDailyLoss.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Drawdown (%) *
                </label>
                <input
                  type="number"
                  {...register('riskManagement.maxDrawdown', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
                {errors.riskManagement?.maxDrawdown && (
                  <p className="text-red-500 text-sm mt-1">{errors.riskManagement.maxDrawdown.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Concurrent Trades *
                </label>
                <input
                  type="number"
                  {...register('riskManagement.maxConcurrentTrades', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="10"
                />
                {errors.riskManagement?.maxConcurrentTrades && (
                  <p className="text-red-500 text-sm mt-1">{errors.riskManagement.maxConcurrentTrades.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Score (1-10) *
                </label>
                <input
                  type="number"
                  {...register('riskManagement.riskScore', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="10"
                />
                {errors.riskManagement?.riskScore && (
                  <p className="text-red-500 text-sm mt-1">{errors.riskManagement.riskScore.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('riskManagement.emergencyStop')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable Emergency Stop
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically stop the bot if risk limits are exceeded
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600">
              {isDirty ? 'You have unsaved changes' : 'No changes made'}
            </div>
            
            <div className="flex space-x-4">
              <Link
                href="/bots"
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
