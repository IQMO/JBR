"use client";

import { CONSTANTS } from '@jabbr/shared/src';
import type { Bot, BotStatus } from '@jabbr/shared/src/types';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

import StrategyMonitor from '../../components/StrategyMonitor';
import useWebSocket from '../../hooks/useWebSocket';


// Enhanced filter options
interface BotFilters {
  status?: BotStatus | 'all';
  strategy?: string | 'all';
  exchange?: string | 'all';
  search?: string;
}

// Sort options
type SortField = 'name' | 'status' | 'strategy' | 'exchange' | 'createdAt' | 'performance';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [filteredBots, setFilteredBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bots' | 'strategies'>('bots');
  const [filters, setFilters] = useState<BotFilters>({ status: 'all', strategy: 'all', exchange: 'all', search: '' });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'createdAt', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);

  const {
    isConnected,
    subscribe
  } = useWebSocket({
    url: 'ws://localhost:3002/ws',
    onOpen: () => {
      // Subscribe to bot status updates
      subscribe(CONSTANTS.WS_CHANNELS.BOT_STATUS);
    },
    onMessage: (message) => {
      // Handle real-time bot status updates
      if (message.channel === CONSTANTS.WS_CHANNELS.BOT_STATUS && message.data) {
        setBots(prevBots => 
          prevBots.map(bot => 
            bot.id === message.data.botId 
              ? { ...bot, status: message.data.status }
              : bot
          )
        );
      }
    }
  });

  // Fetch bots on component mount
  useEffect(() => {
    fetchBots();
  }, []);

  // Filter and sort bots when filters or sort config changes
  useEffect(() => {
    let filtered = [...bots];

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(bot => bot.status === filters.status);
    }
    if (filters.strategy && filters.strategy !== 'all') {
      filtered = filtered.filter(bot => bot.strategy === filters.strategy);
    }
    if (filters.exchange && filters.exchange !== 'all') {
      filtered = filtered.filter(bot => bot.exchange === filters.exchange);
    }
    if (filters.search) {
      filtered = filtered.filter(bot => 
        bot.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
        bot.description?.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortConfig.field]; // eslint-disable-line @typescript-eslint/no-explicit-any
      let bValue: any = b[sortConfig.field]; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Handle special cases
      if (sortConfig.field === 'performance') {
        aValue = a.performance?.totalPnL || 0;
        bValue = b.performance?.totalPnL || 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } 
        return aValue < bValue ? 1 : -1;
      
    });

    setFilteredBots(filtered);
  }, [bots, filters, sortConfig]);

  const fetchBots = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/bots', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // JWT token
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bots: ${response.statusText}`);
      }

      const data = await response.json();
      setBots(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bots');
      console.error('Error fetching bots:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bot lifecycle control functions
  const handleBotAction = async (botId: string, action: 'start' | 'stop' | 'pause' | 'resume') => {
    try {
      const response = await fetch(`/api/bots/${botId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} bot`);
      }

      // Refresh bots list to get updated status
      await fetchBots();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} bot`);
    }
  };

  const getStatusColor = (status: BotStatus): string => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'stopped': return 'text-gray-600 bg-gray-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      case 'starting': case 'stopping': case 'pausing': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: BotStatus): string => {
    switch (status) {
      case 'running': return '🟢';
      case 'stopped': return '⚫';
      case 'paused': return '🟡';
      case 'starting': case 'stopping': case 'pausing': return '🔄';
      case 'error': return '🔴';
      default: return '⚫';
    }
  };

  const canPerformAction = (status: BotStatus, action: string): boolean => {
    switch (action) {
      case 'start': return ['stopped', 'error'].includes(status);
      case 'stop': return ['running', 'paused'].includes(status);
      case 'pause': return status === 'running';
      case 'resume': return status === 'paused';
      default: return false;
    }
  };

  // Enhanced bot management functions
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (filterType: keyof BotFilters, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  // Note: Bulk actions will be implemented in future iterations

  const deleteBot = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete bot');
      }

      await fetchBots();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete bot');
    }
  };

  // Get unique values for filter dropdowns
  const getUniqueStrategies = () => [...new Set(bots.map(bot => bot.strategy))];
  const getUniqueExchanges = () => [...new Set(bots.map(bot => bot.exchange))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading bots...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                🤖 Trading Bots
              </h1>
              <p className="text-lg text-gray-600">
                Manage your automated trading bots ({filteredBots.length} of {bots.length} bots)
              </p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                🔍 {showFilters ? 'Hide' : 'Show'} Filters
              </button>
              
              <Link
                href="/bots/create"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                ➕ Create New Bot
              </Link>
              
              <button
                onClick={fetchBots}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Enhanced Filters */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Filter & Search Bots</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Bot name or description..."
                    value={filters.search || ''}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status || 'all'}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="running">Running</option>
                    <option value="stopped">Stopped</option>
                    <option value="paused">Paused</option>
                    <option value="error">Error</option>
                    <option value="starting">Starting</option>
                    <option value="stopping">Stopping</option>
                  </select>
                </div>

                {/* Strategy Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
                  <select
                    value={filters.strategy || 'all'}
                    onChange={(e) => handleFilterChange('strategy', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Strategies</option>
                    {getUniqueStrategies().map(strategy => (
                      <option key={strategy} value={strategy}>{strategy}</option>
                    ))}
                  </select>
                </div>

                {/* Exchange Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exchange</label>
                  <select
                    value={filters.exchange || 'all'}
                    onChange={(e) => handleFilterChange('exchange', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Exchanges</option>
                    {getUniqueExchanges().map(exchange => (
                      <option key={exchange} value={exchange}>{exchange}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sort Options */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex space-x-2">
                  {[
                    { field: 'name' as SortField, label: 'Name' },
                    { field: 'status' as SortField, label: 'Status' },
                    { field: 'strategy' as SortField, label: 'Strategy' },
                    { field: 'createdAt' as SortField, label: 'Created' },
                    { field: 'performance' as SortField, label: 'Performance' },
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        sortConfig.field === field
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {label} {sortConfig.field === field && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WebSocket Status */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Real-time Status:</span>
            <span className={`text-sm font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('bots')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bots'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🤖 Bot Management
            </button>
            <button
              onClick={() => setActiveTab('strategies')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'strategies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Strategy Monitor
            </button>
          </nav>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'bots' && (
          <>
            {/* Bots Grid */}
            {bots.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Trading Bots Yet</h3>
                <p className="text-gray-600 mb-6">
                  Get started by creating your first automated trading bot
                </p>
                <Link
                  href="/bots/create"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-block"
                >
                  Create Your First Bot
                </Link>
              </div>
            ) : filteredBots.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bots Match Your Filters</h3>
                <p className="text-gray-600 mb-6">
                  Try adjusting your search criteria or clear the filters
                </p>
                <button
                  onClick={() => setFilters({ status: 'all', strategy: 'all', exchange: 'all', search: '' })}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBots.map((bot) => (
                  <div key={bot.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    {/* Bot Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{bot.name}</h3>
                        <p className="text-sm text-gray-600">{bot.description || 'No description'}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bot.status)}`}>
                        {getStatusIcon(bot.status)} {bot.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Bot Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Strategy:</span>
                        <span className="font-medium">{bot.strategy}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Exchange:</span>
                        <span className="font-medium">{bot.exchange}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">{new Date(bot.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    {bot.performance && (
                      <div className="bg-gray-50 rounded p-3 mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Performance</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Trades:</span>
                            <span className="font-medium ml-1">{bot.performance.totalTrades}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Win Rate:</span>
                            <span className="font-medium ml-1">{bot.performance.winRate}%</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Total P&L:</span>
                            <span className={`font-medium ml-1 ${bot.performance.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${bot.performance.totalPnL.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Max Drawdown:</span>
                            <span className={`font-medium ml-1 ${bot.performance.maxDrawdown >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {bot.performance.maxDrawdown.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bot Actions */}
                    <div className="flex space-x-2">
                      {canPerformAction(bot.status, 'start') && (
                        <button
                          onClick={() => handleBotAction(bot.id, 'start')}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          ▶️ Start
                        </button>
                      )}
                      
                      {canPerformAction(bot.status, 'pause') && (
                        <button
                          onClick={() => handleBotAction(bot.id, 'pause')}
                          className="flex-1 bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700 transition-colors"
                        >
                          ⏸️ Pause
                        </button>
                      )}
                      
                      {canPerformAction(bot.status, 'resume') && (
                        <button
                          onClick={() => handleBotAction(bot.id, 'resume')}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          ▶️ Resume
                        </button>
                      )}
                      
                      {canPerformAction(bot.status, 'stop') && (
                        <button
                          onClick={() => handleBotAction(bot.id, 'stop')}
                          className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          ⏹️ Stop
                        </button>
                      )}
                    </div>

                    {/* Enhanced Quick Actions */}
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => setSelectedBot(selectedBot === bot.id ? null : bot.id)}
                        className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300 transition-colors"
                      >
                        📊 Details
                      </button>
                      <Link
                        href={`/bots/${bot.id}/edit`}
                        className="flex-1 bg-blue-200 text-blue-700 px-3 py-2 rounded text-sm hover:bg-blue-300 transition-colors text-center"
                      >
                        ⚙️ Edit
                      </Link>
                      <button
                        onClick={() => deleteBot(bot.id)}
                        disabled={!canPerformAction(bot.status, 'stop')}
                        className="flex-1 bg-red-200 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {selectedBot === bot.id && (
                      <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium mb-2">Configuration</h5>
                            <div className="space-y-1 text-xs">
                              <div><span className="font-medium">Symbol:</span> {bot.configuration.symbol}</div>
                              <div><span className="font-medium">Timeframe:</span> {bot.configuration.timeframe}</div>
                              <div><span className="font-medium">Leverage:</span> {bot.configuration.leverage}x</div>
                              <div><span className="font-medium">Trade Amount:</span> ${bot.configuration.tradeAmount}</div>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium mb-2">Risk Management</h5>
                            <div className="space-y-1 text-xs">
                              <div><span className="font-medium">Max Daily Loss:</span> {bot.riskManagement.maxDailyLoss}%</div>
                              <div><span className="font-medium">Max Drawdown:</span> {bot.riskManagement.maxDrawdown}%</div>
                              <div><span className="font-medium">Max Trades:</span> {bot.riskManagement.maxConcurrentTrades}</div>
                              <div><span className="font-medium">Risk Score:</span> {bot.riskManagement.riskScore}/10</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <h5 className="font-medium mb-2">Advanced Details</h5>
                          <div className="grid grid-cols-1 gap-2 text-xs">
                            <div><span className="font-medium">Bot ID:</span> {bot.id}</div>
                            <div><span className="font-medium">API Key ID:</span> {bot.exchangeApiKeyId}</div>
                            <div><span className="font-medium">Created:</span> {new Date(bot.createdAt).toLocaleString()}</div>
                            <div><span className="font-medium">Last Updated:</span> {new Date(bot.updatedAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Enhanced Summary Stats */}
            {bots.length > 0 && (
              <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Portfolio Summary</h3>
                  {filteredBots.length !== bots.length && (
                    <span className="text-sm text-gray-500">
                      Showing {filteredBots.length} of {bots.length} bots
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{filteredBots.length}</div>
                    <div className="text-sm text-gray-600">Filtered Bots</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {filteredBots.filter(bot => bot.status === 'running').length}
                    </div>
                    <div className="text-sm text-gray-600">Running</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {filteredBots.filter(bot => bot.status === 'stopped').length}
                    </div>
                    <div className="text-sm text-gray-600">Stopped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {filteredBots.filter(bot => bot.status === 'paused').length}
                    </div>
                    <div className="text-sm text-gray-600">Paused</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {filteredBots.filter(bot => bot.status === 'error').length}
                    </div>
                    <div className="text-sm text-gray-600">Error</div>
                  </div>
                </div>
                
                {/* Performance Summary */}
                {filteredBots.some(bot => bot.performance) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-md font-semibold mb-3">Performance Overview</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className={`text-xl font-bold ${
                          filteredBots.reduce((sum, bot) => sum + (bot.performance?.totalPnL || 0), 0) >= 0
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${filteredBots.reduce((sum, bot) => sum + (bot.performance?.totalPnL || 0), 0).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">Total P&L</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-900">
                          {filteredBots.reduce((sum, bot) => sum + (bot.performance?.totalTrades || 0), 0)}
                        </div>
                        <div className="text-sm text-gray-600">Total Trades</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {filteredBots.length > 0 
                            ? (filteredBots.reduce((sum, bot) => sum + (bot.performance?.winRate || 0), 0) / filteredBots.filter(bot => bot.performance).length || 0).toFixed(1)
                            : '0.0'
                          }%
                        </div>
                        <div className="text-sm text-gray-600">Avg Win Rate</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'strategies' && (
          <StrategyMonitor />
        )}
      </div>
    </div>
  );
} 