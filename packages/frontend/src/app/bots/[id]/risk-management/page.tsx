"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { 
  PerBotRiskManagement, 
  RiskManagementTemplate,
  RiskManagementValidationResult 
} from '@jabbr/shared';
import RiskManagementForm from '../../../../components/RiskManagement/RiskManagementForm';
import { apiService } from '../../../../services/api';

export default function BotRiskManagementPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.id as string;
  
  const [riskManagement, setRiskManagement] = useState<PerBotRiskManagement | null>(null);
  const [templates, setTemplates] = useState<RiskManagementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botName, setBotName] = useState<string>('');
  const [accountBalance, setAccountBalance] = useState<number>(10000);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load bot details, risk management, and templates in parallel
        const [botResponse, riskResponse, templatesResponse] = await Promise.all([
          fetch(`/api/bots/${botId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          }),
          apiService.getBotRiskManagement(botId).catch(() => null), // Don't fail if no risk config exists
          apiService.getRiskManagementTemplates()
        ]);

        // Handle bot details
        if (!botResponse.ok) {
          throw new Error(`Failed to fetch bot: ${botResponse.statusText}`);
        }
        const botData = await botResponse.json();
        setBotName(botData.data.name);
        setAccountBalance(botData.data.accountBalance || 10000);

        // Handle risk management (might not exist yet)
        if (riskResponse?.success) {
          setRiskManagement(riskResponse.data);
        }

        // Handle templates
        if (templatesResponse.success) {
          setTemplates(templatesResponse.data);
        }

      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (botId) {
      loadData();
    }
  }, [botId]);

  const handleSave = async (data: PerBotRiskManagement) => {
    try {
      const response = await apiService.updateBotRiskManagement(botId, data);
      
      if (response.success) {
        setRiskManagement(response.data);
        
        // Show success message
        alert('Risk management configuration saved successfully!');
        
        // Optionally redirect back to bot details
        // router.push(`/bots/${botId}`);
      } else {
        throw new Error('Failed to save risk management configuration');
      }
    } catch (err) {
      console.error('Error saving risk management:', err);
      alert('Failed to save risk management configuration. Please try again.');
      throw err; // Re-throw to let the form handle the error state
    }
  };

  const handleValidate = async (data: PerBotRiskManagement): Promise<RiskManagementValidationResult> => {
    try {
      const response = await apiService.validateBotRiskManagement(botId, data, accountBalance);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Validation failed');
      }
    } catch (err) {
      console.error('Error validating risk management:', err);
      // Return a default validation result in case of error
      return {
        isValid: false,
        errors: [{
          field: 'general',
          message: 'Validation service temporarily unavailable',
          code: 'VALIDATION_ERROR',
          severity: 'error'
        }],
        warnings: [],
        riskLevel: 'medium',
        recommendations: []
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading risk management configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href={`/bots/${botId}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Bot
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link
                href={`/bots/${botId}`}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Bot
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Risk Management
                </h1>
                <p className="text-sm text-gray-600">
                  {botName} • Balance: ${accountBalance.toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href={`/bots/${botId}/edit`}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Edit Bot Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configure Risk Management
          </h2>
          <p className="text-gray-600">
            Set up comprehensive risk management parameters to protect your trading capital and optimize performance.
          </p>
        </div>

        {/* Risk Management Form */}
        <RiskManagementForm
          botId={botId}
          initialData={riskManagement || undefined}
          templates={templates}
          onSave={handleSave}
          onValidate={handleValidate}
          accountBalance={accountBalance}
        />

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">
            Risk Management Guidelines
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Position Sizing</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Never risk more than 2-5% of your account per trade</li>
                <li>Use percentage-based sizing for consistent risk</li>
                <li>Consider volatility when sizing positions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Stop Losses</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Always use stop losses to limit downside</li>
                <li>Keep stop losses between 1-5% for most strategies</li>
                <li>Use ATR-based stops for volatile markets</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Leverage</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Start with low leverage (2-5x) until proven profitable</li>
                <li>Higher leverage increases both profits and losses</li>
                <li>Never use more than 20x leverage for automated trading</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Daily Limits</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Set daily loss limits to prevent catastrophic losses</li>
                <li>Take breaks after hitting daily limits</li>
                <li>Review and adjust limits based on performance</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex justify-center space-x-4">
          <Link
            href={`/bots/${botId}`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            View Bot Dashboard
          </Link>
          <Link
            href={`/bots/${botId}/performance`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            View Performance
          </Link>
          <Link
            href="/bots"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            All Bots
          </Link>
        </div>
      </div>
    </div>
  );
}
