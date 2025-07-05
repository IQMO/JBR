// JBR Trading Platform - Unified Theme System
// This file contains all design tokens and styling utilities for consistent theming

export const theme = {
  // Brand Colors
  colors: {
    brand: {
      50: '#f0f4ff',
      100: '#e0e8ff',
      200: '#c7d4ff',
      300: '#a3b8ff',
      400: '#7d93ff',
      500: '#667eea', // primary
      600: '#5a6fd8',
      700: '#4f5fc6',
      800: '#4651b4',
      900: '#3d4a9f',
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#f093fb',
    },
    trading: {
      profit: '#10b981', // emerald-500
      loss: '#ef4444',   // red-500
      neutral: '#6b7280', // gray-500
      warning: '#f59e0b', // amber-500
    },
    bot: {
      running: '#10b981',  // emerald-500
      stopped: '#6b7280',  // gray-500
      paused: '#f59e0b',   // amber-500
      error: '#ef4444',    // red-500
      starting: '#3b82f6', // blue-500
      stopping: '#f97316', // orange-500
    },
    status: {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    },
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      dark: '#0f172a',
    }
  },

  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      display: ['Inter', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    }
  },

  // Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  // Border Radius
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    trading: '0.75rem',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    trading: '0 4px 6px -1px rgba(102, 126, 234, 0.1), 0 2px 4px -1px rgba(102, 126, 234, 0.06)',
    botCard: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    glow: '0 0 20px rgba(102, 126, 234, 0.3)',
  }
}

// Utility functions for consistent styling
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'running': theme.colors.bot.running,
    'stopped': theme.colors.bot.stopped,
    'paused': theme.colors.bot.paused,
    'error': theme.colors.bot.error,
    'starting': theme.colors.bot.starting,
    'stopping': theme.colors.bot.stopping,
    'success': theme.colors.status.success,
    'warning': theme.colors.status.warning,
    'info': theme.colors.status.info,
  }
  return statusColors[status.toLowerCase()] || theme.colors.trading.neutral
}

export const getPnLColor = (value: number): string => {
  if (value > 0) {
    return theme.colors.trading.profit;
  }
  if (value < 0) {
    return theme.colors.trading.loss;
  }
  return theme.colors.trading.neutral;
};

export const getStatusClasses = (status: string): string => {
  const statusClasses: Record<string, string> = {
    'running': 'bg-bot-running/10 text-bot-running border-bot-running',
    'stopped': 'bg-bot-stopped/10 text-bot-stopped border-bot-stopped',
    'paused': 'bg-bot-paused/10 text-bot-paused border-bot-paused',
    'error': 'bg-bot-error/10 text-bot-error border-bot-error',
    'starting': 'bg-bot-starting/10 text-bot-starting border-bot-starting',
    'stopping': 'bg-bot-stopping/10 text-bot-stopping border-bot-stopping',
  }
  return statusClasses[status.toLowerCase()] || 'bg-gray-100 text-gray-600 border-gray-300'
}

export const getPnLClasses = (value: number): string => {
  if (value > 0) {
    return 'text-trading-profit';
  }
  if (value < 0) {
    return 'text-trading-loss';
  }
  return 'text-trading-neutral';
};

// Animation classes
export const animations = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  pulse: 'animate-pulse-fast',
  bounce: 'animate-bounce-slow',
  glow: 'shadow-glow',
}

// Component base classes
export const componentClasses = {
  card: 'bg-white rounded-trading border border-gray-200 shadow-bot-card',
  button: {
    primary: 'bg-brand-primary hover:bg-brand-600 text-white font-medium py-2 px-4 rounded-lg transition-colors',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors',
    danger: 'bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors',
    success: 'bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  },
  form: {
    input: 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors',
    select: 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors',
    textarea: 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors',
    label: 'block text-sm font-medium text-gray-700 mb-2',
    error: 'text-sm text-red-600 mt-1',
    help: 'text-sm text-gray-500 mt-1',
  },
  modal: {
    overlay: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    content: 'bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden mx-4',
    header: 'px-6 py-4 border-b border-gray-200 flex items-center justify-between',
    body: 'px-6 py-4 max-h-[70vh] overflow-y-auto',
    footer: 'px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3',
    title: 'text-lg font-semibold text-gray-900',
    closeButton: 'text-gray-400 hover:text-gray-600 transition-colors'
  },
  input: 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent',
  badge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  metric: 'bg-white rounded-trading border border-gray-200 p-6 shadow-bot-card',
}

export default theme
