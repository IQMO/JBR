'use client';

import React, { useState, useEffect, useMemo } from 'react';

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Activity,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Calendar,
  Clock,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

import type { Position, Trade } from '@jabbr/shared/src';

import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { apiService } from '../services/api';
import { componentClasses, getPnLColor } from '../utils/theme';
import { ErrorBoundaryWrapper } from './ErrorBoundary';
import { LoadingSpinner } from './Loading';

// Types and Interfaces
interface LocalPosition {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number
  realizedPnL: number
  percentage: number
  timestamp: string
  value: number
  margin: number
}

interface PnLHistoryPoint {
  timestamp: string
  date: string
  time: string
  totalPnL: number
  unrealizedPnL: number
  realizedPnL: number
  cumulativePnL: number
  positions: number
  volume: number
}

interface SymbolPerformance {
  symbol: string
  totalPnL: number
  unrealizedPnL: number
  realizedPnL: number
  percentage: number
  positions: number
  volume: number
  winRate: number
  avgWin: number
  avgLoss: number
  trades: number
}

interface PnLMetrics {
  totalUnrealizedPnL: number
  totalRealizedPnL: number
  totalPnL: number
  totalValue: number
  totalMargin: number
  marginUtilization: number
  dayPnL: number
  weekPnL: number
  monthPnL: number
  openPositions: number
  profitablePositions: number
  losingPositions: number
  winRate: number
  largestWin: number
  largestLoss: number
  avgPositionSize: number
  riskRewardRatio: number
}

interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'pie'
  timeframe: '1h' | '4h' | '1d' | '1w' | '1m'
  metric: 'pnl' | 'positions' | 'volume' | 'percentage'
}

interface FilterConfig {
  dateRange: {
    start: string
    end: string
  }
  symbols: string[]
  minPnL: number
  maxPnL: number
  positionSides: ('LONG' | 'SHORT')[]
  showUnrealized: boolean
  showRealized: boolean
}

const PositionPnLVisualization: React.FC = () => {
  // State Management
  const { isConnected, marketData, botStatuses } = useWebSocketContext()
  
  const [positions, setPositions] = useState<Position[]>([])
  const [pnlHistory, setPnlHistory] = useState<PnLHistoryPoint[]>([])
  const [symbolPerformance, setSymbolPerformance] = useState<SymbolPerformance[]>([])
  const [metrics, setMetrics] = useState<PnLMetrics>({
    totalUnrealizedPnL: 0,
    totalRealizedPnL: 0,
    totalPnL: 0,
    totalValue: 0,
    totalMargin: 0,
    marginUtilization: 0,
    dayPnL: 0,
    weekPnL: 0,
    monthPnL: 0,
    openPositions: 0,
    profitablePositions: 0,
    losingPositions: 0,
    winRate: 0,
    largestWin: 0,
    largestLoss: 0,
    avgPositionSize: 0,
    riskRewardRatio: 0
  })

  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'line',
    timeframe: '1d',
    metric: 'pnl'
  })

  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    symbols: [],
    minPnL: -Infinity,
    maxPnL: Infinity,
    positionSides: ['LONG', 'SHORT'],
    showUnrealized: true,
    showRealized: true
  })

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Chart Colors
  const CHART_COLORS = {
    profit: '#10b981',    // emerald-500
    loss: '#ef4444',      // red-500
    neutral: '#6b7280',   // gray-500
    primary: '#667eea',   // brand-primary
    secondary: '#764ba2', // brand-secondary
    accent: '#f093fb',    // brand-accent
    warning: '#f59e0b',   // amber-500
    background: '#f8fafc' // slate-50
  }

  const PIE_COLORS = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.accent,
    CHART_COLORS.profit,
    CHART_COLORS.warning,
    '#8b5cf6', // violet-500
    '#06b6d4', // cyan-500
    '#84cc16'  // lime-500
  ]

  // WebSocket Data Processing - Using mock data for now
  useEffect(() => {
    // In a real implementation, this would listen to WebSocket updates
    // For now, using mock data
  }, [marketData, botStatuses])

  // Calculate Metrics
  const calculateMetrics = useMemo(() => {
    const filteredPositions = positions.filter(position => {
      const matchesSymbol = filterConfig.symbols.length === 0 || filterConfig.symbols.includes(position.symbol)
      // Map TradeSide to position side for filtering
      const positionSide = position.side === 'buy' ? 'LONG' : 'SHORT'
      const matchesSide = filterConfig.positionSides.includes(positionSide)
      const matchesPnL = position.unrealizedPnl >= filterConfig.minPnL && position.unrealizedPnl <= filterConfig.maxPnL
      const positionDate = new Date(position.openedAt).toISOString().split('T')[0]
      const matchesDate = positionDate >= filterConfig.dateRange.start && positionDate <= filterConfig.dateRange.end
      
      return matchesSymbol && matchesSide && matchesPnL && matchesDate
    })

    const totalUnrealizedPnL = filteredPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
    const totalRealizedPnL = filteredPositions.reduce((sum, p) => sum + p.realizedPnl, 0)
    const totalValue = filteredPositions.reduce((sum, p) => sum + (p.size * p.currentPrice), 0)
    const totalMargin = filteredPositions.reduce((sum, p) => sum + p.margin, 0)
    
    const profitablePositions = filteredPositions.filter(p => p.unrealizedPnl > 0).length
    const losingPositions = filteredPositions.filter(p => p.unrealizedPnl < 0).length
    const winRate = filteredPositions.length > 0 ? (profitablePositions / filteredPositions.length) * 100 : 0
    
    const pnlValues = filteredPositions.map(p => p.unrealizedPnl)
    const largestWin = Math.max(...pnlValues, 0)
    const largestLoss = Math.min(...pnlValues, 0)
    
    // Calculate time-based P&L
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const dayPnL = filteredPositions
      .filter(p => new Date(p.openedAt) >= dayStart)
      .reduce((sum, p) => sum + p.unrealizedPnl + p.realizedPnl, 0)
    
    const weekPnL = filteredPositions
      .filter(p => new Date(p.openedAt) >= weekStart)
      .reduce((sum, p) => sum + p.unrealizedPnl + p.realizedPnl, 0)
    
    const monthPnL = filteredPositions
      .filter(p => new Date(p.openedAt) >= monthStart)
      .reduce((sum, p) => sum + p.unrealizedPnl + p.realizedPnl, 0)

    return {
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalPnL: totalUnrealizedPnL + totalRealizedPnL,
      totalValue,
      totalMargin,
      marginUtilization: totalValue > 0 ? (totalMargin / totalValue) * 100 : 0,
      dayPnL,
      weekPnL,
      monthPnL,
      openPositions: filteredPositions.length,
      profitablePositions,
      losingPositions,
      winRate,
      largestWin,
      largestLoss,
      avgPositionSize: filteredPositions.length > 0 ? totalValue / filteredPositions.length : 0,
      riskRewardRatio: Math.abs(largestLoss) > 0 ? largestWin / Math.abs(largestLoss) : 0
    }
  }, [positions, filterConfig])

  useEffect(() => {
    setMetrics(calculateMetrics)
  }, [calculateMetrics])

  // Filtered Data for Charts
  const filteredPositions = useMemo(() => {
    return positions.filter(position => {
      const matchesSymbol = filterConfig.symbols.length === 0 || filterConfig.symbols.includes(position.symbol)
      const positionSide = position.side === 'buy' ? 'LONG' : 'SHORT'
      const matchesSide = filterConfig.positionSides.includes(positionSide)
      const matchesPnL = position.unrealizedPnl >= filterConfig.minPnL && position.unrealizedPnl <= filterConfig.maxPnL
      const positionDate = new Date(position.openedAt).toISOString().split('T')[0]
      const matchesDate = positionDate >= filterConfig.dateRange.start && positionDate <= filterConfig.dateRange.end
      
      return matchesSymbol && matchesSide && matchesPnL && matchesDate
    })
  }, [positions, filterConfig])

  const filteredPnlHistory = useMemo(() => {
    return pnlHistory.filter(point => {
      const pointDate = new Date(point.timestamp).toISOString().split('T')[0]
      return pointDate >= filterConfig.dateRange.start && pointDate <= filterConfig.dateRange.end
    })
  }, [pnlHistory, filterConfig])

  // Chart Data Preparation
  const prepareChartData = useMemo(() => {
    switch (chartConfig.metric) {
      case 'pnl':
        return filteredPnlHistory.map(point => ({
          ...point,
          name: point.date,
          value: point.totalPnL,
          unrealized: filterConfig.showUnrealized ? point.unrealizedPnL : 0,
          realized: filterConfig.showRealized ? point.realizedPnL : 0
        }))
      
      case 'positions':
        return filteredPnlHistory.map(point => ({
          ...point,
          name: point.date,
          value: point.positions,
          volume: point.volume
        }))
      
      case 'volume':
        return filteredPnlHistory.map(point => ({
          ...point,
          name: point.date,
          value: point.volume
        }))
      
      case 'percentage':
        return filteredPositions.map(position => ({
          name: position.symbol,
          value: ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100,
          pnl: position.unrealizedPnl,
          side: position.side
        }))
      
      default:
        return []
    }
  }, [filteredPnlHistory, filteredPositions, chartConfig.metric, filterConfig.showUnrealized, filterConfig.showRealized])

  // Symbol breakdown for pie chart
  const symbolBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>()
    filteredPositions.forEach(position => {
      const current = breakdown.get(position.symbol) || 0
      breakdown.set(position.symbol, current + Math.abs(position.unrealizedPnl))
    })
    
    return Array.from(breakdown.entries())
      .map(([symbol, value]) => ({ name: symbol, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8) // Top 8 symbols
  }, [filteredPositions])

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch real data from API
        const [positionsData, tradesData] = await Promise.all([
          apiService.getPositions(),
          apiService.getTrades()
        ]);
        
        if (positionsData.success && tradesData.success) {
          setPositions(positionsData.data as unknown as Position[]);
          // Process trades data for PnL history
          const processedHistory = processPnLHistory(tradesData.data as unknown as Trade[]);
          setPnlHistory(processedHistory);
        } else {
          throw new Error('Failed to fetch position data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        console.error('Error fetching position data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isConnected]);

  // Helper function to process trades into PnL history
  const processPnLHistory = (trades: Trade[]): PnLHistoryPoint[] => {
    // Group trades by date and calculate daily PnL
    const dailyPnL = new Map<string, { totalPnL: number, unrealizedPnL: number, realizedPnL: number, volume: number, positions: number }>();
    
    trades.forEach(trade => {
      const date = new Date(trade.executedAt || trade.createdAt).toISOString().split('T')[0];
      const existing = dailyPnL.get(date) || { totalPnL: 0, unrealizedPnL: 0, realizedPnL: 0, volume: 0, positions: 0 };
      
      if (trade.pnl !== undefined) {
        existing.realizedPnL += trade.pnl;
        existing.totalPnL += trade.pnl;
      }
      existing.volume += trade.amount * trade.price;
      existing.positions += 1;
      
      dailyPnL.set(date, existing);
    });

    // Convert to array and sort by date
    return Array.from(dailyPnL.entries())
      .map(([date, data], index) => ({
        timestamp: new Date(date).toISOString(),
        date,
        time: new Date(date).toTimeString().split(' ')[0],
        totalPnL: data.totalPnL,
        unrealizedPnL: data.unrealizedPnL,
        realizedPnL: data.realizedPnL,
        cumulativePnL: data.totalPnL + index * 50, // Simple cumulative calculation
        positions: data.positions,
        volume: data.volume
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Event Handlers
  const handleRefresh = () => {
    setLastUpdate(new Date());
    // Trigger data refresh
  };

  const handleExport = () => {
    const dataToExport = {
      positions: filteredPositions,
      metrics,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `position-pnl-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Metrics Cards Component
  const MetricsCards: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {/* Total P&L */}
      <div className="bg-white rounded-trading border border-gray-200 p-6 shadow-bot-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total P&L</p>
            <p className={`text-2xl font-bold ${metrics.totalPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
              {formatCurrency(metrics.totalPnL)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Day: {formatCurrency(metrics.dayPnL)} | Week: {formatCurrency(metrics.weekPnL)}
            </p>
          </div>
          <div className={`p-3 rounded-full ${metrics.totalPnL >= 0 ? 'bg-trading-profit/10' : 'bg-trading-loss/10'}`}>
            {metrics.totalPnL >= 0 ? (
              <TrendingUp className="h-6 w-6 text-trading-profit" />
            ) : (
              <TrendingDown className="h-6 w-6 text-trading-loss" />
            )}
          </div>
        </div>
      </div>

      {/* Unrealized P&L */}
      <div className="bg-white rounded-trading border border-gray-200 p-6 shadow-bot-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Unrealized P&L</p>
            <p className={`text-2xl font-bold ${metrics.totalUnrealizedPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
              {formatCurrency(metrics.totalUnrealizedPnL)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Open positions: {metrics.openPositions}
            </p>
          </div>
          <div className="p-3 rounded-full bg-brand-primary/10">
            <Target className="h-6 w-6 text-brand-primary" />
          </div>
        </div>
      </div>

      {/* Realized P&L */}
      <div className="bg-white rounded-trading border border-gray-200 p-6 shadow-bot-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Realized P&L</p>
            <p className={`text-2xl font-bold ${metrics.totalRealizedPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
              {formatCurrency(metrics.totalRealizedPnL)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Win rate: {formatPercentage(metrics.winRate)}
            </p>
          </div>
          <div className="p-3 rounded-full bg-brand-secondary/10">
            <DollarSign className="h-6 w-6 text-brand-secondary" />
          </div>
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="bg-white rounded-trading border border-gray-200 p-6 shadow-bot-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(metrics.totalValue)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Margin: {formatPercentage(metrics.marginUtilization)}
            </p>
          </div>
          <div className="p-3 rounded-full bg-brand-accent/10">
            <Activity className="h-6 w-6 text-brand-accent" />
          </div>
        </div>
      </div>
    </div>
  )

  // Chart Controls Component
  const ChartControls: React.FC = () => (
    <div className="bg-white rounded-trading border border-gray-200 p-4 mb-6 shadow-bot-card">
      <div className="flex flex-wrap items-center gap-4">
        {/* Chart Type */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Chart Type:</label>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {[
              { type: 'line' as const, icon: LineChartIcon, label: 'Line' },
              { type: 'area' as const, icon: BarChart3, label: 'Area' },
              { type: 'bar' as const, icon: BarChart3, label: 'Bar' },
              { type: 'pie' as const, icon: PieChartIcon, label: 'Pie' }
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setChartConfig(prev => ({ ...prev, type }))}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  chartConfig.type === type
                    ? 'bg-brand-primary text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4 inline mr-1" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Timeframe:</label>
          <select
            value={chartConfig.timeframe}
            onChange={(e) => setChartConfig(prev => ({ ...prev, timeframe: e.target.value as ChartConfig['timeframe'] }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
          >
            <option value="1h">1 Hour</option>
            <option value="4h">4 Hours</option>
            <option value="1d">1 Day</option>
            <option value="1w">1 Week</option>
            <option value="1m">1 Month</option>
          </select>
        </div>

        {/* Metric */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Metric:</label>
          <select
            value={chartConfig.metric}
            onChange={(e) => setChartConfig(prev => ({ ...prev, metric: e.target.value as ChartConfig['metric'] }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
          >
            <option value="pnl">P&L</option>
            <option value="positions">Positions</option>
            <option value="volume">Volume</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-brand-primary transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 text-gray-600 hover:text-brand-primary transition-colors"
            title="Export Data"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  // Filter Controls Component
  const FilterControls: React.FC = () => (
    <div className="bg-white rounded-trading border border-gray-200 p-4 mb-6 shadow-bot-card">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <div className="space-y-2">
            <input
              type="date"
              value={filterConfig.dateRange.start}
              onChange={(e) => setFilterConfig(prev => ({
                ...prev,
                dateRange: { ...prev.dateRange, start: e.target.value }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
            <input
              type="date"
              value={filterConfig.dateRange.end}
              onChange={(e) => setFilterConfig(prev => ({
                ...prev,
                dateRange: { ...prev.dateRange, end: e.target.value }
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Symbols */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Symbols</label>
          <select
            multiple
            value={filterConfig.symbols}
            onChange={(e) => setFilterConfig(prev => ({
              ...prev,
              symbols: Array.from(e.target.selectedOptions, option => option.value)
            }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent h-20"
          >
            {Array.from(new Set(positions.map(p => p.symbol))).map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>

        {/* P&L Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">P&L Range</label>
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Min P&L"
              value={filterConfig.minPnL === -Infinity ? '' : filterConfig.minPnL}
              onChange={(e) => setFilterConfig(prev => ({
                ...prev,
                minPnL: e.target.value ? parseFloat(e.target.value) : -Infinity
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
            <input
              type="number"
              placeholder="Max P&L"
              value={filterConfig.maxPnL === Infinity ? '' : filterConfig.maxPnL}
              onChange={(e) => setFilterConfig(prev => ({
                ...prev,
                maxPnL: e.target.value ? parseFloat(e.target.value) : Infinity
              }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterConfig.positionSides.includes('LONG')}
                onChange={(e) => {
                  const newSides = e.target.checked
                    ? [...filterConfig.positionSides, 'LONG']
                    : filterConfig.positionSides.filter(s => s !== 'LONG')
                  setFilterConfig(prev => ({ ...prev, positionSides: newSides as ('LONG' | 'SHORT')[] }))
                }}
                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="ml-2 text-sm text-gray-700">Long Positions</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterConfig.positionSides.includes('SHORT')}
                onChange={(e) => {
                  const newSides = e.target.checked
                    ? [...filterConfig.positionSides, 'SHORT']
                    : filterConfig.positionSides.filter(s => s !== 'SHORT')
                  setFilterConfig(prev => ({ ...prev, positionSides: newSides as ('LONG' | 'SHORT')[] }))
                }}
                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="ml-2 text-sm text-gray-700">Short Positions</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterConfig.showUnrealized}
                onChange={(e) => setFilterConfig(prev => ({ ...prev, showUnrealized: e.target.checked }))}
                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="ml-2 text-sm text-gray-700">Unrealized P&L</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterConfig.showRealized}
                onChange={(e) => setFilterConfig(prev => ({ ...prev, showRealized: e.target.checked }))}
                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="ml-2 text-sm text-gray-700">Realized P&L</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  // Chart Renderer Component
  const ChartRenderer: React.FC = () => {
    const renderChart = () => {
      if (chartConfig.type === 'pie') {
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={symbolBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {symbolBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'P&L']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      }

      if (chartConfig.type === 'line') {
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={prepareChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} tickFormatter={formatCurrency} />
              <Tooltip
                labelFormatter={(value) => `Date: ${value}`}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'value' ? 'Total P&L' : 
                  name === 'unrealized' ? 'Unrealized P&L' : 'Realized P&L'
                ]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
              
              {chartConfig.metric === 'pnl' && (
                <>
                  {filterConfig.showUnrealized && (
                    <Line
                      type="monotone"
                      dataKey="unrealized"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                      name="Unrealized P&L"
                    />
                  )}
                  {filterConfig.showRealized && (
                    <Line
                      type="monotone"
                      dataKey="realized"
                      stroke={CHART_COLORS.secondary}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.secondary, strokeWidth: 2, r: 4 }}
                      name="Realized P&L"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.accent, strokeWidth: 2, r: 5 }}
                    name="Total P&L"
                  />
                </>
              )}
              
              {chartConfig.metric !== 'pnl' && (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 5 }}
                  name={chartConfig.metric.charAt(0).toUpperCase() + chartConfig.metric.slice(1)}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )
      }

      if (chartConfig.type === 'area') {
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={prepareChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} tickFormatter={formatCurrency} />
              <Tooltip
                labelFormatter={(value) => `Date: ${value}`}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
              
              {chartConfig.metric === 'pnl' && filterConfig.showUnrealized && (
                <Area
                  type="monotone"
                  dataKey="unrealized"
                  stackId="1"
                  stroke={CHART_COLORS.primary}
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.6}
                  name="Unrealized P&L"
                />
              )}
              
              {chartConfig.metric === 'pnl' && filterConfig.showRealized && (
                <Area
                  type="monotone"
                  dataKey="realized"
                  stackId="1"
                  stroke={CHART_COLORS.secondary}
                  fill={CHART_COLORS.secondary}
                  fillOpacity={0.6}
                  name="Realized P&L"
                />
              )}
              
              {chartConfig.metric !== 'pnl' && (
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS.primary}
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.6}
                  name={chartConfig.metric.charAt(0).toUpperCase() + chartConfig.metric.slice(1)}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )
      }

      if (chartConfig.type === 'bar') {
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={prepareChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} tickFormatter={formatCurrency} />
              <Tooltip
                labelFormatter={(value) => `Date: ${value}`}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
              
              {chartConfig.metric === 'pnl' && filterConfig.showUnrealized && (
                <Bar
                  dataKey="unrealized"
                  fill={CHART_COLORS.primary}
                  name="Unrealized P&L"
                  radius={[2, 2, 0, 0]}
                />
              )}
              
              {chartConfig.metric === 'pnl' && filterConfig.showRealized && (
                <Bar
                  dataKey="realized"
                  fill={CHART_COLORS.secondary}
                  name="Realized P&L"
                  radius={[2, 2, 0, 0]}
                />
              )}
              
              {chartConfig.metric !== 'pnl' && (
                <Bar
                  dataKey="value"
                  fill={CHART_COLORS.primary}
                  name={chartConfig.metric.charAt(0).toUpperCase() + chartConfig.metric.slice(1)}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )
      }

      return null
    }

    return (
      <div className="bg-white rounded-trading border border-gray-200 p-6 shadow-bot-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {chartConfig.metric.charAt(0).toUpperCase() + chartConfig.metric.slice(1)} Visualization
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[400px] text-trading-loss">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          </div>
        ) : (
          renderChart()
        )}
      </div>
    )
  }

  // Positions Table Component
  const PositionsTable: React.FC = () => (
    <div className="bg-white rounded-trading border border-gray-200 shadow-bot-card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Current Positions</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unrealized P&L</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Realized P&L</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPositions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <Target className="h-8 w-8 text-gray-400 mb-2" />
                    <p>No positions found matching current filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPositions.map((position) => (
                <tr
                  key={position.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPosition(position)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{position.symbol}</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      position.side === 'buy' 
                        ? 'bg-trading-profit/10 text-trading-profit' 
                        : 'bg-trading-loss/10 text-trading-loss'
                    }`}>
                      {position.side === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {position.size}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(position.entryPrice)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(position.currentPrice)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${
                      position.unrealizedPnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {formatCurrency(position.unrealizedPnl)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${
                      position.realizedPnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {formatCurrency(position.realizedPnl)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${
                      ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100 >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {formatPercentage(((position.currentPrice - position.entryPrice) / position.entryPrice) * 100)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPosition(position)
                      }}
                      className="text-brand-primary hover:text-brand-secondary transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // Position Detail Modal Component
  const PositionDetailModal: React.FC = () => {
    if (!selectedPosition) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-trading max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">
              Position Details - {selectedPosition.symbol}
            </h3>
            <button
              onClick={() => setSelectedPosition(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Position Info</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Symbol:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedPosition.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Side:</span>
                    <span className={`text-sm font-medium ${
                      selectedPosition.side === 'buy' ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {selectedPosition.side === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Size:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedPosition.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Value:</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(selectedPosition.size * selectedPosition.currentPrice)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">P&L Analysis</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unrealized P&L:</span>
                    <span className={`text-sm font-medium ${
                      selectedPosition.unrealizedPnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {formatCurrency(selectedPosition.unrealizedPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Realized P&L:</span>
                    <span className={`text-sm font-medium ${
                      selectedPosition.realizedPnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {formatCurrency(selectedPosition.realizedPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Percentage:</span>
                    <span className={`text-sm font-medium ${
                      ((selectedPosition.currentPrice - selectedPosition.entryPrice) / selectedPosition.entryPrice) * 100 >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    }`}>
                      {formatPercentage(((selectedPosition.currentPrice - selectedPosition.entryPrice) / selectedPosition.entryPrice) * 100)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Margin:</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(selectedPosition.margin)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Price Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Entry Price:</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(selectedPosition.entryPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Current Price:</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(selectedPosition.currentPrice)}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Timeline</h4>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Opened: {new Date(selectedPosition.openedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setSelectedPosition(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Connection Status Component
  const ConnectionStatus: React.FC = () => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      isConnected 
        ? 'bg-trading-profit/10 text-trading-profit' 
        : 'bg-trading-loss/10 text-trading-loss'
    }`}>
      {isConnected ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <span>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )

  // Main Component Return
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Position & P&L Visualization</h1>
          <p className="text-gray-600 mt-1">Monitor your portfolio performance and position analytics</p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Metrics Cards */}
      <MetricsCards />

      {/* Chart Controls */}
      <ChartControls />

      {/* Filter Controls */}
      <FilterControls />

      {/* Chart Visualization */}
      <ChartRenderer />

      {/* Positions Table */}
      <PositionsTable />

      {/* Position Detail Modal */}
      <PositionDetailModal />
    </div>
  )
}

export default PositionPnLVisualization
