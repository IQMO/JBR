'use client';

import React, { useState, useEffect, useMemo } from 'react';

import { useWebSocketContext } from '../contexts/WebSocketContext';
import { apiService } from '../services/api';
import ErrorHandler from '../utils/errorHandler';
import { componentClasses, getPnLColor } from '../utils/theme';

import { ErrorBoundaryWrapper } from './ErrorBoundary';
import { LoadingTable } from './Loading';

// Types for trading activity data
interface Trade {
  id: string;
  botId: string;
  botName: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop-limit';
  amount: number;
  price: number;
  executedPrice?: number;
  executedAmount?: number;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  fee: number;
  pnl?: number;
  timestamp: string;
  orderId: string;
  exchange: string;
  strategy: string;
  slippage?: number;
  executionTime?: number;
}

interface OrderUpdate {
  orderId: string;
  botId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  filledAmount?: number;
  remainingAmount?: number;
  averagePrice?: number;
  fee?: number;
  timestamp: string;
}

interface TradingMetrics {
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  winRate: number;
  averageExecutionTime: number;
  averageSlippage: number;
  successRate: number;
  activeBots: number;
}

interface FilterOptions {
  botId?: string;
  symbol?: string;
  side?: 'buy' | 'sell' | 'all';
  status?: 'all' | 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  exchange?: string;
  timeframe?: '1h' | '24h' | '7d' | '30d' | 'all';
}

interface SortOptions {
  field: 'timestamp' | 'symbol' | 'amount' | 'price' | 'pnl' | 'status';
  direction: 'asc' | 'desc';
}

export const TradingActivityMonitor: React.FC = () => {
  // State management
  const [trades, setTrades] = useState<Trade[]>([]);
  // Note: orderUpdates removed as it was unused
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    side: 'all',
    status: 'all',
    timeframe: '24h'
  });
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: 'timestamp',
    direction: 'desc'
  });
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // WebSocket context
  const { 
    isConnected, 
    subscribe, 
    unsubscribe
    // Note: marketData and botStatuses removed as they were unused
  } = useWebSocketContext();

  // Load initial trading data
  useEffect(() => {
    const loadTradingData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await apiService.getTrades({
          timeframe: filters.timeframe,
          symbol: filters.symbol,
          status: filters.status !== 'all' ? filters.status : undefined,
        });

        if (response.success) {
          setTrades(response.data as unknown as Trade[] || []);
        } else {
          throw new Error(response.error || 'Failed to load trading data');
        }
      } catch (err) {
        console.error('Error loading trading data:', err);
        const errorState = ErrorHandler.handleUnknownError(err, 'Loading trading data');
        setError(errorState.message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTradingData();
  }, [filters.timeframe, filters.symbol, filters.status]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (isConnected) {
      // Subscribe to trade updates
      subscribe('trades');
      subscribe('orders');
      subscribe('positions');

      return () => {
        unsubscribe('trades');
        unsubscribe('orders');
        unsubscribe('positions');
      };
    }
  }, [isConnected, subscribe, unsubscribe]);

  // Filter and sort trades
  const filteredAndSortedTrades = useMemo(() => {
    const filtered = trades.filter(trade => {
      // Filter by bot
      if (filters.botId && trade.botId !== filters.botId) {
        return false;
      }
      
      // Filter by symbol
      if (filters.symbol && trade.symbol !== filters.symbol) {
        return false;
      }
      
      // Filter by side
      if (filters.side && filters.side !== 'all' && trade.side !== filters.side) {
        return false;
      }
      
      // Filter by status
      if (filters.status && filters.status !== 'all' && trade.status !== filters.status) {
        return false;
      }
      
      // Filter by exchange
      if (filters.exchange && trade.exchange !== filters.exchange) {
        return false;
      }
      
      // Filter by timeframe
      if (filters.timeframe && filters.timeframe !== 'all') {
        const tradeTime = new Date(trade.timestamp);
        const now = new Date();
        const timeDiff = now.getTime() - tradeTime.getTime();
        
        switch (filters.timeframe) {
          case '1h':
            if (timeDiff > 60 * 60 * 1000) {
              return false;
            }
            break;
          case '24h':
            if (timeDiff > 24 * 60 * 60 * 1000) {
              return false;
            }
            break;
          case '7d':
            if (timeDiff > 7 * 24 * 60 * 60 * 1000) {
              return false;
            }
            break;
          case '30d':
            if (timeDiff > 30 * 24 * 60 * 60 * 1000) {
              return false;
            }
            break;
        }
      }
      
      return true;
    });

    // Sort trades
    filtered.sort((a, b) => {
      const direction = sortOptions.direction === 'asc' ? 1 : -1;
      
      switch (sortOptions.field) {
        case 'timestamp':
          return direction * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        case 'symbol':
          return direction * a.symbol.localeCompare(b.symbol);
        case 'amount':
          return direction * (a.amount - b.amount);
        case 'price':
          return direction * (a.price - b.price);
        case 'pnl':
          return direction * ((a.pnl || 0) - (b.pnl || 0));
        case 'status':
          return direction * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [trades, filters, sortOptions]);

  // Calculate trading metrics
  const tradingMetrics = useMemo((): TradingMetrics => {
    const filledTrades = filteredAndSortedTrades.filter(trade => trade.status === 'filled');
    const totalVolume = filledTrades.reduce((sum, trade) => sum + (trade.amount * trade.price), 0);
    const totalPnL = filledTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winningTrades = filledTrades.filter(trade => (trade.pnl || 0) > 0);
    const tradesWithExecutionTime = filledTrades.filter(trade => trade.executionTime);
    const tradesWithSlippage = filledTrades.filter(trade => trade.slippage !== undefined);
    const activeBots = new Set(trades.map(trade => trade.botId)).size;

    return {
      totalTrades: filledTrades.length,
      totalVolume,
      totalPnL,
      winRate: filledTrades.length > 0 ? (winningTrades.length / filledTrades.length) * 100 : 0,
      averageExecutionTime: tradesWithExecutionTime.length > 0 
        ? tradesWithExecutionTime.reduce((sum, trade) => sum + (trade.executionTime || 0), 0) / tradesWithExecutionTime.length 
        : 0,
      averageSlippage: tradesWithSlippage.length > 0
        ? tradesWithSlippage.reduce((sum, trade) => sum + (trade.slippage || 0), 0) / tradesWithSlippage.length
        : 0,
      successRate: trades.length > 0 ? (filledTrades.length / trades.length) * 100 : 0,
      activeBots
    };
  }, [filteredAndSortedTrades, trades]);

  // Utility functions
  const formatCurrency = (amount: number, currency = 'USDT'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'USDT' ? 'USD' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const formatTime = (timestamp: string): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(timestamp));
  };

  const getTradingStatusColor = (status: string): string => {
    const statusMap: Record<string, string> = {
      filled: 'text-status-success bg-status-success/10 border-status-success/20',
      pending: 'text-status-warning bg-status-warning/10 border-status-warning/20',
      partial: 'text-brand-primary bg-brand-primary/10 border-brand-primary/20',
      cancelled: 'text-muted bg-surface-secondary border-border',
      rejected: 'text-status-error bg-status-error/10 border-status-error/20',
    };
    return statusMap[status] || 'text-muted bg-surface-secondary border-border';
  };

  const getSideColor = (side: string): string => {
    return side === 'buy' ? 'text-status-success' : 'text-status-error';
  };

  // Event handlers
  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSortChange = (field: SortOptions['field']) => {
    setSortOptions(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setShowOrderDetails(true);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <ErrorBoundaryWrapper>
      <div className="trading-activity-monitor space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary">Trading Activity Monitor</h2>
            <p className="text-secondary mt-1">
              Real-time monitoring of all trading activity across your bots
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
              isConnected 
                ? 'bg-status-success/10 text-status-success border border-status-success/20' 
                : 'bg-status-error/10 text-status-error border border-status-error/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-status-success' : 'bg-status-error'}`} />
              <span className="font-medium">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`${componentClasses.button.secondary} flex items-center space-x-2`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

      {/* Trading Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={componentClasses.card}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-secondary">Total Trades</h3>
              <svg className="w-6 h-6 text-brand-primary mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-primary">{tradingMetrics.totalTrades.toLocaleString()}</div>
          <div className="text-sm text-muted mt-1">
            {tradingMetrics.activeBots} active bots
          </div>
        </div>

        <div className={componentClasses.card}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-secondary">Total Volume</h3>
              <svg className="w-6 h-6 text-brand-secondary mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-primary">{formatCurrency(tradingMetrics.totalVolume)}</div>
          <div className="text-sm text-muted mt-1">
            Success Rate: {formatPercentage(tradingMetrics.successRate)}
          </div>
        </div>

        <div className={componentClasses.card}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-secondary">Total P&L</h3>
              <svg className="w-6 h-6 text-status-success mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className={`text-2xl font-bold ${getPnLColor(tradingMetrics.totalPnL)}`}>
            {formatCurrency(tradingMetrics.totalPnL)}
          </div>
          <div className="text-sm text-muted mt-1">
            Win Rate: {formatPercentage(tradingMetrics.winRate)}
          </div>
        </div>

        <div className={componentClasses.card}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-secondary">Avg Execution</h3>
              <svg className="w-6 h-6 text-status-warning mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-primary">{tradingMetrics.averageExecutionTime.toFixed(0)}ms</div>
          <div className="text-sm text-muted mt-1">
            Avg Slippage: {formatPercentage(tradingMetrics.averageSlippage)}
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className={componentClasses.card}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="text-lg font-semibold text-primary">Filters & Controls</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Timeframe Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Timeframe
            </label>
            <select
              value={filters.timeframe}
              onChange={(e) => handleFilterChange({ timeframe: e.target.value as FilterOptions['timeframe'] })}
              className={componentClasses.form.select}
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Side Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Side
            </label>
            <select
              value={filters.side}
              onChange={(e) => handleFilterChange({ side: e.target.value as FilterOptions['side'] })}
              className={componentClasses.form.select}
            >
              <option value="all">All</option>
              <option value="buy">Buy Only</option>
              <option value="sell">Sell Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange({ status: e.target.value as FilterOptions['status'] })}
              className={componentClasses.form.select}
            >
              <option value="all">All</option>
              <option value="filled">Filled</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Symbol Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Symbol
            </label>
            <input
              type="text"
              value={filters.symbol || ''}
              onChange={(e) => handleFilterChange({ symbol: e.target.value || undefined })}
              placeholder="e.g., BTCUSDT"
              className={componentClasses.form.input}
            />
          </div>

          {/* Exchange Filter */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Exchange
            </label>
            <select
              value={filters.exchange || ''}
              onChange={(e) => handleFilterChange({ exchange: e.target.value || undefined })}
              className={componentClasses.form.select}
            >
              <option value="">All Exchanges</option>
              <option value="bybit">Bybit</option>
              <option value="binance">Binance</option>
              <option value="okx">OKX</option>
              <option value="coinbase">Coinbase</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ side: 'all', status: 'all', timeframe: '24h' })}
              className={`${componentClasses.button.secondary} w-full`}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

        {/* Loading State */}
        {isLoading && (
          <LoadingTable rows={8} columns={10} className="mb-6" />
        )}

        {/* Error State */}
        {error && (
          <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-status-error mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.768 0L3.046 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="font-medium text-status-error">Error Loading Trading Data</h4>
                <p className="text-sm text-status-error/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Trading Activity Table */}
        {!isLoading && !error && (
          <div className={componentClasses.card}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-primary">
                Recent Trading Activity ({filteredAndSortedTrades.length} trades)
              </h3>
              <div className="text-sm text-secondary">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            {filteredAndSortedTrades.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h4 className="text-lg font-medium text-primary mb-2">No Trading Activity</h4>
                <p className="text-secondary">
                  No trades found matching your current filters. Try adjusting the filters or check if your bots are running.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                        <button
                          onClick={() => handleSortChange('timestamp')}
                          className="flex items-center space-x-1 hover:text-primary transition-colors"
                        >
                          <span>Time</span>
                          {sortOptions.field === 'timestamp' && (
                            <span className="text-brand-primary">
                              {sortOptions.direction === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Bot</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                        <button
                          onClick={() => handleSortChange('symbol')}
                          className="flex items-center space-x-1 hover:text-primary transition-colors"
                        >
                          <span>Symbol</span>
                          {sortOptions.field === 'symbol' && (
                            <span className="text-brand-primary">
                              {sortOptions.direction === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Side</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                        <button
                          onClick={() => handleSortChange('amount')}
                          className="flex items-center space-x-1 hover:text-primary transition-colors"
                        >
                          <span>Amount</span>
                          {sortOptions.field === 'amount' && (
                            <span className="text-brand-primary">
                              {sortOptions.direction === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                        <button
                          onClick={() => handleSortChange('price')}
                          className="flex items-center space-x-1 hover:text-primary transition-colors"
                        >
                          <span>Price</span>
                          {sortOptions.field === 'price' && (
                            <span className="text-brand-primary">
                              {sortOptions.direction === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                        <button
                          onClick={() => handleSortChange('status')}
                          className="flex items-center space-x-1 hover:text-primary transition-colors"
                        >
                          <span>Status</span>
                          {sortOptions.field === 'status' && (
                            <span className="text-brand-primary">
                              {sortOptions.direction === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                        <button
                          onClick={() => handleSortChange('pnl')}
                          className="flex items-center space-x-1 hover:text-primary transition-colors"
                        >
                          <span>P&L</span>
                          {sortOptions.field === 'pnl' && (
                            <span className="text-brand-primary">
                              {sortOptions.direction === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-border">
                    {filteredAndSortedTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-surface-secondary/50 transition-colors cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-primary font-medium">
                            {formatTime(trade.timestamp)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-primary">{trade.botName}</div>
                            <div className="text-xs text-secondary">{trade.strategy}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-primary">{trade.symbol}</span>
                            <span className="text-xs text-secondary bg-surface-secondary px-2 py-1 rounded-full">
                              {trade.exchange}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${getSideColor(trade.side)}`}>
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-secondary capitalize">
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-primary">
                              {trade.amount.toLocaleString(undefined, { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 8 
                              })}
                            </div>
                            {trade.executedAmount && trade.executedAmount !== trade.amount && (
                              <div className="text-xs text-secondary">
                                Filled: {trade.executedAmount.toLocaleString(undefined, { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 8 
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-primary">
                              {formatCurrency(trade.price)}
                            </div>
                            {trade.executedPrice && trade.executedPrice !== trade.price && (
                              <div className="text-xs text-secondary">
                                Exec: {formatCurrency(trade.executedPrice)}
                              </div>
                            )}
                            {trade.slippage !== undefined && (
                              <div className="text-xs text-status-warning">
                                Slippage: {formatPercentage(trade.slippage)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getTradingStatusColor(trade.status)}`}>
                            {trade.status}
                          </span>
                          {trade.executionTime && (
                            <div className="text-xs text-secondary mt-1">
                              {trade.executionTime}ms
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {trade.pnl !== undefined ? (
                            <div className={`text-sm font-medium ${getPnLColor(trade.pnl)}`}>
                              {formatCurrency(trade.pnl)}
                            </div>
                          ) : (
                            <span className="text-xs text-secondary">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleTradeClick(trade)}
                            className={`${componentClasses.button.secondary} text-sm px-3 py-1`}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* Trade Details Modal */}
      {showOrderDetails && selectedTrade && (
        <div className={componentClasses.modal.overlay} onClick={() => setShowOrderDetails(false)}>
          <div className={componentClasses.modal.content} onClick={(e) => e.stopPropagation()}>
            <div className={componentClasses.modal.header}>
              <h3 className={componentClasses.modal.title}>Trade Details</h3>
              <button
                onClick={() => setShowOrderDetails(false)}
                className={componentClasses.modal.closeButton}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={componentClasses.modal.body}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-primary mb-3">Basic Information</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-secondary">Trade ID:</span>
                      <span className="font-mono text-sm">{selectedTrade.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Order ID:</span>
                      <span className="font-mono text-sm">{selectedTrade.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Bot:</span>
                      <span>{selectedTrade.botName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Strategy:</span>
                      <span>{selectedTrade.strategy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Exchange:</span>
                      <span className="capitalize">{selectedTrade.exchange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Symbol:</span>
                      <span className="font-medium">{selectedTrade.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Timestamp:</span>
                      <span>{new Date(selectedTrade.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-primary mb-3">Trade Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-secondary">Side:</span>
                      <span className={`font-medium ${getSideColor(selectedTrade.side)}`}>
                        {selectedTrade.side.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Type:</span>
                      <span className="capitalize">{selectedTrade.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Amount:</span>
                      <span>{selectedTrade.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Price:</span>
                      <span>{formatCurrency(selectedTrade.price)}</span>
                    </div>
                    {selectedTrade.executedPrice && (
                      <div className="flex justify-between">
                        <span className="text-secondary">Executed Price:</span>
                        <span>{formatCurrency(selectedTrade.executedPrice)}</span>
                      </div>
                    )}
                    {selectedTrade.executedAmount && (
                      <div className="flex justify-between">
                        <span className="text-secondary">Executed Amount:</span>
                        <span>{selectedTrade.executedAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-secondary">Status:</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getTradingStatusColor(selectedTrade.status)}`}>
                        {selectedTrade.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Fee:</span>
                      <span>{formatCurrency(selectedTrade.fee)}</span>
                    </div>
                    {selectedTrade.pnl !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-secondary">P&L:</span>
                        <span className={`font-medium ${getPnLColor(selectedTrade.pnl)}`}>
                          {formatCurrency(selectedTrade.pnl)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(selectedTrade.slippage !== undefined || selectedTrade.executionTime) && (
                  <div className="md:col-span-2">
                    <h4 className="font-semibold text-primary mb-3">Performance Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedTrade.slippage !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-secondary">Slippage:</span>
                          <span className="text-status-warning">
                            {formatPercentage(selectedTrade.slippage)}
                          </span>
                        </div>
                      )}
                      {selectedTrade.executionTime && (
                        <div className="flex justify-between">
                          <span className="text-secondary">Execution Time:</span>
                          <span>{selectedTrade.executionTime}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundaryWrapper>
  );
};

export default TradingActivityMonitor;
