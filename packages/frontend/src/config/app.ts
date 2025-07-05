/**
 * Application Configuration
 * Centralized configuration for the JBR Trading Platform frontend
 */

interface AppConfig {
  api: {
    baseUrl: string;
    websocketUrl: string;
    timeout: number;
  };
  trading: {
    defaultPairs: string[];
    refreshInterval: number;
  };
  ui: {
    defaultTheme: 'light' | 'dark';
    animationDuration: number;
    toastDuration: number;
  };
  development: {
    enableDebugLogs: boolean;
    mockData: boolean;
  };
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const config: AppConfig = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 
             (isDevelopment ? 'http://localhost:3001' : 'https://api.jabbr.trading'),
    websocketUrl: process.env.NEXT_PUBLIC_WS_URL || 
                  (isDevelopment ? 'ws://localhost:3002/ws' : 'wss://ws.jabbr.trading/ws'),
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),
  },
  trading: {
    defaultPairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'],
    refreshInterval: parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '5000', 10),
  },
  ui: {
    defaultTheme: (process.env.NEXT_PUBLIC_DEFAULT_THEME as 'light' | 'dark') || 'light',
    animationDuration: 300,
    toastDuration: 5000,
  },
  development: {
    enableDebugLogs: isDevelopment,
    mockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || isDevelopment,
  },
};

// Environment validation
if (isProduction && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn('Production environment detected but NEXT_PUBLIC_API_URL is not set');
}

if (isProduction && !process.env.NEXT_PUBLIC_WS_URL) {
  console.warn('Production environment detected but NEXT_PUBLIC_WS_URL is not set');
}

export default config;
